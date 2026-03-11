import React from "react";
import { useTranslation } from "react-i18next";
import { GitCommit, GitPullRequest, HelpCircle, Trash2 } from "lucide-react";
import { cn } from "@renderer/lib/utils";

interface Command {
  id: string;
  labelKey: string;
  command: string;
  icon: React.ReactNode;
  shortcut?: string;
  descriptionKey: string;
}

const COMMANDS: Command[] = [
  {
    id: "commit",
    labelKey: "commit.label",
    command: "/commit",
    icon: <GitCommit className="h-3 w-3" />,
    shortcut: "⌃⇧C",
    descriptionKey: "commit.description",
  },
  {
    id: "review-pr",
    labelKey: "reviewPr.label",
    command: "/review-pr",
    icon: <GitPullRequest className="h-3 w-3" />,
    shortcut: "⌃⇧R",
    descriptionKey: "reviewPr.description",
  },
  {
    id: "help",
    labelKey: "help.label",
    command: "/help",
    icon: <HelpCircle className="h-3 w-3" />,
    shortcut: "⌃⇧H",
    descriptionKey: "help.description",
  },
  {
    id: "clear",
    labelKey: "clear.label",
    command: "/clear",
    icon: <Trash2 className="h-3 w-3" />,
    shortcut: "⌃⇧L",
    descriptionKey: "clear.description",
  },
];

interface CommandPaletteProps {
  onCommand: (command: string) => void;
  disabled?: boolean;
  className?: string;
}

export function CommandPalette({ onCommand, disabled, className }: CommandPaletteProps) {
  const { t } = useTranslation("commands");

  return (
    <div className={cn("grid grid-cols-2 gap-1", className)}>
      {COMMANDS.map((cmd) => (
        <button
          key={cmd.id}
          onClick={() => onCommand(cmd.command)}
          disabled={disabled}
          className={cn(
            "group flex items-center gap-1.5 rounded-md border border-border/40 bg-muted/20 px-2.5 py-1.5",
            "text-left transition-all duration-150",
            "hover:bg-muted/40 hover:border-muted-foreground/20",
            "focus:outline-none focus:ring-1 focus:ring-primary/50",
            "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-muted/20",
            "active:scale-[0.98]"
          )}
          title={t(cmd.descriptionKey)}
        >
          <span className="text-muted-foreground transition-colors group-hover:text-foreground">
            {cmd.icon}
          </span>
          <span className="flex-1 text-[11px] font-medium">{t(cmd.labelKey)}</span>
          <span className="text-[8px] font-mono text-muted-foreground/50">{cmd.shortcut}</span>
        </button>
      ))}
    </div>
  );
}

// Hook for handling global shortcuts
export function useCommandShortcuts(callback: (command: string) => void, enabled: boolean = true) {
  React.useEffect(() => {
    if (!enabled) return;

    const unsubscribe = window.electronAPI.shortcuts.onCommand(callback);
    return unsubscribe;
  }, [callback, enabled]);
}
