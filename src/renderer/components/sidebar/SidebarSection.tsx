import React from "react";
import { cn } from "@renderer/lib/utils";

interface SidebarSectionProps {
  children: React.ReactNode;
  className?: string;
  isActive?: boolean;
}

export function SidebarSection({ children, className, isActive = true }: SidebarSectionProps) {
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden",
        !isActive && "hidden",
        className
      )}
    >
      {children}
    </div>
  );
}
