import { useState } from "react";
import { useAuthStore } from "../lib/store";
import { useLanguageStore, translations } from "../lib/i18n";
import { useTheme } from "../hooks/use-theme";
import { usePOSSettings } from "../hooks/use-pos-settings";
import ShiftCloseModal from "./ShiftCloseModal";
import TransactionHistoryDrawer from "./TransactionHistoryDrawer";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "./ui/drawer";
import {
  Settings,
  Sun,
  Moon,
  LogOut,
  History,
  ChevronRight,
  X,
  CreditCard,
  Percent,
  Globe,
  Sliders,
  Building2,
  Store,
  UserCheck
} from "lucide-react";

interface POSSettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeMenu?: string;
}

export default function POSSettingsDrawer({
  open,
  onOpenChange,
  activeMenu = "pos",
}: POSSettingsDrawerProps) {
  const { user, activeContext } = useAuthStore();
  const { language, setLanguage } = useLanguageStore();
  const t = translations[language];
  const { isDark, toggleTheme } = useTheme();

  const isPOSContext = activeMenu === "pos";

  const {
    showNumpad,
    setShowNumpad,
    gridCols,
    setGridCols,
    enableTax,
    setEnableTax,
    enableDiscount,
    setEnableDiscount,
  } = usePOSSettings();

  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  return (
    <>
      <Drawer direction="right" open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="p-0 border-l border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#202024] w-full sm:w-[420px] max-w-[90vw]">
          <div className="h-full flex flex-col justify-between overflow-hidden">
            
            {/* Header */}
            <DrawerHeader className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-left shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-brand-purple/10 dark:bg-primary/10 flex items-center justify-center text-brand-purple dark:text-primary">
                  <Settings className="w-5 h-5 stroke-[2]" />
                </div>
                <div>
                  <DrawerTitle className="font-extrabold text-sm text-neutral-dark dark:text-white">
                    {isPOSContext
                      ? language === "id" ? "Pengaturan System & POS" : "System & POS Settings"
                      : language === "id" ? "Pengaturan Workspace & App" : "Workspace & App Settings"}
                  </DrawerTitle>
                  <DrawerDescription className="text-[10px] text-muted-foreground font-semibold">
                    {isPOSContext
                      ? language === "id" ? "Konfigurasi preferensi kasir & shift" : "Cashier & shift preferences"
                      : language === "id" ? "Informasi & preferensi aplikasi" : "Application preferences"}
                  </DrawerDescription>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </DrawerHeader>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin">
              
              {/* ================= POS ONLY SECTIONS ================= */}
              {isPOSContext ? (
                <>
                  {/* Section 1: Shift & Operasional */}
                  <div className="space-y-3">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-brand-purple dark:text-primary" />
                      <span>{language === "id" ? "Operasional Shift & Kasir" : "Shift & Cashier Operations"}</span>
                    </div>

                    {/* Open History Drawer Action */}
                    <button
                      type="button"
                      onClick={() => setShowHistoryDrawer(true)}
                      className="w-full p-3.5 rounded-2xl bg-brand-purple/5 dark:bg-primary/5 hover:bg-brand-purple/10 dark:hover:bg-primary/10 border border-brand-purple/20 dark:border-primary/20 text-left flex items-center justify-between transition-all cursor-pointer group shadow-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-brand-purple/15 dark:bg-primary/15 text-brand-purple dark:text-primary flex items-center justify-center shrink-0">
                          <History className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-brand-purple dark:group-hover:text-primary transition-colors">
                            {language === "id" ? "Buka Riwayat Transaksi & Void" : "Open Transaction History & Void"}
                          </h4>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {language === "id"
                              ? "Cek transaksi shift berjalan, cetak ulang struk, & batalkan nota."
                              : "Review shift transactions, reprint receipts, and void invoices."}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                    </button>

                    {/* Close Shift Action Button */}
                    <button
                      type="button"
                      onClick={() => setShowCloseShiftModal(true)}
                      className="w-full p-3 rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <LogOut className="w-4 h-4 stroke-[2.5]" />
                      <span>{language === "id" ? "Tutup Shift & Rekonsiliasi Kas" : "Close Shift & Reconcile"}</span>
                    </button>
                  </div>

                  {/* Section 2: Preferensi Layout & Fitur Kasir */}
                  <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                      {language === "id" ? "Preferensi Fitur Kasir" : "Cashier Feature Preferences"}
                    </div>

                    {/* Touch Numpad Toggle */}
                    <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-dark-border bg-slate-50/50 dark:bg-white/5">
                      <div className="flex items-center space-x-2.5">
                        <CreditCard className="w-4 h-4 text-brand-purple dark:text-primary shrink-0" />
                        <div>
                          <h5 className="text-xs font-bold">{language === "id" ? "Mode Touch Numpad" : "Touch Numpad Mode"}</h5>
                          <p className="text-[9.5px] opacity-70">
                            {language === "id" ? "Tampilkan keypad angka di keranjang kasir" : "Show keypad digits in cart"}
                          </p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={showNumpad}
                        onChange={(e) => setShowNumpad(e.target.checked)}
                        className="w-4 h-4 rounded text-brand-purple focus:ring-brand-purple cursor-pointer"
                      />
                    </div>

                    {/* Grid Column Selector */}
                    <div className="p-3 rounded-2xl border border-slate-200 dark:border-dark-border bg-slate-50/50 dark:bg-white/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-bold">{language === "id" ? "Kolom Grid Produk" : "Product Grid Columns"}</h5>
                        <span className="text-xs font-extrabold text-brand-purple dark:text-primary">{gridCols} Kolom</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[2, 3, 4, 5].map((cols) => (
                          <button
                            key={cols}
                            type="button"
                            onClick={() => setGridCols(cols)}
                            className={`py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                              gridCols === cols
                                ? "bg-brand-purple text-white border-brand-purple shadow-xs dark:bg-primary dark:text-neutral-dark dark:border-primary"
                                : "bg-white dark:bg-white/5 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {cols}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tax Toggle */}
                    <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-dark-border bg-slate-50/50 dark:bg-white/5">
                      <div className="flex items-center space-x-2.5">
                        <Percent className="w-4 h-4 text-brand-purple dark:text-primary shrink-0" />
                        <div>
                          <h5 className="text-xs font-bold">{language === "id" ? "Aktifkan PPN / Pajak" : "Enable Tax / PPN"}</h5>
                          <p className="text-[9.5px] opacity-70">
                            {language === "id" ? "Hitung PPN otomatis pada total transaksi" : "Calculate PPN on totals"}
                          </p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={enableTax}
                        onChange={(e) => setEnableTax(e.target.checked)}
                        className="w-4 h-4 rounded text-brand-purple focus:ring-brand-purple cursor-pointer"
                      />
                    </div>

                    {/* Discount Toggle */}
                    <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-dark-border bg-slate-50/50 dark:bg-white/5">
                      <div className="flex items-center space-x-2.5">
                        <Percent className="w-4 h-4 text-brand-purple dark:text-primary shrink-0" />
                        <div>
                          <h5 className="text-xs font-bold">{language === "id" ? "Aktifkan Diskon Toko" : "Enable Store Discount"}</h5>
                          <p className="text-[9.5px] opacity-70">
                            {language === "id" ? "Izinkan potongan harga kasir" : "Allow cashier discounts"}
                          </p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={enableDiscount}
                        onChange={(e) => setEnableDiscount(e.target.checked)}
                        className="w-4 h-4 rounded text-brand-purple focus:ring-brand-purple cursor-pointer"
                      />
                    </div>
                  </div>
                </>
              ) : (
                /* ================= NON-POS WORKSPACE CONTEXT ================= */
                <div className="space-y-3">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-brand-purple dark:text-primary" />
                    <span>{language === "id" ? "Informasi Workspace Aktif" : "Active Workspace Context"}</span>
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-dark-border bg-slate-50/50 dark:bg-white/5 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <span>{language === "id" ? "Bisnis:" : "Business:"}</span>
                      </span>
                      <span className="font-extrabold text-neutral-dark dark:text-white">
                        {activeContext?.business_name || "-"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
                        <Store className="w-4 h-4 text-slate-400" />
                        <span>{language === "id" ? "Outlet:" : "Outlet:"}</span>
                      </span>
                      <span className="font-extrabold text-neutral-dark dark:text-white">
                        {activeContext?.outlet_name || "Semua Outlet"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-slate-400" />
                        <span>{language === "id" ? "Role Akses:" : "User Role:"}</span>
                      </span>
                      <span className="font-extrabold uppercase text-[10px] px-2.5 py-0.5 rounded-full bg-brand-purple/10 text-brand-purple dark:bg-primary/10 dark:text-primary">
                        {activeContext?.role || "Staff"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Section: Tampilan & Bahasa (Always Visible) */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  {language === "id" ? "Tampilan & Bahasa" : "Appearance & Language"}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="flex items-center justify-center gap-2 p-3 rounded-2xl border border-slate-200 dark:border-dark-border bg-slate-50/50 dark:bg-white/5 text-xs font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                  >
                    {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
                    <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLanguage(language === "id" ? "en" : "id")}
                    className="flex items-center justify-center gap-2 p-3 rounded-2xl border border-slate-200 dark:border-dark-border bg-slate-50/50 dark:bg-white/5 text-xs font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                  >
                    <Globe className="w-4 h-4 text-brand-purple dark:text-primary" />
                    <span>{language === "id" ? "Bahasa: ID" : "Language: EN"}</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 text-center shrink-0">
              Andaya Group ERP • {isPOSContext ? "POS Settings" : "Workspace System"}
            </div>

          </div>
        </DrawerContent>
      </Drawer>

      {/* Modals */}
      <ShiftCloseModal
        isOpen={showCloseShiftModal}
        onClose={() => setShowCloseShiftModal(false)}
      />

      <TransactionHistoryDrawer
        open={showHistoryDrawer}
        onOpenChange={setShowHistoryDrawer}
        isNested
      />
    </>
  );
}
