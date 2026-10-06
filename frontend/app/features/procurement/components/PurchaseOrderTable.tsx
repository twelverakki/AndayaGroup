import React, { useState, useMemo } from "react";
import { ErpDataTable, type ColumnDef } from "../../../components/ErpDataTable";
import { ErpSearchBar } from "../../../components/ErpSearchBar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../../../components/ui/dropdown-menu";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../../../components/ui/select";
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
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../lib/api";
import type { Purchase } from "../types";

interface PurchaseOrderTableProps {
  purchases: Purchase[];
  onOpenDetail: (purchase: Purchase) => void;
  onOpenPayment: (purchase: Purchase) => void;
  onRefresh: () => void;
}

export function PurchaseOrderTable({
  purchases,
  onOpenDetail,
  onOpenPayment,
  onRefresh,
}: PurchaseOrderTableProps) {
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
      toast.success("Barang berhasil diterima dan saldo stok bertambah!");
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Gagal mengonfirmasi penerimaan barang");
    }
  };

  const handleDeleteDraft = async (purchase: Purchase) => {
    if (!confirm(`Hapus draf faktur ${purchase.po_number}?`)) return;
    try {
      await api.delete(`/purchases/${purchase.id}`);
      toast.success("Draf PO berhasil dihapus");
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Gagal menghapus draf");
    }
  };

  const columns: ColumnDef<Purchase>[] = [
    {
      key: "po_number",
      label: "No. PO / Faktur",
      renderCell: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            {row.po_number}
          </span>
          {row.invoice_no && (
            <span className="text-[11px] text-slate-500 font-mono">
              Nota: {row.invoice_no}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "supplier",
      label: "Supplier & Cabang",
      renderCell: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {row.supplier_name}
          </span>
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <Building2 className="w-3 h-3 text-slate-400" />
            {row.outlet_name || "Gudang Pusat"}
          </span>
        </div>
      ),
    },
    {
      key: "order_date",
      label: "Tanggal & Tempo",
      renderCell: (row) => (
        <div className="flex flex-col text-xs text-slate-600 dark:text-slate-300">
          <span className="flex items-center gap-1 font-medium">
            <Calendar className="w-3 h-3 text-slate-400" />
            {new Date(row.order_date).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
          {row.due_date && row.payment_status !== "paid" && (
            <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" />
              Tempo: {new Date(row.due_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status Barang",
      renderCell: (row) => {
        if (row.status === "received") {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" /> Diterima (Stok Masuk)
            </span>
          );
        }
        if (row.status === "submitted") {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              <Truck className="w-3.5 h-3.5" /> PO Terbit (Inbound)
            </span>
          );
        }
        if (row.status === "cancelled") {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              <AlertCircle className="w-3.5 h-3.5" /> Dibatalkan
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <FileText className="w-3 h-3" /> Draf PO
          </span>
        );
      },
    },
    {
      key: "payment",
      label: "Status Pembayaran",
      renderCell: (row) => {
        if (row.payment_status === "paid") {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              <CheckCircle2 className="w-3 h-3" /> Lunas
            </span>
          );
        }
        if (row.payment_status === "partial") {
          return (
            <div className="flex flex-col text-xs">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                <CreditCard className="w-3 h-3" /> Cicilan (DP)
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 font-mono">
                Sisa: Rp {row.amount_owed.toLocaleString("id-ID")}
              </span>
            </div>
          );
        }
        return (
          <div className="flex flex-col text-xs">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
              <Clock className="w-3 h-3" /> Belum Dibayar
            </span>
            <span className="text-[10px] text-rose-600 font-mono mt-0.5">
              Hutang: Rp {row.amount_owed.toLocaleString("id-ID")}
            </span>
          </div>
        );
      },
    },
    {
      key: "total_amount",
      label: "Total Tagihan",
      renderCell: (row) => (
        <span className="font-bold text-slate-900 dark:text-white font-mono text-xs">
          Rp {row.total_amount.toLocaleString("id-ID")}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Aksi",
      align: "right",
      renderCell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            <MoreHorizontal className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => onOpenDetail(row)}>
              <Eye className="w-3.5 h-3.5 text-slate-500 mr-2" />
              <span>Lihat Detail Faktur</span>
            </DropdownMenuItem>

            {row.status !== "received" && row.status !== "cancelled" && (
              <DropdownMenuItem onClick={() => handleConfirmReceive(row)}>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mr-2" />
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Terima Barang (Stok Masuk)
                </span>
              </DropdownMenuItem>
            )}

            {row.amount_owed > 0 && (
              <DropdownMenuItem onClick={() => onOpenPayment(row)}>
                <CreditCard className="w-3.5 h-3.5 text-indigo-500 mr-2" />
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  Catat Pembayaran AP
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
                  <span>Hapus Draf PO</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Search & Status Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="w-full sm:w-80">
          <ErpSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Cari no. PO / supplier / nota... (/)"
            size="sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Barang Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-[38px] w-44 text-xs font-semibold rounded-xl bg-white dark:bg-[#1E1E22] border-slate-200 dark:border-[#2E2E34] text-slate-700 dark:text-slate-200 px-3.5">
              <SelectValue placeholder="Semua Status Fisik" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status Fisik</SelectItem>
              <SelectItem value="draft">Draf PO</SelectItem>
              <SelectItem value="submitted">PO Terbit (Inbound)</SelectItem>
              <SelectItem value="received">Diterima (Stok Masuk)</SelectItem>
              <SelectItem value="cancelled">Dibatalkan</SelectItem>
            </SelectContent>
          </Select>

          {/* Status Bayar Filter */}
          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="h-[38px] w-48 text-xs font-semibold rounded-xl bg-white dark:bg-[#1E1E22] border-slate-200 dark:border-[#2E2E34] text-slate-700 dark:text-slate-200 px-3.5">
              <SelectValue placeholder="Semua Status Bayar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status Bayar</SelectItem>
              <SelectItem value="unpaid">Belum Dibayar (Tempo)</SelectItem>
              <SelectItem value="partial">Cicilan (DP)</SelectItem>
              <SelectItem value="paid">Lunas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Table */}
      <ErpDataTable
        data={filteredPurchases}
        columns={columns}
        keyExtractor={(item) => item.id}
        onRowClick={onOpenDetail}
        emptyText="Belum ada transaksi faktur pembelian atau pesanan PO."
      />
    </div>
  );
}
