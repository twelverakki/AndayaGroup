import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../../components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../../../components/ui/select";
import { Label } from "../../../components/ui/label";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupText,
  InputGroupTextarea,
} from "../../../components/ui/input-group";
import { DatePicker } from "../../../components/ui/date-picker";
import { CreditCard, Banknote, Building2, QrCode, FileText } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../lib/api";
import { useLanguageStore, translations } from "../../../lib/i18n";
import type { Purchase } from "../types";

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchase: Purchase | null;
  onPaymentSuccess: () => void;
}

export function PaymentModal({
  open,
  onOpenChange,
  purchase,
  onPaymentSuccess,
}: PaymentModalProps) {
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;

  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>("bank_transfer");
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [referenceNo, setReferenceNo] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (purchase && open) {
      setPaymentAmount(purchase.amount_owed || 0);
      setPaymentMethod("bank_transfer");
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setReferenceNo("");
      setNotes("");
    }
  }, [purchase, open]);

  if (!purchase) return null;

  const handleSubmit = async () => {
    if (paymentAmount <= 0) {
      toast.error(t.paymentModalErrorZero);
      return;
    }
    if (paymentAmount > (purchase.amount_owed || 0)) {
      toast.error(
        `${t.paymentModalErrorExceed} (Rp ${paymentAmount.toLocaleString("id-ID")} > Rp ${(purchase.amount_owed || 0).toLocaleString("id-ID")})`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/purchases/${purchase.id}/payments`, {
        amount_paid: paymentAmount,
        payment_method: paymentMethod,
        payment_date: paymentDate,
        reference_no: referenceNo.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      toast.success(t.paymentModalSuccess);
      onOpenChange(false);
      onPaymentSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t.paymentModalError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl p-6 bg-white dark:bg-[#1E1E22] border border-slate-200 dark:border-[#2E2E34] shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            {t.paymentModalTitle}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {t.paymentModalInvoicePrefix} <strong>{purchase.po_number}</strong> • {t.paymentModalSupplierPrefix} <strong>{purchase.supplier_name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Sisa Hutang Overview */}
          <div className="p-3.5 rounded-2xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center justify-between text-xs">
            <span className="text-rose-700 dark:text-rose-300 font-medium">{t.paymentModalRemainingDebt}</span>
            <span className="text-base font-black text-rose-600 dark:text-rose-400 font-mono">
              Rp {(purchase.amount_owed || 0).toLocaleString("id-ID")}
            </span>
          </div>

          {/* Nominal Pembayaran */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {t.paymentModalAmountInput}
            </Label>
            <InputGroup className="h-11">
              <InputGroupAddon align="inline-start">
                <InputGroupText className="font-bold text-sm">Rp</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                currency
                value={paymentAmount}
                onValueChange={setPaymentAmount}
                max={purchase.amount_owed || undefined}
                className="text-base font-bold"
                placeholder="0"
              />
            </InputGroup>
            {paymentAmount < (purchase.amount_owed || 0) && paymentAmount > 0 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                {t.paymentModalPartialNotice.replace("{remaining}", ((purchase.amount_owed || 0) - paymentAmount).toLocaleString("id-ID"))}
              </p>
            )}
          </div>

          {/* Metode Bayar */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {t.paymentModalMethodLabel}
            </Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="h-10 w-full px-3.5 text-xs font-medium rounded-xl bg-slate-50 dark:bg-[#1E1E22] border-slate-200 dark:border-[#2E2E34] text-slate-900 dark:text-white">
                <SelectValue placeholder={t.paymentModalMethodPrompt} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">{t.paymentModalMethodTransferLong}</SelectItem>
                <SelectItem value="cash">{t.paymentModalMethodCashLong}</SelectItem>
                <SelectItem value="qris">{t.paymentModalMethodQrisLong}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.paymentModalDateLabel}
              </Label>
              <DatePicker
                value={paymentDate}
                onChange={(val) => setPaymentDate(val)}
                placeholder={t.paymentModalDatePlaceholder}
                className="h-10 w-full rounded-xl bg-slate-50 dark:bg-[#1E1E22] border-slate-200 dark:border-[#2E2E34]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.paymentModalRefLabel}
              </Label>
              <InputGroup className="h-10">
                <InputGroupAddon align="inline-start">
                  <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                </InputGroupAddon>
                <InputGroupInput
                  type="text"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder={t.paymentModalRefPlaceholder}
                  className="text-xs font-medium"
                />
              </InputGroup>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {t.paymentModalNotesLabel}
            </Label>
            <InputGroup>
              <InputGroupAddon align="block-start">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
              </InputGroupAddon>
              <InputGroupTextarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.paymentModalNotesPlaceholder}
                className="text-xs font-medium"
              />
            </InputGroup>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {t.paymentModalCancelBtn}
          </button>
          <button
            type="button"
            disabled={isSubmitting || paymentAmount <= 0}
            onClick={handleSubmit}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"
          >
            {isSubmitting ? t.paymentModalSubmitting : t.paymentModalConfirmBtn}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
