import React from "react";
import { Label } from "../../../components/ui/label";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Save,
  Send,
} from "lucide-react";
import { cn } from "../../../lib/utils";

export interface PurchaseOrderSummaryCardProps {
  lineItemsCount: number;
  formSubtotal: number;
  discountAmountInput: number;
  taxAmountInput: number;
  taxPercent: number;
  shippingCostInput: number;
  formTotalAmount: number;
  formAmountOwed: number;
  isSupplierCashOnly: boolean;
  submissionType: "submitted" | "received";
  onSubmissionTypeSelect: (type: "submitted" | "received") => void;
  isSubmitting: boolean;
  disableActions?: boolean;
  onSubmit: (targetStatus: "draft" | "submitted" | "received") => void;
  language: string;
  t: Record<string, string>;
}

export function PurchaseOrderSummaryCard({
  lineItemsCount,
  formSubtotal,
  discountAmountInput,
  taxAmountInput,
  taxPercent,
  shippingCostInput,
  formTotalAmount,
  formAmountOwed,
  isSupplierCashOnly,
  submissionType,
  onSubmissionTypeSelect,
  isSubmitting,
  disableActions = false,
  onSubmit,
  language,
  t,
}: PurchaseOrderSummaryCardProps) {
  return (
    <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-sm space-y-4">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
        {t.poSummaryTitle}
      </h3>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between text-slate-600 dark:text-slate-400">
          <span>{t.poSummaryItemsCount.replace("{count}", String(lineItemsCount))}</span>
          <span>Rp {formSubtotal.toLocaleString("id-ID")}</span>
        </div>
        {discountAmountInput > 0 && (
          <div className="flex justify-between text-emerald-600">
            <span>{t.poSummaryDiscount}</span>
            <span>- Rp {discountAmountInput.toLocaleString("id-ID")}</span>
          </div>
        )}
        {taxAmountInput > 0 && (
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>{t.poSummaryTax.replace("{percent}", String(taxPercent))}</span>
            <span>+ Rp {taxAmountInput.toLocaleString("id-ID")}</span>
          </div>
        )}
        {shippingCostInput > 0 && (
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>{t.poSummaryShipping}</span>
            <span>+ Rp {shippingCostInput.toLocaleString("id-ID")}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-black text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
          <span>{t.poSummaryTotal}</span>
          <span>Rp {formTotalAmount.toLocaleString("id-ID")}</span>
        </div>
      </div>

      {/* Warning Utang Supplier COD / Status Hutang */}
      {formAmountOwed > 0 && (
        <div
          className={cn(
            "p-3.5 rounded-2xl border text-xs space-y-1.5 transition-all animate-in fade-in-50",
            isSupplierCashOnly
              ? "bg-amber-500/10 border-amber-300 dark:border-amber-700/60 text-amber-950 dark:text-amber-200"
              : "bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200"
          )}
        >
          <div className="flex items-center gap-2 font-bold text-xs">
            {isSupplierCashOnly ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            ) : (
              <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            )}
            <span>
              {isSupplierCashOnly
                ? t.poDebtWarningSupplierCodTitle
                : t.poDebtWarningGeneralTitle}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed opacity-90">
            {isSupplierCashOnly
              ? t.poDebtWarningSupplierCodDesc.replace(
                  "{amount}",
                  formAmountOwed.toLocaleString(language === "en" ? "en-US" : "id-ID")
                )
              : t.poDebtWarningGeneralDesc.replace(
                  "{amount}",
                  formAmountOwed.toLocaleString(language === "en" ? "en-US" : "id-ID")
                )}
          </p>
        </div>
      )}

      {/* Choice Card: Tipe Transaksi (Default: PO) */}
      <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
          {t.poChoiceCardTitle}
        </Label>
        <div className="grid grid-cols-1 gap-2">
          {/* Card 1: PO Resmi (Default) */}
          <div
            onClick={() => onSubmissionTypeSelect("submitted")}
            className={cn(
              "p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none",
              submissionType === "submitted"
                ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/30 ring-1 ring-blue-600 shadow-xs"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 hover:border-slate-300"
            )}
          >
            <div
              className={cn(
                "p-2 rounded-xl shrink-0 mt-0.5",
                submissionType === "submitted"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500"
              )}
            >
              <Send className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white">{t.poChoiceOrderTitle}</span>
                <div
                  className={cn(
                    "w-4 h-4 rounded-full border flex items-center justify-center shrink-0",
                    submissionType === "submitted"
                      ? "border-blue-600 bg-blue-600"
                      : "border-slate-300 dark:border-slate-600"
                  )}
                >
                  {submissionType === "submitted" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                {t.poChoiceOrderDesc}
              </p>
            </div>
          </div>

          {/* Card 2: Beli Langsung */}
          <div
            onClick={() => onSubmissionTypeSelect("received")}
            className={cn(
              "p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none",
              submissionType === "received"
                ? "border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/30 ring-1 ring-emerald-600 shadow-xs"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 hover:border-slate-300"
            )}
          >
            <div
              className={cn(
                "p-2 rounded-xl shrink-0 mt-0.5",
                submissionType === "received"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500"
              )}
            >
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white">{t.poChoiceDirectTitle}</span>
                <div
                  className={cn(
                    "w-4 h-4 rounded-full border flex items-center justify-center shrink-0",
                    submissionType === "received"
                      ? "border-emerald-600 bg-emerald-600"
                      : "border-slate-300 dark:border-slate-600"
                  )}
                >
                  {submissionType === "received" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                {t.poChoiceDirectDesc}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-2 space-y-2">
        {/* Single Primary Action Button */}
        {submissionType === "submitted" ? (
          <button
            type="button"
            disabled={isSubmitting || disableActions}
            onClick={() => onSubmit("submitted")}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <Send className="w-4 h-4" />
            <span>{t.poSubmitOrderBtn}</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={isSubmitting || disableActions}
            onClick={() => onSubmit("received")}
            className="w-full py-3 rounded-xl bg-[#E2FF66] text-slate-900 hover:brightness-95 font-bold text-xs active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{t.poSubmitDirectBtn}</span>
          </button>
        )}

        {/* Secondary Action */}
        <button
          type="button"
          disabled={isSubmitting || disableActions}
          onClick={() => onSubmit("draft")}
          className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{t.poSubmitDraftBtn}</span>
        </button>
      </div>
    </div>
  );
}
