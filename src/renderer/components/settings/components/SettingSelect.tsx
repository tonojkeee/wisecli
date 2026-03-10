import React from 'react'
import { cn } from '@renderer/lib/utils'
import { ChevronDown } from 'lucide-react'

interface SettingSelectOption {
  value: string
  label: string
}

interface SettingSelectProps {
  value: string
  onChange: (value: string) => void
  options: SettingSelectOption[]
  disabled?: boolean
  className?: string
}

export function SettingSelect({
  value,
  onChange,
  options,
  disabled,
  className
}: SettingSelectProps) {
  return (
    <div className={cn('relative', className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          'appearance-none h-8 min-w-[120px] rounded-md border border-input bg-background px-3 pr-8 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'cursor-pointer'
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none text-muted-foreground" />
    </div>
  )
}
