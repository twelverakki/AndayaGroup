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
import { useLanguageStore, translations } from "../../../lib/i18n";
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
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;

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
      label: t.apColInvoiceSupplier,
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
              {t.poInvoiceNote} {row.invoice_no}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "outlet",
      label: t.apColOutlet,
      renderCell: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          <Building2 className="w-3.5 h-3.5 text-slate-400" />
          <span>{row.outlet_name || t.poCentralWarehouse}</span>
        </div>
      ),
    },
    {
      key: "due_date",
      label: t.apColDueDate,
      renderCell: (row) => {
        const today = new Date().toISOString().split("T")[0];
        const isOverdue = row.due_date && row.due_date < today;

        return (
          <div className="flex flex-col text-xs">
            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {row.due_date
                ? new Date(row.due_date).toLocaleDateString(language === "en" ? "en-US" : "id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : t.apNoDueDate}
            </span>
            {isOverdue && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                <AlertTriangle className="w-3.5 h-3.5" /> {t.apOverdueBadge}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "financials",
      label: t.apColFinancials,
      renderCell: (row) => (
        <div className="text-xs space-y-0.5">
          <div className="text-slate-500">
            {t.apTotalLabel} Rp {row.total_amount.toLocaleString("id-ID")}
          </div>
          <div className="text-emerald-600 dark:text-emerald-400 font-medium">
            {t.apPaidLabel} Rp {row.amount_paid.toLocaleString("id-ID")}
          </div>
        </div>
      ),
    },
    {
      key: "amount_owed",
      label: t.apColRemaining,
      renderCell: (row) => (
        <span className="font-black text-rose-600 dark:text-rose-400 text-sm font-mono">
          Rp {row.amount_owed.toLocaleString("id-ID")}
        </span>
      ),
    },
    {
      key: "actions",
      label: t.apColAction,
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
            <span>{t.apActionPay}</span>
          </button>
          <button
            onClick={() => onOpenDetail(row)}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
            title={t.poActionViewDetail}
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
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1">
          <ErpSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t.apSearchPlaceholder}
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setOverdueOnly(!overdueOnly)}
            className={`h-11 px-4 rounded-2xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
              overdueOnly
                ? "bg-rose-50 dark:bg-rose-950/50 border-rose-300 text-rose-700 dark:text-rose-300"
                : "bg-white dark:bg-[#202024] border-slate-200/80 dark:border-dark-border text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span>{t.apFilterOverdueOnly} ({purchases.filter((p) => p.amount_owed > 0 && p.due_date && p.due_date < new Date().toISOString().split("T")[0]).length})</span>
          </button>
        </div>
      </div>

      {/* AP Data Table */}
      <ErpDataTable
        data={payablesList}
        columns={columns}
        keyExtractor={(item) => item.id}
        onRowClick={onOpenDetail}
        emptyText={t.apEmptyTable}
      />
    </div>
  );
}
