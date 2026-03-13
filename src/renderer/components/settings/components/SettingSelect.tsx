import * as React from "react";
import { ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@renderer/components/ui/dropdown-menu";
import { cn } from "@renderer/lib/utils";

interface SettingSelectOption {
  value: string;
  label: string;
}

interface SettingSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SettingSelectOption[];
  disabled?: boolean;
  className?: string;
}

export function SettingSelect({
  value,
  onChange,
  options,
  disabled,
  className,
}: SettingSelectProps) {
  const selectedOption = options.find((opt) => opt.value === value);
  const [open, setOpen] = React.useState(false);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        disabled={disabled}
        className={cn(
          "flex h-9 min-w-[140px] items-center justify-between gap-2 rounded-lg border border-input/60 bg-muted/30 px-3 text-sm",
          "hover:bg-muted/50 hover:border-input transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "data-[state=open]:ring-2 data-[state=open]:ring-primary/50 data-[state=open]:border-primary",
          className
        )}
      >
        <span>{selectedOption?.label || value}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 opacity-50 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[140px]">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => handleSelect(option.value)}
            className="flex items-center justify-between"
          >
            <span>{option.label}</span>
            {option.value === value && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
