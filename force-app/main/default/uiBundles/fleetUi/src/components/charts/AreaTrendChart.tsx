/**
 * AreaTrendChart - the dashboard's headline chart.
 *
 * Two gradient-filled series over a horizontal grid, with a pointer-tracked
 * tooltip that snaps to the nearest sample and a crosshair down to the axis.
 *
 * Gradient and clip ids come from useId. Two instances of this chart on one page
 * would otherwise emit duplicate ids, and SVG resolves url(#id) against the
 * first match in the document - so the second chart would silently paint with
 * the first one's fill.
 */
import * as React from "react";
import { UI, FONT, HEAD, MONO } from "@/features/shared/tokens";
import {
  areaPath,
  linearScale,
  niceTicks,
  smoothPath,
  useElementSize,
  usePointerIndex,
  usePrefersReducedMotion,
  type Pt,
} from "./hooks";

export interface TrendSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
  /** Rendered in the tooltip; defaults to a plain number. */
  format?: (value: number) => string;
}

export interface AreaTrendChartProps {
  labels: string[];
  series: TrendSeries[];
  height?: number;
  /** Optional horizontal reference line, e.g. the trueness threshold. */
  reference?: { value: number; label: string; color?: string };
  valueFormat?: (value: number) => string;
  ariaLabel?: string;
}

const PAD = { top: 16, right: 16, bottom: 28, left: 44 };

export function AreaTrendChart({
  labels,
  series,
  height = 280,
  reference,
  valueFormat = (v) => String(Math.round(v)),
  ariaLabel = "Trend chart",
}: AreaTrendChartProps) {
  const uid = React.useId().replace(/[:]/g, "");
  const [wrapRef, size] = useElementSize<HTMLDivElement>({ width: 720, height });
  const reduceMotion = usePrefersReducedMotion();

  const width = Math.max(size.width, 320);
  const plot = {
    left: PAD.left,
    right: width - PAD.right,
    top: PAD.top,
    bottom: height - PAD.bottom,
  };

  const { max, ticks } = React.useMemo(() => {
    const peak = Math.max(
      1,
      ...series.flatMap((s) => s.values),
      reference?.value ?? 0,
    );
    return niceTicks(peak, 5);
  }, [series, reference]);

  const count = labels.length;
  const x = React.useMemo(
    () => linearScale([0, Math.max(count - 1, 1)], [plot.left, plot.right]),
    [count, plot.left, plot.right],
  );
  const y = React.useMemo(
    () => linearScale([0, max], [plot.bottom, plot.top]),
    [max, plot.bottom, plot.top],
  );

  /** Point geometry per series, recomputed only when data or size changes. */
  const geometry = React.useMemo(
    () =>
      series.map((s) => {
        const pts: Pt[] = s.values.map((v, i) => ({ x: x(i), y: y(v) }));
        return { ...s, pts, line: smoothPath(pts), area: areaPath(pts, plot.bottom) };
      }),
    [series, x, y, plot.bottom],
  );

  const { index, handlers } = usePointerIndex(count, plot.left, plot.right);

  // Show roughly one label per 90px so the axis never collides with itself.
  const labelStride = Math.max(1, Math.ceil(count / Math.max(2, Math.floor(width / 90))));

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        style={{ display: "block", touchAction: "none" }}
        {...handlers}
      >
        <defs>
          {geometry.map((s) => (
            <linearGradient key={s.key} id={`fill-${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.26} />
              <stop offset="70%" stopColor={s.color} stopOpacity={0.04} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        {/* Value gridlines and labels */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={plot.left}
              x2={plot.right}
              y1={y(t)}
              y2={y(t)}
              stroke={UI.border}
              strokeWidth={1}
              strokeDasharray={t === 0 ? undefined : "3 4"}
            />
            <text
              x={plot.left - 10}
              y={y(t)}
              textAnchor="end"
              dominantBaseline="middle"
              style={{ fontFamily: MONO, fontSize: 10.5, fill: UI.weakest }}
            >
              {valueFormat(t)}
            </text>
          </g>
        ))}

        {/* Reference line - e.g. the trueness threshold everything is judged against */}
        {reference && (
          <g>
            <line
              x1={plot.left}
              x2={plot.right}
              y1={y(reference.value)}
              y2={y(reference.value)}
              stroke={reference.color ?? UI.warning}
              strokeWidth={1.25}
              strokeDasharray="5 4"
              opacity={0.75}
            />
            <text
              x={plot.right}
              y={y(reference.value) - 6}
              textAnchor="end"
              style={{ fontFamily: FONT, fontSize: 10.5, fill: reference.color ?? UI.warning, fontWeight: 600 }}
            >
              {reference.label}
            </text>
          </g>
        )}

        {/* Series: fill under the curve, then the curve itself */}
        {geometry.map((s) => (
          <g key={s.key}>
            <path d={s.area} fill={`url(#fill-${uid}-${s.key})`} />
            <path
              d={s.line}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={
                reduceMotion
                  ? undefined
                  : { animation: `fleet-draw 700ms ease-out both`, strokeDasharray: 2400, strokeDashoffset: 0 }
              }
            />
          </g>
        ))}

        {/* Crosshair + focus dots */}
        {index !== null && (
          <g pointerEvents="none">
            <line
              x1={x(index)}
              x2={x(index)}
              y1={plot.top}
              y2={plot.bottom}
              stroke={UI.borderStrong}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            {geometry.map((s) => (
              <circle
                key={s.key}
                cx={x(index)}
                cy={y(s.values[index] ?? 0)}
                r={4.5}
                fill={UI.surface}
                stroke={s.color}
                strokeWidth={2.5}
              />
            ))}
          </g>
        )}

        {/* Category axis */}
        {labels.map((label, i) =>
          i % labelStride === 0 || i === count - 1 ? (
            <text
              key={`${label}-${i}`}
              x={x(i)}
              y={height - 8}
              textAnchor={i === 0 ? "start" : i === count - 1 ? "end" : "middle"}
              style={{ fontFamily: FONT, fontSize: 10.5, fill: UI.weakest }}
            >
              {label}
            </text>
          ) : null,
        )}
      </svg>

      {index !== null && (
        <Tooltip
          label={labels[index]}
          series={geometry.map((s) => ({
            key: s.key,
            label: s.label,
            color: s.color,
            text: (s.format ?? valueFormat)(s.values[index] ?? 0),
          }))}
          x={x(index)}
          chartWidth={width}
        />
      )}
    </div>
  );
}

/** Floating readout. Flips side near the right edge so it never clips. */
function Tooltip({
  label,
  series,
  x,
  chartWidth,
}: {
  label: string;
  series: { key: string; label: string; color: string; text: string }[];
  x: number;
  chartWidth: number;
}) {
  const flip = x > chartWidth - 150;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "absolute",
        left: `${(x / chartWidth) * 100}%`,
        top: 12,
        transform: flip ? "translateX(-100%) translateX(-12px)" : "translateX(12px)",
        background: UI.surface,
        border: `1px solid ${UI.border}`,
        borderRadius: 10,
        boxShadow: "0 8px 24px -8px rgba(15,27,26,0.22)",
        padding: "9px 11px",
        pointerEvents: "none",
        minWidth: 132,
        zIndex: 2,
      }}
    >
      <div style={{ fontFamily: HEAD, fontSize: 11.5, fontWeight: 600, color: UI.text, marginBottom: 6 }}>
        {label}
      </div>
      {series.map((s) => (
        <div
          key={s.key}
          style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 3 }}
        >
          <span style={{ width: 7, height: 7, borderRadius: 99, background: s.color, flexShrink: 0 }} />
          <span style={{ fontFamily: FONT, fontSize: 11.5, color: UI.weak, flex: 1 }}>{s.label}</span>
          <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: UI.text }}>{s.text}</span>
        </div>
      ))}
    </div>
  );
}
