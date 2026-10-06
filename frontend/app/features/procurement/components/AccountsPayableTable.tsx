import React, { useState, useMemo } from "react";
import { ErpDataTable, type ColumnDef } from "../../../components/ErpDataTable";
import { ErpSearchBar } from "../../../components/ErpSearchBar";
import {
  CreditCard,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import type { Purchase } from "../types";

interface AccountsPayableTableProps {
  purchases: Purchase[];
  onOpenDetail: (purchase: Purchase) => void;
  onOpenPayment: (purchase: Purchase) => void;
}

export function AccountsPayableTable({
  purchases,
  onOpenDetail,
  onOpenPayment,
}: AccountsPayableTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);

  // Filter only purchases with remaining debt
  const payablesList = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return purchases
      .filter((p) => p.amount_owed > 0)
      .filter((p) => {
        const matchSearch =
          searchQuery === "" ||
          p.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.invoice_no && p.invoice_no.toLowerCase().includes(searchQuery.toLowerCase()));

        if (overdueOnly) {
          const isOverdue = p.due_date && p.due_date < today;
          return matchSearch && isOverdue;
        }

        return matchSearch;
      });
  }, [purchases, searchQuery, overdueOnly]);

  const columns: ColumnDef<Purchase>[] = [
    {
      key: "po_info",
      label: "Faktur & Supplier",
      renderCell: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            {row.po_number}
          </span>
          <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
            {row.supplier_name}
          </span>
          {row.invoice_no && (
            <span className="text-[11px] text-slate-400 font-mono">
              Nota: {row.invoice_no}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "outlet",
      label: "Lokasi Cabang",
      renderCell: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          <Building2 className="w-3.5 h-3.5 text-slate-400" />
          <span>{row.outlet_name || "Gudang Pusat"}</span>
        </div>
      ),
    },
    {
      key: "due_date",
      label: "Jatuh Tempo",
      renderCell: (row) => {
        const today = new Date().toISOString().split("T")[0];
        const isOverdue = row.due_date && row.due_date < today;

        return (
          <div className="flex flex-col text-xs">
            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {row.due_date
                ? new Date(row.due_date).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "Tanpa Tempo"}
            </span>
            {isOverdue && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                <AlertTriangle className="w-3 h-3" /> Lewat Jatuh Tempo
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "financials",
      label: "Total & Terbayar",
      renderCell: (row) => (
        <div className="text-xs space-y-0.5">
          <div className="text-slate-500">
            Total: Rp {row.total_amount.toLocaleString("id-ID")}
          </div>
          <div className="text-emerald-600 dark:text-emerald-400 font-medium">
            Dibayar: Rp {row.amount_paid.toLocaleString("id-ID")}
          </div>
        </div>
      ),
    },
    {
      key: "amount_owed",
      label: "Sisa Hutang (AP)",
      renderCell: (row) => (
        <span className="font-black text-rose-600 dark:text-rose-400 text-sm font-mono">
          Rp {row.amount_owed.toLocaleString("id-ID")}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Aksi Pembayaran",
      align: "right",
      renderCell: (row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenPayment(row);
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition shadow-xs cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Bayar</span>
          </button>
          <button
            onClick={() => onOpenDetail(row)}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
            title="Lihat Detail Faktur"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Search & Overdue Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="w-full sm:w-80">
          <ErpSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Cari faktur hutang / supplier... (/)"
            size="sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOverdueOnly(!overdueOnly)}
            className={`h-[38px] px-3.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
              overdueOnly
                ? "bg-rose-50 dark:bg-rose-950/50 border-rose-300 text-rose-700 dark:text-rose-300 shadow-xs"
                : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span>Hanya Jatuh Tempo ({purchases.filter((p) => p.amount_owed > 0 && p.due_date && p.due_date < new Date().toISOString().split("T")[0]).length})</span>
          </button>
        </div>
      </div>

      {/* AP Data Table */}
      <ErpDataTable
        data={payablesList}
        columns={columns}
        keyExtractor={(item) => item.id}
        onRowClick={onOpenDetail}
        emptyText="Semua tagihan supplier lunas! Tidak ada hutang berjalan."
      />
    </div>
  );
}
