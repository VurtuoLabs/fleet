import type { FindingQuery } from "@/domain/types";

/**
 * Centralized TanStack Query keys. One factory keeps invalidation precise:
 * a mutation invalidates exactly the branches it touches.
 */
export const queryKeys = {
  all: ["fleet"] as const,

  agents: {
    root: () => [...queryKeys.all, "agents"] as const,
    list: (viewKey?: string) =>
      [...queryKeys.agents.root(), "list", viewKey ?? "ALL"] as const,
    detail: (agentId: string) =>
      [...queryKeys.agents.root(), "detail", agentId] as const,
  },

  calibration: {
    root: () => [...queryKeys.all, "calibration"] as const,
    run: (runId: string) => [...queryKeys.calibration.root(), "run", runId] as const,
    runs: (agentId: string) =>
      [...queryKeys.calibration.root(), "runs", agentId] as const,
  },

  goldenSet: {
    root: () => [...queryKeys.all, "golden-set"] as const,
    cases: (agentId?: string) =>
      [...queryKeys.goldenSet.root(), "cases", agentId ?? "ALL"] as const,
    diff: (caseId: string) =>
      [...queryKeys.goldenSet.root(), "diff", caseId] as const,
  },

  findings: {
    root: () => [...queryKeys.all, "findings"] as const,
    list: (query?: FindingQuery) =>
      [...queryKeys.findings.root(), "list", query ?? {}] as const,
    detail: (findingId: string) =>
      [...queryKeys.findings.root(), "detail", findingId] as const,
  },

  changes: {
    root: () => [...queryKeys.all, "changes"] as const,
    list: (windowHours: number) =>
      [...queryKeys.changes.root(), "list", windowHours] as const,
    detail: (changeId: string) =>
      [...queryKeys.changes.root(), "detail", changeId] as const,
    attribution: (changeId: string) =>
      [...queryKeys.changes.root(), "attribution", changeId] as const,
  },

  drift: {
    root: () => [...queryKeys.all, "drift"] as const,
    board: (windowHours: number) =>
      [...queryKeys.drift.root(), "board", windowHours] as const,
  },

  config: {
    root: () => [...queryKeys.all, "config"] as const,
    setting: () => [...queryKeys.config.root(), "setting"] as const,
    assertionTypes: () => [...queryKeys.config.root(), "assertion-types"] as const,
    detectors: () => [...queryKeys.config.root(), "detectors"] as const,
    severityPolicies: () =>
      [...queryKeys.config.root(), "severity-policies"] as const,
    changeSources: () => [...queryKeys.config.root(), "change-sources"] as const,
    views: () => [...queryKeys.config.root(), "views"] as const,
  },
} as const;
