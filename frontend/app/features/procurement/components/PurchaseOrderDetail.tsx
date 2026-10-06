import React from "react";
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
} from "lucide-react";
import type { Purchase, PurchasePayment } from "../types";

interface PurchaseOrderDetailProps {
  purchase: Purchase;
  payments: PurchasePayment[];
  onBack: () => void;
  onConfirmReceive: (purchase: Purchase) => void;
  onOpenPayment: (purchase: Purchase) => void;
}

export function PurchaseOrderDetail({
  purchase,
  payments,
  onBack,
  onConfirmReceive,
  onOpenPayment,
}: PurchaseOrderDetailProps) {
  return (
    <div className="space-y-6 w-full animate-in fade-in-50 duration-200">
      {/* Header with Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200/80 dark:border-[#2E2E34] gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Faktur PO: {purchase.po_number}
              </h1>
              {purchase.status === "received" ? (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Diterima (Stok Masuk)
                </span>
              ) : purchase.status === "submitted" ? (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  PO Terbit (Inbound)
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  Draf PO
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500">
              Supplier: <strong>{purchase.supplier_name}</strong> | Tanggal: {purchase.order_date}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {purchase.status !== "received" && purchase.status !== "cancelled" && (
            <button
              type="button"
              onClick={() => onConfirmReceive(purchase)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-xs hover:bg-emerald-600 transition shadow-sm cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Terima Barang (Stok Masuk)</span>
            </button>
          )}

          {purchase.amount_owed > 0 && (
            <button
              type="button"
              onClick={() => onOpenPayment(purchase)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition shadow-sm cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              <span>Catat Pembayaran AP</span>
            </button>
          )}
        </div>
      </div>

      {/* 2-Column Responsive Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Line Items & Delivery Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-slate-500" />
              Daftar Barang Belanja
            </h3>

            <div className="border border-slate-200 dark:border-[#2E2E34] rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-[#202024] text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-[#2E2E34]">
                  <tr>
                    <th className="px-4 py-3">Nama Barang</th>
                    <th className="px-4 py-3 text-center">Satuan</th>
                    <th className="px-4 py-3 text-center">Qty Dipesan</th>
                    <th className="px-4 py-3 text-center">Qty Diterima</th>
                    <th className="px-4 py-3 text-right">Harga Satuan</th>
                    <th className="px-4 py-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {purchase.items?.map((item) => (
                    <tr key={item.id} className="text-slate-800 dark:text-slate-200">
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                        {item.item_name}
                      </td>
                      <td className="px-4 py-3 text-center font-mono">
                        {item.uom === "box" ? item.box_unit || "Dus" : item.base_unit}
                      </td>
                      <td className="px-4 py-3 text-center font-bold">{item.qty_ordered}</td>
                      <td className="px-4 py-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {item.qty_received}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        Rp {item.unit_cost.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3 text-right font-bold">
                        Rp {item.subtotal.toLocaleString("id-ID")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Riwayat Pembayaran AP */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-500" />
                Riwayat Pembayaran Hutang Supplier ({payments.length})
              </h3>
              {purchase.amount_owed > 0 && (
                <button
                  onClick={() => onOpenPayment(purchase)}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  + Bayar Cicilan
                </button>
              )}
            </div>

            {payments.length === 0 ? (
              <div className="p-6 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-400">
                Belum ada riwayat pembayaran yang dicatat untuk faktur ini.
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
                        Metode: <strong>{pay.payment_method}</strong>{" "}
                        {pay.reference_no ? `(Ref: ${pay.reference_no})` : ""}{" "}
                        {pay.recorded_by_name ? `• Dicatat oleh: ${pay.recorded_by_name}` : ""}
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

        {/* Right: Financial & Audit Box */}
        <div className="space-y-6">
          <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              Ringkasan Finansial Faktur
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Subtotal Barang:</span>
                <span>Rp {purchase.subtotal_amount.toLocaleString("id-ID")}</span>
              </div>
              {purchase.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Diskon Faktur:</span>
                  <span>- Rp {purchase.discount_amount.toLocaleString("id-ID")}</span>
                </div>
              )}
              {purchase.shipping_cost > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Ongkos Kirim:</span>
                  <span>Rp {purchase.shipping_cost.toLocaleString("id-ID")}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                <span>Total Tagihan:</span>
                <span>Rp {purchase.total_amount.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex justify-between text-emerald-600 font-bold">
                <span>Sudah Dibayar:</span>
                <span>Rp {purchase.amount_paid.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-rose-600 dark:text-rose-400 pt-2 border-t border-slate-200 dark:border-slate-700">
                <span>Sisa Hutang (AP):</span>
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
                <span>Catat Pembayaran Hutang</span>
              </button>
            )}
          </div>

          {/* Audit Trail Box */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-sm space-y-3 text-xs">
            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Jejak Audit Dokumen
            </h4>
            <div className="space-y-1.5 text-slate-600 dark:text-slate-400">
              <div>Dibuat oleh: <strong>{purchase.created_by_name || "-"}</strong></div>
              <div>Lokasi Penerimaan: <strong>{purchase.outlet_name || "Gudang Pusat"}</strong></div>
              {purchase.received_by_name && (
                <div>Diterima fisik oleh: <strong>{purchase.received_by_name}</strong></div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
