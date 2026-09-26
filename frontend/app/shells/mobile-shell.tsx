import { useState, useEffect, useRef } from "react";
import { useAuthStore, useShellStore } from "../lib/store";
import { useLanguageStore, translations } from "../lib/i18n";
import { useTheme } from "../hooks/use-theme";
import { api } from "../lib/api";
import { useNavigate } from "react-router";
import WorkspaceSwitcher from "../components/WorkspaceSwitcher";
import WorkspaceLauncher from "../components/WorkspaceLauncher";
import POSSettingsDrawer from "../components/POSSettingsDrawer";
import POSModule from "../features/pos/pos-module";
import InventoryModule from "../features/inventory/inventory-module";
import ProcurementModule from "../features/procurement/procurement-module";
import OpnameModule from "../features/opname/opname-module";
import SalesReportModule from "../features/sales-report/sales-report-module";
import DashboardView from "../components/DashboardView";
import { ProductionModule } from "../features/production/production-module";
import { DistributionModule } from "../features/distribution/distribution-module";
import { SettlementModule } from "../features/settlement/settlement-module";
import { ItemListModule } from "../features/items/item-list-module";
import BusinessesListView from "../features/organization/businesses-list-view";
import UsersManagementView from "../features/admin/users-management-view";
import SecurityLogsView from "../features/admin/security-logs-view";
import SuperadminModule from "../features/superadmin/superadmin-module";
import { sidebarMenuConfig, isMenuItemAllowed, isSubMenuItemAllowed, getDefaultMenuId } from "../config/navigation";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "../components/ui/drawer";
import { Sun, Moon, LogOut, Menu, X, ChevronRight, Settings, Search, Plus, Sparkles } from "lucide-react";

interface MobileShellProps {
  children?: React.ReactNode;
}

export default function MobileShell({ children }: MobileShellProps) {
  const { user, activeContext, clearSession } = useAuthStore();
  const { isWorkspaceLauncherOpen, setWorkspaceLauncherOpen } = useShellStore();
  const navigate = useNavigate();
  
  // Shell States
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState("dashboard");

  // Auto-resolve grouped parent menu IDs to default child submenu IDs (e.g. "inventory" -> "inventory-master")
  useEffect(() => {
    const resolved = getDefaultMenuId(activeMenu);
    if (resolved !== activeMenu) {
      setActiveMenu(resolved);
    }
  }, [activeMenu]);

  const [productsCount, setProductsCount] = useState(0);
  const [selectedMasterItem, setSelectedMasterItem] = useState<any>(null);
  const [masterItemInitialView, setMasterItemInitialView] = useState<"master" | "new" | "wizard" | "edit">("master");
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const { isDark, toggleTheme } = useTheme();

  // Master Product Top Floating Menu Navigation States
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [mobileSearchQuery, setMobileSearchQuery] = useState("");

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    setIsScrolled(scrollTop > 20);
  };

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
        const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        setProductsCount(list.length);
      } catch (err) {
        console.error("Failed to load products count:", err);
      }
    };
    fetchProductsCount();
  }, [activeContext]);

  // Superadmin & Business Capability default menu validation
  useEffect(() => {
    if (!activeContext) return;
    const allowed = sidebarMenuConfig.filter((menu) => isMenuItemAllowed(menu, activeContext));
    const isCurrentValid = allowed.some((menu) => {
      if (menu.id === activeMenu) return true;
      if (menu.subItems?.some((sub) => sub.id === activeMenu)) return true;
      if (activeMenu.startsWith(menu.id + "-") || activeMenu.startsWith(menu.id)) return true;
      return false;
    });

    if (!isCurrentValid && allowed.length > 0) {
      if (activeContext.role === "superadmin") {
        setActiveMenu("superadmin");
      } else {
        const defaultTarget = allowed.find((m) => m.id === "dashboard") || allowed[0];
        const targetId = defaultTarget.subItems && defaultTarget.subItems.length > 0 ? defaultTarget.subItems[0].id : defaultTarget.id;
        setActiveMenu(targetId);
      }
    }
  }, [activeContext, activeMenu]);

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

  const hasAddAction = activeMenu.startsWith("inventory") || activeMenu.startsWith("procurement") || activeMenu === "superadmin";

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={!isDark ? {
        backgroundImage: "radial-gradient(circle at 50% 50%, #eae5f7 0%, #f5e3f0 35%, #D6D7DC 80%)"
      } : {
        backgroundColor: "#141416"
      }}
      className="flex flex-col h-screen overflow-hidden font-sans transition-colors duration-300 relative bg-slate-100 dark:bg-[#141416] text-slate-900 dark:text-slate-100"
    >
      
      {/* ── MASTER PRODUCT TOP FLOATING MENU (STANDARDIZED MOBILE NAVIGATION) ── */}
      
      {/* Kondisi 1: Unscrolled (isScrolled === false) -> Menu icon ONLY at top-right with NO background */}
      {!isScrolled && (
        <button
          type="button"
          onClick={() => setIsLeftDrawerOpen(true)}
          className="fixed top-3.5 right-3.5 z-40 p-2 text-slate-800 dark:text-slate-100 drop-shadow-md hover:opacity-80 active:scale-95 transition-all cursor-pointer"
          title="Menu Navigasi"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-6 h-6 stroke-[2.5]" />
        </button>
      )}

      {/* Kondisi 2: Scrolled Down & Search Inactive (isScrolled === true & !isSearchActive) */}
      {isScrolled && !isSearchActive && (
        <>
          {/* Search Trigger Button slides in from Left */}
          <button
            type="button"
            onClick={() => {
              setIsSearchActive(true);
              window.dispatchEvent(new CustomEvent("focus_mobile_search"));
            }}
            className="fixed top-3.5 left-3.5 z-40 w-10 h-10 rounded-full backdrop-blur-xl bg-slate-900/85 dark:bg-[#202024]/90 text-white flex items-center justify-center shadow-lg border border-white/20 active:scale-95 transition-all cursor-pointer animate-in slide-in-from-left-4 duration-300"
            title="Cari Data"
            aria-label="Open Floating Search"
          >
            <Search className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Combined Plus + Menu Glass Pill at Top Right */}
          <div className="fixed top-3.5 right-3.5 z-40 backdrop-blur-xl bg-slate-900/85 dark:bg-[#202024]/90 text-white rounded-full p-1.5 px-3 border border-white/20 shadow-xl flex items-center gap-1.5 transition-all duration-300 animate-in fade-in zoom-in-95">
            {hasAddAction && (
              <>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent("trigger_mobile_add"))}
                  className="p-1 hover:bg-white/10 rounded-full transition-colors active:scale-95 cursor-pointer"
                  title="Tambah Baru"
                  aria-label="Add Entry"
                >
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                </button>
                <div className="w-px h-4 bg-white/25" />
              </>
            )}
            <button
              type="button"
              onClick={() => setIsLeftDrawerOpen(true)}
              className="p-1 hover:bg-white/10 rounded-full transition-colors active:scale-95 cursor-pointer"
              title="Menu Navigasi"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </>
      )}

      {/* Kondisi 3: Scrolled Down & Search Active (isScrolled === true & isSearchActive) */}
      {isScrolled && isSearchActive && (
        <>
          {/* Full Width Floating Search Bar Pill from Left to Right */}
          <div className="fixed top-3.5 left-3.5 right-16 z-50 backdrop-blur-xl bg-white/95 dark:bg-[#202024]/95 text-slate-900 dark:text-slate-100 rounded-full border border-slate-300/80 dark:border-[#38383C] shadow-2xl px-3.5 py-1.5 flex items-center gap-2.5 transition-all duration-300 animate-in fade-in slide-in-from-left-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0 stroke-[2.5]" />
            <input
              autoFocus
              type="text"
              value={mobileSearchQuery}
              onChange={(e) => {
                setMobileSearchQuery(e.target.value);
                window.dispatchEvent(new CustomEvent("focus_mobile_search"));
              }}
              placeholder="Cari..."
              className="w-full bg-transparent text-xs font-semibold focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={() => {
                setMobileSearchQuery("");
                setIsSearchActive(false);
              }}
              className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
              title="Tutup & Reset Pencarian"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          {/* Top Right Floating Menu Button ONLY (Plus icon hidden during search) */}
          <button
            type="button"
            onClick={() => setIsLeftDrawerOpen(true)}
            className="fixed top-3.5 right-3.5 z-40 w-10 h-10 rounded-full backdrop-blur-xl bg-slate-900/85 dark:bg-[#202024]/90 text-white flex items-center justify-center shadow-lg border border-white/20 active:scale-95 transition-all cursor-pointer"
            title="Menu Navigasi"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5 stroke-[2.5]" />
          </button>
        </>
      )}

      {/* 2. Scrollable Body Area */}
      <main
        onScroll={handleScroll}
        className={`flex-1 ${isFocusPage ? "overflow-hidden p-2 sm:p-4" : "overflow-y-auto p-4 pb-8"}`}
      >
        {activeMenu === "pos" ? (
          <POSModule onNavigate={(v) => setActiveMenu(v)} />
        ) : activeMenu === "items" || activeMenu === "items-master" ? (
          <ItemListModule
            initialView={masterItemInitialView}
            initialItem={selectedMasterItem}
            onNavigate={(v) => {
              if (v === "items-master" || v === "items") {
                setSelectedMasterItem(null);
                setMasterItemInitialView("master");
              }
              setActiveMenu(v);
            }}
          />
        ) : activeMenu === "items-add" ? (
          <ItemListModule
            initialView="wizard"
            initialItem={null}
            onNavigate={(v) => {
              if (v === "items-master" || v === "items") {
                setSelectedMasterItem(null);
                setMasterItemInitialView("master");
              }
              setActiveMenu(v);
            }}
          />
        ) : activeMenu === "inventory-matrix" ? (
          <InventoryModule
            view="matrix"
            onNavigate={(v) => {
              setActiveMenu(v);
            }}
          />
        ) : activeMenu.startsWith("inventory") ? (
          <InventoryModule
            view="master"
            onViewMasterItem={(prod) => {
              setSelectedMasterItem(prod);
              setMasterItemInitialView("edit");
              setActiveMenu("items");
            }}
            onNavigate={(v, payload) => {
              if (v === "items-edit" || v === "items-detail" || v === "items-master") {
                setSelectedMasterItem(payload || null);
                setMasterItemInitialView("edit");
                setActiveMenu("items");
              } else {
                setActiveMenu(v);
              }
            }}
          />
        ) : activeMenu.startsWith("procurement") ? (
          <ProcurementModule />
        ) : activeMenu === "opname" ? (
          <OpnameModule />
        ) : activeMenu === "sales-report" ? (
          <SalesReportModule />
        ) : activeMenu === "produksi" ? (

          <ProductionModule />
        ) : activeMenu.startsWith("distribusi") ? (
          <DistributionModule />
        ) : activeMenu.startsWith("settlements") || activeMenu.startsWith("bakso-sales") ? (
          <SettlementModule />
        ) : activeMenu === "organization" || activeMenu === "organization-businesses" ? (
          <BusinessesListView />
        ) : activeMenu === "users" ? (
          <UsersManagementView onNavigateToBusinesses={() => setActiveMenu("organization")} />
        ) : activeMenu === "security-logs" ? (
          <SecurityLogsView />
        ) : activeMenu === "superadmin" ? (
          <UsersManagementView onNavigateToBusinesses={() => setActiveMenu("organization")} />
        ) : activeMenu === "dashboard" ? (
          <DashboardView onNavigate={(menuId) => setActiveMenu(menuId)} />
        ) : (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 rounded-2xl p-6 text-center space-y-1">
            <h3 className="font-semibold text-amber-800 dark:text-amber-400 text-sm">
              Modul {activeMenu.toUpperCase()} Dalam Pengembangan
            </h3>
            <p className="text-amber-700/80 dark:text-amber-500/80 text-xs max-w-xs mx-auto font-normal">
              Fitur ini akan diaktifkan pada fase pengerjaan berikutnya.
            </p>
          </div>
        )}
      </main>

      {/* 3. Shadcn UI Left Navigation Drawer */}
      <Drawer direction="left" open={isLeftDrawerOpen} onOpenChange={setIsLeftDrawerOpen}>
        <DrawerContent className="p-0 border-r border-slate-200 dark:border-[#2E2E34] bg-white dark:bg-[#1C1C20] text-slate-900 dark:text-slate-100">
          <div className="h-full flex flex-col justify-between w-full">
            {/* Header / Workspace Switcher Trigger */}
            <div className="p-4 border-b border-slate-100 dark:border-[#2A2A30] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img
                    src="/icon-192.png"
                    alt="Andaya"
                    className="w-7 h-7 object-contain rounded-lg shadow-xs"
                  />
                  <span className="font-black text-sm tracking-tight text-slate-900 dark:text-white">
                    ANDAYA GROUP
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLeftDrawerOpen(false)}
                  className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 cursor-pointer"
                >
                  <X className="w-5 h-5 stroke-[2]" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsLeftDrawerOpen(false);
                  setSwitcherOpen(true);
                }}
                className="flex items-center space-x-2.5 p-2 rounded-2xl bg-slate-50 dark:bg-[#25252A] text-left cursor-pointer min-w-0 border border-slate-200/60 dark:border-[#333338]"
              >
                <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-semibold text-xs shadow-xs shrink-0">
                  {activeContext?.name?.charAt(0) || "A"}
                </div>
                <div className="min-w-0 flex-1">
                  <DrawerTitle className="font-semibold text-xs truncate leading-tight text-slate-900 dark:text-white">
                    {activeContext?.name || "Pilih Workspace"}
                  </DrawerTitle>
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                    {activeContext?.role === "owner" ? "Owner" : activeContext?.role} ▾
                  </p>
                </div>
              </button>
            </div>

            {/* Menu List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Navigasi Modul
              </div>
              {allowedMenus.map((menu) => {
                const label = t[menu.translationKey as keyof typeof t] || menu.defaultLabel;
                const Icon = menu.icon;
                const isActive = activeMenu === menu.id || activeMenu.startsWith(menu.id + "-");

                const validSubItems = (menu.subItems || []).filter((sub) => isSubMenuItemAllowed(sub, activeContext));
                const targetId = validSubItems.length > 0 ? validSubItems[0].id : menu.id;

                return (
                  <button
                    key={menu.id}
                    type="button"
                    onClick={() => {
                      setActiveMenu(targetId);
                      setIsLeftDrawerOpen(false);
                    }}
                    className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl text-xs transition-all cursor-pointer ${
                      isActive
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs font-semibold"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 font-medium"
                    }`}
                  >
                    <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? "text-white dark:text-slate-900" : menu.iconClassName || ""}`} />
                    <span className="flex-1 text-left">{label}</span>
                    {isActive && <ChevronRight className="w-4 h-4 opacity-75 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Footer Actions: All Controls Moved From Header */}
            <div className="p-3 border-t border-slate-100 dark:border-[#2A2A30] space-y-2 bg-slate-50/50 dark:bg-white/[0.02]">
              {/* Workspace Info & Switcher Button */}
              <button
                type="button"
                onClick={() => {
                  setIsLeftDrawerOpen(false);
                  setWorkspaceLauncherOpen(true);
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200/80 dark:border-[#333338] bg-white dark:bg-[#25252A] text-left cursor-pointer transition-all hover:border-slate-300"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-semibold text-xs shadow-sm shrink-0">
                    {activeContext?.name?.charAt(0) || "A"}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-xs truncate leading-tight text-slate-900 dark:text-slate-100">
                      {activeContext?.name || "Pilih Workspace"}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                      {activeContext?.role === "owner" ? "Owner" : activeContext?.role} • {activeContext?.type || "erp"}
                    </p>
                  </div>
                </div>
                <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
              </button>

              {/* POS & Shift Settings Trigger Button */}
              <button
                type="button"
                onClick={() => {
                  setIsLeftDrawerOpen(false);
                  setSettingsDrawerOpen(true);
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium bg-white dark:bg-[#25252A] border border-slate-200/80 dark:border-[#333338] cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 text-slate-800 dark:text-slate-200 transition-colors"
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
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold bg-white dark:bg-[#25252A] border border-slate-200/80 dark:border-[#333338] cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 text-slate-800 dark:text-slate-200 transition-colors"
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
                className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Workspace Switcher / Launcher Modal */}
      <WorkspaceLauncher
        isOpen={isWorkspaceLauncherOpen}
        onClose={() => setWorkspaceLauncherOpen(false)}
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
