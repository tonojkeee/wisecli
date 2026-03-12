import { useTranslation } from "react-i18next";
import { TerminalView, useTerminalManager } from "@renderer/components/terminal";
import { TaskProgressPanel } from "./TaskProgressPanel";
import { StatuslineBadge } from "./StatuslineBadge";
import type { Agent } from "@renderer/stores/useAgentStore";
import type { TerminalSettings } from "@shared/types/settings";

interface TerminalAreaProps {
  activeAgent: Agent | null;
  terminalSettings: TerminalSettings | undefined;
  fontSize: number;
  fontFamily: string;
}

export function TerminalArea({
  activeAgent,
  terminalSettings,
  fontSize,
  fontFamily,
}: TerminalAreaProps) {
  const { t } = useTranslation("app");
  const { handleInput, handleResize } = useTerminalManager(activeAgent?.id || null);

  const cursorStyle = terminalSettings?.cursorStyle ?? "block";
  const cursorBlink = terminalSettings?.cursorBlink ?? true;
  const copyOnSelect = terminalSettings?.copyOnSelect ?? false;
  const rightClickPaste = terminalSettings?.rightClickPaste ?? true;

  if (activeAgent) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Terminal output */}
        <div className="flex-1 min-h-0">
          <TerminalView
            agentId={activeAgent.id}
            outputBuffer={activeAgent.outputBuffer}
            outputVersion={activeAgent.outputVersion}
            onInput={handleInput}
            onResize={handleResize}
            fontSize={fontSize}
            fontFamily={fontFamily}
            cursorStyle={cursorStyle}
            cursorBlink={cursorBlink}
            copyOnSelect={copyOnSelect}
            rightClickPaste={rightClickPaste}
          />
        </div>

        {/* Status bar with statusline badge */}
        <div className="flex items-center justify-between px-2 py-1 border-t border-border bg-background/50">
          <StatuslineBadge agentId={activeAgent.id} />
        </div>

        {/* Task progress panel */}
        <TaskProgressPanel agentId={activeAgent.id} />
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <div className="text-center">
        <p>{t("terminal.noAgentSelected")}</p>
        <p className="text-xs">{t("terminal.selectOrStartAgent")}</p>
      </div>
    </div>
  );
}
