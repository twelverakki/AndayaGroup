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
import { Button } from "../../../components/ui/button";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupText,
  InputGroupTextarea,
} from "../../../components/ui/input-group";
import { Building2, User, Phone, Mail, CalendarClock, MapPin } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../lib/api";
import { useLanguageStore, translations } from "../../../lib/i18n";
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
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;

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
      toast.error(t.supplierDialogRequiredName);
      return;
    }

    setIsSubmitting(true);
    try {
      if (supplier) {
        const res = await api.put(`/suppliers/${supplier.id}`, formData);
        toast.success(t.supplierDialogUpdateSuccess.replace("{name}", formData.name));
        onOpenChange(false);
        onSaved(res.data?.data);
      } else {
        const res = await api.post("/suppliers", formData);
        toast.success(t.supplierDialogCreateSuccess.replace("{name}", formData.name));
        onOpenChange(false);
        onSaved(res.data?.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || t.supplierDialogSaveError);
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
            {supplier ? t.supplierDialogEditTitle : t.supplierDialogCreateTitle}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {t.supplierDialogDesc}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Nama Supplier */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {t.supplierDialogNameLabel} <span className="text-rose-500">*</span>
            </Label>
            <InputGroup>
              <InputGroupAddon align="inline-start">
                <Building2 className="size-4 text-slate-400" />
              </InputGroupAddon>
              <InputGroupInput
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="PT. Sumber Makmur Sejahtera"
              />
            </InputGroup>
          </div>

          {/* Kontak PIC & No Telepon */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.supplierDialogContactLabel}
              </Label>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <User className="size-4 text-slate-400" />
                </InputGroupAddon>
                <InputGroupInput
                  type="text"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  placeholder="Bpk. Hendra"
                />
              </InputGroup>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.supplierDialogPhoneLabel}
              </Label>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <Phone className="size-4 text-slate-400" />
                </InputGroupAddon>
                <InputGroupInput
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="08123456789"
                />
              </InputGroup>
            </div>
          </div>

          {/* Email & Termin Tempo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.supplierDialogEmailLabel}
              </Label>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <Mail className="size-4 text-slate-400" />
                </InputGroupAddon>
                <InputGroupInput
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="sales@vendor.com"
                />
              </InputGroup>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.supplierDialogTermsLabel}
              </Label>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <CalendarClock className="size-4 text-slate-400" />
                </InputGroupAddon>
                <InputGroupInput
                  type="number"
                  min="0"
                  value={formData.payment_terms_days || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      payment_terms_days: parseInt(e.target.value) || 0,
                    })
                  }
                  placeholder="0"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>{t.supplierDialogTermsUnit}</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
            </div>
          </div>

          {/* Alamat Fisik */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {t.supplierDialogAddressLabel}
            </Label>
            <InputGroup>
              <InputGroupAddon align="inline-start">
                <MapPin className="size-4 text-slate-400 self-start mt-2" />
              </InputGroupAddon>
              <InputGroupTextarea
                rows={2}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Jl. Industri No. 88..."
              />
            </InputGroup>
          </div>

          {/* Status Kerjasama */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {t.supplierDialogStatusLabel}
            </Label>
            <Select
              value={formData.status}
              onValueChange={(val: "active" | "inactive") =>
                setFormData({ ...formData, status: val })
              }
            >
              <SelectTrigger className="h-9 w-full px-3 text-xs font-medium rounded-lg bg-transparent border-input dark:bg-input/30">
                <SelectValue placeholder="Pilih Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t.supplierDialogStatusActive}</SelectItem>
                <SelectItem value="inactive">{t.supplierDialogStatusInactive}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              {t.supplierDialogCancel}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !formData.name.trim()}
              className="bg-[#E2FF66] text-slate-900 font-bold hover:brightness-95 disabled:opacity-50"
            >
              {isSubmitting
                ? t.supplierDialogSubmitting
                : supplier
                ? t.supplierDialogSubmitUpdate
                : t.supplierDialogSubmitCreate}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
