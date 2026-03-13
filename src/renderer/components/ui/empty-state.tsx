import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@renderer/lib/utils";
import { Button } from "./button";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "ghost" | "link";
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  size = "md",
}: EmptyStateProps) {
  const sizeClasses = {
    sm: {
      container: "py-4",
      iconWrapper: "h-8 w-8",
      icon: "h-4 w-4",
      title: "text-xs",
      description: "text-[10px]",
    },
    md: {
      container: "py-6",
      iconWrapper: "h-10 w-10",
      icon: "h-5 w-5",
      title: "text-sm",
      description: "text-xs",
    },
    lg: {
      container: "py-12",
      iconWrapper: "h-14 w-14",
      icon: "h-7 w-7",
      title: "text-base",
      description: "text-sm",
    },
  };

  const sizes = sizeClasses[size];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        sizes.container,
        className
      )}
    >
      <div
        className={cn(
          "mb-2 flex items-center justify-center rounded-lg bg-muted/30",
          sizes.iconWrapper
        )}
      >
        <Icon className={cn("text-muted-foreground/40", sizes.icon)} />
      </div>
      <p className={cn("font-medium text-muted-foreground", sizes.title)}>{title}</p>
      {description && (
        <p className={cn("mt-0.5 text-muted-foreground/60", sizes.description)}>{description}</p>
      )}
      {action && (
        <Button
          variant={action.variant || "link"}
          size="sm"
          onClick={action.onClick}
          className={cn("mt-2", action.variant === "link" && "h-auto p-0 text-[10px]")}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

interface EmptyStateDashedProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  className?: string;
}

export function EmptyStateDashed({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateDashedProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/20 bg-muted/5 py-8 text-center",
        className
      )}
    >
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-muted/30">
        <Icon className="h-5 w-5 text-muted-foreground/40" />
      </div>
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {description && <p className="mt-0.5 text-[10px] text-muted-foreground/60">{description}</p>}
      {action && (
        <Button
          variant={action.variant || "link"}
          size="sm"
          onClick={action.onClick}
          className={cn("mt-2", action.variant === "link" && "h-auto p-0 text-[10px]")}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
