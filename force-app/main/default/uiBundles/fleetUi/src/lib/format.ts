import {
  format,
  formatDistanceToNowStrict,
  parseISO,
  isValid,
} from "date-fns";

/** Coerce an ISO string / Date / null into a Date, or null when unparseable. */
function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = typeof value === "string" ? parseISO(value) : value;
  return isValid(d) ? d : null;
}

/** "4h ago", "2d ago" - the relative stamp used throughout the console. */
export function timeAgo(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "-";
  return `${formatDistanceToNowStrict(d)} ago`;
}

/** Absolute, human timestamp for tooltips and detail headers. */
export function dateTime(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "-";
  return format(d, "MMM d, yyyy · HH:mm");
}

/** Short date, e.g. "Jul 24". */
export function shortDate(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "-";
  return format(d, "MMM d");
}

/** Whole-number trueness score, never NaN. */
export function trueness(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return String(Math.round(value));
}

/** Percentage with a single decimal when needed. */
export function percent(value: number | null | undefined, digits = 0): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(digits)}%`;
}

/** Latency in ms, grouped. */
export function ms(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${Math.round(value).toLocaleString()} ms`;
}

/** Flex credits with up to two decimals. */
export function credits(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** "24/31" pass ratio. */
export function ratio(pass: number, total: number): string {
  return `${pass}/${total}`;
}

/** Deviation score 0..1 rendered as a percentage. */
export function deviation(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${Math.round(value * 100)}%`;
}
