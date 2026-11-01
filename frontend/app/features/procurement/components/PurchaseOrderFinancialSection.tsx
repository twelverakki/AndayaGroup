import React from "react";
import { Button } from "../../../components/ui/button";
import { ButtonGroup } from "../../../components/ui/button-group";
import { Label } from "../../../components/ui/label";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupText,
  InputGroupTextarea,
} from "../../../components/ui/input-group";
import {
  ArrowLeft,
  Banknote,
  Building2,
  Clock,
  DollarSign,
  Info,
  QrCode,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "../../../lib/utils";

export interface PurchaseOrderFinancialSectionProps {
  layout: "wizard" | "classic";
  formSubtotal: number;
  formTotalAmount: number;
  formAmountOwed: number;
  discountAmountInput: number;
  discountPercent: number;
  onDiscountAmountChange: (val: number) => void;
  onDiscountPercentChange: (pct: number) => void;
  onOpenGlobalDiscountSlider: () => void;
  taxAmountInput: number;
  taxPercent: number;
  onTaxPercentChange: (pct: number) => void;
  shippingCostInput: number;
  onShippingCostChange: (val: number) => void;
  paymentMethodInput: "cash" | "bank_transfer" | "credit" | "qris";
  onPaymentMethodSelect: (method: "cash" | "bank_transfer" | "credit" | "qris") => void;
  amountPaidInput: number;
  onAmountPaidChange: (val: number) => void;
  onFillMaxAmountPaid: () => void;
  onAmountPaidMaxExceeded: (maxVal: number) => void;
  paymentAdjustHint: string | null;
  notesInput?: string;
  onNotesChange?: (val: string) => void;
  onBackToStep2?: () => void;
  language: string;
  t: Record<string, string>;
}

export function PurchaseOrderFinancialSection({
  layout,
  formSubtotal,
  formTotalAmount,
  formAmountOwed,
  discountAmountInput,
  discountPercent,
  onDiscountAmountChange,
  onDiscountPercentChange,
  onOpenGlobalDiscountSlider,
  taxAmountInput,
  taxPercent,
  onTaxPercentChange,
  shippingCostInput,
  onShippingCostChange,
  paymentMethodInput,
  onPaymentMethodSelect,
  amountPaidInput,
  onAmountPaidChange,
  onFillMaxAmountPaid,
  onAmountPaidMaxExceeded,
  paymentAdjustHint,
  notesInput = "",
  onNotesChange,
  onBackToStep2,
  language,
  t,
}: PurchaseOrderFinancialSectionProps) {
  const isWizard = layout === "wizard";

  return (
    <div
      className={cn(
        "rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-sm space-y-4",
        isWizard ? "p-6" : "p-5"
      )}
    >
      <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-emerald-500" />
        {t.poStep3Title}
      </h3>

      <div className={cn("text-xs", isWizard ? "grid grid-cols-1 sm:grid-cols-3 gap-3" : "space-y-3")}>
        {/* 1. Diskon Faktur Global */}
        <div className="space-y-1">
          <Label className="text-slate-600 dark:text-slate-300 font-bold">
            {t.poDiscountGlobalLabel}
          </Label>

          <ButtonGroup className="w-full">
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              onClick={onOpenGlobalDiscountSlider}
              className={cn(
                "shrink-0 h-10 w-10 cursor-pointer transition shadow-xs",
                discountPercent > 0 || discountAmountInput > 0
                  ? "bg-slate-900 text-white dark:bg-[#E2FF66] dark:text-slate-900 border-slate-900 dark:border-[#E2FF66]"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              )}
              title={language === "id" ? "Buka slider penyetelan diskon" : "Open discount slider"}
            >
              <SlidersHorizontal className="size-4" />
            </Button>

            <InputGroup className="flex-1 h-10 min-w-[120px]">
              <InputGroupAddon align="inline-start" className="pl-3">
                <InputGroupText className="text-xs font-bold">Rp</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                currency
                value={typeof discountAmountInput === "number" && !isNaN(discountAmountInput) ? discountAmountInput : 0}
                max={formSubtotal}
                onValueChange={onDiscountAmountChange}
                placeholder="0"
                className="font-bold text-xs"
              />
            </InputGroup>

            <InputGroup className="w-24 shrink-0 h-10">
              <InputGroupInput
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={
                  typeof discountPercent === "number" && !isNaN(discountPercent)
                    ? discountPercent
                    : typeof discountAmountInput === "number" && !isNaN(discountAmountInput) && formSubtotal > 0
                    ? Number(((discountAmountInput / formSubtotal) * 100).toFixed(1)) || 0
                    : 0
                }
                onChange={(e) => {
                  const raw = parseFloat(e.target.value);
                  const safePct = !isNaN(raw) && isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0;
                  onDiscountPercentChange(safePct);
                }}
                placeholder="0"
                className="font-bold text-xs text-center pr-1"
              />
              <InputGroupAddon align="inline-end" className="pr-3">
                <InputGroupText className="text-xs font-bold">%</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </ButtonGroup>
        </div>

        {/* 2. Pajak PPN */}
        <div className="space-y-1">
          <Label className="text-slate-600 dark:text-slate-300 font-bold">
            {t.poTaxInputLabel}
          </Label>

          <ButtonGroup className="w-full">
            <InputGroup className="flex-1 h-10 min-w-[120px] bg-slate-50 dark:bg-slate-900/40">
              <InputGroupAddon align="inline-start" className="pl-3">
                <InputGroupText className="text-xs font-bold text-slate-500">Rp</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                currency
                readOnly
                tabIndex={-1}
                value={typeof taxAmountInput === "number" && !isNaN(taxAmountInput) ? taxAmountInput : 0}
                placeholder="0"
                className="font-bold text-xs cursor-default text-slate-700 dark:text-slate-300 select-all"
                title={t.poTaxTooltip}
              />
            </InputGroup>

            <InputGroup className="w-24 shrink-0 h-10">
              <InputGroupInput
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={typeof taxPercent === "number" && !isNaN(taxPercent) ? taxPercent : 0}
                onChange={(e) => {
                  const raw = parseFloat(e.target.value);
                  const safePct = !isNaN(raw) && isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0;
                  onTaxPercentChange(safePct);
                }}
                placeholder="0"
                className="font-bold text-xs text-center pr-1"
              />
              <InputGroupAddon align="inline-end" className="pr-3">
                <InputGroupText className="text-xs font-bold">%</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </ButtonGroup>
        </div>

        {/* 3. Ongkos Kirim */}
        <div className="space-y-1">
          <Label className="text-slate-600 dark:text-slate-300 font-bold">
            {t.poShippingCostLabel}
          </Label>
          <InputGroup className="h-10">
            <InputGroupAddon align="inline-start" className="pl-3">
              <InputGroupText className="text-xs font-bold">Rp</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              currency
              value={shippingCostInput}
              onValueChange={onShippingCostChange}
              placeholder="0"
              className="font-bold text-xs"
            />
          </InputGroup>
        </div>
      </div>

      {/* Payment Method 4-Tile Radio */}
      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {t.poPaymentMethodLabel}
          </label>
          {paymentMethodInput === "credit" && (
            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
              {t.poPaymentMethodCreditNote}
            </span>
          )}
        </div>
        <div className={cn("grid gap-2", isWizard ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2")}>
          {[
            { id: "cash", label: t.poPaymentMethodCash, icon: Banknote },
            { id: "bank_transfer", label: t.poPaymentMethodTransfer, icon: Building2 },
            { id: "qris", label: t.poPaymentMethodQris, icon: QrCode },
            { id: "credit", label: t.poPaymentMethodCredit, icon: Clock },
          ].map((item) => {
            const Icon = item.icon;
            const isSelected = paymentMethodInput === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onPaymentMethodSelect(item.id as any)}
                className={cn(
                  "flex items-center gap-2 h-11 px-3 rounded-xl border text-left transition cursor-pointer",
                  isSelected
                    ? "border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 font-bold ring-1 ring-indigo-600"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                )}
              >
                <Icon className={cn("w-4 h-4 shrink-0", isSelected ? "text-indigo-600" : "text-slate-400")} />
                <span className="text-xs truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Payment Amount */}
      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between gap-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
            {paymentMethodInput === "credit" ? t.poAmountPaidLabelCredit : t.poAmountPaidLabelCash}
          </label>
          <button
            type="button"
            onClick={onFillMaxAmountPaid}
            className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 underline underline-offset-2 transition cursor-pointer"
            title={language === "id" ? "Isi jumlah bayar maksimal (lunas)" : "Fill maximum amount (paid in full)"}
          >
            {t.poAmountPaidMaxAnchor}
          </button>
        </div>

        <div className="relative">
          <InputGroup className="h-11">
            <InputGroupAddon align="inline-start">
              <InputGroupText className="font-bold text-sm">Rp</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              currency
              value={amountPaidInput}
              onValueChange={onAmountPaidChange}
              max={formTotalAmount > 0 ? formTotalAmount : undefined}
              onMaxExceeded={onAmountPaidMaxExceeded}
              className="text-base font-bold"
              placeholder="0"
            />
          </InputGroup>
          {paymentAdjustHint && (
            <div className="mt-1.5 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2 animate-in fade-in-50">
              <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span>{paymentAdjustHint}</span>
            </div>
          )}
        </div>
        <div className="flex justify-between items-center text-xs font-bold pt-0.5">
          <span className="text-rose-600 dark:text-rose-400">{t.poRemainingOwedLabel}</span>
          <span className="text-rose-600 dark:text-rose-400 font-mono text-sm">
            Rp {formAmountOwed.toLocaleString("id-ID")}
          </span>
        </div>
      </div>

      {/* Notes & Back Action (Wizard Step 3 only) */}
      {isWizard && onNotesChange && (
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {t.poNotesLabel}
          </Label>
          <InputGroup>
            <InputGroupTextarea
              rows={2}
              value={notesInput}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder={t.poNotesPlaceholder}
            />
          </InputGroup>
        </div>
      )}

      {isWizard && onBackToStep2 && (
        <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onBackToStep2}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{language === "id" ? "Kembali ke Rincian Barang" : "Back to Items"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
