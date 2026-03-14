import React, { useEffect, useRef, useCallback, useState, useImperativeHandle } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import {
  ClipboardAddon,
  ClipboardSelectionType,
  type IClipboardProvider,
} from "@xterm/addon-clipboard";
import "@xterm/xterm/css/xterm.css";
import { cn } from "@renderer/lib/utils";
import { logger } from "@renderer/lib/logger";
import { getTerminalTheme } from "@renderer/lib/terminal-theme";
import { useEffectiveTheme } from "@renderer/stores/useSettingsStore";

/**
 * Custom clipboard provider that uses Electron's clipboard API
 * for full system clipboard integration
 */
class ElectronClipboardProvider implements IClipboardProvider {
  async readText(_selection: ClipboardSelectionType): Promise<string> {
    try {
      return await window.electronAPI.clipboard.readText();
    } catch {
      return "";
    }
  }

  async writeText(_selection: ClipboardSelectionType, text: string): Promise<void> {
    try {
      await window.electronAPI.clipboard.writeText(text);
    } catch {
      // Ignore clipboard errors
    }
  }
}

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
  getSearchAddon: () => SearchAddon | null;
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
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const lastBufferLengthRef = useRef(0);
  const currentAgentIdRef = useRef<string | null>(null);
  const isDisposedRef = useRef(false);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [containerReady, setContainerReady] = useState(false);
  const fitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const effectiveTheme = useEffectiveTheme();

  // Keep refs updated to avoid stale closures in terminal callbacks
  // Note: outputBuffer and outputVersion refs are NOT needed for effects -
  // effects can use props directly. Refs are only needed for callbacks.
  const onInputRef = useRef(onInput);
  const onResizeRef = useRef(onResize);
  const copyOnSelectRef = useRef(copyOnSelect);

  useEffect(() => {
    onInputRef.current = onInput;
  }, [onInput]);

  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);

  useEffect(() => {
    copyOnSelectRef.current = copyOnSelect;
  }, [copyOnSelect]);

  // Expose search functionality via ref
  useImperativeHandle(
    ref,
    () => ({
      getSearchAddon: () => searchAddonRef.current,
      openSearch: () => onSearchOpen?.(),
    }),
    [onSearchOpen]
  );

  // Safe fit function that checks if terminal is still valid
  const safeFit = useCallback(() => {
    if (isDisposedRef.current) return;
    if (!fitAddonRef.current || !xtermRef.current) return;

    const terminal = xtermRef.current;

    // Check if container has valid dimensions
    if (terminalRef.current) {
      const { offsetWidth, offsetHeight } = terminalRef.current;
      if (offsetWidth === 0 || offsetHeight === 0) {
        return;
      }
    }

    try {
      // Refresh terminal state before fitting
      terminal.refresh(0, terminal.rows - 1);
      fitAddonRef.current.fit();
    } catch {
      // Ignore fit errors - terminal may be disposed or not fully initialized
    }
  }, []);

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current || !containerReady) return;

    isDisposedRef.current = false;

    const terminal = new XTerm({
      cursorBlink,
      cursorStyle,
      fontSize,
      fontFamily,
      theme: getTerminalTheme(effectiveTheme === "dark"),
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon((_event: MouseEvent, uri: string) => {
      window.electronAPI.app.openExternal(uri);
    });
    const clipboardAddon = new ClipboardAddon(new ElectronClipboardProvider());

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(searchAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.loadAddon(clipboardAddon);

    terminal.open(terminalRef.current);

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    // Handle input - use ref to avoid stale closure
    // PTY handles echo, no local echo needed (standard xterm.js + node-pty pattern)
    terminal.onData((data) => {
      if (!isDisposedRef.current) {
        // Send to PTY - it will echo back
        onInputRef.current(data);
      }
    });

    // Copy on selection (optional feature)
    terminal.onSelectionChange(() => {
      if (!isDisposedRef.current && copyOnSelectRef.current) {
        const selection = terminal.getSelection();
        if (selection) {
          window.electronAPI.clipboard.writeText(selection);
        }
      }
    });

    // Handle keyboard shortcuts for copy/paste (Ctrl+Shift+C/V)
    // ClipboardAddon handles browser clipboard events, but we need explicit key handling for Electron
    terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (isDisposedRef.current) return false;

      // Ctrl+Shift+C = Copy selection to clipboard
      if (event.ctrlKey && event.shiftKey && event.key.toUpperCase() === "C") {
        const selection = terminal.getSelection();
        if (selection) {
          window.electronAPI.clipboard.writeText(selection);
        }
        return false; // Prevent default terminal handling
      }

      // Ctrl+Shift+V = Paste from clipboard
      if (event.ctrlKey && event.shiftKey && event.key.toUpperCase() === "V") {
        window.electronAPI.clipboard.readText().then((text) => {
          if (text && !isDisposedRef.current && onInputRef.current) {
            onInputRef.current(text);
          }
        });
        return false; // Prevent default terminal handling
      }

      // Ctrl+F / Cmd+F = Open search
      const isFindShortcut = (event.ctrlKey || event.metaKey) && event.key.toUpperCase() === "F";
      if (isFindShortcut) {
        onSearchOpen?.();
        return false; // Prevent default browser find
      }

      return true; // Allow other keys to be processed
    });

    // Handle resize - use ref to avoid stale closure
    terminal.onResize(({ cols, rows }) => {
      if (!isDisposedRef.current) {
        onResizeRef.current(cols, rows);
      }
    });

    // Use ResizeObserver to handle container size changes
    resizeObserverRef.current = new ResizeObserver(() => {
      // Check disposal before fitting
      if (isDisposedRef.current) return;
      safeFit();
    });

    if (terminalRef.current) {
      resizeObserverRef.current.observe(terminalRef.current);
    }

    return () => {
      // Mark as disposed first to prevent any pending callbacks
      isDisposedRef.current = true;

      // Clear fit timeout
      if (fitTimeoutRef.current) {
        clearTimeout(fitTimeoutRef.current);
        fitTimeoutRef.current = null;
      }

      // Disconnect observer before disposing terminal
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }

      // Dispose terminal
      if (xtermRef.current) {
        xtermRef.current.dispose();
      }

      xtermRef.current = null;
      fitAddonRef.current = null;
      searchAddonRef.current = null;
    };
  }, [containerReady]);

  // Handle agent switching and output buffer updates
  // Depend on agentId, outputBuffer (by reference), and containerReady
  // CRITICAL: Use outputBuffer prop directly, NOT a ref, to avoid race conditions
  // during agent switching where refs may still point to the old agent's data
  useEffect(() => {
    const terminal = xtermRef.current;
    if (!terminal || isDisposedRef.current || !containerReady) return;

    const isAgentSwitch = currentAgentIdRef.current !== agentId;

    logger.debug("[TERMINAL] useEffect triggered:", {
      agentId: agentId.slice(0, 8),
      isAgentSwitch,
      outputVersion,
      lastBufferLength: lastBufferLengthRef.current,
      bufferLength: outputBuffer.length,
    });

    // Handle agent switch - clear terminal and reset tracking, then return early
    if (isAgentSwitch) {
      terminal.clear();
      currentAgentIdRef.current = agentId;
      // Set to current buffer length so we only write NEW data after the switch
      // This prevents reading stale data from the old agent's buffer
      lastBufferLengthRef.current = outputBuffer.length;

      logger.debug("[TERMINAL] agent switch complete, bufferLength set to:", outputBuffer.length);

      // Fit terminal after agent switch - single debounced fit
      if (fitTimeoutRef.current) {
        clearTimeout(fitTimeoutRef.current);
      }

      fitTimeoutRef.current = setTimeout(() => {
        if (!isDisposedRef.current && fitAddonRef.current && xtermRef.current) {
          try {
            fitAddonRef.current.fit();
            onResizeRef.current(xtermRef.current!.cols, xtermRef.current!.rows);
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
    // Use outputBuffer prop directly - it's always the correct agent's buffer
    if (outputBuffer.length > lastBufferLengthRef.current) {
      const newItems = outputBuffer.slice(lastBufferLengthRef.current);
      const combinedData = newItems.join("");

      logger.debug(
        "[TERMINAL] write:",
        agentId.slice(0, 8),
        "from index:",
        lastBufferLengthRef.current,
        "to:",
        outputBuffer.length,
        "dataLen:",
        combinedData.length
      );

      if (combinedData && !isDisposedRef.current) {
        try {
          terminal.write(combinedData);
        } catch {
          // Terminal may have been disposed
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
  }, [agentId, outputBuffer, outputVersion, containerReady, safeFit]);

  // Update terminal settings
  useEffect(() => {
    if (xtermRef.current && !isDisposedRef.current) {
      xtermRef.current.options.fontSize = fontSize;
      xtermRef.current.options.fontFamily = fontFamily;
      xtermRef.current.options.cursorStyle = cursorStyle;
      xtermRef.current.options.cursorBlink = cursorBlink;
      safeFit();
    }
  }, [fontSize, fontFamily, cursorStyle, cursorBlink, safeFit]);

  // Update terminal theme when effective theme changes
  useEffect(() => {
    if (xtermRef.current && !isDisposedRef.current) {
      xtermRef.current.options.theme = getTerminalTheme(effectiveTheme === "dark");
    }
  }, [effectiveTheme]);

  // Refit terminal when container ref changes
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    console.log("[TerminalView] containerRef called, node:", !!node);
    if (node) {
      terminalRef.current = node;
      console.log("[TerminalView] container dimensions:", node.offsetWidth, "x", node.offsetHeight);
      // Check if container has actual dimensions
      if (node.offsetWidth > 0 && node.offsetHeight > 0) {
        console.log("[TerminalView] setting containerReady to true");
        setContainerReady(true);
      } else {
        // Retry after layout
        console.log("[TerminalView] no dimensions, retrying with requestAnimationFrame");
        requestAnimationFrame(() => {
          if (terminalRef.current?.offsetWidth && terminalRef.current?.offsetHeight) {
            console.log("[TerminalView] retry successful, setting containerReady to true");
            setContainerReady(true);
          } else {
            console.log("[TerminalView] retry failed, dimensions still 0");
          }
        });
      }
    }
  }, []);

  // Handle click on container to focus terminal
  const handleContainerClick = useCallback(() => {
    if (xtermRef.current && !isDisposedRef.current) {
      xtermRef.current.focus();
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
      className={cn("h-full w-full", className)}
      onClick={handleContainerClick}
      onContextMenu={handleContextMenu}
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
