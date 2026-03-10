import React, { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@renderer/lib/utils'
import { Keyboard, X, Plus } from 'lucide-react'

interface ShortcutRecorderProps {
  value: string | null
  onChange: (value: string | null) => void
  disabled?: boolean
  className?: string
}

// Convert Electron accelerator to display format
function formatAccelerator(accelerator: string | null): string {
  if (!accelerator) return 'Not set'

  return accelerator
    .replace(/CommandOrControl/g, '⌘')
    .replace(/CmdOrCtrl/g, '⌘')
    .replace(/Command/g, '⌘')
    .replace(/Control/g, 'Ctrl')
    .replace(/Alt/g, '⌥')
    .replace(/Shift/g, '⇧')
    .replace(/Plus/g, '+')
    .replace(/Minus/g, '-')
    .replace(/\+/g, ' + ')
}

// Parse keyboard event to accelerator string
function parseKeyEvent(event: KeyboardEvent): string | null {
  const parts: string[] = []

  if (event.metaKey || event.ctrlKey) {
    parts.push('CommandOrControl')
  }
  if (event.altKey) {
    parts.push('Alt')
  }
  if (event.shiftKey) {
    parts.push('Shift')
  }

  // Get the main key
  let key = event.key.toUpperCase()
  if (key === ' ') key = 'Space'
  if (key === 'ESCAPE') return null // Escape cancels
  if (key === 'BACKSPACE' || key === 'DELETE') return null

  // Map special keys
  const specialKeys: Record<string, string> = {
    'ARROWUP': 'Up',
    'ARROWDOWN': 'Down',
    'ARROWLEFT': 'Left',
    'ARROWRIGHT': 'Right',
    'ENTER': 'Return',
    'TAB': 'Tab',
    'F1': 'F1', 'F2': 'F2', 'F3': 'F3', 'F4': 'F4',
    'F5': 'F5', 'F6': 'F6', 'F7': 'F7', 'F8': 'F8',
    'F9': 'F9', 'F10': 'F10', 'F11': 'F11', 'F12': 'F12'
  }

  if (specialKeys[key]) {
    key = specialKeys[key]
  } else if (key.length === 1) {
    // Single character keys are fine as-is
  } else if (event.code.startsWith('DIGIT') || event.code.startsWith('KEY')) {
    // Use code for number/letter keys
    key = event.code.replace('DIGIT', '').replace('KEY', '')
  } else {
    return null // Unknown key
  }

  parts.push(key)

  // Require at least one modifier
  if (parts.length < 2) {
    return null
  }

  return parts.join('+')
}

export function ShortcutRecorder({ value, onChange, disabled, className }: ShortcutRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const inputRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isRecording) return

    event.preventDefault()
    event.stopPropagation()

    const accelerator = parseKeyEvent(event)
    if (accelerator) {
      onChange(accelerator)
      setIsRecording(false)
    }
  }, [isRecording, onChange])

  const handleBlur = useCallback(() => {
    setIsRecording(false)
  }, [])

  useEffect(() => {
    if (isRecording) {
      window.addEventListener('keydown', handleKeyDown, true)
      return () => window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [isRecording, handleKeyDown])

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        ref={inputRef}
        onClick={() => !disabled && setIsRecording(true)}
        onBlur={handleBlur}
        tabIndex={disabled ? -1 : 0}
        className={cn(
          'flex items-center h-8 min-w-[140px] rounded-md border px-3 py-1.5 text-sm',
          'transition-colors',
          isRecording
            ? 'border-primary bg-primary/10 ring-2 ring-primary ring-offset-2 ring-offset-background'
            : 'border-input bg-background hover:border-muted-foreground/50',
          disabled && 'opacity-50 cursor-not-allowed',
          !disabled && 'cursor-pointer'
        )}
      >
        {isRecording ? (
          <span className="flex items-center gap-2 text-primary">
            <Keyboard className="h-4 w-4 animate-pulse" />
            Press shortcut...
          </span>
        ) : value ? (
          <span className="flex items-center justify-between w-full gap-2">
            <kbd className="font-mono text-xs">{formatAccelerator(value)}</kbd>
            {!disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ) : (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Plus className="h-4 w-4" />
            Click to set
          </span>
        )}
      </div>
    </div>
  )
}
