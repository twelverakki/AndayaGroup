import React, { useState, useMemo } from "react";
import { ErpDataTable, type ColumnDef } from "../../../components/ErpDataTable";
import { ErpSearchBar } from "../../../components/ErpSearchBar";
import { ErpFilterPopover } from "../../../components/ErpFilterPopover";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../../../components/ui/dropdown-menu";
import {
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  Truck,
  AlertCircle,
  FileText,
  CreditCard,
  Eye,
  Trash2,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../lib/api";
import { useLanguageStore, translations } from "../../../lib/i18n";
import { cn } from "../../../lib/utils";
import type { Purchase } from "../types";

interface PurchaseOrderTableProps {
  purchases: Purchase[];
  onOpenDetail: (purchase: Purchase) => void;
  onOpenPayment: (purchase: Purchase) => void;
  onEditDraft?: (purchase: Purchase) => void;
  onRefresh: () => void;
}

export function PurchaseOrderTable({
  purchases,
  onOpenDetail,
  onOpenPayment,
  onEditDraft,
  onRefresh,
}: PurchaseOrderTableProps) {
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");

  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      const matchSearch =
        searchQuery === "" ||
        p.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.invoice_no && p.invoice_no.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      const matchPayment = paymentFilter === "all" || p.payment_status === paymentFilter;

      return matchSearch && matchStatus && matchPayment;
    });
  }, [purchases, searchQuery, statusFilter, paymentFilter]);

  const handleConfirmReceive = async (purchase: Purchase) => {
    try {
      await api.post(`/purchases/${purchase.id}/receive`, {});
      toast.success(t.poActionConfirmReceiveSuccess);
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t.poActionConfirmReceiveError);
    }
  };

  const handleDeleteDraft = async (purchase: Purchase) => {
    if (!confirm(t.poActionDeleteDraftConfirm.replace("{poNumber}", purchase.po_number))) return;
    try {
      await api.delete(`/purchases/${purchase.id}`);
      toast.success(t.poActionDeleteDraftSuccess);
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t.poActionDeleteDraftError);
    }
  };

  const columns: ColumnDef<Purchase>[] = [
    {
      key: "po_number",
      label: t.poColNumber,
      renderCell: (row) => (
        <div className="flex flex-col gap-1 items-start">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-slate-900 dark:text-white">
              {row.po_number}
            </span>
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide",
                row.purchase_type === "direct"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  : "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
              )}
            >
              {row.purchase_type === "direct" ? t.poTypeDirectBadge : t.poTypeStandardBadge}
            </span>
          </div>
          {row.invoice_no && (
            <span className="text-[11px] text-slate-500 font-mono">
              {t.poInvoiceNote} {row.invoice_no}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "supplier",
      label: t.poColSupplier,
      renderCell: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {row.supplier_name}
          </span>
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <Building2 className="w-3 h-3 text-slate-400" />
            {row.outlet_name || t.poCentralWarehouse}
          </span>
        </div>
      ),
    },
    {
      key: "order_date",
      label: t.poColDate,
      renderCell: (row) => (
        <div className="flex flex-col text-xs text-slate-600 dark:text-slate-300">
          <span className="flex items-center gap-1 font-medium">
            <Calendar className="w-3 h-3 text-slate-400" />
            {new Date(row.order_date).toLocaleDateString(language === "en" ? "en-US" : "id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
          {row.due_date && row.payment_status !== "paid" && (
            <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" />
              {t.poDuePrefix} {new Date(row.due_date).toLocaleDateString(language === "en" ? "en-US" : "id-ID", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      label: t.poColPhysicalStatus,
      renderCell: (row) => {
        if (row.status === "received") {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" /> {t.poStatusReceived}
            </span>
          );
        }
        if (row.status === "submitted") {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              <Truck className="w-3.5 h-3.5" /> {t.poStatusSubmitted}
            </span>
          );
        }
        if (row.status === "cancelled") {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              <AlertCircle className="w-3.5 h-3.5" /> {t.poStatusCancelled}
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <FileText className="w-3 h-3" /> {t.poStatusDraft}
          </span>
        );
      },
    },
    {
      key: "payment",
      label: t.poColPaymentStatus,
      renderCell: (row) => {
        if (row.payment_status === "paid") {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              <CheckCircle2 className="w-3 h-3" /> {t.poPaymentStatusPaid}
            </span>
          );
        }
        if (row.payment_status === "partial") {
          return (
            <div className="flex flex-col text-xs">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                <CreditCard className="w-3 h-3" /> {t.poPaymentStatusPartial}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 font-mono">
                {t.poBadgeRemaining} Rp {row.amount_owed.toLocaleString("id-ID")}
              </span>
            </div>
          );
        }
        return (
          <div className="flex flex-col text-xs">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
              <Clock className="w-3 h-3" /> {t.poPaymentStatusUnpaid}
            </span>
            <span className="text-[10px] text-rose-600 font-mono mt-0.5">
              {t.poBadgeOwed} Rp {row.amount_owed.toLocaleString("id-ID")}
            </span>
          </div>
        );
      },
    },
    {
      key: "total_amount",
      label: t.poColTotal,
      renderCell: (row) => (
        <span className="font-bold text-slate-900 dark:text-white font-mono text-xs">
          Rp {row.total_amount.toLocaleString("id-ID")}
        </span>
      ),
    },
    {
      key: "actions",
      label: t.poColAction,
      align: "right",
      renderCell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            <MoreHorizontal className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {row.status === "draft" && onEditDraft && (
              <DropdownMenuItem
                onClick={() => onEditDraft(row)}
                className="font-bold text-indigo-600 dark:text-indigo-400"
              >
                <Pencil className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 mr-2" />
                <span>{language === "id" ? "Lanjutkan / Edit Draf" : "Edit / Continue Draft"}</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuItem onClick={() => onOpenDetail(row)}>
              <Eye className="w-3.5 h-3.5 text-slate-500 mr-2" />
              <span>{t.poActionViewDetail}</span>
            </DropdownMenuItem>

            {row.status !== "received" && row.status !== "cancelled" && row.status !== "draft" && (
              <DropdownMenuItem onClick={() => handleConfirmReceive(row)}>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mr-2" />
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {t.poActionReceiveGoods}
                </span>
              </DropdownMenuItem>
            )}

            {row.amount_owed > 0 && row.status !== "draft" && (
              <DropdownMenuItem onClick={() => onOpenPayment(row)}>
                <CreditCard className="w-3.5 h-3.5 text-indigo-500 mr-2" />
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  {t.poActionRecordPayment}
                </span>
              </DropdownMenuItem>
            )}

            {row.status === "draft" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleDeleteDraft(row)}
                  className="text-rose-600 dark:text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  <span>{t.poActionDeleteDraft}</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const countDraft = purchases.filter((p) => p.status === "draft").length;
  const countSubmitted = purchases.filter((p) => p.status === "submitted").length;
  const countReceived = purchases.filter((p) => p.status === "received").length;
  const countCancelled = purchases.filter((p) => p.status === "cancelled").length;

  const countUnpaid = purchases.filter((p) => p.payment_status === "unpaid").length;
  const countPartial = purchases.filter((p) => p.payment_status === "partial").length;
  const countPaid = purchases.filter((p) => p.payment_status === "paid").length;

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) + (paymentFilter !== "all" ? 1 : 0);

  const handleResetFilters = () => {
    setStatusFilter("all");
    setPaymentFilter("all");
    setSearchQuery("");
  };

  return (
    <div className="space-y-4">
      {/* 🔍 SEARCH & COMPREHENSIVE FILTER BAR (Ala Halaman Distribusi) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1">
          <ErpSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t.poSearchPlaceholder || "Cari no. PO, faktur, supplier, atau catatan..."}
          />
        </div>

        <ErpFilterPopover
          activeCount={activeFilterCount}
          onResetAll={handleResetFilters}
          title={language === "id" ? "Filter Kriteria Pengadaan" : "Procurement Filter Criteria"}
          resetLabel={language === "id" ? "Reset Filter" : "Reset Filters"}
          filterButtonLabel={language === "id" ? "Filter Data" : "Filter Data"}
          columnGroups={[
            {
              id: "status",
              title: language === "id" ? "Status Fisik Barang" : "Physical Goods Status",
              type: "single",
              selectedValue: statusFilter,
              onSelectSingle: (val) => setStatusFilter(val),
              options: [
                { key: "all", label: t.poFilterAllPhysical || "Semua Status Fisik", count: purchases.length },
                { key: "draft", label: t.poFilterDraft || "Draf Faktur", count: countDraft },
                { key: "submitted", label: t.poFilterSubmitted || "Diajukan / Terbit", count: countSubmitted },
                { key: "received", label: t.poFilterReceived || "Selesai Diterima", count: countReceived },
                { key: "cancelled", label: t.poFilterCancelled || "Dibatalkan", count: countCancelled },
              ],
            },
            {
              id: "payment_status",
              title: language === "id" ? "Status Pembayaran" : "Payment Status",
              type: "single",
              selectedValue: paymentFilter,
              onSelectSingle: (val) => setPaymentFilter(val),
              options: [
                { key: "all", label: t.poFilterAllPayment || "Semua Status Bayar", count: purchases.length },
                { key: "unpaid", label: t.poFilterUnpaid || "Belum Bayar (Utang)", count: countUnpaid },
                { key: "partial", label: t.poFilterPartial || "Sebagian", count: countPartial },
                { key: "paid", label: t.poFilterPaid || "Lunas", count: countPaid },
              ],
            },
          ]}
        />
      </div>

      {/* Main Table */}
      <ErpDataTable
        data={filteredPurchases}
        columns={columns}
        keyExtractor={(item) => item.id}
        onRowClick={(row) => {
          if (row.status === "draft" && onEditDraft) {
            onEditDraft(row);
          } else {
            onOpenDetail(row);
          }
        }}
        emptyText={t.poEmptyTable}
      />
    </div>
  );
}
