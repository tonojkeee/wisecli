import * as React from "react";
import { useTranslation } from "react-i18next";
import { Send, Square, Brain } from "lucide-react";
import { cn } from "@renderer/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@renderer/components/ui/tooltip";

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  isStreaming?: boolean;
  onStop?: () => void;
  className?: string;
  placeholder?: string;
  thinkingEnabled?: boolean;
  onToggleThinking?: () => void;
}

/**
 * Elegant chat input with modern styling.
 * Features glassmorphism effect, smooth transitions, and clear visual states.
 */
export function ChatInput({
  onSend,
  disabled = false,
  isStreaming = false,
  onStop,
  className,
  placeholder,
  thinkingEnabled = false,
  onToggleThinking,
}: ChatInputProps) {
  const { t } = useTranslation("chat");
  const [value, setValue] = React.useState("");
  const [isFocused, setIsFocused] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  }, [value]);

  // Focus on mount
  React.useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmedValue = value.trim();
    if (trimmedValue && !disabled && !isStreaming) {
      onSend(trimmedValue);
      setValue("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
  };

  const handleStop = () => {
    onStop?.();
  };

  const canSend = value.trim() && !disabled && !isStreaming;

  return (
    <div className={cn("p-4 pt-2", className)}>
      <div
        className={cn(
          "relative rounded-2xl transition-all duration-200",
          "bg-muted/40 backdrop-blur-md",
          "border",
          isFocused ? "border-primary/30 shadow-lg shadow-primary/5" : "border-border/50 shadow-sm",
          "overflow-hidden"
        )}
      >
        {/* Textarea */}
        <div className="relative p-3 pb-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={disabled || isStreaming}
            placeholder={placeholder || t("typeMessage")}
            rows={1}
            style={
              {
                outline: "none",
                boxShadow: "none",
                WebkitAppearance: "none",
                WebkitTapHighlightColor: "transparent",
              } as React.CSSProperties
            }
            className={cn(
              "w-full resize-none bg-transparent",
              "text-sm leading-relaxed placeholder:text-muted-foreground/50",
              "disabled:cursor-not-allowed disabled:opacity-60",
              "min-h-[24px] max-h-[160px]"
            )}
          />
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between border-t border-border/30 px-3 py-2">
          {/* Left: Thinking toggle */}
          <div className="flex items-center">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onToggleThinking}
                    disabled={isStreaming}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium",
                      "transition-all duration-200",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      thinkingEnabled
                        ? cn(
                            "bg-gradient-to-r from-violet-500/15 to-purple-500/15",
                            "text-violet-600 dark:text-violet-400",
                            "border border-violet-500/20"
                          )
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    <Brain className="h-3.5 w-3.5" />
                    <span>{t("thinking")}</span>
                    {thinkingEnabled && (
                      <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {thinkingEnabled ? t("thinkingEnabled") : t("thinkingDisabled")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Right: Send/Stop */}
          <div className="flex items-center">
            {isStreaming ? (
              <button
                type="button"
                onClick={handleStop}
                disabled={!onStop}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium",
                  "bg-gradient-to-r from-red-500 to-rose-500 text-white",
                  "hover:from-red-600 hover:to-rose-600",
                  "shadow-md shadow-red-500/20",
                  "transition-all duration-200",
                  "disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                <Square className="h-3 w-3 fill-current" />
                <span>{t("stop", { defaultValue: "Stop" })}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSend}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium",
                  "transition-all duration-200",
                  "disabled:cursor-not-allowed disabled:opacity-40",
                  canSend
                    ? cn(
                        "bg-gradient-to-r from-primary to-primary/90",
                        "text-primary-foreground",
                        "shadow-md shadow-primary/20",
                        "hover:shadow-lg hover:shadow-primary/30"
                      )
                    : "bg-muted/60 text-muted-foreground"
                )}
              >
                <Send className="h-3 w-3" />
                <span>{t("sendMessage")}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Keyboard hint */}
      <div className="mt-2 flex justify-center">
        <span className="text-[10px] text-muted-foreground/40">
          {t("keyboardHint", { defaultValue: "Enter to send • Shift+Enter for new line" })}
        </span>
      </div>
    </div>
  );
}

export default ChatInput;
