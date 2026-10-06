import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { ErpSearchBar } from "./ErpSearchBar";
import {
  Package,
  LayoutGrid,
  List,
  Check,
  Filter,
  Image as ImageIcon,
  Plus,
} from "lucide-react";
import { getImageUrl } from "~/lib/utils";

import { useLanguageStore, translations } from "~/lib/i18n";

export interface ItemSelectorItem {
  id: string;
  name: string;
  sku?: string;
  category_name?: string;
  image_url?: string;
  base_unit?: string;
  box_unit?: string;
  conversion_rate?: number;
  qty_sealed?: number;
  qty_loose?: number;
  price?: number;
  cost?: number;
  [key: string]: any;
}

export interface ItemSelectorModalProps {
  open?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  title?: string;
  description?: string;
  items: ItemSelectorItem[];
  selectedIds?: string[];
  selectedItemIds?: string[];
  onConfirm?: (selectedIds: string[]) => void;
  onApply?: (selectedIds: string[]) => void;
  showStockFilter?: boolean;
  defaultInStockOnly?: boolean;
  emptyText?: string;
  confirmButtonText?: string;
  onQuickCreate?: (query: string) => void;
}

export function ItemSelectorModal({
  open,
  isOpen,
  onOpenChange,
  onClose,
  title,
  description,
  items = [],
  selectedIds: initialSelectedIds,
  selectedItemIds: initialSelectedItemIds,
  onConfirm,
  onApply,
  showStockFilter = false,
  defaultInStockOnly = false,
  emptyText,
  confirmButtonText,
  onQuickCreate,
}: ItemSelectorModalProps) {
  const isModalOpen = open ?? isOpen ?? false;
  const handleOpenChange = (newOpen: boolean) => {
    if (onOpenChange) onOpenChange(newOpen);
    if (!newOpen && onClose) onClose();
  };

  const initialIds = initialSelectedIds ?? initialSelectedItemIds ?? [];

  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;

  const resolvedTitle = title || t.itemPickerTitleDefault || "Pilih Produk";
  const resolvedDesc = description || t.itemPickerDescDefault || "Tahan & geser (drag) kursor untuk memilih banyak produk dengan cepat";
  const resolvedEmptyText = emptyText || t.itemPickerEmpty || "Tidak ada produk yang cocok dengan pencarian";
  const resolvedConfirmText = confirmButtonText || t.itemPickerApply || "Terapkan Pilihan";
  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [inStockOnly, setInStockOnly] = useState<boolean>(defaultInStockOnly);

  // Drag selection state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragMode, setDragMode] = useState<"select" | "deselect">("select");

  // Synchronize when modal opens
  useEffect(() => {
    if (isModalOpen) {
      setSelectedIds(initialIds);
      setSearchQuery("");
      setInStockOnly(defaultInStockOnly);
    }
  }, [isModalOpen, initialIds, defaultInStockOnly]);

  // Global mouseup to release drag
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, []);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      // Stock filter
      if (showStockFilter && inStockOnly) {
        const hasStock = (it.qty_sealed || 0) > 0 || (it.qty_loose || 0) > 0;
        if (!hasStock) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = it.name.toLowerCase().includes(q);
        const matchSKU = (it.sku || "").toLowerCase().includes(q);
        const matchCat = (it.category_name || "").toLowerCase().includes(q);
        return matchName || matchSKU || matchCat;
      }

      return true;
    });
  }, [items, showStockFilter, inStockOnly, searchQuery]);

  // Drag selection handlers
  const handleItemMouseDown = useCallback(
    (id: string) => {
      setIsDragging(true);
      if (selectedIds.includes(id)) {
        setDragMode("deselect");
        setSelectedIds((prev) => prev.filter((tID) => tID !== id));
      } else {
        setDragMode("select");
        setSelectedIds((prev) => [...prev, id]);
      }
    },
    [selectedIds]
  );

  const handleItemMouseEnter = useCallback(
    (id: string) => {
      if (!isDragging) return;
      if (dragMode === "select" && !selectedIds.includes(id)) {
        setSelectedIds((prev) => [...prev, id]);
      } else if (dragMode === "deselect" && selectedIds.includes(id)) {
        setSelectedIds((prev) => prev.filter((tID) => tID !== id));
      }
    },
    [isDragging, dragMode, selectedIds]
  );

  // Bulk actions
  const handleSelectAll = (selectAll: boolean) => {
    if (selectAll) {
      const visibleIds = filteredItems.map((i) => i.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    } else {
      const visibleIds = new Set(filteredItems.map((i) => i.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    }
  };

  const handleConfirm = () => {
    if (onConfirm) onConfirm(selectedIds);
    if (onApply) onApply(selectedIds);
    handleOpenChange(false);
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] rounded-3xl p-6 bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#38383C] shadow-2xl flex flex-col gap-4 overflow-hidden">
        {/* Dialog Header: Clean without count badge */}
        <DialogHeader className="text-left pb-3 border-b border-slate-100 dark:border-white/5 space-y-1 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-purple/10 text-brand-purple dark:bg-primary/10 dark:text-primary flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-black text-slate-900 dark:text-white leading-tight">
                {resolvedTitle}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {resolvedDesc}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Search Bar & Action Controls Bar */}
        <div className="space-y-2.5 shrink-0">
          <ErpSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t.itemPickerSearchPlaceholder || "Cari nama produk, SKU (Barcode), atau kategori..."}
            size="sm"
            enableShortcut={true}
          />

          <div className="flex items-center justify-between text-xs font-bold px-1">
            {/* Left: View Mode Toggle & Optional Stock Filter */}
            <div className="flex items-center gap-2">
              <div className="inline-flex p-0.5 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200/80 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === "grid"
                      ? "bg-white dark:bg-[#2A2A2E] text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  }`}
                  title={t.itemPickerViewGrid || "Tampilan Grid"}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === "list"
                      ? "bg-white dark:bg-[#2A2A2E] text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  }`}
                  title={t.itemPickerViewList || "Tampilan List"}
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>

              {showStockFilter && (
                <button
                  type="button"
                  onClick={() => setInStockOnly(!inStockOnly)}
                  className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    inStockOnly
                      ? "bg-brand-purple/10 border-brand-purple text-brand-purple dark:bg-primary/10 dark:border-primary dark:text-primary"
                      : "border-slate-200 dark:border-[#38383C] text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5"
                  }`}
                >
                  <Filter className="w-3 h-3" />
                  <span>{t.itemPickerStockFilter || "Stok > 0 Saja"}</span>
                </button>
              )}
            </div>

            {/* Right: Select All & Deselect Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSelectAll(true)}
                className="text-brand-purple dark:text-primary hover:underline cursor-pointer"
              >
                {t.itemPickerSelectAll || "Pilih Semua"}
              </button>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <button
                type="button"
                onClick={() => handleSelectAll(false)}
                className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
              >
                {t.itemPickerClearAll || "Hapus Pilihan"}
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body: Scrollable Content with Drag-to-Select */}
        <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin select-none min-h-[300px] max-h-[50vh]">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-3">
              <Package className="w-8 h-8 stroke-[1.5] text-slate-300 dark:text-slate-600" />
              <p>{resolvedEmptyText}</p>
              {onQuickCreate && searchQuery.trim() && (
                <button
                  type="button"
                  onClick={() => onQuickCreate(searchQuery.trim())}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E2FF66] text-slate-900 font-bold text-xs hover:brightness-95 active:scale-95 transition shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Buat Barang Baru: &quot;{searchQuery.trim()}&quot; (Kilat)</span>
                </button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            /* ─── GRID MODE: Drag-to-Select Cards ─── */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-1">
              {filteredItems.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                const isDualUom = (item.conversion_rate || 1) > 1 && !!item.box_unit;
                const hasStock = (item.qty_sealed || 0) > 0 || (item.qty_loose || 0) > 0;

                return (
                  <div
                    key={item.id}
                    onMouseDown={() => handleItemMouseDown(item.id)}
                    onMouseEnter={() => handleItemMouseEnter(item.id)}
                    className={`group relative p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between overflow-hidden select-none ${
                      isSelected
                        ? "bg-brand-purple/10 border-brand-purple dark:bg-primary/10 dark:border-primary shadow-xs ring-2 ring-brand-purple/30 dark:ring-primary/30"
                        : "bg-white dark:bg-[#1A1A1E] border-slate-200 dark:border-[#38383C] hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-2xs"
                    }`}
                  >
                    {/* Selection Indicator Top-Right */}
                    <div className="absolute top-2.5 right-2.5 z-10 pointer-events-none">
                      <div
                        className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all ${
                          isSelected
                            ? "bg-brand-purple text-white dark:bg-[#E2FF66] dark:text-slate-900 shadow-xs"
                            : "bg-black/10 dark:bg-white/10 text-transparent group-hover:bg-slate-200 dark:group-hover:bg-white/20"
                        }`}
                      >
                        <Check className={`w-3.5 h-3.5 stroke-[3] ${isSelected ? "opacity-100" : "opacity-0"}`} />
                      </div>
                    </div>

                    {/* Thumbnail Image Container */}
                    <div className="w-full aspect-square rounded-xl bg-slate-100 dark:bg-white/5 mb-2.5 overflow-hidden flex items-center justify-center border border-slate-100 dark:border-white/5 relative pointer-events-none">
                      {item.image_url ? (
                        <img
                          src={getImageUrl(item.image_url)}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      )}
                    </div>

                    {/* Item Details */}
                    <div className="min-w-0 space-y-1 pointer-events-none">
                      {item.category_name && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 truncate max-w-full">
                          {item.category_name}
                        </span>
                      )}
                      <h5 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-2 leading-tight">
                        {item.name}
                      </h5>
                      <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                        {item.sku && (
                          <span className="font-mono text-slate-400 truncate">
                            {item.sku}
                          </span>
                        )}
                        {showStockFilter && (
                          <span className={`font-bold ${hasStock ? "text-slate-700 dark:text-slate-300" : "text-slate-400"}`}>
                            • {t.itemPickerOriginBalance || "Saldo"}: {isDualUom ? `${item.qty_sealed ?? 0} ${item.box_unit || "Dus"} + ${item.qty_loose ?? 0} ${item.base_unit || "pcs"}` : `${(item.qty_loose ?? 0) || (item.qty_sealed ?? 0)} ${item.base_unit || "pcs"}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ─── LIST MODE: Drag-to-Select Rows ─── */
            <div className="space-y-1.5 p-1">
              {filteredItems.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                const isDualUom = (item.conversion_rate || 1) > 1 && !!item.box_unit;
                const hasStock = (item.qty_sealed || 0) > 0 || (item.qty_loose || 0) > 0;

                return (
                  <div
                    key={item.id}
                    onMouseDown={() => handleItemMouseDown(item.id)}
                    onMouseEnter={() => handleItemMouseEnter(item.id)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                      isSelected
                        ? "bg-brand-purple/10 border-brand-purple dark:bg-primary/10 dark:border-primary shadow-xs ring-1 ring-brand-purple/40 dark:ring-primary/40"
                        : "bg-white dark:bg-[#1A1A1E] border-slate-200 dark:border-[#38383C] hover:bg-slate-50 dark:hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pointer-events-none">
                      <div
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                          isSelected
                            ? "bg-brand-purple border-brand-purple text-white dark:bg-[#E2FF66] dark:border-[#E2FF66] dark:text-slate-900"
                            : "border-slate-300 dark:border-white/20 bg-transparent"
                        }`}
                      >
                        <Check className={`w-3.5 h-3.5 stroke-[3] ${isSelected ? "opacity-100" : "opacity-0"}`} />
                      </div>

                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 overflow-hidden flex items-center justify-center shrink-0 border border-slate-100 dark:border-white/5">
                        {item.image_url ? (
                          <img
                            src={getImageUrl(item.image_url)}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                        )}
                      </div>

                      <div className="min-w-0 space-y-0.5 text-left">
                        <h5 className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                          {item.name}
                        </h5>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          {item.sku && <span className="font-mono">SKU: {item.sku}</span>}
                          {item.category_name && <span>• {item.category_name}</span>}
                          {isDualUom && (
                            <span className="font-semibold text-purple-600 dark:text-purple-300">
                              • 1 {item.box_unit} = {item.conversion_rate} {item.base_unit}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {showStockFilter && (
                      <div className="text-right space-y-0.5 shrink-0 pl-3 pointer-events-none">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">{t.itemPickerOriginBalance || "Saldo Asal"}</span>
                        <span className={`text-xs font-extrabold ${hasStock ? "text-slate-800 dark:text-slate-200" : "text-slate-400"}`}>
                          {isDualUom ? `${item.qty_sealed ?? 0} ${item.box_unit || "Dus"} + ${item.qty_loose ?? 0} ${item.base_unit || "pcs"}` : `${(item.qty_loose ?? 0) || (item.qty_sealed ?? 0)} ${item.base_unit || "pcs"}`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer: Selection Counter is exclusively rendered here */}
        <DialogFooter className="p-0 pt-3 border-t border-slate-200 dark:border-[#38383C] flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-600 dark:text-slate-300 font-bold">
            <span className="text-brand-purple dark:text-primary font-black">{selectedIds.length}</span> {language === "en" ? (selectedIds.length === 1 ? "item selected" : "items selected") : "item dipilih"}
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-[#38383C] text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer text-slate-700 dark:text-slate-300"
            >
              {t.cancel || "Batal"}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-2 rounded-xl bg-brand-purple hover:bg-brand-purple-hover text-white dark:bg-[#E2FF66] dark:text-slate-900 text-xs font-extrabold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{resolvedConfirmText}</span>
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
