import React, { useEffect, useRef, useCallback, useState } from "react";
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
}

export function TerminalView({
  agentId,
  outputBuffer,
  outputVersion,
  onInput,
  onResize,
  fontSize = 14,
  fontFamily = "JetBrains Mono, Menlo, Monaco, Courier New, monospace",
  cursorStyle = "block",
  cursorBlink = true,
  copyOnSelect = false,
  rightClickPaste = true,
  className,
}: TerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastOutputVersionRef = useRef(0);
  const currentAgentIdRef = useRef<string | null>(null);
  const isDisposedRef = useRef(false);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [containerReady, setContainerReady] = useState(false);
  const fitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs updated to avoid stale closures in terminal callbacks
  const onInputRef = useRef(onInput);
  const onResizeRef = useRef(onResize);
  const outputBufferRef = useRef(outputBuffer);
  const copyOnSelectRef = useRef(copyOnSelect);

  useEffect(() => {
    onInputRef.current = onInput;
  }, [onInput]);

  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);

  useEffect(() => {
    outputBufferRef.current = outputBuffer;
  }, [outputBuffer]);

  useEffect(() => {
    copyOnSelectRef.current = copyOnSelect;
  }, [copyOnSelect]);

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
      theme: {
        background: "#0a0a0a",
        foreground: "#fafafa",
        cursor: "#fafafa",
        cursorAccent: "#0a0a0a",
        selectionBackground: "rgba(250, 250, 250, 0.3)",
        black: "#0a0a0a",
        red: "#ff5f56",
        green: "#27c93f",
        yellow: "#ffbd2e",
        blue: "#007aff",
        magenta: "#af52de",
        cyan: "#64d2ff",
        white: "#fafafa",
        brightBlack: "#6b6b6b",
        brightRed: "#ff5f56",
        brightGreen: "#27c93f",
        brightYellow: "#ffbd2e",
        brightBlue: "#007aff",
        brightMagenta: "#af52de",
        brightCyan: "#64d2ff",
        brightWhite: "#fafafa",
      },
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
    };
  }, [containerReady]);

  // Handle agent switching and output buffer updates
  useEffect(() => {
    const terminal = xtermRef.current;
    if (!terminal || isDisposedRef.current) return;

    const isAgentSwitch = currentAgentIdRef.current !== agentId;

    // Handle agent switch
    if (isAgentSwitch) {
      terminal.clear();
      currentAgentIdRef.current = agentId;
      lastOutputVersionRef.current = 0;
    }

    // Write new data using version comparison
    // Version always increments, even when ring buffer wraps around
    if (outputVersion > lastOutputVersionRef.current) {
      // Calculate how many new items were added since last render
      const itemsAdded = outputVersion - lastOutputVersionRef.current;
      // Get only the newest items (they're at the end of the buffer array)
      const startIndex = Math.max(0, outputBuffer.length - itemsAdded);
      const newData = outputBuffer.slice(startIndex);
      const combinedData = newData.join("");

      if (combinedData && !isDisposedRef.current) {
        try {
          terminal.write(combinedData);
        } catch {
          // Terminal may have been disposed
        }
      }
      lastOutputVersionRef.current = outputVersion;
    }

    // Fit terminal after agent switch - single debounced fit instead of multiple timeouts
    if (isAgentSwitch) {
      // Clear any existing fit timeout
      if (fitTimeoutRef.current) {
        clearTimeout(fitTimeoutRef.current);
      }

      // Single fit with delay to ensure layout is complete
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

    // Fit on first data
    if (outputVersion > 0 && lastOutputVersionRef.current === 0) {
      requestAnimationFrame(() => {
        safeFit();
      });
    }
  }, [agentId, outputBuffer, outputVersion, safeFit]);

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
}

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
