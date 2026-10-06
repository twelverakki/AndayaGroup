import React, { useState, useEffect, useMemo } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "./popover";
import { Calendar } from "./calendar";
import { WheelCarouselDialog, getWeeksInMonth } from "./wheel-carousel-dialog";
import type { WeekInfo } from "./wheel-carousel-dialog";
import { Calendar as CalendarIcon, Clock, ChevronDown, RotateCcw, Check, CalendarDays } from "lucide-react";
import { cn } from "../../lib/utils";
import { useLanguageStore } from "../../lib/i18n";
import { id as idLocale } from "date-fns/locale/id";
import { enUS as enLocale } from "date-fns/locale/en-US";

export interface DatePickerProps {
  value?: string; // "YYYY-MM-DD", "YYYY-MM-DD HH:mm", "HH:mm", or "YYYY-MM-DD - YYYY-MM-DD"
  onChange: (value: string) => void;
  mode?: "date" | "week" | "time"; // "date" (default), "week" (Pekan ISO), or "time" (Jam & Menit saja)
  onWeekChange?: (weekInfo: WeekInfo) => void;
  onTimeChange?: (timeStr: string) => void;
  showTime?: boolean; // If true, adds 24-hr time selection and display (e.g. "5 Okt 2026 02:00")
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  allowClear?: boolean;
  locale?: "id" | "en";
  align?: "start" | "center" | "end";
}

const MONTH_NAMES_SHORT_ID = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
];

const MONTH_NAMES_SHORT_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseInputDate(valStr?: string): Date | null {
  if (!valStr) return null;
  const str = valStr.trim();

  // Time format "HH:mm" (e.g. "14:30")
  const tMatch = str.match(/^(\d{1,2}):(\d{1,2})$/);
  if (tMatch) {
    const today = new Date();
    const hh = parseInt(tMatch[1], 10);
    const mm = parseInt(tMatch[2], 10);
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hh, mm, 0);
    if (!isNaN(date.getTime())) return date;
  }

  // Range format "YYYY-MM-DD - YYYY-MM-DD" -> parse first date
  if (str.includes(" - ")) {
    const parts = str.split(" - ");
    return parseInputDate(parts[0]);
  }

  // Format "YYYY-MM-DD HH:mm" or "YYYY-MM-DDTHH:mm"
  const dtMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[T\s](\d{1,2}):(\d{1,2})/);
  if (dtMatch) {
    const y = parseInt(dtMatch[1], 10);
    const m = parseInt(dtMatch[2], 10) - 1;
    const d = parseInt(dtMatch[3], 10);
    const hh = parseInt(dtMatch[4], 10);
    const mm = parseInt(dtMatch[5], 10);
    const date = new Date(y, m, d, hh, mm);
    if (!isNaN(date.getTime())) return date;
  }

  // Format "YYYY-MM-DD"
  const dMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (dMatch) {
    const y = parseInt(dMatch[1], 10);
    const m = parseInt(dMatch[2], 10) - 1;
    const d = parseInt(dMatch[3], 10);
    const date = new Date(y, m, d, 0, 0);
    if (!isNaN(date.getTime())) return date;
  }

  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

export function DatePicker({
  value,
  onChange,
  mode = "date",
  onWeekChange,
  onTimeChange,
  showTime = false,
  placeholder,
  className,
  disabled = false,
  allowClear = true,
  locale: customLocale,
  align = "start",
}: DatePickerProps) {
  const currentStoreLang = useLanguageStore((s) => s.language);
  const lang = customLocale || currentStoreLang || "id";
  const isId = lang === "id";

  const defaultPlaceholder = isId
    ? mode === "time"
      ? "Pilih jam"
      : mode === "week"
      ? "Pilih pekan"
      : showTime
      ? "Pilih tanggal & jam"
      : "Pilih tanggal"
    : mode === "time"
    ? "Select time"
    : mode === "week"
    ? "Select week"
    : showTime
    ? "Select date & time"
    : "Select date";

  const activePlaceholder = placeholder || defaultPlaceholder;

  const [open, setOpen] = useState(false);
  const [carouselOpen, setCarouselOpen] = useState(false);

  // Selected date state
  const selectedDateObj = useMemo(() => parseInputDate(value), [value]);

  // Selected Week Info state (for mode="week")
  const [currentWeekInfo, setCurrentWeekInfo] = useState<WeekInfo | null>(() => {
    if (mode !== "week" || !selectedDateObj) return null;
    const thursday = new Date(selectedDateObj);
    thursday.setDate(selectedDateObj.getDate() + 3);
    const weeks = getWeeksInMonth(thursday.getFullYear(), thursday.getMonth() + 1);
    return weeks.find((w) => selectedDateObj >= w.startDate && selectedDateObj <= w.endDate) || weeks[0] || null;
  });

  // Calendar month view navigation state
  const [currentMonthView, setCurrentMonthView] = useState<Date>(
    selectedDateObj || new Date()
  );

  // Keep view aligned when value changes externally
  useEffect(() => {
    if (selectedDateObj) {
      setCurrentMonthView(selectedDateObj);
      if (mode === "week") {
        const thursday = new Date(selectedDateObj);
        thursday.setDate(selectedDateObj.getDate() + 3);
        const weeks = getWeeksInMonth(thursday.getFullYear(), thursday.getMonth() + 1);
        const matched = weeks.find((w) => selectedDateObj >= w.startDate && selectedDateObj <= w.endDate);
        if (matched) setCurrentWeekInfo(matched);
      }
    }
  }, [selectedDateObj, mode]);

  // Format display text (e.g. "5 Okt 2026", "5 Okt 2026 02:00", "14:30", or "05 Okt 2026 - 11 Okt 2026")
  const formatDisplay = () => {
    if (!value) return activePlaceholder;

    // Time Mode Display
    if (mode === "time") {
      if (selectedDateObj) {
        return `${pad2(selectedDateObj.getHours())}:${pad2(selectedDateObj.getMinutes())}`;
      }
      return value;
    }

    // Week Mode Display
    if (mode === "week") {
      if (currentWeekInfo) {
        return isId ? currentWeekInfo.rangeLabelId : currentWeekInfo.rangeLabelEn;
      }
      return value;
    }

    if (!selectedDateObj) return activePlaceholder;
    const day = selectedDateObj.getDate();
    const monthIdx = selectedDateObj.getMonth();
    const year = selectedDateObj.getFullYear();
    const monthShort = isId
      ? MONTH_NAMES_SHORT_ID[monthIdx]
      : MONTH_NAMES_SHORT_EN[monthIdx];

    const dateFormatted = `${day} ${monthShort} ${year}`;
    if (showTime) {
      const hh = pad2(selectedDateObj.getHours());
      const mm = pad2(selectedDateObj.getMinutes());
      return `${dateFormatted} ${hh}:${mm}`;
    }
    return dateFormatted;
  };

  // Emit string according to mode and showTime
  const emitValue = (d: Date | null, week?: WeekInfo) => {
    if (!d) {
      onChange("");
      setCurrentWeekInfo(null);
      return;
    }

    if (mode === "time") {
      const timeStr = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
      onChange(timeStr);
      if (onTimeChange) onTimeChange(timeStr);
      return;
    }

    if (mode === "week" && week) {
      setCurrentWeekInfo(week);
      onChange(`${week.startDateStr} - ${week.endDateStr}`);
      if (onWeekChange) onWeekChange(week);
      return;
    }

    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    if (showTime) {
      const hh = pad2(d.getHours());
      const mm = pad2(d.getMinutes());
      onChange(`${y}-${m}-${day} ${hh}:${mm}`);
    } else {
      onChange(`${y}-${m}-${day}`);
    }
  };

  // Day selection from Calendar grid
  const handleCalendarSelect = (d: Date | undefined) => {
    if (!d) return;
    const newDate = new Date(d);
    if (showTime && selectedDateObj) {
      newDate.setHours(selectedDateObj.getHours());
      newDate.setMinutes(selectedDateObj.getMinutes());
    }
    emitValue(newDate);
    if (!showTime) {
      setOpen(false);
    }
  };

  // Apply date from Samsung Wheel Carousel Dialog
  const handleCarouselApply = (d: Date, week?: WeekInfo) => {
    let targetDate = d;
    if (mode === "week" && week) {
      const thursday = new Date(week.startDate);
      thursday.setDate(week.startDate.getDate() + 3);
      targetDate = thursday;
    }
    setCurrentMonthView(targetDate);
    emitValue(targetDate, week);
    if (mode === "date") {
      setOpen(true); // Keep calendar popover open for date mode
    }
  };

  const handlePopoverOpenChange = (nextOpen: boolean) => {
    // If carousel dialog is open, do not let popover close
    if (carouselOpen && !nextOpen) {
      return;
    }
    setOpen(nextOpen);
  };

  const handleCarouselOpenChange = (nextCarouselOpen: boolean) => {
    setCarouselOpen(nextCarouselOpen);
    if (!nextCarouselOpen && mode === "date") {
      setOpen(true); // Keep calendar visible when dialog closes in date mode
    }
  };

  // Quick Action Today
  const handleSelectToday = () => {
    const today = new Date();
    setCurrentMonthView(today);
    if (mode === "time") {
      emitValue(today);
      setOpen(false);
    } else if (mode === "week") {
      const weeks = getWeeksInMonth(today.getFullYear(), today.getMonth() + 1);
      const matched = weeks.find((w) => today >= w.startDate && today <= w.endDate) || weeks[0];
      if (matched) emitValue(matched.startDate, matched);
      setOpen(false);
    } else {
      emitValue(today);
      if (!showTime) {
        setOpen(false);
      }
    }
  };

  const handleReset = () => {
    emitValue(null);
  };

  const dayPickerLocale = isId ? idLocale : enLocale;

  // In week & time modes, clicking trigger opens the 3D Wheel Carousel directly
  const handleTriggerClick = (e: React.MouseEvent) => {
    if (mode === "week" || mode === "time") {
      e.preventDefault();
      setCarouselOpen(true);
    }
  };

  const isDirectModalMode = mode === "week" || mode === "time";

  return (
    <>
      <Popover open={isDirectModalMode ? false : open} onOpenChange={handlePopoverOpenChange}>
        <PopoverTrigger
          disabled={disabled}
          onClick={handleTriggerClick}
          className={cn(
            "flex items-center justify-between gap-2.5 px-3 py-1.5 rounded-2xl border bg-white dark:bg-[#202024] border-slate-200/80 dark:border-[#38383C] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-pointer select-none outline-none disabled:opacity-50 shadow-xs group",
            className
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            {mode === "time" ? (
              <Clock className="w-3.5 h-3.5 text-blue-500 dark:text-[#E2FF66] shrink-0" />
            ) : mode === "week" ? (
              <CalendarDays className="w-3.5 h-3.5 text-emerald-500 dark:text-[#E2FF66] shrink-0" />
            ) : showTime ? (
              <div className="flex items-center gap-1.5 shrink-0 text-slate-400 dark:text-slate-500">
                <CalendarIcon className="w-3.5 h-3.5 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
                <span className="text-slate-300 dark:text-[#44444C] text-[11px] font-light">|</span>
                <Clock className="w-3.5 h-3.5 text-blue-500 dark:text-[#E2FF66]" />
              </div>
            ) : (
              <CalendarIcon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
            )}
            <span
              className={cn(
                "truncate",
                !value && "text-slate-400 dark:text-slate-500 font-normal"
              )}
            >
              {formatDisplay()}
            </span>
          </div>

          <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors shrink-0" />
        </PopoverTrigger>

        {!isDirectModalMode && (
          <PopoverContent
            align={align}
            className="w-auto p-3 shadow-2xl rounded-3xl border border-slate-200/80 dark:border-[#333338] bg-white dark:bg-[#1E1E22] text-slate-900 dark:text-slate-100 space-y-2.5"
          >
            {/* Official Shadcn DayPicker Calendar */}
            <Calendar
              mode="single"
              selected={selectedDateObj || undefined}
              onSelect={handleCalendarSelect}
              month={currentMonthView}
              onMonthChange={setCurrentMonthView}
              locale={dayPickerLocale}
              onMonthYearClick={() => setCarouselOpen(true)}
              className="p-0 select-none bg-transparent"
            />

            {/* Time Picker Bar if showTime is enabled: (icon time) TIME */}
            {showTime && (
              <button
                type="button"
                onClick={() => setCarouselOpen(true)}
                className="w-full py-2.5 px-3 rounded-2xl border border-slate-200/80 dark:border-[#333338] bg-slate-50/80 dark:bg-[#25252A] hover:bg-slate-100 dark:hover:bg-[#2E2E34] text-slate-900 dark:text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs group"
                title={isId ? "Klik untuk atur jam & menit" : "Click to set hour & minute"}
              >
                <Clock className="w-4 h-4 text-blue-500 dark:text-[#E2FF66] group-hover:scale-110 transition-transform" />
                <span className="font-mono font-black text-sm tracking-wider">
                  {selectedDateObj
                    ? `${pad2(selectedDateObj.getHours())}:${pad2(selectedDateObj.getMinutes())}`
                    : "00:00"}
                </span>
              </button>
            )}

            {/* Footer Toolbar: Reset & Today */}
            <div className="pt-2 border-t border-slate-100 dark:border-[#2C2C32] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                {allowClear && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all cursor-pointer"
                    title={isId ? "Hapus pilihan" : "Clear selection"}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSelectToday}
                  className="px-2.5 py-1 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer"
                >
                  {isId ? "Hari Ini" : "Today"}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3.5 py-1 rounded-full text-xs font-bold bg-[#E2FF66] text-slate-900 hover:bg-[#d4f54c] shadow-xs transition-all cursor-pointer flex items-center gap-1"
              >
                <Check className="w-3 h-3 stroke-[3]" />
                {isId ? "Selesai" : "Done"}
              </button>
            </div>
          </PopoverContent>
        )}
      </Popover>

      {/* Samsung 3D Depth Wheel Carousel Dialog */}
      <WheelCarouselDialog
        open={carouselOpen}
        onOpenChange={handleCarouselOpenChange}
        initialDate={
          mode === "week" && currentWeekInfo
            ? new Date(currentWeekInfo.startDate.getTime() + 3 * 86400000)
            : selectedDateObj || currentMonthView
        }
        mode={mode}
        showTime={showTime}
        locale={lang}
        onApply={handleCarouselApply}
        onApplyWeek={onWeekChange}
        onApplyTime={onTimeChange}
      />
    </>
  );
}

// Convenient dedicated TimePicker component export
export function TimePicker(props: Omit<DatePickerProps, "mode">) {
  return <DatePicker {...props} mode="time" />;
}
