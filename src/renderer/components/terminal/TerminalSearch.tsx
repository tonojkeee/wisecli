import React, { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChevronUp, ChevronDown, X } from "lucide-react";
import { Input } from "@renderer/components/ui/input";
import { Button } from "@renderer/components/ui/button";
import { cn } from "@renderer/lib/utils";

interface TerminalSearchProps {
  searchAddon: null; // Kept for API compatibility, but not used
  isOpen: boolean;
  onClose: () => void;
  onSearch?: (term: string, options: { caseSensitive: boolean; regex: boolean }) => void;
}

/**
 * Terminal search component
 *
 * Note: ghostty-web doesn't have a built-in SearchAddon like xterm.js.
 * This component provides a UI for search, but actual search functionality
 * would need to be implemented differently (e.g., using browser find,
 * or implementing custom buffer search).
 */
export function TerminalSearch({
  isOpen,
  onClose,
  onSearch,
}: TerminalSearchProps) {
  const { t } = useTranslation("terminal");
  const [searchTerm, setSearchTerm] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when search opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  // Notify parent of search changes
  useEffect(() => {
    if (searchTerm && onSearch) {
      onSearch(searchTerm, { caseSensitive: matchCase, regex: useRegex });
    }
  }, [searchTerm, matchCase, useRegex, onSearch]);

  const handleSearch = useCallback(
    (_direction: "next" | "prev") => {
      // Search navigation not implemented for ghostty-web
      // Could be implemented with custom buffer search in the future
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSearch(e.shiftKey ? "prev" : "next");
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [handleSearch, onClose]
  );

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  const toggleMatchCase = useCallback(() => {
    setMatchCase((prev) => !prev);
  }, []);

  const toggleRegex = useCallback(() => {
    setUseRegex((prev) => !prev);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="flex items-center gap-1 p-2 bg-background border-b border-border">
      {/* Search input */}
      <div className="relative flex-1 min-w-0">
        <Input
          ref={inputRef}
          value={searchTerm}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={t("search.placeholder", "Search terminal...")}
          className="h-8 text-sm"
        />
      </div>

      {/* Match case toggle */}
      <Button
        variant={matchCase ? "secondary" : "ghost"}
        size="sm"
        onClick={toggleMatchCase}
        className={cn("h-8 w-8 p-0", matchCase && "bg-accent")}
        title={t("search.matchCase", "Match case")}
      >
        <span className="text-xs font-bold">Aa</span>
      </Button>

      {/* Regex toggle */}
      <Button
        variant={useRegex ? "secondary" : "ghost"}
        size="sm"
        onClick={toggleRegex}
        className={cn("h-8 w-8 p-0", useRegex && "bg-accent")}
        title={t("search.regex", "Regular expression")}
      >
        <span className="text-xs">.*</span>
      </Button>

      {/* Previous match */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleSearch("prev")}
        disabled={!searchTerm}
        className="h-8 w-8 p-0"
        title={t("search.previous", "Previous match")}
      >
        <ChevronUp className="h-4 w-4" />
      </Button>

      {/* Next match */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleSearch("next")}
        disabled={!searchTerm}
        className="h-8 w-8 p-0"
        title={t("search.next", "Next match")}
      >
        <ChevronDown className="h-4 w-4" />
      </Button>

      {/* Close button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onClose}
        className="h-8 w-8 p-0"
        title={t("search.close", "Close")}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
