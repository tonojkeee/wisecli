import React from "react";
import { cn } from "@renderer/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@renderer/components/ui/card";

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  indent?: boolean;
}

export function SettingRow({ label, description, children, className, indent }: SettingRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-3 px-4 -mx-4 rounded-lg",
        "hover:bg-muted/30 transition-colors",
        indent && "pl-8",
        className
      )}
    >
      <div className="flex-1 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <label className="text-sm font-medium">{label}</label>
        </div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

interface SettingGroupProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function SettingGroup({ title, description, children, className }: SettingGroupProps) {
  return (
    <Card className={cn("bg-muted/20 border-muted/40", className)}>
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 space-y-0">{children}</CardContent>
    </Card>
  );
}
