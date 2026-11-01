import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "~/lib/utils"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Textarea } from "~/components/ui/textarea"

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        "group/input-group border-input dark:bg-input/30 shadow-xs relative flex w-full items-center rounded-lg border outline-none transition-[color,box-shadow]",
        "h-9 has-[>textarea]:h-auto",

        // Variants based on alignment.
        "has-[>[data-align=inline-start]]:[&>input]:pl-2",
        "has-[>[data-align=inline-end]]:[&>input]:pr-2",
        "has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3",
        "has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3",

        // Focus state.
        "has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-3 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50",

        // Error state.
        "has-[[data-slot][aria-invalid=true]]:ring-3 has-[[data-slot][aria-invalid=true]]:ring-destructive/20 has-[[data-slot][aria-invalid=true]]:border-destructive dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40",

        className
      )}
      {...props}
    />
  )
}

const inputGroupAddonVariants = cva(
  "text-muted-foreground flex h-auto cursor-text select-none items-center justify-center gap-1.5 py-1.5 text-xs font-medium group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-4",
  {
    variants: {
      align: {
        "inline-start":
          "order-first pl-3 has-[>button]:ml-[-0.45rem] has-[>kbd]:ml-[-0.35rem]",
        "inline-end":
          "order-last pr-3 has-[>button]:mr-[-0.4rem] has-[>kbd]:mr-[-0.35rem]",
        "block-start":
          "[.border-b]:pb-3 order-first w-full justify-start px-3 pt-3 group-has-[>input]/input-group:pt-2.5",
        "block-end":
          "[.border-t]:pt-3 order-last w-full justify-start px-3 pb-3 group-has-[>input]/input-group:pb-2.5",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  }
)

function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) {
          return
        }
        e.currentTarget.parentElement?.querySelector("input")?.focus()
      }}
      {...props}
    />
  )
}

const inputGroupButtonVariants = cva(
  "flex items-center gap-1.5 text-xs shadow-none",
  {
    variants: {
      size: {
        xs: "h-6 gap-1 rounded-[calc(var(--radius)-5px)] px-2 has-[>svg]:px-2 [&>svg:not([class*='size-'])]:size-3.5",
        sm: "h-7 gap-1.5 rounded-md px-2.5 has-[>svg]:px-2.5",
        "icon-xs":
          "size-6 rounded-[calc(var(--radius)-5px)] p-0 has-[>svg]:p-0",
        "icon-sm": "size-7 p-0 has-[>svg]:p-0",
      },
    },
    defaultVariants: {
      size: "xs",
    },
  }
)

function InputGroupButton({
  className,
  type = "button",
  variant = "ghost",
  size = "xs",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size"> &
  VariantProps<typeof inputGroupButtonVariants>) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  )
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "text-muted-foreground flex items-center gap-1.5 text-xs font-medium [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none",
        className
      )}
      {...props}
    />
  )
}

export const formatThousands = (num: number | string): string => {
  if (num === "" || num === null || num === undefined || isNaN(Number(num))) return "";
  const parts = num.toString().split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return parts.join(",");
};

export const parseThousands = (str: string): number => {
  if (!str) return 0;
  const cleanStr = str.replace(/\./g, "").replace(/,/g, ".");
  const val = Number(cleanStr);
  return isNaN(val) ? 0 : val;
};

export interface InputGroupInputProps
  extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  currency?: boolean;
  value?: number | string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  onValueChange?: (value: number) => void;
  max?: number | string;
  onMaxExceeded?: (maxVal: number) => void;
  allowDecimals?: boolean;
}

function InputGroupInput({
  className,
  currency = false,
  value,
  onChange,
  onValueChange,
  max,
  onMaxExceeded,
  allowDecimals = false,
  placeholder = "0",
  ...props
}: InputGroupInputProps) {
  const internalRef = React.useRef<HTMLInputElement>(null);

  const [displayValue, setDisplayValue] = React.useState<string>(() => {
    if (!currency) return "";
    const numericMax = max !== undefined && !isNaN(Number(max)) ? Number(max) : undefined;
    let target = value !== 0 && value !== undefined ? Number(value) : 0;
    if (numericMax !== undefined && numericMax > 0 && target > numericMax) {
      target = numericMax;
    }
    return target > 0 ? formatThousands(target) : "";
  });

  React.useEffect(() => {
    if (!currency) return;
    const numericMax = max !== undefined && !isNaN(Number(max)) ? Number(max) : undefined;
    let targetVal = typeof value === "number" && !isNaN(value) ? value : 0;
    if (numericMax !== undefined && numericMax >= 0 && targetVal > numericMax) {
      targetVal = numericMax;
      onValueChange?.(numericMax);
      onMaxExceeded?.(numericMax);
    }

    const formattedTarget = targetVal > 0 ? formatThousands(targetVal) : "";
    const parsedCurrent = parseThousands(displayValue);

    if (parsedCurrent !== targetVal || (targetVal === 0 && displayValue !== "" && displayValue !== "0")) {
      setDisplayValue(formattedTarget);
      if (internalRef.current) {
        internalRef.current.value = formattedTarget;
      }
    }
  }, [value, currency, max]);

  if (!currency) {
    const handleNonCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const numericMax = max !== undefined && !isNaN(Number(max)) ? Number(max) : undefined;
      if (numericMax !== undefined && numericMax >= 0) {
        const raw = parseFloat(e.target.value);
        if (!isNaN(raw) && raw > numericMax) {
          e.target.value = String(numericMax);
          onMaxExceeded?.(numericMax);
          onValueChange?.(numericMax);
          onChange?.(e);
          return;
        }
      }
      if (onValueChange && !isNaN(Number(e.target.value))) {
        onValueChange(Number(e.target.value));
      }
      onChange?.(e);
    };

    return (
      <Input
        data-slot="input-group-control"
        className={cn(
          "h-full flex-1 rounded-none border-0 bg-transparent px-3 shadow-none focus-visible:ring-0 focus-visible:border-transparent dark:bg-transparent text-xs",
          className
        )}
        value={value}
        max={max}
        onChange={handleNonCurrencyChange}
        placeholder={placeholder}
        {...props}
      />
    );
  }

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    if (!allowDecimals) {
      raw = raw.replace(/[^0-9]/g, "");
    } else {
      raw = raw.replace(/[^0-9,]/g, "");
    }

    if (!raw) {
      setDisplayValue("");
      if (internalRef.current) {
        internalRef.current.value = "";
      }
      onValueChange?.(0);
      onChange?.(e);
      return;
    }

    let numericVal = parseThousands(raw);
    const numericMax = max !== undefined && !isNaN(Number(max)) ? Number(max) : undefined;

    // 🔒 STRICT MAX CLAMPING WITH FORCED DOM SYNC
    if (numericMax !== undefined && numericMax >= 0 && numericVal > numericMax) {
      const formattedMax = formatThousands(numericMax);
      setDisplayValue(formattedMax);
      if (internalRef.current) {
        internalRef.current.value = formattedMax;
      }
      onValueChange?.(numericMax);
      onMaxExceeded?.(numericMax);
      onChange?.(e);
      return;
    }

    const formattedVal = formatThousands(numericVal);
    setDisplayValue(formattedVal);
    if (internalRef.current) {
      internalRef.current.value = formattedVal;
    }
    onValueChange?.(numericVal);
    onChange?.(e);
  };

  const handleCurrencyBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const numericMax = max !== undefined && !isNaN(Number(max)) ? Number(max) : undefined;
    const currentVal = parseThousands(displayValue);
    if (numericMax !== undefined && numericMax >= 0 && currentVal > numericMax) {
      const formattedMax = formatThousands(numericMax);
      setDisplayValue(formattedMax);
      if (internalRef.current) {
        internalRef.current.value = formattedMax;
      }
      onValueChange?.(numericMax);
      onMaxExceeded?.(numericMax);
    }
    props.onBlur?.(e);
  };

  return (
    <Input
      ref={internalRef}
      data-slot="input-group-control"
      type="text"
      inputMode="numeric"
      className={cn(
        "h-full flex-1 rounded-none border-0 bg-transparent px-3 shadow-none focus-visible:ring-0 focus-visible:border-transparent dark:bg-transparent text-xs font-bold",
        className
      )}
      value={displayValue}
      onChange={handleCurrencyChange}
      onBlur={handleCurrencyBlur}
      placeholder={placeholder}
      {...props}
    />
  );
}

function InputGroupTextarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn(
        "flex-1 resize-none rounded-none border-0 bg-transparent py-2 px-3 shadow-none focus-visible:ring-0 focus-visible:border-transparent dark:bg-transparent text-xs",
        className
      )}
      {...props}
    />
  )
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
}
