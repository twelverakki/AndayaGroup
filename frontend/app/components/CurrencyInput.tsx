import React, { useState, useEffect } from "react";
import { cn } from "~/lib/utils";

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  allowDecimals?: boolean;
  className?: string;
}

export const formatThousands = (num: number | string): string => {
  if (num === "" || num === null || num === undefined || isNaN(Number(num))) return "";
  const parts = num.toString().split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return parts.join(",");
};

export const parseThousands = (str: string): number => {
  if (!str) return 0;
  // Replace thousand separator dots, and replace comma decimal with dot
  const cleanStr = str.replace(/\./g, "").replace(/,/g, ".");
  const val = Number(cleanStr);
  return isNaN(val) ? 0 : val;
};

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      value,
      onChange,
      prefix = "Rp",
      suffix,
      allowDecimals = false,
      className,
      disabled,
      placeholder = "0",
      ...props
    },
    ref
  ) => {
    const [displayValue, setDisplayValue] = useState<string>(() =>
      value !== 0 && value !== undefined ? formatThousands(value) : ""
    );

    useEffect(() => {
      if (value === 0 && (displayValue === "" || displayValue === "0")) {
        return;
      }
      const parsedCurrent = parseThousands(displayValue);
      if (parsedCurrent !== value) {
        setDisplayValue(value ? formatThousands(value) : "");
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let raw = e.target.value;

      // Only allow digits, dots (existing separators), and commas (if decimals enabled)
      if (!allowDecimals) {
        raw = raw.replace(/[^0-9]/g, "");
      } else {
        raw = raw.replace(/[^0-9,]/g, "");
      }

      if (!raw) {
        setDisplayValue("");
        onChange(0);
        return;
      }

      const numericVal = parseThousands(raw);
      setDisplayValue(formatThousands(numericVal));
      onChange(numericVal);
    };

    return (
      <div className="relative flex items-center w-full">
        {prefix && (
          <span className="absolute left-3 text-xs font-semibold text-slate-400 dark:text-slate-500 pointer-events-none select-none">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          disabled={disabled}
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          className={cn(
            "h-10 w-full rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-[#1A1A1E] text-slate-900 dark:text-slate-100 text-sm font-medium transition-all outline-none",
            "focus:border-[#3F73F7] focus:ring-2 focus:ring-[#3F73F7]/20 dark:focus:ring-[#3F73F7]/30",
            "disabled:cursor-not-allowed disabled:opacity-50",
            prefix ? "pl-9" : "pl-3.5",
            suffix ? "pr-12" : "pr-3.5",
            className
          )}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 text-xs font-medium text-slate-400 dark:text-slate-500 pointer-events-none select-none">
            {suffix}
          </span>
        )}
      </div>
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";
