import React, { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChevronUp, ChevronDown, X } from "lucide-react";
import type { ISearchOptions, SearchAddon } from "@xterm/addon-search";
import { Input } from "@renderer/components/ui/input";
import { Button } from "@renderer/components/ui/button";
import { cn } from "@renderer/lib/utils";

const SEARCH_DECORATIONS: NonNullable<ISearchOptions["decorations"]> = {
  matchBackground: "#7aa2f7",
  activeMatchBackground: "#f7768e",
  matchOverviewRuler: "#7aa2f7",
  activeMatchColorOverviewRuler: "#f7768e",
};

interface TerminalSearchProps {
  searchAddon: SearchAddon | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Terminal search component using xterm.js SearchAddon
 */
export function TerminalSearch({
  searchAddon,
  isOpen,
  onClose,
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

  // Perform search when search term or options change
  useEffect(() => {
    if (searchAddon && searchTerm) {
      searchAddon.findNext(searchTerm, {
        caseSensitive: matchCase,
        wholeWord: false,
        regex: useRegex,
        decorations: SEARCH_DECORATIONS,
      });
    }
  }, [searchAddon, searchTerm, matchCase, useRegex]);

  const handleSearch = useCallback(
    (direction: "next" | "prev") => {
      if (!searchAddon || !searchTerm) return;

      if (direction === "next") {
        searchAddon.findNext(searchTerm, {
          caseSensitive: matchCase,
          wholeWord: false,
          regex: useRegex,
          decorations: SEARCH_DECORATIONS,
        });
      } else {
        searchAddon.findPrevious(searchTerm, {
          caseSensitive: matchCase,
          wholeWord: false,
          regex: useRegex,
          decorations: SEARCH_DECORATIONS,
        });
      }
    },
    [searchAddon, searchTerm, matchCase, useRegex]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSearch(e.shiftKey ? "prev" : "next");
      } else if (e.key === "Escape") {
        e.preventDefault();
        // Clear search highlights before closing
        if (searchAddon) {
          searchAddon.clearDecorations();
        }
        onClose();
      }
    },
    [handleSearch, onClose, searchAddon]
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

  // Clear decorations when closing
  const handleClose = useCallback(() => {
    if (searchAddon) {
      searchAddon.clearDecorations();
    }
    onClose();
  }, [onClose, searchAddon]);

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
        disabled={!searchTerm || !searchAddon}
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
        disabled={!searchTerm || !searchAddon}
        className="h-8 w-8 p-0"
        title={t("search.next", "Next match")}
      >
        <ChevronDown className="h-4 w-4" />
      </Button>

      {/* Close button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClose}
        className="h-8 w-8 p-0"
        title={t("search.close", "Close")}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
