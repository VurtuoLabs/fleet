/**
 * Repository interfaces - the data seam (CONTRACT.md §11.2).
 *
 * Components never touch the SDK. The chain is:
 *   feature → TanStack Query hook → repository interface (here)
 *           → adapter chosen by getRepositories() on VITE_DATA_MODE.
 *
 * The interfaces are 1:1 with the Apex facades in §8.2.
 */
import type {
  AgentView,
  AssertionTypeView,
  AttributionResult,
  CaseDiffView,
  ChangeEventView,
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

/** Maps to FleetAgentService. */
export interface AgentRepository {
  list(viewKey?: string): Promise<AgentView[]>;
  get(agentId: string): Promise<AgentView>;
  setMonitoring(agentId: string, enabled: boolean): Promise<AgentView>;
  /** Requires Fleet_Quarantine_Agent. */
  quarantine(agentId: string, reason: string): Promise<AgentView>;
  /** Requires Fleet_Quarantine_Agent. */
  release(agentId: string): Promise<AgentView>;
}

/** Maps to FleetCalibrationService. */
export interface CalibrationRepository {
  /** Requires Fleet_Run_Calibration. Enqueues FleetCalibrationQueueable. */
  run(request: RunRequest): Promise<RunView>;
  getRun(runId: string): Promise<RunView>;
  getRuns(agentId: string, limitN?: number): Promise<RunView[]>;
  /** Requires Fleet_Bless_Baseline. Snapshots centroids, sets Blessed_Version__c. */
  bless(runId: string): Promise<AgentView>;
}

/** Maps to FleetGoldenSetService. */
export interface GoldenSetRepository {
  getCases(agentId?: string): Promise<GoldenCaseView[]>;
  getDiff(caseId: string): Promise<CaseDiffView>;
  /** Requires Fleet_Curate_Golden_Set. */
  upsertCase(input: GoldenCaseInput): Promise<GoldenCaseView>;
  approveProposed(caseId: string): Promise<GoldenCaseView>;
  promoteFromTrace(traceKey: string): Promise<GoldenCaseView>;
  deactivate(caseId: string): Promise<GoldenCaseView>;
}

/** Maps to FleetFindingService (Deviation_Finding__c is Private, §7.4). */
export interface FindingRepository {
  getFindings(query?: FindingQuery): Promise<FindingView[]>;
  getFinding(findingId: string): Promise<FindingView>;
  open(input: FindingInput): Promise<FindingView>;
  close(findingId: string, reason: string): Promise<FindingView>;
}

/** Maps to FleetRemediationService. */
export interface RemediationRepository {
  propose(findingId: string): Promise<RemediationView>;
  /** Requires Fleet_Approve_Remediation. */
  approve(remediationId: string): Promise<RemediationResult>;
  reject(remediationId: string, reason: string): Promise<RemediationView>;
  /** Idempotent on Idempotency_Key__c. */
  execute(remediationId: string): Promise<RemediationResult>;
}

/** Maps to FleetChangeLedgerService + FleetDriftService + FleetAttributionService. */
export interface ChangeRepository {
  getChangeEvents(windowHours?: number): Promise<ChangeEventView[]>;
  getChange(changeId: string): Promise<ChangeEventView>;
  /** The trueness board: per-agent series + threshold + change rail. */
  getDriftBoard(windowHours?: number): Promise<DriftBoard>;
  /** Correlate one change event against the golden-set deviations. */
  attribute(changeId: string): Promise<AttributionResult>;
}

/** Read-only projection of the admin CMDT (drives /settings/*). */
export interface ConfigRepository {
  getSetting(): Promise<SettingView>;
  getAssertionTypes(): Promise<AssertionTypeView[]>;
  getDetectors(): Promise<DetectorView[]>;
  getSeverityPolicies(): Promise<SeverityPolicyView[]>;
  getChangeSources(): Promise<ChangeSourceView[]>;
  getViews(): Promise<ViewDefView[]>;
}

/** The composed repository surface handed to hooks. */
export interface Repositories {
  agents: AgentRepository;
  calibration: CalibrationRepository;
  goldenSet: GoldenSetRepository;
  findings: FindingRepository;
  remediation: RemediationRepository;
  changes: ChangeRepository;
  config: ConfigRepository;
}
