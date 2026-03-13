import React from "react";
import { cn } from "@renderer/lib/utils";

interface SidebarHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
}

export function SidebarHeader({ title, subtitle, children, className }: SidebarHeaderProps) {
  return (
    <div
      className={cn(
        "sticky top-0 z-10 flex items-center justify-between",
        "px-3 py-3 border-b border-border",
        "bg-background",
        className
      )}
    >
      <div className="flex-1 min-w-0">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">{subtitle}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-1 ml-2 shrink-0">{children}</div>}
    </div>
  );
}
