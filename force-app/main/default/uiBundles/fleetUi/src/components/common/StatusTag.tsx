import { Badge } from "@/components/ui/badge";
import { STATUS } from "@/domain/labels";
import type { AgentStatus } from "@/domain/types";
import { cn } from "@/lib/utils";

const TONE: Record<AgentStatus, "success" | "warning" | "destructive"> = {
  true: "success",
  watch: "warning",
  drift: "destructive",
  quarantined: "destructive",
};

/** Agent status pill - dotted, tinted by Fleet_Agent__c.Status__c. */
export function StatusTag({
  status,
  className,
}: {
  status: AgentStatus;
  className?: string;
}) {
  return (
    <Badge tone={TONE[status]} dot className={cn("font-head", className)}>
      {STATUS[status].label}
    </Badge>
  );
}
