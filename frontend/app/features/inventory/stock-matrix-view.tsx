import { useState, useEffect, useMemo, useRef } from "react";
import { api } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { useLanguageStore, translations } from "../../lib/i18n";
import { useTheme } from "../../hooks/use-theme";
import { toast } from "../../components/ui/sonner";
import { ErpSearchBar } from "../../components/ErpSearchBar";
import { ErpFilterPopover } from "../../components/ErpFilterPopover";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "../../components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../../components/ui/select";
import {
  Boxes,
  Building2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Info,
  Check,
  Package,
  Truck,
  X,
  Sparkles,
  Send,
  Tag,
  Layers,
  HelpCircle,
  Snowflake,
  ChefHat,
  ChevronRight,
  Loader2,
} from "lucide-react";

export interface OutletInfo {
  id: string;
  name: string;
  is_main: boolean;
  address?: string;
}

export interface OutletStockDetail {
  outlet_id: string;
  outlet_name: string;
  is_main: boolean;
  qty_sealed: number;
  qty_loose: number;
}

export interface StockMatrixItem {
  id: string;
  sku?: string;
  name: string;
  category_id?: string;
  category_name?: string;
  item_type: "finished_good" | "semi_finished" | "raw_material" | "consumable" | "fixed_tool";
  is_sellable: boolean;
  is_inventory_tracked: boolean;
  is_tracking_stock: boolean;
  is_produced: boolean;
  is_purchasable: boolean;
  is_thawable: boolean;
  base_unit: string;
  box_unit: string;
  conversion_rate: number;
  min_stock_alert: number;
  sell_price: number;
  standard_cost: number;
  status: string;
  total_qty_sealed: number;
  total_qty_loose: number;
  stocks: Record<string, OutletStockDetail>;
}

interface StockMatrixViewProps {
  onNavigateToDistribution?: (payload?: any) => void;
  onBackToInventory?: () => void;
}

export function StockMatrixView({
  onNavigateToDistribution,
  onBackToInventory,
}: StockMatrixViewProps) {
  const { activeContext } = useAuthStore();
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;
  const { isDark } = useTheme();

  const [isLoading, setIsLoading] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [outlets, setOutlets] = useState<OutletInfo[]>([]);
  const [items, setItems] = useState<StockMatrixItem[]>([]);
  const [existingTransfers, setExistingTransfers] = useState<any[]>([]);

  // Search & Filter States
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDomainTypes, setSelectedDomainTypes] = useState<string[]>([]);
  const [stockConditionFilter, setStockConditionFilter] = useState<"all" | "critical" | "safe" | "empty">("all");

  // Selection Mode State (WhatsApp Style)
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Bulk Draft Modal State
  const [isBulkDraftDialogOpen, setIsBulkDraftDialogOpen] = useState(false);
  const [bulkOriginOutletId, setBulkOriginOutletId] = useState<string>("");
  const [bulkTargetOutletIds, setBulkTargetOutletIds] = useState<string[]>([]);
  const [isSubmittingBulkDraft, setIsSubmittingBulkDraft] = useState(false);

  // Keyboard shortcut '/' to focus search
  useEffect(() => {
    const handleGlobalKeydown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleGlobalKeydown);
    return () => window.removeEventListener("keydown", handleGlobalKeydown);
  }, []);

  const fetchMatrixData = async () => {
    setIsLoading(true);
    setPermissionError(null);
    try {
      const [res, transfersRes] = await Promise.all([
        api.get("/inventory/matrix"),
        api.get("/transfers").catch(() => ({ data: [] })),
      ]);
      const data = res.data?.data || res.data || {};
      const loadedOutlets: OutletInfo[] = data.outlets || [];
      const loadedItems: StockMatrixItem[] = data.items || [];
      const loadedTransfers = Array.isArray(transfersRes.data)
        ? transfersRes.data
        : (transfersRes.data?.data || []);

      setOutlets(loadedOutlets);
      setItems(loadedItems);
      setExistingTransfers(loadedTransfers);

      // Default Origin Outlet (HQ / Main)
      const main = loadedOutlets.find((o) => o.is_main) || loadedOutlets[0];
      if (main) {
        setBulkOriginOutletId(main.id);
      }

      // Default Target Outlets: All satellite branches
      const satellites = loadedOutlets.filter((o) => !o.is_main);
      if (satellites.length > 0) {
        setBulkTargetOutletIds(satellites.map((s) => s.id));
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        setPermissionError(
          err.response?.data?.error ||
            (language === "en"
              ? "Access Restricted: You do not have permission to view cross-branch stock matrix."
              : "Hak akses terbatas. Anda tidak memiliki izin untuk melihat matriks stok multi-cabang.")
        );
      } else {
        toast.error(
          err.response?.data?.message ||
            (language === "en"
              ? "Failed to load stock matrix"
              : "Gagal memuat data matriks stok")
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrixData();
  }, []);

  // Categories list derived from items
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((it) => {
      if (it.category_id && it.category_name) {
        map.set(it.category_id, it.category_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  // Satellite outlets (non-main)
  const satelliteOutlets = useMemo(() => {
    return outlets.filter((o) => !o.is_main);
  }, [outlets]);

  // Main Outlet (HQ / Origin Warehouse)
  const mainOutlet = useMemo(() => {
    return outlets.find((o) => o.is_main) || outlets[0];
  }, [outlets]);

  // Filtering items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Search Query
      const matchesSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.category_name && item.category_name.toLowerCase().includes(searchQuery.toLowerCase()));

      // Category Filter (Multi-select)
      const matchesCategory =
        selectedCategories.length === 0 ||
        (item.category_id && selectedCategories.includes(item.category_id));

      // Domain Type Filter (Multi-select)
      const matchesDomain =
        selectedDomainTypes.length === 0 ||
        selectedDomainTypes.includes(item.item_type);

      // Stock Condition Filter
      let matchesStockCondition = true;
      if (stockConditionFilter === "critical") {
        const hasCritical = outlets.some((o) => {
          const st = item.stocks[o.id];
          if (!st) return true;
          const totalUnits = (st.qty_sealed * (item.conversion_rate || 1)) + st.qty_loose;
          return totalUnits > 0 && totalUnits <= item.min_stock_alert;
        });
        matchesStockCondition = hasCritical;
      } else if (stockConditionFilter === "empty") {
        const hasEmpty = outlets.some((o) => {
          const st = item.stocks[o.id];
          if (!st) return true;
          const totalUnits = (st.qty_sealed * (item.conversion_rate || 1)) + st.qty_loose;
          return totalUnits === 0;
        });
        matchesStockCondition = hasEmpty;
      } else if (stockConditionFilter === "safe") {
        const allSafe = outlets.every((o) => {
          const st = item.stocks[o.id];
          if (!st) return false;
          const totalUnits = (st.qty_sealed * (item.conversion_rate || 1)) + st.qty_loose;
          return totalUnits > item.min_stock_alert;
        });
        matchesStockCondition = allSafe;
      }

      return matchesSearch && matchesCategory && matchesDomain && matchesStockCondition;
    });
  }, [items, searchQuery, selectedCategories, selectedDomainTypes, stockConditionFilter, outlets]);

  // Count active filters for toolbar badge
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedCategories.length > 0) count += selectedCategories.length;
    if (selectedDomainTypes.length > 0) count += selectedDomainTypes.length;
    if (stockConditionFilter !== "all") count += 1;
    return count;
  }, [selectedCategories, selectedDomainTypes, stockConditionFilter]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedCategories([]);
    setSelectedDomainTypes([]);
    setStockConditionFilter("all");
  };

  // Selection Handlers (WhatsApp-style)
  const handleToggleSelectAll = () => {
    if (selectedItemIds.length === filteredItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(filteredItems.map((i) => i.id));
    }
  };

  const handleToggleItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Open Bulk Draft Dialog
  const handleOpenBulkDraftDialog = () => {
    if (selectedItemIds.length === 0) {
      toast.error(
        language === "en"
          ? "Please select at least 1 item first"
          : "Pilih setidaknya 1 barang terlebih dahulu"
      );
      return;
    }
    // Pre-populate target outlets to all satellites if empty
    if (bulkTargetOutletIds.length === 0 && satelliteOutlets.length > 0) {
      setBulkTargetOutletIds(satelliteOutlets.map((s) => s.id));
    }
    setIsBulkDraftDialogOpen(true);
  };

  // Submit Multi-Branch Draft Creation
  const handleConfirmBulkDraft = async () => {
    if (bulkTargetOutletIds.length === 0) {
      toast.error(
        language === "en"
          ? "Please select at least 1 destination branch"
          : "Pilih setidaknya 1 cabang tujuan distribusi"
      );
      return;
    }

    const originOutletId = mainOutlet?.id || (outlets.length > 0 ? outlets[0].id : "");
    if (!originOutletId) {
      toast.error(
        language === "en"
          ? "Origin main warehouse not found"
          : "Gudang pusat / pengirim tidak ditemukan"
      );
      return;
    }

    const selectedItemsData = items
      .filter((i) => selectedItemIds.includes(i.id))
      .map((i) => ({
        item_id: i.id,
        qty_sent_sealed: 0,
        qty_sent_loose: 1, // Default baseline unit
      }));

    setIsSubmittingBulkDraft(true);
    try {
      // Loop create draft transfers for each selected destination branch
      const requests = bulkTargetOutletIds.map((targetOutletId) => {
        const payload = {
          from_outlet_id: originOutletId,
          to_outlet_id: targetOutletId,
          status: "draft",
          transfer_type: "outbound",
          notes: "Draf distribusi massal dari Matriks Stok",
          items: selectedItemsData,
        };
        return api.post("/transfers", payload);
      });

      await Promise.all(requests);

      toast.success(
        language === "en"
          ? `Successfully created ${bulkTargetOutletIds.length} draft distribution documents for ${selectedItemsData.length} items!`
          : `Berhasil membuat ${bulkTargetOutletIds.length} dokumen draf distribusi untuk ${selectedItemsData.length} item barang!`
      );

      setIsBulkDraftDialogOpen(false);
      setIsSelectionMode(false);
      setSelectedItemIds([]);

      if (onNavigateToDistribution) {
        onNavigateToDistribution();
      }
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          (language === "en"
            ? "Failed to generate bulk drafts"
            : "Gagal membuat draf distribusi massal")
      );
    } finally {
      setIsSubmittingBulkDraft(false);
    }
  };

  if (permissionError) {
    return (
      <div className="p-8 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] text-center max-w-lg mx-auto my-12 space-y-4 shadow-sm animate-in fade-in">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {language === "en" ? "Access Restricted" : "Akses Matriks Dibatasi"}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {permissionError}
          </p>
        </div>
        {onBackToInventory && (
          <button
            type="button"
            onClick={onBackToInventory}
            className="px-5 py-2.5 rounded-full bg-[#E2FF66] hover:bg-[#d8fa55] text-slate-900 font-bold text-xs cursor-pointer"
          >
            {language === "en" ? "Back to Branch Inventory" : "Kembali ke Inventori Cabang"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12 text-left">
      {/* ── 1. FRAMELESS PAGE HEADER (Rule 17) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200/80 dark:border-[#2E2E34] gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Matriks Saldo Stok Multi-Cabang
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-1">
            Observasi komparatif saldo stok fisik real-time di seluruh cabang, gudang pusat, dan outlet satelit.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={fetchMatrixData}
            disabled={isLoading}
            className="p-2.5 rounded-2xl border border-slate-200 dark:border-[#2E2E34] hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer shadow-xs"
            title="Refresh Matriks Stok"
          >
            <RotateCcw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          {/* WhatsApp-Style Row Selection Switcher */}
          <button
            type="button"
            onClick={() => {
              setIsSelectionMode(!isSelectionMode);
              if (isSelectionMode) setSelectedItemIds([]);
            }}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
              isSelectionMode
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                : "bg-[#E2FF66] hover:bg-[#d8fa55] text-slate-900 font-extrabold"
            }`}
          >
            {isSelectionMode ? (
              <>
                <X className="w-4 h-4" />
                <span>Batal Memilih</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Pilih Barang untuk Distribusi...</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── 2. SEARCH BAR & RICH HORIZONTAL MULTI-FILTER TOOLBAR (MATCHING MASTER ITEM) ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search Bar - Expands to fill available space */}
        <div className="flex-1">
          <ErpSearchBar
            inputRef={searchInputRef}
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={language === "en" ? "Search item name, category or SKU... (Press '/')" : "Cari nama barang, kategori, atau barcode SKU... (Tekan '/')"}
          />
        </div>

        {/* ── UNIFIED REUSABLE POPUP FILTER COMPONENT (ErpFilterPopover) ── */}
        <ErpFilterPopover
          activeCount={activeFiltersCount}
          onResetAll={handleResetFilters}
          title={language === "en" ? "Filter Stock Matrix" : "Filter Matriks Stok"}
          resetLabel={language === "en" ? "Reset Filter" : "Reset Filter"}
          filterButtonLabel={language === "en" ? "Filter Data" : "Filter Data"}
          columnGroups={[
            {
              id: "stock_condition",
              title: language === "en" ? "Stock Level Condition" : "Kondisi Saldo Stok",
              type: "single",
              selectedValue: stockConditionFilter,
              onSelectSingle: (val) => setStockConditionFilter(val as any),
              options: [
                { key: "all", label: "Semua Kondisi" },
                { key: "critical", label: "Kritis / Menipis (≤ Batas Min)" },
                { key: "empty", label: "Stok Habis (0)" },
                { key: "safe", label: "Stok Aman (> Batas Min)" },
              ],
            },
            {
              id: "categories",
              title: language === "en" ? "Product Category" : "Kategori Produk",
              type: "multi",
              selectedValues: selectedCategories,
              onToggleMulti: (key) => {
                setSelectedCategories((prev) =>
                  prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
                );
              },
              options: categories.map((c) => ({
                key: c.id,
                label: c.name,
              })),
            },
            {
              id: "domain_types",
              title: language === "en" ? "Item Domain Type" : "Tipe Domain Item",
              type: "multi",
              selectedValues: selectedDomainTypes,
              onToggleMulti: (key) => {
                setSelectedDomainTypes((prev) =>
                  prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
                );
              },
              options: [
                { key: "finished_good", label: "Produk Jadi (Finished Good)" },
                { key: "semi_finished", label: "Setengah Jadi (WIP / Olahan)" },
                { key: "raw_material", label: "Bahan Mentah (Raw Material)" },
                { key: "consumable", label: "Kemasan / Bahan Habis Pakai" },
                { key: "fixed_tool", label: "Alat / Aset Tetap" },
              ],
            },
          ]}
        />
      </div>

      {/* ── 3. FLOATING BULK DRAFT ACTION BAR (WHATSAPP-STYLE) ── */}
      {isSelectionMode && selectedItemIds.length > 0 && (
        <div className="sticky top-4 z-30 p-3.5 sm:p-4 rounded-3xl bg-slate-900 text-white dark:bg-[#141416] dark:border dark:border-[#E2FF66]/40 shadow-2xl space-y-3 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#E2FF66] text-slate-900 flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
                {selectedItemIds.length}
              </div>
              <div>
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <span>{selectedItemIds.length} Barang Terpilih</span>
                  <span className="text-[11px] font-normal text-slate-400">
                    (dari {filteredItems.length} total barang pada tabel)
                  </span>
                </h4>
                <p className="text-xs text-slate-400">
                  Klik tombol Buat Draf untuk memilih cabang tujuan pengiriman secara bersamaan.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                {selectedItemIds.length === filteredItems.length
                  ? "Lepas Semua"
                  : "Pilih Semua"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedItemIds([])}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                Bersihkan
              </button>

              <button
                type="button"
                onClick={handleOpenBulkDraftDialog}
                className="px-5 py-2 rounded-2xl bg-[#E2FF66] hover:bg-[#d8fa55] text-slate-900 font-extrabold text-xs shadow-md active:scale-98 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Truck className="w-4 h-4" />
                <span>Buat Draf Distribusi ({selectedItemIds.length} Item)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. STOCK MATRIX TABLE (STANDARD ERP DATA TABLE CONTAINER & CAPSULE THEAD) ── */}
      <div
        className="bg-white dark:bg-dark-card border border-slate-200/80 dark:border-dark-border rounded-3xl shadow-sm p-3 sm:p-4"
        style={{
          boxShadow: isDark
            ? "0 4px 24px 0 rgba(0,0,0,0.35)"
            : "0 4px 20px 0 rgba(0,0,0,0.06)",
        }}
      >
        <div className="overflow-x-auto">
          <table
            className="w-full text-left border-separate"
            style={{
              borderSpacing: 0,
              minWidth: `${450 + outlets.length * 160}px`,
            }}
          >
            {/* Floating Capsule Header (Rule 4 Styling) */}
            <thead className="group/thead select-none">
              <tr className="bg-[#E7E9ED] dark:bg-[#2E2E34] text-slate-800 dark:text-slate-200 text-xs font-bold">
                {/* Checkbox Column */}
                {isSelectionMode && (
                  <th className="py-2.5 px-3 w-10 text-center sticky left-0 z-20 bg-[#E7E9ED] dark:bg-[#2E2E34] rounded-l-full">
                    <Checkbox
                      checked={
                        filteredItems.length > 0 &&
                        selectedItemIds.length === filteredItems.length
                      }
                      onCheckedChange={handleToggleSelectAll}
                    />
                  </th>
                )}

                {/* Master Item Info (Name & Category Only) */}
                <th
                  className={`py-2.5 px-4 min-w-[220px] sticky ${
                    isSelectionMode ? "left-10" : "left-0 rounded-l-full"
                  } z-20 bg-[#E7E9ED] dark:bg-[#2E2E34]`}
                >
                  <div className="flex items-center justify-between">
                    <span>Nama Item & Kategori</span>
                    <span className="text-[10px] font-mono text-slate-500 font-normal">
                      {filteredItems.length} SKU
                    </span>
                  </div>
                </th>

                {/* Total Global Stock Column */}
                <th className="py-2.5 px-3 min-w-[120px] text-center bg-[#E7E9ED] dark:bg-[#2E2E34] border-x border-slate-200/80 dark:border-[#38383C]">
                  <div className="flex flex-col items-center">
                    <span className="font-extrabold text-slate-900 dark:text-white">Total Global</span>
                    <span className="text-[9px] font-normal text-slate-500">Semua Cabang</span>
                  </div>
                </th>

                {/* Dynamic Outlet Columns */}
                {outlets.map((outlet, idx) => {
                  const isLast = idx === outlets.length - 1;
                  return (
                    <th
                      key={outlet.id}
                      className={`py-2.5 px-3 min-w-[150px] text-center border-r border-slate-200/80 dark:border-[#38383C] ${
                        isLast ? "rounded-r-full" : ""
                      }`}
                    >
                      <div className="flex flex-col items-center text-center truncate">
                        <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[130px]" title={outlet.name}>
                          {outlet.name}
                        </span>
                        {outlet.address && (
                          <span className="text-[9px] text-slate-400 truncate max-w-[130px] font-normal">
                            {outlet.address}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Table Rows */}
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={outlets.length + (isSelectionMode ? 3 : 2)}
                    className="py-12 text-center text-slate-400"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      <p className="text-xs font-semibold">Memuat saldo stok multi-cabang...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={outlets.length + (isSelectionMode ? 3 : 2)}
                    className="py-12 text-center text-slate-400"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Boxes className="w-8 h-8 stroke-1 text-slate-300 dark:text-slate-600" />
                      <p className="text-xs font-semibold">
                        Tidak ada data barang yang sesuai dengan filter pencarian.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = selectedItemIds.includes(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-white/5 ${
                        isSelected ? "bg-primary/5 dark:bg-primary/10" : ""
                      }`}
                    >
                      {/* Checkbox Column */}
                      {isSelectionMode && (
                        <td className="px-3 py-2 border-b border-slate-200/80 dark:border-[#38383C] text-center sticky left-0 z-10 bg-white dark:bg-dark-card">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleItem(item.id)}
                          />
                        </td>
                      )}

                      {/* Master Item Info (Click Cell directly to trigger contextual detail popover - No HelpCircle icon) */}
                      <td
                        className={`px-4 py-2 border-b border-slate-200/80 dark:border-[#38383C] sticky ${
                          isSelectionMode ? "left-10" : "left-0"
                        } z-10 bg-white dark:bg-dark-card border-r border-slate-100 dark:border-[#2E2E34]`}
                      >
                        <Popover>
                          <PopoverTrigger
                            type="button"
                            className="w-full text-left cursor-pointer group focus:outline-none block"
                            title="Klik untuk melihat detail item"
                          >
                            <div className="space-y-0.5 truncate max-w-[210px]">
                              <span
                                className="font-bold text-xs text-slate-900 dark:text-slate-100 block truncate group-hover:text-[#3F73F7] dark:group-hover:text-[#3F73F7] transition-colors"
                                title={item.name}
                              >
                                {item.name}
                              </span>
                              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block truncate">
                                {item.category_name || "Uncategorized"}
                              </span>
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 p-4 rounded-3xl bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#38383C] shadow-2xl text-xs space-y-3">
                            <div className="pb-2 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                              <span className="font-extrabold text-slate-900 dark:text-white text-xs">
                                {item.name}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 capitalize">
                                {item.item_type.replace("_", " ")}
                              </span>
                            </div>

                            <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                              {item.sku && (
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Barcode / SKU:</span>
                                  <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{item.sku}</span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="text-slate-400">Kategori:</span>
                                <span className="font-semibold">{item.category_name || "Uncategorized"}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Rasio Satuan (UOM):</span>
                                <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                                  {item.conversion_rate > 1
                                    ? `1 ${item.box_unit} = ${item.conversion_rate} ${item.base_unit}`
                                    : `Satuan Tunggal (${item.base_unit})`}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Batas Alert Min:</span>
                                <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                                  {item.min_stock_alert} {item.base_unit}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Harga Jual:</span>
                                <span className="font-bold text-slate-900 dark:text-white">
                                  Rp {Number(item.sell_price || 0).toLocaleString("id-ID")}
                                </span>
                              </div>
                              {item.standard_cost > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Modal Dasar (HPP):</span>
                                  <span className="font-medium text-slate-500">
                                    Rp {Number(item.standard_cost || 0).toLocaleString("id-ID")}
                                  </span>
                                </div>
                              )}
                            </div>

                            {(item.is_thawable || item.is_produced) && (
                              <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center gap-2">
                                {item.is_thawable && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400">
                                    <Snowflake className="w-3 h-3" />
                                    Pencairan Thaw
                                  </span>
                                )}
                                {item.is_produced && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                                    <ChefHat className="w-3 h-3" />
                                    Produksi Dapur
                                  </span>
                                )}
                              </div>
                            )}
                          </PopoverContent>
                        </Popover>
                      </td>

                      {/* Total Global Stock */}
                      <td className="px-3 py-2 border-b border-slate-200/80 dark:border-[#38383C] text-center bg-transparent border-r border-slate-200/80 dark:border-[#2E2E34]">
                        <div className="flex flex-col items-center justify-center">
                          {item.conversion_rate > 1 ? (
                            <>
                              <div className="flex items-center gap-1 text-base sm:text-lg font-black font-mono text-slate-900 dark:text-slate-100">
                                <span>{item.total_qty_sealed.toLocaleString("id-ID")}</span>
                                <span className="text-[11px] font-bold text-slate-500">
                                  {item.box_unit}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-xs sm:text-sm font-black font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                                <span>+{item.total_qty_loose.toLocaleString("id-ID")}</span>
                                <span className="text-[10px] font-medium">{item.base_unit}</span>
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center gap-1 text-base sm:text-lg font-black font-mono text-slate-900 dark:text-slate-100">
                              <span>{item.total_qty_loose.toLocaleString("id-ID")}</span>
                              <span className="text-[11px] font-bold text-slate-500">
                                {item.base_unit}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Dynamic Outlet Stock Cells (Tint only when 0 or <= min_stock_alert, otherwise transparent) */}
                      {outlets.map((outlet) => {
                        const st = item.stocks[outlet.id] || {
                          qty_sealed: 0,
                          qty_loose: 0,
                        };
                        const totalBaseEquivalent =
                          st.qty_sealed * (item.conversion_rate || 1) + st.qty_loose;

                        // Tint background only on empty or critical, transparent on safe/normal
                        let cellBgClass = "bg-transparent text-slate-900 dark:text-slate-100";
                        if (totalBaseEquivalent === 0) {
                          cellBgClass = "bg-rose-500/[0.12] dark:bg-rose-950/40 text-rose-700 dark:text-rose-300";
                        } else if (totalBaseEquivalent <= item.min_stock_alert) {
                          cellBgClass = "bg-amber-500/[0.12] dark:bg-amber-950/40 text-amber-700 dark:text-amber-300";
                        }

                        return (
                          <td
                            key={outlet.id}
                            className={`px-3 py-2 border-b border-slate-200/80 dark:border-[#38383C] text-center border-r border-slate-100 dark:border-[#2E2E34] transition-colors ${cellBgClass}`}
                          >
                            <div className="flex flex-col items-center justify-center">
                              {item.conversion_rate > 1 ? (
                                <>
                                  <div className="flex items-center gap-1 text-base sm:text-lg font-black font-mono">
                                    <span>{st.qty_sealed.toLocaleString("id-ID")}</span>
                                    <span className="text-[11px] font-bold opacity-75">
                                      {item.box_unit}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 text-xs sm:text-sm font-black font-mono opacity-85 mt-0.5">
                                    <span>+{st.qty_loose.toLocaleString("id-ID")}</span>
                                    <span className="text-[10px] opacity-75">
                                      {item.base_unit}
                                    </span>
                                  </div>
                                </>
                              ) : (
                                <div className="flex items-center gap-1 text-base sm:text-lg font-black font-mono">
                                  <span>{st.qty_loose.toLocaleString("id-ID")}</span>
                                  <span className="text-[11px] font-bold opacity-75">
                                    {item.base_unit}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DIALOG: BUAT DRAF DISTRIBUSI MULTI-CABANG (BULK DRAFT CREATION MODAL)     */}
      {/* ========================================================================= */}
      <Dialog open={isBulkDraftDialogOpen} onOpenChange={setIsBulkDraftDialogOpen}>
        <DialogContent className="max-w-xl p-6 bg-white dark:bg-[#202024] border-slate-200 dark:border-[#38383C] text-slate-900 dark:text-white rounded-3xl shadow-2xl">
          <DialogHeader className="p-0 pb-3 border-b border-slate-100 dark:border-white/5 text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#E2FF66]/20 text-slate-900 dark:text-[#E2FF66] flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-extrabold text-slate-900 dark:text-white">
                  Penerbitan Draf Distribusi Multi-Cabang
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  {selectedItemIds.length} item barang terpilih akan diterbitkan surat jalan draf serentak.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 text-left">
            {/* 1. Static Origin Main Warehouse Info Card (Minimalist User Error) */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-[#38383C] flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Gudang / Cabang Pengirim (Otomatis Pusat)
                  </span>
                  <span className="font-extrabold text-slate-900 dark:text-white text-xs truncate block">
                    {mainOutlet?.name || "Gudang Pusat / Main HQ"}
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 shrink-0">
                Pusat / HQ
              </span>
            </div>

            {/* 2. Destination Outlets as Cards Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span>Pilih Cabang Tujuan Penerima</span>
                  <span className="text-[11px] font-extrabold text-[#3F73F7] dark:text-[#E2FF66]">
                    ({bulkTargetOutletIds.length} Cabang Dipilih)
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (bulkTargetOutletIds.length === satelliteOutlets.length) {
                      setBulkTargetOutletIds([]);
                    } else {
                      setBulkTargetOutletIds(satelliteOutlets.map((s) => s.id));
                    }
                  }}
                  className="text-xs font-bold text-[#3F73F7] dark:text-[#E2FF66] hover:underline cursor-pointer"
                >
                  {bulkTargetOutletIds.length === satelliteOutlets.length
                    ? "Lepas Semua"
                    : "Pilih Semua Satelit"}
                </button>
              </div>

              {/* Outlet Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {satelliteOutlets.length === 0 ? (
                  <div className="col-span-2 text-center py-8 text-xs text-slate-400">
                    Tidak ada cabang satelit tujuan yang terdaftar.
                  </div>
                ) : (
                  satelliteOutlets.map((o) => {
                    const isChecked = bulkTargetOutletIds.includes(o.id);
                    const activeDraftsForOutlet = existingTransfers.filter(
                      (d) => d.to_outlet_id === o.id && (d.status === "draft" || d.status === "pending_approval")
                    );
                    return (
                      <div
                        key={o.id}
                        onClick={() => {
                          if (isChecked) {
                            setBulkTargetOutletIds((prev) => prev.filter((id) => id !== o.id));
                          } else {
                            setBulkTargetOutletIds((prev) => [...prev, o.id]);
                          }
                        }}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-2.5 select-none ${
                          isChecked
                            ? "bg-[#3F73F7]/10 dark:bg-[#3F73F7]/15 border-[#3F73F7] dark:border-[#3F73F7] shadow-xs ring-1 ring-[#3F73F7]/40"
                            : "bg-white dark:bg-[#1C1C20] border-slate-200/90 dark:border-[#333338] hover:border-slate-300 dark:hover:border-[#484850]"
                        }`}
                      >
                        <div className="pt-0.5 shrink-0">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setBulkTargetOutletIds((prev) => [...prev, o.id]);
                              } else {
                                setBulkTargetOutletIds((prev) => prev.filter((id) => id !== o.id));
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className={`font-bold text-xs truncate ${
                              isChecked ? "text-[#3F73F7] dark:text-white font-extrabold" : "text-slate-900 dark:text-slate-100"
                            }`}>
                              {o.name}
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 shrink-0">
                              Satelit
                            </span>
                          </div>

                          <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-tight">
                            {o.address || "Lokasi outlet operasional"}
                          </p>

                          {activeDraftsForOutlet.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-200/80 dark:border-amber-800/40">
                              <AlertTriangle className="w-3 h-3 shrink-0 text-amber-600 dark:text-amber-400" />
                              <span className="truncate">
                                {(t.distBulkDraftHasExistingWarn || "Cabang ini sudah memiliki {count} draf aktif ({draftNo})")
                                  .replace("{count}", String(activeDraftsForOutlet.length))
                                  .replace("{draftNo}", activeDraftsForOutlet[0].transfer_no || `#${activeDraftsForOutlet[0].id.slice(0, 8)}`)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 3. Summary Box */}
            <div className="p-3 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/30 text-xs space-y-1">
              <div className="flex items-center justify-between font-bold text-blue-900 dark:text-blue-200">
                <span>Rincian Penerbitan:</span>
                <span>{bulkTargetOutletIds.length} Dokumen Draf</span>
              </div>
              <p className="text-[11px] text-blue-700 dark:text-blue-300">
                Setiap dokumen draf akan otomatis dibuatkan di modul distribusi tanpa memotong saldo stok fisik gudang asal sampai Anda menetapkannya kirim.
              </p>
            </div>
          </div>

          <DialogFooter className="p-0 pt-3 border-t border-slate-100 dark:border-white/5 flex sm:justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsBulkDraftDialogOpen(false)}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#202024] hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleConfirmBulkDraft}
              disabled={isSubmittingBulkDraft || bulkTargetOutletIds.length === 0}
              className="px-5 py-2.5 rounded-2xl bg-[#E2FF66] hover:bg-[#d8fa55] text-slate-900 font-extrabold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmittingBulkDraft ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menerbitkan Draf...</span>
                </>
              ) : (
                <>
                  <Truck className="w-4 h-4" />
                  <span>Terbitkan Draf ({bulkTargetOutletIds.length} Cabang)</span>
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
