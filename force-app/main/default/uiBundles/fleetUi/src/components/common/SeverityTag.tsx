import { Badge } from "@/components/ui/badge";
import { SEVERITY } from "@/domain/labels";
import type { FindingSeverity } from "@/domain/types";
import { cn } from "@/lib/utils";

const TONE: Record<FindingSeverity, "destructive" | "warning" | "muted"> = {
  Critical: "destructive",
  Elevated: "warning",
  Advisory: "muted",
};

/** Severity chip - Critical is solid rose, the rest are tinted. */
export function SeverityTag({
  severity,
  className,
}: {
  severity: FindingSeverity;
  className?: string;
}) {
  return (
    <Badge
      tone={TONE[severity]}
      solid={SEVERITY[severity].solid}
      className={cn("font-head", className)}
    >
      {SEVERITY[severity].label}
    </Badge>
  );
}
