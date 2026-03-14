import * as React from "react";
import { cn } from "@renderer/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "success" | "warning" | "error" | "info" | "outline";
  size?: "default" | "sm" | "lg";
  ref?: React.Ref<HTMLDivElement>;
}

const Badge = ({ className, variant = "default", size = "default", ref, ...props }: BadgeProps) => {
  return (
    <div
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        {
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80":
            variant === "default",
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80":
            variant === "secondary",
          "border-transparent bg-green-500 text-white hover:bg-green-500/80": variant === "success",
          "border-transparent bg-yellow-500 text-white hover:bg-yellow-500/80":
            variant === "warning",
          "border-transparent bg-red-500 text-white hover:bg-red-500/80": variant === "error",
          "border-transparent bg-blue-500 text-white hover:bg-blue-500/80": variant === "info",
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
};

export { Badge };
