import * as React from "react"
import { Slider as SliderPrimitive } from "@base-ui/react/slider"
import { cn } from "~/lib/utils"

export interface SliderProps
  extends Omit<SliderPrimitive.Root.Props, "value" | "defaultValue" | "onValueChange"> {
  value?: number | number[]
  defaultValue?: number | number[]
  onValueChange?: (value: number) => void
}

function Slider({
  className,
  value,
  defaultValue,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  ...props
}: SliderProps) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      value={value}
      defaultValue={defaultValue}
      onValueChange={(val) => {
        if (typeof val === "number") {
          onValueChange?.(val)
        } else if (Array.isArray(val) && val.length > 0) {
          onValueChange?.(val[0])
        }
      }}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full items-center">
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <SliderPrimitive.Indicator className="absolute h-full bg-indigo-600 dark:bg-[#E2FF66]" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block h-3.5 w-3.5 rounded-full border-2 border-indigo-600 dark:border-[#E2FF66] bg-white dark:bg-slate-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50 cursor-grab active:cursor-grabbing" />
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
