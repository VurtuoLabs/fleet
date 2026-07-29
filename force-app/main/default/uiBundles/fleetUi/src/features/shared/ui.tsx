/**
 * Feature-local presentational primitives for the Fleet console.
 *
 * These reproduce the identity in docs/console-mockup.jsx (teal primary,
 * Space Grotesk headings, JetBrains Mono metrics, 4px radius) with inline
 * tokens, so every feature page reads as one system and renders without the
 * global stylesheet. They intentionally do not depend on the core
 * components/ui barrel; the design-system pane owns the shadcn atoms, this
 * owns the console's feature chrome.
 */
import * as React from "react";
import { UI, FONT, HEAD, MONO, R } from "./tokens";
import type { StatusMeta, SeverityMeta } from "./meta";

/* -------------------------------- Panel ---------------------------------- */

export function Panel({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{ background: UI.surface, border: `1px solid ${UI.border}`, borderRadius: R, ...style }}
    >
      {children}
    </div>
  );
}

export function PanelHead({ title, right }: { title: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{ borderBottom: `1px solid ${UI.border}` }}
    >
      <h2
        style={{
          fontFamily: HEAD,
          fontSize: 15,
          fontWeight: 600,
          color: UI.text,
          margin: 0,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h2>
      {right}
    </div>
  );
}

/* -------------------------------- PageTitle ------------------------------ */

export function PageTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h1
          style={{
            fontFamily: HEAD,
            fontSize: 22,
            fontWeight: 600,
            color: UI.text,
            margin: 0,
            letterSpacing: "-0.015em",
          }}
        >
          {title}
        </h1>
        {subtitle && <div style={{ fontSize: 13, color: UI.weak, marginTop: 4 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

/* --------------------------------- Tag ----------------------------------- */

export function Tag({
  children,
  color,
  solid = false,
}: {
  children: React.ReactNode;
  color: string;
  solid?: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1,
        padding: "4px 8px",
        borderRadius: 99,
        color: solid ? "#fff" : color,
        background: solid ? color : `${color}1A`,
        border: solid ? "none" : `1px solid ${color}59`,
        whiteSpace: "nowrap",
        fontFamily: FONT,
      }}
    >
      {children}
    </span>
  );
}

/** Status pill with a leading dot - the monitored-agents signal. */
export function StatusPill({ meta }: { meta: StatusMeta }) {
  return (
    <Tag color={meta.color}>
      <span
        style={{ width: 6, height: 6, borderRadius: 99, background: meta.color, display: "inline-block" }}
      />
      {meta.label}
    </Tag>
  );
}

/** Severity chip - Critical renders solid rose, the rest tinted. */
export function SeverityTag({ meta }: { meta: SeverityMeta }) {
  return (
    <Tag color={meta.color} solid={meta.solid}>
      {meta.label}
    </Tag>
  );
}

/* -------------------------------- Action --------------------------------- */

export function Action({
  children,
  variant = "neutral",
  onClick,
  full = false,
  disabled = false,
  type = "button",
}: {
  children: React.ReactNode;
  variant?: "brand" | "neutral" | "quiet" | "danger";
  onClick?: () => void;
  full?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const v = {
    brand: { bg: UI.brand, fg: "#fff", bd: UI.brand },
    neutral: { bg: "#fff", fg: UI.brand, bd: UI.borderStrong },
    quiet: { bg: "transparent", fg: UI.weak, bd: "transparent" },
    danger: { bg: "#fff", fg: UI.error, bd: `${UI.error}80` },
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: v.bg,
        color: v.fg,
        border: `1px solid ${v.bd}`,
        borderRadius: R,
        fontSize: 13,
        fontWeight: 500,
        fontFamily: FONT,
        padding: "7px 14px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        width: full ? "100%" : undefined,
      }}
    >
      {children}
    </button>
  );
}

/* ------------------------------ Section label ---------------------------- */

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        color: UI.weakest,
        fontFamily: FONT,
      }}
    >
      {children}
    </div>
  );
}

/* --------------------------------- Metric -------------------------------- */

/** JetBrains Mono numeral used for trueness scores and case ids. */
export function Metric({
  children,
  color = UI.text,
  size = 15,
}: {
  children: React.ReactNode;
  color?: string;
  size?: number;
}) {
  return (
    <span style={{ fontFamily: MONO, fontSize: size, fontWeight: 500, color }}>{children}</span>
  );
}

/* --------------------------------- Kpi ----------------------------------- */

export function KpiCard({
  label,
  value,
  sub,
  tint = UI.text,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tint?: string;
}) {
  return (
    <Panel className="px-4 py-3">
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: UI.weakest,
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: HEAD, fontSize: 30, fontWeight: 600, color: tint, lineHeight: 1.15, marginTop: 6 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: UI.weak, marginTop: 3 }}>{sub}</div>}
    </Panel>
  );
}

/* ------------------------------- States ---------------------------------- */

export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center px-6 py-10"
      style={{ fontSize: 13, color: UI.weak, fontFamily: FONT }}
    >
      {label}…
    </div>
  );
}

export function ErrorBlock({ label = "Could not load data" }: { label?: string }) {
  return (
    <div
      role="alert"
      className="px-6 py-10 text-center"
      style={{ fontSize: 13, color: UI.error, fontFamily: FONT }}
    >
      {label}
    </div>
  );
}

export function EmptyBlock({ label }: { label: string }) {
  return (
    <div
      className="px-6 py-10 text-center"
      style={{ fontSize: 13, color: UI.weak, lineHeight: 1.6, fontFamily: FONT }}
    >
      {label}
    </div>
  );
}
