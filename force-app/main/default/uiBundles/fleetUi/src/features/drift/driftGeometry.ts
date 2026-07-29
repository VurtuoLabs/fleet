/**
 * Pure geometry for the trueness-over-time chart.
 *
 * Kept separate from the React component so the exact scales are shared between
 * the SVG that renders and the test that asserts change-marker alignment: a
 * marker for a change that happened `t` hours into the window must sit at the
 * same x as the line samples at hour `t`. No rounding drift, no re-derivation.
 */
import type { ChangeMarker, DriftPoint } from "@/domain/types";

/** Fixed viewBox + plot/rail layout, mirroring docs/console-mockup.jsx. */
export const CHART = {
  W: 760,
  H: 300,
  L: 44, // left gutter (y labels)
  RT: 16, // right gutter
  TOP: 16, // plot top
  PLOT_B: 208, // plot bottom (x axis)
  RAIL_T: 224, // change-rail top
  RAIL_B: 286, // change-rail bottom
  Y_MIN: 20,
  Y_MAX: 100,
} as const;

export interface Scales {
  windowHours: number;
  /** Maps an hour offset (0..windowHours) to an svg x coordinate. */
  xForHour: (t: number) => number;
  /** Maps a trueness value (Y_MIN..Y_MAX) to an svg y coordinate. */
  yForValue: (v: number) => number;
}

export function makeScales(windowHours: number): Scales {
  const { L, RT, W, TOP, PLOT_B, Y_MIN, Y_MAX } = CHART;
  const plotW = W - L - RT;
  const plotH = PLOT_B - TOP;
  const span = Y_MAX - Y_MIN;
  return {
    windowHours,
    xForHour: (t: number) => L + (t / windowHours) * plotW,
    yForValue: (v: number) => PLOT_B - ((v - Y_MIN) / span) * plotH,
  };
}

/** Build an SVG path string from drift samples using the given scales. */
export function linePath(points: DriftPoint[], s: Scales): string {
  return points
    .map((p, i) => `${i ? "L" : "M"}${s.xForHour(p.t).toFixed(1)},${s.yForValue(p.v).toFixed(1)}`)
    .join(" ");
}

export interface PlacedMarker extends ChangeMarker {
  /** Resolved x coordinate on the same scale as the line. */
  x: number;
}

/** Resolve each change marker to its x coordinate. */
export function placeMarkers(changes: ChangeMarker[], s: Scales): PlacedMarker[] {
  return changes.map((c) => ({ ...c, x: s.xForHour(c.t) }));
}

/** Even x tick positions across the window, labelled `-Nh` and `now`. */
export function xTicks(windowHours: number): { t: number; label: string }[] {
  const step = windowHours / 3;
  return [0, step, step * 2, windowHours].map((t) => ({
    t,
    label: t >= windowHours ? "now" : `-${Math.round(windowHours - t)}h`,
  }));
}

export const Y_TICKS = [20, 40, 60, 80, 100] as const;
