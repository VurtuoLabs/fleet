/**
 * AttributionPage - change detail + correlated deviation + blast radius.
 *
 * A ledger of change events (Deploy / Knowledge / Model / Prompt) on the left;
 * selecting one - or arriving with ?change=<id> from the drift rail or a
 * finding - shows what was modified, which agents went out of true inside the
 * correlation window, and the blast radius of reverting it.
 *
 * Data seam:
 *   useChangeEvents(72)          → ChangeEventView[]
 *   useAttribution(changeId)     → AttributionResult
 *     { change, confidence, correlatedDeviations[], blastRadius[], note? }
 */
import { useSearchParams } from "react-router-dom";
import { UI, HEAD, MONO, R } from "@/features/shared/tokens";
import { changeKindMeta, formatRelative, formatDateTime } from "@/features/shared/meta";
import {
  Panel,
  PanelHead,
  PageTitle,
  Tag,
  SectionLabel,
  LoadingBlock,
  ErrorBlock,
  EmptyBlock,
} from "@/features/shared/ui";
import { useChangeEvents, useAttribution } from "@/hooks";
import type { ChangeEventView, CorrelatedDeviation } from "@/domain/types";

export default function AttributionPage() {
  const [params, setParams] = useSearchParams();
  const changeParam = params.get("change");
  const { data, isLoading, isError } = useChangeEvents(72);
  const changes = data ?? [];

  const selectedId = changeParam ?? changes[0]?.id ?? null;
  const select = (id: string) => setParams({ change: id }, { replace: true });

  return (
    <div className="flex flex-col gap-4">
      <PageTitle title="Attribution" subtitle="What changed, and what went out of true because of it." />

      <div className="flex gap-4 items-start">
        {/* change ledger */}
        <div style={{ width: 320, flexShrink: 0 }}>
          <Panel>
            <PanelHead title="Change ledger" right={<span style={{ fontSize: 12, color: UI.weakest }}>72h</span>} />
            {isLoading ? (
              <LoadingBlock label="Loading changes" />
            ) : isError ? (
              <ErrorBlock label="Could not load change ledger" />
            ) : changes.length === 0 ? (
              <EmptyBlock label="No change events in the window." />
            ) : (
              changes.map((c) => (
                <ChangeRow
                  key={c.id}
                  change={c}
                  selected={c.id === selectedId}
                  onSelect={() => select(c.id)}
                />
              ))
            )}
          </Panel>
        </div>

        {/* detail */}
        <div className="flex-1" style={{ minWidth: 0 }}>
          <Panel>
            {selectedId ? (
              <AttributionDetail changeId={selectedId} />
            ) : (
              <EmptyBlock label="Select a change to see the correlated deviation and blast radius." />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ChangeRow({
  change,
  selected,
  onSelect,
}: {
  change: ChangeEventView;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = changeKindMeta(change.kind);
  return (
    <button
      onClick={onSelect}
      className="w-full text-left px-4 py-3"
      style={{
        borderBottom: `1px solid ${UI.border}`,
        borderLeft: selected ? `3px solid ${meta.color}` : "3px solid transparent",
        background: selected ? "#E8F1F0" : "transparent",
        cursor: "pointer",
        display: "block",
      }}
    >
      <div className="flex items-center gap-2">
        <Tag color={meta.color}>{change.kind}</Tag>
        <span style={{ fontSize: 11.5, color: UI.weakest }}>{formatRelative(change.occurredAt)}</span>
      </div>
      <div style={{ fontSize: 13, color: UI.text, marginTop: 6 }}>{change.label}</div>
      <div style={{ fontSize: 11.5, color: UI.weakest, marginTop: 2 }}>{change.actor}</div>
    </button>
  );
}

function AttributionDetail({ changeId }: { changeId: string }) {
  const { data, isLoading, isError } = useAttribution(changeId);
  if (isLoading) return <LoadingBlock label="Correlating" />;
  if (isError) return <ErrorBlock label="Could not correlate this change" />;
  if (!data) return <EmptyBlock label="Nothing to correlate." />;

  const { change, correlatedDeviations, blastRadius, confidence, note } = data;
  const meta = changeKindMeta(change.kind);

  return (
    <div className="p-4">
      <div className="flex items-center gap-2">
        <Tag color={meta.color}>{change.kind}</Tag>
        <span style={{ fontSize: 12.5, color: UI.weakest }}>
          {change.actor} · {formatRelative(change.occurredAt)}
        </span>
        <span style={{ fontSize: 11.5, color: UI.weakest }} title={formatDateTime(change.occurredAt)}>
          · {Math.round(confidence * 100)}% attribution confidence
        </span>
      </div>

      <div
        style={{
          fontFamily: HEAD,
          fontSize: 18,
          fontWeight: 600,
          color: UI.text,
          marginTop: 8,
          letterSpacing: "-0.01em",
        }}
      >
        {change.label}
      </div>
      <div style={{ fontSize: 13.5, color: UI.weak, marginTop: 8, lineHeight: 1.6 }}>{change.detail}</div>

      {/* correlated deviation */}
      <div className="mt-5">
        <div style={{ marginBottom: 8 }}>
          <SectionLabel>Correlated deviation</SectionLabel>
        </div>
        {correlatedDeviations.length === 0 ? (
          <div
            style={{
              background: `${UI.success}0F`,
              border: `1px solid ${UI.success}40`,
              borderRadius: R,
              padding: 12,
              fontSize: 13,
              color: UI.text,
            }}
          >
            No agent went out of true within the correlation window. Nothing to act on.
          </div>
        ) : (
          correlatedDeviations.map((d) => <DeviationRow key={d.agentId} dev={d} />)
        )}
      </div>

      {/* blast radius */}
      <div className="mt-5">
        <div style={{ marginBottom: 8 }}>
          <SectionLabel>Blast radius</SectionLabel>
        </div>
        <div className="flex flex-wrap gap-2">
          {blastRadius.map((d) => (
            <span
              key={d}
              style={{
                fontSize: 12,
                color: UI.weak,
                background: UI.page,
                border: `1px solid ${UI.border}`,
                borderRadius: R,
                padding: "5px 9px",
                fontFamily: MONO,
              }}
            >
              {d}
            </span>
          ))}
        </div>
        <div style={{ fontSize: 12.5, color: UI.weak, marginTop: 10, lineHeight: 1.5 }}>
          {note ?? "Reverting this change affects everything listed. Review before approving a rollback."}
        </div>
      </div>
    </div>
  );
}

function DeviationRow({ dev }: { dev: CorrelatedDeviation }) {
  return (
    <div
      style={{
        border: `1px solid ${UI.border}`,
        borderLeft: `3px solid ${UI.error}`,
        borderRadius: R,
        padding: 12,
        marginBottom: 8,
      }}
    >
      <div style={{ fontSize: 13.5, fontWeight: 600, color: UI.text }}>{dev.agentName}</div>
      <div style={{ fontSize: 12.5, color: UI.error, marginTop: 3 }}>
        {dev.casesFailing} of {dev.casesTotal} golden cases failing
      </div>
    </div>
  );
}
