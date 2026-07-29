/**
 * Sparkline - the tiny trend inside a KPI card.
 *
 * No axes, no labels, no interaction: it exists to give the number next to it a
 * direction. It stretches to its container via preserveAspectRatio="none" so a
 * card can size it without the chart needing to measure anything.
 */
import * as React from "react";
import { areaPath, linearScale, smoothPath, type Pt } from "./hooks";

export interface SparklineProps {
  values: number[];
  color: string;
  height?: number;
  /** Draw the filled area under the line. */
  fill?: boolean;
  /** Mark the final sample with a dot, as the reference design does. */
  endDot?: boolean;
  strokeWidth?: number;
}

const W = 200; // viewBox width; the SVG scales to its container

export function Sparkline({
  values,
  color,
  height = 46,
  fill = true,
  endDot = true,
  strokeWidth = 2,
}: SparklineProps) {
  const uid = React.useId().replace(/[:]/g, "");

  const { line, area, last } = React.useMemo(() => {
    if (values.length === 0) return { line: "", area: "", last: null as Pt | null };
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    // Pad a flat series so it renders as a centred line rather than on the floor.
    const domain: [number, number] = lo === hi ? [lo - 1, hi + 1] : [lo, hi];
    const x = linearScale([0, Math.max(values.length - 1, 1)], [2, W - 2]);
    const y = linearScale(domain, [height - 4, 4]);
    const pts: Pt[] = values.map((v, i) => ({ x: x(i), y: y(v) }));
    return {
      line: smoothPath(pts, 0.3),
      area: areaPath(pts, height, 0.3),
      last: pts[pts.length - 1] ?? null,
    };
  }, [values, height]);

  if (!line) return <div style={{ height }} />;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <linearGradient id={`spark-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#spark-${uid})`} />}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        // preserveAspectRatio="none" would stretch the stroke too; this keeps it even.
        vectorEffect="non-scaling-stroke"
      />
      {endDot && last && (
        <circle cx={last.x} cy={last.y} r={3} fill={color} vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}
