import React from "react";
import {
  Filter,
  Check,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Checkbox } from "~/components/ui/checkbox";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "~/components/ui/tooltip";

export interface FilterColumnOption {
  key: string;
  label: string;
  count?: number;
}

export interface FilterColumnGroup {
  id: string;
  title: string;
  type: "single" | "multi";
  options: FilterColumnOption[];
  selectedValue?: string;
  selectedValues?: string[];
  onSelectSingle?: (val: string) => void;
  onToggleMulti?: (key: string) => void;
}

export interface ErpFilterPopoverProps {
  columnGroups: FilterColumnGroup[];
  activeCount: number;
  onResetAll: () => void;
  title?: string;
  resetLabel?: string;
  filterButtonLabel?: string;
  align?: "start" | "center" | "end";
}

export function ErpFilterPopover({
  columnGroups,
  activeCount,
  onResetAll,
  title = "Filter & Parameter Data",
  resetLabel = "Reset Filter",
  filterButtonLabel = "Filter Data",
  align = "end",
}: ErpFilterPopoverProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex items-center">
      <div
        className={`h-11 rounded-2xl border text-xs font-semibold inline-flex items-center transition-all shadow-xs overflow-hidden ${
          activeCount > 0
            ? "bg-[#3F73F7]/10 dark:bg-[#3F73F7]/20 border-[#3F73F7] text-[#3F73F7]"
            : "bg-white dark:bg-[#202024] border-slate-200/80 dark:border-dark-border text-slate-700 dark:text-slate-200"
        }`}
      >
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            className="h-full pl-3.5 pr-2.5 inline-flex items-center gap-2 transition-colors cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 select-none focus:outline-none"
          >
            <Filter className={`w-4 h-4 ${activeCount > 0 ? "text-[#3F73F7]" : "text-slate-400"}`} />
            <span>{filterButtonLabel}</span>
            {activeCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#3F73F7] text-white text-[10px] font-bold flex items-center justify-center">
                {activeCount}
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5 opacity-60 ml-0.5" />
          </PopoverTrigger>

          <PopoverContent
            align={align}
            sideOffset={8}
            className="w-[94vw] sm:w-[720px] max-h-[85vh] overflow-y-auto p-5 rounded-3xl bg-white dark:bg-[#202024] border border-slate-200/80 dark:border-[#38383C] shadow-2xl space-y-4 text-left"
          >
          {/* Header Popup Filter */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#333338]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-[#3F73F7]/10 text-[#3F73F7] flex items-center justify-center">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {title}
              </span>
            </div>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={onResetAll}
                className="text-xs font-semibold text-red-500 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{resetLabel} ({activeCount})</span>
              </button>
            )}
          </div>

          {/* 4-Column Grid Body */}
          <TooltipProvider delay={150}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-[#333338]">
              {columnGroups.map((group, gIdx) => (
                <div
                  key={group.id}
                  className={`space-y-2 text-left ${gIdx > 0 ? "pt-3 sm:pt-0 sm:pl-4" : ""}`}
                >
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {group.title}
                  </label>
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                    {group.options.map((opt) => {
                      if (group.type === "multi") {
                        const isChecked = group.selectedValues?.includes(opt.key) ?? false;
                        return (
                          <Tooltip key={opt.key}>
                            <TooltipTrigger
                              onClick={() => group.onToggleMulti && group.onToggleMulti(opt.key)}
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer select-none text-left ${
                                isChecked
                                  ? "bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white font-semibold"
                                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate pr-1">
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={() => group.onToggleMulti && group.onToggleMulti(opt.key)}
                                />
                                <span className="truncate">{opt.label}</span>
                              </div>
                              {typeof opt.count === "number" && (
                                <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                  {opt.count}
                                </span>
                              )}
                            </TooltipTrigger>
                            <TooltipContent
                              side={gIdx >= columnGroups.length - 1 ? "left" : "right"}
                              align="center"
                              sideOffset={10}
                              className="max-w-xs text-xs font-medium z-[9999] shadow-md pointer-events-none"
                            >
                              <span>{opt.label}</span>
                              {typeof opt.count === "number" && (
                                <span className="ml-1.5 opacity-75 font-mono">({opt.count})</span>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        );
                      } else {
                        const isSelected = group.selectedValue === opt.key;
                        return (
                          <Tooltip key={opt.key}>
                            <TooltipTrigger
                              type="button"
                              onClick={() => group.onSelectSingle && group.onSelectSingle(opt.key)}
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer text-left select-none ${
                                isSelected
                                  ? "text-slate-900 dark:text-[#E2FF66] font-bold bg-slate-100 dark:bg-white/10"
                                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5"
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate pr-1">
                                <div className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5] text-slate-900 dark:text-[#E2FF66]" />}
                                </div>
                                <span className="truncate">{opt.label}</span>
                              </div>
                              {typeof opt.count === "number" && (
                                <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                  {opt.count}
                                </span>
                              )}
                            </TooltipTrigger>
                            <TooltipContent
                              side={gIdx >= columnGroups.length - 1 ? "left" : "right"}
                              align="center"
                              sideOffset={10}
                              className="max-w-xs text-xs font-medium z-[9999] shadow-md pointer-events-none"
                            >
                              <span>{opt.label}</span>
                              {typeof opt.count === "number" && (
                                <span className="ml-1.5 opacity-75 font-mono">({opt.count})</span>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        );
                      }
                    })}
                  </div>
                </div>
              ))}
            </div>
          </TooltipProvider>

          {/* Footer Filter Buttons */}
          <div className="pt-2 border-t border-slate-100 dark:border-[#333338] flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              {activeCount > 0 ? `${activeCount} filter aktif` : "Tanpa filter tambahan"}
            </span>
            <div className="flex items-center gap-2">
              {activeCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onResetAll}
                  className="rounded-xl text-xs text-slate-600 dark:text-slate-400 h-8"
                >
                  {resetLabel}
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => setOpen(false)}
                className="rounded-xl text-xs bg-[#18181B] text-white dark:bg-[#E2FF66] dark:text-slate-950 font-bold px-4 h-8"
              >
                Terapkan
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Quick Reset Inline Button (Inside same pill capsule) */}
      <div className="h-full border-l border-slate-200/80 dark:border-[#38383C] flex items-center pr-1.5 pl-0.5">
        <button
          type="button"
          onClick={onResetAll}
          disabled={activeCount === 0}
          title={activeCount > 0 ? resetLabel : "Tidak ada filter aktif"}
          className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
            activeCount > 0
              ? "text-red-500 hover:bg-red-500/10 hover:text-red-600 cursor-pointer active:scale-95"
              : "text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-40"
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </div>
  );
}
