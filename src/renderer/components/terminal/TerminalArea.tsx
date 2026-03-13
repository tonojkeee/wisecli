import { useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  TerminalView,
  useTerminalManager,
  type TerminalViewRef,
} from "@renderer/components/terminal";
import { ChatView } from "@renderer/components/chat";
import { TerminalSearch } from "./TerminalSearch";
import { TaskProgressPanel } from "./TaskProgressPanel";
import { StatuslineBadge } from "./StatuslineBadge";
import type { Agent } from "@renderer/stores/useAgentStore";
import type { ChatAgentInfo } from "@shared/types/chat";
import type { TerminalSettings } from "@shared/types/settings";
import { useChatActions } from "@renderer/hooks";

interface TerminalAreaProps {
  activeAgent: Agent | null;
  activeChatAgent: ChatAgentInfo | null;
  terminalSettings: TerminalSettings | undefined;
  fontSize: number;
  fontFamily: string;
}

export function TerminalArea({
  activeAgent,
  activeChatAgent,
  terminalSettings,
  fontSize,
  fontFamily,
}: TerminalAreaProps) {
  const { t } = useTranslation("app");
  const { handleInput, handleResize } = useTerminalManager(activeAgent?.id || null);
  const terminalRef = useRef<TerminalViewRef>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { sendMessage, cancelStream } = useChatActions();

  // Debug logging
  console.log("[TerminalArea] render - activeAgent:", activeAgent?.id || null);
  console.log("[TerminalArea] render - activeChatAgent:", activeChatAgent?.id || null);

  const cursorStyle = terminalSettings?.cursorStyle ?? "block";
  const cursorBlink = terminalSettings?.cursorBlink ?? true;
  const copyOnSelect = terminalSettings?.copyOnSelect ?? false;
  const rightClickPaste = terminalSettings?.rightClickPaste ?? true;

  const handleCloseSearch = useCallback(() => {
    setIsSearchOpen(false);
  }, []);

  const handleOpenSearch = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  // Render chat view for chat agents
  if (activeChatAgent) {
    console.log("[TerminalArea] rendering CHAT view");
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <ChatView
          agentId={activeChatAgent.id}
          className="flex-1"
          onSendMessage={(content) => sendMessage(activeChatAgent.id, content)}
          onStopStreaming={() => cancelStream(activeChatAgent.id)}
        />
      </div>
    );
  }

  // Render terminal view for terminal agents
  if (activeAgent) {
    console.log("[TerminalArea] rendering TERMINAL view for agent:", activeAgent.id);
    console.log("[TerminalArea] outputBuffer length:", activeAgent.outputBuffer?.length);
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Search bar */}
        <TerminalSearch
          searchAddon={terminalRef.current?.getSearchAddon() ?? null}
          isOpen={isSearchOpen}
          onClose={handleCloseSearch}
        />

        {/* Terminal output */}
        <div className="flex-1 min-h-0">
          <TerminalView
            key={activeAgent.id}
            ref={terminalRef}
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
            onSearchOpen={handleOpenSearch}
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

  console.log("[TerminalArea] rendering EMPTY state (no agent)");
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <div className="text-center">
        <p>{t("terminal.noAgentSelected")}</p>
        <p className="text-xs">{t("terminal.selectOrStartAgent")}</p>
      </div>
    </div>
  );
}
