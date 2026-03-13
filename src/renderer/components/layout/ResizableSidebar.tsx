import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@renderer/lib/utils";
import { Button } from "@renderer/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@renderer/components/ui/tooltip";

interface SidebarProps {
  children: React.ReactNode;
  width: number;
  collapsed: boolean;
  collapsedWidth: number;
  onToggleCollapse: () => void;
  className?: string;
}

export function ResizableSidebar({
  children,
  width,
  collapsed,
  collapsedWidth,
  onToggleCollapse,
  className,
}: SidebarProps) {
  const { t } = useTranslation("sidebar");
  const effectiveWidth = collapsed ? collapsedWidth : width;

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "group relative flex flex-col border-r border-border bg-background shadow-sm transition-[width] duration-200",
          className
        )}
        style={{ width: effectiveWidth }}
      >
        {/* Main content */}
        <div className="flex flex-1 w-full overflow-hidden">{children}</div>

        {/* Collapse/expand button */}
        <div className="absolute right-0 top-0 bottom-0 z-10 flex w-4 cursor-pointer items-center justify-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "absolute right-0.5 top-1/2 h-6 w-4 -translate-y-1/2 rounded-sm p-0 opacity-0 transition-opacity group-hover:opacity-100",
                  collapsed && "opacity-100"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapse();
                }}
              >
                {collapsed ? (
                  <ChevronRight className="h-3 w-3" />
                ) : (
                  <ChevronLeft className="h-3 w-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {collapsed ? t("expandSidebar") : t("collapseSidebar")}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
