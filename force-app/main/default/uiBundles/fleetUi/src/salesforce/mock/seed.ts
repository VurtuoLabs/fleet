import type { SeriesSpec } from "@/domain/drift";
import type {
  AgentView,
  AssertionTypeView,
  CaseDiffView,
  ChangeEventView,
  ChangeMarker,
  ChangeSourceView,
  DetectorView,
  FindingView,
  GoldenCaseView,
  RemediationView,
  RunView,
  SettingView,
  SeverityPolicyView,
  ViewDefView,
} from "@/domain/types";

/**
 * Rich seed data mirroring docs/console-mockup.jsx: six monitored agents with
 * trueness and status, a four-marker change rail, three findings with attributed
 * causes and an awaiting-approval remediation, a baseline-vs-current case diff,
 * golden cases, runs, and the admin CMDT projections. The fixture the mock
 * adapter serves so the console is fully demoable with no org.
 */

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString();
const daysAgo = (d: number) => hoursAgo(d * 24);
/** Marker at hour `t` in the 72h window → an absolute occurredAt. */
const atHour = (t: number) => hoursAgo(72 - t);

/* ------------------------------- Agents ---------------------------------- */

export const SEED_AGENTS: AgentView[] = [
  {
    id: "refund",
    name: "Refund Concierge",
    agentApiName: "Refund_Concierge",
    botId: "0Xx000000000001",
    currentVersion: "v2.4",
    blessedVersion: "v2.4",
    truenessScore: 98,
    status: "true",
    monitoringEnabled: true,
    calibrationSchedule: "0 0 */6 * * ?",
    ownerQueueId: "00G000000000001",
    lastCalibratedAt: hoursAgo(0.2),
    consecutiveFailures: 0,
    quarantinedAt: null,
    quarantinedBy: null,
    casesPassing: 24,
    casesTotal: 24,
  },
  {
    id: "renewal",
    name: "Renewal Outreach",
    agentApiName: "Renewal_Outreach",
    botId: "0Xx000000000002",
    currentVersion: "v3.1",
    blessedVersion: "v3.0",
    truenessScore: 71,
    status: "drift",
    monitoringEnabled: true,
    calibrationSchedule: "0 0 */6 * * ?",
    ownerQueueId: "00G000000000002",
    lastCalibratedAt: hoursAgo(0.2),
    consecutiveFailures: 3,
    quarantinedAt: null,
    quarantinedBy: null,
    casesPassing: 8,
    casesTotal: 11,
  },
  {
    id: "onboard",
    name: "Onboarding Guide",
    agentApiName: "Onboarding_Guide",
    botId: "0Xx000000000003",
    currentVersion: "v6.0",
    blessedVersion: "v5.4",
    truenessScore: 44,
    status: "quarantined",
    monitoringEnabled: true,
    calibrationSchedule: "0 0 */4 * * ?",
    ownerQueueId: "00G000000000003",
    lastCalibratedAt: hoursAgo(4),
    consecutiveFailures: 5,
    quarantinedAt: hoursAgo(3.5),
    quarantinedBy: "A. Imperiale",
    casesPassing: 5,
    casesTotal: 14,
  },
  {
    id: "claims",
    name: "Claims Triage",
    agentApiName: "Claims_Triage",
    botId: "0Xx000000000004",
    currentVersion: "v1.9",
    blessedVersion: "v1.9",
    truenessScore: 94,
    status: "true",
    monitoringEnabled: true,
    calibrationSchedule: "0 0 */6 * * ?",
    ownerQueueId: "00G000000000004",
    lastCalibratedAt: hoursAgo(0.5),
    consecutiveFailures: 0,
    quarantinedAt: null,
    quarantinedBy: null,
    casesPassing: 31,
    casesTotal: 32,
  },
  {
    id: "billing",
    name: "Billing Inquiry",
    agentApiName: "Billing_Inquiry",
    botId: "0Xx000000000005",
    currentVersion: "v4.2",
    blessedVersion: "v4.2",
    truenessScore: 86,
    status: "watch",
    monitoringEnabled: true,
    calibrationSchedule: "0 0 */6 * * ?",
    ownerQueueId: "00G000000000005",
    lastCalibratedAt: hoursAgo(0.4),
    consecutiveFailures: 0,
    quarantinedAt: null,
    quarantinedBy: null,
    casesPassing: 17,
    casesTotal: 19,
  },
  {
    id: "dispatch",
    name: "Field Dispatch",
    agentApiName: "Field_Dispatch",
    botId: "0Xx000000000006",
    currentVersion: "v2.0",
    blessedVersion: "v2.0",
    truenessScore: 96,
    status: "true",
    monitoringEnabled: false,
    calibrationSchedule: "0 0 0 * * ?",
    ownerQueueId: "00G000000000006",
    lastCalibratedAt: daysAgo(1),
    consecutiveFailures: 0,
    quarantinedAt: null,
    quarantinedBy: null,
    casesPassing: 12,
    casesTotal: 12,
  },
];

/** Deterministic trueness-series specs, keyed by agent id (drift.ts consumes). */
export const SEED_SERIES: Record<string, SeriesSpec> = {
  refund: { id: "refund", base: 97, amp: 2 },
  renewal: { id: "renewal", base: 94, amp: 3, dropAt: 26, dropTo: 71 },
  onboard: { id: "onboard", base: 92, amp: 3, dropAt: 58, dropTo: 44 },
  claims: { id: "claims", base: 94, amp: 2.5 },
  billing: { id: "billing", base: 88, amp: 3.5 },
  dispatch: { id: "dispatch", base: 96, amp: 2 },
};

/* ---------------------------- Change ledger ------------------------------ */

export const SEED_CHANGE_EVENTS: ChangeEventView[] = [
  {
    id: "c1",
    changeKey: "chg-2026-0725-deploy-refund",
    kind: "Deploy",
    label: "Refund_Agent v2.4",
    actor: "DevOps Center",
    occurredAt: atHour(9),
    detail: "Release 2026.07.25. Three topics modified, one action added.",
    affectedArtifacts: ["Refund_Policy topic", "Issue_Refund action"],
    correlationWindowMinutes: 120,
  },
  {
    id: "c2",
    changeKey: "chg-2026-0726-kb-4471",
    kind: "Knowledge",
    label: "KB-4471 republished",
    actor: "M. Okafor",
    occurredAt: atHour(26),
    detail:
      "Renewal terms article. Section 3 rewritten, cancellation window language removed.",
    affectedArtifacts: ["KB-4471", "Renewal_Policy topic", "Cancellation_Terms"],
    correlationWindowMinutes: 180,
  },
  {
    id: "c3",
    changeKey: "chg-2026-0727-atlas",
    kind: "Model",
    label: "Atlas rollforward",
    actor: "Salesforce",
    occurredAt: atHour(42),
    detail: "Reasoning engine minor version. No customer action required.",
    affectedArtifacts: ["Atlas reasoning engine", "Billing_FAQ topic"],
    correlationWindowMinutes: 240,
  },
  {
    id: "c4",
    changeKey: "chg-2026-0728-onboard-greeting",
    kind: "Prompt",
    label: "Onboarding_Greeting v6",
    actor: "A. Imperiale",
    occurredAt: atHour(58),
    detail: "Prompt template edit. Persona instruction shortened by 140 tokens.",
    affectedArtifacts: ["Onboarding_Greeting prompt", "Verify_Entitlement action"],
    correlationWindowMinutes: 120,
  },
];

/** The rail markers, positioned by the hour each change occurred. */
export const SEED_CHANGE_MARKERS: ChangeMarker[] = [
  { id: "m1", changeEventId: "c1", kind: "Deploy", label: "Refund_Agent v2.4", t: 9 },
  { id: "m2", changeEventId: "c2", kind: "Knowledge", label: "KB-4471 republished", t: 26 },
  { id: "m3", changeEventId: "c3", kind: "Model", label: "Atlas rollforward", t: 42 },
  { id: "m4", changeEventId: "c4", kind: "Prompt", label: "Onboarding_Greeting v6", t: 58 },
];

/** Which agents each change pushed out of true, for attribution correlation. */
export const CHANGE_IMPACT: Record<string, string[]> = {
  c1: [],
  c2: ["renewal"],
  c3: ["billing"],
  c4: ["onboard"],
};

/* ------------------------------ Findings --------------------------------- */

export const SEED_REMEDIATIONS: RemediationView[] = [
  {
    id: "r1",
    findingId: "F-2291",
    actionLabel: "rollback to v5.4",
    approvalState: "Pending_Approval",
    requestedBy: "Fleet Engine",
    approver: null,
    approvedAt: null,
    idempotencyKey: "rollback-onboard-v5.4",
    result: null,
    error: null,
  },
];

export const SEED_FINDINGS: FindingView[] = [
  {
    id: "F-2291",
    findingNumber: "F-2291",
    agentId: "onboard",
    agentName: "Onboarding Guide",
    severity: "Critical",
    state: "Approval",
    headline: "Stopped invoking Verify_Entitlement",
    detail:
      "9 of 14 golden cases fail the must_invoke assertion. The agent answers confidently without checking entitlement, producing plausible but unverified guidance.",
    detector: "STRUCTURAL_DRIFT",
    openedAt: hoursAgo(4),
    closedAt: null,
    attributedChange: {
      changeEventId: "c4",
      label: "Onboarding_Greeting v6",
      kind: "Prompt",
      actor: "A. Imperiale",
    },
    attributionConfidence: 0.9,
    casesFailing: 9,
    casesTotal: 14,
    agentAction:
      "Version quarantined. Traffic routed to human queue. Rollback to v5.4 awaiting approval.",
    remediation: {
      id: "r1",
      actionLabel: "rollback to v5.4",
      approvalState: "Pending_Approval",
    },
  },
  {
    id: "F-2287",
    findingNumber: "F-2287",
    agentId: "renewal",
    agentName: "Renewal Outreach",
    severity: "Elevated",
    state: "Triage",
    headline: "Grounding accuracy down 14 percent",
    detail:
      "3 of 11 golden cases fail must_ground_in. The agent cites KB-1102 alone where the baseline cited both KB-1102 and KB-4471.",
    detector: "SEMANTIC_DRIFT",
    openedAt: daysAgo(1),
    closedAt: null,
    attributedChange: {
      changeEventId: "c2",
      label: "KB-4471 republished",
      kind: "Knowledge",
      actor: "M. Okafor",
    },
    attributionConfidence: 0.82,
    casesFailing: 3,
    casesTotal: 11,
    agentAction:
      "Finding opened. Rollback not proposed because the source article changed intentionally. Baseline re-blessing recommended.",
    remediation: null,
  },
  {
    id: "F-2284",
    findingNumber: "F-2284",
    agentId: "billing",
    agentName: "Billing Inquiry",
    severity: "Advisory",
    state: "Monitoring",
    headline: "Credit burn per resolution up 31 percent",
    detail:
      "Median actions per conversation rose from 3.1 to 4.4 with no change in resolution rate. Cost drift without accuracy drift.",
    detector: "ECONOMIC_DRIFT",
    openedAt: daysAgo(2),
    closedAt: null,
    attributedChange: {
      changeEventId: "c3",
      label: "Atlas rollforward",
      kind: "Model",
      actor: "Salesforce",
    },
    attributionConfidence: 0.6,
    casesFailing: 2,
    casesTotal: 19,
    agentAction: "Monitoring. Threshold breach in 6 days at current trajectory.",
    remediation: null,
  },
];

/* ------------------------------ Case diff -------------------------------- */

export const SEED_CASE_DIFF: CaseDiffView = {
  caseId: "gc-renewal-1",
  caseKey: "renewal_past_cancellation_window",
  agentName: "Renewal Outreach",
  utterance: "I want to cancel my renewal, it auto-charged me yesterday",
  baselineVersion: "v3.0",
  currentVersion: "v3.1",
  calibratedAt: hoursAgo(0.2),
  baseline: [
    { text: "Your renewal processed on July 24. Because that is within the " },
    {
      text: "30 day cancellation window described in your agreement",
      changed: true,
    },
    { text: ", I can process a full reversal right now. Shall I go ahead?" },
  ],
  current: [
    { text: "Your renewal processed on July 24. Because that is within the " },
    { text: "standard review period", changed: true },
    { text: ", I can process a full reversal right now. Shall I go ahead?" },
  ],
  grounding: { baseline: ["KB-1102", "KB-4471"], current: ["KB-1102"] },
  assertions: [
    { label: "must_route_to: Renewal_Policy", passed: true },
    { label: "must_ground_in: KB-1102", passed: true },
    { label: "must_ground_in: KB-4471", passed: false },
    { label: "must_convey: specific cancellation window", passed: false },
    { label: "must_not_invoke: Issue_Refund", passed: true },
    { label: "latency_p95_ms: 2400", passed: true },
  ],
};

/* ----------------------------- Golden cases ------------------------------ */

export const SEED_GOLDEN_CASES: Record<string, GoldenCaseView[]> = {
  renewal: [
    {
      id: "gc-renewal-1",
      agentId: "renewal",
      caseKey: "renewal_past_cancellation_window",
      utterance: "I want to cancel my renewal, it auto-charged me yesterday",
      active: true,
      source: "Curated",
      proposedAt: daysAgo(40),
      approvedBy: "M. Okafor",
      baselineVersion: "v3.0",
      exemplarCount: 6,
      weight: 2,
      lastResult: "Fail",
      consecutiveFailures: 3,
    },
    {
      id: "gc-renewal-2",
      agentId: "renewal",
      caseKey: "renewal_grace_period_question",
      utterance: "How long do I have to change my mind after renewing?",
      active: true,
      source: "Promoted_From_Production",
      proposedAt: daysAgo(12),
      approvedBy: "M. Okafor",
      baselineVersion: "v3.0",
      exemplarCount: 3,
      weight: 1,
      lastResult: "Pass",
      consecutiveFailures: 0,
    },
  ],
  onboard: [
    {
      id: "gc-onboard-1",
      agentId: "onboard",
      caseKey: "onboard_entitlement_check",
      utterance: "Can I use the premium analytics add-on on my plan?",
      active: true,
      source: "Curated",
      proposedAt: daysAgo(60),
      approvedBy: "A. Imperiale",
      baselineVersion: "v5.4",
      exemplarCount: 8,
      weight: 3,
      lastResult: "Fail",
      consecutiveFailures: 5,
    },
    {
      id: "gc-onboard-2",
      agentId: "onboard",
      caseKey: "onboard_plan_comparison",
      utterance: "What is the difference between the Team and Business plans?",
      active: false,
      source: "Auto_Proposed",
      proposedAt: daysAgo(2),
      approvedBy: null,
      baselineVersion: "v5.4",
      exemplarCount: 2,
      weight: 1,
      lastResult: null,
      consecutiveFailures: 0,
    },
  ],
  refund: [
    {
      id: "gc-refund-1",
      agentId: "refund",
      caseKey: "refund_within_policy_window",
      utterance: "I was charged twice for the same order, can I get a refund?",
      active: true,
      source: "Curated",
      proposedAt: daysAgo(90),
      approvedBy: "Ops",
      baselineVersion: "v2.4",
      exemplarCount: 10,
      weight: 2,
      lastResult: "Pass",
      consecutiveFailures: 0,
    },
  ],
};

/* -------------------------------- Runs ----------------------------------- */

export const SEED_RUNS: RunView[] = [
  {
    id: "run-renewal-latest",
    runKey: "run-2026-0728-renewal-01",
    agentId: "renewal",
    agentName: "Renewal Outreach",
    triggerSource: "Change_Event",
    triggerChangeEventId: "c2",
    startedAt: hoursAgo(0.4),
    completedAt: hoursAgo(0.2),
    status: "Completed",
    casesTotal: 11,
    casesPassed: 8,
    casesFailed: 3,
    truenessScore: 71,
    creditsConsumed: 18.4,
    judgeInvocations: 4,
    prefilterSkips: 7,
    error: null,
  },
  {
    id: "run-renewal-prev",
    runKey: "run-2026-0727-renewal-06",
    agentId: "renewal",
    agentName: "Renewal Outreach",
    triggerSource: "Scheduled",
    triggerChangeEventId: null,
    startedAt: hoursAgo(6.4),
    completedAt: hoursAgo(6.2),
    status: "Completed",
    casesTotal: 11,
    casesPassed: 11,
    casesFailed: 0,
    truenessScore: 94,
    creditsConsumed: 9.1,
    judgeInvocations: 2,
    prefilterSkips: 9,
    error: null,
  },
  {
    id: "run-onboard-latest",
    runKey: "run-2026-0728-onboard-01",
    agentId: "onboard",
    agentName: "Onboarding Guide",
    triggerSource: "Change_Event",
    triggerChangeEventId: "c4",
    startedAt: hoursAgo(4.2),
    completedAt: hoursAgo(4),
    status: "Completed",
    casesTotal: 14,
    casesPassed: 5,
    casesFailed: 9,
    truenessScore: 44,
    creditsConsumed: 26.1,
    judgeInvocations: 9,
    prefilterSkips: 5,
    error: null,
  },
  {
    id: "run-refund-latest",
    runKey: "run-2026-0728-refund-01",
    agentId: "refund",
    agentName: "Refund Concierge",
    triggerSource: "Scheduled",
    triggerChangeEventId: null,
    startedAt: hoursAgo(0.3),
    completedAt: hoursAgo(0.2),
    status: "Completed",
    casesTotal: 24,
    casesPassed: 24,
    casesFailed: 0,
    truenessScore: 98,
    creditsConsumed: 12.0,
    judgeInvocations: 2,
    prefilterSkips: 22,
    error: null,
  },
];

/* -------------------------- Admin configuration -------------------------- */

export const SEED_SETTING: SettingView = {
  monitoringEnabled: true,
  defaultScheduleCron: "0 0 */6 * * ?",
  judgeTemplateName: "Fleet_Judge_v1",
  prefilterLowerBound: 0.15,
  prefilterUpperBound: 0.45,
  maxCasesPerRun: 50,
  truenessThreshold: 80,
  retentionDaysCaseResult: 90,
  retentionDaysTrace: 395,
  autoCurationEnabled: true,
  autoCurationCron: "0 0 2 * * ?",
  ciGateEnabled: false,
};

export const SEED_DETECTORS: DetectorView[] = [
  { detectorKey: "SEMANTIC_DRIFT", label: "Semantic drift", strategy: "CentroidCosine", threshold: 0.14, windowHours: 72, minimumSample: 20, weight: 1, active: true },
  { detectorKey: "STRUCTURAL_DRIFT", label: "Structural drift", strategy: "TopicActionDelta", threshold: 0.2, windowHours: 72, minimumSample: 15, weight: 1, active: true },
  { detectorKey: "ECONOMIC_DRIFT", label: "Economic drift", strategy: "CreditRegression", threshold: 0.3, windowHours: 168, minimumSample: 30, weight: 0.5, active: true },
  { detectorKey: "TRUST_DRIFT", label: "Trust drift", strategy: "TrustFlagRate", threshold: 0.1, windowHours: 72, minimumSample: 20, weight: 1, active: true },
];

export const SEED_SEVERITY_POLICIES: SeverityPolicyView[] = [
  { severity: "Critical", autoAction: "Quarantine", notifyQueueId: "00G000000000010", approvalQueueId: "00G000000000011", requiresCustomPermission: "Fleet_Approve_Remediation", autoCloseAfterDays: null, active: true },
  { severity: "Elevated", autoAction: "Request_Approval", notifyQueueId: "00G000000000010", approvalQueueId: "00G000000000011", requiresCustomPermission: "Fleet_Approve_Remediation", autoCloseAfterDays: 14, active: true },
  { severity: "Advisory", autoAction: "Notify", notifyQueueId: "00G000000000010", approvalQueueId: null, requiresCustomPermission: null, autoCloseAfterDays: 7, active: true },
];

export const SEED_ASSERTION_TYPES: AssertionTypeView[] = [
  { typeKey: "MUST_ROUTE_TO", label: "Must route to", evaluationStrategy: "Deterministic", requiresJudge: false, defaultSeverity: "Elevated", active: true },
  { typeKey: "MUST_GROUND_IN", label: "Must ground in", evaluationStrategy: "Deterministic", requiresJudge: false, defaultSeverity: "Elevated", active: true },
  { typeKey: "MUST_INVOKE", label: "Must invoke", evaluationStrategy: "Deterministic", requiresJudge: false, defaultSeverity: "Critical", active: true },
  { typeKey: "MUST_NOT_INVOKE", label: "Must not invoke", evaluationStrategy: "Deterministic", requiresJudge: false, defaultSeverity: "Critical", active: true },
  { typeKey: "MUST_CONVEY", label: "Must convey", evaluationStrategy: "Semantic", requiresJudge: true, defaultSeverity: "Elevated", active: true },
  { typeKey: "MUST_NOT_CONVEY", label: "Must not convey", evaluationStrategy: "Semantic", requiresJudge: true, defaultSeverity: "Elevated", active: true },
  { typeKey: "LATENCY_P95_MS", label: "Latency p95 (ms)", evaluationStrategy: "Numeric", requiresJudge: false, defaultSeverity: "Advisory", active: true },
  { typeKey: "CREDIT_CEILING", label: "Credit ceiling", evaluationStrategy: "Numeric", requiresJudge: false, defaultSeverity: "Advisory", active: true },
  { typeKey: "MUST_ESCALATE", label: "Must escalate", evaluationStrategy: "Deterministic", requiresJudge: false, defaultSeverity: "Critical", active: true },
];

export const SEED_CHANGE_SOURCES: ChangeSourceView[] = [
  { sourceKey: "DEPLOY", label: "Deploy", ingestionStrategy: "SetupAuditTrail", correlationWindowMinutes: 120, active: true },
  { sourceKey: "KNOWLEDGE", label: "Knowledge", ingestionStrategy: "Scheduled_Poll", correlationWindowMinutes: 180, active: true },
  { sourceKey: "PROMPT", label: "Prompt", ingestionStrategy: "SetupAuditTrail", correlationWindowMinutes: 120, active: true },
  { sourceKey: "MODEL", label: "Model", ingestionStrategy: "Platform_Event", correlationWindowMinutes: 240, active: true },
];

export const SEED_VIEWS: ViewDefView[] = [
  { viewKey: "ALL_AGENTS", label: "All agents", filterJson: null, sortField: "Trueness_Score__c", sortDirection: "DESC", displayOrder: 1, active: true },
  { viewKey: "OUT_OF_TRUE", label: "Out of true", filterJson: '{"Status__c":"drift"}', sortField: "Trueness_Score__c", sortDirection: "ASC", displayOrder: 2, active: true },
  { viewKey: "QUARANTINED", label: "Quarantined", filterJson: '{"Status__c":"quarantined"}', sortField: "Quarantined_At__c", sortDirection: "DESC", displayOrder: 3, active: true },
  { viewKey: "MY_AGENTS", label: "My agents", filterJson: '{"OwnerId":"$User.Id"}', sortField: "Name", sortDirection: "ASC", displayOrder: 4, active: true },
];
