/**
 * Fleet visual identity - a cool telemetry palette. Teal leads, sky
 * differentiates secondary signal (change-marker kinds), rose carries severity.
 * The console reads as an operations surface, not a record.
 *
 * These literal tokens mirror CONTRACT.md §11.5 and docs/console-mockup.jsx.
 * Feature pages style with inline tokens so the identity is exact and does not
 * depend on globals.css CSS-vars being loaded (which also keeps the feature
 * layer renderable in jsdom under test).
 */
export const UI = {
  brand: "#0F766E",
  brandDark: "#115E59",
  accent: "#0EA5E9",
  success: "#15803D",
  warning: "#014486",
  error: "#BE123C",
  page: "#F3F3F3",
  surface: "#FFFFFF",
  border: "#DCE3E3",
  borderStrong: "#BFC9C9",
  text: "#0F1B1A",
  weak: "#4B5857",
  weakest: "#78807F",
} as const;

/** Typography stacks. Space Grotesk headings, Inter body, JetBrains Mono metrics. */
export const FONT = "'Inter', -apple-system, system-ui, Arial, sans-serif";
export const HEAD = "'Space Grotesk', 'Inter', system-ui, sans-serif";
export const MONO = "'JetBrains Mono', ui-monospace, 'SF Mono', monospace";

/**
 * Corner radius, in px. `R` stays 4 for controls - inputs, buttons, selects - 
 * because a crisp control still reads as an operations surface.
 *
 * Cards get their own, larger radius. A 4px card at this size reads as a table
 * cell rather than a panel, and the dashboard depends on cards being legible as
 * discrete objects on the page.
 */
export const R = 4;

export const RADIUS = {
  control: 4,
  chip: 8,
  card: 14,
  pill: 999,
} as const;

/**
 * Elevation. Two levels only: resting cards, and things that float above them
 * (tooltips, menus, popovers). Shadows are tinted with the page ink rather than
 * neutral black so they sit in the palette instead of greying it.
 */
export const SHADOW = {
  card: "0 1px 2px rgba(15,27,26,0.04), 0 1px 3px rgba(15,27,26,0.06)",
  cardHover: "0 4px 12px -2px rgba(15,27,26,0.10), 0 2px 6px -2px rgba(15,27,26,0.06)",
  float: "0 12px 32px -8px rgba(15,27,26,0.24), 0 4px 12px -4px rgba(15,27,26,0.12)",
} as const;

/** Tints used for icon chips and soft backgrounds, as hex alpha suffixes. */
export const TINT = {
  soft: "14", //  ~8%
  medium: "1F", // ~12%
  strong: "33", // ~20%
} as const;
