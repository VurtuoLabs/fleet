/**
 * DriftPage - the trueness-over-72h chart.
 *
 * One selected agent drawn in its status colour over ghost lines for every
 * other monitored agent, a dashed Tolerance threshold with a shaded
 * below-threshold zone, and a clickable rail of Deploy / Knowledge / Model /
 * Prompt change markers. Marker x is derived from the same scale as the line
 * (see driftGeometry) so a change always sits under the point in time it
 * happened. Picking a marker deep-links into Attribution.
 *
 * Data seam: useDriftBoard(windowHours) → DriftBoard
 *   { windowHours, threshold, series: DriftSeries[], changes: ChangeMarker[] }
 */
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { UI, HEAD, MONO, R } from "@/features/shared/tokens";
import { statusMeta, changeKindMeta } from "@/features/shared/meta";
import {
  Panel,
  PanelHead,
  PageTitle,
  LoadingBlock,
  ErrorBlock,
  EmptyBlock,
} from "@/features/shared/ui";
import { useDriftBoard } from "@/hooks";
import {
  CHART,
  makeScales,
  linePath,
  placeMarkers,
  xTicks,
  Y_TICKS,
} from "./driftGeometry";
import type { DriftSeries } from "@/domain/types";

export default function DriftPage() {
  const { data, isLoading, isError } = useDriftBoard(72);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const series = data?.series ?? [];
  // Default the selection to the least-healthy agent so the page opens on the
  // story worth looking at, but let the user override.
  const resolvedId =
    selectedId ??
    [...series].sort((a, b) => a.currentScore - b.currentScore)[0]?.agentId ??
    null;

  if (isLoading) return <PageShell><LoadingBlock label="Loading drift" /></PageShell>;
  if (isError) return <PageShell><ErrorBlock label="Could not load drift telemetry" /></PageShell>;
  if (series.length === 0)
    return <PageShell><EmptyBlock label="No monitored agents are reporting trueness yet." /></PageShell>;

  const board = data!;
  const selected = series.find((s) => s.agentId === resolvedId) ?? series[0];

  return (
    <PageShell
      right={
        <label className="flex items-center gap-2" style={{ fontSize: 12.5, color: UI.weak }}>
          Agent
          <select
            aria-label="Select agent"
            value={selected.agentId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={{
              fontFamily: HEAD,
              fontSize: 13,
              color: UI.text,
              background: UI.surface,
              border: `1px solid ${UI.borderStrong}`,
              borderRadius: R,
              padding: "6px 10px",
            }}
          >
            {series.map((s) => (
              <option key={s.agentId} value={s.agentId}>
                {s.agentName}
              </option>
            ))}
          </select>
        </label>
      }
    >
      <DriftChart
        windowHours={board.windowHours}
        threshold={board.threshold}
        series={series}
        selected={selected}
      />
    </PageShell>
  );
}

function PageShell({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <PageTitle
        title="Drift"
        subtitle="Trueness over the last 72 hours, correlated to change events."
        right={right}
      />
      {children}
    </div>
  );
}

/* ------------------------------ the chart -------------------------------- */

export function DriftChart({
  windowHours,
  threshold,
  series,
  selected,
}: {
  windowHours: number;
  threshold: number;
  series: DriftSeries[];
  selected: DriftSeries;
}) {
  const navigate = useNavigate();
  const s = makeScales(windowHours);
  const { W, H, L, RT, TOP, PLOT_B, RAIL_T, RAIL_B } = CHART;
  const selMeta = statusMeta(selected.status);
  const markers = placeMarkers(selected.changes ?? [], s);
  const thresholdY = s.yForValue(threshold);

  const pickChange = (changeEventId: string) =>
    navigate(`/attribution?change=${encodeURIComponent(changeEventId)}`);

  return (
    <Panel>
      <PanelHead
        title="Trueness over 72 hours"
        right={
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5" style={{ fontSize: 12, color: UI.weak }}>
              <span style={{ width: 14, height: 2, background: selMeta.color, display: "inline-block" }} />
              {selected.agentName}
            </span>
            <span className="flex items-center gap-1.5" style={{ fontSize: 12, color: UI.weakest }}>
              <span style={{ width: 14, height: 2, background: UI.borderStrong, display: "inline-block" }} />
              Other agents
            </span>
          </div>
        }
      />
      <div className="px-2 py-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label={`Trueness over ${windowHours} hours for ${selected.agentName}`}
          data-testid="drift-chart"
        >
          {/* below-threshold zone */}
          <rect
            x={L}
            y={thresholdY}
            width={W - L - RT}
            height={PLOT_B - thresholdY}
            fill={UI.error}
            opacity="0.05"
            data-testid="below-threshold-zone"
          />

          {/* y grid */}
          {Y_TICKS.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - RT} y1={s.yForValue(v)} y2={s.yForValue(v)} stroke={UI.border} strokeWidth="1" />
              <text
                x={L - 8}
                y={s.yForValue(v) + 4}
                textAnchor="end"
                fill={UI.weakest}
                style={{ fontSize: 10, fontFamily: MONO }}
              >
                {v}
              </text>
            </g>
          ))}

          {/* tolerance threshold */}
          <line
            x1={L}
            x2={W - RT}
            y1={thresholdY}
            y2={thresholdY}
            stroke={UI.error}
            strokeWidth="1.25"
            strokeDasharray="4 4"
            opacity="0.8"
            data-testid="threshold-line"
          />
          <text
            x={W - RT}
            y={thresholdY - 6}
            textAnchor="end"
            fill={UI.error}
            style={{ fontSize: 10, fontWeight: 600 }}
          >
            Tolerance {threshold}
          </text>

          {/* ghost lines */}
          {series
            .filter((d) => d.agentId !== selected.agentId)
            .map((d) => (
              <path
                key={d.agentId}
                d={linePath(d.points, s)}
                fill="none"
                stroke={UI.borderStrong}
                strokeWidth="1.25"
                opacity="0.75"
                data-testid={`ghost-line-${d.agentId}`}
              />
            ))}

          {/* selected agent */}
          <path
            d={linePath(selected.points, s)}
            fill="none"
            stroke={selMeta.color}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            data-testid="selected-line"
          />
          {selected.points.length > 0 && (
            <circle
              cx={s.xForHour(selected.points[selected.points.length - 1].t)}
              cy={s.yForValue(selected.points[selected.points.length - 1].v)}
              r="4"
              fill={selMeta.color}
            />
          )}

          {/* x axis */}
          <line x1={L} x2={W - RT} y1={PLOT_B} y2={PLOT_B} stroke={UI.borderStrong} strokeWidth="1" />
          {xTicks(windowHours).map((tick) => (
            <text
              key={tick.t}
              x={s.xForHour(tick.t)}
              y={PLOT_B + 15}
              textAnchor="middle"
              fill={UI.weakest}
              style={{ fontSize: 10, fontFamily: MONO }}
            >
              {tick.label}
            </text>
          ))}

          {/* change rail */}
          <text
            x={L}
            y={RAIL_T - 4}
            fill={UI.weakest}
            style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}
          >
            Changes
          </text>
          <rect x={L} y={RAIL_T} width={W - L - RT} height={RAIL_B - RAIL_T} fill={UI.page} rx={R} />
          {markers.map((m) => {
            const meta = changeKindMeta(m.kind);
            const label = m.label.length > 16 ? `${m.label.slice(0, 15)}…` : m.label;
            return (
              <g
                key={m.id}
                role="button"
                tabIndex={0}
                aria-label={`${m.kind}: ${m.label}`}
                data-testid={`change-marker-${m.id}`}
                data-change-id={m.changeEventId}
                data-kind={m.kind}
                data-x={m.x.toFixed(1)}
                data-hour={m.t}
                onClick={() => pickChange(m.changeEventId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") pickChange(m.changeEventId);
                }}
                style={{ cursor: "pointer" }}
              >
                {/* alignment line from plot down into the rail */}
                <line
                  x1={m.x}
                  x2={m.x}
                  y1={TOP}
                  y2={RAIL_T}
                  stroke={meta.color}
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  opacity="0.4"
                  data-testid={`change-tick-${m.id}`}
                />
                <rect
                  x={m.x - 44}
                  y={RAIL_T + 8}
                  width={88}
                  height={30}
                  rx={R}
                  fill="#fff"
                  stroke={meta.color}
                  strokeWidth="1"
                />
                <text
                  x={m.x}
                  y={RAIL_T + 20}
                  textAnchor="middle"
                  fill={meta.color}
                  style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}
                >
                  {m.kind}
                </text>
                <text
                  x={m.x}
                  y={RAIL_T + 32}
                  textAnchor="middle"
                  fill={UI.weak}
                  style={{ fontSize: 9, fontFamily: MONO }}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </Panel>
  );
}
