import React from "react";
import { useAuthStore } from "../lib/store";
import { useLanguageStore } from "../lib/i18n";
import { sidebarMenuConfig, isMenuItemAllowed, type MenuItem } from "../config/navigation";
import {
  ArrowUpRight,
  Sparkles,
  Store,
  Package,
  LayoutDashboard
} from "lucide-react";

interface DashboardViewProps {
  onNavigate: (menuId: string) => void;
}

// Color accents for compact quick action buttons
const menuAccents: Record<string, string> = {
  pos: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-white",
  inventory: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 group-hover:bg-blue-500 group-hover:text-white",
  opname: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 group-hover:bg-purple-500 group-hover:text-white",
  procurement: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 group-hover:bg-amber-500 group-hover:text-white",
  "sales-report": "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 group-hover:bg-indigo-500 group-hover:text-white",
  analytics: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 group-hover:bg-rose-500 group-hover:text-white",
  produksi: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 group-hover:bg-orange-500 group-hover:text-white",
  distribusi: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20 group-hover:bg-cyan-500 group-hover:text-white",
  superadmin: "bg-violet-600/10 text-violet-600 dark:text-violet-400 border-violet-600/20 group-hover:bg-violet-600 group-hover:text-white",
};

export default function DashboardView({ onNavigate }: DashboardViewProps) {
  const { user, activeContext } = useAuthStore();
  const { language } = useLanguageStore();

  // Filter menu buttons allowed for current user role & business context
  const allowedMenus = sidebarMenuConfig.filter(
    (menu) => menu.id !== "dashboard" && isMenuItemAllowed(menu, activeContext)
  );

  return (
    <div className="space-y-5 text-left max-w-7xl mx-auto pb-8">
      
      {/* ── COMPACT WELCOME HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-[#38383C] bg-white dark:bg-[#202024] shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {language === "id" ? "Halo" : "Hello"}, {user?.name || "Kasir"} 👋
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-primary/15 dark:bg-primary/20 text-slate-900 dark:text-primary text-[11px] font-bold border border-primary/30 hidden sm:inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3 stroke-[2.5]" />
              <span>Lean ERP</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {language === "id"
              ? "Pintasan cepat untuk mengakses seluruh modul operasional bisnis Anda."
              : "Quick shortcuts to access all your operational business modules."}
          </p>
        </div>

        {/* Workspace Info Chip */}
        {activeContext && (
          <div className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#2A2A2E] border border-slate-200/80 dark:border-dark-border text-xs font-semibold shrink-0">
            <Store className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-slate-800 dark:text-slate-100 truncate text-xs">
                {activeContext.name}
              </div>
              <div className="text-[10px] text-slate-400 font-medium truncate">
                {activeContext.outlet_name || "Outlet Utama"} ({activeContext.role})
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── QUICK ACTION BUTTONS GRID (COMPACT BUTTONS) ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <LayoutDashboard className="w-3.5 h-3.5 text-primary stroke-[2.5]" />
            <span>{language === "id" ? "Pintasan Menu Utama" : "Quick Action Buttons"}</span>
          </h3>
          <span className="text-[11px] text-slate-400 font-bold">
            {allowedMenus.length} {language === "id" ? "Pintasan" : "Shortcuts"}
          </span>
        </div>

        {/* Compact Grid: Fits 6 items per row on desktop, 3 on tablet, 2 on mobile */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {allowedMenus.map((menu) => {
            const Icon = menu.icon || Package;
            const accent = menuAccents[menu.id] || "bg-primary/10 text-slate-800 dark:text-primary border-primary/20 group-hover:bg-primary group-hover:text-black";

            return (
              <button
                key={menu.id}
                type="button"
                onClick={() => onNavigate(menu.id)}
                className="group relative flex flex-col justify-between p-3.5 sm:p-4 rounded-2xl border bg-white dark:bg-[#202024] border-slate-200/80 dark:border-[#38383C] hover:border-primary/60 dark:hover:border-primary/60 hover:bg-slate-50/80 dark:hover:bg-[#2A2A2E] active:scale-[0.97] transition-all duration-200 cursor-pointer shadow-xs text-left h-28 select-none"
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

                {/* Bottom Row: Compact Label */}
                <div className="w-full">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors line-clamp-1 block">
                    {menu.defaultLabel}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors block">
                    {language === "id" ? "Buka Menu" : "Open"} →
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
