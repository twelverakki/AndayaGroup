import React, { useState } from "react";
import { Trash2, SlidersHorizontal } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { ButtonGroup } from "../../../components/ui/button-group";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupText,
} from "../../../components/ui/input-group";
import {
  calculateLineSubtotal,
  calculateLinePhysicalCount,
  calculateLineGross,
  calculateLineDiscountAmount,
} from "../utils/calculations";
import { cn } from "../../../lib/utils";
import { DiscountSliderDialog } from "./DiscountSliderDialog";
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
  const [sliderDialogUnit, setSliderDialogUnit] = useState<"box" | "pcs" | null>(null);

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
            <div className="space-y-2">
              {/* Baris 1: Kemasan Besar (Dus/Bal) */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <InputGroup>
                  <InputGroupInput
                    type="number"
                    min="0"
                    value={line.qty_box}
                    onChange={(e) =>
                      onUpdate(index, "qty_box", parseFloat(e.target.value) || 0)
                    }
                    placeholder="0"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>{line.box_unit || "Dus"}</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
                <InputGroup>
                  <InputGroupAddon align="inline-start">
                    <InputGroupText>Rp</InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput
                    currency
                    value={line.box_cost}
                    onValueChange={(val) => onUpdate(index, "box_cost", val)}
                  />
                </InputGroup>
              </div>

              {/* Baris 2: Eceran (Pcs/Base) */}
              <div className="grid grid-cols-2 gap-3 items-center pt-2 border-t border-dashed border-slate-100 dark:border-slate-800/80">
                <InputGroup>
                  <InputGroupInput
                    type="number"
                    min="0"
                    value={line.qty_pcs}
                    onChange={(e) =>
                      onUpdate(index, "qty_pcs", parseFloat(e.target.value) || 0)
                    }
                    placeholder="0"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>{line.base_unit || "Pcs"}</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
                <InputGroup>
                  <InputGroupAddon align="inline-start">
                    <InputGroupText>Rp</InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput
                    currency
                    value={line.pcs_cost}
                    onValueChange={(val) => onUpdate(index, "pcs_cost", val)}
                  />
                </InputGroup>
              </div>
            </div>
          ) : (
            /* Baris Single UOM */
            <div className="grid grid-cols-2 gap-3 items-center">
              <InputGroup>
                <InputGroupInput
                  type="number"
                  min="0.01"
                  value={line.qty_pcs > 0 ? line.qty_pcs : line.qty_ordered}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    onUpdate(index, "qty_pcs", val);
                    onUpdate(index, "qty_ordered", val);
                  }}
                  placeholder="1"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>{line.base_unit}</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <InputGroupText>Rp</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  currency
                  value={line.pcs_cost > 0 ? line.pcs_cost : line.unit_cost}
                  onValueChange={(val) => {
                    onUpdate(index, "pcs_cost", val);
                    onUpdate(index, "unit_cost", val);
                  }}
                />
              </InputGroup>
            </div>
          )}

          {/* Row Diskon per Item (Rp & %) - Mendukung Dual UOM (Per Dus & Per Pcs) */}
          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-2">
            {line.has_dual_uom ? (
              <div className="space-y-2">
                {/* Baris 1: Diskon Dus */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Diskon per {line.box_unit || "Dus"}
                  </span>
                  <ButtonGroup className="w-full">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-lg"
                      onClick={() => setSliderDialogUnit("box")}
                      className={cn(
                        "shrink-0 h-9 w-8 cursor-pointer transition shadow-xs",
                        (line.box_discount_percent || 0) > 0 || (line.box_discount_amount || 0) > 0
                          ? "bg-slate-900 text-white dark:bg-[#E2FF66] dark:text-slate-900 border-slate-900 dark:border-[#E2FF66]"
                          : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                      )}
                      title={`Buka slider diskon per ${line.box_unit || "Dus"}`}
                    >
                      <SlidersHorizontal className="size-3.5" />
                    </Button>
                    <InputGroup className="flex-1 h-9 min-w-[110px]">
                      <InputGroupAddon align="inline-start" className="pl-2 pr-1">
                        <InputGroupText className="text-[10px] font-bold">Rp</InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput
                        currency
                        value={typeof line.box_discount_amount === "number" && !isNaN(line.box_discount_amount) ? line.box_discount_amount : 0}
                        onValueChange={(val) => {
                          const safeVal = typeof val === "number" && !isNaN(val) ? Math.max(0, val) : 0;
                          const cost = line.box_cost || 0;
                          const rawPct = cost > 0 ? (safeVal / cost) * 100 : 0;
                          const pct = !isNaN(rawPct) && isFinite(rawPct) ? Number(rawPct.toFixed(1)) : 0;
                          onUpdate(index, "box_discount_amount", safeVal);
                          onUpdate(index, "box_discount_percent", Math.min(100, Math.max(0, pct)));
                        }}
                        placeholder="0"
                        className="font-bold text-xs"
                      />
                    </InputGroup>
                    <InputGroup className="w-16 shrink-0 h-9">
                      <InputGroupInput
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={
                          typeof line.box_discount_percent === "number" && !isNaN(line.box_discount_percent)
                            ? line.box_discount_percent
                            : typeof line.box_discount_amount === "number" && !isNaN(line.box_discount_amount) && (line.box_cost || 0) > 0
                            ? Number(((line.box_discount_amount / line.box_cost) * 100).toFixed(1)) || 0
                            : 0
                        }
                        onChange={(e) => {
                          const raw = parseFloat(e.target.value);
                          const safePct = !isNaN(raw) && isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0;
                          const cost = line.box_cost || 0;
                          const amt = cost > 0 ? Math.round((cost * safePct) / 100) : 0;
                          onUpdate(index, "box_discount_percent", safePct);
                          onUpdate(index, "box_discount_amount", amt);
                        }}
                        placeholder="0"
                        className="font-bold text-xs text-center px-1"
                      />
                      <InputGroupAddon align="inline-end" className="pr-1.5 pl-0">
                        <InputGroupText className="text-[10px] font-bold">%</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                  </ButtonGroup>
                </div>

                {/* Baris 2: Diskon Pcs */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Diskon per {line.base_unit || "Pcs"}
                  </span>
                  <ButtonGroup className="w-full">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-lg"
                      onClick={() => setSliderDialogUnit("pcs")}
                      className={cn(
                        "shrink-0 h-9 w-8 cursor-pointer transition shadow-xs",
                        (line.pcs_discount_percent || 0) > 0 || (line.pcs_discount_amount || 0) > 0
                          ? "bg-slate-900 text-white dark:bg-[#E2FF66] dark:text-slate-900 border-slate-900 dark:border-[#E2FF66]"
                          : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                      )}
                      title={`Buka slider diskon per ${line.base_unit || "Pcs"}`}
                    >
                      <SlidersHorizontal className="size-3.5" />
                    </Button>
                    <InputGroup className="flex-1 h-9 min-w-[110px]">
                      <InputGroupAddon align="inline-start" className="pl-2 pr-1">
                        <InputGroupText className="text-[10px] font-bold">Rp</InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput
                        currency
                        value={typeof line.pcs_discount_amount === "number" && !isNaN(line.pcs_discount_amount) ? line.pcs_discount_amount : 0}
                        onValueChange={(val) => {
                          const safeVal = typeof val === "number" && !isNaN(val) ? Math.max(0, val) : 0;
                          const cost = line.pcs_cost || 0;
                          const rawPct = cost > 0 ? (safeVal / cost) * 100 : 0;
                          const pct = !isNaN(rawPct) && isFinite(rawPct) ? Number(rawPct.toFixed(1)) : 0;
                          onUpdate(index, "pcs_discount_amount", safeVal);
                          onUpdate(index, "pcs_discount_percent", Math.min(100, Math.max(0, pct)));
                        }}
                        placeholder="0"
                        className="font-bold text-xs"
                      />
                    </InputGroup>
                    <InputGroup className="w-16 shrink-0 h-9">
                      <InputGroupInput
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={
                          typeof line.pcs_discount_percent === "number" && !isNaN(line.pcs_discount_percent)
                            ? line.pcs_discount_percent
                            : typeof line.pcs_discount_amount === "number" && !isNaN(line.pcs_discount_amount) && (line.pcs_cost || 0) > 0
                            ? Number(((line.pcs_discount_amount / line.pcs_cost) * 100).toFixed(1)) || 0
                            : 0
                        }
                        onChange={(e) => {
                          const raw = parseFloat(e.target.value);
                          const safePct = !isNaN(raw) && isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0;
                          const cost = line.pcs_cost || 0;
                          const amt = cost > 0 ? Math.round((cost * safePct) / 100) : 0;
                          onUpdate(index, "pcs_discount_percent", safePct);
                          onUpdate(index, "pcs_discount_amount", amt);
                        }}
                        placeholder="0"
                        className="font-bold text-xs text-center px-1"
                      />
                      <InputGroupAddon align="inline-end" className="pr-1.5 pl-0">
                        <InputGroupText className="text-[10px] font-bold">%</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                  </ButtonGroup>
                </div>
              </div>
            ) : (
              /* Single UOM Discount */
              <ButtonGroup className="w-full">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  onClick={() => setSliderDialogUnit("pcs")}
                  className={cn(
                    "shrink-0 h-9 w-8 cursor-pointer transition shadow-xs",
                    (line.pcs_discount_percent || line.discount_percent || 0) > 0 || (line.pcs_discount_amount || line.discount_amount || 0) > 0
                      ? "bg-slate-900 text-white dark:bg-[#E2FF66] dark:text-slate-900 border-slate-900 dark:border-[#E2FF66]"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  )}
                  title="Buka slider penyetelan diskon satuan"
                >
                  <SlidersHorizontal className="size-3.5" />
                </Button>
                <InputGroup className="flex-1 h-9 min-w-[110px]">
                  <InputGroupAddon align="inline-start" className="pl-2 pr-1">
                    <InputGroupText className="text-[10px] font-bold">Rp</InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput
                    currency
                    value={
                      typeof line.pcs_discount_amount === "number" && !isNaN(line.pcs_discount_amount)
                        ? line.pcs_discount_amount
                        : typeof line.discount_amount === "number" && !isNaN(line.discount_amount)
                        ? line.discount_amount
                        : 0
                    }
                    onValueChange={(val) => {
                      const safeVal = typeof val === "number" && !isNaN(val) ? Math.max(0, val) : 0;
                      const cost = line.pcs_cost > 0 ? line.pcs_cost : line.unit_cost || 0;
                      const rawPct = cost > 0 ? (safeVal / cost) * 100 : 0;
                      const pct = !isNaN(rawPct) && isFinite(rawPct) ? Number(rawPct.toFixed(1)) : 0;
                      onUpdate(index, "pcs_discount_amount", safeVal);
                      onUpdate(index, "pcs_discount_percent", Math.min(100, Math.max(0, pct)));
                      onUpdate(index, "discount_amount", safeVal);
                      onUpdate(index, "discount_percent", Math.min(100, Math.max(0, pct)));
                    }}
                    placeholder="0"
                    className="font-bold text-xs"
                  />
                </InputGroup>
                <InputGroup className="w-16 shrink-0 h-9">
                  <InputGroupInput
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={
                      typeof line.pcs_discount_percent === "number" && !isNaN(line.pcs_discount_percent)
                        ? line.pcs_discount_percent
                        : typeof line.discount_percent === "number" && !isNaN(line.discount_percent)
                        ? line.discount_percent
                        : 0
                    }
                    onChange={(e) => {
                      const raw = parseFloat(e.target.value);
                      const safePct = !isNaN(raw) && isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0;
                      const cost = line.pcs_cost > 0 ? line.pcs_cost : line.unit_cost || 0;
                      const amt = cost > 0 ? Math.round((cost * safePct) / 100) : 0;
                      onUpdate(index, "pcs_discount_percent", safePct);
                      onUpdate(index, "pcs_discount_amount", amt);
                      onUpdate(index, "discount_percent", safePct);
                      onUpdate(index, "discount_amount", amt);
                    }}
                    placeholder="0"
                    className="font-bold text-xs text-center px-1"
                  />
                  <InputGroupAddon align="inline-end" className="pr-1.5 pl-0">
                    <InputGroupText className="text-[10px] font-bold">%</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              </ButtonGroup>
            )}
          </div>
        </div>
      </div>

      {sliderDialogUnit !== null && (() => {
        const isBox = sliderDialogUnit === "box";
        const unitName = isBox ? line.box_unit || "Dus" : line.base_unit || "Pcs";
        const unitCost = isBox
          ? line.box_cost || 0
          : line.pcs_cost > 0
          ? line.pcs_cost
          : line.unit_cost || 0;
        const initPct = isBox
          ? line.box_discount_percent || 0
          : line.pcs_discount_percent ?? line.discount_percent ?? 0;
        const initAmt = isBox
          ? line.box_discount_amount || 0
          : line.pcs_discount_amount ?? line.discount_amount ?? 0;

        return (
          <DiscountSliderDialog
            open={true}
            onOpenChange={(open) => !open && setSliderDialogUnit(null)}
            itemName={`${line.item_name} (per ${unitName})`}
            grossAmount={unitCost}
            initialPercent={initPct}
            initialAmount={initAmt}
            onApply={(pct, amt) => {
              if (isBox) {
                onUpdate(index, "box_discount_percent", pct);
                onUpdate(index, "box_discount_amount", amt);
              } else {
                onUpdate(index, "pcs_discount_percent", pct);
                onUpdate(index, "pcs_discount_amount", amt);
                onUpdate(index, "discount_percent", pct);
                onUpdate(index, "discount_amount", amt);
              }
            }}
          />
        );
      })()}
    </div>
  );
}
