import { useState, useEffect } from "react";
import { useAuthStore } from "../lib/store";
import { api } from "../lib/api";
import { useNavigate } from "react-router";
import WorkspaceSwitcher from "./WorkspaceSwitcher";
import POSModule from "./POSModule";
import InventoryModule from "./InventoryModule";
import ProcurementModule from "./ProcurementModule";
import BaksoModule from "./BaksoModule";
import SuperadminModule from "./SuperadminModule";
import { Sun, Moon } from "lucide-react";

interface MobileShellProps {
  children?: React.ReactNode;
}

export default function MobileShell({ children }: MobileShellProps) {
  const { user, activeContext, clearSession } = useAuthStore();
  const navigate = useNavigate();
  
  // Shell States
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [productsCount, setProductsCount] = useState(0);
  const [isDark, setIsDark] = useState(false);

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

  const navItems = [
    { id: "dashboard", label: "Home", icon: "🏠" },
  ];

  if (activeContext?.role === "superadmin") {
    navItems.push({ id: "superadmin", label: "Akses", icon: "🛡️" });
  } else if (activeContext?.type === "fnb_production") {
    navItems.push(
      { id: "pos", label: "POS", icon: "🛒" },
      { id: "produksi", label: "Produksi", icon: "🍳" },
      { id: "distribusi", label: "Distribusi", icon: "🚚" }
    );
  } else {
    navItems.push(
      { id: "pos", label: "POS", icon: "🛒" },
      { id: "inventory", label: "Stok", icon: "📦" },
      { id: "procurement", label: "Procure", icon: "📝" }
    );
  }

  return (
    <div 
      style={!isDark ? {
        backgroundImage: "radial-gradient(circle at 50% 50%, #eae5f7 0%, #f5e3f0 35%, #D6D7DC 80%)"
      } : undefined}
      className={`flex flex-col h-screen overflow-hidden font-sans transition-colors duration-300 ${
        isDark ? "dark bg-[#1E1E1E] text-[#F8FAFC]" : "text-[#2B2B2B]"
      }`}
    >
      
      {/* 1. Top Navigation Bar (Mobile Header) */}
      {activeMenu !== "pos" && (
        <header className={`h-16 shadow-[0_4px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.15)] px-4 flex items-center justify-between z-10 transition-colors shrink-0 ${
          isDark ? "bg-[#292929] border-b border-[#3A3A3A] text-white" : "bg-white border-b border-slate-200 text-[#2B2B2B]"
        }`}>
          <button
            type="button"
            onClick={() => setSwitcherOpen(true)}
            className="flex items-center space-x-2 max-w-[60%] text-left cursor-pointer"
          >
            <div className="w-8 h-8 rounded-pill bg-[#9362FC] flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
              {activeContext?.name?.charAt(0) || "A"}
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-sm truncate leading-tight">
                {activeContext?.name || "Pilih Workspace"}
              </h1>
              <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">
                {activeContext?.role === "owner" ? "Owner" : activeContext?.role} ▾
              </p>
            </div>
          </button>

          <div className="flex items-center space-x-1.5">
            {/* Status Indicator */}
            <span className={`text-[9px] font-semibold px-2.5 py-1 rounded-pill uppercase transition-colors ${
              isDark ? "bg-[#3A3A3A] text-slate-300" : "bg-slate-100 text-slate-650"
            }`}>
              {activeContext?.type || "erp"}
            </span>

            {/* Theme Switcher Button */}
            <button
              type="button"
              onClick={toggleDarkMode}
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors cursor-pointer text-sm ${
                isDark ? "hover:bg-white/10" : "hover:bg-black/5"
              }`}
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>
            
            <button
              type="button"
              onClick={handleLogout}
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors cursor-pointer text-sm ${
                isDark ? "hover:bg-red-500/10 text-red-400" : "bg-slate-100 hover:bg-red-500/10 text-red-500"
              }`}
              title="Sign Out"
            >
              🚪
            </button>
          </div>
        </header>
      )}

      {/* 2. Scrollable Body Area */}
      <main className={`flex-1 ${activeMenu === "pos" ? "overflow-hidden p-4" : "overflow-y-auto p-4 pb-24"}`}>
        {activeMenu === "pos" ? (
          <POSModule />
        ) : activeMenu === "inventory" ? (
          <InventoryModule />
        ) : activeMenu === "procurement" ? (
          <ProcurementModule />
        ) : activeMenu === "produksi" ? (
          <BaksoModule mode="production" />
        ) : activeMenu === "distribusi" ? (
          <BaksoModule mode="distribution" />
        ) : activeMenu === "superadmin" ? (
          <SuperadminModule />
        ) : activeMenu === "dashboard" ? (
          <div className="space-y-4">
            {/* Chunky card banner */}
            <div className={`border rounded-card p-6 shadow-sm transition-colors ${
              isDark ? "bg-[#292929] border-[#3A3A3A]" : "bg-white border-slate-200"
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
                isDark ? "bg-[#292929] border-[#3A3A3A]" : "bg-white border-slate-200"
              }`}>
                <span className="text-[10px] text-muted-foreground font-bold uppercase">Sales Hari Ini</span>
                <span className="text-lg font-semibold">Rp 0</span>
              </div>
              <div className={`border rounded-card p-4 shadow-sm flex flex-col justify-between h-28 transition-colors ${
                isDark ? "bg-[#292929] border-[#3A3A3A]" : "bg-white border-slate-200"
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

      {/* 3. Bottom Navigation Bar */}
      <nav className={`fixed bottom-4 left-4 right-4 h-16 backdrop-blur-md border shadow-lg rounded-pill px-3 flex items-center justify-around z-10 transition-all ${
        isDark ? "bg-[#292929]/95 border-[#3A3A3A]" : "bg-white/95 border-slate-200"
      }`}>
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveMenu(item.id)}
            className="flex flex-col items-center justify-center w-14 h-14 rounded-pill transition-all duration-200 cursor-pointer"
          >
            <span className={`text-xl transition-transform ${activeMenu === item.id ? "scale-125" : ""}`}>
              {item.icon}
            </span>
            <span className={`text-[9px] font-bold mt-0.5 tracking-tight ${
              activeMenu === item.id ? "text-[#9362FC]" : "text-muted-foreground"
            }`}>
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      {/* Workspace Switcher Modal */}
      <WorkspaceSwitcher
        isOpen={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
      />

    </div>
  );
}
