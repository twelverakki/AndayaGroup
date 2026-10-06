import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "./popover";
import {
  Calendar as CalendarIcon,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Check,
  Sparkles,
  ArrowRight,
  Clock,
} from "lucide-react";
import { cn } from "../../lib/utils";

export interface DatePickerV2Props {
  value?: string; // Format: "YYYY-MM-DD" or empty ""
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  minYear?: number;
  maxYear?: number;
  showShortcuts?: boolean;
  allowClear?: boolean;
  align?: "start" | "center" | "end";
}

const MONTHS_DATA = [
  { value: 1, name: "Januari", short: "Jan" },
  { value: 2, name: "Februari", short: "Feb" },
  { value: 3, name: "Maret", short: "Mar" },
  { value: 4, name: "April", short: "Apr" },
  { value: 5, name: "Mei", short: "Mei" },
  { value: 6, name: "Juni", short: "Jun" },
  { value: 7, name: "Juli", short: "Jul" },
  { value: 8, name: "Agustus", short: "Agu" },
  { value: 9, name: "September", short: "Sep" },
  { value: 10, name: "Oktober", short: "Okt" },
  { value: 11, name: "November", short: "Nov" },
  { value: 12, name: "Desember", short: "Des" },
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function pad2(num: number): string {
  return String(num).padStart(2, "0");
}

function formatDateISO(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseDateISO(isoStr?: string): { year: number; month: number; day: number } | null {
  if (!isoStr) return null;
  const match = isoStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  if (month < 1 || month > 12) return null;
  const maxDay = getDaysInMonth(year, month);
  if (day < 1 || day > maxDay) return null;
  return { year, month, day };
}

// =========================================================================
// TUMBLER CYLINDER ROLLER COLUMN (PADLOCK / ALARM WHEEL COMPONENT)
// =========================================================================
interface TumblerCylinderProps {
  label: string;
  items: Array<{ value: number; label: string; sublabel?: string }>;
  selectedValue: number;
  onSelect: (value: number) => void;
  loop?: boolean; // Infinite rolling loop flag
  className?: string;
}

function TumblerCylinder({
  label,
  items,
  selectedValue,
  onSelect,
  loop = true,
  className,
}: TumblerCylinderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedIndex = items.findIndex((it) => it.value === selectedValue);
  const currentIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const total = items.length;

  // Circular modulo helper for infinite rolling
  const getWrappedIndex = useCallback(
    (idx: number): number => {
      if (!loop) {
        return Math.max(0, Math.min(items.length - 1, idx));
      }
      return ((idx % total) + total) % total;
    },
    [loop, total, items.length]
  );

  // Roll delta step
  const rollStep = useCallback(
    (delta: number) => {
      if (total === 0) return;
      const targetIdx = getWrappedIndex(currentIndex + delta);
      onSelect(items[targetIdx].value);
    },
    [currentIndex, getWrappedIndex, items, onSelect, total]
  );

  // Non-passive wheel event listener to prevent background page scroll while rolling
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let accumulatedDelta = 0;
    const threshold = 40; // Pixels of scroll wheel required to step 1 item

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      accumulatedDelta += e.deltaY;

      if (accumulatedDelta >= threshold) {
        rollStep(1);
        accumulatedDelta = 0;
      } else if (accumulatedDelta <= -threshold) {
        rollStep(-1);
        accumulatedDelta = 0;
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, [rollStep]);

  // Touch swipe support for mobile / tablet
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const currentY = e.touches[0].clientY;
    const diff = touchStartY.current - currentY;
    if (Math.abs(diff) > 28) {
      if (diff > 0) {
        rollStep(1);
      } else {
        rollStep(-1);
      }
      touchStartY.current = currentY;
    }
  };

  const handleTouchEnd = () => {
    touchStartY.current = null;
  };

  // Keyboard navigation when cylinder is focused
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      rollStep(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      rollStep(1);
    } else if (e.key === "PageUp") {
      e.preventDefault();
      rollStep(-5);
    } else if (e.key === "PageDown") {
      e.preventDefault();
      rollStep(5);
    } else if (e.key === "Home") {
      e.preventDefault();
      onSelect(items[0].value);
    } else if (e.key === "End") {
      e.preventDefault();
      onSelect(items[total - 1].value);
    }
  };

  // Generate 5 visible rows: offset -2, -1, 0, 1, 2
  const visibleOffsets = [-2, -1, 0, 1, 2];

  return (
    <div
      className={cn(
        "flex flex-col items-center select-none group focus:outline-none",
        className
      )}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="spinbutton"
      aria-label={label}
      aria-valuenow={selectedValue}
    >
      {/* Column Title / Label */}
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
        {label}
      </span>

      {/* Up Arrow Button */}
      <button
        type="button"
        onClick={() => rollStep(-1)}
        className="w-full py-1 mb-0.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer focus:outline-none"
        title={`Sebelumnya (${label})`}
      >
        <ChevronUp className="w-4 h-4 stroke-[2.5]" />
      </button>

      {/* Tumbler Drum Drum Chamber */}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative w-full h-[180px] flex flex-col justify-center items-center overflow-hidden cursor-ns-resize px-1 rounded-2xl bg-slate-50/70 dark:bg-[#18181B]/80 border border-slate-200/60 dark:border-[#2C2C30]"
      >
        {/* Top Fade Gradient Vignette */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-slate-50 dark:from-[#18181B] via-slate-50/80 dark:via-[#18181B]/80 to-transparent z-10" />

        {/* Bottom Fade Gradient Vignette */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-slate-50 dark:from-[#18181B] via-slate-50/80 dark:via-[#18181B]/80 to-transparent z-10" />

        {/* Center Target Lens Capsule (Padlock Dial Notch) */}
        <div className="pointer-events-none absolute inset-x-1.5 top-1/2 -translate-y-1/2 h-[38px] rounded-xl bg-white dark:bg-[#2A2A30] border border-slate-300 dark:border-[#424248] shadow-sm z-0 ring-1 ring-black/5 dark:ring-white/5" />

        {/* Wheel Item Rows */}
        <div className="relative z-10 w-full flex flex-col items-center justify-center space-y-0.5">
          {visibleOffsets.map((offset) => {
            const itemIdx = getWrappedIndex(currentIndex + offset);
            const item = items[itemIdx];
            if (!item) return null;

            const isCenter = offset === 0;
            const isNear = Math.abs(offset) === 1;
            const isFar = Math.abs(offset) === 2;

            return (
              <div
                key={`offset-${offset}-${item.value}`}
                onClick={() => {
                  if (offset !== 0) {
                    rollStep(offset);
                  }
                }}
                className={cn(
                  "h-[34px] w-full flex items-center justify-center gap-1.5 px-2 rounded-lg transition-all duration-150 cursor-pointer text-center",
                  isCenter && [
                    "font-extrabold text-slate-900 dark:text-white scale-105",
                    "text-sm tracking-tight",
                  ],
                  isNear && [
                    "font-semibold text-slate-500 dark:text-slate-400 scale-95 opacity-70 hover:opacity-100",
                    "text-xs",
                  ],
                  isFar && [
                    "font-medium text-slate-400/80 dark:text-slate-600 scale-85 opacity-35 hover:opacity-70",
                    "text-[11px]",
                  ]
                )}
              >
                <span>{item.label}</span>
                {item.sublabel && (
                  <span
                    className={cn(
                      "text-[10px] uppercase font-bold",
                      isCenter
                        ? "text-blue-600 dark:text-[#E2FF66]"
                        : "text-slate-400"
                    )}
                  >
                    {item.sublabel}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Down Arrow Button */}
      <button
        type="button"
        onClick={() => rollStep(1)}
        className="w-full py-1 mt-0.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer focus:outline-none"
        title={`Berikutnya (${label})`}
      >
        <ChevronDown className="w-4 h-4 stroke-[2.5]" />
      </button>
    </div>
  );
}

// =========================================================================
// MAIN EXPORT: DatePickerV2 (Tumbler Wheel + Desktop Direct Typing)
// =========================================================================
export function DatePickerV2({
  value,
  onChange,
  placeholder = "DD/MM/YYYY",
  className,
  disabled = false,
  minYear = 1990,
  maxYear = 2040,
  showShortcuts = true,
  allowClear = true,
  align = "start",
}: DatePickerV2Props) {
  const [open, setOpen] = useState(false);

  // Parse initial date or default to Today
  const today = useMemo(() => new Date(), []);
  const initialParsed = useMemo(() => {
    return parseDateISO(value) || {
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      day: today.getDate(),
    };
  }, [value, today]);

  // Working state when rolling wheels
  const [currentYear, setCurrentYear] = useState(initialParsed.year);
  const [currentMonth, setCurrentMonth] = useState(initialParsed.month);
  const [currentDay, setCurrentDay] = useState(initialParsed.day);

  // Direct typed string inside trigger input (e.g. "25/10/2026")
  const [typedInput, setTypedInput] = useState("");

  // Sync internal wheels state whenever external `value` prop changes
  useEffect(() => {
    const parsed = parseDateISO(value);
    if (parsed) {
      setCurrentYear(parsed.year);
      setCurrentMonth(parsed.month);
      setCurrentDay(parsed.day);
      setTypedInput(
        `${pad2(parsed.day)}/${pad2(parsed.month)}/${parsed.year}`
      );
    } else {
      setTypedInput("");
    }
  }, [value]);

  // Days in selected Month & Year
  const daysInCurrentMonth = useMemo(() => {
    return getDaysInMonth(currentYear, currentMonth);
  }, [currentYear, currentMonth]);

  // Clamp day if month changes and days count is smaller (e.g. 31 to 28 for Feb)
  useEffect(() => {
    if (currentDay > daysInCurrentMonth) {
      setCurrentDay(daysInCurrentMonth);
    }
  }, [daysInCurrentMonth, currentDay]);

  // Build items array for Tanggal (Day 1..maxDays)
  const dayItems = useMemo(() => {
    const arr = [];
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      arr.push({
        value: d,
        label: pad2(d),
      });
    }
    return arr;
  }, [daysInCurrentMonth]);

  // Build items array for Bulan (Month 1..12)
  const monthItems = useMemo(() => {
    return MONTHS_DATA.map((m) => ({
      value: m.value,
      label: m.short,
      sublabel: pad2(m.value),
    }));
  }, []);

  // Build items array for Tahun (Year minYear..maxYear)
  const yearItems = useMemo(() => {
    const arr = [];
    for (let y = minYear; y <= maxYear; y++) {
      arr.push({
        value: y,
        label: String(y),
      });
    }
    return arr;
  }, [minYear, maxYear]);

  // Commit changes to parent
  const commitSelection = (y: number, m: number, d: number) => {
    const maxD = getDaysInMonth(y, m);
    const validDay = Math.min(d, maxD);
    const iso = formatDateISO(y, m, validDay);
    onChange(iso);
  };

  const handleSelectDay = (newDay: number) => {
    setCurrentDay(newDay);
    commitSelection(currentYear, currentMonth, newDay);
  };

  const handleSelectMonth = (newMonth: number) => {
    setCurrentMonth(newMonth);
    commitSelection(currentYear, newMonth, currentDay);
  };

  const handleSelectYear = (newYear: number) => {
    setCurrentYear(newYear);
    commitSelection(newYear, currentMonth, currentDay);
  };

  // Quick Preset Actions
  const handleSelectToday = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    setCurrentYear(y);
    setCurrentMonth(m);
    setCurrentDay(d);
    commitSelection(y, m, d);
  };

  const handleSelectTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const y = tomorrow.getFullYear();
    const m = tomorrow.getMonth() + 1;
    const d = tomorrow.getDate();
    setCurrentYear(y);
    setCurrentMonth(m);
    setCurrentDay(d);
    commitSelection(y, m, d);
  };

  const handleSelectYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const y = yesterday.getFullYear();
    const m = yesterday.getMonth() + 1;
    const d = yesterday.getDate();
    setCurrentYear(y);
    setCurrentMonth(m);
    setCurrentDay(d);
    commitSelection(y, m, d);
  };

  const handleAddDays = (days: number) => {
    const base = parseDateISO(value) || {
      year: currentYear,
      month: currentMonth,
      day: currentDay,
    };
    const target = new Date(base.year, base.month - 1, base.day + days);
    const y = target.getFullYear();
    const m = target.getMonth() + 1;
    const d = target.getDate();
    setCurrentYear(y);
    setCurrentMonth(m);
    setCurrentDay(d);
    commitSelection(y, m, d);
  };

  const handleReset = () => {
    onChange("");
    setTypedInput("");
  };

  // Direct typing handler in Trigger Bar
  const handleTriggerInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setTypedInput(raw);

    // Auto-parse multiple flexible formats: "DD/MM/YYYY", "DD-MM-YYYY", "YYYY-MM-DD"
    let parsed: { year: number; month: number; day: number } | null = null;

    // Format 1: DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (dmyMatch) {
      const d = parseInt(dmyMatch[1], 10);
      const m = parseInt(dmyMatch[2], 10);
      const y = parseInt(dmyMatch[3], 10);
      if (m >= 1 && m <= 12 && d >= 1 && d <= getDaysInMonth(y, m)) {
        parsed = { year: y, month: m, day: d };
      }
    }

    // Format 2: YYYY-MM-DD
    const ymdMatch = raw.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
    if (ymdMatch) {
      const y = parseInt(ymdMatch[1], 10);
      const m = parseInt(ymdMatch[2], 10);
      const d = parseInt(ymdMatch[3], 10);
      if (m >= 1 && m <= 12 && d >= 1 && d <= getDaysInMonth(y, m)) {
        parsed = { year: y, month: m, day: d };
      }
    }

    if (parsed) {
      setCurrentYear(parsed.year);
      setCurrentMonth(parsed.month);
      setCurrentDay(parsed.day);
      commitSelection(parsed.year, parsed.month, parsed.day);
    }
  };

  // Format human-friendly display in popover header
  const formattedDisplayLong = useMemo(() => {
    const monthObj = MONTHS_DATA.find((m) => m.value === currentMonth);
    return `${currentDay} ${monthObj?.name || ""} ${currentYear}`;
  }, [currentDay, currentMonth, currentYear]);

  // Mini direct-input states inside the popover
  const [popoverDayText, setPopoverDayText] = useState(String(currentDay));
  const [popoverMonthText, setPopoverMonthText] = useState(String(currentMonth));
  const [popoverYearText, setPopoverYearText] = useState(String(currentYear));

  useEffect(() => {
    setPopoverDayText(String(currentDay));
    setPopoverMonthText(String(currentMonth));
    setPopoverYearText(String(currentYear));
  }, [currentDay, currentMonth, currentYear]);

  const monthInputRef = useRef<HTMLInputElement>(null);
  const yearInputRef = useRef<HTMLInputElement>(null);

  const handlePopoverDayChange = (val: string) => {
    const numOnly = val.replace(/\D/g, "").slice(0, 2);
    setPopoverDayText(numOnly);
    const d = parseInt(numOnly, 10);
    if (!isNaN(d) && d >= 1 && d <= daysInCurrentMonth) {
      setCurrentDay(d);
      commitSelection(currentYear, currentMonth, d);
      if (numOnly.length === 2) {
        monthInputRef.current?.focus();
        monthInputRef.current?.select();
      }
    }
  };

  const handlePopoverMonthChange = (val: string) => {
    const numOnly = val.replace(/\D/g, "").slice(0, 2);
    setPopoverMonthText(numOnly);
    const m = parseInt(numOnly, 10);
    if (!isNaN(m) && m >= 1 && m <= 12) {
      setCurrentMonth(m);
      commitSelection(currentYear, m, currentDay);
      if (numOnly.length === 2) {
        yearInputRef.current?.focus();
        yearInputRef.current?.select();
      }
    }
  };

  const handlePopoverYearChange = (val: string) => {
    const numOnly = val.replace(/\D/g, "").slice(0, 4);
    setPopoverYearText(numOnly);
    const y = parseInt(numOnly, 10);
    if (!isNaN(y) && numOnly.length === 4 && y >= minYear && y <= maxYear) {
      setCurrentYear(y);
      commitSelection(y, currentMonth, currentDay);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "inline-flex items-center rounded-2xl border bg-white dark:bg-[#202024] border-slate-200/80 dark:border-[#38383C] text-xs font-medium text-slate-800 dark:text-slate-100 shadow-sm transition-all focus-within:ring-2 focus-within:ring-blue-500/30 dark:focus-within:ring-[#E2FF66]/30",
          disabled && "opacity-50 pointer-events-none bg-slate-50 dark:bg-white/5",
          className
        )}
      >
        {/* Direct typing field for desktop speed */}
        <div className="flex items-center pl-3 py-1.5 flex-1 min-w-0">
          <CalendarIcon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 mr-2 shrink-0" />
          <input
            type="text"
            disabled={disabled}
            value={typedInput}
            onChange={handleTriggerInputChange}
            placeholder={placeholder}
            className="w-full bg-transparent text-xs font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
          />
        </div>

        {/* Clear Button if value present */}
        {allowClear && value && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleReset();
            }}
            className="p-1 mr-1 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="Hapus Tanggal"
          >
            <RotateCcw className="w-3 h-3 stroke-[2.5]" />
          </button>
        )}

        {/* Tumbler Roller Trigger Button */}
        <PopoverTrigger
          disabled={disabled}
          className="flex items-center gap-1 px-2.5 py-1.5 border-l border-slate-200/80 dark:border-[#38383C] hover:bg-slate-50 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-r-2xl transition-colors cursor-pointer focus:outline-none"
          title="Buka Tumbler Roller (Alarm Wheel)"
        >
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <ChevronDown className="w-3 h-3 stroke-[2.5]" />
        </PopoverTrigger>
      </div>

      <PopoverContent
        align={align}
        className="w-[330px] sm:w-[350px] p-4 space-y-4 shadow-2xl rounded-3xl border border-slate-200/80 dark:border-[#333338] bg-white dark:bg-[#1E1E22] text-slate-900 dark:text-slate-100"
      >
        {/* Top Header: Active Selected Date Preview */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#2C2C32]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-blue-50 dark:bg-[#E2FF66]/10 text-blue-600 dark:text-[#E2FF66] flex items-center justify-center font-bold">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Tanggal Terpilih
              </p>
              <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                {formattedDisplayLong}
              </p>
            </div>
          </div>

          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-mono">
            {formatDateISO(currentYear, currentMonth, currentDay)}
          </span>
        </div>

        {/* Desktop Friendly Direct Keyboard Input Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
            <span>Ketik Cepat (DD / MM / YYYY):</span>
            <span className="text-[10px] font-normal text-slate-400">Gunakan Tab</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex-1 relative">
              <input
                type="text"
                value={popoverDayText}
                onChange={(e) => handlePopoverDayChange(e.target.value)}
                placeholder="DD"
                maxLength={2}
                className="w-full text-center py-1.5 px-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-[#28282E] border border-slate-200/80 dark:border-[#38383E] text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#E2FF66] focus:outline-none"
              />
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-semibold text-slate-400 pointer-events-none">
                Tgl
              </span>
            </div>

            <span className="text-slate-400 font-bold">/</span>

            <div className="flex-1 relative">
              <input
                ref={monthInputRef}
                type="text"
                value={popoverMonthText}
                onChange={(e) => handlePopoverMonthChange(e.target.value)}
                placeholder="MM"
                maxLength={2}
                className="w-full text-center py-1.5 px-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-[#28282E] border border-slate-200/80 dark:border-[#38383E] text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#E2FF66] focus:outline-none"
              />
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-semibold text-slate-400 pointer-events-none">
                Bln
              </span>
            </div>

            <span className="text-slate-400 font-bold">/</span>

            <div className="flex-[1.3] relative">
              <input
                ref={yearInputRef}
                type="text"
                value={popoverYearText}
                onChange={(e) => handlePopoverYearChange(e.target.value)}
                placeholder="YYYY"
                maxLength={4}
                className="w-full text-center py-1.5 px-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-[#28282E] border border-slate-200/80 dark:border-[#38383E] text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#E2FF66] focus:outline-none"
              />
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-semibold text-slate-400 pointer-events-none">
                Thn
              </span>
            </div>
          </div>
        </div>

        {/* 3 Tumbler Cylinders: Tanggal (1..31) | Bulan (Jan..Des) | Tahun (YYYY) */}
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          {/* Tanggal (Infinite Loop 1..31) */}
          <TumblerCylinder
            label="Tanggal"
            items={dayItems}
            selectedValue={currentDay}
            onSelect={handleSelectDay}
            loop={true}
          />

          {/* Bulan (Infinite Loop 1..12) */}
          <TumblerCylinder
            label="Bulan"
            items={monthItems}
            selectedValue={currentMonth}
            onSelect={handleSelectMonth}
            loop={true}
          />

          {/* Tahun (Continuous Range) */}
          <TumblerCylinder
            label="Tahun"
            items={yearItems}
            selectedValue={currentYear}
            onSelect={handleSelectYear}
            loop={false}
          />
        </div>

        {/* Quick Shortcut Buttons */}
        {showShortcuts && (
          <div className="pt-2 border-t border-slate-100 dark:border-[#2C2C32] flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={handleSelectToday}
              className="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/20 transition-all cursor-pointer"
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={handleSelectTomorrow}
              className="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/20 transition-all cursor-pointer"
            >
              Besok
            </button>
            <button
              type="button"
              onClick={handleSelectYesterday}
              className="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/20 transition-all cursor-pointer"
            >
              Kemarin
            </button>
            <button
              type="button"
              onClick={() => handleAddDays(7)}
              className="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/20 transition-all cursor-pointer"
            >
              +7 Hari
            </button>
            <button
              type="button"
              onClick={() => handleAddDays(30)}
              className="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/20 transition-all cursor-pointer"
            >
              +30 Hari
            </button>
          </div>
        )}

        {/* Footer Actions: Selesai / Tutup & Reset */}
        <div className="pt-2 border-t border-slate-100 dark:border-[#2C2C32] flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="text-[11px] font-semibold text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-1.5 rounded-full text-xs font-bold bg-[#E2FF66] text-slate-900 hover:bg-[#d4f54c] shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            Selesai
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
