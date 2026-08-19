import { useState, useEffect } from "react";
import { useAuthStore } from "../lib/store";
import { useLanguageStore, translations } from "../lib/i18n";
import { api } from "../lib/api";
import { useNavigate } from "react-router";
import POSModule from "./POSModule";
import InventoryModule from "./InventoryModule";
import ProcurementModule from "./ProcurementModule";
import OpnameModule from "./OpnameModule";
import SalesReportModule from "./SalesReportModule";
import { sidebarMenuConfig } from "../config/navigation";
import SuperadminModule from "./SuperadminModule";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
} from "./ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "./ui/drawer";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  FileSpreadsheet,
  BarChart3,
  TrendingUp,
  ChevronsUpDown,
  LogOut,
  Sun,
  Moon,
  ClipboardCheck,
  ChevronDown,
  ChevronRight,
  Settings,
  Calendar,
  Bell,
  Globe,
  AlertCircle,
  CheckCircle2,
  Wrench,
  History,
  Calculator,
  Layers,
  Shield,
  Send
} from "lucide-react";
import TransactionHistoryDrawer from "./TransactionHistoryDrawer";

interface Product {
  id: string;
  name: string;
  sku?: string;
  category?: string;
  unit_type: string;
  inventory_mode: string;
  purchase_price: number;
  sell_price: number;
  current_stock: number;
  min_stock_alert?: number;
  image_url?: string;
  status: "active" | "inactive" | "discontinued";
}

export default function DesktopShell() {
  const { user, workspaces, activeContext, updateActiveContext, clearSession, activeShift, setActiveShift } = useAuthStore();
  const { language, setLanguage } = useLanguageStore();
  const t = translations[language] || translations.id;
  const navigate = useNavigate();

  // Close Shift states
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [closingCashActual, setClosingCashActual] = useState("");
  const [closingError, setClosingError] = useState("");
  const [closingLoading, setClosingLoading] = useState(false);

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setClosingLoading(true);
    setClosingError("");
    try {
      await api.post("/shifts/close", {
        closing_cash_actual: parseInt(closingCashActual) || 0,
      });
      setActiveShift(null);
      setShowCloseShiftModal(false);
      setClosingCashActual("");
      alert("Shift kasir berhasil ditutup!");
    } catch (err: any) {
      setClosingError(err.response?.data?.message || "Gagal menutup shift kasir");
    } finally {
      setClosingLoading(false);
    }
  };
  
  // Navigation & Shell States
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [isDark, setIsDark] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(true);
  const [procurementOpen, setProcurementOpen] = useState(true);
  
  // Popover & Drawer States
  const [showProfilePopover, setShowProfilePopover] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState<"settings" | "calendar" | "notifications" | null>(null);
  const [showSettingsHistoryDrawer, setShowSettingsHistoryDrawer] = useState(false);
  const [isToolsGroupExpanded, setIsToolsGroupExpanded] = useState(false);

  // POS Preferences (Passed to POSModule / synced via events)
  const [showNumpad, setShowNumpad] = useState(() => {
    const saved = localStorage.getItem("pos_show_numpad");
    return saved === null ? true : saved === "true";
  });
  const [gridCols, setGridCols] = useState(() => {
    const saved = localStorage.getItem("pos_grid_cols");
    return saved === null ? 4 : parseInt(saved);
  });
  const [posEnableTax, setPosEnableTax] = useState(() => {
    return localStorage.getItem("pos_enable_tax") === "true";
  });
  const [posEnableDiscount, setPosEnableDiscount] = useState(() => {
    return localStorage.getItem("pos_enable_discount") === "true";
  });
  const [posTaxRate, setPosTaxRate] = useState(() => {
    const saved = localStorage.getItem("pos_tax_rate");
    return saved ? Number(saved) : 11;
  });
  const [posDiscountRate, setPosDiscountRate] = useState(() => {
    const saved = localStorage.getItem("pos_discount_rate");
    return saved ? Number(saved) : 0;
  });

  const handleSetShowNumpad = (val: boolean) => {
    setShowNumpad(val);
    localStorage.setItem("pos_show_numpad", val ? "true" : "false");
    window.dispatchEvent(new Event("pos_settings_changed"));
  };

  const handleSetGridCols = (val: number) => {
    setGridCols(val);
    localStorage.setItem("pos_grid_cols", val.toString());
    window.dispatchEvent(new Event("pos_settings_changed"));
  };

  const handleSetEnableTax = (val: boolean) => {
    setPosEnableTax(val);
    localStorage.setItem("pos_enable_tax", val ? "true" : "false");
    window.dispatchEvent(new Event("pos_settings_changed"));
  };

  const handleSetEnableDiscount = (val: boolean) => {
    setPosEnableDiscount(val);
    localStorage.setItem("pos_enable_discount", val ? "true" : "false");
    window.dispatchEvent(new Event("pos_settings_changed"));
  };

  const handleSetTaxRate = (val: number) => {
    setPosTaxRate(val);
    localStorage.setItem("pos_tax_rate", val.toString());
    window.dispatchEvent(new Event("pos_settings_changed"));
  };

  const handleSetDiscountRate = (val: number) => {
    setPosDiscountRate(val);
    localStorage.setItem("pos_discount_rate", val.toString());
    window.dispatchEvent(new Event("pos_settings_changed"));
  };

  // Product Editing state (for inventory sub-view)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Initialize Theme
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (savedTheme === "dark" || (!savedTheme && systemPrefersDark)) {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    } else {
      document.documentElement.classList.remove("dark");
      setIsDark(false);
    }
  }, []);

  // Superadmin default menu toggle
  useEffect(() => {
    if (activeContext?.role === "superadmin") {
      setActiveMenu("superadmin");
    } else {
      setActiveMenu("dashboard");
    }
  }, [activeContext]);

  const toggleDarkMode = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  // Global Keyboard Shortcuts (Sidebar Expand/Collapse & Tools Group)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      // 1. Sidebar Expand/Collapse: Ctrl + B or Cmd + B
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsSidebarCollapsed((prev) => !prev);
        return;
      }

      // 2. Settings Drawer: Alt + S or (Ctrl + ,)
      if ((e.altKey && e.key.toLowerCase() === "s") || ((e.ctrlKey || e.metaKey) && e.key === ",")) {
        e.preventDefault();
        setActiveDrawer((prev) => (prev === "settings" ? null : "settings"));
        setShowProfilePopover(false);
        return;
      }

      // 3. Calendar Drawer: Alt + C
      if (e.altKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        setActiveDrawer((prev) => (prev === "calendar" ? null : "calendar"));
        setShowProfilePopover(false);
        return;
      }

      // 4. Notifications Drawer: Alt + N
      if (e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setActiveDrawer((prev) => (prev === "notifications" ? null : "notifications"));
        setShowProfilePopover(false);
        return;
      }

      // 5. Theme Toggle: Alt + T
      if (e.altKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        toggleDarkMode();
        return;
      }

      // 6. Escape key: Close any open drawer / popover
      if (e.key === "Escape") {
        if (activeDrawer) {
          e.preventDefault();
          setActiveDrawer(null);
        }
        if (showProfilePopover) {
          setShowProfilePopover(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeDrawer, showProfilePopover, isDark]);

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
      clearSession();
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleSwitchWorkspace = async (ws: any) => {
    try {
      const payload = {
        business_id: ws.business_id || "",
        outlet_id: ws.outlet_id || "",
      };
      const response = await api.post("/auth/switch-business", payload);
      setActiveMenu("dashboard");
      updateActiveContext(response.data.active_context);
    } catch (err) {
      console.error("Workspace switch failed:", err);
    }
  };

  return (
    <div 
      style={!isDark ? {
        backgroundImage: "radial-gradient(circle at 50% 50%, #eae5f7 0%, #f5e3f0 35%, #D6D7DC 80%)"
      } : undefined}
      className={`w-full min-h-screen font-sans transition-colors duration-300 ${
        isDark ? "dark bg-[#1E1E1E] text-[#F8FAFC]" : "text-[#2B2B2B]"
      }`}
    >
      {/* Custom Scrollbars */}
      <style dangerouslySetInnerHTML={{__html: `
        ::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(147, 98, 252, 0.25);
          border-radius: 99px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(147, 98, 252, 0.6);
        }
      `}} />

      <div className="flex h-screen overflow-hidden">
        
        {/* ================= MODULAR SHADCN LEFT SIDEBAR ================= */}
        <SidebarProvider open={!isSidebarCollapsed} onOpenChange={(open) => setIsSidebarCollapsed(!open)}>
          <Sidebar collapsible="icon" className="border-none bg-transparent">
            {/* 1. Header: Brand Logo & Workspace Switcher & Toggle */}
            <SidebarHeader className="p-0 mb-4 flex flex-col items-center gap-2">
              <div className={`flex items-center justify-between w-full ${isSidebarCollapsed ? "flex-col gap-4" : "flex-row"}`}>
                <DropdownMenu>
                  <DropdownMenuTrigger className={`w-full flex items-center space-x-3 p-1.5 rounded-xl transition-all cursor-pointer text-left outline-none ${
                    isDark ? "hover:bg-white/10" : "hover:bg-black/5"
                  }`}>
                    <div className="w-8 h-8 rounded-lg bg-[#9362FC] flex items-center justify-center text-white font-bold shrink-0 shadow-sm" title={activeContext?.name}>
                      {activeContext?.name?.charAt(0) || "W"}
                    </div>
                    {!isSidebarCollapsed && (
                      <div className="min-w-0 flex-1 leading-tight animate-fade-in">
                        <span className={`font-bold text-sm tracking-tight truncate block ${isDark ? "text-white" : "text-[#2B2B2B]"}`}>
                          {activeContext?.name || "Workspace"}
                        </span>
                        <p className="text-[10px] opacity-60 truncate capitalize">
                          {activeContext?.role || "Staff"} Account
                        </p>
                      </div>
                    )}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 rounded-xl" align="start" side="bottom" sideOffset={4}>
                    <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider px-2 py-1.5">
                      {t.menuWorkspaceSelect}
                    </div>
                    <DropdownMenuSeparator />
                    {workspaces.map((ws, idx) => {
                      const isCurrent = 
                        (ws.business_id && activeContext?.business_id === ws.business_id && !ws.outlet_id && !activeContext.outlet_id) ||
                        (ws.outlet_id && activeContext?.outlet_id === ws.outlet_id);

                      return (
                        <DropdownMenuItem
                          key={idx}
                          onClick={() => handleSwitchWorkspace(ws)}
                          className={`gap-2 p-2 cursor-pointer flex items-center justify-between rounded-lg ${
                            isCurrent ? "bg-accent font-medium text-accent-foreground" : ""
                          }`}
                        >
                          <div className="flex flex-col text-left min-w-0">
                            <span className="text-xs font-semibold truncate">
                              {ws.outlet_id ? ws.outlet_name : ws.business_name}
                            </span>
                            <span className="text-[10px] text-muted-foreground capitalize truncate">
                              {ws.business_name} • {ws.role === "owner" ? "Owner" : ws.role}
                            </span>
                          </div>
                          {isCurrent && <span className="text-xs text-primary font-bold">✓</span>}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>

                <button 
                  type="button" 
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  className={`p-1.5 rounded-full cursor-pointer transition-colors ${
                    isDark ? "hover:bg-white/10 text-white" : "hover:bg-black/5 text-[#2B2B2B]"
                  }`}
                  title={
                    isSidebarCollapsed
                      ? (language === "id" ? "Perluas Sidebar (Ctrl+B)" : "Expand Sidebar (Ctrl+B)")
                      : (language === "id" ? "Ciutkan Sidebar (Ctrl+B)" : "Collapse Sidebar (Ctrl+B)")
                  }
                >
                  <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${!isSidebarCollapsed ? "rotate-180" : ""}`} />
                </button>
              </div>
            </SidebarHeader>

            {/* 2. Menu Navigation List */}
            <SidebarContent className="p-0">
              <SidebarGroup className="p-0">
                <SidebarMenu className="space-y-2">
                  {sidebarMenuConfig
                    .filter((menu) => {
                      if (menu.excludeTypes?.includes(activeContext?.type || "")) return false;
                      if (menu.onlyTypes && !menu.onlyTypes.includes(activeContext?.type || "")) return false;
                      if (menu.requiredRoles && !menu.requiredRoles.includes(activeContext?.role || "")) return false;
                      return true;
                    })
                    .map((menu) => {
                      const label = t[menu.translationKey as keyof typeof t] || menu.defaultLabel;
                      const Icon = menu.icon;

                      return (
                        <SidebarMenuItem key={menu.id}>
                          {menu.subItems && !isSidebarCollapsed ? (
                            <div className="space-y-1">
                              <button
                                type="button"
                                onClick={() => {
                                  if (menu.id === "inventory") setInventoryOpen(!inventoryOpen);
                                  if (menu.id === "procurement") setProcurementOpen(!procurementOpen);
                                }}
                                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 cursor-pointer ${
                                  activeMenu.startsWith(menu.id)
                                    ? "bg-primary text-primary-foreground shadow-md font-bold hover:brightness-105"
                                    : isDark
                                      ? "bg-white/5 text-[#94A3B8] hover:bg-white/10 hover:text-white"
                                      : "bg-white/40 text-[#2B2B2B] hover:bg-white/60 hover:shadow-md"
                                }`}
                              >
                                <div className="flex items-center space-x-3">
                                  <Icon className="w-4 h-4 shrink-0" />
                                  <span>{label}</span>
                                </div>
                                <ChevronDown
                                  className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                                    (menu.id === "inventory" && inventoryOpen) ||
                                    (menu.id === "procurement" && procurementOpen)
                                      ? "rotate-180"
                                      : ""
                                  }`}
                                />
                              </button>
                              {((menu.id === "inventory" && inventoryOpen) ||
                                (menu.id === "procurement" && procurementOpen)) && (
                                <div className="pl-4 space-y-1 mt-1">
                                  {menu.subItems.map((sub) => (
                                    <button
                                      key={sub.id}
                                      type="button"
                                      onClick={() => setActiveMenu(sub.id)}
                                      className={`w-full flex items-center px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 cursor-pointer ${
                                        activeMenu === sub.id
                                          ? "bg-[#9362FC]/20 text-[#9362FC] dark:text-primary"
                                          : isDark
                                            ? "bg-white/5 text-[#94A3B8]/80 hover:bg-white/10 hover:text-white"
                                            : "bg-[#2B2B2B]/10 text-[#2B2B2B] hover:bg-white/50"
                                      }`}
                                    >
                                      <span>{t[sub.translationKey as keyof typeof t] || sub.defaultLabel}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <SidebarMenuButton
                              isActive={
                                menu.subItems 
                                  ? activeMenu.startsWith(menu.id) 
                                  : activeMenu === menu.id
                              }
                              onClick={() => {
                                if (menu.subItems) {
                                  setActiveMenu(menu.subItems[0].id);
                                } else {
                                  setActiveMenu(menu.id);
                                }
                              }}
                              tooltip={isSidebarCollapsed ? label : undefined}
                            >
                              <Icon className={menu.iconClassName} />
                              <span>{label}</span>
                            </SidebarMenuButton>
                          )}
                        </SidebarMenuItem>
                      );
                    })}
                </SidebarMenu>
              </SidebarGroup>
            </SidebarContent>

            {/* 3. Footer: User Account Profile Avatar & Settings popover */}
            <SidebarFooter className="p-0 pt-4 border-t border-slate-200 dark:border-slate-800/40 relative">
              <div className="flex items-center justify-between w-full">
                <div className="relative shrink-0">
                  <button 
                    type="button"
                    onClick={() => setShowProfilePopover(!showProfilePopover)}
                    className="w-8 h-8 rounded-full bg-[#9362FC] flex items-center justify-center font-bold text-white shadow-sm shrink-0 cursor-pointer overflow-hidden hover:opacity-90 active:scale-95 transition-all text-xs"
                  >
                    {user?.name?.charAt(0) || "U"}
                  </button>
                  {showProfilePopover && (
                    <>
                      <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowProfilePopover(false)} />
                      <div className={`absolute bottom-11 w-56 p-3 rounded-2xl shadow-xl border z-50 text-left transition-all duration-200 ${
                        isSidebarCollapsed ? "left-14" : "left-0"
                      } ${
                        isDark ? "bg-[#292929] border-[#3A3A3A] text-white" : "bg-white border-[#B8B9BE] text-[#2B2B2B]"
                      }`}>
                        <div className="pb-2 border-b border-border/40 mb-2">
                          <p className="text-xs font-bold">{user?.name || "User Account"}</p>
                          <p className="text-[9px] opacity-65">{user?.phone_or_email}</p>
                        </div>
                        <div className="space-y-1">
                          <button type="button" onClick={() => { setActiveDrawer("settings"); setShowProfilePopover(false); }} className="w-full text-left px-2 py-1.5 text-[10px] font-semibold rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">{t.menuSettings}</button>
                          <button type="button" onClick={handleLogout} className="w-full text-left px-2 py-1.5 text-[10px] font-bold text-red-500 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer">{t.menuLogout}</button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {!isSidebarCollapsed && (
                  <div className="flex items-center space-x-1">
                    {/* Theme Toggle */}
                    <button 
                      type="button" 
                      onClick={() => toggleDarkMode()} 
                      className={`p-1.5 rounded-full cursor-pointer transition-colors ${
                        isDark ? "hover:bg-white/10 text-amber-400" : "hover:bg-black/5 text-[#6F5847]"
                      }`}
                    >
                      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>
                    {/* Language Selector */}
                    <button 
                      type="button" 
                      onClick={() => setLanguage(language === "id" ? "en" : "id")} 
                      className={`px-2.5 py-1 text-[10px] font-extrabold rounded-full transition-all border ${
                        isDark ? "border-white/10 hover:bg-white/5 text-white" : "border-slate-350 hover:bg-black/5 text-[#2B2B2B]"
                      }`}
                    >
                      {language.toUpperCase()}
                    </button>
                  </div>
                )}
              </div>
            </SidebarFooter>
          </Sidebar>
          {/* ================= MAIN CONTAINER ================= */}
          <main className="flex-1 flex flex-col overflow-hidden">
          
          {/* Inner Content Area */}
          <div className={`flex-1 ${activeMenu === "pos" ? "overflow-hidden p-6" : "overflow-y-auto p-8"}`}>
            {activeMenu === "pos" ? (
              <POSModule gridCols={gridCols} showNumpad={showNumpad} />
            ) : activeMenu === "inventory-master" ? (
              <InventoryModule
                view="master"
                onEditProduct={(p) => {
                  setEditingProduct(p);
                  setActiveMenu("inventory-edit");
                }}
                onAddNew={() => setActiveMenu("inventory-add")}
                onNavigate={(sub) => setActiveMenu(sub)}
              />
            ) : activeMenu === "inventory-add" ? (
              <InventoryModule view="new" onSuccess={() => setActiveMenu("inventory-master")} onCancel={() => setActiveMenu("inventory-master")} />
            ) : activeMenu === "inventory-discontinued" ? (
              <InventoryModule view="discontinued" onEditProduct={(p) => { setEditingProduct(p); setActiveMenu("inventory-edit"); }} />
            ) : activeMenu === "inventory-edit" ? (
              <InventoryModule view="edit" product={editingProduct} onSuccess={() => setActiveMenu("inventory-master")} onCancel={() => setActiveMenu("inventory-master")} />
            ) : activeMenu === "opname" ? (
              <OpnameModule />
            ) : activeMenu === "produksi" ? (
              <div className="p-6">Produksi Placeholder</div>
            ) : activeMenu === "distribusi" ? (
              <div className="p-6">Distribusi Placeholder</div>
            ) : activeMenu === "superadmin" ? (
              <SuperadminModule />
            ) : activeMenu === "procurement" || activeMenu === "procurement-history" ? (
              <ProcurementModule view="history" onNavigate={(sub) => setActiveMenu(sub)} />
            ) : activeMenu === "procurement-new" ? (
              <ProcurementModule
                view="new"
                onSuccess={() => setActiveMenu("procurement-history")}
                onCancel={() => setActiveMenu("procurement-history")}
                onNavigate={(sub) => setActiveMenu(sub)}
              />
            ) : activeMenu === "sales-report" ? (
              <SalesReportModule />
            ) : activeMenu === "dashboard" ? (
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Feature Welcome Chunky Card */}
                <div className={`border rounded-card p-8 shadow-sm transition-colors ${
                  isDark ? "bg-[#292929] border-[#3A3A3A]" : "bg-white border-slate-200"
                }`}>
                  <h3 className="text-2xl font-bold mb-3">
                    Selamat Datang di Andaya ERP!
                  </h3>
                  <p className="opacity-80 font-medium leading-relaxed text-sm">
                    Sistem ERP terpadu untuk retail & F&B. Anda dapat menggunakan tab menu Point of Sale (POS), Inventory, dan Procurement untuk menguji alur operasional, opname Blind Count, serta status pengadaan.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 rounded-card p-6 flex flex-col items-center justify-center text-center">
                <Wrench className="w-10 h-10 text-amber-600 dark:text-amber-400 mb-3 stroke-[1.5]" />
                <h4 className="font-semibold text-amber-800 dark:text-amber-400 text-lg mb-1">Fitur Sedang Dikembangkan</h4>
                <p className="text-amber-700/80 dark:text-amber-500/80 text-sm max-w-md">
                  Modul {activeMenu} akan diaktifkan pada fase pengerjaan berikutnya.
                </p>
              </div>
            )}
          </div>

        </main>
      </SidebarProvider>

      {/* Global Close Shift Modal inside DesktopShell */}
      {showCloseShiftModal && activeShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-[#2B2B2B]">
          <div className={`w-full max-w-md border rounded-3xl p-6 shadow-2xl transition-all ${
            isDark ? "bg-[#292929] border-[#3A3A3A] text-white" : "bg-white border-[#B8B9BE]"
          }`}>
            <h3 className="text-lg font-bold mb-1 dark:text-white">Tutup Shift Kasir</h3>
            <p className="opacity-70 text-xs font-semibold leading-relaxed mb-5 dark:text-slate-300">
              Masukkan nominal uang fisik yang ada di dalam laci kasir saat ini untuk proses rekonsiliasi.
            </p>

            {closingError && (
              <div className="mb-4 p-3 bg-red-500/10 text-red-500 text-xs font-bold rounded-xl border border-red-500/20 text-left flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{closingError}</span>
              </div>
            )}

            <form onSubmit={handleCloseShift} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold opacity-75 uppercase tracking-wider mb-2 ml-1 text-left dark:text-slate-350">
                  Uang Fisik di Laci (Rupiah)
                </label>
                <input
                  type="number"
                  value={closingCashActual}
                  onChange={(e) => setClosingCashActual(e.target.value)}
                  placeholder="150000"
                  className={`w-full text-center text-xl font-bold px-4 py-3 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-[#9362FC]/40 focus:border-[#9362FC] transition-all ${
                    isDark ? "bg-[#1E1E1E] border-[#3A3A3A] text-white" : "bg-slate-50 border-[#B8B9BE]"
                  }`}
                  style={{ minHeight: "56px" }}
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCloseShiftModal(false);
                    setClosingCashActual("");
                    setClosingError("");
                  }}
                  className="flex-1 py-3 text-xs font-bold border border-[#B8B9BE] dark:border-[#3A3A3A] hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all cursor-pointer dark:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={closingLoading}
                  className="flex-1 py-3 text-xs font-bold bg-[#9362FC] text-white hover:bg-[#7D4BE3] rounded-xl transition-all cursor-pointer shadow-md"
                >
                  {closingLoading ? "Menutup..." : "Tutup Shift"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= TOOLS DRAWER ================= */}
      <Drawer
        direction="right"
        open={Boolean(activeDrawer)}
        onOpenChange={(open) => !open && setActiveDrawer(null)}
      >
        <DrawerContent
          className={`w-[480px] sm:w-[500px] md:w-[520px] max-w-[95vw] border-l ${
            isDark ? "bg-[#202024] border-[#38383C] text-white" : "bg-white border-slate-200 text-[#2B2B2B]"
          }`}
        >
          <div className="flex flex-col justify-between h-full w-full p-6 sm:p-7">
            <div className="space-y-6 overflow-y-auto pr-1 flex-1">
              <DrawerHeader className="p-0 border-b border-slate-200 dark:border-[#38383C] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-[#2E2E34] flex items-center justify-center text-slate-800 dark:text-primary shrink-0">
                    {activeDrawer === "settings" && <Settings className="w-5 h-5" />}
                    {activeDrawer === "calendar" && <Calendar className="w-5 h-5" />}
                    {activeDrawer === "notifications" && <Bell className="w-5 h-5" />}
                  </div>
                  <div>
                    <DrawerTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {activeDrawer === "settings" && (language === "id" ? "Pengaturan Sistem" : "System Settings")}
                      {activeDrawer === "calendar" && (language === "id" ? "Kalender & Jadwal" : "Calendar & Schedule")}
                      {activeDrawer === "notifications" && (language === "id" ? "Pusat Notifikasi" : "Notifications")}
                    </DrawerTitle>
                    <DrawerDescription className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      {activeDrawer === "settings" && (language === "id" ? "Preferensi bahasa, layout kasir, dan shift" : "Language preferences, POS layout, and shifts")}
                      {activeDrawer === "calendar" && (language === "id" ? "Batas jatuh tempo faktur dan agenda outlet" : "Invoice due dates and outlet schedules")}
                      {activeDrawer === "notifications" && (language === "id" ? "Peringatan stok minimum dan aktivitas sistem" : "Low stock alerts and system activity")}
                    </DrawerDescription>
                  </div>
                </div>
              </DrawerHeader>

              {/* ── SETTINGS DRAWER BODY ── */}
              {activeDrawer === "settings" && (
                <div className="space-y-4">
                  {/* 1. Language */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#26262A] border border-slate-200/80 dark:border-[#38383C] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <Globe className="w-4 h-4 text-slate-500 dark:text-primary" />
                        <span>Bahasa / Language</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => language !== "id" && setLanguage("id")}
                        className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          language === "id"
                            ? "bg-primary text-primary-foreground border-transparent shadow-sm"
                            : "bg-white dark:bg-[#1E1E22] border-slate-200 dark:border-[#38383C] text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
                        }`}
                      >
                        <span>🇮🇩</span>
                        <span>Bahasa (ID)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => language !== "en" && setLanguage("en")}
                        className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          language === "en"
                            ? "bg-primary text-primary-foreground border-transparent shadow-sm"
                            : "bg-white dark:bg-[#1E1E22] border-slate-200 dark:border-[#38383C] text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
                        }`}
                      >
                        <span>🇬🇧</span>
                        <span>English (EN)</span>
                      </button>
                    </div>
                  </div>

                  {/* 2. Theme Toggle */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#26262A] border border-slate-200/80 dark:border-[#38383C] space-y-2.5">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                      {isDark ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-amber-500" />}
                      <span>{language === "id" ? "Mode Tampilan" : "Display Theme"}</span>
                    </span>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => isDark && toggleDarkMode()}
                        className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          !isDark
                            ? "bg-primary text-primary-foreground border-transparent shadow-sm"
                            : "bg-white dark:bg-[#1E1E22] border-slate-200 dark:border-[#38383C] text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
                        }`}
                      >
                        <Sun className="w-3.5 h-3.5" />
                        <span>Light Mode</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => !isDark && toggleDarkMode()}
                        className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          isDark
                            ? "bg-primary text-primary-foreground border-transparent shadow-sm"
                            : "bg-white dark:bg-[#1E1E22] border-slate-200 dark:border-[#38383C] text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
                        }`}
                      >
                        <Moon className="w-3.5 h-3.5" />
                        <span>Dark Mode</span>
                      </button>
                    </div>
                  </div>

                  {/* ── SECTION DIVIDER: POS CASHIER SETUP ── */}
                  {activeMenu === "pos" && (
                    <div className="pt-2">
                      <div className="flex items-center gap-2 py-1 mb-2 border-b border-slate-200 dark:border-[#38383C]">
                        <ShoppingCart className="w-3.5 h-3.5 text-purple-600 dark:text-primary" />
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                          {language === "id" ? "Konfigurasi Kasir (POS)" : "POS Cashier Setup"}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {/* 3. POS Tax (PPN) Variable Toggle */}
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#26262A] border border-slate-200/80 dark:border-[#38383C] space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                              <FileSpreadsheet className="w-4 h-4 text-slate-500 dark:text-primary" />
                              <span>{language === "id" ? "Pajak Pertambahan Nilai (PPN)" : "Value Added Tax (VAT)"}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleSetEnableTax(!posEnableTax)}
                              className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                                posEnableTax ? "bg-primary" : "bg-slate-300 dark:bg-[#38383C]"
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded-full bg-white transition-transform transform absolute top-0.5 ${
                                  posEnableTax ? "translate-x-5.5 bg-slate-900" : "translate-x-0.5"
                                }`}
                              />
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {language === "id"
                              ? "Aktifkan untuk menambahkan kalkulasi PPN pada setiap transaksi checkout kasir."
                              : "Enable to include VAT calculation on checkout transactions."}
                          </p>
                          {posEnableTax && (
                            <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-[#38383C]">
                              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                {language === "id" ? "Tarif PPN (%):" : "Tax Rate (%):"}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  max="50"
                                  value={posTaxRate}
                                  onChange={(e) => handleSetTaxRate(Math.max(0, Math.min(50, Number(e.target.value) || 0)))}
                                  className="w-14 px-2 py-1 rounded-xl border text-center font-bold text-xs bg-white dark:bg-[#1E1E22] border-slate-200 dark:border-[#38383C] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#9362FC]"
                                />
                                <span className="text-xs font-bold text-slate-400">%</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 4. POS Discount Variable Toggle */}
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#26262A] border border-slate-200/80 dark:border-[#38383C] space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                              <Package className="w-4 h-4 text-slate-500 dark:text-primary" />
                              <span>{language === "id" ? "Diskon Transaksi (Discount)" : "Transaction Discount"}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleSetEnableDiscount(!posEnableDiscount)}
                              className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                                posEnableDiscount ? "bg-primary" : "bg-slate-300 dark:bg-[#38383C]"
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded-full bg-white transition-transform transform absolute top-0.5 ${
                                  posEnableDiscount ? "translate-x-5.5 bg-slate-900" : "translate-x-0.5"
                                }`}
                              />
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {language === "id"
                              ? "Aktifkan jika kasir diizinkan memasukkan potongan diskon transaksi."
                              : "Enable if cashiers are allowed to apply transaction discounts."}
                          </p>
                          {posEnableDiscount && (
                            <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-[#38383C]">
                              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                {language === "id" ? "Default Diskon (%):" : "Default Discount (%):"}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={posDiscountRate}
                                  onChange={(e) => handleSetDiscountRate(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                                  className="w-14 px-2 py-1 rounded-xl border text-center font-bold text-xs bg-white dark:bg-[#1E1E22] border-slate-200 dark:border-[#38383C] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#9362FC]"
                                />
                                <span className="text-xs font-bold text-slate-400">%</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 5. Virtual Numpad Toggle */}
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#26262A] border border-slate-200/80 dark:border-[#38383C] space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                              <Calculator className="w-4 h-4 text-slate-500 dark:text-primary" />
                              <span>{language === "id" ? "Numpad Virtual Kasir" : "Cashier Virtual Numpad"}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleSetShowNumpad(!showNumpad)}
                              className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                                showNumpad ? "bg-primary" : "bg-slate-300 dark:bg-[#38383C]"
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded-full bg-white transition-transform transform absolute top-0.5 ${
                                  showNumpad ? "translate-x-5.5 bg-slate-900" : "translate-x-0.5"
                                }`}
                              />
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {language === "id"
                              ? "Tampilkan papan angka virtual di checkout untuk layar sentuh/tablet kasir."
                              : "Display virtual numpad on checkout for touchscreen POS terminals."}
                          </p>
                        </div>

                        {/* 6. POS Column Layout */}
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#26262A] border border-slate-200/80 dark:border-[#38383C] space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                              <LayoutDashboard className="w-4 h-4 text-slate-500 dark:text-primary" />
                              <span>{language === "id" ? "Kolom Grid Produk POS" : "POS Product Grid Columns"}</span>
                            </span>
                            <span className="text-[10px] font-mono font-bold text-slate-400">{gridCols} Kolom</span>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5 pt-1">
                            {[3, 4, 5, 6].map((cols) => (
                              <button
                                key={cols}
                                type="button"
                                onClick={() => handleSetGridCols(cols)}
                                className={`py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                  gridCols === cols
                                    ? "bg-primary text-primary-foreground border-transparent shadow-sm"
                                    : "bg-white dark:bg-[#1E1E22] border-slate-200 dark:border-[#38383C] text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
                                }`}
                              >
                                {cols} {language === "id" ? "Kolom" : "Cols"}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── SECTION: SHIFT & CONTEXT ── */}
                  {activeMenu === "pos" ? (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#26262A] border border-slate-200/80 dark:border-[#38383C] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                          <ClipboardCheck className="w-4 h-4 text-slate-500 dark:text-primary" />
                          <span>{language === "id" ? "Status Shift Kasir" : "Cashier Shift Status"}</span>
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          {language === "id" ? "Shift Terbuka" : "Shift Open"}
                        </span>
                      </div>
                      <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex justify-between">
                          <span>Kas Awal:</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            Rp {(activeShift?.opening_cash || 0).toLocaleString("id-ID")}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Kasir:</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{user?.name || "Staff"}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveDrawer(null);
                          setShowCloseShiftModal(true);
                        }}
                        className="w-full mt-2 py-2 px-3 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>{language === "id" ? "Tutup Shift & Rekonsiliasi Kas" : "Close Shift & Reconcile"}</span>
                      </button>
                    </div>
                  ) : (
                    /* Non-POS Context Information */
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#26262A] border border-slate-200/80 dark:border-[#38383C] space-y-2.5">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100">Informasi Workspace Aktif</p>
                      <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-medium">Bisnis:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-100">{activeContext?.business_name || "-"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-medium">Outlet:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-100">{activeContext?.outlet_name || "Semua Outlet"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-medium">Role Pengguna:</span>
                          <span className="font-bold uppercase text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                            {activeContext?.role || "Staff"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── BIG BUTTON: BUKA RIWAYAT TRANSAKSI POS (NESTED DRAWER) ── */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowSettingsHistoryDrawer(true)}
                      className="w-full p-4 rounded-2xl bg-[#9362FC]/5 dark:bg-primary/5 hover:bg-[#9362FC]/10 dark:hover:bg-primary/10 border border-[#9362FC]/20 dark:border-primary/20 text-left flex items-center justify-between transition-all cursor-pointer group shadow-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#9362FC]/15 dark:bg-primary/15 text-[#9362FC] dark:text-primary flex items-center justify-center shrink-0">
                          <History className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#9362FC] dark:group-hover:text-primary transition-colors flex items-center gap-1.5">
                            <span>{language === "id" ? "Buka Riwayat Transaksi & Void" : "Open Transaction History & Void"}</span>
                          </h4>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {language === "id"
                              ? "Cek transaksi shift berjalan, reprint struk, & batalkan nota."
                              : "Review shift transactions, reprint receipts, and void invoices."}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── CALENDAR DRAWER BODY ── */}
              {activeDrawer === "calendar" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#26262A] border border-slate-200/80 dark:border-[#38383C] space-y-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-500 dark:text-primary" />
                      <span>{language === "id" ? "Jadwal & Agenda Operasional" : "Operational Schedules"}</span>
                    </span>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {language === "id"
                        ? "Kalender sinkronisasi jatuh tempo pembayaran pengadaan barang (procurement) dan reminder stock opname bulanan."
                        : "Synchronized calendar for procurement payment due dates and monthly stock opname reminders."}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl border border-dashed border-slate-200 dark:border-[#38383C] text-center py-8">
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                      {language === "id" ? "Tidak ada tagihan jatuh tempo hari ini." : "No due invoices scheduled today."}
                    </p>
                  </div>
                </div>
              )}

              {/* ── NOTIFICATIONS DRAWER BODY ── */}
              {activeDrawer === "notifications" && (
                <div className="py-16 flex flex-col items-center justify-center text-center px-4">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-[#28282D] flex items-center justify-center text-slate-400 dark:text-slate-500 mb-4 border border-slate-200 dark:border-[#38383C]">
                    <Bell className="w-8 h-8 opacity-60" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">
                    {language === "id" ? "Semua Notifikasi Terbaca" : "All Caught Up"}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[240px]">
                    {language === "id"
                      ? "Tidak ada pemberitahuan baru terkait stok menipis, selisih opname, atau status pembayaran faktur."
                      : "No new notifications regarding low stock, opname discrepancies, or procurement payment status."}
                  </p>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="pt-4 border-t border-slate-200 dark:border-[#38383C] text-[10px] text-slate-400 text-center shrink-0">
              Andaya Group ERP • Enterprise System
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Nested History Drawer from Settings */}
      <TransactionHistoryDrawer
        open={showSettingsHistoryDrawer}
        onOpenChange={setShowSettingsHistoryDrawer}
        isNested
      />

      </div>
    </div>
  );
}
