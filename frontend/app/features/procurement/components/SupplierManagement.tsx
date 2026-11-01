import React, { useState } from "react";
import { ErpDataTable, type ColumnDef } from "../../../components/ErpDataTable";
import { ErpSearchBar } from "../../../components/ErpSearchBar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../../../components/ui/dropdown-menu";
import { Building2, Plus, MoreHorizontal, Edit2, Trash2, Clock, Phone, Mail, MapPin } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../lib/api";
import { useLanguageStore, translations } from "../../../lib/i18n";
import { SupplierDialog } from "./SupplierDialog";
import type { Supplier } from "../types";

interface SupplierManagementProps {
  suppliers: Supplier[];
  onRefresh: () => void;
}

export function SupplierManagement({
  suppliers,
  onRefresh,
}: SupplierManagementProps) {
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;

  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.contact_person && s.contact_person.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.phone && s.phone.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleOpenCreate = () => {
    setSelectedSupplier(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (s: Supplier) => {
    setSelectedSupplier(s);
    setIsDialogOpen(true);
  };

  const handleDelete = async (s: Supplier) => {
    if (!confirm(t.supplierDeleteConfirm.replace("{name}", s.name))) return;
    try {
      await api.delete(`/suppliers/${s.id}`);
      toast.success(t.supplierDeleteSuccess);
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t.supplierDeleteError);
    }
  };

  const columns: ColumnDef<Supplier>[] = [
    {
      key: "name",
      label: t.supplierColName,
      renderCell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-slate-900 dark:text-white block">{row.name}</span>
            {row.contact_person && (
              <span className="text-[11px] text-slate-500">{t.supplierPicPrefix} {row.contact_person}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "contact",
      label: t.supplierColContact,
      renderCell: (row) => (
        <div className="text-xs space-y-0.5 text-slate-600 dark:text-slate-300">
          {row.phone && (
            <div className="flex items-center gap-1.5">
              <Phone className="w-3 h-3 text-slate-400" />
              <span>{row.phone}</span>
            </div>
          )}
          {row.email && (
            <div className="flex items-center gap-1.5">
              <Mail className="w-3 h-3 text-slate-400" />
              <span>{row.email}</span>
            </div>
          )}
          {row.address && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <MapPin className="w-3 h-3" />
              <span className="truncate max-w-[200px]">{row.address}</span>
            </div>
          )}
          {!row.phone && !row.email && !row.address && (
            <span className="text-slate-400 italic">-</span>
          )}
        </div>
      ),
    },
    {
      key: "terms",
      label: t.supplierColTerms,
      renderCell: (row) => (
        <div className="flex items-center gap-1 text-xs">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {row.payment_terms_days === 0
              ? t.supplierTermsCash
              : t.supplierTermsCredit.replace("{days}", String(row.payment_terms_days))}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      label: t.supplierColStatus,
      renderCell: (row) => (
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
            row.status === "active"
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          {row.status === "active" ? t.supplierStatusActive : t.supplierStatusInactive}
        </span>
      ),
    },
    {
      key: "actions",
      label: t.supplierColAction,
      align: "right",
      renderCell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            <MoreHorizontal className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => handleOpenEdit(row)} className="gap-2">
              <Edit2 className="w-3.5 h-3.5" />
              <span>{t.supplierActionEdit}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleDelete(row)}
              className="gap-2 text-rose-600 dark:text-rose-400"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t.supplierActionDelete}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Search Bar & Action Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1">
          <ErpSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t.supplierSearchPlaceholder}
          />
        </div>

        <button
          onClick={handleOpenCreate}
          className="h-11 inline-flex items-center justify-center gap-2 px-5 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs hover:opacity-90 active:scale-95 transition shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{t.supplierAddBtn}</span>
        </button>
      </div>

      {/* Data Table */}
      <ErpDataTable
        data={filteredSuppliers}
        columns={columns}
        keyExtractor={(item) => item.id}
        emptyText={t.supplierEmptyTable}
      />

      {/* Modal Dialog */}
      <SupplierDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        supplier={selectedSupplier}
        onSaved={onRefresh}
      />
    </div>
  );
}
