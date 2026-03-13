import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, MessageSquare, Trash2, MoreHorizontal } from "lucide-react";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { Button } from "@renderer/components/ui/button";
import { EmptyState } from "@renderer/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@renderer/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@renderer/components/ui/dialog";
import { SidebarHeader } from "./SidebarHeader";
import { SearchBar } from "./SearchBar";
import { useChatStore, useChatAgentsBySession } from "@renderer/stores/useChatStore";
import type { ChatAgentInfo } from "@shared/types/chat";

interface SidebarChatsSectionProps {
  sessionId: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onCreateChat: () => void;
  onSelectChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  collapsed?: boolean;
}

export function SidebarChatsSection({
  sessionId,
  searchQuery,
  onSearchChange,
  onCreateChat,
  onSelectChat,
  onDeleteChat,
  collapsed = false,
}: SidebarChatsSectionProps) {
  const { t } = useTranslation(["sidebar", "chat", "common"]);

  const [showConfirmDelete, setshowConfirmDelete] = useState<string | null>(null);

  // Get chat agents for the active session
  const sessionChatAgents = useChatAgentsBySession(sessionId || "");
  const activeChatAgentId = useChatStore((state) => state.activeChatAgentId);

  // Filter agents by search query
  const filteredAgents = useMemo(() => {
    if (!searchQuery.trim()) return sessionChatAgents;
    const query = searchQuery.toLowerCase();
    return sessionChatAgents.filter(
      (agent) =>
        agent.id.toLowerCase().includes(query) ||
        agent.model.toLowerCase().includes(query) ||
        agent.status.toLowerCase().includes(query)
    );
  }, [sessionChatAgents, searchQuery]);

  // Count streaming agents
  const streamingCount = useMemo(
    () => sessionChatAgents.filter((a) => a.status === "streaming").length,
    [sessionChatAgents]
  );

  return (
    <>
      <SidebarHeader
        title={t("sidebar:sections.chats", "Chats")}
        subtitle={
          sessionChatAgents.length > 0
            ? `${sessionChatAgents.length} ${t("sidebar:chatCount", "chats")}${streamingCount > 0 ? ` - ${streamingCount} ${t("sidebar:streaming", "streaming")}` : ""}`
            : undefined
        }
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onCreateChat}
          disabled={!sessionId}
          title={t("chat:newChat")}
          aria-label={t("chat:newChat")}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </SidebarHeader>

      {/* Search */}
      {!collapsed && (
        <div className="px-3 pt-2 pb-3">
          <SearchBar
            value={searchQuery}
            onChange={onSearchChange}
            placeholder={t("sidebar:search.chats", "Search chats...")}
            resultsCount={searchQuery.trim() ? filteredAgents.length : undefined}
          />
        </div>
      )}

      {/* Chats list */}
      <ScrollArea className="flex-1">
        <div className="space-y-1 px-3 pb-3">
          {filteredAgents.length === 0 ? (
            searchQuery ? (
              <EmptyState
                icon={MessageSquare}
                title={t("sidebar:empty.search.noResults")}
                size="sm"
              />
            ) : (
              <EmptyState
                icon={MessageSquare}
                title={t("sidebar:empty.chats.title", "No chats yet")}
                description={t(
                  "sidebar:empty.chats.description",
                  "Start a chat to begin a conversation"
                )}
                action={
                  sessionId
                    ? {
                        label: t("sidebar:empty.chats.action", "New Chat"),
                        onClick: onCreateChat,
                      }
                    : undefined
                }
                size="sm"
              />
            )
          ) : (
            filteredAgents.map((agent) => (
              <SidebarChatCard
                key={agent.id}
                agent={agent}
                isActive={agent.id === activeChatAgentId}
                onSelect={() => onSelectChat(agent.id)}
                onDelete={() => setshowConfirmDelete(agent.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Confirm delete dialog */}
      <Dialog open={!!showConfirmDelete} onOpenChange={() => setshowConfirmDelete(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t("chat:deleteChat")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("chat:confirmDelete")}</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setshowConfirmDelete(null)}>
              {t("common:buttons.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (showConfirmDelete) {
                  onDeleteChat(showConfirmDelete);
                }
                setshowConfirmDelete(null);
              }}
            >
              {t("common:buttons.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Compact chat card for sidebar display
 */
interface SidebarChatCardProps {
  agent: ChatAgentInfo;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function SidebarChatCard({ agent, isActive, onSelect, onDelete }: SidebarChatCardProps) {
  const { t } = useTranslation("chat");

  // Status configuration with colors
  const statusConfig: Record<ChatAgentInfo["status"], { color: string; label: string }> = {
    idle: {
      color: "bg-blue-500",
      label: t("idle"),
    },
    streaming: {
      color: "bg-emerald-500",
      label: t("streaming"),
    },
    error: {
      color: "bg-red-500",
      label: t("error"),
    },
  };

  const config = statusConfig[agent.status];

  // Format model name
  const modelShort = agent.model.replace(/^glm-/, "GLM-");

  return (
    <div
      onClick={onSelect}
      onMouseDown={(e) => {
        e.preventDefault();
      }}
      className="group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors duration-150 hover:bg-muted/30"
      style={isActive ? { backgroundColor: "hsl(var(--primary) / 0.05)" } : undefined}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {/* Chat icon */}
      <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />

      {/* Status dot */}
      <div className={`relative h-2 w-2 rounded-full shrink-0 ${config.color}`} />

      {/* Agent ID (mono) */}
      <span className="font-mono text-[11px] font-medium truncate flex-shrink-0">
        {agent.id.slice(0, 6)}
      </span>

      {/* Separator */}
      <span className="text-muted-foreground/30">-</span>

      {/* Model */}
      <span className="text-[10px] text-muted-foreground truncate flex-1">{modelShort}</span>

      {/* Provider badge */}
      <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground shrink-0">
        GLM-5
      </span>

      {/* Status label */}
      <span className="text-[9px] text-muted-foreground/60 capitalize shrink-0">
        {config.label}
      </span>

      {/* Delete button (hover) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className="h-5 w-5 flex items-center justify-center rounded transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-muted text-muted-foreground"
            aria-label={t("chat:deleteChat")}
            aria-haspopup="menu"
          >
            <MoreHorizontal className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[120px]">
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3 w-3 mr-2" />
            {t("common:buttons.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
