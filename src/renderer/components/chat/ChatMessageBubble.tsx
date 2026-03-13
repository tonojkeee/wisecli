import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  User,
  Brain,
  ChevronDown,
  ChevronRight,
  Wrench,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
} from "lucide-react";
import { cn } from "@renderer/lib/utils";
import type { ChatMessage, ToolExecutionState } from "@shared/types/chat";
import { ChatMarkdown } from "./ChatMarkdown";

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
  streamingReasoning?: string;
  toolExecutions?: ToolExecutionState[];
  className?: string;
}

/**
 * Modern chat message bubble with elegant styling.
 * Features smooth animations, refined typography, and clear visual hierarchy.
 */
export function ChatMessageBubble({
  message,
  isStreaming = false,
  streamingReasoning,
  toolExecutions,
  className,
}: ChatMessageBubbleProps) {
  const { t } = useTranslation("chat");
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const [showReasoning, setShowReasoning] = React.useState(false);
  const [showToolCalls, setShowToolCalls] = React.useState(true);

  const hasReasoning = !!message.reasoningContent || !!streamingReasoning;
  const reasoningContent = streamingReasoning || message.reasoningContent || "";
  const hasToolExecutions = !!toolExecutions && toolExecutions.length > 0;

  const toolSummary = React.useMemo(() => {
    if (!toolExecutions || toolExecutions.length === 0) {
      return { pending: 0, executing: 0, completed: 0, errors: 0 };
    }
    return {
      pending: toolExecutions.filter((t) => t.status === "pending").length,
      executing: toolExecutions.filter((t) => t.status === "executing").length,
      completed: toolExecutions.filter((t) => t.status === "completed").length,
      errors: toolExecutions.filter((t) => t.status === "error").length,
    };
  }, [toolExecutions]);

  const hasToolErrors = toolSummary.errors > 0;
  const isToolExecuting = toolSummary.executing > 0 || toolSummary.pending > 0;

  const formattedTime = React.useMemo(() => {
    const date = new Date(message.timestamp);
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [message.timestamp]);

  if (isSystem) {
    return (
      <div className={cn("flex justify-center py-3", className)}>
        <div className="flex items-center gap-2 rounded-full bg-muted/60 px-4 py-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
          <span className="text-xs font-medium text-muted-foreground">{message.content}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex gap-3 py-2 transition-colors duration-200",
        isUser ? "flex-row-reverse" : "flex-row",
        className
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
          isUser
            ? "bg-gradient-to-br from-primary/90 to-primary text-primary-foreground shadow-sm"
            : "bg-gradient-to-br from-muted to-muted/80 text-foreground shadow-sm"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Sparkles className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Message content */}
      <div
        className={cn("flex max-w-[80%] flex-col gap-1.5", isUser ? "items-end" : "items-start")}
      >
        {/* Reasoning block */}
        {!isUser && hasReasoning && (
          <ReasoningBlock
            content={reasoningContent}
            isStreaming={isStreaming}
            isExpanded={showReasoning}
            onToggle={() => setShowReasoning(!showReasoning)}
            t={t}
          />
        )}

        {/* Tool execution block */}
        {!isUser && hasToolExecutions && (
          <ToolExecutionBlock
            toolExecutions={toolExecutions!}
            toolSummary={toolSummary}
            isExpanded={showToolCalls}
            onToggle={() => setShowToolCalls(!showToolCalls)}
            hasToolErrors={hasToolErrors}
            isToolExecuting={isToolExecuting}
            t={t}
          />
        )}

        {/* Main message content */}
        <div
          className={cn(
            "relative rounded-2xl px-4 py-2.5 transition-all duration-200",
            isUser
              ? "rounded-tr-md bg-gradient-to-br from-primary to-primary/90 text-primary-foreground shadow-sm"
              : "rounded-tl-md bg-muted/80 backdrop-blur-sm"
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
          ) : (
            <ChatMarkdown content={message.content} />
          )}
          {isStreaming && (
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current opacity-70" />
          )}
        </div>

        {/* Timestamp */}
        <span
          className={cn(
            "text-[10px] font-medium text-muted-foreground/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100",
            isUser ? "pr-1" : "pl-1"
          )}
        >
          {formattedTime}
        </span>
      </div>
    </div>
  );
}

// Separate component for reasoning block
function ReasoningBlock({
  content,
  isStreaming,
  isExpanded,
  onToggle,
  t,
}: {
  content: string;
  isStreaming: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  t: (key: string) => string;
}) {
  return (
    <>
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium",
          "bg-gradient-to-r from-violet-500/10 to-purple-500/10",
          "text-violet-600 dark:text-violet-400",
          "hover:from-violet-500/15 hover:to-purple-500/15",
          "border border-violet-500/20",
          "transition-all duration-200 w-full text-left"
        )}
      >
        <Brain className="h-3.5 w-3.5" />
        <span>{t("thinking")}</span>
        {isExpanded ? (
          <ChevronDown className="ml-auto h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="ml-auto h-3.5 w-3.5" />
        )}
      </button>

      {isExpanded && (
        <div className="w-full overflow-hidden rounded-lg border border-violet-500/10 bg-violet-500/5">
          <div className="max-h-48 overflow-auto px-3 py-2">
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">
              {content}
            </pre>
            {isStreaming && (
              <span className="ml-1 inline-block h-3 w-0.5 animate-pulse bg-violet-400" />
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Separate component for tool execution block
function ToolExecutionBlock({
  toolExecutions,
  toolSummary,
  isExpanded,
  onToggle,
  hasToolErrors,
  isToolExecuting,
  t,
}: {
  toolExecutions: ToolExecutionState[];
  toolSummary: { pending: number; executing: number; completed: number; errors: number };
  isExpanded: boolean;
  onToggle: () => void;
  hasToolErrors: boolean;
  isToolExecuting: boolean;
  t: (key: string, options?: { defaultValue?: string }) => string;
}) {
  const statusColor = hasToolErrors
    ? "from-red-500/10 to-rose-500/10 text-red-600 dark:text-red-400 border-red-500/20"
    : "from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";

  return (
    <>
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium",
          "bg-gradient-to-r",
          statusColor,
          "hover:opacity-80",
          "border",
          "transition-all duration-200 w-full text-left"
        )}
      >
        <Wrench className="h-3.5 w-3.5" />
        <span>{t("toolExecution.title", { defaultValue: "Tools" })}</span>
        <span className="text-[10px] opacity-70">
          ({toolSummary.completed + toolSummary.errors}/{toolExecutions.length})
        </span>
        {isToolExecuting && <Loader2 className="ml-1 h-3 w-3 animate-spin" />}
        {hasToolErrors && !isToolExecuting && <XCircle className="ml-1 h-3 w-3" />}
        {!hasToolErrors && !isToolExecuting && toolSummary.completed > 0 && (
          <CheckCircle2 className="ml-1 h-3 w-3 text-green-500" />
        )}
        {isExpanded ? (
          <ChevronDown className="ml-auto h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="ml-auto h-3.5 w-3.5" />
        )}
      </button>

      {isExpanded && (
        <div className="w-full space-y-1.5 overflow-hidden rounded-lg border border-amber-500/10 bg-amber-500/5 p-2">
          {toolExecutions.map((tool) => (
            <div key={tool.id} className="rounded-lg bg-background/60 p-2 backdrop-blur-sm">
              <div className="flex items-start gap-2">
                <div className="mt-0.5 shrink-0">
                  {tool.status === "error" ? (
                    <XCircle className="h-3.5 w-3.5 text-red-500" />
                  ) : tool.status === "executing" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                  ) : tool.status === "pending" ? (
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-amber-500/40" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-foreground">{tool.toolName}</div>
                  {tool.status === "error" && tool.error && (
                    <div className="mt-1.5 rounded-md bg-red-500/10 p-2">
                      <pre className="whitespace-pre-wrap break-all text-[10px] text-red-600 dark:text-red-400">
                        {tool.error}
                      </pre>
                    </div>
                  )}
                  {tool.status === "completed" && tool.result && (
                    <div className="mt-1.5 rounded-md bg-muted/50 p-2">
                      <pre className="whitespace-pre-wrap text-[10px] text-muted-foreground">
                        {tool.result}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default ChatMessageBubble;
