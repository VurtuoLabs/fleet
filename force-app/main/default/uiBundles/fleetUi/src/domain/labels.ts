import type {
  AgentStatus,
  AssertionType,
  ChangeKind,
  DriftDetectorKey,
  FindingSeverity,
  GoldenCaseSource,
  TriggerSource,
} from "./types";

/**
 * Human labels and the raw Fleet palette. The feature layer keeps its own
 * display-meta in features/shared/meta.ts; these maps back the core-owned
 * common components (StatusTag, SeverityTag, TruenessScore) and the app shell,
 * so the whole surface reads with one identity (CONTRACT.md §11.5).
 */

export const PALETTE = {
  brand: "#0F766E",
  brandDark: "#115E59",
  accent: "#0EA5E9",
  success: "#15803D",
  warning: "#014486",
  error: "#BE123C",
  page: "#EEF2F2",
  surface: "#FFFFFF",
  border: "#DCE3E3",
  borderStrong: "#BFC9C9",
  text: "#0F1B1A",
  weak: "#4B5857",
  weakest: "#78807F",
} as const;

interface Descriptor {
  label: string;
  hex: string;
}

/** Fleet_Agent__c.Status__c → label + color. */
export const STATUS: Record<AgentStatus, Descriptor> = {
  true: { label: "In true", hex: PALETTE.success },
  watch: { label: "Watch", hex: PALETTE.warning },
  drift: { label: "Out of true", hex: PALETTE.error },
  quarantined: { label: "Quarantined", hex: PALETTE.error },
};

/** Derive a status key from a trueness score and quarantine flag. */
export function statusFromTrueness(
  trueness: number,
  quarantined = false,
): AgentStatus {
  if (quarantined) return "quarantined";
  if (trueness >= 90) return "true";
  if (trueness >= 80) return "watch";
  return "drift";
}

export const SEVERITY: Record<FindingSeverity, Descriptor & { solid: boolean; rank: number }> = {
  Critical: { label: "Critical", hex: PALETTE.error, solid: true, rank: 0 },
  Elevated: { label: "Elevated", hex: PALETTE.warning, solid: false, rank: 1 },
  Advisory: { label: "Advisory", hex: PALETTE.weakest, solid: false, rank: 2 },
};

/** Rank so lists can sort most-severe first. */
export const SEVERITY_RANK: Record<FindingSeverity, number> = {
  Critical: 0,
  Elevated: 1,
  Advisory: 2,
};

/** Change_Event__c.Kind__c → label + rail color. */
export const CHANGE_KIND: Record<ChangeKind, Descriptor> = {
  Deploy: { label: "Deploy", hex: PALETTE.brand },
  Knowledge: { label: "Knowledge", hex: PALETTE.accent },
  Model: { label: "Model", hex: PALETTE.weakest },
  Prompt: { label: "Prompt", hex: PALETTE.warning },
};

/** Fleet_Drift_Detector__mdt seeded keys → labels. */
export const DRIFT_DETECTOR: Record<DriftDetectorKey, string> = {
  SEMANTIC_DRIFT: "Semantic drift",
  STRUCTURAL_DRIFT: "Structural drift",
  ECONOMIC_DRIFT: "Economic drift",
  TRUST_DRIFT: "Trust drift",
};

/** Fleet_Assertion_Type__mdt seeded keys → readable labels. */
export const ASSERTION_TYPE: Record<AssertionType, string> = {
  MUST_ROUTE_TO: "Must route to",
  MUST_GROUND_IN: "Must ground in",
  MUST_INVOKE: "Must invoke",
  MUST_NOT_INVOKE: "Must not invoke",
  MUST_CONVEY: "Must convey",
  MUST_NOT_CONVEY: "Must not convey",
  LATENCY_P95_MS: "Latency p95 (ms)",
  CREDIT_CEILING: "Credit ceiling",
  MUST_ESCALATE: "Must escalate",
};

export const TRIGGER_SOURCE: Record<TriggerSource, string> = {
  Scheduled: "Scheduled",
  Change_Event: "Change event",
  Manual: "Manual",
  CI_Gate: "CI gate",
};

export const GOLDEN_CASE_SOURCE: Record<GoldenCaseSource, string> = {
  Curated: "Curated",
  Auto_Proposed: "Auto-proposed",
  Promoted_From_Production: "Promoted from production",
};
