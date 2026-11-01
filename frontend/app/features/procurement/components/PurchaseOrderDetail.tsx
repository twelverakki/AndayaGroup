import React, { useState, useMemo } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Package,
  DollarSign,
  FileText,
  Building2,
  Clock,
  Truck,
  AlertCircle,
  Printer,
  Calendar,
  CalendarClock,
  X,
  Boxes,
  Pencil,
} from "lucide-react";
import { ErpDataTable, type ColumnDef } from "../../../components/ErpDataTable";
import { useLanguageStore, translations } from "../../../lib/i18n";
import { cn } from "../../../lib/utils";
import type { Purchase, PurchaseItem, PurchasePayment } from "../types";

interface PurchaseOrderDetailProps {
  purchase: Purchase;
  payments: PurchasePayment[];
  loading?: boolean;
  onBack: () => void;
  onConfirmReceive: (
    purchase: Purchase,
    payload?: {
      received_at?: string;
      notes?: string;
      items?: { item_id: string; qty_received: number }[];
    }
  ) => Promise<void> | void;
  onOpenPayment: (purchase: Purchase) => void;
  onEditDraft?: (purchase: Purchase) => void;
}

export function PurchaseOrderDetail({
  purchase,
  payments,
  loading = false,
  onBack,
  onConfirmReceive,
  onOpenPayment,
  onEditDraft,
}: PurchaseOrderDetailProps) {
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;

  // ── INLINE PHYSICAL GOODS INSPECTION MODE ──
  const [isReceivingMode, setIsReceivingMode] = useState(false);
  const [isSubmittingReceive, setIsSubmittingReceive] = useState(false);
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [receivingNotes, setReceivingNotes] = useState("");
  // Map item_id -> quantity physically received
  const [receivedQtyMap, setReceivedQtyMap] = useState<Record<string, number>>({});

  const startReceivingMode = () => {
    const initialMap: Record<string, number> = {};
    (purchase.items || []).forEach((item) => {
      // Default to qty_ordered
      initialMap[item.item_id] = item.qty_ordered;
    });
    setReceivedQtyMap(initialMap);
    setReceivedDate(new Date().toISOString().split("T")[0]);
    setReceivingNotes("");
    setIsReceivingMode(true);
  };

  const cancelReceivingMode = () => {
    setIsReceivingMode(false);
  };

  const handleAutoFillAll = () => {
    const map: Record<string, number> = {};
    (purchase.items || []).forEach((item) => {
      map[item.item_id] = item.qty_ordered;
    });
    setReceivedQtyMap(map);
  };

  const handleSaveReceiving = async () => {
    setIsSubmittingReceive(true);
    try {
      const itemsPayload = Object.entries(receivedQtyMap).map(([itemId, qty]) => ({
        item_id: itemId,
        qty_received: Number(qty) || 0,
      }));

      await onConfirmReceive(purchase, {
        received_at: receivedDate ? new Date(receivedDate).toISOString() : undefined,
        notes: receivingNotes || undefined,
        items: itemsPayload,
      });
      setIsReceivingMode(false);
    } catch {
      // Handled by parent toast notification
    } finally {
      setIsSubmittingReceive(false);
    }
  };

  // ── TABLE COLUMNS SPECIFICATION ──
  const itemColumns: ColumnDef<PurchaseItem>[] = useMemo(
    () => [
      {
        key: "item_name",
        label: t.poDetailColItem,
        align: "left",
        renderCell: (item) => (
          <div>
            <span className="font-bold text-slate-900 dark:text-white block">
              {item.item_name}
            </span>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              {item.item_sku && (
                <span className="font-mono">{item.item_sku}</span>
              )}
              {item.notes && (
                <span className="italic text-slate-500">
                  • {item.notes}
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        key: "uom",
        label: t.poDetailColUnit,
        align: "center",
        renderCell: (item) => (
          <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
            {item.uom === "box" ? item.box_unit || "Dus" : item.base_unit}
          </span>
        ),
      },
      {
        key: "qty_ordered",
        label: t.poDetailColQtyOrdered,
        align: "center",
        renderCell: (item) => (
          <span className="font-bold text-slate-900 dark:text-white">
            {item.qty_ordered}
          </span>
        ),
      },
      {
        key: "qty_received",
        label: isReceivingMode ? t.poReceivingPhysicalQty : t.poDetailColQtyReceived,
        align: "center",
        renderCell: (item) => {
          if (isReceivingMode) {
            const currentVal = receivedQtyMap[item.item_id] ?? item.qty_ordered;
            const isDeficit = currentVal < item.qty_ordered;
            return (
              <div className="flex items-center justify-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  step={item.uom === "box" ? 1 : 0.01}
                  value={currentVal}
                  onChange={(e) => {
                    const num = parseFloat(e.target.value) || 0;
                    setReceivedQtyMap((prev) => ({
                      ...prev,
                      [item.item_id]: num,
                    }));
                  }}
                  className={`w-20 px-2.5 py-1 text-center font-bold rounded-lg border text-xs bg-white dark:bg-slate-900 transition ${
                    isDeficit
                      ? "border-amber-400 text-amber-600 dark:text-amber-400 bg-amber-50/50"
                      : "border-emerald-400 text-emerald-700 dark:text-emerald-300"
                  }`}
                />
              </div>
            );
          }
          return (
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {item.qty_received}
            </span>
          );
        },
      },
      {
        key: "unit_cost",
        label: t.poDetailColUnitPrice,
        align: "right",
        renderCell: (item) => (
          <span className="font-mono text-slate-700 dark:text-slate-300">
            Rp {item.unit_cost.toLocaleString("id-ID")}
          </span>
        ),
      },
      {
        key: "discount_amount",
        label: t.poDetailColDiscount,
        align: "right",
        renderCell: (item) =>
          item.discount_amount > 0 ? (
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              -Rp {item.discount_amount.toLocaleString("id-ID")}
            </span>
          ) : (
            <span className="text-slate-400">-</span>
          ),
      },
      {
        key: "subtotal",
        label: t.poDetailColSubtotal,
        align: "right",
        renderCell: (item) => (
          <span className="font-bold text-slate-900 dark:text-white">
            Rp {item.subtotal.toLocaleString("id-ID")}
          </span>
        ),
      },
    ],
    [t, isReceivingMode, receivedQtyMap]
  );

  const renderMobileItem = (item: PurchaseItem) => {
    const currentReceived = receivedQtyMap[item.item_id] ?? item.qty_ordered;
    return (
      <div className="p-3.5 space-y-2 bg-slate-50 dark:bg-[#202024] rounded-2xl border border-slate-200/80 dark:border-slate-800 my-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="font-bold text-slate-900 dark:text-white text-xs block">
              {item.item_name}
            </span>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              {item.item_sku && <span className="font-mono">{item.item_sku}</span>}
              {item.notes && <span className="italic text-slate-500">• {item.notes}</span>}
            </div>
          </div>
          <span className="font-bold text-slate-900 dark:text-white text-xs">
            Rp {item.subtotal.toLocaleString("id-ID")}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-200/60 dark:border-slate-800">
          <div>
            <span className="text-slate-400 block">{t.poDetailColUnit}</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {item.uom === "box" ? item.box_unit || "Dus" : item.base_unit}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">{t.poDetailColUnitPrice}</span>
            <span className="font-mono text-slate-700 dark:text-slate-300">
              Rp {item.unit_cost.toLocaleString("id-ID")}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">{t.poDetailColQtyOrdered}</span>
            <span className="font-bold text-slate-900 dark:text-white">{item.qty_ordered}</span>
          </div>
          <div>
            <span className="text-slate-400 block">
              {isReceivingMode ? t.poReceivingPhysicalQty : t.poDetailColQtyReceived}
            </span>
            {isReceivingMode ? (
              <input
                type="number"
                min={0}
                value={currentReceived}
                onChange={(e) => {
                  const num = parseFloat(e.target.value) || 0;
                  setReceivedQtyMap((prev) => ({
                    ...prev,
                    [item.item_id]: num,
                  }));
                }}
                className="w-full px-2 py-0.5 mt-0.5 text-center font-bold rounded border text-xs bg-white dark:bg-slate-900 border-emerald-400"
              />
            ) : (
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {item.qty_received}
              </span>
            )}
          </div>
          {item.discount_amount > 0 && (
            <div className="col-span-2 flex justify-between pt-1 border-t border-slate-200/40 dark:border-slate-800/60">
              <span className="text-slate-400">{t.poDetailColDiscount}</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                -Rp {item.discount_amount.toLocaleString("id-ID")}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 w-full animate-in fade-in-50 duration-200">
      {/* ========================================================================= */}
      {/* ── ZONA 1: FRAMELESS TOP BAR (Ramping, Tenang, Elegan) ── */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200/80 dark:border-[#2E2E34] gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {t.poDetailTitle} {purchase.po_number}
            </h1>

            {/* Transaction Type Badge */}
            <span
              className={cn(
                "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold tracking-wide",
                purchase.purchase_type === "direct"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  : "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
              )}
            >
              {purchase.purchase_type === "direct" ? t.poTypeDirectBadge : t.poTypeStandardBadge}
            </span>

            {/* Primary Physical Status Badge */}
            {purchase.status === "received" ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t.poStatusReceived}
              </span>
            ) : purchase.status === "partially_received" ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <Clock className="w-3.5 h-3.5" />
                {t.poStatusPartiallyReceived}
              </span>
            ) : purchase.status === "submitted" ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <Clock className="w-3.5 h-3.5" />
                {t.poStatusSubmitted}
              </span>
            ) : purchase.status === "cancelled" ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                <AlertCircle className="w-3.5 h-3.5" />
                {t.poStatusCancelled}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {t.poStatusDraft}
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isReceivingMode ? (
            <>
              <button
                type="button"
                onClick={cancelReceivingMode}
                disabled={isSubmittingReceive}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>{t.poActionCancelReceiving}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveReceiving}
                disabled={isSubmittingReceive}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-xs hover:bg-emerald-600 transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmittingReceive ? t.processing : t.poActionSaveReceiving}</span>
              </button>
            </>
          ) : (
            <>
              {/* Print Button */}
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition shadow-sm cursor-pointer"
                title={t.poDetailPrintBtn}
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">{t.poDetailPrintBtn}</span>
              </button>

              {/* Draft Edit Button */}
              {purchase.status === "draft" && onEditDraft && (
                <button
                  type="button"
                  onClick={() => onEditDraft(purchase)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#E2FF66] text-slate-900 font-bold text-xs hover:bg-[#d6f555] transition shadow-sm cursor-pointer"
                >
                  <Pencil className="w-4 h-4" />
                  <span>{language === "en" ? "Resume / Edit Draft" : "Lanjutkan / Edit Draf"}</span>
                </button>
              )}

              {/* Start Physical Receiving Mode */}
              {purchase.status !== "received" && purchase.status !== "cancelled" && purchase.status !== "draft" && (
                <button
                  type="button"
                  onClick={startReceivingMode}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-xs hover:bg-emerald-600 transition shadow-sm cursor-pointer"
                >
                  <Boxes className="w-4 h-4" />
                  <span>{t.poActionStartReceiving}</span>
                </button>
              )}

              {/* Pay Action */}
              {purchase.amount_owed > 0 && purchase.status !== "draft" && (
                <button
                  type="button"
                  onClick={() => onOpenPayment(purchase)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition shadow-sm cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>{t.poActionRecordPayment}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ── ZONA DRAFT BANNER (Jika status masih draf) ── */}
      {/* ========================================================================= */}
      {purchase.status === "draft" && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/60 rounded-xl text-amber-700 dark:text-amber-400 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                {purchase.purchase_type === "direct"
                  ? (language === "en" ? "Draft Direct Purchase (On-Hand Receipt)" : "Draf Pembelian Langsung (Nota / Belanja Pasar)")
                  : (language === "en" ? "Draft Standard Purchase Order (PO)" : "Draf Pesanan Pembelian (PO Standar)")}
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-300/90 mt-0.5">
                {purchase.purchase_type === "direct"
                  ? (language === "en"
                      ? "This direct purchase draft is not yet posted to inventory. When completed, stock will be added to your outlet immediately."
                      : "Draf pembelian langsung ini belum difinalisasi ke stok. Saat diselesaikan, saldo stok toko akan langsung bertambah seketika.")
                  : (language === "en"
                      ? "This order has not been finalized or dispatched to supplier. You can edit item lines, quantities, and payment terms."
                      : "Pesanan ini belum difinalisasi atau dikirim ke supplier. Anda dapat mengedit item barang, kuantitas, maupun ketentuan pembayaran.")}
              </p>
            </div>
          </div>
          {onEditDraft && (
            <button
              type="button"
              onClick={() => onEditDraft(purchase)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition whitespace-nowrap cursor-pointer shrink-0"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>{language === "en" ? "Edit Draft" : "Edit Draf Sekarang"}</span>
            </button>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ── ZONA 2: 3-COLUMN METADATA INFO STRIP (Lega & Informatif) ── */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Supplier & Faktur */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-sm flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-500" />
              {t.poCardSupplierTitle}
            </span>
            {purchase.invoice_no && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {purchase.invoice_no}
              </span>
            )}
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
              {purchase.supplier_name}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {purchase.invoice_no
                ? `${t.poDetailInvoiceNo} ${purchase.invoice_no}`
                : "Dokumen Pembelian Internal"}
            </p>
          </div>
        </div>

        {/* Card 2: Termin & Pembayaran */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-sm flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
              {t.poCardPaymentTitle}
            </span>
            {purchase.payment_status === "paid" ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                {t.poPaymentStatusPaid}
              </span>
            ) : purchase.payment_status === "partial" ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                {t.poPaymentStatusPartial}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                {t.poPaymentStatusUnpaid}
              </span>
            )}
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span>{t.poDetailDate}</span>
              <strong className="text-slate-800 dark:text-slate-200">
                {new Date(purchase.order_date).toLocaleDateString(
                  language === "en" ? "en-US" : "id-ID",
                  {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }
                )}
              </strong>
            </div>
            {purchase.due_date && (
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">{t.poDetailDueDate}</span>
                <strong
                  className={
                    purchase.payment_status !== "paid"
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-slate-800 dark:text-slate-200"
                  }
                >
                  {new Date(purchase.due_date).toLocaleDateString(
                    language === "en" ? "en-US" : "id-ID",
                    {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }
                  )}
                </strong>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Logistik & Gudang */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-sm flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-blue-500" />
              {t.poCardLogisticsTitle}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {purchase.payment_method === "credit"
                ? t.poPaymentMethodCredit
                : purchase.payment_method === "bank_transfer"
                ? t.poPaymentMethodTransfer
                : purchase.payment_method === "qris"
                ? "QRIS"
                : t.poPaymentMethodCash}
            </span>
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {purchase.outlet_name || t.poCentralWarehouse}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              {purchase.received_at
                ? `${t.poStatusReceived}: ${new Date(purchase.received_at).toLocaleDateString(
                    language === "en" ? "en-US" : "id-ID",
                    { day: "numeric", month: "short" }
                  )}`
                : t.poStatusSubmitted}
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ── ZONA 3 & 4: KONTEN UTAMA (KIRI: BARANG & BUKTI, KANAN: FINANSIAL) ── */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom Kiri: Tabel Barang & Bukti Pembayaran */}
        <div className="lg:col-span-2 space-y-6">
          {/* Banner Validasi Penerimaan Fisik (Hanya aktif saat Mode Penerimaan) */}
          {isReceivingMode && (
            <div className="p-4 rounded-3xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 space-y-3 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    {t.poReceivingModeBannerTitle}
                  </h4>
                  <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80">
                    {t.poReceivingModeBannerDesc}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAutoFillAll}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/50 transition cursor-pointer self-start sm:self-auto shrink-0 shadow-sm"
                >
                  {t.poReceivingFillAll}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/50">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300 block">
                    {t.poReceivingDate}
                  </label>
                  <input
                    type="date"
                    value={receivedDate}
                    onChange={(e) => setReceivedDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-slate-800 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300 block">
                    {t.poReceivingNotes}
                  </label>
                  <input
                    type="text"
                    value={receivingNotes}
                    onChange={(e) => setReceivingNotes(e.target.value)}
                    placeholder="Contoh: Diterima oleh Pak Budi, kondisi mulus"
                    className="w-full px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-slate-800 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Master Table via Reusable ErpDataTable */}
          <ErpDataTable<PurchaseItem>
            title={t.poDetailItemsTitle}
            icon={<Package className="w-4 h-4 text-slate-500" />}
            data={purchase.items || []}
            columns={itemColumns}
            keyExtractor={(item) => item.id}
            loading={loading}
            emptyText={t.poGoodsTableEmptyTitle}
            renderMobileItem={renderMobileItem}
            enableColumnToggle={!isReceivingMode}
          />

          {/* Catatan Pembelian PO */}
          {purchase.notes && (
            <div className="p-4 rounded-3xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/50 space-y-1">
              <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                {t.poDetailNotesTitle}
              </h4>
              <p className="text-xs text-amber-900/90 dark:text-amber-200/90 whitespace-pre-wrap leading-relaxed">
                {purchase.notes}
              </p>
            </div>
          )}

          {/* Riwayat Pembayaran Hutang */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-500" />
                {t.poDetailPaymentHistory} ({payments.length})
              </h3>
              {purchase.amount_owed > 0 && (
                <button
                  onClick={() => onOpenPayment(purchase)}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  {t.poDetailRecordPaymentBtn}
                </button>
              )}
            </div>

            {payments.length === 0 ? (
              <div className="p-6 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-400">
                {t.poDetailNoPayments}
              </div>
            ) : (
              <div className="space-y-2">
                {payments.map((pay) => (
                  <div
                    key={pay.id}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-900 dark:text-white block">
                        {pay.payment_no} — {pay.payment_date}
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        {t.poDetailMethod} <strong>{pay.payment_method}</strong>{" "}
                        {pay.reference_no ? `(Ref: ${pay.reference_no})` : ""}{" "}
                        {pay.recorded_by_name ? `• ${t.poDetailRecordedBy} ${pay.recorded_by_name}` : ""}
                      </span>
                    </div>
                    <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                      + Rp {pay.amount_paid.toLocaleString("id-ID")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Kolom Kanan: Finansial & Jejak Audit */}
        <div className="space-y-6">
          <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              {t.poDetailFinancialSummary}
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>{t.poDetailSubtotalItems}</span>
                <span>Rp {purchase.subtotal_amount.toLocaleString("id-ID")}</span>
              </div>
              {purchase.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>{t.poDetailDiscount}</span>
                  <span>- Rp {purchase.discount_amount.toLocaleString("id-ID")}</span>
                </div>
              )}
              {purchase.tax_amount > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>{t.poDetailTax}</span>
                  <span>+ Rp {purchase.tax_amount.toLocaleString("id-ID")}</span>
                </div>
              )}
              {purchase.shipping_cost > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>{t.poDetailShipping}</span>
                  <span>+ Rp {purchase.shipping_cost.toLocaleString("id-ID")}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                <span>{t.poDetailTotal}</span>
                <span>Rp {purchase.total_amount.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex justify-between text-emerald-600 font-bold">
                <span>{t.poDetailPaid}</span>
                <span>Rp {purchase.amount_paid.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-rose-600 dark:text-rose-400 pt-2 border-t border-slate-200 dark:border-slate-700">
                <span>{t.poDetailRemainingOwed}</span>
                <span>Rp {purchase.amount_owed.toLocaleString("id-ID")}</span>
              </div>
            </div>

            {purchase.amount_owed > 0 && (
              <button
                type="button"
                onClick={() => onOpenPayment(purchase)}
                className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 active:scale-95 transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>{t.poActionRecordPayment}</span>
              </button>
            )}
          </div>

          {/* Jejak Audit Dokumen */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-sm space-y-3 text-xs">
            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              {t.poDetailAuditTitle}
            </h4>
            <div className="space-y-2 text-slate-600 dark:text-slate-400">
              <div>
                <span className="text-slate-400 block">{t.poDetailCreatedBy}</span>
                <strong className="text-slate-800 dark:text-slate-200">
                  {purchase.created_by_name || "-"}
                </strong>
              </div>
              {purchase.created_at && (
                <div>
                  <span className="text-slate-400 block">{t.poDetailCreatedAt}</span>
                  <strong className="text-slate-800 dark:text-slate-200">
                    {new Date(purchase.created_at).toLocaleString(
                      language === "en" ? "en-US" : "id-ID",
                      {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }
                    )}
                  </strong>
                </div>
              )}
              <div>
                <span className="text-slate-400 block">{t.poDetailReceivingLocation}</span>
                <strong className="text-slate-800 dark:text-slate-200">
                  {purchase.outlet_name || t.poCentralWarehouse}
                </strong>
              </div>
              {purchase.received_by_name && (
                <div>
                  <span className="text-slate-400 block">{t.poDetailReceivedBy}</span>
                  <strong className="text-slate-800 dark:text-slate-200">
                    {purchase.received_by_name}
                  </strong>
                </div>
              )}
              {purchase.received_at && (
                <div>
                  <span className="text-slate-400 block">{t.poDetailReceivedAt}</span>
                  <strong className="text-emerald-600 dark:text-emerald-400">
                    {new Date(purchase.received_at).toLocaleString(
                      language === "en" ? "en-US" : "id-ID",
                      {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }
                    )}
                  </strong>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
