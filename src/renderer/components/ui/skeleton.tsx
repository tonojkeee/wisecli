import * as React from "react";
import { cn } from "@renderer/lib/utils";

type SkeletonVariant = "text" | "circular" | "rectangular";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The variant of the skeleton
   * @default 'text'
   */
  variant?: SkeletonVariant;
  /**
   * Width of the skeleton (CSS value)
   */
  width?: string | number;
  /**
   * Height of the skeleton (CSS value)
   */
  height?: string | number;
  /**
   * Additional animation class
   */
  animation?: "pulse" | "wave" | "none";
}

/**
 * Skeleton component for displaying loading placeholders.
 * Supports text, circular, and rectangular variants with pulse animation.
 *
 * @example
 * ```tsx
 * // Text skeleton
 * <Skeleton variant="text" className="w-full h-4" />
 *
 * // Avatar skeleton
 * <Skeleton variant="circular" width={40} height={40} />
 *
 * // Card skeleton
 * <Skeleton variant="rectangular" className="w-full h-32" />
 * ```
 */
function Skeleton({
  variant = "text",
  width,
  height,
  animation = "pulse",
  className,
  style,
  ...props
}: SkeletonProps) {
  const baseClasses = "bg-muted";

  const animationClasses = {
    pulse: "animate-pulse",
    wave: "animate-shimmer",
    none: "",
  };

  const variantClasses: Record<SkeletonVariant, string> = {
    text: "rounded",
    circular: "rounded-full",
    rectangular: "rounded-md",
  };

  const dimensionStyle: React.CSSProperties = {
    ...style,
    width: width !== undefined ? (typeof width === "number" ? `${width}px` : width) : undefined,
    height:
      height !== undefined ? (typeof height === "number" ? `${height}px` : height) : undefined,
  };

  // For circular variant, ensure width and height match if only one is provided
  if (variant === "circular") {
    if (width && !height) {
      dimensionStyle.height = typeof width === "number" ? `${width}px` : width;
    } else if (height && !width) {
      dimensionStyle.width = typeof height === "number" ? `${height}px` : height;
    }
  }

  return (
    <div
      className={cn(baseClasses, animationClasses[animation], variantClasses[variant], className)}
      style={dimensionStyle}
      aria-hidden="true"
      {...props}
    />
  );
}

/**
 * SkeletonText component for multi-line text placeholders.
 *
 * @example
 * ```tsx
 * <SkeletonText lines={3} />
 * ```
 */
function SkeletonText({
  lines = 3,
  lineHeight = 16,
  lineHeightLast = "60%",
  className,
  ...props
}: SkeletonProps & {
  /**
   * Number of lines to display
   * @default 3
   */
  lines?: number;
  /**
   * Height of each line in pixels
   * @default 16
   */
  lineHeight?: number;
  /**
   * Width of the last line (CSS value or percentage string)
   * @default '60%'
   */
  lineHeightLast?: string | number;
}) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          variant="text"
          height={lineHeight}
          width={index === lines - 1 ? lineHeightLast : "100%"}
        />
      ))}
    </div>
  );
}

/**
 * SkeletonAvatar component for avatar placeholders.
 *
 * @example
 * ```tsx
 * <SkeletonAvatar size="md" />
 * ```
 */
function SkeletonAvatar({
  size = "md",
  className,
  ...props
}: Omit<SkeletonProps, "variant"> & {
  /**
   * Size of the avatar
   * @default 'md'
   */
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const sizeMap = {
    sm: 32,
    md: 40,
    lg: 48,
    xl: 64,
  };

  return (
    <Skeleton
      variant="circular"
      width={sizeMap[size]}
      height={sizeMap[size]}
      className={className}
      {...props}
    />
  );
}

/**
 * SkeletonCard component for card placeholders.
 *
 * @example
 * ```tsx
 * <SkeletonCard />
 * ```
 */
function SkeletonCard({
  showHeader = true,
  showFooter = false,
  lines = 3,
  className,
  ...props
}: Omit<SkeletonProps, "variant"> & {
  /**
   * Show header with avatar and title
   * @default true
   */
  showHeader?: boolean;
  /**
   * Show footer
   * @default false
   */
  showFooter?: boolean;
  /**
   * Number of content lines
   * @default 3
   */
  lines?: number;
}) {
  return (
    <div className={cn("rounded-lg border bg-card p-4 space-y-4", className)} {...props}>
      {showHeader && (
        <div className="flex items-center space-x-3">
          <SkeletonAvatar size="sm" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" width="40%" height={14} />
            <Skeleton variant="text" width="25%" height={12} />
          </div>
        </div>
      )}
      <SkeletonText lines={lines} lineHeight={14} />
      {showFooter && (
        <div className="flex justify-end space-x-2 pt-2">
          <Skeleton variant="rectangular" width={64} height={32} />
          <Skeleton variant="rectangular" width={64} height={32} />
        </div>
      )}
    </div>
  );
}

export { Skeleton, SkeletonText, SkeletonAvatar, SkeletonCard };
export type { SkeletonProps, SkeletonVariant };
