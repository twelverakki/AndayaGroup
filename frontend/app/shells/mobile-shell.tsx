import { useState, useEffect } from "react";
import { useAuthStore } from "../lib/store";
import { useLanguageStore, translations } from "../lib/i18n";
import { useTheme } from "../hooks/use-theme";
import { api } from "../lib/api";
import { useNavigate } from "react-router";
import WorkspaceSwitcher from "../components/WorkspaceSwitcher";
import POSSettingsDrawer from "../components/POSSettingsDrawer";
import POSModule from "../features/pos/pos-module";
import InventoryModule from "../features/inventory/inventory-module";
import ProcurementModule from "../features/procurement/procurement-module";

import SuperadminModule from "../features/superadmin/superadmin-module";
import { sidebarMenuConfig, isMenuItemAllowed } from "../config/navigation";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "../components/ui/drawer";
import { Sun, Moon, LogOut, Menu, X, ChevronRight, Settings } from "lucide-react";

interface MobileShellProps {
  children?: React.ReactNode;
}

export default function MobileShell({ children }: MobileShellProps) {
  const { user, activeContext, clearSession } = useAuthStore();
  const navigate = useNavigate();
  
  // Shell States
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [productsCount, setProductsCount] = useState(0);
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const { isDark, toggleTheme } = useTheme();

  const isFocusPage = activeMenu === "pos";

  // Touch Gesture: Left Edge Swipe to open Navigation Drawer (Gemini Mobile UI pattern)
  const handleTouchStart = (e: React.TouchEvent) => {
    const clientX = e.touches[0].clientX;
    if (clientX < 35 || isLeftDrawerOpen) {
      setTouchStartX(clientX);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX;

    if (touchStartX < 35 && deltaX > 50) {
      setIsLeftDrawerOpen(true);
    } else if (isLeftDrawerOpen && deltaX < -50) {
      setIsLeftDrawerOpen(false);
    }

    setTouchStartX(null);
  };

  useEffect(() => {
    const handleOpenMenu = () => setIsLeftDrawerOpen(true);
    window.addEventListener("open_mobile_menu", handleOpenMenu);
    return () => window.removeEventListener("open_mobile_menu", handleOpenMenu);
  }, []);

  useEffect(() => {
    const fetchProductsCount = async () => {
      if (!activeContext) return;
      try {
        const res = await api.get("/products");
        setProductsCount(res.data.length);
      } catch (err) {
        console.error("Failed to load products count:", err);
      }
    };
    fetchProductsCount();
  }, [activeContext]);

  useEffect(() => {
    if (activeContext?.role === "superadmin") {
      setActiveMenu("superadmin");
    } else {
      setActiveMenu("dashboard");
    }
  }, [activeContext]);

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
      clearSession();
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const { language } = useLanguageStore();
  const t = translations[language];

  const allowedMenus = sidebarMenuConfig.filter((menu) =>
    isMenuItemAllowed(menu, activeContext)
  );

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={!isDark ? {
        backgroundImage: "radial-gradient(circle at 50% 50%, #eae5f7 0%, #f5e3f0 35%, #D6D7DC 80%)"
      } : undefined}
      className={`flex flex-col h-screen overflow-hidden font-sans transition-colors duration-300 relative ${
        isDark ? "dark bg-[#1E1E1E] text-[#F8FAFC]" : "text-neutral-dark"
      }`}
    >
      
      {/* 1. Floating Action Menu Button (Icon-Only, Floating Glass Pill for Non-Inventory Pages) */}
      {activeMenu !== "inventory" && (
        <button
          type="button"
          onClick={() => setIsLeftDrawerOpen(true)}
          className="fixed top-3 right-3 z-40 w-10 h-10 rounded-full backdrop-blur-md bg-slate-900/80 dark:bg-white/15 text-white flex items-center justify-center shadow-lg active:scale-95 transition-all cursor-pointer border border-white/20"
          title="Buka Navigasi"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5 stroke-[2.5]" />
        </button>
      )}

      {/* Floating Settings Button for POS Focus Page */}
      {isFocusPage && (
        <button
          type="button"
          onClick={() => setSettingsDrawerOpen(true)}
          className="fixed top-3 right-15 z-40 w-10 h-10 rounded-full backdrop-blur-md bg-slate-900/80 dark:bg-white/15 text-white flex items-center justify-center shadow-lg active:scale-95 transition-all cursor-pointer border border-white/20"
          title="Pengaturan POS & Shift"
          aria-label="Open POS Settings"
        >
          <Settings className="w-5 h-5 stroke-[2.5]" />
        </button>
      )}

      {/* 2. Scrollable Body Area */}
      <main className={`flex-1 ${isFocusPage ? "overflow-hidden p-2 sm:p-4" : "overflow-y-auto p-4 pb-8"}`}>
        {activeMenu === "pos" ? (
          <POSModule />
        ) : activeMenu === "inventory" ? (
          <InventoryModule />
        ) : activeMenu === "procurement" ? (
          <ProcurementModule />
        ) : activeMenu === "produksi" ? (
          <div className="p-4">Produksi Placeholder</div>
        ) : activeMenu === "distribusi" ? (
          <div className="p-4">Distribusi Placeholder</div>
        ) : activeMenu === "superadmin" ? (
          <SuperadminModule />
        ) : activeMenu === "dashboard" ? (
          <div className="space-y-4">
            {/* Chunky card banner */}
            <div className={`border rounded-card p-6 shadow-sm transition-colors ${
              isDark ? "bg-dark-card-lighter border-dark-border-lighter" : "bg-white border-slate-200"
            }`}>
              <h2 className="text-lg font-bold mb-2">Andaya ERP Mobile</h2>
              <p className="opacity-80 text-xs font-medium leading-relaxed mb-4">
                Sistem ERP multi-tenant untuk bisnis retail & F&B. Workspace aktif disinkronkan otomatis secara aman di sisi klien.
              </p>
              
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-400 rounded-button border border-emerald-100 dark:border-emerald-900/50 text-xs font-semibold">
                Context: {activeContext?.name}
              </div>
            </div>

            {/* Quick stats placeholder */}
            <div className="grid grid-cols-2 gap-4">
              <div className={`border rounded-card p-4 shadow-sm flex flex-col justify-between h-28 transition-colors ${
                isDark ? "bg-dark-card-lighter border-dark-border-lighter" : "bg-white border-slate-200"
              }`}>
                <span className="text-[10px] text-muted-foreground font-bold uppercase">Sales Hari Ini</span>
                <span className="text-lg font-semibold">Rp 0</span>
              </div>
              <div className={`border rounded-card p-4 shadow-sm flex flex-col justify-between h-28 transition-colors ${
                isDark ? "bg-dark-card-lighter border-dark-border-lighter" : "bg-white border-slate-200"
              }`}>
                <span className="text-[10px] text-muted-foreground font-bold uppercase">Stok Terbuka</span>
                <span className="text-lg font-semibold">{productsCount} SKU</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 rounded-card p-6 text-center">
            <span className="text-3xl mb-2 block">🛠️</span>
            <h3 className="font-semibold text-amber-800 dark:text-amber-450 text-sm mb-1">
              Modul {activeMenu.toUpperCase()} dalam Pengembangan
            </h3>
            <p className="text-amber-700/80 dark:text-amber-500/80 text-xs max-w-xs mx-auto">
              Fitur ini akan diaktifkan pada fase pengerjaan berikutnya.
            </p>
          </div>
        )}
      </main>

      {/* 3. Shadcn UI Left Navigation Drawer */}
      <Drawer direction="left" open={isLeftDrawerOpen} onOpenChange={setIsLeftDrawerOpen}>
        <DrawerContent className="p-0 border-r border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#202024]">
          <div className="h-full flex flex-col justify-between w-full">
            {/* Header / Workspace Switcher Trigger */}
            <DrawerHeader className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-left">
              <button
                type="button"
                onClick={() => {
                  setIsLeftDrawerOpen(false);
                  setSwitcherOpen(true);
                }}
                className="flex items-center space-x-2.5 text-left cursor-pointer min-w-0"
              >
                <div className="w-9 h-9 rounded-full bg-brand-purple flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
                  {activeContext?.name?.charAt(0) || "A"}
                </div>
                <div className="min-w-0">
                  <DrawerTitle className="font-bold text-sm truncate leading-tight">
                    {activeContext?.name || "Pilih Workspace"}
                  </DrawerTitle>
                  <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">
                    {activeContext?.role === "owner" ? "Owner" : activeContext?.role} ▾
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsLeftDrawerOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </DrawerHeader>

            {/* Menu List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Navigasi Modul
              </div>
              {allowedMenus.map((menu) => {
                const label = t[menu.translationKey as keyof typeof t] || menu.defaultLabel;
                const Icon = menu.icon;
                const isActive = activeMenu === menu.id || activeMenu.startsWith(menu.id + "-");

                return (
                  <button
                    key={menu.id}
                    type="button"
                    onClick={() => {
                      setActiveMenu(menu.id);
                      setIsLeftDrawerOpen(false);
                    }}
                    className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? isDark
                          ? "bg-[#E2FF66] text-[#1A1A1A] font-black shadow-sm"
                          : "bg-[#1A1A1A] text-white font-black shadow-sm"
                        : isDark
                          ? "text-slate-300 hover:bg-white/10"
                          : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className={`w-4.5 h-4.5 ${menu.iconClassName || ""}`} />
                    <span className="flex-1 text-left">{label}</span>
                    {isActive && <ChevronRight className="w-4 h-4 opacity-75" />}
                  </button>
                );
              })}
            </div>

            {/* Footer Actions: All Controls Moved From Header */}
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-2 bg-slate-50/50 dark:bg-white/[0.02]">
              {/* Workspace Info & Switcher Button */}
              <button
                type="button"
                onClick={() => {
                  setIsLeftDrawerOpen(false);
                  setSwitcherOpen(true);
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200/80 dark:border-dark-border bg-white dark:bg-dark-card text-left cursor-pointer transition-all hover:border-slate-300"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-brand-purple flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0">
                    {activeContext?.name?.charAt(0) || "A"}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs truncate leading-tight text-slate-900 dark:text-slate-100">
                      {activeContext?.name || "Pilih Workspace"}
                    </h4>
                    <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">
                      {activeContext?.role === "owner" ? "Owner" : activeContext?.role} • {activeContext?.type || "erp"}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-400">▾</span>
              </button>

              {/* POS & Shift Settings Trigger Button */}
              <button
                type="button"
                onClick={() => {
                  setIsLeftDrawerOpen(false);
                  setSettingsDrawerOpen(true);
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold bg-white dark:bg-dark-card border border-slate-200/80 dark:border-dark-border cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 text-slate-800 dark:text-slate-200 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-slate-500" />
                  <span>Pengaturan & Shift</span>
                </span>
              </button>

              {/* Theme Toggle Button */}
              <button
                type="button"
                onClick={toggleTheme}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold bg-white dark:bg-dark-card border border-slate-200/80 dark:border-dark-border cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 text-slate-800 dark:text-slate-200 transition-colors"
              >
                <span className="flex items-center gap-2">
                  {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
                  <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
                </span>
              </button>

              {/* Logout Button */}
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-red-500 hover:bg-red-500/10 cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Workspace Switcher Modal */}
      <WorkspaceSwitcher
        isOpen={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
      />

      {/* POS & Shift Settings Drawer */}
      <POSSettingsDrawer
        open={settingsDrawerOpen}
        onOpenChange={setSettingsDrawerOpen}
        activeMenu={activeMenu}
      />

    </div>
  );
}
