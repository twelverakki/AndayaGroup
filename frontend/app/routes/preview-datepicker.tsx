import React, { useState } from "react";
import { DatePicker, TimePicker } from "../components/ui/date-picker";
import { WheelCarouselDialog } from "../components/ui/wheel-carousel-dialog";
import type { WeekInfo } from "../components/ui/wheel-carousel-dialog";
import { useLanguageStore } from "../lib/i18n";
import {
  Calendar,
  Clock,
  Sparkles,
  Sun,
  Moon,
  Languages,
  CalendarDays,
  Timer,
} from "lucide-react";

export default function PreviewDatePickerPage() {
  const { language, setLanguage } = useLanguageStore();
  const isId = language === "id";

  const [dateOnly, setDateOnly] = useState("2026-10-05");
  const [dateTime, setDateTime] = useState("2026-10-05 02:00");
  const [timeOnly, setTimeOnly] = useState("14:30");
  const [weekRange, setWeekRange] = useState("2026-10-05 - 2026-10-11");
  const [weekInfo, setWeekInfo] = useState<WeekInfo | null>(null);

  const [standaloneDialogOpen, setStandaloneDialogOpen] = useState(false);
  const [standaloneDate, setStandaloneDate] = useState(new Date(2026, 9, 5, 2, 0));

  const [standaloneWeekDialogOpen, setStandaloneWeekDialogOpen] = useState(false);
  const [standaloneWeekDate, setStandaloneWeekDate] = useState(new Date(2026, 9, 5));
  const [standaloneWeekInfo, setStandaloneWeekInfo] = useState<WeekInfo | null>(null);

  const [standaloneTimeDialogOpen, setStandaloneTimeDialogOpen] = useState(false);
  const [standaloneTimeVal, setStandaloneTimeVal] = useState("18:45");

  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      return next;
    });
  };

  const toggleLang = () => {
    setLanguage(isId ? "en" : "id");
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        isDarkMode ? "dark bg-[#121214] text-slate-100" : "bg-slate-50 text-slate-900"
      }`}
    >
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#1E1E22]/80 backdrop-blur-md border-b border-slate-200/80 dark:border-[#2C2C32] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E2FF66] text-slate-900 flex items-center justify-center font-black shadow-sm">
              <Calendar className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold tracking-tight">
                  Shadcn Calendar + Samsung 3D Carousel Picker Suite
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  Tanggal • Waktu • Jam Saja • Pekan ISO
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isId
                  ? "Satu suite lengkap untuk semua varian pemilihan: Tanggal, Waktu 24-Jam, Jam Saja (Alarm Clock), dan Pekan ISO"
                  : "One complete suite for all selection variants: Date, 24-hr Time, Time Only, and ISO Week"}
              </p>
            </div>
          </div>

          {/* Quick Controls: Language & Theme */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleLang}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border border-slate-200/80 dark:border-[#38383C] bg-white dark:bg-[#25252A] text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer shadow-xs"
            >
              <Languages className="w-3.5 h-3.5 text-blue-500" />
              <span>{isId ? "Bahasa: ID" : "Language: EN"}</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border border-slate-200/80 dark:border-[#38383C] bg-white dark:bg-[#25252A] text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer shadow-xs"
            >
              {isDarkMode ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Terang</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-slate-700" />
                  <span className="hidden sm:inline">Gelap</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        
        {/* Banner Penjelasan Alur Interaksi */}
        <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2C2C32] shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-[#E2FF66]" />
            <h2 className="text-sm font-bold">
              {isId ? "4 Varian Kemampuan Terpadu:" : "4 Unified Capability Variants:"}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#26262C] border border-slate-100 dark:border-[#333338] space-y-1">
              <span className="font-extrabold text-blue-600 dark:text-[#E2FF66]">1. Tanggal Standar</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isId ? "Kalender Shadcn + klik header bulan untuk 3D carousel." : "Shadcn Calendar + header click for 3D carousel."}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#26262C] border border-slate-100 dark:border-[#333338] space-y-1">
              <span className="font-extrabold text-purple-600 dark:text-purple-400">2. Tanggal + Jam</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isId ? "Icon kalender | icon jam, dengan tombol waktu besar '(icon) TIME'." : "Calendar | clock icons with large '(icon) TIME' row."}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#26262C] border border-slate-100 dark:border-[#333338] space-y-1">
              <span className="font-extrabold text-amber-600 dark:text-amber-400">3. Jam Saja (TimePicker)</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isId ? "Pemilihan jam & menit murni ala Samsung Alarm (Happy Hour / Shift)." : "Pure hour & minute wheel like Samsung Alarm (Happy Hour / Shift)."}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#26262C] border border-slate-100 dark:border-[#333338] space-y-1">
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400">4. Mode Pekan (Week)</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isId ? "Pekan ISO dinamis (4, 5, atau 6 pekan/bulan) dengan smart tracking." : "Dynamic ISO weeks (4, 5, or 6 weeks) with smart tracking."}
              </p>
            </div>
          </div>
        </div>

        {/* 4 Showcase Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          
          {/* Showcase 1: Date Only */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2C2C32] shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-blue-600 dark:text-[#E2FF66] uppercase tracking-wider">
                  {isId ? "1 • Tanggal Saja" : "1 • Date Only"}
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {isId ? "Format: 5 Okt 2026" : "Format: 5 Oct 2026"}
                </h3>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {isId ? "Tanggal Transaksi:" : "Transaction Date:"}
                </label>
                <DatePicker
                  value={dateOnly}
                  onChange={(val) => setDateOnly(val)}
                  placeholder={isId ? "Pilih tanggal..." : "Select date..."}
                />
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#25252A] text-xs font-mono space-y-0.5">
              <span className="text-[10px] text-slate-500">Value:</span>
              <p className="font-bold text-slate-800 dark:text-slate-100 truncate text-[11px]">
                <span className="text-blue-600 dark:text-[#E2FF66]">"{dateOnly}"</span>
              </p>
            </div>
          </div>

          {/* Showcase 2: Date + Time */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2C2C32] shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                  {isId ? "2 • Tanggal + Waktu" : "2 • Date + Time"}
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {isId ? "Format: 5 Okt 2026 02:00" : "Format: 5 Oct 2026 02:00"}
                </h3>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {isId ? "Jadwal & Waktu:" : "Schedule & Time:"}
                </label>
                <DatePicker
                  showTime={true}
                  value={dateTime}
                  onChange={(val) => setDateTime(val)}
                  placeholder={isId ? "Pilih tanggal & jam..." : "Select date & time..."}
                />
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#25252A] text-xs font-mono space-y-0.5">
              <span className="text-[10px] text-slate-500">Value:</span>
              <p className="font-bold text-slate-800 dark:text-slate-100 truncate text-[11px]">
                <span className="text-purple-600 dark:text-purple-400">"{dateTime}"</span>
              </p>
            </div>
          </div>

          {/* Showcase 3: Time Only (TimePicker) */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2C2C32] shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  {isId ? "3 • Jam Saja (TimePicker)" : "3 • Time Only (TimePicker)"}
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {isId ? "Format: 14:30 (24-Jam)" : "Format: 14:30 (24-Hour)"}
                </h3>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {isId ? "Jam Operasional / Promo:" : "Operating / Promo Hour:"}
                </label>
                <TimePicker
                  value={timeOnly}
                  onChange={(val) => setTimeOnly(val)}
                  placeholder={isId ? "Pilih jam..." : "Select time..."}
                />
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#25252A] text-xs font-mono space-y-0.5">
              <span className="text-[10px] text-slate-500">Value:</span>
              <p className="font-bold text-slate-800 dark:text-slate-100 truncate text-[11px]">
                <span className="text-amber-600 dark:text-amber-400">"{timeOnly}"</span>
              </p>
            </div>
          </div>

          {/* Showcase 4: Week Mode */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2C2C32] shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  {isId ? "4 • Mode Pekan (Week ISO)" : "4 • ISO Week Mode"}
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {isId ? "Format: Rentang Pekan" : "Format: Week Range"}
                </h3>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {isId ? "Pekan Laporan:" : "Report Week:"}
                </label>
                <DatePicker
                  mode="week"
                  value={weekRange}
                  onChange={(val) => setWeekRange(val)}
                  onWeekChange={(info) => setWeekInfo(info)}
                  placeholder={isId ? "Pilih pekan..." : "Select week..."}
                />
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#25252A] text-xs font-mono space-y-0.5">
              <span className="text-[10px] text-slate-500">Value:</span>
              <p className="font-bold text-slate-800 dark:text-slate-100 truncate text-[11px]">
                <span className="text-emerald-600 dark:text-[#E2FF66]">"{weekRange}"</span>
              </p>
            </div>
          </div>

        </div>

        {/* Standalone Carousel Dialog Triggers (Date, Week, Time) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {/* Standalone Date & Time */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2C2C32] shadow-sm space-y-3">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-blue-600 dark:text-[#E2FF66] uppercase tracking-wider">
                {isId ? "Standalone • Tanggal" : "Standalone • Date"}
              </span>
              <h3 className="text-sm font-bold">WheelCarouselDialog (Date)</h3>
            </div>
            <button
              type="button"
              onClick={() => setStandaloneDialogOpen(true)}
              className="w-full py-2 px-3 rounded-2xl text-xs font-bold bg-[#E2FF66] text-slate-900 hover:bg-[#d4f54c] shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{isId ? "Buka Dialog Tanggal" : "Open Date Wheel"}</span>
            </button>
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#25252A] text-[11px] font-mono truncate">
              {standaloneDate.toLocaleDateString(isId ? "id-ID" : "en-US", { day: "numeric", month: "short", year: "numeric" })}
            </div>
          </div>

          {/* Standalone Time Only */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2C2C32] shadow-sm space-y-3">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                {isId ? "Standalone • Jam Saja" : "Standalone • Time Only"}
              </span>
              <h3 className="text-sm font-bold">WheelCarouselDialog (Time)</h3>
            </div>
            <button
              type="button"
              onClick={() => setStandaloneTimeDialogOpen(true)}
              className="w-full py-2 px-3 rounded-2xl text-xs font-bold bg-[#E2FF66] text-slate-900 hover:bg-[#d4f54c] shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Timer className="w-3.5 h-3.5" />
              <span>{isId ? "Buka Dialog Jam Saja" : "Open Time Wheel"}</span>
            </button>
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#25252A] text-[11px] font-mono truncate font-bold text-amber-600 dark:text-amber-400">
              {standaloneTimeVal} WIB
            </div>
          </div>

          {/* Standalone Week Carousel */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2C2C32] shadow-sm space-y-3">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                {isId ? "Standalone • Pekan" : "Standalone • Week"}
              </span>
              <h3 className="text-sm font-bold">WheelCarouselDialog (Week)</h3>
            </div>
            <button
              type="button"
              onClick={() => setStandaloneWeekDialogOpen(true)}
              className="w-full py-2 px-3 rounded-2xl text-xs font-bold bg-[#E2FF66] text-slate-900 hover:bg-[#d4f54c] shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>{isId ? "Buka Dialog Pekan" : "Open Week Wheel"}</span>
            </button>
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#25252A] text-[11px] font-mono truncate text-emerald-600 dark:text-[#E2FF66] font-bold">
              {standaloneWeekInfo ? standaloneWeekInfo.rangeLabelId : "05 Okt 2026 - 11 Okt 2026"}
            </div>
          </div>
        </div>

      </main>

      {/* Standalone Date & Time Carousel Dialog */}
      <WheelCarouselDialog
        open={standaloneDialogOpen}
        onOpenChange={setStandaloneDialogOpen}
        initialDate={standaloneDate}
        showTime={true}
        onApply={(d) => setStandaloneDate(d)}
      />

      {/* Standalone Time Only Carousel Dialog */}
      <WheelCarouselDialog
        open={standaloneTimeDialogOpen}
        onOpenChange={setStandaloneTimeDialogOpen}
        initialDate={new Date(2026, 0, 1, parseInt(standaloneTimeVal.split(":")[0] || "18", 10), parseInt(standaloneTimeVal.split(":")[1] || "45", 10))}
        mode="time"
        onApply={(d) => {
          setStandaloneTimeVal(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
        }}
        onApplyTime={(t) => setStandaloneTimeVal(t)}
      />

      {/* Standalone Week Carousel Dialog */}
      <WheelCarouselDialog
        open={standaloneWeekDialogOpen}
        onOpenChange={setStandaloneWeekDialogOpen}
        initialDate={standaloneWeekDate}
        mode="week"
        onApply={(d, info) => {
          setStandaloneWeekDate(d);
          if (info) setStandaloneWeekInfo(info);
        }}
        onApplyWeek={(info) => setStandaloneWeekInfo(info)}
      />
    </div>
  );
}
