import React, { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { cn } from '@renderer/lib/utils'

interface TerminalViewProps {
  agentId: string
  outputBuffer: string[]
  onInput: (data: string) => void
  onResize: (cols: number, rows: number) => void
  fontSize?: number
  fontFamily?: string
  cursorStyle?: 'block' | 'underline' | 'bar'
  cursorBlink?: boolean
  className?: string
}

export function TerminalView({
  agentId,
  outputBuffer,
  onInput,
  onResize,
  fontSize = 14,
  fontFamily = 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
  cursorStyle = 'block',
  cursorBlink = true,
  className
}: TerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement | null>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const lastBufferLengthRef = useRef(0)
  const currentAgentIdRef = useRef<string | null>(null)
  const isDisposedRef = useRef(false)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const [containerReady, setContainerReady] = useState(false)

  // Keep refs updated to avoid stale closures in terminal callbacks
  const onInputRef = useRef(onInput)
  const onResizeRef = useRef(onResize)
  const outputBufferRef = useRef(outputBuffer)

  useEffect(() => {
    onInputRef.current = onInput
  }, [onInput])

  useEffect(() => {
    onResizeRef.current = onResize
  }, [onResize])

  useEffect(() => {
    outputBufferRef.current = outputBuffer
  }, [outputBuffer])

  // Safe fit function that checks if terminal is still valid
  const safeFit = useCallback(() => {
    if (isDisposedRef.current) return
    if (!fitAddonRef.current || !xtermRef.current) return

    const terminal = xtermRef.current

    // Check if terminal is still usable
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(terminal as any)._core || !(terminal as any)._core._renderService) {
      return
    }

    // Check if container has valid dimensions
    if (terminalRef.current) {
      const { offsetWidth, offsetHeight } = terminalRef.current
      if (offsetWidth === 0 || offsetHeight === 0) {
        return
      }
    }

    try {
      // Refresh terminal state before fitting
      terminal.refresh(0, terminal.rows - 1)
      fitAddonRef.current.fit()
    } catch {
      // Ignore fit errors - terminal may be disposed
    }
  }, [])

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current || !containerReady) return

    isDisposedRef.current = false

    const terminal = new XTerm({
      cursorBlink,
      cursorStyle,
      fontSize,
      fontFamily,
      theme: {
        background: '#0a0a0a',
        foreground: '#fafafa',
        cursor: '#fafafa',
        cursorAccent: '#0a0a0a',
        selectionBackground: 'rgba(250, 250, 250, 0.3)',
        black: '#0a0a0a',
        red: '#ff5f56',
        green: '#27c93f',
        yellow: '#ffbd2e',
        blue: '#007aff',
        magenta: '#af52de',
        cyan: '#64d2ff',
        white: '#fafafa',
        brightBlack: '#6b6b6b',
        brightRed: '#ff5f56',
        brightGreen: '#27c93f',
        brightYellow: '#ffbd2e',
        brightBlue: '#007aff',
        brightMagenta: '#af52de',
        brightCyan: '#64d2ff',
        brightWhite: '#fafafa'
      },
      allowProposedApi: true
    })

    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()
    const webLinksAddon = new WebLinksAddon()

    terminal.loadAddon(fitAddon)
    terminal.loadAddon(searchAddon)
    terminal.loadAddon(webLinksAddon)

    terminal.open(terminalRef.current)

    // Defer fit to ensure terminal internals are ready
    // Multiple attempts with delays to handle various timing issues
    const fitDelays = [0, 16, 50, 100, 200]
    const fitTimeouts: ReturnType<typeof setTimeout>[] = []

    fitDelays.forEach((delay) => {
      fitTimeouts.push(
        setTimeout(() => {
          if (!isDisposedRef.current && fitAddon && xtermRef.current) {
            try {
              fitAddon.fit()
              // Notify parent of initial size
              if (delay === 0) {
                onResizeRef.current(terminal.cols, terminal.rows)
              }
            } catch {
              // Ignore fit errors during initialization
            }
          }
        }, delay)
      )
    })

    xtermRef.current = terminal
    fitAddonRef.current = fitAddon

    // Handle input - use ref to avoid stale closure
    terminal.onData((data) => {
      if (!isDisposedRef.current) {
        onInputRef.current(data)
      }
    })

    // Handle resize - use ref to avoid stale closure
    terminal.onResize(({ cols, rows }) => {
      if (!isDisposedRef.current) {
        onResizeRef.current(cols, rows)
      }
    })

    // Use ResizeObserver to handle container size changes
    resizeObserverRef.current = new ResizeObserver(() => {
      safeFit()
    })

    if (terminalRef.current) {
      resizeObserverRef.current.observe(terminalRef.current)
    }

    return () => {
      // Mark as disposed first to prevent any pending callbacks
      isDisposedRef.current = true

      // Clear fit timeouts
      fitTimeouts.forEach(clearTimeout)

      // Disconnect observer before disposing terminal
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
        resizeObserverRef.current = null
      }

      // Dispose terminal
      if (xtermRef.current) {
        xtermRef.current.dispose()
      }

      xtermRef.current = null
      fitAddonRef.current = null
    }
  }, [containerReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle agent switching and output buffer updates
  useEffect(() => {
    const terminal = xtermRef.current
    if (!terminal || isDisposedRef.current) return

    const isAgentSwitch = currentAgentIdRef.current !== agentId

    // Handle agent switch
    if (isAgentSwitch) {
      terminal.clear()
      currentAgentIdRef.current = agentId
      lastBufferLengthRef.current = 0
    }

    // Write new data
    const currentLength = outputBuffer.length
    const lastLength = lastBufferLengthRef.current

    if (currentLength > lastLength) {
      const newData = outputBuffer.slice(lastLength)
      newData.forEach((data) => {
        if (!isDisposedRef.current && terminal) {
          try {
            terminal.write(data)
          } catch {
            // Terminal may have been disposed during write
          }
        }
      })
      lastBufferLengthRef.current = currentLength
    }

    // Fit terminal after agent switch with delay to ensure layout is complete
    if (isAgentSwitch) {
      // Multiple attempts to fit with increasing delays
      const delays = [0, 50, 100, 200]
      const timeoutIds: ReturnType<typeof setTimeout>[] = []

      delays.forEach((delay) => {
        timeoutIds.push(
          setTimeout(() => {
            if (!isDisposedRef.current && fitAddonRef.current && xtermRef.current) {
              try {
                fitAddonRef.current.fit()
                onResizeRef.current(terminal.cols, terminal.rows)
              } catch {
                // Ignore fit errors
              }
            }
          }, delay)
        )
      })

      return () => {
        timeoutIds.forEach(clearTimeout)
      }
    }

    // Fit on first data
    if (currentLength > 0 && lastLength === 0) {
      requestAnimationFrame(() => {
        safeFit()
      })
    }
  }, [agentId, outputBuffer, safeFit])

  // Update terminal settings
  useEffect(() => {
    if (xtermRef.current && !isDisposedRef.current) {
      xtermRef.current.options.fontSize = fontSize
      xtermRef.current.options.fontFamily = fontFamily
      xtermRef.current.options.cursorStyle = cursorStyle
      xtermRef.current.options.cursorBlink = cursorBlink
      safeFit()
    }
  }, [fontSize, fontFamily, cursorStyle, cursorBlink, safeFit])

  // Refit terminal when container ref changes
  const containerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        terminalRef.current = node
        // Check if container has actual dimensions
        if (node.offsetWidth > 0 && node.offsetHeight > 0) {
          setContainerReady(true)
        } else {
          // Retry after layout
          requestAnimationFrame(() => {
            if (terminalRef.current?.offsetWidth && terminalRef.current?.offsetHeight) {
              setContainerReady(true)
            }
          })
        }
      }
    },
    []
  )

  // Handle click on container to focus terminal
  const handleContainerClick = useCallback(() => {
    if (xtermRef.current && !isDisposedRef.current) {
      xtermRef.current.focus()
      // Also refit on click in case container was resized
      requestAnimationFrame(() => {
        safeFit()
      })
    }
  }, [safeFit])

  return (
    <div className={cn('h-full w-full', className)} onClick={handleContainerClick}>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}

// Hook for managing terminal lifecycle with agent
export function useTerminalManager(agentId: string | null) {
  const handleInput = useCallback(
    (data: string) => {
      if (agentId) {
        window.electronAPI.agent.write(agentId, data)
      }
    },
    [agentId]
  )

  const handleResize = useCallback(
    (cols: number, rows: number) => {
      if (agentId) {
        window.electronAPI.agent.resize(agentId, cols, rows)
      }
    },
    [agentId]
  )

  return { handleInput, handleResize }
}
