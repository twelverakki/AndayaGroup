import React, { useState } from "react";
import { Trash2, Package, SlidersHorizontal, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { ButtonGroup } from "../../../components/ui/button-group";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupText,
} from "../../../components/ui/input-group";
import {
  calculateLinePhysicalCount,
} from "../utils/calculations";
import { cn } from "../../../lib/utils";
import { useLanguageStore, translations } from "../../../lib/i18n";
import { DiscountSliderDialog } from "./DiscountSliderDialog";
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
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;

  const [sliderDialogTarget, setSliderDialogTarget] = useState<{
    index: number;
    unit: "box" | "pcs";
  } | null>(null);

  const renderPriceDiffBadge = (currentPrice: number, originalPrice?: number) => {
    if (originalPrice === undefined || originalPrice <= 0) return null;
    const diff = currentPrice - originalPrice;
    if (diff === 0) return null;

    const isUp = diff > 0;
    const absDiff = Math.abs(diff);

    return (
      <div
        className="absolute bottom-full mb-0 right-1 z-10 flex items-center gap-0.5 p-0 bg-transparent text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400 select-none pointer-events-none"
        title={`${t.poGoodsTableInitialCost} Rp ${originalPrice.toLocaleString("id-ID")} (${t.poGoodsTableDiff} ${isUp ? "+" : "-"}Rp ${absDiff.toLocaleString("id-ID")})`}
      >
        {isUp ? (
          <ArrowUp className="size-2.5 text-slate-600 dark:text-slate-400 stroke-[3]" />
        ) : (
          <ArrowDown className="size-2.5 text-slate-600 dark:text-slate-400 stroke-[3]" />
        )}
        <span>
          {isUp ? "+" : "-"}Rp {absDiff.toLocaleString("id-ID")}
        </span>
      </div>
    );
  };

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
            {t.poGoodsTableEmptyTitle}
          </span>
          <span className="text-xs text-slate-500">
            {t.poGoodsTableEmptyDesc}
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
            <th className="bg-[#E7E9ED] dark:bg-[#2E2E34] px-3 py-3 rounded-l-full text-center w-16">
              {t.poGoodsTableColNo}
            </th>
            <th className="bg-[#E7E9ED] dark:bg-[#2E2E34] px-4 py-3 min-w-[240px]">
              {t.poGoodsTableColItem}
            </th>
            <th className="bg-[#E7E9ED] dark:bg-[#2E2E34] px-4 py-3 min-w-[140px]">
              {t.poGoodsTableColQty}
            </th>
            <th className="bg-[#E7E9ED] dark:bg-[#2E2E34] px-4 py-3 min-w-[170px]">
              {t.poGoodsTableColPrice}
            </th>
            <th className="bg-[#E7E9ED] dark:bg-[#2E2E34] px-4 py-3 min-w-[220px]">
              {t.poGoodsTableColDiscount}
            </th>
            <th className="bg-[#E7E9ED] dark:bg-[#2E2E34] px-4 py-3 text-right min-w-[140px] rounded-r-full">
              {t.poGoodsTableColSubtotal}
            </th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((line, idx) => {
            const physicalCount = calculateLinePhysicalCount(line);

            if (line.has_dual_uom) {
              const boxCost = Math.max(0, line.box_cost || 0);
              const boxDisc = Math.min(boxCost, Math.max(0, line.box_discount_amount || 0));
              const boxQty = Math.max(0, line.qty_box || 0);
              const boxSubtotal = Math.max(0, (boxCost - boxDisc) * boxQty);

              const pcsCost = Math.max(0, line.pcs_cost || 0);
              const pcsDisc = Math.min(pcsCost, Math.max(0, line.pcs_discount_amount || 0));
              const pcsQty = Math.max(0, line.qty_pcs || 0);
              const pcsSubtotal = Math.max(0, (pcsCost - pcsDisc) * pcsQty);

              return (
                <React.Fragment key={line.item_id}>
                  {/* ─── BARIS 1: KEMASAN BESAR (DUS/BAL) ─── */}
                  <tr className="bg-white dark:bg-[#1E1E22] transition-colors hover:bg-slate-50/80 dark:hover:bg-[#25252A]">
                    {/* 1. Kolom No. & Tombol Hapus (Rowspan 2 Baris) */}
                    <td
                      rowSpan={2}
                      className="px-2 py-3.5 border-b border-slate-200/80 dark:border-[#38383C] text-center align-middle bg-white dark:bg-[#1E1E22]"
                    >
                      <div className="flex flex-col items-center justify-center gap-1">
                        <span className="font-mono font-black text-sm text-slate-700 dark:text-slate-300">
                          {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemoveLineItem(idx)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                          title={t.poGoodsTableRemoveItem}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>

                    {/* 2. Nama & Info Produk (Rowspan 2 Baris) */}
                    <td
                      rowSpan={2}
                      className="px-4 py-3.5 border-b border-slate-200/80 dark:border-[#38383C] align-top bg-white dark:bg-[#1E1E22]"
                    >
                      <div className="space-y-1.5 pr-2">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white block leading-tight">
                          {line.item_name}
                        </span>
                        {line.sku && (
                          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 block">
                            SKU: {line.sku}
                          </span>
                        )}
                        <div className="flex flex-col gap-1 pt-0.5">
                          <span className="inline-flex items-center w-fit px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] border border-indigo-200/60 dark:border-indigo-800/60">
                            1 {line.box_unit || "Dus"} = {line.conversion_rate} {line.base_unit}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                            {t.poGoodsTablePhysicalIn} <strong className="text-slate-700 dark:text-slate-200">{physicalCount} {line.base_unit}</strong>
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* 3. Qty Kemasan Besar */}
                    <td className="px-4 py-3 border-b border-slate-100 dark:border-[#2C2C30] align-middle">
                      <InputGroup className="w-28 sm:w-32">
                        <InputGroupInput
                          type="number"
                          min="0"
                          value={line.qty_box}
                          onChange={(e) =>
                            onUpdateLineItem(idx, "qty_box", Math.max(0, parseFloat(e.target.value) || 0))
                          }
                          placeholder="0"
                          className="font-bold text-xs"
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText className="text-xs font-bold text-slate-700 dark:text-slate-200">
                            {line.box_unit || "Dus"}
                          </InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                    </td>

                    {/* 4. Harga Kemasan Besar */}
                    <td className="px-4 py-3 border-b border-slate-100 dark:border-[#2C2C30] align-middle">
                      <div className="relative w-36 sm:w-40">
                        {renderPriceDiffBadge(boxCost, line.original_box_cost)}
                        <InputGroup className="w-full">
                          <InputGroupAddon align="inline-start">
                            <InputGroupText className="text-xs font-bold text-slate-700 dark:text-slate-200">Rp</InputGroupText>
                          </InputGroupAddon>
                          <InputGroupInput
                            currency
                            value={boxCost}
                            onValueChange={(val) => {
                              const safeCost = Math.max(0, val);
                              onUpdateLineItem(idx, "box_cost", safeCost);
                              // Otomatis batasi diskon jika melebihi harga baru
                              if (boxDisc > safeCost) {
                                onUpdateLineItem(idx, "box_discount_amount", safeCost);
                                onUpdateLineItem(idx, "box_discount_percent", 100);
                              }
                            }}
                            className="font-bold text-xs"
                          />
                        </InputGroup>
                      </div>
                    </td>

                    {/* 5. Diskon Kemasan Besar (Ter-clamp ke boxCost) */}
                    <td className="px-4 py-3 border-b border-slate-100 dark:border-[#2C2C30] align-middle">
                      <ButtonGroup className="w-fit inline-flex">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-lg"
                          onClick={() => setSliderDialogTarget({ index: idx, unit: "box" })}
                          className={cn(
                            "shrink-0 h-9 w-8 cursor-pointer transition shadow-xs",
                            boxDisc > 0 || (line.box_discount_percent || 0) > 0
                              ? "bg-slate-900 text-white dark:bg-[#E2FF66] dark:text-slate-900 border-slate-900 dark:border-[#E2FF66]"
                              : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                          )}
                          title={`${t.poGoodsTableOpenSlider} (${line.box_unit || "Dus"})`}
                        >
                          <SlidersHorizontal className="size-3.5" />
                        </Button>
                        <InputGroup className="w-24 sm:w-28 h-9">
                          <InputGroupAddon align="inline-start" className="pl-2 pr-1">
                            <InputGroupText className="text-xs font-bold text-slate-700 dark:text-slate-200">Rp</InputGroupText>
                          </InputGroupAddon>
                          <InputGroupInput
                            currency
                            value={boxDisc}
                            max={boxCost}
                            onValueChange={(val) => {
                              // Validasi min 0 dan max boxCost
                              const clampedVal = Math.min(boxCost, Math.max(0, val));
                              const rawPct = boxCost > 0 ? (clampedVal / boxCost) * 100 : 0;
                              const pct = Math.min(100, Math.max(0, Number(rawPct.toFixed(1))));
                              onUpdateLineItem(idx, "box_discount_amount", clampedVal);
                              onUpdateLineItem(idx, "box_discount_percent", pct);
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
                                : boxDisc > 0 && boxCost > 0
                                ? Number(((boxDisc / boxCost) * 100).toFixed(1)) || 0
                                : 0
                            }
                            onChange={(e) => {
                              const raw = parseFloat(e.target.value);
                              const safePct = !isNaN(raw) && isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0;
                              if (!isNaN(raw) && raw > 100) {
                                e.target.value = "100";
                              }
                              const amt = boxCost > 0 ? Math.min(boxCost, Math.round((boxCost * safePct) / 100)) : 0;
                              onUpdateLineItem(idx, "box_discount_percent", safePct);
                              onUpdateLineItem(idx, "box_discount_amount", amt);
                            }}
                            placeholder="0"
                            className="font-bold text-xs text-center px-1"
                          />
                          <InputGroupAddon align="inline-end" className="pr-1.5 pl-0">
                            <InputGroupText className="text-xs font-bold text-slate-700 dark:text-slate-200">%</InputGroupText>
                          </InputGroupAddon>
                        </InputGroup>
                      </ButtonGroup>
                    </td>

                    {/* 6. Subtotal Kemasan Besar */}
                    <td className="px-4 py-3 border-b border-slate-100 dark:border-[#2C2C30] text-right align-middle">
                      <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white block font-mono">
                        Rp {boxSubtotal.toLocaleString("id-ID")}
                      </span>
                    </td>
                  </tr>

                  {/* ─── BARIS 2: ECERAN (PCS/BASE) ─── */}
                  <tr className="bg-white dark:bg-[#1E1E22] transition-colors hover:bg-slate-50/80 dark:hover:bg-[#25252A]">
                    {/* Qty Eceran */}
                    <td className="px-4 py-3 border-b border-slate-200/80 dark:border-[#38383C] align-middle">
                      <InputGroup className="w-28 sm:w-32">
                        <InputGroupInput
                          type="number"
                          min="0"
                          value={line.qty_pcs}
                          onChange={(e) =>
                            onUpdateLineItem(idx, "qty_pcs", Math.max(0, parseFloat(e.target.value) || 0))
                          }
                          placeholder="0"
                          className="font-bold text-xs"
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText className="text-xs font-bold text-slate-700 dark:text-slate-200">
                            {line.base_unit || "Pcs"}
                          </InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                    </td>

                    {/* Harga Eceran */}
                    <td className="px-4 py-3 border-b border-slate-200/80 dark:border-[#38383C] align-middle">
                      <div className="relative w-36 sm:w-40">
                        {renderPriceDiffBadge(pcsCost, line.original_pcs_cost)}
                        <InputGroup className="w-full">
                          <InputGroupAddon align="inline-start">
                            <InputGroupText className="text-xs font-bold text-slate-700 dark:text-slate-200">Rp</InputGroupText>
                          </InputGroupAddon>
                          <InputGroupInput
                            currency
                            value={pcsCost}
                            onValueChange={(val) => {
                              const safeCost = Math.max(0, val);
                              onUpdateLineItem(idx, "pcs_cost", safeCost);
                              // Otomatis batasi diskon jika melebihi harga baru
                              if (pcsDisc > safeCost) {
                                onUpdateLineItem(idx, "pcs_discount_amount", safeCost);
                                onUpdateLineItem(idx, "pcs_discount_percent", 100);
                              }
                            }}
                            className="font-bold text-xs"
                          />
                        </InputGroup>
                      </div>
                    </td>

                    {/* Diskon Eceran (Ter-clamp ke pcsCost) */}
                    <td className="px-4 py-3 border-b border-slate-200/80 dark:border-[#38383C] align-middle">
                      <ButtonGroup className="w-fit inline-flex">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-lg"
                          onClick={() => setSliderDialogTarget({ index: idx, unit: "pcs" })}
                          className={cn(
                            "shrink-0 h-9 w-8 cursor-pointer transition shadow-xs",
                            pcsDisc > 0 || (line.pcs_discount_percent || 0) > 0
                              ? "bg-slate-900 text-white dark:bg-[#E2FF66] dark:text-slate-900 border-slate-900 dark:border-[#E2FF66]"
                              : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                          )}
                          title={`${t.poGoodsTableOpenSlider} (${line.base_unit || "Pcs"})`}
                        >
                          <SlidersHorizontal className="size-3.5" />
                        </Button>
                        <InputGroup className="w-24 sm:w-28 h-9">
                          <InputGroupAddon align="inline-start" className="pl-2 pr-1">
                            <InputGroupText className="text-xs font-bold text-slate-700 dark:text-slate-200">Rp</InputGroupText>
                          </InputGroupAddon>
                          <InputGroupInput
                            currency
                            value={pcsDisc}
                            max={pcsCost}
                            onValueChange={(val) => {
                              // Validasi min 0 dan max pcsCost
                              const clampedVal = Math.min(pcsCost, Math.max(0, val));
                              const rawPct = pcsCost > 0 ? (clampedVal / pcsCost) * 100 : 0;
                              const pct = Math.min(100, Math.max(0, Number(rawPct.toFixed(1))));
                              onUpdateLineItem(idx, "pcs_discount_amount", clampedVal);
                              onUpdateLineItem(idx, "pcs_discount_percent", pct);
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
                                : pcsDisc > 0 && pcsCost > 0
                                ? Number(((pcsDisc / pcsCost) * 100).toFixed(1)) || 0
                                : 0
                            }
                            onChange={(e) => {
                              const raw = parseFloat(e.target.value);
                              const safePct = !isNaN(raw) && isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0;
                              if (!isNaN(raw) && raw > 100) {
                                e.target.value = "100";
                              }
                              const amt = pcsCost > 0 ? Math.min(pcsCost, Math.round((pcsCost * safePct) / 100)) : 0;
                              onUpdateLineItem(idx, "pcs_discount_percent", safePct);
                              onUpdateLineItem(idx, "pcs_discount_amount", amt);
                            }}
                            placeholder="0"
                            className="font-bold text-xs text-center px-1"
                          />
                          <InputGroupAddon align="inline-end" className="pr-1.5 pl-0">
                            <InputGroupText className="text-xs font-bold text-slate-700 dark:text-slate-200">%</InputGroupText>
                          </InputGroupAddon>
                        </InputGroup>
                      </ButtonGroup>
                    </td>

                    {/* Subtotal Eceran */}
                    <td className="px-4 py-3 border-b border-slate-200/80 dark:border-[#38383C] text-right align-middle">
                      <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white block font-mono">
                        Rp {pcsSubtotal.toLocaleString("id-ID")}
                      </span>
                    </td>
                  </tr>
                </React.Fragment>
              );
            }

            // ─── BARIS ITEM SINGLE UOM (BIASA) ───
            const cost = Math.max(0, line.pcs_cost > 0 ? line.pcs_cost : line.unit_cost || 0);
            const disc = Math.min(
              cost,
              Math.max(
                0,
                line.pcs_discount_amount !== undefined
                  ? line.pcs_discount_amount
                  : line.discount_amount || 0
              )
            );
            const qty = Math.max(0.01, line.qty_pcs > 0 ? line.qty_pcs : line.qty_ordered || 1);
            const subtotal = Math.max(0, (cost - disc) * qty);

            return (
              <tr
                key={line.item_id}
                className="bg-white dark:bg-[#1E1E22] transition-colors hover:bg-slate-50/80 dark:hover:bg-[#25252A]"
              >
                {/* 1. Kolom No. & Tombol Hapus */}
                <td className="px-2 py-3.5 border-b border-slate-200/80 dark:border-[#38383C] text-center align-middle">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <span className="font-mono font-black text-sm text-slate-700 dark:text-slate-300">
                      {idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveLineItem(idx)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                      title={t.poGoodsTableRemoveItem}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>

                {/* 2. Nama & Info Produk */}
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
                  </div>
                </td>

                {/* 3. Qty */}
                <td className="px-4 py-3.5 border-b border-slate-200/80 dark:border-[#38383C] align-middle">
                  <InputGroup className="w-28 sm:w-32">
                    <InputGroupInput
                      type="number"
                      min="0.01"
                      value={line.qty_pcs > 0 ? line.qty_pcs : line.qty_ordered}
                      onChange={(e) => {
                        const val = Math.max(0.01, parseFloat(e.target.value) || 0);
                        onUpdateLineItem(idx, "qty_pcs", val);
                        onUpdateLineItem(idx, "qty_ordered", val);
                      }}
                      placeholder="1"
                      className="font-bold text-xs"
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        {line.base_unit}
                      </InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </td>

                {/* 4. Harga Satuan */}
                <td className="px-4 py-3.5 border-b border-slate-200/80 dark:border-[#38383C] align-middle">
                  <div className="relative w-36 sm:w-40">
                    {renderPriceDiffBadge(cost, line.original_pcs_cost)}
                    <InputGroup className="w-full">
                      <InputGroupAddon align="inline-start">
                        <InputGroupText className="text-xs font-bold text-slate-700 dark:text-slate-200">Rp</InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput
                        currency
                        value={cost}
                        onValueChange={(val) => {
                          const safeCost = Math.max(0, val);
                          onUpdateLineItem(idx, "pcs_cost", safeCost);
                          onUpdateLineItem(idx, "unit_cost", safeCost);
                          if (disc > safeCost) {
                            onUpdateLineItem(idx, "pcs_discount_amount", safeCost);
                            onUpdateLineItem(idx, "discount_amount", safeCost);
                            onUpdateLineItem(idx, "pcs_discount_percent", 100);
                            onUpdateLineItem(idx, "discount_percent", 100);
                          }
                        }}
                        className="font-bold text-xs"
                      />
                    </InputGroup>
                  </div>
                </td>

                {/* 5. Diskon Satuan (Ter-clamp ke cost) */}
                <td className="px-4 py-3.5 border-b border-slate-200/80 dark:border-[#38383C] align-middle">
                  <ButtonGroup className="w-fit inline-flex">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-lg"
                      onClick={() => setSliderDialogTarget({ index: idx, unit: "pcs" })}
                      className={cn(
                        "shrink-0 h-9 w-8 cursor-pointer transition shadow-xs",
                        disc > 0 || (line.pcs_discount_percent || line.discount_percent || 0) > 0
                          ? "bg-slate-900 text-white dark:bg-[#E2FF66] dark:text-slate-900 border-slate-900 dark:border-[#E2FF66]"
                          : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                      )}
                      title={t.poGoodsTableOpenSlider}
                    >
                      <SlidersHorizontal className="size-3.5" />
                    </Button>
                    <InputGroup className="w-24 sm:w-28 h-9">
                      <InputGroupAddon align="inline-start" className="pl-2 pr-1">
                        <InputGroupText className="text-xs font-bold text-slate-700 dark:text-slate-200">Rp</InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput
                        currency
                        value={disc}
                        max={cost}
                        onValueChange={(val) => {
                          const clampedVal = Math.min(cost, Math.max(0, val));
                          const rawPct = cost > 0 ? (clampedVal / cost) * 100 : 0;
                          const pct = Math.min(100, Math.max(0, Number(rawPct.toFixed(1))));
                          onUpdateLineItem(idx, "pcs_discount_amount", clampedVal);
                          onUpdateLineItem(idx, "pcs_discount_percent", pct);
                          onUpdateLineItem(idx, "discount_amount", clampedVal);
                          onUpdateLineItem(idx, "discount_percent", pct);
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
                          if (!isNaN(raw) && raw > 100) {
                            e.target.value = "100";
                          }
                          const amt = cost > 0 ? Math.min(cost, Math.round((cost * safePct) / 100)) : 0;
                          onUpdateLineItem(idx, "pcs_discount_percent", safePct);
                          onUpdateLineItem(idx, "pcs_discount_amount", amt);
                          onUpdateLineItem(idx, "discount_percent", safePct);
                          onUpdateLineItem(idx, "discount_amount", amt);
                        }}
                        placeholder="0"
                        className="font-bold text-xs text-center px-1"
                      />
                      <InputGroupAddon align="inline-end" className="pr-1.5 pl-0">
                        <InputGroupText className="text-xs font-bold text-slate-700 dark:text-slate-200">%</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                  </ButtonGroup>
                </td>

                {/* 6. Subtotal */}
                <td className="px-4 py-3.5 border-b border-slate-200/80 dark:border-[#38383C] text-right align-middle">
                  <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white block font-mono">
                    Rp {subtotal.toLocaleString("id-ID")}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {sliderDialogTarget !== null && lineItems[sliderDialogTarget.index] && (() => {
        const line = lineItems[sliderDialogTarget.index];
        const isBox = sliderDialogTarget.unit === "box";
        const unitName = isBox ? line.box_unit || "Dus" : line.base_unit || "Pcs";
        const unitCost = Math.max(
          0,
          isBox
            ? line.box_cost || 0
            : line.pcs_cost > 0
            ? line.pcs_cost
            : line.unit_cost || 0
        );
        const initPct = isBox
          ? line.box_discount_percent || 0
          : line.pcs_discount_percent ?? line.discount_percent ?? 0;
        const initAmt = Math.min(
          unitCost,
          isBox
            ? line.box_discount_amount || 0
            : line.pcs_discount_amount ?? line.discount_amount ?? 0
        );

        return (
          <DiscountSliderDialog
            open={true}
            onOpenChange={(open) => !open && setSliderDialogTarget(null)}
            itemName={`${line.item_name} (per ${unitName})`}
            grossAmount={unitCost}
            initialPercent={initPct}
            initialAmount={initAmt}
            onApply={(pct, amt) => {
              const safePct = Math.min(100, Math.max(0, pct));
              const safeAmt = Math.min(unitCost, Math.max(0, amt));
              if (isBox) {
                onUpdateLineItem(sliderDialogTarget.index, "box_discount_percent", safePct);
                onUpdateLineItem(sliderDialogTarget.index, "box_discount_amount", safeAmt);
              } else {
                onUpdateLineItem(sliderDialogTarget.index, "pcs_discount_percent", safePct);
                onUpdateLineItem(sliderDialogTarget.index, "pcs_discount_amount", safeAmt);
                onUpdateLineItem(sliderDialogTarget.index, "discount_percent", safePct);
                onUpdateLineItem(sliderDialogTarget.index, "discount_amount", safeAmt);
              }
            }}
          />
        );
      })()}
    </div>
  );
}
