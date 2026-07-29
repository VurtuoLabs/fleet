import { DRIFT_WINDOW_HOURS, TRUENESS_THRESHOLD } from "@/lib/constants";
import { clamp, rnd, seedFrom } from "@/lib/utils";
import type { DriftPoint } from "./types";

/**
 * Trueness series synthesis.
 *
 * The mock adapter builds a deterministic per-agent trueness series (baseline +
 * noise, with an optional regression ramp), reproducing the math in
 * docs/console-mockup.jsx. The real adapter will hydrate DriftPoint[] from
 * Calibration_Run__c history instead; both produce the same shape the chart
 * geometry (features/drift/driftGeometry.ts) consumes.
 */
export interface SeriesSpec {
  id: string;
  /** Baseline trueness the agent hovers around. */
  base: number;
  /** Noise amplitude. */
  amp: number;
  /** Hour offset where a regression begins, if any. */
  dropAt?: number;
  /** Trueness the agent falls to after the drop. */
  dropTo?: number;
}

/** Build a deterministic 0..windowHours trueness series for one agent. */
export function buildSeries(spec: SeriesSpec, stepHours = 2): DriftPoint[] {
  const sd = seedFrom(spec.id);
  const out: DriftPoint[] = [];
  for (let t = 0; t <= DRIFT_WINDOW_HOURS; t += stepHours) {
    let v = spec.base + (rnd(sd, t) - 0.5) * spec.amp;
    if (spec.dropAt != null && spec.dropTo != null && t >= spec.dropAt) {
      const ramp = Math.min(1, (t - spec.dropAt) / 6);
      v =
        spec.base +
        (spec.dropTo - spec.base) * ramp +
        (rnd(sd, t) - 0.5) * spec.amp * 1.4;
    }
    out.push({ t, v: clamp(v, 20, 100) });
  }
  return out;
}

/** The most recent trueness value of a series. */
export function latest(points: DriftPoint[]): number {
  return points.length ? points[points.length - 1].v : 0;
}

/** True when the current trueness sits below the tolerance line. */
export function isBelowThreshold(
  trueness: number,
  threshold = TRUENESS_THRESHOLD,
): boolean {
  return trueness < threshold;
}
