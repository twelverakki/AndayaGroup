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
import { Building2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../lib/api";
import type { Supplier } from "../types";

interface SupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier | null;
  onSaved: (supplier?: Supplier) => void;
}

export function SupplierDialog({
  open,
  onOpenChange,
  supplier,
  onSaved,
}: SupplierDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
    payment_terms_days: 0,
    status: "active" as "active" | "inactive",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (supplier) {
        setFormData({
          name: supplier.name,
          contact_person: supplier.contact_person || "",
          phone: supplier.phone || "",
          email: supplier.email || "",
          address: supplier.address || "",
          payment_terms_days: supplier.payment_terms_days || 0,
          status: supplier.status || "active",
        });
      } else {
        setFormData({
          name: "",
          contact_person: "",
          phone: "",
          email: "",
          address: "",
          payment_terms_days: 0,
          status: "active",
        });
      }
    }
  }, [supplier, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Nama supplier / vendor wajib diisi");
      return;
    }

    setIsSubmitting(true);
    try {
      if (supplier) {
        const res = await api.put(`/suppliers/${supplier.id}`, formData);
        toast.success(`Supplier "${formData.name}" berhasil diperbarui`);
        onOpenChange(false);
        onSaved(res.data?.data);
      } else {
        const res = await api.post("/suppliers", formData);
        toast.success(`Supplier "${formData.name}" berhasil ditambahkan ke Master Data`);
        onOpenChange(false);
        onSaved(res.data?.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Gagal menyimpan supplier");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl p-6 bg-white dark:bg-[#1E1E22] border border-slate-200 dark:border-[#2E2E34] shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            {supplier ? "Edit Data Supplier" : "Tambah Master Supplier Baru"}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Kelola data vendor rekanan, kontak PIC, dan termin jatuh tempo pembayaran faktur.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Nama Supplier / Perusahaan *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="PT. Sumber Makmur Sejahtera"
              className="h-10 w-full px-3.5 rounded-xl text-xs bg-slate-50 dark:bg-[#1E1E22] border border-slate-200 dark:border-[#2E2E34] text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Nama Kontak PIC
              </label>
              <input
                type="text"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                placeholder="Bpk. Hendra"
                className="h-10 w-full px-3.5 rounded-xl text-xs bg-slate-50 dark:bg-[#1E1E22] border border-slate-200 dark:border-[#2E2E34] text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                No. WhatsApp / Telepon
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="08123456789"
                className="h-10 w-full px-3.5 rounded-xl text-xs bg-slate-50 dark:bg-[#1E1E22] border border-slate-200 dark:border-[#2E2E34] text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Email Vendor
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="sales@vendor.com"
                className="h-10 w-full px-3.5 rounded-xl text-xs bg-slate-50 dark:bg-[#1E1E22] border border-slate-200 dark:border-[#2E2E34] text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Termin Tempo (Hari)
              </label>
              <input
                type="number"
                min="0"
                value={formData.payment_terms_days}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    payment_terms_days: parseInt(e.target.value) || 0,
                  })
                }
                placeholder="0 = Tunai"
                className="h-10 w-full px-3.5 rounded-xl text-xs bg-slate-50 dark:bg-[#1E1E22] border border-slate-200 dark:border-[#2E2E34] text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Alamat Fisik Gudang / Kantor
            </label>
            <textarea
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Jl. Industri No. 88..."
              className="w-full p-3 rounded-xl text-xs bg-slate-50 dark:bg-[#1E1E22] border border-slate-200 dark:border-[#2E2E34] text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Status Kerjasama
            </label>
            <Select
              value={formData.status}
              onValueChange={(val: "active" | "inactive") =>
                setFormData({ ...formData, status: val })
              }
            >
              <SelectTrigger className="h-10 w-full px-3.5 text-xs font-medium rounded-xl bg-slate-50 dark:bg-[#1E1E22] border-slate-200 dark:border-[#2E2E34]">
                <SelectValue placeholder="Pilih Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Aktif (Bisa Order PO)</SelectItem>
                <SelectItem value="inactive">Non-aktif / Diberhentikan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.name.trim()}
              className="px-5 py-2.5 rounded-xl bg-[#E2FF66] text-slate-900 text-xs font-bold hover:brightness-95 disabled:opacity-50 transition shadow-sm"
            >
              {isSubmitting ? "Menyimpan..." : supplier ? "Simpan Perubahan" : "Tambah Supplier"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
