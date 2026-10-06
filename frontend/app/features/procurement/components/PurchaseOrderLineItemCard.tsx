import React from "react";
import { Trash2 } from "lucide-react";
import { CurrencyInput } from "../../../components/CurrencyInput";
import { calculateLineSubtotal, calculateLinePhysicalCount } from "../utils/calculations";
import type { LineItemInput } from "../types";

interface PurchaseOrderLineItemCardProps {
  line: LineItemInput;
  index: number;
  onUpdate: (index: number, field: keyof LineItemInput, value: any) => void;
  onRemove: (index: number) => void;
}

export function PurchaseOrderLineItemCard({
  line,
  index,
  onUpdate,
  onRemove,
}: PurchaseOrderLineItemCardProps) {
  return (
    <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-50/90 dark:bg-[#202024] border border-slate-200/90 dark:border-[#2E2E34] transition-all hover:border-slate-300 dark:hover:border-slate-600 shadow-2xs">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
        {/* ─── BAGIAN 1: INFO ITEM (Col 1-4) ─── */}
        <div className="lg:col-span-4 flex flex-col justify-between h-full space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5">
                <h4 className="font-black text-sm sm:text-base text-slate-900 dark:text-white leading-tight">
                  {line.item_name}
                </h4>
                {line.sku && (
                  <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 block">
                    SKU: {line.sku}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer shrink-0"
                title="Hapus barang dari daftar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Badges UOM */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {line.has_dual_uom ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] border border-indigo-200/60 dark:border-indigo-800/60">
                  Dual-UOM (1 {line.box_unit || "Dus"} = {line.conversion_rate} {line.base_unit})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[10px]">
                  Satuan: {line.base_unit}
                </span>
              )}
            </div>
          </div>

          {/* Subtotal & Physical Count */}
          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">
              Total Fisik:{" "}
              <strong className="text-slate-800 dark:text-slate-200">
                {calculateLinePhysicalCount(line)} {line.base_unit}
              </strong>
            </span>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                Subtotal
              </span>
              <span className="text-sm font-black text-slate-900 dark:text-white">
                Rp {calculateLineSubtotal(line).toLocaleString("id-ID")}
              </span>
            </div>
          </div>
        </div>

        {/* ─── BAGIAN 2 & 3: PRESPEKTIF TABEL (QTY & HARGA) (Col 5-12) ─── */}
        <div className="lg:col-span-8 p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#18181B] border border-slate-200/80 dark:border-[#2E2E34] space-y-3">
          {/* Table-perspective Header */}
          <div className="grid grid-cols-2 gap-3 pb-2 border-b border-slate-100 dark:border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <span>QTY BELANJA</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>HARGA BELI SATUAN</span>
            </div>
          </div>

          {/* Rows per Unit */}
          {line.has_dual_uom ? (
            <div className="space-y-3">
              {/* Baris 1: Kemasan Besar (Dus/Bal) */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block truncate">
                    Kemasan {line.box_unit || "Dus"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={line.qty_box}
                    onChange={(e) =>
                      onUpdate(index, "qty_box", parseFloat(e.target.value) || 0)
                    }
                    className="h-10 w-full px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block truncate">
                    Harga / {line.box_unit || "Dus"}
                  </label>
                  <CurrencyInput
                    value={line.box_cost}
                    onChange={(val) => onUpdate(index, "box_cost", val)}
                    className="h-10 w-full text-xs font-bold"
                  />
                </div>
              </div>

              {/* Baris 2: Eceran (Pcs/Base) */}
              <div className="grid grid-cols-2 gap-3 items-center pt-2 border-t border-dashed border-slate-100 dark:border-slate-800/80">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block truncate">
                    + Eceran {line.base_unit || "Pcs"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={line.qty_pcs}
                    onChange={(e) =>
                      onUpdate(index, "qty_pcs", parseFloat(e.target.value) || 0)
                    }
                    className="h-10 w-full px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block truncate">
                    Harga / {line.base_unit || "Pcs"}
                  </label>
                  <CurrencyInput
                    value={line.pcs_cost}
                    onChange={(val) => onUpdate(index, "pcs_cost", val)}
                    className="h-10 w-full text-xs font-bold"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Baris Single UOM */
            <div className="grid grid-cols-2 gap-3 items-center">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block truncate">
                  Satuan {line.base_unit}
                </label>
                <input
                  type="number"
                  min="0.01"
                  value={line.qty_pcs > 0 ? line.qty_pcs : line.qty_ordered}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    onUpdate(index, "qty_pcs", val);
                    onUpdate(index, "qty_ordered", val);
                  }}
                  className="h-10 w-full px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="1"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block truncate">
                  Harga / {line.base_unit}
                </label>
                <CurrencyInput
                  value={line.pcs_cost > 0 ? line.pcs_cost : line.unit_cost}
                  onChange={(val) => {
                    onUpdate(index, "pcs_cost", val);
                    onUpdate(index, "unit_cost", val);
                  }}
                  className="h-10 w-full text-xs font-bold"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
