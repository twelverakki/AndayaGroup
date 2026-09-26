import React, { useState, useEffect, useMemo } from "react";
import { useAuthStore } from "../lib/store";
import { useLanguageStore } from "../lib/i18n";
import { useAdjustmentSession, activateAdjustmentSession } from "../lib/adjustment-session";
import { api } from "../lib/api";
import { toast } from "./ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  SlidersHorizontal,
  Lock,
  Unlock,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Minus,
  Plus,
  Sparkles,
} from "lucide-react";

export interface Product {
  id: string;
  name: string;
  sku?: string;
  unit_type?: string;
  base_unit?: string;
  box_unit?: string;
  conversion_rate?: number;
  purchase_price?: number;
  sell_price?: number;
  current_stock?: number;
  qty_loose?: number;
  qty_sealed?: number;
  is_inventory_tracked?: boolean;
  category?: string;
  category_name?: string;
}

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSuccess?: () => void;
}

export function StockAdjustmentModal({
  isOpen,
  onClose,
  product,
  onSuccess,
}: StockAdjustmentModalProps) {
  const { activeContext } = useAuthStore();
  const { language } = useLanguageStore();
  const session = useAdjustmentSession();

  const isManagerOrOwner = activeContext?.role === "manager" || activeContext?.role === "owner";

  // Mode: "set_total" (Set exact physical count) vs "delta" (Add/Subtract diff)
  const [adjustType, setAdjustType] = useState<"set_total" | "delta">("set_total");
  const [targetStockInput, setTargetStockInput] = useState<string>("0");
  const [deltaInput, setDeltaInput] = useState<string>("0");
  const [reasonCategory, setReasonCategory] = useState("Barang Rusak / Cacat");
  const [customNotes, setCustomNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const currentStock = Number(product?.qty_loose ?? product?.current_stock ?? 0);
  const unitName = (product?.unit_type || product?.base_unit || "pcs").toUpperCase();
  const categoryLabel = product?.category_name || product?.category;

  // Auto-activate session for managers/owners to avoid unnecessary roadblocks
  useEffect(() => {
    if (isOpen && isManagerOrOwner && !session.active) {
      activateAdjustmentSession(24);
    }
  }, [isOpen, isManagerOrOwner, session.active]);

  // Reset modal state when opened or product changes
  useEffect(() => {
    if (product) {
      const stock = Number(product.qty_loose ?? product.current_stock ?? 0);
      setTargetStockInput(stock.toString());
      setDeltaInput("0");
      setReasonCategory("Barang Rusak / Cacat");
      setCustomNotes("");
      setError("");
      setAdjustType("set_total");
    }
  }, [product, isOpen]);

  // Calculate new stock and discrepancy based on input mode
  const { newStock, discrepancy } = useMemo(() => {
    if (adjustType === "set_total") {
      const parsedNew = parseFloat(targetStockInput) || 0;
      return {
        newStock: Math.max(0, parsedNew),
        discrepancy: Math.max(0, parsedNew) - currentStock,
      };
    } else {
      const parsedDelta = parseFloat(deltaInput) || 0;
      const computedNew = currentStock + parsedDelta;
      return {
        newStock: Math.max(0, computedNew),
        discrepancy: parsedDelta,
      };
    }
  }, [adjustType, targetStockInput, deltaInput, currentStock]);

  const handleStep = (stepAmount: number) => {
    if (adjustType === "set_total") {
      const currentVal = parseFloat(targetStockInput) || 0;
      const nextVal = Math.max(0, currentVal + stepAmount);
      setTargetStockInput(nextVal.toString());
    } else {
      const currentVal = parseFloat(deltaInput) || 0;
      const nextVal = currentVal + stepAmount;
      setDeltaInput(nextVal > 0 ? `+${nextVal}` : `${nextVal}`);
    }
  };

  const handleQuickDelta = (deltaAmount: number) => {
    if (adjustType === "set_total") {
      const currentVal = parseFloat(targetStockInput) || 0;
      const nextVal = Math.max(0, currentVal + deltaAmount);
      setTargetStockInput(nextVal.toString());
    } else {
      const currentVal = parseFloat(deltaInput) || 0;
      const nextVal = currentVal + deltaAmount;
      setDeltaInput(nextVal > 0 ? `+${nextVal}` : `${nextVal}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    if (product.is_inventory_tracked === false) {
      setError(
        language === "id"
          ? "Item ini tidak melacak stok (jasa/non-inventori) sehingga tidak memerlukan penyesuaian stok."
          : "This item is not inventory-tracked (service/non-inventory) and does not require adjustment."
      );
      return;
    }

    if (!session.active && !isManagerOrOwner) {
      setError(
        language === "id"
          ? "Sesi adjustment terkunci. Memerlukan otorisasi Manager."
          : "Adjustment session locked. Manager authorization required."
      );
      return;
    }

    if (newStock < 0) {
      setError(
        language === "id"
          ? "Stok akhir tidak boleh kurang dari 0"
          : "Final stock cannot be less than 0"
      );
      return;
    }

    setSubmitting(true);
    setError("");

    const finalReason = customNotes.trim()
      ? `${reasonCategory}: ${customNotes.trim()}`
      : reasonCategory;

    try {
      await api.post(`/items/${product.id}/adjust`, {
        actual_stock_loose: newStock,
        delta_loose: discrepancy,
        reason: finalReason,
        notes: customNotes.trim() || undefined,
      });

      toast.success(
        language === "id"
          ? `Stok ${product.name} berhasil disesuaikan (${discrepancy >= 0 ? "+" : ""}${discrepancy} ${unitName})`
          : `Stock for ${product.name} adjusted (${discrepancy >= 0 ? "+" : ""}${discrepancy} ${unitName})`
      );

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Failed to adjust stock:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          (language === "id" ? "Gagal menyimpan penyesuaian stok" : "Failed to adjust stock")
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg bg-white dark:bg-[#1C1C20] border border-slate-200/90 dark:border-[#2E2E34] text-slate-900 dark:text-slate-100 rounded-[32px] p-6 sm:p-8 shadow-2xl overflow-hidden">
        
        {/* Centered Modal Header */}
        <DialogHeader className="flex flex-col items-center text-center space-y-2 pb-2">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white flex items-center justify-center shadow-xs">
            <SlidersHorizontal className="w-6 h-6 stroke-[2]" />
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              {language === "id" ? "Penyesuaian Stok Fisik" : "Physical Stock Adjustment"}
            </span>
            <DialogTitle className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight px-4">
              {product.name}
            </DialogTitle>
          </div>

          <DialogDescription className="sr-only">
            {language === "id" ? "Form penyesuaian stok produk" : "Product stock adjustment form"}
          </DialogDescription>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
            {product.sku && (
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                {product.sku}
              </span>
            )}
            {categoryLabel && (
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-[11px] text-slate-700 dark:text-slate-300">
                {categoryLabel}
              </span>
            )}
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-[11px]">
              {language === "id" ? "Stok Sistem" : "System Stock"}:{" "}
              <strong className="text-slate-900 dark:text-white font-bold">{currentStock} {unitName}</strong>
            </span>
          </div>
        </DialogHeader>

        {/* ── UNTRACKED INVENTORY STATE ── */}
        {product.is_inventory_tracked === false ? (
          <div className="py-6 space-y-4 text-center">
            <div className="w-14 h-14 rounded-3xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/20 shadow-xs">
              <Sparkles className="w-7 h-7 stroke-[2]" />
            </div>

            <div className="space-y-1.5 max-w-sm mx-auto">
              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                {language === "id" ? "Item Non-Inventori / Tanpa Lacak Stok" : "Non-Inventory / Untracked Item"}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                {language === "id"
                  ? "Item ini dikonfigurasi sebagai item non-fisik/jasa tanpa pencatatan stok kartu. Seluruh transaksi kasir tidak memotong inventori dan tidak memerlukan penyesuaian stok opname."
                  : "This item is configured as a non-physical/service item without stock ledger tracking. POS transactions do not deduct inventory and physical stock adjustment is not needed."}
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 px-4 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:opacity-90 transition-all cursor-pointer shadow-sm"
              >
                {language === "id" ? "Tutup" : "Close"}
              </button>
            </div>
          </div>
        ) : !session.active && !isManagerOrOwner ? (
          <div className="py-8 space-y-5 text-center">
            <div className="w-14 h-14 rounded-3xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center border border-amber-500/20 shadow-xs">
              <Lock className="w-7 h-7 stroke-[2]" />
            </div>

            <div className="space-y-1.5 max-w-xs mx-auto">
              <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                {language === "id" ? "Sesi Penyesuaian Stok Terkunci" : "Stock Adjustment Session Locked"}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                {language === "id"
                  ? "Penyesuaian stok memerlukan otorisasi dari Owner atau Manager untuk menjaga akurasi ledger."
                  : "Stock adjustment requires active authorization from an Owner or Manager."}
              </p>
            </div>
          </div>
        ) : (
          /* ── ACTIVE ADJUSTMENT FORM ── */
          <form onSubmit={handleSubmit} className="space-y-6 pt-2">
            
            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-medium rounded-2xl border border-red-500/20 flex items-center gap-2 justify-center">
                <AlertCircle className="w-4 h-4 shrink-0 stroke-[2]" />
                <span>{error}</span>
              </div>
            )}

            {/* Mode Selector Tabs (Centered Capsule) */}
            <div className="flex justify-center">
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-[#25252A] rounded-2xl text-xs font-medium border border-slate-200/70 dark:border-[#303036] w-full max-w-xs">
                <button
                  type="button"
                  onClick={() => setAdjustType("set_total")}
                  className={`py-2 px-3 rounded-xl transition-all cursor-pointer text-center text-xs ${
                    adjustType === "set_total"
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs font-bold"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
                  }`}
                >
                  {language === "id" ? "Hitung Stok Fisik" : "Physical Count"}
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType("delta")}
                  className={`py-2 px-3 rounded-xl transition-all cursor-pointer text-center text-xs ${
                    adjustType === "delta"
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs font-bold"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
                  }`}
                >
                  {language === "id" ? "Tambah / Kurang (+/-)" : "Delta (+/-)"}
                </button>
              </div>
            </div>

            {/* Frameless Large Number with Custom Stepper Buttons */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 px-2">
                {/* Minus Stepper Button */}
                <button
                  type="button"
                  onClick={() => handleStep(-1)}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white flex items-center justify-center transition-all active:scale-90 cursor-pointer shrink-0 border border-slate-200/80 dark:border-white/10 shadow-xs"
                  title="Kurang 1"
                >
                  <Minus className="w-6 h-6 stroke-[2.5]" />
                </button>

                {/* Frameless Number Display */}
                <div className="flex-1 flex flex-col items-center justify-center min-w-0">
                  {adjustType === "set_total" ? (
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={targetStockInput}
                      onChange={(e) => setTargetStockInput(e.target.value)}
                      placeholder="0"
                      className="w-full text-5xl sm:text-6xl font-black font-mono text-center bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-slate-900 dark:text-white tracking-tight [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      autoFocus
                    />
                  ) : (
                    <input
                      type="number"
                      step="any"
                      value={deltaInput}
                      onChange={(e) => setDeltaInput(e.target.value)}
                      placeholder="0"
                      className="w-full text-5xl sm:text-6xl font-black font-mono text-center bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-slate-900 dark:text-white tracking-tight [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      autoFocus
                    />
                  )}
                  <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-1">
                    {unitName}
                  </span>
                </div>

                {/* Plus Stepper Button */}
                <button
                  type="button"
                  onClick={() => handleStep(1)}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white flex items-center justify-center transition-all active:scale-90 cursor-pointer shrink-0 border border-slate-200/80 dark:border-white/10 shadow-xs"
                  title="Tambah 1"
                >
                  <Plus className="w-6 h-6 stroke-[2.5]" />
                </button>
              </div>

              {/* Quick Delta Increment Chips */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                {[-10, -5, -1, 1, 5, 10].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleQuickDelta(amt)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 font-mono font-bold text-xs transition-all active:scale-95 cursor-pointer border border-slate-200/60 dark:border-white/5"
                  >
                    {amt > 0 ? `+${amt}` : amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Centered Live Discrepancy & Result Pill */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#25252A] border border-slate-200/80 dark:border-[#333338] flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {language === "id" ? "Selisih Penyesuaian:" : "Discrepancy:"}
                </span>
                <span
                  className={`font-mono font-black text-sm flex items-center gap-1 ${
                    discrepancy < 0
                      ? "text-red-600 dark:text-red-400"
                      : discrepancy > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-slate-500"
                  }`}
                >
                  {discrepancy < 0 && <TrendingDown className="w-4 h-4 stroke-[2.5]" />}
                  {discrepancy > 0 && <TrendingUp className="w-4 h-4 stroke-[2.5]" />}
                  <span>
                    {discrepancy >= 0 ? "+" : ""}
                    {discrepancy} {unitName}
                  </span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {language === "id" ? "Hasil Stok Akhir:" : "Final Stock:"}
                </span>
                <span className="font-mono font-black text-sm text-slate-900 dark:text-white px-2.5 py-1 rounded-xl bg-white dark:bg-[#1E1E22] border border-slate-200 dark:border-[#3A3A40] shadow-xs">
                  {newStock} {unitName}
                </span>
              </div>
            </div>

            {/* Reason Selection & Note */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {language === "id" ? "Alasan Penyesuaian (Audit Log)" : "Adjustment Reason (Audit Log)"}
                </label>
                <Select value={reasonCategory} onValueChange={(val) => val && setReasonCategory(val)}>
                  <SelectTrigger className="w-full h-11 rounded-2xl border-slate-200/90 dark:border-[#38383C] bg-white dark:bg-[#222226] text-xs font-medium text-slate-900 dark:text-white shadow-xs">
                    <SelectValue placeholder="Pilih Alasan..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-[#202024] border-slate-200 dark:border-[#38383C] text-xs font-medium rounded-2xl shadow-xl">
                    <SelectItem value="Barang Rusak / Cacat">Barang Rusak / Cacat</SelectItem>
                    <SelectItem value="Barang Kadaluarsa (Expired)">Barang Kadaluarsa (Expired)</SelectItem>
                    <SelectItem value="Barang Hilang / Selisih Fisik">Barang Hilang / Selisih Opname</SelectItem>
                    <SelectItem value="Bonus / Retur Supplier">Bonus / Retur Supplier</SelectItem>
                    <SelectItem value="Koreksi Input System">Koreksi Input System</SelectItem>
                    <SelectItem value="Lainnya">Lainnya (Catat Alasan Khusus)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {language === "id" ? "Catatan Tambahan (Opsional)" : "Additional Notes (Optional)"}
                </label>
                <input
                  type="text"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder={language === "id" ? "Contoh: Kemasan sobek saat penerimaan..." : "e.g. Torn packaging on delivery..."}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200/90 dark:border-[#38383C] bg-white dark:bg-[#222226] text-xs font-normal text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/15 dark:focus:ring-white/20 transition-all shadow-xs"
                />
              </div>
            </div>

            {/* Footer Action Buttons */}
            <DialogFooter className="gap-2 sm:gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="py-3 px-6 rounded-2xl border border-slate-200 dark:border-[#38383C] text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
              >
                {language === "id" ? "Batal" : "Cancel"}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="py-3 px-8 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs shadow-md hover:bg-black dark:hover:bg-slate-100 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                {submitting
                  ? (language === "id" ? "Menyimpan..." : "Saving...")
                  : (language === "id" ? "Simpan Penyesuaian" : "Save Adjustment")}
              </button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
