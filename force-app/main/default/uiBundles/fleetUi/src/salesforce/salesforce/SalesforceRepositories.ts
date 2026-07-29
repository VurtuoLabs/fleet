import { createDataSDK, gql } from "@salesforce/platform-sdk";
import type {
  AgentView,
  AssertionTypeView,
  AttributionResult,
  CaseDiffView,
  ChangeEventView,
  ChangeKind,
  ChangeSourceView,
  DetectorView,
  DriftBoard,
  FindingInput,
  FindingQuery,
  FindingView,
  GoldenCaseInput,
  GoldenCaseView,
  RemediationResult,
  RemediationView,
  RunRequest,
  RunView,
  SettingView,
  SeverityPolicyView,
  ViewDefView,
} from "@/domain/types";
import type {
  AgentRepository,
  CalibrationRepository,
  ChangeRepository,
  ConfigRepository,
  FindingRepository,
  GoldenSetRepository,
  RemediationRepository,
  Repositories,
} from "@/salesforce/repositories";

/**
 * Salesforce adapter (CONTRACT.md §11.3).
 *
 * Rule of thumb: GraphQL for reads over records the user can already see, Apex
 * facades for anything with a permission check, a state transition, or a
 * rollup. Every write goes through Apex.
 *
 * Permissioned/computed reads (drift board, case diff, findings, and any read
 * that can surface Utterance__c / Response__c) go through Apex, because the
 * facade re-checks Fleet_View_Transcripts and nulls the text otherwise (§7.4) - 
 * FLS alone does not protect DTO fields.
 */

interface FleetSdk {
  graphql?: {
    query<T>(args: { query: unknown; variables?: Record<string, unknown> }): Promise<{
      data?: T;
    }>;
  };
  apex?: {
    invoke<T>(args: {
      classAndMethod: string;
      params?: Record<string, unknown>;
    }): Promise<T>;
  };
}

let sdkPromise: Promise<FleetSdk> | null = null;
function getSdk(): Promise<FleetSdk> {
  if (!sdkPromise) sdkPromise = createDataSDK() as unknown as Promise<FleetSdk>;
  return sdkPromise;
}

/** Invoke an Apex facade method. All writes and permissioned reads use this. */
async function apex<T>(
  classAndMethod: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const sdk = await getSdk();
  if (!sdk.apex) throw new Error("Apex bridge unavailable on the platform SDK");
  return sdk.apex.invoke<T>({ classAndMethod, params });
}

/** Extract UIAPI edges for an object, tolerating an undefined chain. */
function edges<T>(data: unknown, object: string): Array<{ node: T }> {
  const query = (data as { uiapi?: { query?: Record<string, unknown> } })?.uiapi
    ?.query;
  const conn = query?.[object] as { edges?: Array<{ node: T }> } | undefined;
  return conn?.edges ?? [];
}

/* GraphQL read demonstrated on the change ledger (plain record read, §11.3). */
const CHANGES_QUERY = gql`
  query FleetChanges {
    uiapi {
      query {
        Change_Event__c(first: 200, orderBy: { Occurred_At__c: { order: DESC } }) {
          edges {
            node {
              Id
              Change_Key__c { value }
              Kind__c { value }
              Label__c { value }
              Actor__c { value }
              Occurred_At__c { value }
              Detail__c { value }
              Affected_Artifacts__c { value }
              Correlation_Window_Minutes__c { value }
            }
          }
        }
      }
    }
  }
`;

interface GqlField<T> {
  value: T;
}
interface ChangeNode {
  Id: string;
  Change_Key__c: GqlField<string>;
  Kind__c: GqlField<ChangeKind>;
  Label__c: GqlField<string>;
  Actor__c: GqlField<string | null>;
  Occurred_At__c: GqlField<string | null>;
  Detail__c: GqlField<string | null>;
  Affected_Artifacts__c: GqlField<string | null>;
  Correlation_Window_Minutes__c: GqlField<number | null>;
}

function mapChange(node: ChangeNode): ChangeEventView {
  return {
    id: node.Id,
    changeKey: node.Change_Key__c?.value ?? "",
    kind: node.Kind__c?.value ?? "Deploy",
    label: node.Label__c?.value ?? "",
    actor: node.Actor__c?.value ?? null,
    occurredAt: node.Occurred_At__c?.value ?? null,
    detail: node.Detail__c?.value ?? null,
    affectedArtifacts: (node.Affected_Artifacts__c?.value ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    correlationWindowMinutes: node.Correlation_Window_Minutes__c?.value ?? 120,
  };
}

export class SalesforceRepositories implements Repositories {
  agents: AgentRepository = {
    list: (viewKey?: string) =>
      apex<AgentView[]>("FleetAgentService.getAgents", { viewKey: viewKey ?? null }),
    get: (agentId: string) =>
      apex<AgentView>("FleetAgentService.getAgent", { agentId }),
    setMonitoring: (agentId: string, enabled: boolean) =>
      apex<AgentView>("FleetAgentService.setMonitoring", { agentId, enabled }),
    quarantine: (agentId: string, reason: string) =>
      apex<AgentView>("FleetAgentService.quarantine", { agentId, reason }),
    release: (agentId: string) =>
      apex<AgentView>("FleetAgentService.release", { agentId }),
  };

  calibration: CalibrationRepository = {
    run: (request: RunRequest) =>
      apex<RunView>("FleetCalibrationService.run", { request }),
    getRun: (runId: string) =>
      apex<RunView>("FleetCalibrationService.getRun", { runId }),
    getRuns: (agentId: string, limitN = 20) =>
      apex<RunView[]>("FleetCalibrationService.getRuns", { agentId, limitN }),
    bless: (runId: string) =>
      apex<AgentView>("FleetCalibrationService.bless", { runId }),
  };

  goldenSet: GoldenSetRepository = {
    getCases: (agentId?: string) =>
      apex<GoldenCaseView[]>("FleetGoldenSetService.getCases", {
        agentId: agentId ?? null,
      }),
    getDiff: (caseId: string) =>
      apex<CaseDiffView>("FleetGoldenSetService.getDiff", { caseId }),
    upsertCase: (input: GoldenCaseInput) =>
      apex<GoldenCaseView>("FleetGoldenSetService.upsertCase", { input }),
    approveProposed: (caseId: string) =>
      apex<GoldenCaseView>("FleetGoldenSetService.approveProposed", { caseId }),
    promoteFromTrace: (traceKey: string) =>
      apex<GoldenCaseView>("FleetGoldenSetService.promoteFromTrace", { traceKey }),
    deactivate: (caseId: string) =>
      apex<GoldenCaseView>("FleetGoldenSetService.deactivate", { caseId }),
  };

  findings: FindingRepository = {
    // Deviation_Finding__c is Private and transcript-adjacent: always via Apex.
    getFindings: (query?: FindingQuery) =>
      apex<FindingView[]>("FleetFindingService.getFindings", { query: query ?? {} }),
    getFinding: (findingId: string) =>
      apex<FindingView>("FleetFindingService.getFinding", { findingId }),
    open: (input: FindingInput) =>
      apex<FindingView>("FleetFindingService.open", { input }),
    close: (findingId: string, reason: string) =>
      apex<FindingView>("FleetFindingService.close", { findingId, reason }),
  };

  remediation: RemediationRepository = {
    propose: (findingId: string) =>
      apex<RemediationView>("FleetRemediationService.propose", { findingId }),
    approve: (remediationId: string) =>
      apex<RemediationResult>("FleetRemediationService.approve", { remediationId }),
    reject: (remediationId: string, reason: string) =>
      apex<RemediationView>("FleetRemediationService.reject", { remediationId, reason }),
    execute: (remediationId: string) =>
      apex<RemediationResult>("FleetRemediationService.execute", { remediationId }),
  };

  changes: ChangeRepository = {
    getChangeEvents: async (_windowHours = 72) => {
      const sdk = await getSdk();
      const res = await sdk.graphql?.query<unknown>({ query: CHANGES_QUERY });
      return edges<ChangeNode>(res?.data, "Change_Event__c").map((e) =>
        mapChange(e.node),
      );
    },
    getChange: (changeId: string) =>
      apex<ChangeEventView>("FleetChangeLedgerService.getChange", { changeId }),
    getDriftBoard: (windowHours = 72) =>
      apex<DriftBoard>("FleetDriftService.getBoard", { windowHours }),
    attribute: (changeId: string) =>
      apex<AttributionResult>("FleetAttributionService.attribute", { changeId }),
  };

  config: ConfigRepository = {
    getSetting: () => apex<SettingView>("FleetConfigurationService.getSetting", {}),
    getAssertionTypes: () =>
      apex<AssertionTypeView[]>("FleetConfigurationService.getAssertionTypes", {}),
    getDetectors: () =>
      apex<DetectorView[]>("FleetConfigurationService.getDetectors", {}),
    getSeverityPolicies: () =>
      apex<SeverityPolicyView[]>("FleetConfigurationService.getSeverityPolicies", {}),
    getChangeSources: () =>
      apex<ChangeSourceView[]>("FleetConfigurationService.getChangeSources", {}),
    getViews: () => apex<ViewDefView[]>("FleetConfigurationService.getViews", {}),
  };
}
