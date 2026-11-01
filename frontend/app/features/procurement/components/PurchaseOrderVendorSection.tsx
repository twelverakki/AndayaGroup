import React from "react";
import { DatePicker } from "../../../components/ui/date-picker";
import { Label } from "../../../components/ui/label";
import { Checkbox } from "../../../components/ui/checkbox";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupText,
} from "../../../components/ui/input-group";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../../../components/ui/select";
import {
  Building2,
  CalendarClock,
  FileText,
  Phone,
  User,
  UserPlus,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import type { OutletOption, Supplier } from "../types";

export interface PurchaseOrderVendorSectionProps {
  outlets: OutletOption[];
  suppliers: Supplier[];
  targetOutletId: string;
  onTargetOutletChange: (val: string) => void;
  supplierMode: "existing" | "new";
  onSupplierModeChange: (mode: "existing" | "new") => void;
  selectedSupplierId: string;
  onSelectExistingSupplier: (supplierId: string) => void;
  saveToMasterSupplier: boolean;
  onSaveToMasterSupplierChange: (val: boolean) => void;
  supplierNameInput: string;
  onSupplierNameChange: (val: string) => void;
  supplierContactInput: string;
  onSupplierContactChange: (val: string) => void;
  supplierPhoneInput: string;
  onSupplierPhoneChange: (val: string) => void;
  supplierPaymentTermsInput: number;
  onSupplierPaymentTermsChange: (days: number) => void;
  invoiceNoInput: string;
  onInvoiceNoChange: (val: string) => void;
  orderDateInput: string;
  onOrderDateChange: (val: string) => void;
  t: Record<string, string>;
}

export function PurchaseOrderVendorSection({
  outlets,
  suppliers,
  targetOutletId,
  onTargetOutletChange,
  supplierMode,
  onSupplierModeChange,
  selectedSupplierId,
  onSelectExistingSupplier,
  saveToMasterSupplier,
  onSaveToMasterSupplierChange,
  supplierNameInput,
  onSupplierNameChange,
  supplierContactInput,
  onSupplierContactChange,
  supplierPhoneInput,
  onSupplierPhoneChange,
  supplierPaymentTermsInput,
  onSupplierPaymentTermsChange,
  invoiceNoInput,
  onInvoiceNoChange,
  orderDateInput,
  onOrderDateChange,
  t,
}: PurchaseOrderVendorSectionProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Outlet Selection */}
      {outlets.length > 1 ? (
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {t.poTargetOutletLabel}
          </label>
          <Select value={targetOutletId} onValueChange={onTargetOutletChange}>
            <SelectTrigger className="h-10 w-full text-xs font-medium rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3.5">
              <SelectValue placeholder={t.poTargetOutletPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {outlets.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name} {o.is_main ? `(${t.poTargetOutletMain})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="h-10 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 sm:col-span-2 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">{t.poTargetOutletSingle}</span>
          <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-indigo-500" />
            {outlets[0]?.name || t.poTargetOutletMain}
          </span>
        </div>
      )}

      {/* Supplier Selection Mode */}
      <div className="sm:col-span-2 space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {t.poSupplierModeTitle}
          </label>
          <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
            <button
              type="button"
              onClick={() => onSupplierModeChange("existing")}
              className={cn(
                "px-3 py-1 rounded-lg font-bold transition cursor-pointer",
                supplierMode === "existing"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              {t.poSupplierExistingBtn}
            </button>
            <button
              type="button"
              onClick={() => onSupplierModeChange("new")}
              className={cn(
                "px-3 py-1 rounded-lg font-bold transition cursor-pointer",
                supplierMode === "new"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              {t.poSupplierNewBtn}
            </button>
          </div>
        </div>

        {supplierMode === "existing" && suppliers.length > 0 ? (
          <div className="space-y-2">
            <Select
              value={selectedSupplierId}
              onValueChange={onSelectExistingSupplier}
            >
              <SelectTrigger className="h-10 w-full text-xs font-medium rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3.5">
                <SelectValue placeholder={t.poSelectSupplierPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.payment_terms_days === 0 ? t.poPaymentTermsCash : t.poPaymentTermsCredit.replace("{days}", String(s.payment_terms_days))}) {s.phone ? `• ${s.phone}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5" /> {t.poNewSupplierCardTitle}
              </span>
              <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-300 font-medium text-xs">
                <Checkbox
                  checked={saveToMasterSupplier}
                  onCheckedChange={(val) => onSaveToMasterSupplierChange(!!val)}
                />
                {t.poSaveToMasterSupplier}
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.poSupplierNameLabel}
                </Label>
                <InputGroup>
                  <InputGroupAddon align="inline-start">
                    <Building2 className="size-4 text-slate-400" />
                  </InputGroupAddon>
                  <InputGroupInput
                    type="text"
                    value={supplierNameInput}
                    onChange={(e) => onSupplierNameChange(e.target.value)}
                    placeholder={t.poSupplierNamePlaceholder}
                  />
                </InputGroup>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.poSupplierContactLabel}
                </Label>
                <InputGroup>
                  <InputGroupAddon align="inline-start">
                    <User className="size-4 text-slate-400" />
                  </InputGroupAddon>
                  <InputGroupInput
                    type="text"
                    value={supplierContactInput}
                    onChange={(e) => onSupplierContactChange(e.target.value)}
                    placeholder={t.poSupplierContactPlaceholder}
                  />
                </InputGroup>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.poSupplierPhoneLabel}
                </Label>
                <InputGroup>
                  <InputGroupAddon align="inline-start">
                    <Phone className="size-4 text-slate-400" />
                  </InputGroupAddon>
                  <InputGroupInput
                    type="tel"
                    value={supplierPhoneInput}
                    onChange={(e) => onSupplierPhoneChange(e.target.value)}
                    placeholder={t.poSupplierPhonePlaceholder}
                  />
                </InputGroup>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.poSupplierTermsLabel}
                </Label>
                <InputGroup>
                  <InputGroupAddon align="inline-start">
                    <CalendarClock className="size-4 text-slate-400" />
                  </InputGroupAddon>
                  <InputGroupInput
                    type="number"
                    min="0"
                    value={supplierPaymentTermsInput || ""}
                    onChange={(e) => {
                      const days = parseInt(e.target.value) || 0;
                      onSupplierPaymentTermsChange(days);
                    }}
                    placeholder="0"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>{t.poSupplierTermsDays}</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Nomor Nota & Tanggal */}
      <div className="space-y-1.5 pt-2">
        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
          {t.poInvoiceNoLabel}
        </Label>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <FileText className="size-4 text-slate-400" />
          </InputGroupAddon>
          <InputGroupInput
            type="text"
            value={invoiceNoInput}
            onChange={(e) => onInvoiceNoChange(e.target.value)}
            placeholder={t.poInvoiceNoPlaceholder}
          />
        </InputGroup>
      </div>

      <div className="space-y-1.5 pt-2">
        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
          {t.poOrderDateLabel}
        </Label>
        <DatePicker
          value={orderDateInput}
          onChange={(val) => onOrderDateChange(val)}
          placeholder={t.poOrderDatePlaceholder}
          className="h-10 w-full rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
        />
      </div>
    </div>
  );
}
