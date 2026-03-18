import React from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, ArrowUpRight, RefreshCw } from "lucide-react";
import { cn } from "@renderer/lib/utils";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { ChatInput } from "./ChatInput";
import {
  useChatMessages,
  useIsStreaming,
  useChatStore,
  useToolExecutions,
} from "@renderer/stores/useChatStore";
import type { ChatMessage } from "@shared/types/chat";

interface ChatViewProps {
  agentId: string;
  className?: string;
  onSendMessage?: (content: string) => void;
  onStopStreaming?: () => void;
}

// All available suggestions - mix of coding, debugging, explaining, and creative tasks
const ALL_SUGGESTIONS = [
  { icon: "💡", text: "Объясни как работает async/await в JavaScript" },
  { icon: "🔧", text: "Помоги разобраться с этой ошибкой" },
  { icon: "📝", text: "Напиши функцию для сортировки массива объектов" },
  { icon: "🔍", text: "Проверь мой код на возможные улучшения" },
  { icon: "🚀", text: "Оптимизируй эту функцию для лучшей производительности" },
  { icon: "📚", text: "Объясни разницу между let, const и var" },
  { icon: "🎨", text: "Помоги создать адаптивный CSS макет" },
  { icon: "🔒", text: "Как безопасно хранить пароли пользователей?" },
  { icon: "⚡", text: "Преобразуй этот callback код в Promises" },
  { icon: "🧪", text: "Напиши юнит-тесты для этой функции" },
  { icon: "📦", text: "Объясни как работает управление пакетами npm" },
  { icon: "🌐", text: "Помоги настроить REST API эндпоинт" },
  { icon: "🗃️", text: "Спроектируй схему базы данных для todo-приложения" },
  { icon: "🔄", text: "Объясни React хуки и когда их использовать" },
  { icon: "📱", text: "Сделай этот компонент адаптивным для мобильных" },
  { icon: "🐛", text: "Почему useEffect срабатывает дважды?" },
  { icon: "✨", text: "Добавь TypeScript типы в этот JavaScript код" },
  { icon: "🔐", text: "Реализуй JWT аутентификацию" },
  { icon: "📊", text: "Помоги визуализировать данные с помощью графиков" },
  { icon: "🤖", text: "Объясни как использовать Fetch API" },
  { icon: "🧹", text: "Рефакторинг кода для лучшей читаемости" },
  { icon: "📝", text: "Напиши регулярное выражение для валидации email" },
  { icon: "🔧", text: "Исправь ошибку CORS в моём API запросе" },
  { icon: "🚀", text: "Задеплой приложение на облачную платформу" },
  { icon: "📚", text: "Объясни принципы SOLID с примерами" },
  { icon: "🎨", text: "Создай переключатель тёмной темы" },
  { icon: "🔒", text: "Защити веб-приложение от XSS атак" },
  { icon: "⚡", text: "Ленивая загрузка изображений для производительности" },
  { icon: "🧪", text: "Замокай API ответы для тестирования" },
  { icon: "📦", text: "Настрой монорепозиторий с несколькими пакетами" },
];

// Get 4 random suggestions
function getRandomSuggestions(count: number = 4): typeof ALL_SUGGESTIONS {
  const shuffled = [...ALL_SUGGESTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Wrapper component to use hooks properly for each message
function MessageWithTools({
  message,
  agentId,
  isStreaming,
  streamingReasoning,
}: {
  message: ChatMessage;
  agentId: string;
  isStreaming: boolean;
  streamingReasoning?: string;
}) {
  const toolExecutions = useToolExecutions(agentId, message.id);
  return (
    <ChatMessageBubble
      message={message}
      isStreaming={isStreaming}
      streamingReasoning={streamingReasoning}
      toolExecutions={toolExecutions}
    />
  );
}

// Welcome component for empty state
function WelcomeState({
  t,
  onSuggestionClick,
}: {
  t: (key: string, options?: { defaultValue?: string }) => string;
  onSuggestionClick: (text: string) => void;
}) {
  const [suggestions, setSuggestions] = React.useState(() => getRandomSuggestions(4));

  const refreshSuggestions = () => {
    setSuggestions(getRandomSuggestions(4));
  };

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-8">
      {/* Logo/Icon */}
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 shadow-lg animate-float">
        <Sparkles className="h-8 w-8 text-violet-500" />
      </div>

      {/* Title */}
      <h2 className="mb-2 text-xl font-semibold text-foreground">
        {t("welcome.title", { defaultValue: "How can I help you today?" })}
      </h2>

      {/* Subtitle */}
      <p className="mb-6 max-w-sm text-center text-sm text-muted-foreground">
        {t("welcome.subtitle", {
          defaultValue: "Start a conversation or try one of these suggestions",
        })}
      </p>

      {/* Suggestions grid */}
      <div className="grid max-w-md gap-2 sm:grid-cols-2 mb-4">
        {suggestions.map((suggestion, index) => (
          <button
            key={`${suggestion.text}-${index}`}
            onClick={() => onSuggestionClick(suggestion.text)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm",
              "bg-muted/40 hover:bg-muted/60 border border-border/50",
              "transition-all duration-200 hover:border-border hover:scale-[1.02]",
              "group active:scale-[0.98]"
            )}
          >
            <span className="text-base">{suggestion.icon}</span>
            <span className="flex-1 text-muted-foreground group-hover:text-foreground transition-colors line-clamp-2">
              {suggestion.text}
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/50 group-hover:text-foreground/70 transition-colors" />
          </button>
        ))}
      </div>

      {/* Refresh button */}
      <button
        onClick={refreshSuggestions}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium",
          "text-muted-foreground hover:text-foreground",
          "hover:bg-muted/40 transition-all duration-200"
        )}
      >
        <RefreshCw className="h-3 w-3" />
        <span>{t("refreshSuggestions", { defaultValue: "Show different suggestions" })}</span>
      </button>
    </div>
  );
}

// Streaming indicator
function StreamingIndicator() {
  return (
    <div className="flex items-center gap-2 py-2">
      <div className="flex gap-1">
        <span
          className="h-2 w-2 animate-bounce rounded-full bg-primary/60"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="h-2 w-2 animate-bounce rounded-full bg-primary/60"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="h-2 w-2 animate-bounce rounded-full bg-primary/60"
          style={{ animationDelay: "300ms" }}
        />
      </div>
    </div>
  );
}

/**
 * Main chat view component with message list and input area.
 * Features elegant empty state, smooth animations, and refined layout.
 */
export function ChatView({ agentId, className, onSendMessage, onStopStreaming }: ChatViewProps) {
  const { t } = useTranslation("chat");
  const messages = useChatMessages(agentId);
  const isStreaming = useIsStreaming(agentId);
  const streamingContent = useChatStore((state) => state.streamingContent);
  const streamingReasoning = useChatStore((state) => state.streamingReasoning);
  const streamingMessageId = useChatStore((state) => state.streamingMessageId);
  const isLoading = useChatStore((state) => state.isLoading);
  const settings = useChatStore((state) => state.settings);
  const setSettings = useChatStore((state) => state.setSettings);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages.length, streamingContent, streamingReasoning]);

  const handleSend = (content: string) => {
    onSendMessage?.(content);
  };

  const handleStop = () => {
    onStopStreaming?.();
  };

  const handleToggleThinking = () => {
    setSettings({ thinkingEnabled: !settings.thinkingEnabled });
    window.electronAPI.chat.updateSettings({ thinkingEnabled: !settings.thinkingEnabled });
  };

  // Create a streaming message for display
  const streamingMessage: ChatMessage | null = isStreaming
    ? {
        id: streamingMessageId || "streaming",
        role: "assistant",
        content: streamingContent,
        reasoningContent: streamingReasoning || undefined,
        timestamp: new Date(),
      }
    : null;

  const hasMessages = messages.length > 0 || streamingMessage;

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Messages area */}
      <ScrollArea ref={scrollAreaRef} orientation="vertical" className="flex-1">
        {isLoading && messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <StreamingIndicator />
          </div>
        ) : !hasMessages ? (
          <WelcomeState t={t} onSuggestionClick={handleSend} />
        ) : (
          <div className="space-y-1 px-4 py-4">
            {messages.map((message) => (
              <MessageWithTools
                key={message.id}
                message={message}
                agentId={agentId}
                isStreaming={false}
              />
            ))}
            {streamingMessage && (
              <MessageWithTools
                message={streamingMessage}
                agentId={agentId}
                isStreaming={true}
                streamingReasoning={streamingReasoning}
              />
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input area */}
      <ChatInput
        onSend={handleSend}
        isStreaming={isStreaming}
        onStop={handleStop}
        disabled={isLoading}
        thinkingEnabled={settings.thinkingEnabled}
        onToggleThinking={handleToggleThinking}
      />
    </div>
  );
}

export default ChatView;
