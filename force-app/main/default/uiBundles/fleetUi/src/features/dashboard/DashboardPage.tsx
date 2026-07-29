/**
 * DashboardPage - the Fleet overview.
 *
 * Layout mirrors the reference dashboard: a four-up KPI strip, a wide trend
 * chart beside a proportional breakdown, then two analytics panels. What each
 * region *says* is Fleet's own: trueness against its threshold rather than
 * revenue, golden-set coverage rather than token spend.
 *
 * The range switch runs inside a transition. Re-slicing the drift board and
 * re-deriving the path geometry is the expensive part of this page, and without
 * a transition the click would drop frames before the new curve appeared.
 */
import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot,
  Gauge,
  TriangleAlert,
  ClipboardCheck,
  ArrowRight,
  Activity,
  GitCommitHorizontal,
} from "lucide-react";
import { UI, FONT, HEAD, MONO, RADIUS } from "@/features/shared/tokens";
import { Surface, StatCard, SegmentedControl, LegendDot } from "@/features/shared/surface";
import { AreaTrendChart } from "@/components/charts/AreaTrendChart";
import { DonutChart, DonutLegendRow } from "@/components/charts/DonutChart";
import { Sparkline } from "@/components/charts/Sparkline";
import { SeverityTag, LoadingBlock, ErrorBlock, EmptyBlock } from "@/features/shared/ui";
import { severityMeta, statusMeta, formatRelative } from "@/features/shared/meta";
import { useDashboardData, RANGE_OPTIONS, type RangeKey } from "./useDashboardData";

export default function DashboardPage() {
  const [range, setRange] = React.useState<RangeKey>("72h");
  const [isPending, startTransition] = React.useTransition();
  const [activeSlice, setActiveSlice] = React.useState<string | null>(null);
  const navigate = useNavigate();

  const model = useDashboardData(range);

  const changeRange = (next: RangeKey) => startTransition(() => setRange(next));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Header />

      {/* ------------------------------ KPI strip ------------------------------ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(232px, 1fr))",
          gap: 20,
        }}
      >
        <StatCard
          testId="stat-agents"
          label="Agents monitored"
          value={model.loading ? "-" : model.kpis.agents}
          icon={Bot}
          color={UI.brand}
          caption={model.kpis.quarantined ? `${model.kpis.quarantined} quarantined` : "All in service"}
          delta={{ value: 0, goodWhenUp: true, suffix: "" }}
          onClick={() => navigate("/agents")}
        />
        <StatCard
          testId="stat-trueness"
          label="Average trueness"
          value={model.loading ? "-" : model.kpis.avgTrueness}
          icon={Gauge}
          color={UI.accent}
          caption={`Threshold ${model.threshold}`}
          delta={{
            value: model.loading ? 0 : model.kpis.avgTrueness - model.threshold,
            goodWhenUp: true,
            suffix: "",
          }}
          onClick={() => navigate("/drift")}
        />
        <StatCard
          testId="stat-findings"
          label="Open findings"
          value={model.loading ? "-" : model.kpis.openFindings}
          icon={TriangleAlert}
          color={UI.error}
          caption={model.kpis.outOfTrue ? `${model.kpis.outOfTrue} agents out of true` : "Nothing out of true"}
          // Findings falling is an improvement, so down is the good direction.
          delta={{ value: -model.kpis.openFindings, goodWhenUp: false, suffix: "" }}
          onClick={() => navigate("/findings")}
        />
        <StatCard
          testId="stat-cases"
          label="Golden cases"
          value={model.loading ? "-" : model.kpis.goldenCases}
          icon={ClipboardCheck}
          color={UI.success}
          caption={`${model.kpis.changes} change events in window`}
          delta={{ value: model.kpis.goldenCases, goodWhenUp: true, suffix: "" }}
          onClick={() => navigate("/cases")}
        />
      </div>

      {/* -------------------------- Trend + breakdown -------------------------- */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2.05fr) minmax(300px, 1fr)",
          gap: 20,
          alignItems: "start",
        }}
        className="fleet-dash-split"
      >
        <Surface>
          <Surface.Header
            title="Trueness & deviation"
            subtitle="Fleet-wide trueness against threshold, and how many agents sit below it."
            right={
              <SegmentedControl
                options={RANGE_OPTIONS}
                value={range}
                onChange={changeRange}
                ariaLabel="Trend window"
              />
            }
          />
          <Surface.Body>
            <div style={{ display: "flex", gap: 18, marginBottom: 6 }}>
              <LegendDot color={UI.brand} label="Average trueness" />
              <LegendDot color={UI.error} label="Agents below threshold" />
            </div>
            <div style={{ opacity: isPending ? 0.55 : 1, transition: "opacity 140ms ease" }}>
              {model.loading ? (
                <LoadingBlock label="Loading trueness" />
              ) : model.error ? (
                <ErrorBlock label="Could not load the drift board" />
              ) : model.series.labels.length === 0 ? (
                <EmptyBlock label="No samples in this window yet." />
              ) : (
                <AreaTrendChart
                  labels={model.series.labels}
                  height={286}
                  ariaLabel="Fleet trueness over the selected window"
                  reference={{ value: model.threshold, label: `threshold ${model.threshold}` }}
                  series={[
                    {
                      key: "trueness",
                      label: "Avg trueness",
                      color: UI.brand,
                      values: model.series.trueness,
                      format: (v) => v.toFixed(1),
                    },
                    {
                      key: "failing",
                      label: "Below threshold",
                      color: UI.error,
                      values: model.series.failing,
                      format: (v) => String(Math.round(v)),
                    },
                  ]}
                />
              )}
            </div>
          </Surface.Body>
        </Surface>

        <Surface>
          <Surface.Header
            title="Golden set coverage"
            subtitle="Curated cases per monitored agent."
          />
          <Surface.Body>
            {model.loading ? (
              <LoadingBlock label="Loading coverage" />
            ) : model.coverage.length === 0 ? (
              <EmptyBlock label="No golden cases curated yet." />
            ) : (
              <>
                <DonutChart
                  slices={model.coverage}
                  centerValue={String(model.totalCases)}
                  centerLabel="Total curated cases"
                  activeKey={activeSlice}
                  onHover={setActiveSlice}
                />
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 2 }}>
                  {model.coverage.slice(0, 5).map((slice) => (
                    <DonutLegendRow
                      key={slice.key}
                      slice={slice}
                      meta={slice.meta}
                      value={String(slice.value)}
                      active={activeSlice === slice.key}
                      onHover={setActiveSlice}
                    />
                  ))}
                </div>
              </>
            )}
          </Surface.Body>
          <Surface.Footer>
            <button
              type="button"
              onClick={() => navigate("/cases")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                fontFamily: HEAD,
                fontSize: 12.5,
                fontWeight: 500,
                color: UI.brand,
              }}
            >
              Open the golden set
              <ArrowRight size={14} strokeWidth={2.2} />
            </button>
          </Surface.Footer>
        </Surface>
      </div>

      {/* ---------------------------- Bottom analytics ------------------------- */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 20,
          alignItems: "start",
        }}
      >
        <AgentHealthPanel model={model} />
        <RecentFindingsPanel model={model} />
      </div>
    </div>
  );
}

/* --------------------------------- header -------------------------------- */

function Header() {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
      <div>
        <h1
          style={{
            fontFamily: HEAD,
            fontSize: 24,
            fontWeight: 600,
            color: UI.text,
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          Dashboard
        </h1>
        <div style={{ fontFamily: FONT, fontSize: 13, color: UI.weak, marginTop: 5 }}>
          Is every monitored agent still behaving the way we approved?
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- agent health ------------------------------ */

function AgentHealthPanel({ model }: { model: ReturnType<typeof useDashboardData> }) {
  const navigate = useNavigate();
  return (
    <Surface data-testid="agent-health-panel">
      <Surface.Header
        title="Agent health"
        subtitle="Trueness trend across the drift window."
        right={<Activity size={17} strokeWidth={2} color={UI.weakest} />}
      />
      <Surface.Body pad={10}>
        {model.loading ? (
          <LoadingBlock label="Loading agents" />
        ) : model.agentTrends.length === 0 ? (
          <EmptyBlock label="No agents are being monitored." />
        ) : (
          model.agentTrends.map(({ agent, points }) => {
            const meta = statusMeta(agent.status);
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => navigate(`/agents/${agent.id}`)}
                style={{
                  width: "100%",
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) 96px 64px",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 8px",
                  background: "transparent",
                  border: "none",
                  borderRadius: RADIUS.chip,
                  cursor: "pointer",
                  textAlign: "left",
                }}
                onPointerEnter={(e) => (e.currentTarget.style.background = UI.page)}
                onPointerLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontFamily: FONT,
                      fontSize: 13,
                      fontWeight: 500,
                      color: UI.text,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {agent.name}
                  </span>
                  <span
                    style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: 99, background: meta.color }} />
                    <span style={{ fontFamily: FONT, fontSize: 11, color: UI.weakest }}>
                      {meta.label} · {agent.casesPassing}/{agent.casesTotal} cases
                    </span>
                  </span>
                </span>

                <span style={{ height: 34 }}>
                  {points.length > 1 ? (
                    <Sparkline values={points} color={meta.color} height={34} endDot={false} />
                  ) : null}
                </span>

                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 15,
                    fontWeight: 600,
                    color: meta.color,
                    textAlign: "right",
                  }}
                >
                  {Math.round(agent.truenessScore)}
                </span>
              </button>
            );
          })
        )}
      </Surface.Body>
    </Surface>
  );
}

/* ---------------------------- recent findings ---------------------------- */

function RecentFindingsPanel({ model }: { model: ReturnType<typeof useDashboardData> }) {
  const navigate = useNavigate();
  return (
    <Surface data-testid="recent-findings-panel">
      <Surface.Header
        title="Open findings"
        subtitle="Detected drift, with the change it was attributed to."
        right={<GitCommitHorizontal size={17} strokeWidth={2} color={UI.weakest} />}
      />
      <Surface.Body pad={10}>
        {model.loading ? (
          <LoadingBlock label="Loading findings" />
        ) : model.findings.length === 0 ? (
          <EmptyBlock label="Nothing is out of true. Every agent matches its blessed baseline." />
        ) : (
          model.findings.slice(0, 5).map((finding) => (
            <button
              key={finding.id}
              type="button"
              onClick={() => navigate(`/findings/${finding.id}`)}
              style={{
                width: "100%",
                display: "block",
                padding: "11px 8px",
                background: "transparent",
                border: "none",
                borderRadius: RADIUS.chip,
                cursor: "pointer",
                textAlign: "left",
              }}
              onPointerEnter={(e) => (e.currentTarget.style.background = UI.page)}
              onPointerLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <SeverityTag meta={severityMeta(finding.severity)} />
                <span style={{ fontFamily: MONO, fontSize: 11, color: UI.weakest }}>
                  {finding.findingNumber}
                </span>
                {finding.openedAt && (
                  <span style={{ fontFamily: FONT, fontSize: 11, color: UI.weakest, marginLeft: "auto" }}>
                    {formatRelative(finding.openedAt)}
                  </span>
                )}
              </span>
              <span
                style={{
                  display: "block",
                  fontFamily: FONT,
                  fontSize: 13,
                  fontWeight: 500,
                  color: UI.text,
                  marginTop: 6,
                  lineHeight: 1.4,
                }}
              >
                {finding.headline}
              </span>
              {finding.attributedChange && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 6,
                    fontFamily: FONT,
                    fontSize: 11.5,
                    color: UI.weak,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: 99, background: UI.accent }} />
                  {finding.attributedChange.label}
                  {finding.attributionConfidence != null && (
                    <span style={{ fontFamily: MONO, color: UI.weakest }}>
                      {Math.round(finding.attributionConfidence * 100)}%
                    </span>
                  )}
                </span>
              )}
            </button>
          ))
        )}
      </Surface.Body>
    </Surface>
  );
}
