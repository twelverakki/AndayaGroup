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
import { CurrencyInput } from "../../../components/CurrencyInput";
import { DatePicker } from "../../../components/ui/date-picker";
import { CreditCard, Banknote, Building2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../lib/api";
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
      toast.error("Nominal pembayaran harus lebih besar dari Rp 0");
      return;
    }
    if (paymentAmount > (purchase.amount_owed || 0)) {
      toast.error(
        `Nominal pembayaran (Rp ${paymentAmount.toLocaleString("id-ID")}) melebihi sisa hutang (Rp ${(purchase.amount_owed || 0).toLocaleString("id-ID")})`
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

      toast.success("Pembayaran hutang supplier berhasil dicatat!");
      onOpenChange(false);
      onPaymentSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Gagal mencatat pembayaran");
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
            Catat Pembayaran Hutang Supplier (AP)
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Faktur: <strong>{purchase.po_number}</strong> • Supplier: <strong>{purchase.supplier_name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Sisa Hutang Overview */}
          <div className="p-3.5 rounded-2xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center justify-between text-xs">
            <span className="text-rose-700 dark:text-rose-300 font-medium">Sisa Hutang Faktur:</span>
            <span className="text-base font-black text-rose-600 dark:text-rose-400 font-mono">
              Rp {(purchase.amount_owed || 0).toLocaleString("id-ID")}
            </span>
          </div>

          {/* Nominal Pembayaran */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Nominal yang Dibayar (Rp) *
            </label>
            <CurrencyInput
              value={paymentAmount}
              onChange={setPaymentAmount}
              className="h-11 w-full text-base font-bold"
              placeholder="0"
            />
            {paymentAmount < (purchase.amount_owed || 0) && paymentAmount > 0 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                Pembayaran cicilan / parsial (Sisa setelah bayar: Rp {((purchase.amount_owed || 0) - paymentAmount).toLocaleString("id-ID")})
              </p>
            )}
          </div>

          {/* Metode Bayar */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Metode Pembayaran *
            </label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="h-10 w-full px-3.5 text-xs font-medium rounded-xl bg-slate-50 dark:bg-[#1E1E22] border-slate-200 dark:border-[#2E2E34] text-slate-900 dark:text-white">
                <SelectValue placeholder="Pilih Metode Bayar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Transfer Bank / Giro</SelectItem>
                <SelectItem value="cash">Tunai / Kas Toko</SelectItem>
                <SelectItem value="qris">QRIS / E-Wallet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Tanggal Pembayaran *
              </label>
              <DatePicker
                value={paymentDate}
                onChange={(val) => setPaymentDate(val)}
                placeholder="Pilih tanggal..."
                className="h-10 w-full rounded-xl bg-slate-50 dark:bg-[#1E1E22] border-slate-200 dark:border-[#2E2E34]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                No. Referensi / Bukti Transfer
              </label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="TRX-98234..."
                className="h-10 w-full px-3.5 rounded-xl text-xs bg-slate-50 dark:bg-[#1E1E22] border border-slate-200 dark:border-[#2E2E34] text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Catatan Pembayaran
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Rekening tujuan, nama pengirim, dsb..."
              className="w-full p-3 rounded-xl text-xs bg-slate-50 dark:bg-[#1E1E22] border border-slate-200 dark:border-[#2E2E34] text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isSubmitting || paymentAmount <= 0}
            onClick={handleSubmit}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"
          >
            {isSubmitting ? "Menyimpan..." : "Konfirmasi Pembayaran"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
