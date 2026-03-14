import * as React from "react";
import { cn } from "@renderer/lib/utils";

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "vertical" | "horizontal" | "both";
  ref?: React.Ref<HTMLDivElement>;
}

const ScrollArea = ({
  className,
  children,
  orientation = "vertical",
  ref,
  ...props
}: ScrollAreaProps) => (
  <div
    ref={ref}
    className={cn(
      "relative",
      orientation === "vertical" && "overflow-y-auto overflow-x-hidden",
      orientation === "horizontal" && "overflow-x-auto overflow-y-hidden",
      orientation === "both" && "overflow-auto",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export { ScrollArea };
