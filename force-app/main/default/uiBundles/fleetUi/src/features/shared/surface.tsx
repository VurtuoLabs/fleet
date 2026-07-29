/**
 * Dashboard surface primitives.
 *
 * These are the raised-card language of the console: soft radius, one-pixel
 * border, a shadow that lifts the card off the page. `features/shared/ui.tsx`
 * keeps the flat, dense primitives the list and settings pages use; this file
 * is the presentational layer the dashboard and detail headers are built from.
 *
 * Surface is a compound component - Surface.Header / .Body / .Footer - so a card
 * reads as its own small layout in the page that uses it, and padding and
 * divider rules live in one place instead of being respelled per card.
 */
import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { UI, FONT, HEAD, MONO, RADIUS, SHADOW } from "./tokens";

/* -------------------------------- Surface -------------------------------- */

interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Lift on hover - for cards that are themselves links or buttons. */
  interactive?: boolean;
  padded?: boolean;
}

function SurfaceRoot({ children, interactive, padded, style, ...rest }: SurfaceProps) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      {...rest}
      onPointerEnter={(e) => {
        setHover(true);
        rest.onPointerEnter?.(e);
      }}
      onPointerLeave={(e) => {
        setHover(false);
        rest.onPointerLeave?.(e);
      }}
      style={{
        background: UI.surface,
        border: `1px solid ${UI.border}`,
        borderRadius: RADIUS.card,
        boxShadow: interactive && hover ? SHADOW.cardHover : SHADOW.card,
        transform: interactive && hover ? "translateY(-1px)" : undefined,
        transition: "box-shadow 180ms ease, transform 180ms ease",
        padding: padded ? 18 : undefined,
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SurfaceHeader({
  title,
  subtitle,
  right,
  divider = false,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  divider?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        padding: "16px 18px",
        borderBottom: divider ? `1px solid ${UI.border}` : undefined,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h2
          style={{
            fontFamily: HEAD,
            fontSize: 15.5,
            fontWeight: 600,
            color: UI.text,
            margin: 0,
            letterSpacing: "-0.012em",
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <div style={{ fontFamily: FONT, fontSize: 12.5, color: UI.weakest, marginTop: 4, lineHeight: 1.5 }}>
            {subtitle}
          </div>
        )}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  );
}

function SurfaceBody({
  children,
  pad = 18,
  style,
}: {
  children: React.ReactNode;
  pad?: number;
  style?: React.CSSProperties;
}) {
  return <div style={{ padding: pad, paddingTop: 0, minWidth: 0, ...style }}>{children}</div>;
}

function SurfaceFooter({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ borderTop: `1px solid ${UI.border}`, padding: "12px 18px" }}>{children}</div>
  );
}

export const Surface = Object.assign(SurfaceRoot, {
  Header: SurfaceHeader,
  Body: SurfaceBody,
  Footer: SurfaceFooter,
});

/* ------------------------------- IconChip -------------------------------- */

/** The rounded tinted square a KPI card carries in its top-right corner. */
export function IconChip({
  icon: Icon,
  color,
  size = 42,
}: {
  icon: LucideIcon;
  color: string;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: RADIUS.chip + 2,
        background: `${color}1A`,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      <Icon size={Math.round(size * 0.45)} strokeWidth={2} color={color} />
    </span>
  );
}

/* ------------------------------- DeltaPill ------------------------------- */

/**
 * Period-over-period change. Direction carries the colour, but the arrow and the
 * sign carry it too - colour alone would leave the meaning inaccessible.
 *
 * `goodWhenUp` exists because falling is not always bad: open findings dropping
 * is an improvement, and painting that red would read as a regression.
 */
export function DeltaPill({
  value,
  goodWhenUp = true,
  suffix = "%",
}: {
  value: number;
  goodWhenUp?: boolean;
  suffix?: string;
}) {
  const up = value >= 0;
  const good = up === goodWhenUp;
  const color = value === 0 ? UI.weak : good ? UI.success : UI.error;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontFamily: MONO,
        fontSize: 11.5,
        fontWeight: 600,
        color,
        background: `${color}14`,
        border: `1px solid ${color}33`,
        borderRadius: RADIUS.pill,
        padding: "3px 7px",
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden>
        <path
          d={up ? "M5 1.5 L9 7 L1 7 Z" : "M5 8.5 L1 3 L9 3 Z"}
          fill={color}
        />
      </svg>
      {up ? "+" : "−"}
      {Math.abs(value)}
      {suffix}
    </span>
  );
}

/* -------------------------------- StatCard ------------------------------- */

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  color: string;
  /** Caption under the value, e.g. "Last 30 days". */
  caption?: string;
  delta?: { value: number; goodWhenUp?: boolean; suffix?: string };
  /** Optional trend rendered beneath the number. */
  spark?: React.ReactNode;
  onClick?: () => void;
  /** Stable hook for tests - several KPI labels are intentionally repeated
   *  elsewhere on the page (a chart legend, a panel title), so text alone
   *  cannot disambiguate one StatCard from another. */
  testId?: string;
}

export function StatCard({
  label,
  value,
  icon,
  color,
  caption,
  delta,
  spark,
  onClick,
  testId,
}: StatCardProps) {
  const clickable = Boolean(onClick);
  return (
    <Surface
      interactive={clickable}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      data-testid={testId}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      style={{ cursor: clickable ? "pointer" : undefined, padding: 18, display: "flex", flexDirection: "column" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <span
          style={{
            fontFamily: FONT,
            fontSize: 12.5,
            color: UI.weak,
            fontWeight: 500,
            lineHeight: 1.35,
          }}
        >
          {label}
        </span>
        <IconChip icon={icon} color={color} />
      </div>

      <div
        style={{
          fontFamily: HEAD,
          fontSize: 30,
          fontWeight: 600,
          color: UI.text,
          letterSpacing: "-0.025em",
          lineHeight: 1.1,
          marginTop: 14,
        }}
      >
        {value}
      </div>

      {(caption || delta) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          {caption && (
            <span style={{ fontFamily: FONT, fontSize: 11.5, color: UI.weakest }}>{caption}</span>
          )}
          {delta && (
            <DeltaPill value={delta.value} goodWhenUp={delta.goodWhenUp} suffix={delta.suffix} />
          )}
        </div>
      )}

      {spark && <div style={{ marginTop: 12 }}>{spark}</div>}
    </Surface>
  );
}

/* --------------------------- SegmentedControl ---------------------------- */

/**
 * The Monthly / Quarterly / Annually style switch.
 *
 * Implemented as a real radiogroup with roving tabindex: one tab stop for the
 * whole control, arrow keys move between options. A row of independently
 * tabbable buttons would make a keyboard user tab through every range on the
 * way past the card.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));

  const move = (delta: number) => {
    const next = (activeIndex + delta + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        display: "inline-flex",
        gap: 2,
        padding: 3,
        background: UI.page,
        border: `1px solid ${UI.border}`,
        borderRadius: RADIUS.chip + 2,
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          move(1);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          move(-1);
        }
      }}
    >
      {options.map((option, i) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            style={{
              fontFamily: HEAD,
              fontSize: 12.5,
              fontWeight: 500,
              padding: "6px 13px",
              borderRadius: RADIUS.chip,
              border: "none",
              cursor: "pointer",
              color: selected ? UI.text : UI.weak,
              background: selected ? UI.surface : "transparent",
              boxShadow: selected ? SHADOW.card : undefined,
              transition: "background 150ms ease, color 150ms ease",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------- Legend -------------------------------- */

export function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: 99, background: color }} />
      <span style={{ fontFamily: FONT, fontSize: 12, color: UI.weak }}>{label}</span>
    </span>
  );
}
