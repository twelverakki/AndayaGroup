import React, { useState, useEffect, useMemo } from "react";
import { useAuthStore } from "../lib/store";
import { useLanguageStore } from "../lib/i18n";
import { useAdjustmentSession } from "../lib/adjustment-session";
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
  Clock,
  Lock,
  Unlock,
  AlertCircle,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku?: string;
  unit_type: string;
  purchase_price: number;
  sell_price: number;
  current_stock: number;
  category?: string;
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

  // Adjustment Mode: "direct" (Set New Qty) or "relative" (Delta +/-)
  const [adjustType, setAdjustType] = useState<"direct" | "relative">("direct");
  const [targetStockInput, setTargetStockInput] = useState("");
  const [deltaInput, setDeltaInput] = useState("");
  const [reasonCategory, setReasonCategory] = useState("Barang Rusak / Cacat");
  const [customNotes, setCustomNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Reset modal state when opened
  useEffect(() => {
    if (product) {
      setTargetStockInput(product.current_stock.toString());
      setDeltaInput("0");
      setReasonCategory("Barang Rusak / Cacat");
      setCustomNotes("");
      setError("");
    }
  }, [product, isOpen]);

  const currentStock = product?.current_stock || 0;

  // Calculate new stock and discrepancy based on input mode
  const { newStock, discrepancy } = useMemo(() => {
    if (adjustType === "direct") {
      const parsedNew = parseFloat(targetStockInput) || 0;
      return {
        newStock: parsedNew,
        discrepancy: parsedNew - currentStock,
      };
    } else {
      const parsedDelta = parseFloat(deltaInput) || 0;
      return {
        newStock: Math.max(0, currentStock + parsedDelta),
        discrepancy: parsedDelta,
      };
    }
  }, [adjustType, targetStockInput, deltaInput, currentStock]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !session.active) return;

    if (newStock < 0) {
      setError(language === "id" ? "Stok baru tidak boleh negatif" : "New stock cannot be negative");
      return;
    }

    setSubmitting(true);
    setError("");

    const finalReason = customNotes
      ? `${reasonCategory}: ${customNotes}`
      : reasonCategory;

    try {
      // 1. Submit Wastage / Adjustment Audit Log to DB
      try {
        await api.post("/wastage-logs", {
          product_id: product.id,
          actual_qty: newStock,
          reason: finalReason,
        });
      } catch (err) {
        console.warn("Wastage log API fallback:", err);
      }

      // 2. Directly Update Product Current Stock in DB
      await api.put(`/products/${product.id}`, {
        ...product,
        current_stock: newStock,
      });

      // 3. Feedback Toast
      toast.success(
        language === "id"
          ? `Stok ${product.name} berhasil disesuaikan (${discrepancy >= 0 ? "+" : ""}${discrepancy} ${product.unit_type.toUpperCase()})`
          : `Stock for ${product.name} adjusted (${discrepancy >= 0 ? "+" : ""}${discrepancy} ${product.unit_type.toUpperCase()})`
      );

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Failed to adjust stock:", err);
      setError(err.response?.data?.message || err.message || "Gagal menyimpan penyesuaian stok");
    } finally {
      setSubmitting(false);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-[#1C1C20] border border-slate-200/90 dark:border-[#2E2E34] text-slate-900 dark:text-slate-100 rounded-[28px] p-6 sm:p-7 shadow-2xl">
        <DialogHeader className="space-y-1.5 text-left pb-3.5 border-b border-slate-100 dark:border-[#2A2A30] pr-6">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            <div className="w-6 h-6 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shrink-0">
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </div>
            <span>{language === "id" ? "Penyesuaian Stok" : "Stock Adjustment"}</span>
          </div>

          <div>
            <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-white truncate">
              {product.name}
            </DialogTitle>

            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
              SKU: {product.sku || "-"} • {language === "id" ? "Stok Sistem Saat Ini" : "Current Stock"}:{" "}
              <span className="text-slate-900 dark:text-white font-medium">
                {currentStock} {product.unit_type.toUpperCase()}
              </span>
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* ── LOCKED SESSION STATE (PERMISSION REQUIRED) ── */}
        {!session.active ? (
          <div className="py-6 space-y-5 text-center">
            <div className="w-14 h-14 rounded-3xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center border border-amber-500/20 shadow-xs">
              <Lock className="w-7 h-7 stroke-[2]" />
            </div>

            <div className="space-y-1.5 max-w-xs mx-auto">
              <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                {language === "id" ? "Sesi Penyesuaian Stok Terkunci" : "Stock Adjustment Session Locked"}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                {language === "id"
                  ? "Penyesuaian stok memuat dampak inventori & keuangan. Diperlukan izin aktif dari Owner atau Manager (Berlaku 24 Jam)."
                  : "Stock adjustment impacts financial inventory. Requires active permission from Owner or Manager (Valid for 24 Hours)."}
              </p>
            </div>

            {isManagerOrOwner ? (
              <button
                type="button"
                onClick={() => {
                  session.activateSession(24);
                  toast.success(
                    language === "id"
                      ? "Sesi Adjustment 24 Jam berhasil diaktifkan!"
                      : "24-Hour Adjustment Session activated!"
                  );
                }}
                className="w-full py-3 px-4 bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold text-xs rounded-2xl shadow-md hover:bg-black dark:hover:bg-slate-100 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Unlock className="w-4 h-4 stroke-[2]" />
                <span>
                  {language === "id" ? "Buka Sesi Adjustment (24 Jam)" : "Unlock Adjustment Session (24h)"}
                </span>
              </button>
            ) : (
              <div className="p-3 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-dark-border text-xs font-normal text-slate-600 dark:text-slate-400">
                {language === "id"
                  ? "Minta Owner atau Manager untuk mengaktifkan Sesi Adjustment 24 Jam."
                  : "Ask an Owner or Manager to activate the 24h Adjustment Session."}
              </div>
            )}
          </div>
        ) : (
          /* ── ACTIVE SESSION FORM ── */
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {/* Active Session Info Bar */}
            <div className="flex items-center justify-between p-2.5 px-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>{language === "id" ? "Sesi Adjustment Aktif (24h)" : "24h Session Active"}</span>
              </div>
              <span className="font-mono font-semibold">{session.formattedTimeLeft}</span>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-medium rounded-2xl border border-red-500/20 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 stroke-[2]" />
                <span>{error}</span>
              </div>
            )}

            {/* Input Mode Selector Tabs (Clean Neutral Styling, Medium Weight) */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-[#25252A] rounded-2xl text-xs font-medium border border-slate-200/60 dark:border-[#303036]">
              <button
                type="button"
                onClick={() => setAdjustType("direct")}
                className={`py-2 rounded-xl transition-all cursor-pointer text-center ${
                  adjustType === "direct"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs font-semibold"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
                }`}
              >
                {language === "id" ? "Input Stok Baru" : "Set New Stock"}
              </button>
              <button
                type="button"
                onClick={() => setAdjustType("relative")}
                className={`py-2 rounded-xl transition-all cursor-pointer text-center ${
                  adjustType === "relative"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs font-semibold"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
                }`}
              >
                {language === "id" ? "Selisih (+/-)" : "Delta (+/-)"}
              </button>
            </div>

            {/* Input Fields */}
            {adjustType === "direct" ? (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {language === "id" ? "Jumlah Stok Baru (Hasil Fisik)" : "New Actual Stock Quantity"}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    value={targetStockInput}
                    onChange={(e) => setTargetStockInput(e.target.value)}
                    placeholder="0"
                    className="w-full pl-4 pr-16 py-2.5 rounded-2xl border border-slate-200/90 dark:border-[#38383C] bg-white dark:bg-[#222226] text-slate-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/15 dark:focus:ring-white/20 transition-all shadow-xs"
                    required
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 uppercase">
                    {product.unit_type}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {language === "id" ? "Jumlah Selisih (+ Tambah, - Kurang)" : "Delta Difference (+ Add, - Reduce)"}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    value={deltaInput}
                    onChange={(e) => setDeltaInput(e.target.value)}
                    placeholder="Contoh: -3 atau 5"
                    className="w-full pl-4 pr-16 py-2.5 rounded-2xl border border-slate-200/90 dark:border-[#38383C] bg-white dark:bg-[#222226] text-slate-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/15 dark:focus:ring-white/20 transition-all shadow-xs"
                    required
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 uppercase">
                    {product.unit_type}
                  </span>
                </div>
              </div>
            )}

            {/* Live Calculation Preview Box (Clean Palette & Regular/Medium Weights) */}
            <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-[#25252A] border border-slate-200/80 dark:border-[#333338] space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-medium">
                <span>{language === "id" ? "Stok Sebelum Adjustment:" : "Stock Before:"}</span>
                <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{currentStock} {product.unit_type.toUpperCase()}</span>
              </div>
              <div className="flex items-center justify-between font-medium">
                <span className="text-slate-500 dark:text-slate-400">{language === "id" ? "Perubahan Selisih:" : "Discrepancy:"}</span>
                <span
                  className={`font-mono font-semibold flex items-center gap-1 ${
                    discrepancy < 0
                      ? "text-red-600 dark:text-red-400"
                      : discrepancy > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-slate-400"
                  }`}
                >
                  {discrepancy < 0 && <TrendingDown className="w-3.5 h-3.5 stroke-[2]" />}
                  {discrepancy > 0 && <TrendingUp className="w-3.5 h-3.5 stroke-[2]" />}
                  <span>
                    {discrepancy >= 0 ? "+" : ""}
                    {discrepancy} {product.unit_type.toUpperCase()}
                  </span>
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200/70 dark:border-[#38383E] flex items-center justify-between font-semibold text-slate-900 dark:text-white text-sm">
                <span>{language === "id" ? "Hasil Stok Akhir:" : "Final Stock Result:"}</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">
                  {newStock} {product.unit_type.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Reason Selection Dropdown (Line Icons Only, Clean Text, Shadcn UI Select) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {language === "id" ? "Alasan Penyesuaian (Wajib Audit Log)" : "Adjustment Reason (Required)"}
              </label>
              <Select value={reasonCategory} onValueChange={(val) => val && setReasonCategory(val)}>
                <SelectTrigger className="w-full h-11 rounded-2xl border-slate-200/90 dark:border-[#38383C] bg-white dark:bg-[#222226] text-xs font-medium text-slate-900 dark:text-white shadow-xs">
                  <SelectValue placeholder="Pilih Alasan..." />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-[#202024] border-slate-200 dark:border-[#38383C] text-xs font-medium rounded-2xl shadow-xl">
                  <SelectItem value="Barang Rusak / Cacat">Barang Rusak / Cacat</SelectItem>
                  <SelectItem value="Barang Kadaluarsa (Expired)">Barang Kadaluarsa (Expired)</SelectItem>
                  <SelectItem value="Barang Hilang / Selisih Fisik">Barang Hilang / Selisih Fisik</SelectItem>
                  <SelectItem value="Bonus / Retur Supplier">Bonus / Retur Supplier</SelectItem>
                  <SelectItem value="Koreksi Input System">Koreksi Input System</SelectItem>
                  <SelectItem value="Lainnya">Lainnya (Catat Alasan Khusus)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notes Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {language === "id" ? "Catatan Tambahan (Opsional)" : "Additional Notes"}
              </label>
              <input
                type="text"
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder={language === "id" ? "Detail penyebab selisih..." : "Details on discrepancy..."}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200/90 dark:border-[#38383C] bg-white dark:bg-[#222226] text-xs font-normal text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/15 dark:focus:ring-white/20 transition-all shadow-xs"
              />
            </div>

            {/* Footer Action Buttons (Clean Medium Weight Buttons) */}
            <DialogFooter className="gap-2 pt-3 sm:gap-2">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-5 rounded-2xl border border-slate-200 dark:border-[#38383C] text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
              >
                {language === "id" ? "Batal" : "Cancel"}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="py-2.5 px-6 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold text-xs shadow-md hover:bg-black dark:hover:bg-slate-100 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
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
