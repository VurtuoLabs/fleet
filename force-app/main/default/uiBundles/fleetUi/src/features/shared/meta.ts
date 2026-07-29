/**
 * Display metadata + normalizers + formatters shared across Fleet feature pages.
 * Pure data/functions only (no JSX) so this module can be imported anywhere,
 * including geometry helpers and tests.
 */
import { formatDistanceToNowStrict, format, parseISO } from "date-fns";
import { UI } from "./tokens";
import type {
  AgentStatus,
  ChangeKind,
  FindingSeverity,
} from "@/domain/types";

/* ----------------------------- agent status ----------------------------- */

export interface StatusMeta {
  label: string;
  color: string;
  /** Short operator-facing gloss. */
  hint: string;
}

/**
 * Keyed on the canonical `Fleet_Agent__c.Status__c` values Fleet emits.
 * `normalizeStatus` folds common synonyms so the console renders even if an
 * adapter hands back a differently-cased or legacy value.
 */
export const STATUS_META: Record<AgentStatus, StatusMeta> = {
  true: { label: "In true", color: UI.success, hint: "Tracking the blessed baseline" },
  watch: { label: "Watch", color: UI.warning, hint: "Approaching tolerance" },
  drift: { label: "Out of true", color: UI.error, hint: "Below tolerance" },
  quarantined: { label: "Quarantined", color: UI.error, hint: "Traffic held" },
};

export function normalizeStatus(raw: string | null | undefined): AgentStatus {
  switch ((raw ?? "").trim().toLowerCase()) {
    case "true":
    case "in_true":
    case "in true":
    case "healthy":
      return "true";
    case "watch":
    case "watching":
      return "watch";
    case "drift":
    case "out_of_true":
    case "out of true":
      return "drift";
    case "quarantined":
    case "quarantine":
      return "quarantined";
    default:
      return "watch";
  }
}

export function statusMeta(raw: string | null | undefined): StatusMeta {
  return STATUS_META[normalizeStatus(raw)];
}

/* ------------------------------- severity -------------------------------- */

export interface SeverityMeta {
  label: string;
  color: string;
  /** Critical is rendered as a solid rose chip; the rest are tinted. */
  solid: boolean;
  rank: number;
}

export const SEVERITY_META: Record<FindingSeverity, SeverityMeta> = {
  Critical: { label: "Critical", color: UI.error, solid: true, rank: 0 },
  Elevated: { label: "Elevated", color: UI.warning, solid: false, rank: 1 },
  Advisory: { label: "Advisory", color: UI.weakest, solid: false, rank: 2 },
};

export function normalizeSeverity(raw: string | null | undefined): FindingSeverity {
  switch ((raw ?? "").trim().toLowerCase()) {
    case "critical":
      return "Critical";
    case "elevated":
    case "warning":
    case "high":
      return "Elevated";
    default:
      return "Advisory";
  }
}

export function severityMeta(raw: string | null | undefined): SeverityMeta {
  return SEVERITY_META[normalizeSeverity(raw)];
}

/* ----------------------------- change kinds ------------------------------ */

export interface ChangeKindMeta {
  label: string;
  color: string;
}

/**
 * Seeded `Fleet_Change_Source__mdt` kinds. Sky differentiates Knowledge as the
 * secondary signal; deploy leads in teal; prompt is warning; model is neutral.
 */
export const CHANGE_KIND_META: Record<ChangeKind, ChangeKindMeta> = {
  Deploy: { label: "Deploy", color: UI.brand },
  Knowledge: { label: "Knowledge", color: UI.accent },
  Model: { label: "Model", color: UI.weakest },
  Prompt: { label: "Prompt", color: UI.warning },
};

export function normalizeKind(raw: string | null | undefined): ChangeKind {
  switch ((raw ?? "").trim().toLowerCase()) {
    case "deploy":
      return "Deploy";
    case "knowledge":
      return "Knowledge";
    case "model":
      return "Model";
    case "prompt":
      return "Prompt";
    default:
      return "Deploy";
  }
}

export function changeKindMeta(raw: string | null | undefined): ChangeKindMeta {
  return CHANGE_KIND_META[normalizeKind(raw)];
}

/* ------------------------------ formatters ------------------------------- */

/** Trueness scores render as integers; nulls as an em dash. */
export function formatScore(v: number | null | undefined): string {
  return v === null || v === undefined || Number.isNaN(v) ? "-" : String(Math.round(v));
}

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  try {
    return parseISO(value);
  } catch {
    return null;
  }
}

/** "4h ago" style relative label used across findings/changes. */
export function formatRelative(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  if (!d || Number.isNaN(d.getTime())) return "-";
  return `${formatDistanceToNowStrict(d)} ago`;
}

/** Absolute timestamp for detail panes and tooltips. */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  if (!d || Number.isNaN(d.getTime())) return "-";
  return format(d, "d MMM yyyy, HH:mm");
}

/** Deep link to a metadata record in Setup, used by read-only settings views. */
export function setupHref(path: string): string {
  const base =
    (typeof globalThis !== "undefined" && (globalThis as { SFDC_ENV?: { basePath?: string } }).SFDC_ENV?.basePath) || "";
  return `${base}/lightning/setup/${path}`;
}
