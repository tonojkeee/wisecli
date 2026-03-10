import React from 'react'
import { cn } from '@renderer/lib/utils'

interface SettingColorPickerProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

const PRESET_COLORS = [
  '#007aff', // Blue
  '#34c759', // Green
  '#ff9500', // Orange
  '#ff3b30', // Red
  '#af52de', // Purple
  '#ff2d55', // Pink
  '#5856d6', // Indigo
  '#00c7be', // Teal
]

export function SettingColorPicker({ value, onChange, disabled, className }: SettingColorPickerProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Custom color input */}
      <div className="relative">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(
            'h-8 w-8 cursor-pointer appearance-none rounded-md border border-input bg-transparent p-0.5',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
            'disabled:cursor-not-allowed disabled:opacity-50',
            '[&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-0'
          )}
        />
      </div>

      {/* Preset colors */}
      <div className="flex items-center gap-1">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            disabled={disabled}
            className={cn(
              'h-6 w-6 rounded-full border-2 transition-all',
              value === color ? 'border-foreground scale-110' : 'border-transparent',
              'hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  )
}
