import React, { useEffect, useRef, useCallback, useState, useImperativeHandle } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { cn } from "@renderer/lib/utils";
import { getTerminalTheme } from "@renderer/lib/terminal-theme";
import { useEffectiveTheme } from "@renderer/stores/useSettingsStore";

const TERMINAL_DEBUG = import.meta.env.DEV;

interface TerminalViewProps {
  agentId: string;
  outputBuffer: string[];
  outputVersion: number;
  lastOutputChunk: string;
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
  getSearchAddon: () => SearchAddon | null;
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
  lastOutputChunk,
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
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const lastBufferLengthRef = useRef(0);
  const lastOutputVersionRef = useRef(0);
  const currentAgentIdRef = useRef<string | null>(null);
  const isDisposedRef = useRef(false);
  const [containerReady, setContainerReady] = useState(false);
  const [terminalReady, setTerminalReady] = useState(false);
  const fitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const effectiveTheme = useEffectiveTheme();
  const diagnosticsRef = useRef({
    snapshotRenders: 0,
    liveChunksWritten: 0,
    forcedResyncs: 0,
  });

  // Write queue for batching terminal writes
  const writeQueueRef = useRef<{chunk: string, index: number}[]>([]);
  const isWritingRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const writeBufferRef = useRef("");

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
      getSearchAddon: () => searchAddonRef.current,
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

  const resetWriteQueue = useCallback(() => {
    writeQueueRef.current = [];
    writeBufferRef.current = "";
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    isWritingRef.current = false;
  }, []);

  // Process write queue in batches using RAF
  const processWriteQueue = useCallback(() => {
    if (isDisposedRef.current || !terminalInstanceRef.current) {
      isWritingRef.current = false;
      return;
    }

    const queue = writeQueueRef.current;
    if (queue.length === 0 && writeBufferRef.current.length === 0) {
      isWritingRef.current = false;
      return;
    }

    // Process a much larger burst per frame for minimal latency.
    const MAX_CHUNKS_PER_FRAME = 120;
    const MAX_QUEUE_SIZE = 2000;
    if (queue.length > MAX_QUEUE_SIZE) {
      queue.splice(0, queue.length - MAX_QUEUE_SIZE);
    }
    const batch = queue.splice(0, MAX_CHUNKS_PER_FRAME);
    let combined = writeBufferRef.current;

    for (const { chunk } of batch) {
      if (chunk) {
        combined += chunk;
      }
    }

    writeBufferRef.current = "";

    if (combined && !isDisposedRef.current) {
      try {
        terminalInstanceRef.current.write(combined);
      } catch {
        isWritingRef.current = false;
        return;
      }
    }

    if (queue.length > 0 || writeBufferRef.current.length > 0) {
      rafIdRef.current = requestAnimationFrame(processWriteQueue);
    } else {
      isWritingRef.current = false;
    }
  }, []);

  const enqueueBuffer = useCallback(
    (buffer: string[]) => {
      if (buffer.length === 0) return;

      for (let i = 0; i < buffer.length; i++) {
        const chunk = buffer[i];
        if (chunk) {
          writeQueueRef.current.push({ chunk, index: i });
        }
      }

      if (!isWritingRef.current) {
        isWritingRef.current = true;
        rafIdRef.current = requestAnimationFrame(processWriteQueue);
      }
    },
    [processWriteQueue]
  );

  const restoreFromSnapshot = useCallback(
    (reason: "agent-switch" | "snapshot-resync" | "fallback-resync", buffer: string[]) => {
      const terminal = terminalInstanceRef.current;
      if (!terminal || isDisposedRef.current) return;

      terminal.clear();
      resetWriteQueue();
      enqueueBuffer(buffer);

      diagnosticsRef.current.snapshotRenders += 1;
      if (reason !== "agent-switch") {
        diagnosticsRef.current.forcedResyncs += 1;
      }

      if (TERMINAL_DEBUG) {
        console.debug("[TerminalView] snapshot restore", {
          agentId,
          reason,
          chunks: buffer.length,
          outputVersion,
          diagnostics: diagnosticsRef.current,
        });
      }
    },
    [agentId, enqueueBuffer, outputVersion, resetWriteQueue]
  );

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
      scrollback: 5000, // Reduced to prevent memory issues
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(searchAddon);
    terminal.loadAddon(webLinksAddon);

    // Open terminal (synchronous in xterm.js)
    terminal.open(terminalRef.current);

    if (isDisposedRef.current) return;

    terminalInstanceRef.current = terminal;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;
    setTerminalReady(true);

    // Initial fit
    requestAnimationFrame(() => {
      if (!isDisposedRef.current) {
        safeFit();
      }
    });

    // Store event listener disposables for cleanup
    const disposables: Array<{ dispose: () => void }> = [];

    // Handle input - use ref to avoid stale closure
    disposables.push(
      terminal.onData((data) => {
        if (!isDisposedRef.current) {
          onInputRef.current(data);
        }
      })
    );

    // Handle resize - use ref to avoid stale closure
    disposables.push(
      terminal.onResize(({ cols, rows }) => {
        if (!isDisposedRef.current) {
          onResizeRef.current(cols, rows);
        }
      })
    );

    // Handle selection change for copy on select
    disposables.push(
      terminal.onSelectionChange(() => {
        if (!isDisposedRef.current && copyOnSelectRef.current) {
          const selection = terminal.getSelection();
          if (selection) {
            window.electronAPI.clipboard.writeText(selection);
          }
        }
      })
    );

    return () => {
      // Mark as disposed first to prevent any pending callbacks
      isDisposedRef.current = true;

      // Dispose all event listeners
      disposables.forEach((disposable) => disposable.dispose());

      // Clear fit timeout
      if (fitTimeoutRef.current) {
        clearTimeout(fitTimeoutRef.current);
        fitTimeoutRef.current = null;
      }

      // Clear any pending RAF
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      // Dispose terminal
      if (terminalInstanceRef.current) {
        terminalInstanceRef.current.dispose();
      }

      terminalInstanceRef.current = null;
      fitAddonRef.current = null;
      searchAddonRef.current = null;
      setTerminalReady(false);
    };
  }, [containerReady, safeFit]);

  // Use ResizeObserver for container resize detection (xterm.js pattern)
  useEffect(() => {
    const container = terminalRef.current;
    if (!container || !fitAddonRef.current || !terminalReady) return;

    // Debounce resize handling to prevent excessive fit() calls
    // Context7 recommends 100ms debounce for resize events
    let resizeTimeoutId: ReturnType<typeof setTimeout> | null = null;
    const handleResize = () => {
      if (resizeTimeoutId !== null) {
        clearTimeout(resizeTimeoutId);
      }
      resizeTimeoutId = setTimeout(() => {
        resizeTimeoutId = null;
        if (!isDisposedRef.current && fitAddonRef.current) {
          safeFit();
        }
      }, 100);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      if (resizeTimeoutId !== null) {
        clearTimeout(resizeTimeoutId);
      }
      resizeObserver.disconnect();
    };
  }, [terminalReady, safeFit]);

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

  // Restore terminal content from snapshot on agent switch / remount / recovery.
  useEffect(() => {
    const terminal = terminalInstanceRef.current;
    if (!terminal || isDisposedRef.current || !terminalReady) return;

    const isAgentSwitch = currentAgentIdRef.current !== agentId;
    if (isAgentSwitch) {
      currentAgentIdRef.current = agentId;
      diagnosticsRef.current = {
        snapshotRenders: 0,
        liveChunksWritten: 0,
        forcedResyncs: 0,
      };
      restoreFromSnapshot("agent-switch", outputBuffer);
      lastBufferLengthRef.current = outputBuffer.length;
      lastOutputVersionRef.current = outputVersion;

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
      }, 100);

      return () => {
        if (fitTimeoutRef.current) {
          clearTimeout(fitTimeoutRef.current);
          fitTimeoutRef.current = null;
        }
        resetWriteQueue();
      };
    }

    if (outputVersion === 0 && outputBuffer.length === 0 && lastOutputVersionRef.current !== 0) {
      restoreFromSnapshot("snapshot-resync", []);
      lastBufferLengthRef.current = 0;
      lastOutputVersionRef.current = 0;
    }
  }, [
    agentId,
    outputBuffer,
    outputVersion,
    terminalReady,
    restoreFromSnapshot,
    resetWriteQueue,
  ]);

  // Apply live append-only output updates.
  useEffect(() => {
    const terminal = terminalInstanceRef.current;
    if (!terminal || isDisposedRef.current || !terminalReady) return;
    if (currentAgentIdRef.current !== agentId) return;

    const hadNoDataBefore = lastBufferLengthRef.current === 0;
    if (outputVersion > lastOutputVersionRef.current) {
      if (lastOutputChunk) {
        enqueueBuffer([lastOutputChunk]);
        diagnosticsRef.current.liveChunksWritten += 1;

        if (TERMINAL_DEBUG) {
          console.debug("[TerminalView] live append", {
            agentId,
            chunkLength: lastOutputChunk.length,
            outputVersion,
            diagnostics: diagnosticsRef.current,
          });
        }
      } else if (outputBuffer.length > 0) {
        restoreFromSnapshot("fallback-resync", outputBuffer);
      }

      lastBufferLengthRef.current = outputBuffer.length;
      lastOutputVersionRef.current = outputVersion;
    }

    // Fit on first data (buffer just became non-empty)
    if (hadNoDataBefore && outputBuffer.length > 0) {
      requestAnimationFrame(() => {
        safeFit();
      });
    }
  }, [
    agentId,
    lastOutputChunk,
    outputBuffer,
    outputVersion,
    terminalReady,
    safeFit,
    enqueueBuffer,
    restoreFromSnapshot,
  ]);

  // Update terminal settings (xterm.js supports dynamic options updates)
  useEffect(() => {
    const terminal = terminalInstanceRef.current;
    if (terminal && !isDisposedRef.current) {
      terminal.options.fontSize = fontSize;
      terminal.options.fontFamily = fontFamily;
      terminal.options.cursorStyle = cursorStyle;
      terminal.options.cursorBlink = cursorBlink;
      safeFit();
    }
  }, [fontSize, fontFamily, cursorStyle, cursorBlink, safeFit]);

  // Update terminal theme when effective theme changes (xterm.js supports dynamic theme updates)
  useEffect(() => {
    const terminal = terminalInstanceRef.current;
    if (terminal && !isDisposedRef.current) {
      terminal.options.theme = getTerminalTheme(effectiveTheme === "dark");
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
