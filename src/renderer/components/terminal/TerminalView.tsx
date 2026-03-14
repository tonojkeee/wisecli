import React, { useEffect, useRef, useCallback, useState, useImperativeHandle } from "react";
import { Terminal, FitAddon } from "ghostty-web";
import { cn } from "@renderer/lib/utils";
import { getTerminalTheme } from "@renderer/lib/terminal-theme";
import { useEffectiveTheme } from "@renderer/stores/useSettingsStore";

interface TerminalViewProps {
  agentId: string;
  outputBuffer: string[];
  outputVersion: number;
  onInput: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
  fontSize?: number;
  fontFamily?: string;
  cursorStyle?: "block" | "underline" | "bar";
  cursorBlink?: boolean;
  copyOnSelect?: boolean;
  rightClickPaste?: boolean;
  className?: string;
  onSearchOpen?: () => void;
  ref?: React.Ref<TerminalViewRef>;
}

export interface TerminalViewRef {
  focus: () => void;
  getSelection: () => string;
  hasSelection: () => boolean;
  clearSelection: () => void;
  openSearch: () => void;
}

/**
 * Get platform-specific default font family for terminal
 * Windows: Cascadia Code (Windows Terminal default), Consolas fallback
 * macOS/Linux: JetBrains Mono, Menlo, Monaco, Courier New fallback
 */
function getDefaultFontFamily(): string {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes("win")) {
    return "Cascadia Code, Consolas, Courier New, monospace";
  }
  // macOS and Linux
  return "JetBrains Mono, Menlo, Monaco, Courier New, monospace";
}

export const TerminalView = ({
  agentId,
  outputBuffer,
  outputVersion,
  onInput,
  onResize,
  fontSize = 14,
  fontFamily = getDefaultFontFamily(),
  cursorStyle = "block",
  cursorBlink = true,
  copyOnSelect = false,
  rightClickPaste = true,
  className,
  onSearchOpen,
  ref,
}: TerminalViewProps) => {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastBufferLengthRef = useRef(0);
  const currentAgentIdRef = useRef<string | null>(null);
  const isDisposedRef = useRef(false);
  const [containerReady, setContainerReady] = useState(false);
  const [terminalReady, setTerminalReady] = useState(false);
  const fitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const effectiveTheme = useEffectiveTheme();

  // Keep refs updated to avoid stale closures in terminal callbacks
  const onInputRef = useRef(onInput);
  const onResizeRef = useRef(onResize);
  const copyOnSelectRef = useRef(copyOnSelect);
  const onSearchOpenRef = useRef(onSearchOpen);

  useEffect(() => {
    onInputRef.current = onInput;
  }, [onInput]);

  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);

  useEffect(() => {
    copyOnSelectRef.current = copyOnSelect;
  }, [copyOnSelect]);

  useEffect(() => {
    onSearchOpenRef.current = onSearchOpen;
  }, [onSearchOpen]);

  // Expose terminal functionality via ref
  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        if (terminalInstanceRef.current && !isDisposedRef.current) {
          terminalInstanceRef.current.focus();
        }
      },
      getSelection: () => {
        if (terminalInstanceRef.current && !isDisposedRef.current) {
          return terminalInstanceRef.current.getSelection();
        }
        return "";
      },
      hasSelection: () => {
        if (terminalInstanceRef.current && !isDisposedRef.current) {
          return terminalInstanceRef.current.hasSelection();
        }
        return false;
      },
      clearSelection: () => {
        if (terminalInstanceRef.current && !isDisposedRef.current) {
          terminalInstanceRef.current.clearSelection();
        }
      },
      openSearch: () => onSearchOpenRef.current?.(),
    }),
    []
  );

  // Safe fit function that checks if terminal is still valid
  const safeFit = useCallback(() => {
    if (isDisposedRef.current) return;
    if (!fitAddonRef.current || !terminalInstanceRef.current) return;

    // Check if container has valid dimensions
    if (terminalRef.current) {
      const { offsetWidth, offsetHeight } = terminalRef.current;
      if (offsetWidth === 0 || offsetHeight === 0) {
        return;
      }
    }

    try {
      fitAddonRef.current.fit();
    } catch {
      // Ignore fit errors - terminal may be disposed or not fully initialized
    }
  }, []);

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current || terminalInstanceRef.current || !containerReady) return;

    isDisposedRef.current = false;

    const terminal = new Terminal({
      cursorBlink,
      cursorStyle,
      fontSize,
      fontFamily,
      theme: getTerminalTheme(effectiveTheme === "dark"),
      scrollback: 10000,
      wasmPath: "ghostty-vt.wasm", // Path to WASM file in public directory
    });

    const fitAddon = new FitAddon();

    terminal.loadAddon(fitAddon);

    // Open terminal (async)
    terminal
      .open(terminalRef.current)
      .then(() => {
        if (isDisposedRef.current) return;

        terminalInstanceRef.current = terminal;
        fitAddonRef.current = fitAddon;
        setTerminalReady(true);

        // Use built-in resize observation
        fitAddon.observeResize();

        // Initial fit
        requestAnimationFrame(() => {
          if (!isDisposedRef.current) {
            safeFit();
          }
        });
      })
      .catch((err) => {
        console.error("Failed to open terminal:", err);
      });

    // Handle input - use ref to avoid stale closure
    terminal.onData((data) => {
      if (!isDisposedRef.current) {
        onInputRef.current(data);
      }
    });

    // Handle resize - use ref to avoid stale closure
    terminal.onResize(({ cols, rows }) => {
      if (!isDisposedRef.current) {
        onResizeRef.current(cols, rows);
      }
    });

    // Handle selection change for copy on select
    terminal.onSelectionChange(() => {
      if (!isDisposedRef.current && copyOnSelectRef.current) {
        const selection = terminal.getSelection();
        if (selection) {
          window.electronAPI.clipboard.writeText(selection);
        }
      }
    });

    return () => {
      // Mark as disposed first to prevent any pending callbacks
      isDisposedRef.current = true;

      // Clear fit timeout
      if (fitTimeoutRef.current) {
        clearTimeout(fitTimeoutRef.current);
        fitTimeoutRef.current = null;
      }

      // Dispose terminal
      if (terminalInstanceRef.current) {
        terminalInstanceRef.current.dispose();
      }

      terminalInstanceRef.current = null;
      fitAddonRef.current = null;
      setTerminalReady(false);
    };
  }, [containerReady, safeFit]);

  // Handle keyboard shortcuts via container events
  useEffect(() => {
    const container = terminalRef.current;
    if (!container || !terminalReady) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isDisposedRef.current || !terminalInstanceRef.current) return;

      const terminal = terminalInstanceRef.current;

      // Ctrl+Shift+C = Copy selection to clipboard
      if (event.ctrlKey && event.shiftKey && event.key.toUpperCase() === "C") {
        const selection = terminal.getSelection();
        if (selection) {
          event.preventDefault();
          window.electronAPI.clipboard.writeText(selection);
        }
        return;
      }

      // Ctrl+Shift+V = Paste from clipboard
      if (event.ctrlKey && event.shiftKey && event.key.toUpperCase() === "V") {
        event.preventDefault();
        window.electronAPI.clipboard.readText().then((text) => {
          if (text && !isDisposedRef.current && onInputRef.current) {
            onInputRef.current(text);
          }
        });
        return;
      }

      // Ctrl+F / Cmd+F = Open search
      if ((event.ctrlKey || event.metaKey) && event.key.toUpperCase() === "F") {
        event.preventDefault();
        onSearchOpenRef.current?.();
        return;
      }
    };

    container.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("keydown", handleKeyDown);
    };
  }, [terminalReady]);

  // Handle agent switching and output buffer updates
  useEffect(() => {
    const terminal = terminalInstanceRef.current;
    if (!terminal || isDisposedRef.current || !terminalReady) return;

    const isAgentSwitch = currentAgentIdRef.current !== agentId;

    // Handle agent switch - clear terminal, write entire buffer of new agent
    if (isAgentSwitch) {
      terminal.clear();
      currentAgentIdRef.current = agentId;

      // Write the ENTIRE buffer for the new agent
      if (outputBuffer.length > 0) {
        const allData = outputBuffer.join("");
        if (allData && !isDisposedRef.current) {
          try {
            terminal.write(allData);
          } catch {
            // Terminal may have been disposed
          }
        }
      }

      // Set to current buffer length so we only write NEW data after this
      lastBufferLengthRef.current = outputBuffer.length;

      // Fit terminal after agent switch
      if (fitTimeoutRef.current) {
        clearTimeout(fitTimeoutRef.current);
      }

      fitTimeoutRef.current = setTimeout(() => {
        if (!isDisposedRef.current && fitAddonRef.current && terminalInstanceRef.current) {
          try {
            fitAddonRef.current.fit();
            onResizeRef.current(
              terminalInstanceRef.current!.cols,
              terminalInstanceRef.current!.rows
            );
          } catch {
            // Ignore fit errors
          }
        }
        fitTimeoutRef.current = null;
      }, 50);

      return () => {
        if (fitTimeoutRef.current) {
          clearTimeout(fitTimeoutRef.current);
          fitTimeoutRef.current = null;
        }
      };
    }

    // Write only truly new data (buffer grew since last render)
    if (outputBuffer.length > lastBufferLengthRef.current) {
      for (let i = lastBufferLengthRef.current; i < outputBuffer.length; i++) {
        const chunk = outputBuffer[i];
        if (chunk && !isDisposedRef.current) {
          try {
            terminal.write(chunk);
          } catch {
            // Terminal may have been disposed
            break;
          }
        }
      }
      lastBufferLengthRef.current = outputBuffer.length;
    }

    // Fit on first data (buffer just became non-empty)
    if (outputBuffer.length > 0 && lastBufferLengthRef.current === 0) {
      requestAnimationFrame(() => {
        safeFit();
      });
    }
  }, [agentId, outputVersion, terminalReady, safeFit]);

  // Update terminal settings
  useEffect(() => {
    if (terminalInstanceRef.current && !isDisposedRef.current) {
      // Note: ghostty-web may not support dynamic option updates
      // The terminal may need to be recreated for font changes
      safeFit();
    }
  }, [fontSize, fontFamily, cursorStyle, cursorBlink, safeFit]);

  // Update terminal theme when effective theme changes
  useEffect(() => {
    if (terminalInstanceRef.current && !isDisposedRef.current) {
      // Note: ghostty-web may not support dynamic theme updates
      // This may require terminal recreation
    }
  }, [effectiveTheme]);

  // Refit terminal when container ref changes
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      terminalRef.current = node;
      // Check if container has actual dimensions
      if (node.offsetWidth > 0 && node.offsetHeight > 0) {
        setContainerReady(true);
      } else {
        // Retry after layout
        requestAnimationFrame(() => {
          if (terminalRef.current?.offsetWidth && terminalRef.current?.offsetHeight) {
            setContainerReady(true);
          }
        });
      }
    }
  }, []);

  // Handle click on container to focus terminal
  const handleContainerClick = useCallback(() => {
    if (terminalInstanceRef.current && !isDisposedRef.current) {
      terminalInstanceRef.current.focus();
      // Also refit on click in case container was resized
      requestAnimationFrame(() => {
        safeFit();
      });
    }
  }, [safeFit]);

  // Handle right-click for paste
  const handleContextMenu = useCallback(
    async (e: React.MouseEvent) => {
      if (!rightClickPaste) return;
      e.preventDefault();

      try {
        const text = await window.electronAPI.clipboard.readText();
        if (text && onInputRef.current && !isDisposedRef.current) {
          onInputRef.current(text);
        }
      } catch {
        // Ignore clipboard errors
      }
    },
    [rightClickPaste]
  );

  return (
    <div
      className={cn("terminal-container h-full w-full", className)}
      onClick={handleContainerClick}
      onContextMenu={handleContextMenu}
      tabIndex={0}
    >
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
};

// Hook for managing terminal lifecycle with agent
export function useTerminalManager(agentId: string | null) {
  const handleInput = useCallback(
    (data: string) => {
      if (agentId) {
        window.electronAPI.agent.write(agentId, data);
      }
    },
    [agentId]
  );

  const handleResize = useCallback(
    (cols: number, rows: number) => {
      if (agentId) {
        window.electronAPI.agent.resize(agentId, cols, rows);
      }
    },
    [agentId]
  );

  return { handleInput, handleResize };
}
