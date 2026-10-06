import React from "react";
import { Trash2, Package } from "lucide-react";
import { CurrencyInput } from "../../../components/CurrencyInput";
import { calculateLineSubtotal, calculateLinePhysicalCount } from "../utils/calculations";
import type { LineItemInput } from "../types";

interface PurchaseOrderItemsTableProps {
  lineItems: LineItemInput[];
  onUpdateLineItem: (index: number, field: keyof LineItemInput, value: any) => void;
  onRemoveLineItem: (index: number) => void;
  onOpenItemPicker: () => void;
}

export function PurchaseOrderItemsTable({
  lineItems,
  onUpdateLineItem,
  onRemoveLineItem,
  onOpenItemPicker,
}: PurchaseOrderItemsTableProps) {
  if (lineItems.length === 0) {
    return (
      <div
        onClick={onOpenItemPicker}
        className="p-10 text-center rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 bg-slate-50/50 dark:bg-slate-800/30 cursor-pointer transition space-y-3 flex flex-col items-center justify-center select-none"
      >
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
          <Package className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200 block">
            Belum ada barang yang dipilih
          </span>
          <span className="text-xs text-slate-500">
            Klik di sini untuk membuka katalog barang atau buat barang baru secara kilat.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto scrollbar-thin">
      {/* 🚀 RULE 4: FLOATING CAPSULE HEADER & BORDER-SEPARATE MASTER TABLE */}
      <table className="w-full text-left border-separate" style={{ borderSpacing: "0 6px" }}>
        <thead>
          <tr className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            <th className="bg-[#E7E9ED] dark:bg-[#2E2E34] px-4 py-3 rounded-l-full min-w-[240px]">
              Barang / Produk
            </th>
            <th className="bg-[#E7E9ED] dark:bg-[#2E2E34] px-4 py-3 min-w-[160px]">
              Qty Belanja
            </th>
            <th className="bg-[#E7E9ED] dark:bg-[#2E2E34] px-4 py-3 min-w-[180px]">
              Harga Beli Satuan
            </th>
            <th className="bg-[#E7E9ED] dark:bg-[#2E2E34] px-4 py-3 min-w-[130px]">
              Total Fisik
            </th>
            <th className="bg-[#E7E9ED] dark:bg-[#2E2E34] px-4 py-3 text-right min-w-[140px]">
              Subtotal (Rp)
            </th>
            <th className="bg-[#E7E9ED] dark:bg-[#2E2E34] px-3 py-3 text-center w-12 rounded-r-full">
              Aksi
            </th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((line, idx) => {
            const physicalCount = calculateLinePhysicalCount(line);
            const lineSubtotal = calculateLineSubtotal(line);

            return (
              <tr
                key={line.item_id}
                className="bg-white dark:bg-[#1E1E22] transition-colors hover:bg-slate-50/80 dark:hover:bg-[#25252A]"
              >
                {/* 1. Nama & Info Produk */}
                <td className="px-4 py-3.5 border-b border-slate-200/80 dark:border-[#38383C] align-top">
                  <div className="space-y-1">
                    <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white block leading-tight">
                      {line.item_name}
                    </span>
                    {line.sku && (
                      <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 block">
                        SKU: {line.sku}
                      </span>
                    )}
                    <div>
                      {line.has_dual_uom ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] border border-indigo-200/60 dark:border-indigo-800/60">
                          Dual-UOM (1 {line.box_unit || "Dus"} = {line.conversion_rate} {line.base_unit})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-[10px]">
                          Satuan: {line.base_unit}
                        </span>
                      )}
                    </div>
                  </div>
                </td>

                {/* 2. Qty Belanja */}
                <td className="px-4 py-3.5 border-b border-slate-200/80 dark:border-[#38383C] align-top">
                  {line.has_dual_uom ? (
                    <div className="space-y-2">
                      {/* Qty Kemasan Besar */}
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block">
                          Kemasan {line.box_unit || "Dus"}
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={line.qty_box}
                          onChange={(e) =>
                            onUpdateLineItem(idx, "qty_box", parseFloat(e.target.value) || 0)
                          }
                          className="h-9 w-full px-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          placeholder="0"
                        />
                      </div>
                      {/* Qty Eceran */}
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                          + Eceran {line.base_unit || "Pcs"}
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={line.qty_pcs}
                          onChange={(e) =>
                            onUpdateLineItem(idx, "qty_pcs", parseFloat(e.target.value) || 0)
                          }
                          className="h-9 w-full px-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                        Satuan {line.base_unit}
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        value={line.qty_pcs > 0 ? line.qty_pcs : line.qty_ordered}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          onUpdateLineItem(idx, "qty_pcs", val);
                          onUpdateLineItem(idx, "qty_ordered", val);
                        }}
                        className="h-9 w-full px-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        placeholder="1"
                      />
                    </div>
                  )}
                </td>

                {/* 3. Harga Beli Satuan */}
                <td className="px-4 py-3.5 border-b border-slate-200/80 dark:border-[#38383C] align-top">
                  {line.has_dual_uom ? (
                    <div className="space-y-2">
                      {/* Harga Kemasan Besar */}
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block">
                          Harga / {line.box_unit || "Dus"}
                        </label>
                        <CurrencyInput
                          value={line.box_cost}
                          onChange={(val) => onUpdateLineItem(idx, "box_cost", val)}
                          className="h-9 w-full text-xs font-bold"
                        />
                      </div>
                      {/* Harga Eceran */}
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                          Harga / {line.base_unit || "Pcs"}
                        </label>
                        <CurrencyInput
                          value={line.pcs_cost}
                          onChange={(val) => onUpdateLineItem(idx, "pcs_cost", val)}
                          className="h-9 w-full text-xs font-bold"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                        Harga Satuan (Rp)
                      </label>
                      <CurrencyInput
                        value={line.pcs_cost > 0 ? line.pcs_cost : line.unit_cost}
                        onChange={(val) => {
                          onUpdateLineItem(idx, "pcs_cost", val);
                          onUpdateLineItem(idx, "unit_cost", val);
                        }}
                        className="h-9 w-full text-xs font-bold"
                      />
                    </div>
                  )}
                </td>

                {/* 4. Total Fisik */}
                <td className="px-4 py-3.5 border-b border-slate-200/80 dark:border-[#38383C] align-top">
                  <div className="space-y-0.5 pt-1">
                    <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 block">
                      {physicalCount} {line.base_unit}
                    </span>
                    {line.has_dual_uom && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                        ({line.qty_box} {line.box_unit || "Dus"} + {line.qty_pcs} {line.base_unit})
                      </span>
                    )}
                  </div>
                </td>

                {/* 5. Subtotal */}
                <td className="px-4 py-3.5 border-b border-slate-200/80 dark:border-[#38383C] text-right align-top">
                  <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white block pt-1">
                    Rp {lineSubtotal.toLocaleString("id-ID")}
                  </span>
                </td>

                {/* 6. Aksi Hapus */}
                <td className="px-3 py-3.5 border-b border-slate-200/80 dark:border-[#38383C] text-center align-top">
                  <button
                    type="button"
                    onClick={() => onRemoveLineItem(idx)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer mt-0.5"
                    title="Hapus barang"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
