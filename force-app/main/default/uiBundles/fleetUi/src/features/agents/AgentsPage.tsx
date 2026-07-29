/**
 * AgentsPage - the monitored-agents list.
 *
 * A KPI strip over a list of agents, each row carrying its trueness score in
 * JetBrains Mono coloured by status, a status pill, and the passing/total case
 * count. A view selector switches between the seeded Fleet_View__mdt saved
 * views (All agents, Out of true, Quarantined, My agents). Rows deep-link to
 * the agent detail.
 *
 * Data seam:
 *   useAgents(viewKey?) → AgentView[]
 *   useViews()          → ViewDefView[]   (read-only saved views)
 */
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { UI, HEAD, R } from "@/features/shared/tokens";
import { statusMeta, formatScore, formatRelative } from "@/features/shared/meta";
import {
  Panel,
  PanelHead,
  PageTitle,
  StatusPill,
  Metric,
  KpiCard,
  LoadingBlock,
  ErrorBlock,
  EmptyBlock,
} from "@/features/shared/ui";
import { useAgents, useViews } from "@/hooks";
import type { AgentView } from "@/domain/types";

export default function AgentsPage() {
  const [viewKey, setViewKey] = React.useState("ALL_AGENTS");
  const views = useViews();
  const { data, isLoading, isError } = useAgents(viewKey);
  const agents = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <PageTitle title="Agents" subtitle="Every monitored Agentforce agent and its trueness." />

      <Kpis agents={agents} loading={isLoading} />

      <Panel>
        <PanelHead
          title="Monitored agents"
          right={
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2" style={{ fontSize: 12.5, color: UI.weak }}>
                View
                <select
                  aria-label="Saved view"
                  value={viewKey}
                  onChange={(e) => setViewKey(e.target.value)}
                  style={{
                    fontFamily: HEAD,
                    fontSize: 13,
                    color: UI.text,
                    background: UI.surface,
                    border: `1px solid ${UI.borderStrong}`,
                    borderRadius: R,
                    padding: "5px 9px",
                  }}
                >
                  {(views.data ?? [{ viewKey: "ALL_AGENTS", label: "All agents", displayOrder: 0 }]).map((v) => (
                    <option key={v.viewKey} value={v.viewKey}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
              <span style={{ fontSize: 12, color: UI.weakest }}>Trueness</span>
            </div>
          }
        />
        {isLoading ? (
          <LoadingBlock label="Loading agents" />
        ) : isError ? (
          <ErrorBlock label="Could not load agents" />
        ) : agents.length === 0 ? (
          <EmptyBlock label="No agents match this view." />
        ) : (
          agents.map((a) => <AgentRow key={a.id} agent={a} />)
        )}
      </Panel>
    </div>
  );
}

function Kpis({ agents, loading }: { agents: AgentView[]; loading: boolean }) {
  const avg = agents.length
    ? Math.round(agents.reduce((s, a) => s + (a.truenessScore ?? 0), 0) / agents.length)
    : 0;
  const pass = agents.reduce((s, a) => s + (a.casesPassing ?? 0), 0);
  const total = agents.reduce((s, a) => s + (a.casesTotal ?? 0), 0);
  const quarantined = agents.filter((a) => a.status === "quarantined").length;
  const outOfTrue = agents.filter((a) => a.status === "drift").length;

  return (
    <div className="grid grid-cols-4 gap-4">
      <KpiCard label="Agents monitored" value={loading ? "-" : agents.length} sub="All orgs" />
      <KpiCard
        label="Average trueness"
        value={loading ? "-" : avg}
        sub={outOfTrue ? `${outOfTrue} out of true` : "All within tolerance"}
        tint={avg >= 90 ? UI.success : avg >= 80 ? UI.warning : UI.error}
      />
      <KpiCard
        label="Quarantined"
        value={loading ? "-" : quarantined}
        sub={quarantined ? "Traffic held" : "None held"}
        tint={quarantined ? UI.error : UI.text}
      />
      <KpiCard label="Golden cases passing" value={loading ? "-" : `${pass}/${total}`} sub="Across all suites" />
    </div>
  );
}

function AgentRow({ agent }: { agent: AgentView }) {
  const navigate = useNavigate();
  const meta = statusMeta(agent.status);
  return (
    <button
      onClick={() => navigate(`/agents/${agent.id}`)}
      className="w-full text-left px-4 py-3"
      style={{
        borderBottom: `1px solid ${UI.border}`,
        borderLeft: "3px solid transparent",
        background: "transparent",
        cursor: "pointer",
        display: "block",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: UI.text }}>{agent.name}</div>
          <div style={{ fontSize: 12, color: UI.weakest, marginTop: 3 }}>
            {agent.currentVersion}
            {agent.blessedVersion && agent.blessedVersion !== agent.currentVersion
              ? ` · blessed ${agent.blessedVersion}`
              : ""}
          </div>
        </div>
        <Metric color={meta.color}>{formatScore(agent.truenessScore)}</Metric>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <StatusPill meta={meta} />
        <span style={{ fontSize: 11.5, color: UI.weakest }}>
          {agent.casesPassing}/{agent.casesTotal} cases
        </span>
        {agent.lastCalibratedAt && (
          <span style={{ fontSize: 11.5, color: UI.weakest }}>· calibrated {formatRelative(agent.lastCalibratedAt)}</span>
        )}
      </div>
    </button>
  );
}
