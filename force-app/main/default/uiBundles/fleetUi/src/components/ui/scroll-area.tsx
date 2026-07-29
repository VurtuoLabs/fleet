import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * ScrollArea - a lightweight overflow container using the Fleet thin scrollbar
 * (see .fleet-scroll in globals.css). Kept dependency-free (no radix scroll-area
 * in the bundle) so the telemetry lists scroll consistently in light and dark.
 */
export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Constrain the height; overflow scrolls within. */
  viewportClassName?: string;
}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, viewportClassName, children, ...props }, ref) => (
    <div ref={ref} className={cn("relative", className)} {...props}>
      <div className={cn("fleet-scroll h-full w-full overflow-auto", viewportClassName)}>
        {children}
      </div>
    </div>
  ),
);
ScrollArea.displayName = "ScrollArea";

export { ScrollArea };
