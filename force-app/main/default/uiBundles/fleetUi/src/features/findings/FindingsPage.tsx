/**
 * FindingsPage - severity-colored deviation findings.
 *
 * Each card carries a severity chip (Critical solid rose, Elevated warning,
 * Advisory neutral), the headline and detail, the attributed cause (a change
 * event, click-through to Attribution), the agent action taken, and - when a
 * remediation is awaiting approval - Approve / Hold / View-trace controls. The
 * approve action goes through Apex (useApproveRemediation), which is the
 * permission-gated state transition.
 *
 * Data seam:
 *   useFindings(query?)        → FindingView[]
 *   useApproveRemediation()    → mutation({ remediationId }) (Apex, permission-gated)
 *   useRejectRemediation()     → mutation({ remediationId, reason }) (Apex)
 */
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { UI, R } from "@/features/shared/tokens";
import { severityMeta, formatRelative } from "@/features/shared/meta";
import {
  PageTitle,
  SeverityTag,
  Tag,
  Metric,
  SectionLabel,
  Action,
  LoadingBlock,
  ErrorBlock,
  EmptyBlock,
} from "@/features/shared/ui";
import { useFindings, useApproveRemediation, useRejectRemediation } from "@/hooks";
import type { FindingView } from "@/domain/types";

export default function FindingsPage() {
  const [openOnly, setOpenOnly] = React.useState(true);
  const { data, isLoading, isError } = useFindings(openOnly ? { openOnly: true } : undefined);
  const findings = [...(data ?? [])].sort(
    (a, b) => severityMeta(a.severity).rank - severityMeta(b.severity).rank,
  );

  return (
    <div className="flex flex-col gap-4">
      <PageTitle
        title="Findings"
        subtitle="Detected drift, attributed to a cause, with the action taken."
        right={
          <label className="flex items-center gap-2" style={{ fontSize: 12.5, color: UI.weak }}>
            <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
            Open only
          </label>
        }
      />

      {isLoading ? (
        <LoadingBlock label="Loading findings" />
      ) : isError ? (
        <ErrorBlock label="Could not load findings" />
      ) : findings.length === 0 ? (
        <EmptyBlock label="No findings. Every monitored agent is within tolerance." />
      ) : (
        <div className="flex flex-col gap-3">
          {findings.map((f) => (
            <FindingCard key={f.id} finding={f} />
          ))}
        </div>
      )}
    </div>
  );
}

export function FindingCard({ finding }: { finding: FindingView }) {
  const navigate = useNavigate();
  const approve = useApproveRemediation();
  const reject = useRejectRemediation();
  const sev = severityMeta(finding.severity);

  const rem = finding.remediation;
  const awaitingApproval = !!rem && rem.approvalState === "Pending_Approval";

  return (
    <div
      data-testid={`finding-${finding.id}`}
      style={{
        border: `1px solid ${UI.border}`,
        borderLeft: `3px solid ${sev.color}`,
        borderRadius: R,
        padding: 14,
        background: UI.surface,
      }}
    >
      {/* head */}
      <div className="flex items-start justify-between gap-3">
        <div style={{ minWidth: 0 }}>
          <div className="flex items-center gap-2 mb-1.5">
            <SeverityTag meta={sev} />
            <Metric color={UI.weakest} size={11.5}>
              {finding.findingNumber}
            </Metric>
            <span style={{ fontSize: 11.5, color: UI.weakest }}>· {formatRelative(finding.openedAt)}</span>
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: UI.text }}>{finding.headline}</div>
          <div style={{ fontSize: 12.5, color: UI.brand, marginTop: 3 }}>{finding.agentName}</div>
        </div>
        <span style={{ fontSize: 12, color: UI.weakest, whiteSpace: "nowrap" }}>
          {finding.casesFailing}/{finding.casesTotal} failing
        </span>
      </div>

      <div style={{ fontSize: 13, color: UI.weak, marginTop: 10, lineHeight: 1.6 }}>{finding.detail}</div>

      {/* attributed cause */}
      {finding.attributedChange && (
        <button
          onClick={() => navigate(`/attribution?change=${encodeURIComponent(finding.attributedChange!.changeEventId)}`)}
          className="w-full text-left mt-3"
          style={{
            background: UI.page,
            border: `1px solid ${UI.border}`,
            borderRadius: R,
            padding: "9px 11px",
            cursor: "pointer",
            display: "block",
          }}
        >
          <SectionLabel>Attributed cause</SectionLabel>
          <div className="flex items-center gap-2 mt-1">
            <span style={{ fontSize: 13, fontWeight: 500, color: UI.brand }}>
              {finding.attributedChange.label}
            </span>
            <span style={{ fontSize: 12, color: UI.weakest }}>
              · {finding.attributedChange.kind} by {finding.attributedChange.actor}
            </span>
            {typeof finding.attributionConfidence === "number" && (
              <span style={{ fontSize: 11.5, color: UI.weakest }}>
                · {Math.round(finding.attributionConfidence * 100)}% confidence
              </span>
            )}
          </div>
        </button>
      )}

      {/* agent action taken */}
      {finding.agentAction && (
        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${UI.border}` }}>
          <div style={{ marginBottom: 5 }}>
            <SectionLabel>Agent action taken</SectionLabel>
          </div>
          <div style={{ fontSize: 13, color: UI.weak, lineHeight: 1.6 }}>{finding.agentAction}</div>
        </div>
      )}

      {/* approval controls */}
      {awaitingApproval && rem && (
        <div className="mt-3">
          {approve.isError && (
            <div role="alert" style={{ fontSize: 12.5, color: UI.error, marginBottom: 8 }}>
              Could not approve. You may lack the Fleet_Approve_Remediation permission.
            </div>
          )}
          {approve.isSuccess ? (
            <Tag color={UI.success}>Rollback approved</Tag>
          ) : (
            <div className="flex gap-2">
              <Action
                variant="brand"
                disabled={approve.isPending}
                onClick={() => approve.mutate({ remediationId: rem.id })}
              >
                {approve.isPending ? "Approving…" : `Approve ${rem.actionLabel}`}
              </Action>
              <Action
                variant="danger"
                disabled={reject.isPending || approve.isPending}
                onClick={() => reject.mutate({ remediationId: rem.id, reason: "Held by reviewer" })}
              >
                Hold
              </Action>
              <Action variant="quiet" onClick={() => navigate(`/findings/${finding.id}`)}>
                View full trace
              </Action>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
