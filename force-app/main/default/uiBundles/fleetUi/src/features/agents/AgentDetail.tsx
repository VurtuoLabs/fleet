/**
 * AgentDetail - one monitored agent.
 *
 * Header carries the trueness score, status pill and blessed/current version;
 * a monitoring toggle (write goes through Apex via useSetMonitoring); a strip
 * of recent calibration runs; and deep links into the drift and case views.
 *
 * Data seam:
 *   useAgent(agentId)            → AgentView
 *   useAgentRuns(agentId, 8)     → RunView[]
 *   useSetMonitoring()           → mutation({ agentId, enabled }) (Apex)
 */
import type { CSSProperties } from "react";
import { useParams, Link } from "react-router-dom";
import { UI, HEAD, MONO, R } from "@/features/shared/tokens";
import { statusMeta, formatScore, formatRelative, formatDateTime } from "@/features/shared/meta";
import {
  Panel,
  PanelHead,
  PageTitle,
  StatusPill,
  Metric,
  SectionLabel,
  Action,
  LoadingBlock,
  ErrorBlock,
  EmptyBlock,
} from "@/features/shared/ui";
import { useAgent, useAgentRuns, useSetMonitoring } from "@/hooks";
import type { RunView } from "@/domain/types";

export default function AgentDetail() {
  const { agentId } = useParams<{ agentId: string }>();
  const { data: agent, isLoading, isError } = useAgent(agentId);
  const runs = useAgentRuns(agentId, 8);
  const setMonitoring = useSetMonitoring();

  if (isLoading) return <LoadingBlock label="Loading agent" />;
  if (isError || !agent) return <ErrorBlock label="Could not load this agent" />;

  const meta = statusMeta(agent.status);

  return (
    <div className="flex flex-col gap-4">
      <PageTitle
        title={agent.name}
        subtitle={agent.agentApiName}
        right={
          <div className="flex items-center gap-2">
            <Link to="/drift" style={{ textDecoration: "none" }}>
              <Action variant="neutral">View drift</Action>
            </Link>
            <Link to="/cases" style={{ textDecoration: "none" }}>
              <Action variant="neutral">Golden set</Action>
            </Link>
          </div>
        }
      />

      {/* summary */}
      <Panel className="px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div>
              <SectionLabel>Trueness</SectionLabel>
              <div style={{ marginTop: 4 }}>
                <Metric color={meta.color} size={34}>
                  {formatScore(agent.truenessScore)}
                </Metric>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <StatusPill meta={meta} />
              <span style={{ fontSize: 12, color: UI.weak }}>{meta.hint}</span>
            </div>
          </div>
          <label className="flex items-center gap-2" style={{ fontSize: 13, color: UI.text }}>
            <input
              type="checkbox"
              checked={agent.monitoringEnabled}
              disabled={setMonitoring.isPending}
              onChange={(e) => setMonitoring.mutate({ agentId: agent.id, enabled: e.target.checked })}
              aria-label="Monitoring enabled"
            />
            Monitoring {agent.monitoringEnabled ? "on" : "off"}
          </label>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-4">
          <Field label="Current version" value={agent.currentVersion} mono />
          <Field label="Blessed baseline" value={agent.blessedVersion ?? "-"} mono />
          <Field
            label="Cases passing"
            value={`${agent.casesPassing}/${agent.casesTotal}`}
            mono
          />
          <Field label="Last calibrated" value={formatRelative(agent.lastCalibratedAt)} />
        </div>

        {agent.status === "quarantined" && (
          <div
            className="mt-4"
            style={{
              background: `${UI.error}0F`,
              border: `1px solid ${UI.error}40`,
              borderRadius: R,
              padding: 12,
              fontSize: 13,
              color: UI.text,
            }}
          >
            Quarantined{agent.quarantinedAt ? ` ${formatRelative(agent.quarantinedAt)}` : ""}. Traffic is routed
            to the fallback queue until a release or rollback is approved.
          </div>
        )}
      </Panel>

      {/* recent runs */}
      <Panel>
        <PanelHead title="Recent calibration runs" />
        {runs.isLoading ? (
          <LoadingBlock label="Loading runs" />
        ) : runs.isError ? (
          <ErrorBlock label="Could not load runs" />
        ) : (runs.data ?? []).length === 0 ? (
          <EmptyBlock label="No calibration runs recorded for this agent yet." />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Run", "Trigger", "Status", "Passed", "Trueness", "When"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: h === "Run" || h === "Trigger" || h === "Status" ? "left" : "right",
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: UI.weakest,
                      padding: "10px 16px",
                      borderBottom: `1px solid ${UI.border}`,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(runs.data ?? []).map((r) => (
                <RunRow key={r.id} run={r} />
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div
        style={{
          fontSize: 14,
          color: UI.text,
          marginTop: 4,
          fontFamily: mono ? MONO : HEAD,
          fontWeight: mono ? 500 : 600,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function RunRow({ run }: { run: RunView }) {
  const pass = run.casesTotal ? Math.round(((run.casesPassed ?? 0) / run.casesTotal) * 100) : 0;
  const tint = (run.truenessScore ?? 0) >= 80 ? UI.success : UI.error;
  return (
    <tr>
      <td style={cell("left")}>
        <Link to={`/runs/${run.id}`} style={{ fontFamily: MONO, fontSize: 12.5, color: UI.brandDark, textDecoration: "none" }}>
          {run.runKey}
        </Link>
      </td>
      <td style={{ ...cell("left"), fontSize: 12.5, color: UI.weak }}>{run.triggerSource}</td>
      <td style={{ ...cell("left"), fontSize: 12.5, color: UI.weak }}>{run.status}</td>
      <td style={{ ...cell("right"), fontFamily: MONO, fontSize: 12.5, color: UI.text }}>
        {run.casesPassed}/{run.casesTotal} · {pass}%
      </td>
      <td style={cell("right")}>
        <Metric color={tint} size={13}>
          {formatScore(run.truenessScore)}
        </Metric>
      </td>
      <td style={{ ...cell("right"), fontSize: 12, color: UI.weakest }} title={formatDateTime(run.completedAt ?? run.startedAt)}>
        {formatRelative(run.completedAt ?? run.startedAt)}
      </td>
    </tr>
  );
}

function cell(align: "left" | "right"): CSSProperties {
  return { textAlign: align, padding: "10px 16px", borderBottom: `1px solid ${UI.border}` };
}
