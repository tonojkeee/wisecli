import * as React from "react";
import { cn } from "@renderer/lib/utils";
import { Button } from "./button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class ErrorBoundaryClass extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);

    // Log error to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("ErrorBoundary caught an error:", error, errorInfo);
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  onRetry: () => void;
  className?: string;
}

function ErrorFallback({ error, errorInfo, onRetry, className }: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = React.useState(false);

  const handleReportIssue = (): void => {
    const title = encodeURIComponent(`Error: ${error?.message || "Unknown error"}`);
    const body = encodeURIComponent(
      `## Error Details\n\n**Message:** ${error?.message || "Unknown"}\n\n**Stack:**\n\`\`\`\n${error?.stack || "No stack trace available"}\n\`\`\`\n\n**Component Stack:**\n\`\`\`\n${errorInfo?.componentStack || "No component stack available"}\n\`\`\``
    );
    window.open(
      `https://github.com/anthropics/claude-code/issues/new?title=${title}&body=${body}`,
      "_blank"
    );
  };

  return (
    <div
      className={cn(
        "flex min-h-[200px] w-full flex-col items-center justify-center p-6",
        className
      )}
    >
      <div className="w-full max-w-md space-y-4 rounded-lg border border-destructive/20 bg-card p-6 text-center shadow-lg">
        {/* Error Icon */}
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <svg
            className="h-6 w-6 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Error Title */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">Something went wrong</h3>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. Please try again or report the issue.
          </p>
        </div>

        {/* Error Message Preview */}
        {error && (
          <div className="rounded-md bg-destructive/5 p-3">
            <p className="font-mono text-xs text-destructive break-all">{error.message}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button variant="default" onClick={onRetry}>
            Try Again
          </Button>
          <Button variant="outline" onClick={handleReportIssue}>
            Report Issue
          </Button>
        </div>

        {/* Toggle Details */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
        >
          {showDetails ? "Hide" : "Show"} technical details
        </button>

        {/* Technical Details */}
        {showDetails && (
          <div className="mt-4 space-y-2 text-left">
            <div className="rounded-md bg-muted/50 p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Stack Trace:</p>
              <pre className="max-h-32 overflow-auto font-mono text-xs text-foreground/80 whitespace-pre-wrap break-all">
                {error?.stack || "No stack trace available"}
              </pre>
            </div>
            {errorInfo?.componentStack && (
              <div className="rounded-md bg-muted/50 p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Component Stack:</p>
                <pre className="max-h-32 overflow-auto font-mono text-xs text-foreground/80 whitespace-pre-wrap break-all">
                  {errorInfo.componentStack}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Error Boundary component that catches JavaScript errors in child components.
 * Displays a fallback UI with error details, retry button, and issue reporting link.
 *
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export const ErrorBoundary = ErrorBoundaryClass;

/**
 * Higher-Order Component that wraps a component with an ErrorBoundary.
 *
 * @example
 * ```tsx
 * const SafeComponent = withErrorBoundary(RiskyComponent)
 *
 * // With custom error handler
 * const SafeComponent = withErrorBoundary(RiskyComponent, {
 *   onError: (error, errorInfo) => logError(error)
 * })
 * ```
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, "children">
): React.FC<P> {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || "Component"})`;

  return WrappedComponent;
}

export { ErrorFallback };
export type { ErrorBoundaryProps, ErrorFallbackProps };
