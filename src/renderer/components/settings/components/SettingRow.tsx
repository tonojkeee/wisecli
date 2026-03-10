import React from 'react'
import { cn } from '@renderer/lib/utils'
import { HelpCircle } from 'lucide-react'

interface SettingRowProps {
  label: string
  description?: string
  children: React.ReactNode
  className?: string
  indent?: boolean
}

export function SettingRow({ label, description, children, className, indent }: SettingRowProps) {
  return (
    <div className={cn('flex items-center justify-between gap-4 py-3', indent && 'pl-4', className)}>
      <div className="flex-1 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <label className="text-sm font-medium">{label}</label>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

interface SettingGroupProps {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function SettingGroup({ title, description, children, className }: SettingGroupProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <div className="mb-3">
        <h4 className="text-sm font-semibold">{title}</h4>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}
