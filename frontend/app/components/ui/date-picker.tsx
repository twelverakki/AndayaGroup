import React, { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "./popover";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn } from "../../lib/utils";

interface DatePickerProps {
  value?: string; // "YYYY-MM-DD"
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const DAY_NAMES_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export function DatePicker({
  value,
  onChange,
  placeholder = "Pilih tanggal",
  className,
  disabled = false,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);

  // Parse initial view date
  const parsedDate = value ? new Date(value + "T00:00:00") : new Date();
  const [viewYear, setViewYear] = useState(parsedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsedDate.getMonth());

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Calculate calendar days
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const handleSelectDay = (dayNum: number) => {
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(dayNum).padStart(2, "0");
    const formatted = `${viewYear}-${mm}-${dd}`;
    onChange(formatted);
    setOpen(false);
  };

  const handleSelectToday = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    setViewYear(yyyy);
    setViewMonth(today.getMonth());
    onChange(`${yyyy}-${mm}-${dd}`);
    setOpen(false);
  };

  // Format display string
  const formatDisplay = (valStr?: string) => {
    if (!valStr) return placeholder;
    const d = new Date(valStr + "T00:00:00");
    if (isNaN(d.getTime())) return valStr;
    const day = d.getDate();
    const monthName = MONTH_NAMES_ID[d.getMonth()].substring(0, 3);
    const year = d.getFullYear();
    return `${day} ${monthName} ${year}`;
  };

  const selectedDateObj = value ? new Date(value + "T00:00:00") : null;
  const isSelectedDay = (dayNum: number) => {
    if (!selectedDateObj) return false;
    return (
      selectedDateObj.getFullYear() === viewYear &&
      selectedDateObj.getMonth() === viewMonth &&
      selectedDateObj.getDate() === dayNum
    );
  };

  const todayObj = new Date();
  const isTodayDay = (dayNum: number) => {
    return (
      todayObj.getFullYear() === viewYear &&
      todayObj.getMonth() === viewMonth &&
      todayObj.getDate() === dayNum
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "flex items-center justify-between gap-2 px-3 py-1.5 rounded-2xl border bg-white dark:bg-[#25252A] border-slate-200/80 dark:border-[#333338] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-pointer select-none outline-none disabled:opacity-50",
          className
        )}
      >
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className={cn(!value && "text-slate-400 font-normal")}>
            {formatDisplay(value)}
          </span>
        </div>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-3 space-y-3 shadow-2xl">
        {/* Month Header & Controls */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
          </button>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
            {MONTH_NAMES_ID[viewMonth]} {viewYear}
          </span>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 text-center">
          {DAY_NAMES_ID.map((d) => (
            <span key={d} className="text-[10px] font-semibold text-slate-400">
              {d}
            </span>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const selected = isSelectedDay(dayNum);
            const today = isTodayDay(dayNum);

            return (
              <button
                key={dayNum}
                type="button"
                onClick={() => handleSelectDay(dayNum)}
                className={cn(
                  "w-7 h-7 mx-auto rounded-full text-xs font-semibold flex items-center justify-center transition-all cursor-pointer",
                  selected
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                    : today
                    ? "border border-slate-900/40 dark:border-white/40 text-slate-900 dark:text-white"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"
                )}
              >
                {dayNum}
              </button>
            );
          })}
        </div>

        {/* Footer Quick Action */}
        <div className="pt-2 border-t border-slate-100 dark:border-[#333338] flex items-center justify-between">
          <button
            type="button"
            onClick={handleSelectToday}
            className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:underline cursor-pointer"
          >
            Hari Ini
          </button>
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="text-[11px] font-semibold text-slate-400 hover:text-red-500 cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
