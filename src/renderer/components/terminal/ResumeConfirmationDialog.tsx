import React from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw, Sparkles } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@renderer/components/ui/alert-dialog";

interface ResumeConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResume: () => void;
  onStartFresh: () => void;
}

export function ResumeConfirmationDialog({
  open,
  onOpenChange,
  onResume,
  onStartFresh,
}: ResumeConfirmationDialogProps) {
  const { t } = useTranslation("terminal");

  const handleResume = () => {
    onResume();
    onOpenChange(false);
  };

  const handleStartFresh = () => {
    onStartFresh();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-primary" />
            {t("resume.title")}
          </AlertDialogTitle>
          <AlertDialogDescription>{t("resume.description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={handleStartFresh}>
            <Sparkles className="mr-2 h-4 w-4" />
            {t("resume.startFresh")}
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleResume}>
            <RotateCcw className="mr-2 h-4 w-4" />
            {t("resume.resume")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Hook for imperative usage with async confirmation
interface ResumeConfirmState {
  open: boolean;
  resolver: ((value: boolean) => void) | null;
}

export function useResumeConfirmation(): [() => Promise<boolean>, () => React.ReactNode] {
  const [state, setState] = React.useState<ResumeConfirmState>({
    open: false,
    resolver: null,
  });

  const resolvedRef = React.useRef(false);

  const confirm = React.useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      resolvedRef.current = false;
      setState({
        open: true,
        resolver: resolve,
      });
    });
  }, []);

  const handleResume = React.useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    state.resolver?.(true);
    setState((prev) => ({ ...prev, open: false, resolver: null }));
  }, [state.resolver]);

  const handleStartFresh = React.useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    state.resolver?.(false);
    setState((prev) => ({ ...prev, open: false, resolver: null }));
  }, [state.resolver]);

  const Dialog = React.useCallback(() => {
    return (
      <ResumeConfirmationDialog
        open={state.open}
        onOpenChange={(open) => !open && handleStartFresh()}
        onResume={handleResume}
        onStartFresh={handleStartFresh}
      />
    );
  }, [state.open, handleResume, handleStartFresh]);

  return [confirm, Dialog];
}
