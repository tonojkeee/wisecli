import * as React from "react";
import { cn } from "@renderer/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "success" | "warning" | "error" | "info" | "outline";
  size?: "default" | "sm" | "lg";
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          {
            "border-transparent bg-primary text-primary-foreground hover:bg-primary/80":
              variant === "default",
            "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80":
              variant === "secondary",
            "border-transparent bg-status-success/10 text-status-success hover:bg-status-success/20":
              variant === "success",
            "border-transparent bg-status-warning/10 text-status-warning hover:bg-status-warning/20":
              variant === "warning",
            "border-transparent bg-status-error/10 text-status-error hover:bg-status-error/20":
              variant === "error",
            "border-transparent bg-status-info/10 text-status-info hover:bg-status-info/20":
              variant === "info",
            "text-foreground": variant === "outline",
          },
          {
            "text-xs px-2 py-0.5": size === "sm",
            "text-sm px-3 py-1": size === "lg",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge };
