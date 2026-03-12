import React, { useCallback, useRef, useState, useEffect } from "react";
import { GripVertical, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@renderer/lib/utils";
import { Button } from "@renderer/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@renderer/components/ui/tooltip";

interface ResizableSidebarProps {
  children: React.ReactNode;
  width: number;
  collapsed: boolean;
  collapsedWidth: number;
  minWidth: number;
  maxWidth: number;
  onWidthChange: (width: number) => void;
  onToggleCollapse: () => void;
  className?: string;
}

export function ResizableSidebar({
  children,
  width,
  collapsed,
  collapsedWidth,
  minWidth: _minWidth,
  maxWidth: _maxWidth,
  onWidthChange,
  onToggleCollapse,
  className,
}: ResizableSidebarProps) {
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);

  const effectiveWidth = collapsed ? collapsedWidth : width;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (collapsed) return;
      e.preventDefault();
      setIsResizing(true);
    },
    [collapsed]
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX;
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, onWidthChange]);

  return (
    <div
      className={cn(
        "relative flex flex-col border-r border-border/50 bg-gradient-to-b from-background via-background to-muted/5 transition-[width] duration-200",
        className
      )}
      style={{ width: effectiveWidth }}
    >
      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">{children}</div>

      {/* Resize handle and collapse button */}
      <div
        ref={resizeRef}
        className={cn(
          "absolute right-0 top-0 bottom-0 z-10 flex w-1 cursor-col-resize items-center justify-center group",
          isResizing && "bg-primary/20",
          collapsed && "cursor-pointer"
        )}
        onMouseDown={handleMouseDown}
      >
        {/* Grip indicator */}
        {!collapsed && (
          <div
            className={cn(
              "absolute right-0 flex h-12 w-1 items-center justify-center rounded-l opacity-0 transition-opacity group-hover:opacity-100",
              isResizing ? "bg-primary/40" : "bg-border"
            )}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        )}

        {/* Collapse/expand button */}
        <TooltipProvider delayDuration={300}>
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
              {collapsed ? "Expand sidebar" : "Collapse sidebar"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
