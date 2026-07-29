import { statusFromTrueness, STATUS } from "@/domain/labels";
import { trueness as fmtTrueness } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * TruenessScore - the 0..100 score in JetBrains Mono, colored by the band it
 * falls in (in-true green, watch amber, out-of-true rose). The single metric
 * the console leads with.
 */
export function TruenessScore({
  value,
  size = 15,
  quarantined = false,
  className,
}: {
  value: number | null | undefined;
  size?: number;
  quarantined?: boolean;
  className?: string;
}) {
  const status = statusFromTrueness(value ?? 0, quarantined);
  return (
    <span
      className={cn("font-mono font-medium tabular-nums", className)}
      style={{ color: STATUS[status].hex, fontSize: size }}
      title={`${STATUS[status].label} · trueness ${fmtTrueness(value)}`}
    >
      {fmtTrueness(value)}
    </span>
  );
}
