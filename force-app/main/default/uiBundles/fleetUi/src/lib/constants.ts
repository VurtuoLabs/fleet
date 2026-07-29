/**
 * Cross-cutting UI constants for the Fleet console. Names and defaults mirror
 * CONTRACT.md so the front end reads as one surface with the Apex layer.
 */

/** The org bundle path. The app is served from /app/c__fleetUi, not the root. */
export const UI_BUNDLE_REF = "c__fleetUi";

/** Default drift window shown on the trueness chart and drift views. */
export const DRIFT_WINDOW_HOURS = 72;

/** Trueness tolerance line. Mirrors Fleet_Setting__mdt.Trueness_Threshold__c. */
export const TRUENESS_THRESHOLD = 80;

/** "Watch" band sits just above the tolerance line. */
export const TRUENESS_WATCH_BAND = 90;

/** Embedding prefilter bounds - the single biggest lever on run cost. */
export const PREFILTER_LOWER_BOUND = 0.15;
export const PREFILTER_UPPER_BOUND = 0.45;

/** Deep link to Setup, used by the read-only /settings/* views. */
export const SETUP_CUSTOM_METADATA_PATH =
  "/lightning/setup/CustomMetadata/home";

/** TanStack Query defaults. */
export const QUERY_STALE_TIME_MS = 30_000;
export const QUERY_GC_TIME_MS = 5 * 60_000;

/** Local-storage key for the persisted theme choice. */
export const THEME_STORAGE_KEY = "fleet.theme";
