import type { ReactNode } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TruenessScore } from "@/components/common/TruenessScore";
import { useRun, useBlessBaseline } from "@/hooks";
import { TRIGGER_SOURCE } from "@/domain/labels";
import { credits as fmtCredits, dateTime, ratio } from "@/lib/format";

/**
 * Run detail (route /runs/:runId). App-level page - there is no dedicated runs
 * feature module; the calibration run is a rollup surface, so it reads through
 * the calibration facade and offers Bless-baseline (Fleet_Bless_Baseline).
 */
export default function RunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const { data: run, isLoading, isError } = useRun(runId);
  const bless = useBlessBaseline();

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }
  if (isError || !run) {
    return (
      <Card>
        <CardContent className="text-sm text-muted-foreground">
          Could not load this calibration run.
        </CardContent>
      </Card>
    );
  }

  const stats: Array<{ label: string; value: ReactNode; mono?: boolean }> = [
    { label: "Trigger", value: TRIGGER_SOURCE[run.triggerSource] },
    { label: "Status", value: run.status },
    { label: "Cases passed", value: ratio(run.casesPassed, run.casesTotal), mono: true },
    { label: "Cases failed", value: String(run.casesFailed), mono: true },
    { label: "Judge invocations", value: String(run.judgeInvocations ?? 0), mono: true },
    { label: "Prefilter skips", value: String(run.prefilterSkips ?? 0), mono: true },
    { label: "Credits consumed", value: fmtCredits(run.creditsConsumed), mono: true },
    { label: "Completed", value: dateTime(run.completedAt ?? run.startedAt) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-head text-xl font-semibold tracking-tight text-foreground">
            {run.agentName}
          </h1>
          <span className="font-mono text-xs text-muted-foreground">{run.runKey}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/agents/${run.agentId}`}>
            <Button variant="neutral">Back to agent</Button>
          </Link>
          <Button
            disabled={bless.isPending}
            onClick={() => bless.mutate(run.id)}
          >
            {bless.isPending ? "Blessing…" : "Bless as baseline"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run summary</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Trueness</span>
            <TruenessScore value={run.truenessScore} size={20} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </div>
                <div
                  className={s.mono ? "font-mono text-sm text-foreground" : "text-sm text-foreground"}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>
          {bless.isSuccess && (
            <div className="mt-4">
              <Badge tone="success">Baseline blessed to {run.agentName}</Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
