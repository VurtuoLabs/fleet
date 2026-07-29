/**
 * CasesPage - the golden set.
 *
 * Lists golden cases with their last result and consecutive-failure count.
 * Selecting a case opens the baseline-vs-current diff (CaseDiff) inline in the
 * right pane. An agent filter narrows the list; the source badge distinguishes
 * curated cases from auto-proposed and production-promoted ones.
 *
 * Data seam:
 *   useAgents()               → AgentView[]        (filter options)
 *   useGoldenCases(agentId?)  → GoldenCaseView[]
 *   useCaseDiff(caseId)       → CaseDiffView       (consumed by CaseDiff)
 */
import * as React from "react";
import { UI, HEAD, MONO, R } from "@/features/shared/tokens";
import { formatRelative } from "@/features/shared/meta";
import {
  Panel,
  PanelHead,
  PageTitle,
  Tag,
  LoadingBlock,
  ErrorBlock,
  EmptyBlock,
} from "@/features/shared/ui";
import { useAgents, useGoldenCases, useCaseDiff } from "@/hooks";
import type { GoldenCaseView } from "@/domain/types";
import { CaseDiff } from "./CaseDiff";

const SOURCE_LABEL: Record<string, string> = {
  Curated: "Curated",
  Auto_Proposed: "Proposed",
  Promoted_From_Production: "Promoted",
};

export default function CasesPage() {
  const [agentId, setAgentId] = React.useState<string>("");
  const [selectedCaseId, setSelectedCaseId] = React.useState<string | null>(null);

  const agents = useAgents();
  const { data, isLoading, isError } = useGoldenCases(agentId || undefined);
  const cases = data ?? [];

  const resolvedCaseId = selectedCaseId ?? cases[0]?.id ?? null;

  return (
    <div className="flex flex-col gap-4">
      <PageTitle title="Golden set" subtitle="Curated cases and their blessed baseline." />

      <div className="flex gap-4 items-start">
        {/* case list */}
        <div style={{ width: 340, flexShrink: 0 }}>
          <Panel>
            <PanelHead
              title="Golden cases"
              right={
                <select
                  aria-label="Filter by agent"
                  value={agentId}
                  onChange={(e) => {
                    setAgentId(e.target.value);
                    setSelectedCaseId(null);
                  }}
                  style={{
                    fontFamily: HEAD,
                    fontSize: 12.5,
                    color: UI.text,
                    background: UI.surface,
                    border: `1px solid ${UI.borderStrong}`,
                    borderRadius: R,
                    padding: "5px 8px",
                  }}
                >
                  <option value="">All agents</option>
                  {(agents.data ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              }
            />
            {isLoading ? (
              <LoadingBlock label="Loading cases" />
            ) : isError ? (
              <ErrorBlock label="Could not load cases" />
            ) : cases.length === 0 ? (
              <EmptyBlock label="No golden cases for this filter." />
            ) : (
              cases.map((c) => (
                <CaseRow
                  key={c.id}
                  gc={c}
                  selected={c.id === resolvedCaseId}
                  onSelect={() => setSelectedCaseId(c.id)}
                />
              ))
            )}
          </Panel>
        </div>

        {/* diff pane */}
        <div className="flex-1" style={{ minWidth: 0 }}>
          <Panel>
            <PanelHead title="Case diff" />
            {resolvedCaseId ? (
              <DiffPane caseId={resolvedCaseId} />
            ) : (
              <EmptyBlock label="Select a golden case to compare its baseline and current response." />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function CaseRow({
  gc,
  selected,
  onSelect,
}: {
  gc: GoldenCaseView;
  selected: boolean;
  onSelect: () => void;
}) {
  const passed = gc.lastResult === "Pass";
  const tint = passed ? UI.success : gc.lastResult === "Fail" ? UI.error : UI.weakest;
  return (
    <button
      onClick={onSelect}
      className="w-full text-left px-4 py-3"
      style={{
        borderBottom: `1px solid ${UI.border}`,
        borderLeft: selected ? `3px solid ${UI.brand}` : "3px solid transparent",
        background: selected ? "#E8F1F0" : "transparent",
        cursor: "pointer",
        display: "block",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span style={{ fontFamily: MONO, fontSize: 12, color: selected ? UI.brandDark : UI.text, minWidth: 0 }}>
          {gc.caseKey}
        </span>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: tint, flexShrink: 0 }} />
      </div>
      <div className="flex items-center gap-2 mt-2">
        <Tag color={UI.weakest}>{SOURCE_LABEL[gc.source] ?? gc.source}</Tag>
        {!gc.active && <Tag color={UI.warning}>Inactive</Tag>}
        {gc.consecutiveFailures > 0 && (
          <span style={{ fontSize: 11.5, color: UI.error }}>
            {gc.consecutiveFailures} consecutive fail{gc.consecutiveFailures === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </button>
  );
}

function DiffPane({ caseId }: { caseId: string }) {
  const { data, isLoading, isError } = useCaseDiff(caseId);
  if (isLoading) return <LoadingBlock label="Loading case" />;
  if (isError) return <ErrorBlock label="Could not load this case" />;
  if (!data) return <EmptyBlock label="Case not found." />;
  return (
    <>
      <div className="px-4 pt-3" style={{ fontSize: 12, color: UI.weakest }}>
        Last calibrated {formatRelative(data.calibratedAt)}
      </div>
      <CaseDiff diff={data} />
    </>
  );
}
