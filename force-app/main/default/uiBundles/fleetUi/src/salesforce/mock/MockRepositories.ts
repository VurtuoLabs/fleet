import { buildSeries } from "@/domain/drift";
import { SEVERITY_RANK, statusFromTrueness } from "@/domain/labels";
import type {
  AgentView,
  AttributionResult,
  CaseDiffView,
  ChangeEventView,
  CorrelatedDeviation,
  DriftBoard,
  DriftSeries,
  FindingInput,
  FindingQuery,
  FindingView,
  GoldenCaseInput,
  GoldenCaseView,
  RemediationResult,
  RemediationView,
  RunRequest,
  RunView,
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
import {
  CHANGE_IMPACT,
  SEED_AGENTS,
  SEED_ASSERTION_TYPES,
  SEED_CASE_DIFF,
  SEED_CHANGE_EVENTS,
  SEED_CHANGE_MARKERS,
  SEED_CHANGE_SOURCES,
  SEED_DETECTORS,
  SEED_FINDINGS,
  SEED_GOLDEN_CASES,
  SEED_REMEDIATIONS,
  SEED_RUNS,
  SEED_SERIES,
  SEED_SETTING,
  SEED_SEVERITY_POLICIES,
  SEED_VIEWS,
} from "./seed";

/** Deep clone so mutations never leak back into the frozen seed fixtures. */
function clone<T>(value: T): T {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T);
}

/** Simulate network latency so loading states are exercised in the demo. */
function delay<T>(value: T, ms = 200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/**
 * In-memory implementation of every repository interface, backed by the seed
 * fixtures. Makes the whole console demoable and unit-testable with no org.
 * Instance state reflects in-session writes (monitoring toggles, quarantines).
 */
export class MockRepositories implements Repositories {
  private agentStore: AgentView[] = clone(SEED_AGENTS);
  private changeStore: ChangeEventView[] = clone(SEED_CHANGE_EVENTS);
  private findingStore: FindingView[] = clone(SEED_FINDINGS);
  private remediationStore: RemediationView[] = clone(SEED_REMEDIATIONS);
  private goldenStore: Record<string, GoldenCaseView[]> = clone(SEED_GOLDEN_CASES);
  private runStore: RunView[] = clone(SEED_RUNS);

  private findAgent(agentId: string): AgentView {
    const agent = this.agentStore.find((a) => a.id === agentId);
    if (!agent) throw new Error(`Agent not found: ${agentId}`);
    return agent;
  }

  private findCase(caseId: string): GoldenCaseView {
    for (const list of Object.values(this.goldenStore)) {
      const found = list.find((c) => c.id === caseId);
      if (found) return found;
    }
    throw new Error(`Golden case not found: ${caseId}`);
  }

  private findRemediation(remediationId: string): RemediationView {
    const rem = this.remediationStore.find((r) => r.id === remediationId);
    if (!rem) throw new Error(`Remediation not found: ${remediationId}`);
    return rem;
  }

  /* ---------------------------- AgentRepository ------------------------- */
  agents: AgentRepository = {
    list: (viewKey?: string) => {
      let rows = clone(this.agentStore);
      if (viewKey === "OUT_OF_TRUE") rows = rows.filter((a) => a.status === "drift");
      else if (viewKey === "QUARANTINED")
        rows = rows.filter((a) => a.status === "quarantined");
      else if (viewKey === "MY_AGENTS")
        rows = rows.filter((a) => a.monitoringEnabled);
      rows.sort((a, b) => a.truenessScore - b.truenessScore);
      return delay(rows);
    },
    get: (agentId: string) => delay(clone(this.findAgent(agentId))),
    setMonitoring: (agentId: string, enabled: boolean) => {
      const agent = this.findAgent(agentId);
      agent.monitoringEnabled = enabled;
      return delay(clone(agent));
    },
    quarantine: (agentId: string, _reason: string) => {
      const agent = this.findAgent(agentId);
      agent.status = "quarantined";
      agent.quarantinedAt = new Date().toISOString();
      agent.quarantinedBy = "Current User";
      return delay(clone(agent));
    },
    release: (agentId: string) => {
      const agent = this.findAgent(agentId);
      agent.quarantinedAt = null;
      agent.quarantinedBy = null;
      agent.status = statusFromTrueness(agent.truenessScore, false);
      return delay(clone(agent));
    },
  };

  /* ------------------------- CalibrationRepository ---------------------- */
  calibration: CalibrationRepository = {
    run: (request: RunRequest) => {
      const agent = this.findAgent(request.agentId);
      const run: RunView = {
        id: `run-${Date.now()}`,
        runKey: `run-${Date.now()}`,
        agentId: agent.id,
        agentName: agent.name,
        triggerSource: request.triggerSource,
        triggerChangeEventId: null,
        startedAt: new Date().toISOString(),
        completedAt: null,
        status: "Running",
        casesTotal: agent.casesTotal,
        casesPassed: 0,
        casesFailed: 0,
        truenessScore: agent.truenessScore,
        creditsConsumed: 0,
        judgeInvocations: 0,
        prefilterSkips: 0,
        error: null,
      };
      this.runStore = [run, ...this.runStore];
      return delay(clone(run));
    },
    getRun: (runId: string) => {
      const run = this.runStore.find((r) => r.id === runId);
      if (!run) throw new Error(`Run not found: ${runId}`);
      return delay(clone(run));
    },
    getRuns: (agentId: string, limitN = 20) =>
      delay(
        clone(this.runStore.filter((r) => r.agentId === agentId).slice(0, limitN)),
      ),
    bless: (runId: string) => {
      const run = this.runStore.find((r) => r.id === runId);
      if (!run) throw new Error(`Run not found: ${runId}`);
      const agent = this.findAgent(run.agentId);
      agent.blessedVersion = agent.currentVersion;
      return delay(clone(agent));
    },
  };

  /* -------------------------- GoldenSetRepository ----------------------- */
  goldenSet: GoldenSetRepository = {
    getCases: (agentId?: string) => {
      if (agentId) return delay(clone(this.goldenStore[agentId] ?? []));
      const all = Object.values(this.goldenStore).flat();
      return delay(clone(all));
    },
    getDiff: (_caseId: string): Promise<CaseDiffView> => delay(clone(SEED_CASE_DIFF)),
    upsertCase: (input: GoldenCaseInput) => {
      const list = this.goldenStore[input.agentId] ?? [];
      const id = input.id ?? `gc-${Date.now()}`;
      const view: GoldenCaseView = {
        id,
        agentId: input.agentId,
        caseKey: input.caseKey,
        utterance: input.utterance,
        active: input.active,
        source: "Curated",
        proposedAt: new Date().toISOString(),
        approvedBy: "Current User",
        baselineVersion: null,
        exemplarCount: 1,
        weight: input.weight,
        lastResult: null,
        consecutiveFailures: 0,
      };
      const idx = list.findIndex((c) => c.id === id);
      if (idx >= 0) list[idx] = view;
      else list.push(view);
      this.goldenStore[input.agentId] = list;
      return delay(clone(view));
    },
    approveProposed: (caseId: string) => {
      const view = this.findCase(caseId);
      view.source = "Curated";
      view.approvedBy = "Current User";
      view.active = true;
      return delay(clone(view));
    },
    promoteFromTrace: (traceKey: string) => {
      const view: GoldenCaseView = {
        id: `gc-${Date.now()}`,
        agentId: "renewal",
        caseKey: `promoted_${traceKey}`,
        utterance: null,
        active: true,
        source: "Promoted_From_Production",
        proposedAt: new Date().toISOString(),
        approvedBy: null,
        baselineVersion: null,
        exemplarCount: 1,
        weight: 1,
        lastResult: null,
        consecutiveFailures: 0,
      };
      (this.goldenStore.renewal ??= []).push(view);
      return delay(clone(view));
    },
    deactivate: (caseId: string) => {
      const view = this.findCase(caseId);
      view.active = false;
      return delay(clone(view));
    },
  };

  /* --------------------------- FindingRepository ------------------------ */
  findings: FindingRepository = {
    getFindings: (query?: FindingQuery) => {
      let rows = clone(this.findingStore);
      if (query?.agentId) rows = rows.filter((f) => f.agentId === query.agentId);
      if (query?.severity) rows = rows.filter((f) => f.severity === query.severity);
      if (query?.state) rows = rows.filter((f) => f.state === query.state);
      if (query?.openOnly) rows = rows.filter((f) => f.state !== "Closed");
      rows.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
      return delay(rows);
    },
    getFinding: (findingId: string) => {
      const found = this.findingStore.find(
        (f) => f.id === findingId || f.findingNumber === findingId,
      );
      if (!found) throw new Error(`Finding not found: ${findingId}`);
      return delay(clone(found));
    },
    open: (input: FindingInput) => {
      const agent = this.findAgent(input.agentId);
      const n = 2292 + this.findingStore.length;
      const view: FindingView = {
        id: `F-${n}`,
        findingNumber: `F-${n}`,
        agentId: agent.id,
        agentName: agent.name,
        severity: input.severity,
        state: "Open",
        headline: input.headline,
        detail: input.detail,
        detector: input.detector,
        openedAt: new Date().toISOString(),
        closedAt: null,
        attributedChange: null,
        attributionConfidence: null,
        casesFailing: 0,
        casesTotal: agent.casesTotal,
        agentAction: null,
        remediation: null,
      };
      this.findingStore = [view, ...this.findingStore];
      return delay(clone(view));
    },
    close: (findingId: string, reason: string) => {
      const found = this.findingStore.find(
        (f) => f.id === findingId || f.findingNumber === findingId,
      );
      if (!found) throw new Error(`Finding not found: ${findingId}`);
      found.state = "Closed";
      found.closedAt = new Date().toISOString();
      found.agentAction = `Closed: ${reason}`;
      return delay(clone(found));
    },
  };

  /* ------------------------- RemediationRepository ---------------------- */
  remediation: RemediationRepository = {
    propose: (findingId: string) => {
      const rem: RemediationView = {
        id: `rem-${Date.now()}`,
        findingId,
        actionLabel: "rollback to blessed version",
        approvalState: "Pending_Approval",
        requestedBy: "Current User",
        approver: null,
        approvedAt: null,
        idempotencyKey: `rem-${findingId}-${Date.now()}`,
        result: null,
        error: null,
      };
      this.remediationStore = [rem, ...this.remediationStore];
      return delay(clone(rem));
    },
    approve: (remediationId: string): Promise<RemediationResult> => {
      const rem = this.findRemediation(remediationId);
      rem.approvalState = "Approved";
      rem.approver = "Current User";
      rem.approvedAt = new Date().toISOString();
      return delay({
        remediationId: rem.id,
        approvalState: rem.approvalState,
        result: "Approved",
        error: null,
      });
    },
    reject: (remediationId: string, reason: string) => {
      const rem = this.findRemediation(remediationId);
      rem.approvalState = "Rejected";
      rem.result = reason;
      return delay(clone(rem));
    },
    execute: (remediationId: string): Promise<RemediationResult> => {
      const rem = this.findRemediation(remediationId);
      rem.approvalState = "Executed";
      rem.result = "Rollback executed";
      return delay({
        remediationId: rem.id,
        approvalState: rem.approvalState,
        result: rem.result,
        error: null,
      });
    },
  };

  /* ---------------------------- ChangeRepository ------------------------ */
  changes: ChangeRepository = {
    getChangeEvents: (_windowHours = 72) => delay(clone(this.changeStore)),
    getChange: (changeId: string) => {
      const found = this.changeStore.find((c) => c.id === changeId);
      if (!found) throw new Error(`Change not found: ${changeId}`);
      return delay(clone(found));
    },
    getDriftBoard: (windowHours = 72): Promise<DriftBoard> => {
      const markers = clone(SEED_CHANGE_MARKERS);
      const series: DriftSeries[] = this.agentStore.map((a) => {
        const spec = SEED_SERIES[a.id] ?? { id: a.id, base: a.truenessScore, amp: 2 };
        const points = buildSeries(spec);
        return {
          agentId: a.id,
          agentName: a.name,
          status: a.status,
          currentScore: a.truenessScore,
          points,
          // The rail is global in the console: every series carries all markers.
          changes: clone(markers),
        };
      });
      return delay({ windowHours, threshold: 80, series, changes: markers });
    },
    attribute: (changeId: string): Promise<AttributionResult> => {
      const change = this.changeStore.find((c) => c.id === changeId);
      if (!change) throw new Error(`Change not found: ${changeId}`);
      const impacted = CHANGE_IMPACT[changeId] ?? [];
      const correlatedDeviations: CorrelatedDeviation[] = impacted
        .map((agentId) => this.agentStore.find((a) => a.id === agentId))
        .filter((a): a is AgentView => Boolean(a))
        .map((a) => ({
          agentId: a.id,
          agentName: a.name,
          casesFailing: a.casesTotal - a.casesPassing,
          casesTotal: a.casesTotal,
        }));
      const confidence = correlatedDeviations.length ? 0.85 : 0.2;
      const note =
        correlatedDeviations.length === 0
          ? "No agent went out of true within the correlation window. Nothing to act on."
          : undefined;
      return delay({
        change: clone(change),
        confidence,
        correlatedDeviations,
        blastRadius: clone(change.affectedArtifacts),
        note,
      });
    },
  };

  /* ---------------------------- ConfigRepository ------------------------ */
  config: ConfigRepository = {
    getSetting: () => delay(clone(SEED_SETTING)),
    getAssertionTypes: () => delay(clone(SEED_ASSERTION_TYPES)),
    getDetectors: () => delay(clone(SEED_DETECTORS)),
    getSeverityPolicies: () => delay(clone(SEED_SEVERITY_POLICIES)),
    getChangeSources: () => delay(clone(SEED_CHANGE_SOURCES)),
    getViews: () => delay(clone(SEED_VIEWS)),
  };
}
