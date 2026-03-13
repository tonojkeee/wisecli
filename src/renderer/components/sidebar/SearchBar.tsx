import React, { useCallback, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@renderer/lib/utils";
import { Input } from "@renderer/components/ui/input";
import { Button } from "@renderer/components/ui/button";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  className?: string;
  resultsCount?: number;
  showNoResults?: boolean;
}

export function SearchBar({
  value,
  onChange,
  placeholder,
  autoFocus = false,
  onFocus,
  onBlur,
  className,
  resultsCount,
}: SearchBarProps) {
  const { t } = useTranslation("sidebar");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = useCallback(() => {
    onChange("");
    inputRef.current?.focus();
  }, [onChange]);

  // Handle keyboard shortcut to clear on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && value) {
        handleClear();
      }
    };

    if (value) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [value, handleClear]);

  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        autoFocus={autoFocus}
        placeholder={placeholder || t("search.placeholder")}
        className={cn(
          "h-9 w-full pl-9 pr-12 text-xs rounded-lg",
          "bg-muted/30 border border-border",
          "focus:bg-muted/50 focus:border-primary/30",
          "placeholder:text-muted-foreground/50",
          "transition-colors duration-150"
        )}
      />
      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {resultsCount !== undefined && value && (
          <span className="text-[10px] text-muted-foreground px-1.5">{resultsCount}</span>
        )}
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-5 w-5 p-0 hover:bg-muted"
            aria-label={t("search.clear", "Clear search")}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
