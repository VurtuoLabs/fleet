import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Badge / Tag - the rounded pill used for status, severity, and change kinds.
 * `tone` picks the semantic color; `solid` fills it (used for the Critical /
 * open-findings emphasis in the mockup). Soft is the default: tinted bg,
 * colored text, hairline ring.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full text-[11px] font-semibold leading-none",
  {
    variants: {
      tone: {
        primary: "",
        accent: "",
        success: "",
        warning: "",
        destructive: "",
        muted: "",
      },
      solid: { true: "text-white", false: "" },
      size: {
        default: "px-2 py-1",
        sm: "px-1.5 py-0.5 text-[10px]",
      },
    },
    compoundVariants: [
      // Soft (default) - tinted background + colored text + ring.
      { tone: "primary", solid: false, class: "bg-primary/10 text-primary ring-1 ring-inset ring-primary/30" },
      { tone: "accent", solid: false, class: "bg-accent/10 text-accent ring-1 ring-inset ring-accent/30" },
      { tone: "success", solid: false, class: "bg-success/10 text-success ring-1 ring-inset ring-success/30" },
      { tone: "warning", solid: false, class: "bg-warning/10 text-warning ring-1 ring-inset ring-warning/30" },
      { tone: "destructive", solid: false, class: "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/30" },
      { tone: "muted", solid: false, class: "bg-muted text-muted-foreground ring-1 ring-inset ring-border" },
      // Solid.
      { tone: "primary", solid: true, class: "bg-primary" },
      { tone: "accent", solid: true, class: "bg-accent" },
      { tone: "success", solid: true, class: "bg-success" },
      { tone: "warning", solid: true, class: "bg-warning" },
      { tone: "destructive", solid: true, class: "bg-destructive" },
      { tone: "muted", solid: true, class: "bg-muted-foreground" },
    ],
    defaultVariants: { tone: "muted", solid: false, size: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Show a leading status dot in the current color. */
  dot?: boolean;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone, solid, size, dot, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ tone, solid, size }), className)}
      {...props}
    >
      {dot ? (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      ) : null}
      {children}
    </span>
  ),
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
