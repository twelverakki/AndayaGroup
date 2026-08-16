"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"

import { cn } from "~/lib/utils"

type DrawerDirection = "bottom" | "top" | "left" | "right"

interface DrawerContextValue {
  direction: DrawerDirection
}

const DrawerContext = React.createContext<DrawerContextValue>({
  direction: "bottom",
})

export const useDrawer = () => React.useContext(DrawerContext)

function Drawer({
  shouldScaleBackground = true,
  direction = "bottom",
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return (
    <DrawerContext.Provider value={{ direction }}>
      <DrawerPrimitive.Root
        data-slot="drawer"
        direction={direction}
        shouldScaleBackground={shouldScaleBackground}
        {...props}
      />
    </DrawerContext.Provider>
  )
}

function DrawerNestedRoot({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.NestedRoot>) {
  return <DrawerPrimitive.NestedRoot data-slot="drawer-nested-root" {...props} />
}

function DrawerTrigger({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerPortal({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
}

function DrawerClose({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function DrawerHandle({
  className,
  style,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Handle>) {
  const { direction } = useDrawer()
  const isHorizontal = direction === "left" || direction === "right"

  return (
    <DrawerPrimitive.Handle
      data-slot="drawer-handle"
      style={{
        width: isHorizontal ? "5px" : "48px",
        height: isHorizontal ? "84px" : "5px",
        minWidth: isHorizontal ? "5px" : undefined,
        minHeight: isHorizontal ? "84px" : undefined,
        ...style,
      }}
      className={cn(
        "shrink-0 rounded-full bg-slate-300 dark:bg-[#45454C] hover:bg-slate-400 dark:hover:bg-[#E2FF66] active:bg-[#E2FF66] transition-all duration-200",
        isHorizontal
          ? "cursor-ew-resize active:cursor-grabbing hover:scale-x-125"
          : "cursor-ns-resize active:cursor-grabbing hover:scale-y-125",
        className
      )}
      {...props}
    />
  )
}

function DrawerContent({
  className,
  children,
  hideHandle = false,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content> & {
  hideHandle?: boolean
}) {
  const { direction } = useDrawer()
  const isHorizontal = direction === "left" || direction === "right"

  // Direction styling mapping
  const directionClasses = {
    bottom:
      "inset-x-0 bottom-0 mt-24 flex flex-col rounded-t-[28px] border-t border-slate-200/80 dark:border-[#38383C] max-h-[92dvh]",
    top:
      "inset-x-0 top-0 mb-24 flex flex-col-reverse rounded-b-[28px] border-b border-slate-200/80 dark:border-[#38383C] max-h-[92dvh]",
    right:
      "inset-y-0 right-0 h-full w-full sm:w-[480px] md:w-[520px] max-w-[95vw] flex flex-row rounded-l-[28px] border-l border-slate-200/80 dark:border-[#38383C]",
    left:
      "inset-y-0 left-0 h-full w-full sm:w-[480px] md:w-[520px] max-w-[95vw] flex flex-row-reverse rounded-r-[28px] border-r border-slate-200/80 dark:border-[#38383C]",
  }

  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        data-direction={direction}
        className={cn(
          "fixed z-50 bg-white dark:bg-[#202024] text-slate-900 dark:text-slate-100 shadow-2xl transition-[transform,opacity] duration-300 ease-out focus:outline-hidden",
          directionClasses[direction],
          className
        )}
        {...props}
      >
        {!hideHandle && (
          <div
            className={cn(
              "flex shrink-0 select-none items-center justify-center",
              isHorizontal
                ? "h-full px-2.5 cursor-ew-resize hover:bg-slate-100/40 dark:hover:bg-white/[0.02] transition-colors"
                : "w-full py-2.5 cursor-ns-resize hover:bg-slate-100/40 dark:hover:bg-white/[0.02] transition-colors"
            )}
          >
            <DrawerHandle />
          </div>
        )}
        <div
          className={cn(
            "flex flex-1 flex-col overflow-y-auto overscroll-contain min-w-0",
            isHorizontal ? "h-full w-full" : "w-full"
          )}
        >
          {children}
        </div>
      </DrawerPrimitive.Content>
    </DrawerPortal>
  )
}

function DrawerHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn("grid gap-1.5 p-5 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DrawerFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn(
        "mt-auto flex flex-col gap-2 p-5 border-t border-slate-100 dark:border-[#2a2a2e]",
        className
      )}
      {...props}
    />
  )
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn(
        "text-lg font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-100",
        className
      )}
      {...props}
    />
  )
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-sm text-slate-500 dark:text-[#94a3b8]", className)}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerNestedRoot,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHandle,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
