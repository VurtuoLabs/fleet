/**
 * Dashboard read model.
 *
 * Everything on the dashboard is derived from the existing seam - useAgents,
 * useFindings, useDriftBoard, useChangeEvents - rather than from a new endpoint.
 * The overview is a different arrangement of what the console already knows, not
 * a different source of truth, and that keeps it honest: if a number here
 * disagrees with the page it links to, the derivation is wrong, not the data.
 *
 * Derivations are memoised on the query results, so re-renders from hover state
 * on the page never recompute the series.
 */
import * as React from "react";
import { useAgents, useDriftBoard, useFindings, useChangeEvents } from "@/hooks";
import type { AgentView, DriftBoard, FindingView } from "@/domain/types";

export type RangeKey = "24h" | "72h" | "7d";

export const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "24h", label: "24 hours" },
  { value: "72h", label: "72 hours" },
  { value: "7d", label: "7 days" },
];

const RANGE_HOURS: Record<RangeKey, number> = { "24h": 24, "72h": 72, "7d": 168 };

export interface DashboardSeries {
  labels: string[];
  trueness: number[];
  failing: number[];
}

/**
 * Average the per-agent trueness series into one fleet line, and derive a
 * failing-case count per sample from how far each agent sits below threshold.
 *
 * The board samples each agent at the same `t` offsets, so averaging by index is
 * safe; where an agent has fewer samples the last known value carries forward
 * rather than pulling the average toward zero.
 */
function buildSeries(board: DriftBoard | undefined, range: RangeKey): DashboardSeries {
  if (!board || board.series.length === 0) return { labels: [], trueness: [], failing: [] };

  const hours = Math.min(RANGE_HOURS[range], board.windowHours);
  const cutoff = board.windowHours - hours;

  // Every distinct sample offset inside the requested window, in order.
  const offsets = Array.from(
    new Set(board.series.flatMap((s) => s.points.map((p) => p.t))),
  )
    .filter((t) => t >= cutoff)
    .sort((a, b) => a - b);

  const labels: string[] = [];
  const trueness: number[] = [];
  const failing: number[] = [];

  for (const t of offsets) {
    let sum = 0;
    let n = 0;
    let below = 0;
    for (const s of board.series) {
      // Last sample at or before t - carries the series forward across gaps.
      let value: number | null = null;
      for (const p of s.points) {
        if (p.t <= t) value = p.v;
        else break;
      }
      if (value === null) continue;
      sum += value;
      n += 1;
      if (value < board.threshold) below += 1;
    }
    if (n === 0) continue;
    labels.push(formatOffset(board.windowHours - t));
    trueness.push(Math.round((sum / n) * 10) / 10);
    failing.push(below);
  }

  return { labels, trueness, failing };
}

/** "12h ago" style axis label from hours-before-now. */
function formatOffset(hoursAgo: number): string {
  if (hoursAgo <= 0) return "now";
  if (hoursAgo < 24) return `${Math.round(hoursAgo)}h`;
  return `${Math.round(hoursAgo / 24)}d`;
}

export interface CoverageSlice {
  key: string;
  label: string;
  value: number;
  color: string;
  meta: string;
}

export interface DashboardModel {
  loading: boolean;
  error: boolean;
  agents: AgentView[];
  findings: FindingView[];
  threshold: number;
  series: DashboardSeries;
  coverage: CoverageSlice[];
  totalCases: number;
  kpis: {
    agents: number;
    avgTrueness: number;
    openFindings: number;
    goldenCases: number;
    quarantined: number;
    outOfTrue: number;
    changes: number;
  };
  /** Per-agent trueness series for the bottom sparkline list. */
  agentTrends: { agent: AgentView; points: number[] }[];
}

/** Palette for the coverage donut - teal leads, sky and its neighbours follow. */
const SLICE_COLORS = ["#0F766E", "#0EA5E9", "#7C3AED", "#014486", "#15803D", "#BE123C"];

export function useDashboardData(range: RangeKey): DashboardModel {
  const agentsQ = useAgents();
  const findingsQ = useFindings({ openOnly: true });
  const boardQ = useDriftBoard();
  const changesQ = useChangeEvents();

  const agents = React.useMemo(() => agentsQ.data ?? [], [agentsQ.data]);
  const findings = React.useMemo(() => findingsQ.data ?? [], [findingsQ.data]);

  const series = React.useMemo(() => buildSeries(boardQ.data, range), [boardQ.data, range]);

  const coverage = React.useMemo<CoverageSlice[]>(
    () =>
      agents
        .filter((a) => (a.casesTotal ?? 0) > 0)
        .sort((a, b) => (b.casesTotal ?? 0) - (a.casesTotal ?? 0))
        .map((a, i) => ({
          key: a.id,
          label: a.name,
          value: a.casesTotal ?? 0,
          color: SLICE_COLORS[i % SLICE_COLORS.length],
          meta: `${a.casesPassing ?? 0}/${a.casesTotal ?? 0} passing`,
        })),
    [agents],
  );

  const totalCases = React.useMemo(
    () => coverage.reduce((sum, s) => sum + s.value, 0),
    [coverage],
  );

  const kpis = React.useMemo(() => {
    const withScores = agents.filter((a) => typeof a.truenessScore === "number");
    const avg = withScores.length
      ? Math.round(withScores.reduce((s, a) => s + a.truenessScore, 0) / withScores.length)
      : 0;
    return {
      agents: agents.length,
      avgTrueness: avg,
      openFindings: findings.length,
      goldenCases: totalCases,
      quarantined: agents.filter((a) => a.status === "quarantined").length,
      outOfTrue: agents.filter((a) => a.status === "drift").length,
      changes: changesQ.data?.length ?? 0,
    };
  }, [agents, findings, totalCases, changesQ.data]);

  const agentTrends = React.useMemo(() => {
    const byId = new Map((boardQ.data?.series ?? []).map((s) => [s.agentId, s]));
    return agents.map((agent) => ({
      agent,
      points: (byId.get(agent.id)?.points ?? []).map((p) => p.v),
    }));
  }, [agents, boardQ.data]);

  return {
    loading: agentsQ.isLoading || boardQ.isLoading,
    error: agentsQ.isError || boardQ.isError,
    agents,
    findings,
    threshold: boardQ.data?.threshold ?? 80,
    series,
    coverage,
    totalCases,
    kpis,
    agentTrends,
  };
}
