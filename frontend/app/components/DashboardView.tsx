import React from "react";
import { useAuthStore } from "../lib/store";
import { useLanguageStore } from "../lib/i18n";
import { sidebarMenuConfig, isMenuItemAllowed, type MenuItem } from "../config/navigation";
import {
  ArrowUpRight,
  Package,
  Calendar,
} from "lucide-react";

interface DashboardViewProps {
  onNavigate: (menuId: string) => void;
}

// Color accents for compact quick action buttons (Matching sidebar domain colors)
const menuAccents: Record<string, string> = {
  pos: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-white",
  promotions: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 group-hover:bg-rose-500 group-hover:text-white",
  items: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 group-hover:bg-blue-500 group-hover:text-white",
  inventory: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20 group-hover:bg-cyan-500 group-hover:text-white",
  opname: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 group-hover:bg-purple-500 group-hover:text-white",
  produksi: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 group-hover:bg-amber-500 group-hover:text-white",
  settlements: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20 group-hover:bg-teal-500 group-hover:text-white",
  distribusi: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 group-hover:bg-sky-500 group-hover:text-white",
  procurement: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 group-hover:bg-orange-500 group-hover:text-white",
  organization: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 group-hover:bg-indigo-500 group-hover:text-white",
  users: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20 group-hover:bg-violet-500 group-hover:text-white",
  "security-logs": "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 group-hover:bg-red-500 group-hover:text-white",
  "sales-report": "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 group-hover:bg-green-500 group-hover:text-white",
  analytics: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/20 group-hover:bg-fuchsia-500 group-hover:text-white",
  superadmin: "bg-violet-600/10 text-violet-600 dark:text-violet-400 border-violet-600/20 group-hover:bg-violet-600 group-hover:text-white",
};

export default function DashboardView({ onNavigate }: DashboardViewProps) {
  const { user, activeContext } = useAuthStore();
  const { language } = useLanguageStore();

  // Filter menu buttons allowed for current user role & business context
  const allowedMenus = sidebarMenuConfig.filter(
    (menu) => menu.id !== "dashboard" && isMenuItemAllowed(menu, activeContext)
  );

  // Time-aware friendly greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (language === "id") {
      if (hour < 11) return "Selamat Pagi";
      if (hour < 15) return "Selamat Siang";
      if (hour < 18) return "Selamat Sore";
      return "Selamat Malam";
    } else {
      if (hour < 12) return "Good morning";
      if (hour < 17) return "Good afternoon";
      return "Good evening";
    }
  };

  // Human-friendly localized date
  const todayFormatted = new Intl.DateTimeFormat(
    language === "id" ? "id-ID" : "en-US",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  ).format(new Date());

  return (
    <div className="space-y-6 text-left max-w-7xl mx-auto pb-8">
      {/* ── 1. CLEAN & FRIENDLY FRAMELESS HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200/80 dark:border-[#2E2E34] gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {getGreeting()}, {user?.name || "Kasir"}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            {language === "id"
              ? "Pilih modul di bawah untuk memulai aktivitas operasional."
              : "Select a module below to start your operational activities."}
          </p>
        </div>

        {/* Localized Date Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100/80 dark:bg-white/5 text-slate-600 dark:text-slate-400 text-xs font-semibold self-start sm:self-auto border border-slate-200/60 dark:border-white/5">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{todayFormatted}</span>
        </div>
      </div>

      {/* ── 2. QUICK ACTION BUTTONS GRID (COMPACT BUTTONS) ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {language === "id" ? "Pintasan Modul" : "Module Shortcuts"}
          </h2>
          <span className="text-[11px] text-slate-400 font-bold">
            {allowedMenus.length} {language === "id" ? "Pintasan" : "Shortcuts"}
          </span>
        </div>

        {/* Compact Grid: Fits 6 items per row on desktop, 3 on tablet, 2 on mobile */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {allowedMenus.map((menu) => {
            const Icon = menu.icon || Package;
            const accent =
              menuAccents[menu.id] ||
              "bg-primary/10 text-slate-800 dark:text-primary border-primary/20 group-hover:bg-primary group-hover:text-black";

            return (
              <button
                key={menu.id}
                type="button"
                onClick={() => onNavigate(menu.id)}
                className="group relative flex flex-col justify-between p-3.5 sm:p-4 rounded-2xl border bg-white dark:bg-[#1E1E22] border-slate-200/80 dark:border-[#2E2E34] hover:border-primary/60 dark:hover:border-primary/60 hover:bg-slate-50/80 dark:hover:bg-[#2A2A2E] active:scale-[0.97] transition-all duration-200 cursor-pointer shadow-xs text-left h-28 select-none"
              >
                {/* Top Row: Icon Pill + Arrow Icon */}
                <div className="flex items-center justify-between w-full">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all duration-200 ${accent}`}
                  >
                    <Icon className="w-4.5 h-4.5 stroke-[2.2]" />
                  </div>

                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </div>

                {/* Bottom Row: Label */}
                <div className="w-full">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors line-clamp-1 block">
                    {menu.defaultLabel}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors block">
                    {language === "id" ? "Buka Modul" : "Open"} →
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
