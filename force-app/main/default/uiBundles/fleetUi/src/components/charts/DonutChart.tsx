/**
 * DonutChart - proportional breakdown with a total in the hole.
 *
 * Segments are drawn as stroked arcs on one circle rather than as filled wedge
 * paths: a stroked circle takes a dash array, so each segment is two numbers and
 * an offset, and the rounded stroke caps come free. Filled wedges would need arc
 * flag maths and a separate path per segment.
 */
import * as React from "react";
import { UI, FONT, HEAD, MONO } from "@/features/shared/tokens";
import { usePrefersReducedMotion } from "./hooks";

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  centerValue: string;
  centerLabel: string;
  /** Index of the slice to emphasise, if any. */
  activeKey?: string | null;
  onHover?: (key: string | null) => void;
}

export function DonutChart({
  slices,
  size = 190,
  thickness = 22,
  centerValue,
  centerLabel,
  activeKey = null,
  onHover,
}: DonutChartProps) {
  const reduceMotion = usePrefersReducedMotion();
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = React.useMemo(
    () => slices.reduce((sum, s) => sum + Math.max(0, s.value), 0),
    [slices],
  );

  /**
   * Walk the slices once, accumulating the rotation each one starts at. A tiny
   * gap between segments keeps adjacent colours legible without a stroke.
   */
  const arcs = React.useMemo(() => {
    if (total <= 0) return [];
    const GAP_DEG = slices.length > 1 ? 2 : 0;
    let cursor = -90; // start at 12 o'clock
    return slices.map((slice) => {
      const share = Math.max(0, slice.value) / total;
      const sweep = share * 360;
      const arc = { ...slice, share, rotation: cursor, sweep: Math.max(0, sweep - GAP_DEG) };
      cursor += sweep;
      return arc;
    });
  }, [slices, total]);

  return (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto" }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${centerLabel}: ${centerValue}`}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={UI.page}
          strokeWidth={thickness}
        />
        {arcs.map((arc) => {
          const dash = (arc.sweep / 360) * circumference;
          const dimmed = activeKey !== null && activeKey !== arc.key;
          return (
            <circle
              key={arc.key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={activeKey === arc.key ? thickness + 4 : thickness}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference - dash}`}
              transform={`rotate(${arc.rotation} ${size / 2} ${size / 2})`}
              opacity={dimmed ? 0.32 : 1}
              onPointerEnter={() => onHover?.(arc.key)}
              onPointerLeave={() => onHover?.(null)}
              style={{
                cursor: onHover ? "pointer" : undefined,
                transition: reduceMotion ? undefined : "opacity 160ms ease, stroke-width 160ms ease",
              }}
            />
          );
        })}
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: HEAD, fontSize: 26, fontWeight: 600, color: UI.text, letterSpacing: "-0.02em" }}>
          {centerValue}
        </div>
        <div style={{ fontFamily: FONT, fontSize: 11, color: UI.weakest, marginTop: 2, maxWidth: size - 60 }}>
          {centerLabel}
        </div>
      </div>
    </div>
  );
}

/** Compact legend row used under the donut. */
export function DonutLegendRow({
  slice,
  meta,
  value,
  active,
  onHover,
}: {
  slice: DonutSlice;
  meta?: string;
  value: string;
  active?: boolean;
  onHover?: (key: string | null) => void;
}) {
  return (
    <div
      onPointerEnter={() => onHover?.(slice.key)}
      onPointerLeave={() => onHover?.(null)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 4px",
        borderRadius: 8,
        background: active ? UI.page : "transparent",
        transition: "background 140ms ease",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: `${slice.color}1F`,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <span style={{ width: 9, height: 9, borderRadius: 99, background: slice.color }} />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span
          style={{
            display: "block",
            fontFamily: FONT,
            fontSize: 12.5,
            fontWeight: 500,
            color: UI.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {slice.label}
        </span>
        {meta && (
          <span style={{ display: "block", fontFamily: FONT, fontSize: 11, color: UI.weakest, marginTop: 1 }}>
            {meta}
          </span>
        )}
      </span>
      <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: UI.text, flexShrink: 0 }}>
        {value}
      </span>
    </div>
  );
}
