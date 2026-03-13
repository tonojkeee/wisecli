import React, { useState, useCallback, useEffect, useRef } from "react";
import { SearchAddon } from "@xterm/addon-search";
import { useTranslation } from "react-i18next";
import { ChevronUp, ChevronDown, X } from "lucide-react";
import { Input } from "@renderer/components/ui/input";
import { Button } from "@renderer/components/ui/button";
import { cn } from "@renderer/lib/utils";

interface TerminalSearchProps {
  searchAddon: SearchAddon | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TerminalSearch({ searchAddon, isOpen, onClose }: TerminalSearchProps) {
  const { t } = useTranslation("terminal");
  const [searchTerm, setSearchTerm] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [resultIndex, setResultIndex] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when search opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  // Perform search when term or options change
  useEffect(() => {
    if (!searchAddon || !searchTerm) {
      setTotalResults(0);
      setResultIndex(0);
      return;
    }

    try {
      const results = searchAddon.findNext(searchTerm, {
        caseSensitive: matchCase,
        regex: useRegex,
        wholeWord: false,
      });
      // SearchAddon doesn't return count, we'll track via navigation
      setTotalResults(results ? 1 : 0);
    } catch {
      // Invalid regex or search error
      setTotalResults(0);
    }
  }, [searchTerm, matchCase, useRegex, searchAddon]);

  const handleSearch = useCallback(
    (direction: "next" | "prev") => {
      if (!searchAddon || !searchTerm) return;

      try {
        if (direction === "next") {
          searchAddon.findNext(searchTerm, {
            caseSensitive: matchCase,
            regex: useRegex,
            wholeWord: false,
          });
        } else {
          searchAddon.findPrevious(searchTerm, {
            caseSensitive: matchCase,
            regex: useRegex,
            wholeWord: false,
          });
        }
      } catch {
        // Invalid regex or search error
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
        onClose();
      }
    },
    [handleSearch, onClose]
  );

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setResultIndex(0);
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
          className="h-8 text-sm pr-16"
        />
        {/* Results counter */}
        {searchTerm && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {totalResults > 0
              ? `${resultIndex + 1} of ${totalResults}`
              : t("search.noResults", "No results")}
          </span>
        )}
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
