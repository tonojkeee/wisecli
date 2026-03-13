import React from "react";
import { cn } from "@renderer/lib/utils";

interface SettingInputProps {
  value: string | number;
  onChange: (value: string) => void;
  type?: "text" | "number" | "password";
  placeholder?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export function SettingInput({
  value,
  onChange,
  type = "text",
  placeholder,
  disabled,
  min,
  max,
  step,
  className,
}: SettingInputProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      min={min}
      max={max}
      step={step}
      className={cn(
        "h-9 w-full min-w-[120px] max-w-[200px] rounded-lg border border-input/60 bg-muted/30 px-3 text-sm",
        "hover:bg-muted/50 hover:border-input transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-muted/30 disabled:hover:border-input/60",
        "placeholder:text-muted-foreground",
        className
      )}
    />
  );
}

interface SettingSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  showValue?: boolean;
  formatValue?: (value: number) => string;
}

export function SettingSlider({
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
  className,
  showValue = true,
  formatValue = (v) => v.toString(),
}: SettingSliderProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={cn(
          "h-2 w-24 cursor-pointer appearance-none rounded-full bg-muted-foreground/20",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none",
          "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary",
          "[&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-0",
          "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full",
          "[&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
        )}
      />
      {showValue && (
        <span className="min-w-[3rem] text-sm text-muted-foreground">{formatValue(value)}</span>
      )}
    </div>
  );
}
