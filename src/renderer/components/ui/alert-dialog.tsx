import * as React from "react";
import { cn } from "@renderer/lib/utils";
import { Button, ButtonProps } from "./button";

// Context for managing alert dialog state
interface AlertDialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AlertDialogContext = React.createContext<AlertDialogContextValue | null>(null);

function useAlertDialogContext() {
  const context = React.useContext(AlertDialogContext);
  if (!context) {
    throw new Error("AlertDialog components must be used within an AlertDialog");
  }
  return context;
}

// Root AlertDialog component
interface AlertDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function AlertDialog({ open: controlledOpen, onOpenChange, children }: AlertDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const handleOpenChange = onOpenChange ?? setUncontrolledOpen;

  return (
    <AlertDialogContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
      {children}
    </AlertDialogContext.Provider>
  );
}

// Trigger button
interface AlertDialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

export const AlertDialogTrigger = ({
  asChild,
  children,
  onClick,
  ref,
  ...props
}: AlertDialogTriggerProps) => {
  const { onOpenChange } = useAlertDialogContext();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onOpenChange(true);
    onClick?.(e);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: typeof handleClick }>, {
      onClick: handleClick,
    });
  }

  return (
    <button ref={ref} onClick={handleClick} {...props}>
      {children}
    </button>
  );
};

// Modal content wrapper
interface AlertDialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  onOpenAutoFocus?: (e: Event) => void;
  onCloseAutoFocus?: (e: Event) => void;
  ref?: React.Ref<HTMLDivElement>;
}

export const AlertDialogContent = ({
  className,
  children,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ref,
  ...props
}: AlertDialogContentProps) => {
  const { open, onOpenChange } = useAlertDialogContext();
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useImperativeHandle(ref, () => contentRef.current as HTMLDivElement, []);

  React.useEffect(() => {
    if (open) {
      // Focus trap and auto-focus
      onOpenAutoFocus?.(new Event("focus"));
      contentRef.current?.focus();
    } else {
      onCloseAutoFocus?.(new Event("focus"));
    }
  }, [open, onOpenAutoFocus, onCloseAutoFocus]);

  // Handle escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      {/* Content */}
      <div
        ref={contentRef}
        role="alertdialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  );
};

// Header
export function AlertDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
  );
}

// Footer
export function AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
      {...props}
    />
  );
}

// Title
export function AlertDialogTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
  );
}

// Description
export function AlertDialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

// Action button (confirm)
interface AlertDialogActionProps extends ButtonProps {
  asChild?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

export const AlertDialogAction = ({
  className,
  onClick,
  ref,
  ...props
}: AlertDialogActionProps) => {
  const { onOpenChange } = useAlertDialogContext();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Call onClick first (for useConfirm to resolve with true)
    // before onOpenChange which might trigger handleCancel
    onClick?.(e);
    onOpenChange(false);
  };

  return <Button ref={ref} className={className} onClick={handleClick} {...props} />;
};

// Cancel button
interface AlertDialogCancelProps extends ButtonProps {
  asChild?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

export const AlertDialogCancel = ({
  className,
  onClick,
  ref,
  ...props
}: AlertDialogCancelProps) => {
  const { onOpenChange } = useAlertDialogContext();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onOpenChange(false);
    onClick?.(e);
  };

  return (
    <Button ref={ref} variant="outline" className={className} onClick={handleClick} {...props} />
  );
};

// Hook for imperative usage
interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  resolver: ((value: boolean) => void) | null;
}

export function useConfirm(): [
  (options: ConfirmOptions) => Promise<boolean>,
  () => React.ReactNode,
] {
  const [state, setState] = React.useState<ConfirmState>({
    open: false,
    title: "",
    description: "",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    destructive: false,
    resolver: null,
  });

  // Use a ref to track if already resolved
  const resolvedRef = React.useRef(false);

  const confirm = React.useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolvedRef.current = false; // Reset for new dialog
      setState({
        open: true,
        title: options.title,
        description: options.description,
        confirmLabel: options.confirmLabel || "Confirm",
        cancelLabel: options.cancelLabel || "Cancel",
        destructive: options.destructive || false,
        resolver: resolve,
      });
    });
  }, []);

  const handleConfirm = React.useCallback(() => {
    if (resolvedRef.current) return; // Already resolved
    resolvedRef.current = true;
    state.resolver?.(true);
    setState((prev) => ({ ...prev, open: false, resolver: null }));
  }, [state.resolver]);

  const handleCancel = React.useCallback(() => {
    if (resolvedRef.current) return; // Already resolved
    resolvedRef.current = true;
    state.resolver?.(false);
    setState((prev) => ({ ...prev, open: false, resolver: null }));
  }, [state.resolver]);

  const ConfirmDialog = React.useCallback(() => {
    return (
      <AlertDialog open={state.open} onOpenChange={(open) => !open && handleCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            {state.title && <AlertDialogTitle>{state.title}</AlertDialogTitle>}
            {state.description && (
              <AlertDialogDescription>{state.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>{state.cancelLabel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              variant={state.destructive ? "destructive" : "default"}
            >
              {state.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }, [state, handleConfirm, handleCancel]);

  return [confirm, ConfirmDialog];
}
