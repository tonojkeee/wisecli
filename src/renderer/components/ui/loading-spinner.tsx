import * as React from "react";
import { cn } from "@renderer/lib/utils";

type SpinnerSize = "sm" | "md" | "lg";

interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Size of the spinner
   * @default 'md'
   */
  size?: SpinnerSize;
  /**
   * Optional text label to display below the spinner
   */
  label?: string;
  /**
   * Position of the label relative to spinner
   * @default 'bottom'
   */
  labelPosition?: "bottom" | "right";
}

const sizeConfig: Record<SpinnerSize, { spinner: number; border: number; text: string }> = {
  sm: { spinner: 16, border: 2, text: "text-xs" },
  md: { spinner: 24, border: 3, text: "text-sm" },
  lg: { spinner: 32, border: 4, text: "text-base" },
};

/**
 * LoadingSpinner component for displaying loading states.
 * Supports multiple sizes and optional text label.
 *
 * @example
 * ```tsx
 * // Basic spinner
 * <LoadingSpinner />
 *
 * // Small spinner with label
 * <LoadingSpinner size="sm" label="Loading..." />
 *
 * // Large spinner with label on right
 * <LoadingSpinner size="lg" label="Processing" labelPosition="right" />
 * ```
 */
function LoadingSpinner({
  size = "md",
  label,
  labelPosition = "bottom",
  className,
  ...props
}: LoadingSpinnerProps) {
  const config = sizeConfig[size];

  const spinnerElement = (
    <div
      className="animate-spin rounded-full border-primary border-t-transparent"
      style={{
        width: config.spinner,
        height: config.spinner,
        borderWidth: config.border,
      }}
      role="status"
      aria-label={label || "Loading"}
    />
  );

  if (!label) {
    return (
      <div className={cn("inline-flex", className)} {...props}>
        {spinnerElement}
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  const labelElement = <span className={cn("text-muted-foreground", config.text)}>{label}</span>;

  return (
    <div
      className={cn(
        "inline-flex items-center",
        labelPosition === "bottom" ? "flex-col gap-2" : "flex-row gap-2",
        className
      )}
      {...props}
    >
      {spinnerElement}
      {labelElement}
    </div>
  );
}

/**
 * FullPageLoading component for full-page loading states.
 *
 * @example
 * ```tsx
 * <FullPageLoading label="Loading application..." />
 * ```
 */
function FullPageLoading({
  label = "Loading...",
  size = "lg",
  className,
  ...props
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        "flex min-h-screen w-full items-center justify-center bg-background",
        className
      )}
      {...props}
    >
      <LoadingSpinner size={size} label={label} />
    </div>
  );
}

/**
 * LoadingOverlay component for overlay loading states on containers.
 *
 * @example
 * ```tsx
 * <div className="relative">
 *   <Content />
 *   {isLoading && <LoadingOverlay label="Saving..." />}
 * </div>
 * ```
 */
function LoadingOverlay({ label, size = "md", className, ...props }: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm",
        className
      )}
      {...props}
    >
      <LoadingSpinner size={size} label={label} />
    </div>
  );
}

/**
 * LoadingDots component for inline loading indicators.
 *
 * @example
 * ```tsx
 * <LoadingDots />
 * ```
 */
function LoadingDots({
  size = "md",
  className,
  ...props
}: Omit<LoadingSpinnerProps, "label" | "labelPosition">) {
  const dotSize = size === "sm" ? "w-1.5 h-1.5" : size === "lg" ? "w-2.5 h-2.5" : "w-2 h-2";

  return (
    <span
      className={cn("inline-flex items-center gap-1", className)}
      role="status"
      aria-label="Loading"
      {...props}
    >
      <span
        className={cn("rounded-full bg-muted-foreground animate-bounce", dotSize)}
        style={{ animationDelay: "0ms" }}
      />
      <span
        className={cn("rounded-full bg-muted-foreground animate-bounce", dotSize)}
        style={{ animationDelay: "150ms" }}
      />
      <span
        className={cn("rounded-full bg-muted-foreground animate-bounce", dotSize)}
        style={{ animationDelay: "300ms" }}
      />
      <span className="sr-only">Loading</span>
    </span>
  );
}

/**
 * LoadingPulse component for pulsing loading indicators.
 *
 * @example
 * ```tsx
 * <LoadingPulse label="Connecting..." />
 * ```
 */
function LoadingPulse({ label, size = "md", className, ...props }: LoadingSpinnerProps) {
  const pulseSize = size === "sm" ? "w-3 h-3" : size === "lg" ? "w-6 h-6" : "w-4 h-4";
  const textSize = size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm";

  return (
    <div
      className={cn("inline-flex items-center gap-2", className)}
      role="status"
      aria-label={label || "Loading"}
      {...props}
    >
      <div className={cn("rounded-full bg-primary animate-pulse", pulseSize)} />
      {label && <span className={cn("text-muted-foreground", textSize)}>{label}</span>}
    </div>
  );
}

export { LoadingSpinner, FullPageLoading, LoadingOverlay, LoadingDots, LoadingPulse };
export type { LoadingSpinnerProps, SpinnerSize };
