/**
 * CaseDiff - baseline vs current response for one golden case.
 *
 * Renders the captured utterance, the blessed baseline response and the current
 * response side by side with the differing spans highlighted inline, the
 * grounding delta (which KB sources were kept vs dropped), and the pass/fail
 * assertion list. This is the same layout as the mockup's Case diff tab.
 *
 * `CaseDiff` is pure and takes a `CaseDiffView` - it renders with no hooks so
 * it is trivially testable. The default export is the route wrapper that
 * fetches via useCaseDiff(caseId).
 */
import { useParams } from "react-router-dom";
import { UI, HEAD, MONO, R } from "@/features/shared/tokens";
import { Panel, Tag, SectionLabel, LoadingBlock, ErrorBlock, EmptyBlock } from "@/features/shared/ui";
import { useCaseDiff } from "@/hooks";
import type { CaseDiffView, DiffSegment } from "@/domain/types";

/* ----------------------------- presentational ---------------------------- */

export function CaseDiff({ diff }: { diff: CaseDiffView }) {
  const failing = diff.assertions.filter((a) => !a.passed).length;

  return (
    <div className="p-4" data-testid="case-diff">
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontFamily: MONO, fontSize: 12.5, color: UI.brandDark }}>{diff.caseKey}</span>
        <Tag color={failing ? UI.error : UI.success}>
          {failing ? `${failing} assertion${failing === 1 ? "" : "s"} failing` : "All assertions passing"}
        </Tag>
      </div>

      {/* utterance */}
      <div
        style={{
          background: UI.page,
          border: `1px solid ${UI.border}`,
          borderRadius: R,
          padding: 12,
          marginBottom: 14,
        }}
      >
        <div style={{ marginBottom: 5 }}>
          <SectionLabel>Utterance</SectionLabel>
        </div>
        <div style={{ fontSize: 13.5, color: UI.text }}>{diff.utterance}</div>
      </div>

      {/* baseline vs current */}
      <div className="grid grid-cols-2 gap-4">
        <ResponseBlock
          label="Baseline"
          tag={`${diff.baselineVersion} blessed`}
          tint={UI.success}
          segments={diff.baseline}
        />
        <ResponseBlock label="Current" tag={diff.currentVersion} tint={UI.error} segments={diff.current} />
      </div>

      {/* grounding + assertions */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        <GroundingDelta baseline={diff.grounding.baseline} current={diff.grounding.current} />
        <Assertions items={diff.assertions} />
      </div>
    </div>
  );
}

function ResponseBlock({
  label,
  tag,
  tint,
  segments,
}: {
  label: string;
  tag: string;
  tint: string;
  segments: DiffSegment[];
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <SectionLabel>{label}</SectionLabel>
        <Tag color={tint}>{tag}</Tag>
      </div>
      <div
        data-testid={`response-${label.toLowerCase()}`}
        style={{
          background: UI.page,
          border: `1px solid ${UI.border}`,
          borderRadius: R,
          padding: 12,
          fontSize: 13.5,
          lineHeight: 1.65,
          color: UI.text,
        }}
      >
        {segments.map((seg, i) => (
          <span
            key={i}
            data-changed={seg.changed ? "true" : undefined}
            style={
              seg.changed
                ? { background: `${tint}26`, borderBottom: `2px solid ${tint}`, padding: "1px 2px" }
                : undefined
            }
          >
            {seg.text}
          </span>
        ))}
      </div>
    </div>
  );
}

function GroundingDelta({ baseline, current }: { baseline: string[]; current: string[] }) {
  const dropped = baseline.filter((g) => !current.includes(g));
  const added = current.filter((g) => !baseline.includes(g));
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <SectionLabel>Grounding delta</SectionLabel>
      </div>
      <div className="flex flex-wrap gap-2">
        {baseline.map((g) => {
          const kept = current.includes(g);
          return (
            <span
              key={g}
              data-testid={`grounding-${g}`}
              data-kept={kept ? "true" : "false"}
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
        {added.map((g) => (
          <span
            key={g}
            data-testid={`grounding-${g}`}
            data-added="true"
            style={{
              fontFamily: MONO,
              fontSize: 12,
              padding: "5px 9px",
              borderRadius: R,
              color: UI.accent,
              background: `${UI.accent}14`,
              border: `1px solid ${UI.accent}59`,
            }}
          >
            +{g}
          </span>
        ))}
      </div>
      {dropped.length > 0 && (
        <div style={{ fontSize: 12.5, color: UI.weak, marginTop: 10, lineHeight: 1.5 }}>
          {dropped.join(", ")} {dropped.length === 1 ? "is" : "are"} no longer retrieved.
        </div>
      )}
    </div>
  );
}

function Assertions({ items }: { items: CaseDiffView["assertions"] }) {
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <SectionLabel>Assertions</SectionLabel>
      </div>
      {items.map((a) => (
        <div
          key={a.label}
          data-testid={`assertion-${a.passed ? "pass" : "fail"}`}
          className="flex items-center gap-2 py-1.5"
          style={{ borderBottom: `1px solid ${UI.border}` }}
        >
          <span style={{ color: a.passed ? UI.success : UI.error, fontSize: 13, width: 14, fontWeight: 700 }}>
            {a.passed ? "✓" : "✕"}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 11.5, color: a.passed ? UI.weak : UI.text }}>{a.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------- route ----------------------------------- */

export default function CaseDiffRoute() {
  const { caseId } = useParams<{ caseId: string }>();
  const { data, isLoading, isError } = useCaseDiff(caseId);

  return (
    <Panel>
      <div className="px-4 py-3" style={{ borderBottom: `1px solid ${UI.border}` }}>
        <h2 style={{ fontFamily: HEAD, fontSize: 15, fontWeight: 600, color: UI.text, margin: 0 }}>
          Case diff
        </h2>
      </div>
      {isLoading ? (
        <LoadingBlock label="Loading case" />
      ) : isError ? (
        <ErrorBlock label="Could not load this case" />
      ) : !data ? (
        <EmptyBlock label="Case not found." />
      ) : (
        <CaseDiff diff={data} />
      )}
    </Panel>
  );
}
