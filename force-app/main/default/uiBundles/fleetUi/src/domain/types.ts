/**
 * Fleet domain DTOs - the shared vocabulary between the data seam
 * (repositories → hooks) and the feature pages. Field names mirror the
 * `@AuraEnabled` view classes returned by the Apex facades (CONTRACT.md §8.2)
 * and the underlying custom-object fields (§3). Enum string values are the
 * canonical keys the console renders on.
 */

/* --------------------------------- enums --------------------------------- */

/**
 * Fleet_Agent__c.Status__c, as the compact keys the console themes on.
 * (features/shared/meta.ts folds synonyms/casing into these.)
 */
export type AgentStatus = "true" | "watch" | "drift" | "quarantined";

/** Deviation_Finding__c.Severity__c / Fleet_Severity_Policy__mdt.Severity__c. */
export type FindingSeverity = "Critical" | "Elevated" | "Advisory";

/** Change_Event__c.Kind__c - sky differentiates Knowledge as secondary signal. */
export type ChangeKind = "Deploy" | "Knowledge" | "Model" | "Prompt";

/** Calibration_Run__c.Trigger_Source__c. */
export type TriggerSource = "Scheduled" | "Change_Event" | "Manual" | "CI_Gate";

/** Golden_Case__c.Source__c. */
export type GoldenCaseSource =
  | "Curated"
  | "Auto_Proposed"
  | "Promoted_From_Production";

/** Golden_Case__c.Last_Result__c. */
export type CaseResult = "Pass" | "Fail";

/** Assertion__c.Assertion_Type__c - matches Fleet_Assertion_Type__mdt.Type_Key__c. */
export type AssertionType =
  | "MUST_ROUTE_TO"
  | "MUST_GROUND_IN"
  | "MUST_INVOKE"
  | "MUST_NOT_INVOKE"
  | "MUST_CONVEY"
  | "MUST_NOT_CONVEY"
  | "LATENCY_P95_MS"
  | "CREDIT_CEILING"
  | "MUST_ESCALATE";

/** Fleet_Drift_Detector__mdt.Detector_Key__c. */
export type DriftDetectorKey =
  | "SEMANTIC_DRIFT"
  | "STRUCTURAL_DRIFT"
  | "ECONOMIC_DRIFT"
  | "TRUST_DRIFT";

/** Fleet_Severity_Policy__mdt.Auto_Action__c. */
export type AutoAction = "Notify" | "Request_Approval" | "Quarantine";

/** Remediation__c.Approval_State__c. */
export type ApprovalState =
  | "Draft"
  | "Pending_Approval"
  | "Approved"
  | "Rejected"
  | "Executed";

/* -------------------------------- agents --------------------------------- */

/** FleetAgentService.AgentView. */
export interface AgentView {
  id: string;
  name: string;
  agentApiName: string;
  botId?: string | null;
  currentVersion: string;
  blessedVersion: string | null;
  truenessScore: number; // 0..100
  status: AgentStatus;
  monitoringEnabled: boolean;
  calibrationSchedule?: string | null;
  ownerQueueId?: string | null;
  lastCalibratedAt: string | null;
  consecutiveFailures?: number;
  quarantinedAt: string | null;
  quarantinedBy?: string | null;
  casesPassing: number;
  casesTotal: number;
}

/* ---------------------------- calibration runs --------------------------- */

/** FleetCalibrationService.RunView. */
export interface RunView {
  id: string;
  runKey: string;
  agentId: string;
  agentName: string;
  triggerSource: TriggerSource;
  triggerChangeEventId?: string | null;
  startedAt: string | null;
  completedAt: string | null;
  status: string;
  casesTotal: number;
  casesPassed: number;
  casesFailed: number;
  truenessScore: number;
  creditsConsumed?: number;
  judgeInvocations?: number;
  prefilterSkips?: number;
  error?: string | null;
  results?: CaseResultRow[];
}

/** Case_Result__c projection for a run's detail table. */
export interface CaseResultRow {
  id: string;
  caseKey: string;
  passed: boolean;
  deviationScore: number;
  judged: boolean;
  latencyMs: number | null;
  credits: number | null;
}

/* --------------------------------- drift --------------------------------- */

/** A single sampled trueness point. t = hours into the window (0..windowHours). */
export interface DriftPoint {
  t: number;
  v: number;
}

/** A change marker positioned on the drift rail at hour `t`. */
export interface ChangeMarker {
  id: string;
  changeEventId: string;
  kind: ChangeKind;
  label: string;
  t: number;
}

/** Per-agent trueness series across the drift window. */
export interface DriftSeries {
  agentId: string;
  agentName: string;
  status: AgentStatus;
  currentScore: number;
  points: DriftPoint[];
  /** Change markers relevant to this agent, pre-positioned by hour. */
  changes?: ChangeMarker[];
}

/** FleetDriftService board: series + threshold + the change rail. */
export interface DriftBoard {
  windowHours: number;
  threshold: number;
  series: DriftSeries[];
  changes?: ChangeMarker[];
}

/* ------------------------------- golden set ------------------------------ */

/** FleetGoldenSetService.GoldenCaseView. */
export interface GoldenCaseView {
  id: string;
  agentId: string;
  caseKey: string;
  utterance: string | null; // null unless Fleet_View_Transcripts
  active: boolean;
  source: GoldenCaseSource;
  proposedAt?: string | null;
  approvedBy?: string | null;
  baselineVersion?: string | null;
  exemplarCount?: number;
  weight?: number;
  lastResult: CaseResult | null;
  consecutiveFailures: number;
}

/** A span of a response; `changed` marks the differing region. */
export interface DiffSegment {
  text: string;
  changed?: boolean;
}

/** One assertion verdict in the case diff. */
export interface DiffAssertion {
  label: string;
  passed: boolean;
}

/** FleetGoldenSetService case-diff view - baseline vs current. */
export interface CaseDiffView {
  caseId: string;
  caseKey: string;
  agentName?: string;
  utterance: string | null;
  baselineVersion: string;
  currentVersion: string;
  calibratedAt: string | null;
  baseline: DiffSegment[];
  current: DiffSegment[];
  grounding: { baseline: string[]; current: string[] };
  assertions: DiffAssertion[];
}

/* -------------------------------- findings ------------------------------- */

/** The change a finding was attributed to, denormalized onto the finding. */
export interface AttributedChange {
  changeEventId: string;
  label: string;
  kind: ChangeKind;
  actor: string;
}

/** A remediation summary embedded on a finding. */
export interface RemediationSummary {
  id: string;
  actionLabel: string;
  approvalState: ApprovalState;
}

/** FleetFindingService.FindingView (Deviation_Finding__c is Private, §7.4). */
export interface FindingView {
  id: string;
  findingNumber: string; // F-00000
  agentId: string;
  agentName: string;
  severity: FindingSeverity;
  state: string;
  headline: string;
  detail: string;
  detector: DriftDetectorKey;
  openedAt: string | null;
  closedAt?: string | null;
  attributedChange: AttributedChange | null;
  attributionConfidence: number | null; // 0..1
  casesFailing: number;
  casesTotal: number;
  agentAction: string | null;
  remediation: RemediationSummary | null;
}

/** Full Remediation__c projection returned by the remediation facade. */
export interface RemediationView {
  id: string;
  findingId: string;
  actionLabel: string;
  approvalState: ApprovalState;
  requestedBy: string | null;
  approver: string | null;
  approvedAt: string | null;
  idempotencyKey: string;
  result: string | null;
  error: string | null;
}

/* ------------------------------ change ledger ---------------------------- */

/** Change_Event__c projection. */
export interface ChangeEventView {
  id: string;
  changeKey: string;
  kind: ChangeKind;
  label: string;
  actor: string | null;
  occurredAt: string | null;
  detail: string | null;
  affectedArtifacts: string[];
  correlationWindowMinutes: number;
}

/** An agent that went out of true inside a change's correlation window. */
export interface CorrelatedDeviation {
  agentId: string;
  agentName: string;
  casesFailing: number;
  casesTotal: number;
}

/** FleetAttributionService result for one change event. */
export interface AttributionResult {
  change: ChangeEventView;
  confidence: number; // 0..1
  correlatedDeviations: CorrelatedDeviation[];
  blastRadius: string[];
  note?: string;
}

/* -------------------------- admin configuration -------------------------- */

/** Fleet_Setting__mdt Default record. */
export interface SettingView {
  monitoringEnabled: boolean;
  defaultScheduleCron: string;
  judgeTemplateName: string;
  prefilterLowerBound: number;
  prefilterUpperBound: number;
  maxCasesPerRun: number;
  truenessThreshold: number;
  retentionDaysCaseResult: number;
  retentionDaysTrace: number;
  autoCurationEnabled: boolean;
  autoCurationCron?: string;
  ciGateEnabled: boolean;
}

/** Fleet_Drift_Detector__mdt projection. */
export interface DetectorView {
  detectorKey: DriftDetectorKey;
  label: string;
  strategy: string;
  threshold: number;
  windowHours: number;
  minimumSample: number;
  weight: number;
  active: boolean;
}

/** Fleet_Severity_Policy__mdt projection. */
export interface SeverityPolicyView {
  severity: FindingSeverity;
  autoAction: AutoAction;
  notifyQueueId?: string | null;
  approvalQueueId?: string | null;
  requiresCustomPermission: string | null;
  autoCloseAfterDays: number | null;
  active: boolean;
}

/** Fleet_Assertion_Type__mdt projection. */
export interface AssertionTypeView {
  typeKey: AssertionType;
  label: string;
  evaluationStrategy: "Deterministic" | "Semantic" | "Numeric";
  requiresJudge: boolean;
  defaultSeverity: FindingSeverity;
  active: boolean;
}

/** Fleet_Change_Source__mdt projection. */
export interface ChangeSourceView {
  sourceKey: string;
  label: string;
  ingestionStrategy: "SetupAuditTrail" | "Platform_Event" | "Scheduled_Poll";
  correlationWindowMinutes: number;
  active: boolean;
}

/** Fleet_View__mdt projection (saved views). */
export interface ViewDefView {
  viewKey: string;
  label: string;
  filterJson?: string | null;
  sortField: string | null;
  sortDirection: "ASC" | "DESC" | null;
  displayOrder: number;
  active: boolean;
}

/* -------------------------------- queries -------------------------------- */

export interface FindingQuery {
  agentId?: string;
  severity?: FindingSeverity;
  state?: string;
  openOnly?: boolean;
}

/* ------------------------------ write inputs ----------------------------- */

export interface RunRequest {
  agentId: string;
  triggerSource: TriggerSource;
}

export interface GoldenCaseInput {
  id?: string;
  agentId: string;
  caseKey: string;
  utterance: string;
  active: boolean;
  weight: number;
}

export interface FindingInput {
  agentId: string;
  severity: FindingSeverity;
  headline: string;
  detail: string;
  detector: DriftDetectorKey;
}

export interface RemediationResult {
  remediationId: string;
  approvalState: ApprovalState;
  result: string | null;
  error: string | null;
}
