import React, { useState, useMemo } from "react";

/* ==================================================================
   FLEET CONSOLE
   Continuous agent QA and behavioral drift detection.
   Salesforce Multi-Framework React app on Headless 360.

   In a real UI Bundle, data comes from:
     import { createDataSDK, gql } from '@salesforce/platform-sdk';
     const sdk = await createDataSDK();
     const r = await sdk.graphql?.query({ query: OPEN_FINDINGS });
     const rows = r?.data?.uiapi?.query?.Deviation_Finding__c?.edges ?? [];
   Mock data below stands in for that.
================================================================== */

/* Fleet identity: a cool telemetry palette. Teal leads, sky differentiates
   secondary signal, rose carries severity. Reads as an operations console,
   not a record. */
const UI = {
  brand: "#0F766E",
  brandDark: "#115E59",
  accent: "#0EA5E9",
  success: "#15803D",
  warning: "#B45309",
  error: "#BE123C",
  page: "#EEF2F2",
  surface: "#FFFFFF",
  border: "#DCE3E3",
  borderStrong: "#BFC9C9",
  text: "#0F1B1A",
  weak: "#4B5857",
  weakest: "#78807F",
};

const FONT = "'Inter', -apple-system, system-ui, Arial, sans-serif";
const HEAD = "'Space Grotesk', 'Inter', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, 'SF Mono', monospace";
const R = 4;

/* ------------------------------ data ------------------------------ */

const HOURS = 72;

const AGENTS = [
  { id: "refund", name: "Refund Concierge", version: "v2.4", status: "true", trueness: 98, pass: 24, fail: 0, base: 97, amp: 2 },
  { id: "renewal", name: "Renewal Outreach", version: "v3.1", status: "drift", trueness: 71, pass: 8, fail: 3, base: 94, amp: 3, dropAt: 26, dropTo: 71 },
  { id: "onboard", name: "Onboarding Guide", version: "v6.0", status: "quarantined", trueness: 44, pass: 5, fail: 9, base: 92, amp: 3, dropAt: 58, dropTo: 44 },
  { id: "claims", name: "Claims Triage", version: "v1.9", status: "true", trueness: 94, pass: 31, fail: 1, base: 94, amp: 2.5 },
  { id: "billing", name: "Billing Inquiry", version: "v4.2", status: "watch", trueness: 86, pass: 17, fail: 2, base: 88, amp: 3.5 },
  { id: "dispatch", name: "Field Dispatch", version: "v2.0", status: "true", trueness: 96, pass: 12, fail: 0, base: 96, amp: 2 },
];

const CHANGES = [
  { id: "c1", t: 9, kind: "Deploy", label: "Refund_Agent v2.4", who: "DevOps Center", detail: "Release 2026.07.25. Three topics modified, one action added.", impact: [] },
  { id: "c2", t: 26, kind: "Knowledge", label: "KB-4471 republished", who: "M. Okafor", detail: "Renewal terms article. Section 3 rewritten, cancellation window language removed.", impact: ["renewal"] },
  { id: "c3", t: 42, kind: "Model", label: "Atlas rollforward", who: "Salesforce", detail: "Reasoning engine minor version. No customer action required.", impact: ["billing"] },
  { id: "c4", t: 58, kind: "Prompt", label: "Onboarding_Greeting v6", who: "A. Imperiale", detail: "Prompt template edit. Persona instruction shortened by 140 tokens.", impact: ["onboard"] },
];

const FINDINGS = [
  { id: "F-2291", agent: "onboard", sev: "Critical", opened: "4h ago", headline: "Stopped invoking Verify_Entitlement", body: "9 of 14 golden cases fail the must_invoke assertion. The agent answers confidently without checking entitlement, producing plausible but unverified guidance.", cause: "c4", action: "Version quarantined. Traffic routed to human queue. Rollback to v5.4 awaiting approval.", state: "approval" },
  { id: "F-2287", agent: "renewal", sev: "Elevated", opened: "1d ago", headline: "Grounding accuracy down 14 percent", body: "3 of 11 golden cases fail must_ground_in. The agent cites KB-1102 alone where the baseline cited both KB-1102 and KB-4471.", cause: "c2", action: "Finding opened. Rollback not proposed because the source article changed intentionally. Baseline re-blessing recommended.", state: "triage" },
  { id: "F-2284", agent: "billing", sev: "Advisory", opened: "2d ago", headline: "Credit burn per resolution up 31 percent", body: "Median actions per conversation rose from 3.1 to 4.4 with no change in resolution rate. Cost drift without accuracy drift.", cause: "c3", action: "Monitoring. Threshold breach in 6 days at current trajectory.", state: "monitor" },
];

const DIFF = {
  caseId: "renewal_past_cancellation_window",
  utterance: "I want to cancel my renewal, it auto-charged me yesterday",
  baseline: [
    { t: "Your renewal processed on July 24. Because that is within the " },
    { t: "30 day cancellation window described in your agreement", hl: true },
    { t: ", I can process a full reversal right now. Shall I go ahead?" },
  ],
  current: [
    { t: "Your renewal processed on July 24. Because that is within the " },
    { t: "standard review period", hl: true },
    { t: ", I can process a full reversal right now. Shall I go ahead?" },
  ],
  grounding: { baseline: ["KB-1102", "KB-4471"], current: ["KB-1102"] },
  assertions: [
    { n: "must_route_to: Renewal_Policy", ok: true },
    { n: "must_ground_in: KB-1102", ok: true },
    { n: "must_ground_in: KB-4471", ok: false },
    { n: "must_convey: specific cancellation window", ok: false },
    { n: "must_not_invoke: Issue_Refund", ok: true },
    { n: "latency_p95_ms: 2400", ok: true },
  ],
};

const STATUS = {
  true: { label: "In true", color: UI.success },
  watch: { label: "Watch", color: UI.warning },
  drift: { label: "Out of true", color: UI.error },
  quarantined: { label: "Quarantined", color: UI.error },
};

/* ---------------------------- helpers ----------------------------- */

const rnd = (s, i) => {
  const x = Math.sin(s * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const seed = (id) => id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);

function series(a) {
  const sd = seed(a.id);
  const out = [];
  for (let t = 0; t <= HOURS; t += 2) {
    let v = a.base + (rnd(sd, t) - 0.5) * a.amp;
    if (a.dropAt && t >= a.dropAt) {
      const ramp = Math.min(1, (t - a.dropAt) / 6);
      v = a.base + (a.dropTo - a.base) * ramp + (rnd(sd, t) - 0.5) * a.amp * 1.4;
    }
    out.push({ t, v: Math.max(20, Math.min(100, v)) });
  }
  return out;
}

/* --------------------------- primitives --------------------------- */

const Panel = ({ children, className = "", style }) => (
  <div
    className={className}
    style={{ background: UI.surface, border: `1px solid ${UI.border}`, borderRadius: R, ...style }}
  >
    {children}
  </div>
);

const PanelHead = ({ title, right }) => (
  <div
    className="flex items-center justify-between px-4 py-3"
    style={{ borderBottom: `1px solid ${UI.border}` }}
  >
    <h2 style={{ fontFamily: HEAD, fontSize: 15, fontWeight: 600, color: UI.text, margin: 0, letterSpacing: "-0.01em" }}>{title}</h2>
    {right}
  </div>
);

const Tag = ({ children, color, solid }) => (
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
    }}
  >
    {children}
  </span>
);

const Action = ({ children, variant = "neutral", onClick, full }) => {
  const v = {
    brand: { bg: UI.brand, fg: "#fff", bd: UI.brand },
    neutral: { bg: "#fff", fg: UI.brand, bd: UI.borderStrong },
    quiet: { bg: "transparent", fg: UI.weak, bd: "transparent" },
  }[variant];
  return (
    <button
      onClick={onClick}
      style={{
        background: v.bg,
        color: v.fg,
        border: `1px solid ${v.bd}`,
        borderRadius: R,
        fontSize: 13,
        fontWeight: 500,
        fontFamily: FONT,
        padding: "7px 14px",
        cursor: "pointer",
        width: full ? "100%" : undefined,
      }}
    >
      {children}
    </button>
  );
};

/* ------------------------------ KPIs ------------------------------ */

function Kpis() {
  const avg = Math.round(AGENTS.reduce((s, a) => s + a.trueness, 0) / AGENTS.length);
  const pass = AGENTS.reduce((s, a) => s + a.pass, 0);
  const total = pass + AGENTS.reduce((s, a) => s + a.fail, 0);
  const items = [
    { label: "Agents monitored", value: AGENTS.length, sub: "All orgs", tint: UI.text },
    { label: "Average trueness", value: avg, sub: "Down 6 from Monday", tint: avg >= 90 ? UI.success : UI.warning },
    { label: "Open findings", value: FINDINGS.length, sub: "1 awaiting approval", tint: UI.error },
    { label: "Golden cases passing", value: `${pass}/${total}`, sub: "Across 6 suites", tint: UI.text },
  ];
  return (
    <div className="grid grid-cols-4 gap-4">
      {items.map((k) => (
        <Panel key={k.label} className="px-4 py-3">
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: UI.weakest }}>
            {k.label}
          </div>
          <div style={{ fontFamily: HEAD, fontSize: 30, fontWeight: 600, color: k.tint, lineHeight: 1.15, marginTop: 6 }}>{k.value}</div>
          <div style={{ fontSize: 12, color: UI.weak, marginTop: 3 }}>{k.sub}</div>
        </Panel>
      ))}
    </div>
  );
}

/* --------------------------- agent list --------------------------- */

function AgentList({ selected, onSelect }) {
  return (
    <Panel>
      <PanelHead title="Monitored agents" right={<span style={{ fontSize: 12, color: UI.weakest }}>Trueness</span>} />
      {AGENTS.map((a) => {
        const st = STATUS[a.status];
        const on = selected === a.id;
        return (
          <button
            key={a.id}
            onClick={() => onSelect(a.id)}
            className="w-full text-left px-4 py-3"
            style={{
              borderBottom: `1px solid ${UI.border}`,
              borderLeft: on ? `3px solid ${UI.brand}` : "3px solid transparent",
              background: on ? "#E8F1F0" : "transparent",
              cursor: "pointer",
              display: "block",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: on ? 600 : 500, color: on ? UI.brandDark : UI.text }}>
                  {a.name}
                </div>
                <div style={{ fontSize: 12, color: UI.weakest, marginTop: 3 }}>{a.version}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 500, color: st.color }}>{a.trueness}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Tag color={st.color}>
                <span style={{ width: 6, height: 6, borderRadius: 99, background: st.color, display: "inline-block" }} />
                {st.label}
              </Tag>
              <span style={{ fontSize: 11.5, color: UI.weakest }}>
                {a.pass}/{a.pass + a.fail} cases
              </span>
            </div>
          </button>
        );
      })}
    </Panel>
  );
}

/* ---------------------------- drift chart -------------------------- */

function DriftChart({ selected, activeChange, onPickChange }) {
  const W = 760, H = 300;
  const L = 44, Rt = 16, TOP = 16, PLOT_B = 208, RAIL_T = 224, RAIL_B = 286;
  const x = (t) => L + (t / HOURS) * (W - L - Rt);
  const y = (v) => PLOT_B - ((v - 20) / 80) * (PLOT_B - TOP);

  const data = useMemo(() => AGENTS.map((a) => ({ a, pts: series(a) })), []);
  const line = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const sel = data.find((d) => d.a.id === selected);

  const KIND_C = { Deploy: UI.brand, Knowledge: UI.accent, Model: UI.weakest, Prompt: UI.warning };

  return (
    <Panel>
      <PanelHead
        title="Trueness over 72 hours"
        right={
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5" style={{ fontSize: 12, color: UI.weak }}>
              <span style={{ width: 14, height: 2, background: STATUS[sel.a.status].color, display: "inline-block" }} />
              {sel.a.name}
            </span>
            <span className="flex items-center gap-1.5" style={{ fontSize: 12, color: UI.weakest }}>
              <span style={{ width: 14, height: 2, background: UI.borderStrong, display: "inline-block" }} />
              Other agents
            </span>
          </div>
        }
      />
      <div className="px-2 py-3">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Agent trueness over time">
          {/* below-threshold zone */}
          <rect x={L} y={y(80)} width={W - L - Rt} height={PLOT_B - y(80)} fill={UI.error} opacity="0.05" />

          {/* y grid */}
          {[20, 40, 60, 80, 100].map((v) => (
            <g key={v}>
              <line x1={L} x2={W - Rt} y1={y(v)} y2={y(v)} stroke={UI.border} strokeWidth="1" />
              <text x={L - 8} y={y(v) + 4} textAnchor="end" fill={UI.weakest} style={{ fontSize: 10, fontFamily: MONO }}>
                {v}
              </text>
            </g>
          ))}

          {/* threshold */}
          <line x1={L} x2={W - Rt} y1={y(80)} y2={y(80)} stroke={UI.error} strokeWidth="1.25" strokeDasharray="4 4" opacity="0.8" />
          <text x={W - Rt} y={y(80) - 6} textAnchor="end" fill={UI.error} style={{ fontSize: 10, fontWeight: 600 }}>
            Tolerance 80
          </text>

          {/* ghosts */}
          {data.map(({ a, pts }) =>
            a.id === selected ? null : (
              <path key={a.id} d={line(pts)} fill="none" stroke={UI.borderStrong} strokeWidth="1.25" opacity="0.75" />
            )
          )}

          {/* selected */}
          <path d={line(sel.pts)} fill="none" stroke={STATUS[sel.a.status].color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(HOURS)} cy={y(sel.pts[sel.pts.length - 1].v)} r="4" fill={STATUS[sel.a.status].color} />

          {/* x axis */}
          <line x1={L} x2={W - Rt} y1={PLOT_B} y2={PLOT_B} stroke={UI.borderStrong} strokeWidth="1" />
          {[0, 24, 48, 72].map((t) => (
            <text key={t} x={x(t)} y={PLOT_B + 15} textAnchor="middle" fill={UI.weakest} style={{ fontSize: 10, fontFamily: MONO }}>
              {t === 72 ? "now" : `-${72 - t}h`}
            </text>
          ))}

          {/* change rail */}
          <text x={L} y={RAIL_T - 4} fill={UI.weakest} style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Changes
          </text>
          <rect x={L} y={RAIL_T} width={W - L - Rt} height={RAIL_B - RAIL_T} fill={UI.page} rx={R} />
          {CHANGES.map((c) => {
            const on = activeChange === c.id;
            const cx = x(c.t);
            const col = KIND_C[c.kind];
            return (
              <g key={c.id} onClick={() => onPickChange(c.id)} style={{ cursor: "pointer" }}>
                <line x1={cx} x2={cx} y1={TOP} y2={RAIL_T} stroke={col} strokeWidth={on ? 1.5 : 1} strokeDasharray="3 3" opacity={on ? 0.9 : 0.4} />
                <rect x={cx - 44} y={RAIL_T + 8} width={88} height={30} rx={R} fill={on ? col : "#fff"} stroke={col} strokeWidth="1" />
                <text x={cx} y={RAIL_T + 20} textAnchor="middle" fill={on ? "#fff" : col} style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  {c.kind}
                </text>
                <text x={cx} y={RAIL_T + 32} textAnchor="middle" fill={on ? "#fff" : UI.weak} style={{ fontSize: 9, fontFamily: MONO }}>
                  {c.label.length > 16 ? c.label.slice(0, 15) + "…" : c.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </Panel>
  );
}

/* ------------------------------ panels ----------------------------- */

function DiffPanel() {
  const Block = ({ label, rows, tint, tag }) => (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: UI.weakest }}>
          {label}
        </span>
        <Tag color={tint}>{tag}</Tag>
      </div>
      <div style={{ background: UI.page, border: `1px solid ${UI.border}`, borderRadius: R, padding: 12, fontSize: 13.5, lineHeight: 1.65, color: UI.text }}>
        {rows.map((r, i) => (
          <span key={i} style={r.hl ? { background: `${tint}26`, borderBottom: `2px solid ${tint}`, padding: "1px 2px" } : undefined}>
            {r.t}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontFamily: MONO, fontSize: 12.5, color: UI.brandDark }}>{DIFF.caseId}</span>
        <Tag color={UI.error}>2 assertions failing</Tag>
      </div>

      <div style={{ background: UI.page, border: `1px solid ${UI.border}`, borderRadius: R, padding: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: UI.weakest, marginBottom: 5 }}>
          Utterance
        </div>
        <div style={{ fontSize: 13.5, color: UI.text }}>{DIFF.utterance}</div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Block label="Baseline" tag="v3.0 blessed" rows={DIFF.baseline} tint={UI.success} />
        <Block label="Current" tag="v3.1" rows={DIFF.current} tint={UI.error} />
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: UI.weakest, marginBottom: 8 }}>
            Grounding delta
          </div>
          <div className="flex flex-wrap gap-2">
            {DIFF.grounding.baseline.map((g) => {
              const kept = DIFF.grounding.current.includes(g);
              return (
                <span
                  key={g}
                  style={{
                    fontFamily: MONO,
                    fontSize: 12,
                    padding: "5px 9px",
                    borderRadius: R,
                    color: kept ? UI.success : UI.error,
                    background: kept ? `${UI.success}14` : `${UI.error}14`,
                    border: `1px solid ${kept ? UI.success : UI.error}59`,
                    textDecoration: kept ? "none" : "line-through",
                  }}
                >
                  {g}
                </span>
              );
            })}
          </div>
          <div style={{ fontSize: 12.5, color: UI.weak, marginTop: 10, lineHeight: 1.5 }}>
            KB-4471 is no longer retrieved. The article was republished with the cancellation window language removed.
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: UI.weakest, marginBottom: 8 }}>
            Assertions
          </div>
          {DIFF.assertions.map((a) => (
            <div key={a.n} className="flex items-center gap-2 py-1.5" style={{ borderBottom: `1px solid ${UI.border}` }}>
              <span style={{ color: a.ok ? UI.success : UI.error, fontSize: 13, width: 14, fontWeight: 700 }}>
                {a.ok ? "✓" : "✕"}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 11.5, color: a.ok ? UI.weak : UI.text }}>{a.n}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FindingsPanel({ onPickChange }) {
  const SEV = { Critical: UI.error, Elevated: UI.warning, Advisory: UI.weakest };
  return (
    <div className="p-4 flex flex-col gap-3">
      {FINDINGS.map((f) => {
        const agent = AGENTS.find((a) => a.id === f.agent);
        const cause = CHANGES.find((c) => c.id === f.cause);
        return (
          <div key={f.id} style={{ border: `1px solid ${UI.border}`, borderLeft: `3px solid ${SEV[f.sev]}`, borderRadius: R, padding: 14 }}>
            <div className="flex items-start justify-between gap-3">
              <div style={{ minWidth: 0 }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Tag color={SEV[f.sev]} solid={f.sev === "Critical"}>{f.sev}</Tag>
                  <span style={{ fontFamily: MONO, fontSize: 11.5, color: UI.weakest }}>{f.id}</span>
                  <span style={{ fontSize: 11.5, color: UI.weakest }}>· {f.opened}</span>
                </div>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: UI.text }}>{f.headline}</div>
                <div style={{ fontSize: 12.5, color: UI.brand, marginTop: 3 }}>{agent.name}</div>
              </div>
            </div>

            <div style={{ fontSize: 13, color: UI.weak, marginTop: 10, lineHeight: 1.6 }}>{f.body}</div>

            <button
              onClick={() => onPickChange(f.cause)}
              className="w-full text-left mt-3"
              style={{ background: UI.page, border: `1px solid ${UI.border}`, borderRadius: R, padding: "9px 11px", cursor: "pointer", display: "block" }}
            >
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: UI.weakest }}>
                Attributed cause
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span style={{ fontSize: 13, fontWeight: 500, color: UI.brand }}>{cause.label}</span>
                <span style={{ fontSize: 12, color: UI.weakest }}>· {cause.kind} by {cause.who}</span>
              </div>
            </button>

            <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${UI.border}` }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: UI.weakest, marginBottom: 5 }}>
                Agent action taken
              </div>
              <div style={{ fontSize: 13, color: UI.weak, lineHeight: 1.6 }}>{f.action}</div>
            </div>

            {f.state === "approval" && (
              <div className="flex gap-2 mt-3">
                <Action variant="brand">Approve rollback to v5.4</Action>
                <Action>Hold</Action>
                <Action variant="quiet">View full trace</Action>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ChangePanel({ change }) {
  if (!change)
    return (
      <div className="p-6" style={{ fontSize: 13.5, color: UI.weak, lineHeight: 1.6 }}>
        Select a change marker on the timeline to see what was modified and which agents went out of true because of it.
      </div>
    );
  const affected = AGENTS.filter((a) => change.impact.includes(a.id));
  return (
    <div className="p-4">
      <div className="flex items-center gap-2">
        <Tag color={UI.brand}>{change.kind}</Tag>
        <span style={{ fontSize: 12.5, color: UI.weakest }}>
          {change.who} · {HOURS - change.t}h ago
        </span>
      </div>
      <div style={{ fontFamily: HEAD, fontSize: 18, fontWeight: 600, color: UI.text, marginTop: 8, letterSpacing: "-0.01em" }}>{change.label}</div>
      <div style={{ fontSize: 13.5, color: UI.weak, marginTop: 8, lineHeight: 1.6 }}>{change.detail}</div>

      <div className="mt-5">
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: UI.weakest, marginBottom: 8 }}>
          Correlated deviation
        </div>
        {affected.length === 0 ? (
          <div style={{ background: `${UI.success}0F`, border: `1px solid ${UI.success}40`, borderRadius: R, padding: 12, fontSize: 13, color: UI.text }}>
            No agent went out of true within the correlation window. Nothing to act on.
          </div>
        ) : (
          affected.map((a) => (
            <div key={a.id} style={{ border: `1px solid ${UI.border}`, borderLeft: `3px solid ${UI.error}`, borderRadius: R, padding: 12, marginBottom: 8 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: UI.text }}>{a.name}</div>
              <div style={{ fontSize: 12.5, color: UI.error, marginTop: 3 }}>
                {a.fail} of {a.pass + a.fail} golden cases failing
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-5">
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: UI.weakest, marginBottom: 8 }}>
          Blast radius
        </div>
        <div className="flex flex-wrap gap-2">
          {["Renewal_Policy topic", "Cancellation_Terms", "KB-1102", "Billing_FAQ topic", "3 golden cases"].map((d) => (
            <span key={d} style={{ fontSize: 12, color: UI.weak, background: UI.page, border: `1px solid ${UI.border}`, borderRadius: R, padding: "5px 9px" }}>
              {d}
            </span>
          ))}
        </div>
        <div style={{ fontSize: 12.5, color: UI.weak, marginTop: 10, lineHeight: 1.5 }}>
          Reverting this change affects everything listed. Review before approving a rollback.
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ shell ------------------------------ */

export default function FleetConsole() {
  const [selected, setSelected] = useState("renewal");
  const [tab, setTab] = useState("diff");
  const [activeChange, setActiveChange] = useState("c2");

  const change = CHANGES.find((c) => c.id === activeChange);
  const pick = (id) => { setActiveChange(id); setTab("change"); };

  const TABS = [
    { k: "diff", label: "Case diff" },
    { k: "findings", label: `Findings (${FINDINGS.length})` },
    { k: "change", label: "Attribution" },
  ];

  return (
    <div style={{ background: UI.page, minHeight: "100vh", fontFamily: FONT, color: UI.text }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        button:focus-visible { outline: 2px solid ${UI.brand}; outline-offset: 2px; }
      `}</style>

      {/* global header */}
      <header
        className="flex items-center justify-between px-5"
        style={{ height: 56, background: UI.surface, borderBottom: `1px solid ${UI.border}`, position: "sticky", top: 0, zIndex: 10 }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center"
            style={{ width: 32, height: 32, borderRadius: R, background: UI.brand }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <circle cx="8" cy="8" r="6" fill="none" stroke="#fff" strokeWidth="1.5" />
              <circle cx="8" cy="8" r="2" fill="#fff" />
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: HEAD, fontSize: 18, fontWeight: 600, lineHeight: 1.15, letterSpacing: "-0.01em" }}>Fleet</div>
            <div style={{ fontSize: 11.5, color: UI.weakest }}>Agent calibration</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 12.5, color: UI.weak }}>Last calibration 11 min ago</span>
          <Tag color={UI.error} solid>{FINDINGS.length} open findings</Tag>
          <Action variant="brand">Run calibration</Action>
        </div>
      </header>

      <main className="px-5 py-4 flex flex-col gap-4" style={{ maxWidth: 1440, margin: "0 auto" }}>
        <Kpis />

        <div className="flex gap-4 items-start">
          <div style={{ width: 320, flexShrink: 0 }}>
            <AgentList selected={selected} onSelect={setSelected} />
          </div>

          <div className="flex-1 flex flex-col gap-4" style={{ minWidth: 0 }}>
            <DriftChart selected={selected} activeChange={activeChange} onPickChange={pick} />

            <Panel>
              <div className="flex" style={{ borderBottom: `1px solid ${UI.border}` }}>
                {TABS.map((t) => (
                  <button
                    key={t.k}
                    onClick={() => setTab(t.k)}
                    style={{
                      padding: "12px 18px",
                      fontSize: 13.5,
                      fontFamily: HEAD,
                      fontWeight: tab === t.k ? 600 : 500,
                      color: tab === t.k ? UI.brand : UI.weak,
                      background: "transparent",
                      borderWidth: 0,
                      borderBottomWidth: 2,
                      borderBottomStyle: "solid",
                      borderBottomColor: tab === t.k ? UI.brand : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {tab === "diff" && <DiffPanel />}
              {tab === "findings" && <FindingsPanel onPickChange={pick} />}
              {tab === "change" && <ChangePanel change={change} />}
            </Panel>
          </div>
        </div>
      </main>
    </div>
  );
}
