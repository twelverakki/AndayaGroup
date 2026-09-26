import * as React from "react";
import { Circle } from "lucide-react";
import { cn } from "~/lib/utils";

interface RadioGroupContextValue {
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue>({});

export interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, value: controlledValue, defaultValue, onValueChange, disabled, children, ...props }, ref) => {
    const [value, setValue] = React.useState(defaultValue || "");
    const currentValue = controlledValue !== undefined ? controlledValue : value;

    const handleValueChange = React.useCallback(
      (val: string) => {
        if (controlledValue === undefined) {
          setValue(val);
        }
        onValueChange?.(val);
      },
      [controlledValue, onValueChange]
    );

    return (
      <RadioGroupContext.Provider
        value={{
          value: currentValue,
          onValueChange: handleValueChange,
          disabled,
        }}
      >
        <div ref={ref} role="radiogroup" className={cn("grid gap-2", className)} {...props}>
          {children}
        </div>
      </RadioGroupContext.Provider>
    );
  }
);
RadioGroup.displayName = "RadioGroup";

export interface RadioGroupItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

const RadioGroupItem = React.forwardRef<HTMLButtonElement, RadioGroupItemProps>(
  ({ className, value, disabled: itemDisabled, ...props }, ref) => {
    const context = React.useContext(RadioGroupContext);
    const isChecked = context.value === value;
    const isDisabled = itemDisabled || context.disabled;

    return (
      <button
        type="button"
        role="radio"
        aria-checked={isChecked}
        ref={ref}
        disabled={isDisabled}
        onClick={(e) => {
          e.stopPropagation();
          props.onClick?.(e);
          if (!isDisabled) {
            context.onValueChange?.(value);
          }
        }}
        className={cn(
          "aspect-square h-4 w-4 rounded-full border border-slate-300 dark:border-slate-600 text-brand-purple dark:text-primary shadow-xs focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center justify-center transition-all cursor-pointer",
          isChecked && "border-brand-purple dark:border-[#E2FF66]",
          className
        )}
        {...props}
      >
        {isChecked && (
          <Circle className="h-2.5 w-2.5 fill-brand-purple dark:fill-[#E2FF66] text-brand-purple dark:text-[#E2FF66]" />
        )}
      </button>
    );
  }
);
RadioGroupItem.displayName = "RadioGroupItem";

export { RadioGroup, RadioGroupItem };
