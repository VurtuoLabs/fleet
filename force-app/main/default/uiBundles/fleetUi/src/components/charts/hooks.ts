/**
 * Chart infrastructure hooks.
 *
 * Charts here are hand-built SVG rather than a charting library. Three reasons:
 * the UI Bundle ships every byte into the org and counts toward its 2,500-file
 * limit; the console needs exact control over the change-marker geometry the
 * drift tests assert on; and a library's default look fights the identity.
 */
import * as React from "react";

/* ------------------------------- element size ---------------------------- */

export interface Size {
  width: number;
  height: number;
}

/**
 * Observe an element's content box. Returns a ref to attach and the current
 * size. Charts need real pixel width to lay out a value scale, and reading it
 * during render would thrash; ResizeObserver reports it after layout instead.
 *
 * Falls back to a sensible width when ResizeObserver is unavailable (jsdom),
 * so chart components still render in tests rather than collapsing to zero.
 */
export function useElementSize<T extends HTMLElement>(
  fallback: Size = { width: 720, height: 260 },
): [React.RefObject<T>, Size] {
  const ref = React.useRef<T>(null);
  const [size, setSize] = React.useState<Size>(fallback);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      // Ignore the zero-size pass that happens while a parent is still hidden.
      if (box.width < 1) return;
      setSize((prev) =>
        Math.abs(prev.width - box.width) < 1 && Math.abs(prev.height - box.height) < 1
          ? prev
          : { width: box.width, height: box.height },
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, size];
}

/* ---------------------------- media preferences -------------------------- */

function subscribeToQuery(query: string) {
  return (onChange: () => void) => {
    if (typeof window === "undefined" || !window.matchMedia) return () => {};
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  };
}

/**
 * Subscribe to a media query through useSyncExternalStore, so the value is read
 * from the browser at render time and can never tear from the real match state
 * the way a useState + useEffect mirror can.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = React.useMemo(() => subscribeToQuery(query), [query]);
  return React.useSyncExternalStore(
    subscribe,
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false, // server/jsdom snapshot
  );
}

/** True when the viewer asked for reduced motion. Chart draw-ins respect it. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/* ------------------------------- scales ---------------------------------- */

export interface Scale {
  (value: number): number;
  invert(pixel: number): number;
}

/** A linear scale from a data domain onto a pixel range. */
export function linearScale(
  [d0, d1]: [number, number],
  [r0, r1]: [number, number],
): Scale {
  const span = d1 - d0 || 1;
  const scale = ((value: number) => r0 + ((value - d0) / span) * (r1 - r0)) as Scale;
  scale.invert = (pixel: number) => d0 + ((pixel - r0) / (r1 - r0 || 1)) * span;
  return scale;
}

/**
 * "Nice" upper bound and evenly spaced ticks for a value axis. Raw maxima give
 * axis labels like 17,413; rounding up to a 1/2/5×10^n step gives the tidy
 * gridlines the design depends on.
 */
export function niceTicks(max: number, count = 5): { max: number; ticks: number[] } {
  if (!Number.isFinite(max) || max <= 0) return { max: 1, ticks: [0, 1] };
  const rough = max / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const normalized = rough / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= niceMax + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
  return { max: niceMax, ticks };
}

/* ------------------------------- path maths ------------------------------ */

export interface Pt {
  x: number;
  y: number;
}

/**
 * A smooth path through the points using Catmull-Rom converted to cubic Bezier.
 * `tension` 0 is a straight polyline, 1 is fully rounded. Monotonicity is not
 * enforced, so keep tension modest on volatile series to avoid phantom dips
 * below the data.
 */
export function smoothPath(points: Pt[], tension = 0.35): string {
  if (points.length === 0) return "";
  if (points.length < 3) {
    return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  }
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + ((p2.x - p0.x) / 6) * tension * 2;
    const c1y = p1.y + ((p2.y - p0.y) / 6) * tension * 2;
    const c2x = p2.x - ((p3.x - p1.x) / 6) * tension * 2;
    const c2y = p2.y - ((p3.y - p1.y) / 6) * tension * 2;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

/** Close a line path down to a baseline so it can be filled as an area. */
export function areaPath(points: Pt[], baselineY: number, tension = 0.35): string {
  if (points.length === 0) return "";
  const line = smoothPath(points, tension);
  const first = points[0];
  const last = points[points.length - 1];
  return `${line} L${last.x},${baselineY} L${first.x},${baselineY} Z`;
}

/* ------------------------------ pointer track ---------------------------- */

/**
 * Track which data index the pointer is nearest, for a hover tooltip.
 * Returns the active index and the handlers to spread onto the SVG.
 *
 * Indices are resolved by proportion rather than by hit-testing each point, so
 * cost stays constant regardless of series length.
 */
export function usePointerIndex(count: number, left: number, right: number) {
  const [index, setIndex] = React.useState<number | null>(null);

  const onPointerMove = React.useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (count < 1) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const span = right - left || 1;
      const ratio = (x - left) / span;
      const nearest = Math.round(ratio * (count - 1));
      setIndex(Math.max(0, Math.min(count - 1, nearest)));
    },
    [count, left, right],
  );

  const onPointerLeave = React.useCallback(() => setIndex(null), []);

  return { index, setIndex, handlers: { onPointerMove, onPointerLeave } };
}
