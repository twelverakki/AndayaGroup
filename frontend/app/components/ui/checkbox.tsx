import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "~/lib/utils";

export interface CheckboxProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked = false, onCheckedChange, disabled, ...props }, ref) => {
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        ref={ref}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          props.onClick?.(e);
          onCheckedChange?.(!checked);
        }}
        className={cn(
          "peer h-4 w-4 shrink-0 rounded-[4px] border transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center cursor-pointer",
          checked
            ? "bg-slate-900 border-slate-900 text-white dark:bg-[#E2FF66] dark:border-[#E2FF66] dark:text-slate-900 shadow-xs"
            : "border-slate-300 dark:border-slate-600 bg-transparent hover:border-slate-400 dark:hover:border-slate-500",
          className
        )}
        {...props}
      >
        {checked && <Check className="h-3 w-3 stroke-[3]" />}
      </button>
    );
  }
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
