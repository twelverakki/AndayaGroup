import React, { useState, useEffect, useMemo } from "react";
import { CurrencyInput } from "../../../components/CurrencyInput";
import { ItemSelectorModal } from "../../../components/ItemSelectorModal";
import { QuickItemCreateDialog, type QuickCreatedItem } from "../../../components/QuickItemCreateDialog";
import { PurchaseOrderItemsTable } from "./PurchaseOrderItemsTable";
import { DatePicker } from "../../../components/ui/date-picker";
import { Input } from "../../../components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../../../components/ui/select";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Info,
  Package,
  PackagePlus,
  PackageX,
  Plus,
  RotateCcw,
  Save,
  Send,
  Trash2,
  UserPlus,
  Banknote,
  QrCode,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../lib/api";
import { cn } from "../../../lib/utils";
import { calculateLineSubtotal, calculateLinePhysicalCount } from "../utils/calculations";
import type { Supplier, ItemOption, OutletOption, LineItemInput } from "../types";

const PO_DRAFT_KEY = "andaya_po_draft_state";

interface PurchaseOrderFormProps {
  outlets: OutletOption[];
  suppliers: Supplier[];
  purchasableItems: ItemOption[];
  categories: Array<{ id: string; name: string }>;
  defaultOutletId?: string;
  isDirectPurchaseBlocked?: boolean;
  onBack: () => void;
  onSuccess: () => void;
  onRefreshSuppliers: () => void;
  onAddPurchasableItem: (item: ItemOption) => void;
}

export function PurchaseOrderForm({
  outlets,
  suppliers,
  purchasableItems,
  categories,
  defaultOutletId = "",
  isDirectPurchaseBlocked = false,
  onBack,
  onSuccess,
  onRefreshSuppliers,
  onAddPurchasableItem,
}: PurchaseOrderFormProps) {
  // Mode & Stepper
  const [createMode, setCreateMode] = useState<"wizard" | "classic">("wizard");
  const [wizardStep, setWizardStep] = useState<number>(1);

  // Target Location & Supplier
  const [targetOutletId, setTargetOutletId] = useState<string>(defaultOutletId);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [supplierNameInput, setSupplierNameInput] = useState<string>("");
  const [supplierMode, setSupplierMode] = useState<"existing" | "new">("existing");
  const [saveToMasterSupplier, setSaveToMasterSupplier] = useState<boolean>(true);
  const [supplierContactInput, setSupplierContactInput] = useState<string>("");
  const [supplierPhoneInput, setSupplierPhoneInput] = useState<string>("");
  const [supplierEmailInput, setSupplierEmailInput] = useState<string>("");
  const [supplierAddressInput, setSupplierAddressInput] = useState<string>("");
  const [supplierPaymentTermsInput, setSupplierPaymentTermsInput] = useState<number>(0);

  // Document metadata
  const [invoiceNoInput, setInvoiceNoInput] = useState<string>("");
  const [orderDateInput, setOrderDateInput] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [dueDateInput, setDueDateInput] = useState<string>("");
  const [paymentMethodInput, setPaymentMethodInput] = useState<"cash" | "bank_transfer" | "credit" | "qris">("cash");
  const [discountAmountInput, setDiscountAmountInput] = useState<number>(0);
  const [taxAmountInput, setTaxAmountInput] = useState<number>(0);
  const [taxMode, setTaxMode] = useState<"nominal" | "percent">("percent");
  const [taxPercent, setTaxPercent] = useState<number>(11);
  const [shippingCostInput, setShippingCostInput] = useState<number>(0);
  const [amountPaidInput, setAmountPaidInput] = useState<number>(0);
  const [paymentAdjustHint, setPaymentAdjustHint] = useState<string | null>(null);
  const [notesInput, setNotesInput] = useState<string>("");

  // Line items
  const [lineItems, setLineItems] = useState<LineItemInput[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Item Picker & Quick Create Modals
  const [isItemPickerOpen, setIsItemPickerOpen] = useState(false);
  const [isQuickItemCreateOpen, setIsQuickItemCreateOpen] = useState(false);
  const [quickItemInitialName, setQuickItemInitialName] = useState("");

  // Check LocalStorage Draft on mount
  const [hasSavedDraft, setHasSavedDraft] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PO_DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.lineItems && parsed.lineItems.length > 0) {
          setHasSavedDraft(true);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Autosave to LocalStorage when lineItems or supplier changes
  useEffect(() => {
    if (lineItems.length > 0 || supplierNameInput) {
      try {
        const stateToSave = {
          targetOutletId,
          selectedSupplierId,
          supplierNameInput,
          supplierMode,
          invoiceNoInput,
          orderDateInput,
          dueDateInput,
          paymentMethodInput,
          discountAmountInput,
          taxAmountInput,
          shippingCostInput,
          amountPaidInput,
          notesInput,
          lineItems,
        };
        localStorage.setItem(PO_DRAFT_KEY, JSON.stringify(stateToSave));
      } catch {
        // ignore
      }
    }
  }, [
    targetOutletId,
    selectedSupplierId,
    supplierNameInput,
    supplierMode,
    invoiceNoInput,
    orderDateInput,
    dueDateInput,
    paymentMethodInput,
    discountAmountInput,
    taxAmountInput,
    shippingCostInput,
    amountPaidInput,
    notesInput,
    lineItems,
  ]);

  const handleRestoreDraft = () => {
    try {
      const saved = localStorage.getItem(PO_DRAFT_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (parsed.targetOutletId) setTargetOutletId(parsed.targetOutletId);
      if (parsed.selectedSupplierId) setSelectedSupplierId(parsed.selectedSupplierId);
      if (parsed.supplierNameInput) setSupplierNameInput(parsed.supplierNameInput);
      if (parsed.supplierMode) setSupplierMode(parsed.supplierMode);
      if (parsed.invoiceNoInput) setInvoiceNoInput(parsed.invoiceNoInput);
      if (parsed.orderDateInput) setOrderDateInput(parsed.orderDateInput);
      if (parsed.dueDateInput) setDueDateInput(parsed.dueDateInput);
      if (parsed.paymentMethodInput) setPaymentMethodInput(parsed.paymentMethodInput);
      if (parsed.discountAmountInput) setDiscountAmountInput(parsed.discountAmountInput);
      if (parsed.taxAmountInput) setTaxAmountInput(parsed.taxAmountInput);
      if (parsed.shippingCostInput) setShippingCostInput(parsed.shippingCostInput);
      if (parsed.amountPaidInput) setAmountPaidInput(parsed.amountPaidInput);
      if (parsed.notesInput) setNotesInput(parsed.notesInput);
      if (parsed.lineItems) setLineItems(parsed.lineItems);

      toast.success("Draf PO berhasil dipulihkan!");
      setHasSavedDraft(false);
    } catch {
      toast.error("Gagal membaca draf tersimpan");
    }
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem(PO_DRAFT_KEY);
    setHasSavedDraft(false);
    toast.info("Draf PO sebelumnya telah dibuang");
  };

  // Selector format items
  const itemSelectorList = useMemo(() => {
    return purchasableItems.map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      category_name:
        item.category_name ||
        (item.item_type === "raw_material"
          ? "Bahan Baku"
          : item.item_type === "semi_finished"
          ? "Barang Setengah Jadi"
          : "Produk Jadi / Retail"),
      image_url: item.image_url,
      base_unit: item.base_unit,
      box_unit: item.box_unit,
      conversion_rate: item.conversion_rate,
      cost: item.standard_cost,
      price: item.standard_cost,
    }));
  }, [purchasableItems]);

  const handleApplySelectedItems = (selectedIds: string[]) => {
    setLineItems((prev) => {
      const updated: LineItemInput[] = [];

      for (const line of prev) {
        if (selectedIds.includes(line.item_id)) {
          updated.push(line);
        }
      }

      for (const id of selectedIds) {
        if (!updated.some((u) => u.item_id === id)) {
          const it = purchasableItems.find((i) => i.id === id);
          if (it) {
            const hasDualUom = Boolean(it.box_unit && it.conversion_rate > 1);
            const defaultPcsCost = it.standard_cost || 0;
            const defaultBoxCost = hasDualUom
              ? (it.standard_cost || 0) * it.conversion_rate
              : it.standard_cost || 0;

            updated.push({
              item_id: it.id,
              item_name: it.name,
              sku: it.sku,
              base_unit: it.base_unit || "pcs",
              box_unit: it.box_unit || undefined,
              conversion_rate: it.conversion_rate || 1,
              has_dual_uom: hasDualUom,
              qty_box: hasDualUom ? 1 : 0,
              box_cost: defaultBoxCost,
              qty_pcs: hasDualUom ? 0 : 1,
              pcs_cost: defaultPcsCost,
              uom: hasDualUom ? "box" : "base",
              qty_ordered: 1,
              unit_cost: hasDualUom ? defaultBoxCost : defaultPcsCost,
              discount_amount: 0,
            });
          }
        }
      }

      return updated;
    });
    setIsItemPickerOpen(false);
  };

  const handleQuickItemCreated = (newItem: QuickCreatedItem) => {
    const itemOpt: ItemOption = {
      id: newItem.id,
      name: newItem.name,
      sku: newItem.sku || "",
      item_type: newItem.item_type || "finished_good",
      base_unit: newItem.base_unit || "pcs",
      box_unit: newItem.box_unit || "",
      conversion_rate: newItem.conversion_rate || 1,
      standard_cost: newItem.standard_cost || 0,
      allow_branch_purchase: true,
      category_name: categories.find((c) => c.id === newItem.category_id)?.name,
    };
    onAddPurchasableItem(itemOpt);

    const isDualUom = (itemOpt.conversion_rate || 1) > 1 && !!itemOpt.box_unit;
    const defaultPcsCost = itemOpt.standard_cost || 0;
    const defaultBoxCost = isDualUom
      ? (itemOpt.standard_cost || 0) * (itemOpt.conversion_rate || 1)
      : itemOpt.standard_cost || 0;

    const newLineItem: LineItemInput = {
      item_id: itemOpt.id,
      item_name: itemOpt.name,
      sku: itemOpt.sku,
      base_unit: itemOpt.base_unit,
      box_unit: itemOpt.box_unit,
      conversion_rate: itemOpt.conversion_rate,
      has_dual_uom: isDualUom,
      qty_box: isDualUom ? 1 : 0,
      box_cost: defaultBoxCost,
      qty_pcs: isDualUom ? 0 : 1,
      pcs_cost: defaultPcsCost,
      uom: isDualUom ? "box" : "base",
      qty_ordered: 1,
      unit_cost: isDualUom ? defaultBoxCost : defaultPcsCost,
      discount_amount: 0,
    };

    setLineItems((prev) => {
      const exists = prev.find((p) => p.item_id === itemOpt.id);
      if (exists) return prev;
      return [...prev, newLineItem];
    });

    setIsItemPickerOpen(false);
  };

  const handleUpdateLineItem = (
    index: number,
    field: keyof LineItemInput,
    value: any
  ) => {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Financial summary
  const formSubtotal = useMemo(() => {
    return lineItems.reduce((acc, item) => acc + calculateLineSubtotal(item), 0);
  }, [lineItems]);

  // Recalculate tax if mode is percent
  const handleTaxPercentChange = (pct: number) => {
    setTaxPercent(pct);
    const base = formSubtotal - discountAmountInput;
    const calculated = base > 0 ? Math.round(base * (pct / 100)) : 0;
    setTaxAmountInput(calculated);
  };

  const handleTaxModeToggle = (mode: "nominal" | "percent") => {
    setTaxMode(mode);
    if (mode === "percent") {
      const base = formSubtotal - discountAmountInput;
      const calculated = base > 0 ? Math.round(base * (taxPercent / 100)) : 0;
      setTaxAmountInput(calculated);
    }
  };

  // Sync percent tax when subtotal or discount changes
  useEffect(() => {
    if (taxMode === "percent") {
      const base = formSubtotal - discountAmountInput;
      const calculated = base > 0 ? Math.round(base * (taxPercent / 100)) : 0;
      setTaxAmountInput(calculated);
    }
  }, [formSubtotal, discountAmountInput, taxMode, taxPercent]);

  const formTotalAmount = useMemo(() => {
    const total = formSubtotal - discountAmountInput + taxAmountInput + shippingCostInput;
    return total > 0 ? total : 0;
  }, [formSubtotal, discountAmountInput, taxAmountInput, shippingCostInput]);

  const formAmountOwed = useMemo(() => {
    const owed = formTotalAmount - amountPaidInput;
    return owed > 0 ? owed : 0;
  }, [formTotalAmount, amountPaidInput]);

  const handleAmountPaidChange = (val: number) => {
    if (val > formTotalAmount && formTotalAmount > 0) {
      setAmountPaidInput(formTotalAmount);
      setPaymentAdjustHint(
        `Nominal disesuaikan ke Rp ${formTotalAmount.toLocaleString("id-ID")} sesuai Total Tagihan PO.`
      );
      if (paymentMethodInput === "credit") {
        setPaymentMethodInput("bank_transfer");
      }
    } else {
      setAmountPaidInput(val);
      setPaymentAdjustHint(null);
      if (val >= formTotalAmount && formTotalAmount > 0 && paymentMethodInput === "credit") {
        setPaymentMethodInput("bank_transfer");
      }
    }
  };

  const handleSubmit = async (targetStatus: "draft" | "submitted" | "received") => {
    if (lineItems.length === 0) {
      toast.error("Tambahkan minimal 1 item barang belanja");
      return;
    }
    if (amountPaidInput > formTotalAmount) {
      toast.error(
        `Jumlah pembayaran (Rp ${amountPaidInput.toLocaleString("id-ID")}) melebihi total tagihan (Rp ${formTotalAmount.toLocaleString("id-ID")})`
      );
      return;
    }
    if (amountPaidInput < 0) {
      toast.error("Nominal pembayaran tidak boleh kurang dari 0");
      return;
    }

    let finalSupplierId = selectedSupplierId || undefined;
    let finalSupplierName = supplierNameInput.trim();

    if (supplierMode === "existing") {
      const s = suppliers.find((sup) => sup.id === selectedSupplierId);
      if (!s) {
        toast.error("Pilih supplier terdaftar atau beralih ke 'Buat Supplier Baru'");
        return;
      }
      finalSupplierId = s.id;
      finalSupplierName = s.name;
    } else {
      if (!finalSupplierName) {
        toast.error("Nama supplier baru wajib diisi");
        return;
      }
      if (saveToMasterSupplier) {
        try {
          const supRes = await api.post("/suppliers", {
            name: finalSupplierName,
            contact_person: supplierContactInput.trim() || undefined,
            phone: supplierPhoneInput.trim() || undefined,
            email: supplierEmailInput.trim() || undefined,
            address: supplierAddressInput.trim() || undefined,
            payment_terms_days: supplierPaymentTermsInput || 0,
            status: "active",
          });
          if (supRes.data.data) {
            finalSupplierId = supRes.data.data.id;
            onRefreshSuppliers();
          }
        } catch (supErr) {
          console.warn("Auto-create supplier notice:", supErr);
        }
      }
    }

    const itemsPayload: any[] = [];
    for (const l of lineItems) {
      if (l.has_dual_uom) {
        if (l.qty_box > 0) {
          itemsPayload.push({
            item_id: l.item_id,
            uom: "box",
            qty_ordered: l.qty_box,
            conversion_rate: l.conversion_rate,
            unit_cost: l.box_cost,
            discount_amount: l.qty_pcs > 0 ? 0 : l.discount_amount || 0,
            notes: l.notes || undefined,
          });
        }
        if (l.qty_pcs > 0) {
          itemsPayload.push({
            item_id: l.item_id,
            uom: "base",
            qty_ordered: l.qty_pcs,
            conversion_rate: 1,
            unit_cost: l.pcs_cost,
            discount_amount: l.discount_amount || 0,
            notes: l.notes || undefined,
          });
        }
        if (l.qty_box === 0 && l.qty_pcs === 0) {
          itemsPayload.push({
            item_id: l.item_id,
            uom: "base",
            qty_ordered: 1,
            conversion_rate: 1,
            unit_cost: l.pcs_cost,
            discount_amount: l.discount_amount || 0,
            notes: l.notes || undefined,
          });
        }
      } else {
        const qty = l.qty_pcs > 0 ? l.qty_pcs : l.qty_ordered || 1;
        const cost = l.pcs_cost > 0 ? l.pcs_cost : l.unit_cost || 0;
        itemsPayload.push({
          item_id: l.item_id,
          uom: "base",
          qty_ordered: qty,
          conversion_rate: 1,
          unit_cost: cost,
          discount_amount: l.discount_amount || 0,
          notes: l.notes || undefined,
        });
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        outlet_id: targetOutletId,
        supplier_id: finalSupplierId,
        supplier_name: finalSupplierName,
        invoice_no: invoiceNoInput || undefined,
        status: targetStatus,
        payment_status: formAmountOwed === 0 ? "paid" : amountPaidInput > 0 ? "partial" : "unpaid",
        payment_method: paymentMethodInput,
        order_date: orderDateInput,
        due_date: dueDateInput || undefined,
        subtotal_amount: formSubtotal,
        discount_amount: discountAmountInput,
        tax_amount: taxAmountInput,
        shipping_cost: shippingCostInput,
        total_amount: formTotalAmount,
        amount_paid: amountPaidInput,
        notes: notesInput || undefined,
        items: itemsPayload,
      };

      await api.post("/purchases", payload);

      if (targetStatus === "draft") {
        toast.success("Draf faktur pembelian berhasil disimpan");
      } else if (targetStatus === "received") {
        toast.success("Pembelian langsung berhasil dicatat dan stok telah bertambah!");
      } else {
        toast.success("Faktur pesanan PO berhasil diterbitkan (Inbound)");
      }

      // Cleanup saved draft
      localStorage.removeItem(PO_DRAFT_KEY);
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Gagal membuat faktur pembelian");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 w-full animate-in fade-in-50 duration-200">
      {/* 🚀 RULE 17: FRAMELESS HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200/80 dark:border-[#2E2E34] gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Form Pengadaan & Pembelian Barang
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Pilih supplier, masukkan barang kulakan/pesanan, dan atur termin pembayaran.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle Wizard vs Classic Mode */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setCreateMode("wizard")}
              className={cn(
                "px-3 py-1.5 rounded-lg font-bold transition cursor-pointer",
                createMode === "wizard"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              Mode Wizard
            </button>
            <button
              type="button"
              onClick={() => setCreateMode("classic")}
              className={cn(
                "px-3 py-1.5 rounded-lg font-bold transition cursor-pointer",
                createMode === "classic"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              Mode Formulir Lengkap
            </button>
          </div>
        </div>
      </div>

      {/* 💾 DRAFT RECOVERY BANNER */}
      {hasSavedDraft && (
        <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-between text-xs animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-medium">
            <Save className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>Ditemukan draf pengadaan sebelumnya yang tersimpan di memori lokal.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRestoreDraft}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition cursor-pointer"
            >
              Pulihkan Draf
            </button>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition cursor-pointer"
            >
              Buang
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🧙 MODE 1: WIZARD STEP-BY-STEP */}
      {/* ========================================================================= */}
      {createMode === "wizard" ? (
        <div className="space-y-6">
          {/* Stepper Progress Bar */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { num: 1, label: "1. Info Supplier & Cabang", icon: Building2 },
              { num: 2, label: "2. Pilih Barang & Qty", icon: Package },
              { num: 3, label: "3. Finansial & Penerbitan", icon: DollarSign },
            ].map((s) => {
              const Icon = s.icon;
              const isPassed = wizardStep > s.num;
              const isCurrent = wizardStep === s.num;
              return (
                <div
                  key={s.num}
                  onClick={() => isPassed && setWizardStep(s.num)}
                  className={cn(
                    "p-3.5 rounded-2xl border transition-all flex items-center gap-3 select-none",
                    isCurrent
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-sm"
                      : isPassed
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 cursor-pointer hover:brightness-95"
                      : "bg-white dark:bg-[#1E1E22] border-slate-200/80 dark:border-[#2E2E34] text-slate-400"
                  )}
                >
                  <div
                    className={cn(
                      "w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0",
                      isCurrent
                        ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900"
                        : isPassed
                        ? "bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                    )}
                  >
                    {isPassed ? <Check className="w-4 h-4" /> : s.num}
                  </div>
                  <div className="truncate">
                    <span className="text-xs font-bold block truncate">{s.label}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Wizard Step 1: Supplier & Outlet */}
          {wizardStep === 1 && (
            <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-sm space-y-6 animate-in fade-in-50">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  Langkah 1: Tentukan Supplier & Lokasi Penerima
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pilih supplier rekanan bisnis atau input data supplier baru secara langsung.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Outlet Selection */}
                {outlets.length > 1 ? (
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Outlet / Lokasi Penerima Barang *
                    </label>
                    <Select value={targetOutletId} onValueChange={setTargetOutletId}>
                      <SelectTrigger className="h-10 w-full text-xs font-medium rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3.5">
                        <SelectValue placeholder="Pilih Lokasi Outlet" />
                      </SelectTrigger>
                      <SelectContent>
                        {outlets.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name} {o.is_main ? "(Gudang Utama / Pusat)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="h-10 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 sm:col-span-2 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Lokasi Penerima Stok Masuk:</span>
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                      {outlets[0]?.name || "Gudang Utama / Pusat"}
                    </span>
                  </div>
                )}

                {/* Supplier Selection Mode */}
                <div className="sm:col-span-2 space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Pilihan Supplier / Vendor Rekanan *
                    </label>
                    <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
                      <button
                        type="button"
                        onClick={() => setSupplierMode("existing")}
                        className={cn(
                          "px-3 py-1 rounded-lg font-bold transition cursor-pointer",
                          supplierMode === "existing"
                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        )}
                      >
                        Pilih Supplier Terdaftar
                      </button>
                      <button
                        type="button"
                        onClick={() => setSupplierMode("new")}
                        className={cn(
                          "px-3 py-1 rounded-lg font-bold transition cursor-pointer",
                          supplierMode === "new"
                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        )}
                      >
                        + Input Supplier Baru
                      </button>
                    </div>
                  </div>

                  {supplierMode === "existing" && suppliers.length > 0 ? (
                    <div className="space-y-2">
                      <Select
                        value={selectedSupplierId}
                        onValueChange={(val) => {
                          setSelectedSupplierId(val);
                          const s = suppliers.find((sup) => sup.id === val);
                          if (s) {
                            setSupplierNameInput(s.name);
                            if (s.payment_terms_days > 0) {
                              const d = new Date();
                              d.setDate(d.getDate() + s.payment_terms_days);
                              setDueDateInput(d.toISOString().split("T")[0]);
                            }
                          }
                        }}
                      >
                        <SelectTrigger className="h-10 w-full text-xs font-medium rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3.5">
                          <SelectValue placeholder="-- Pilih Supplier Terdaftar --" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name} ({s.payment_terms_days === 0 ? "Tunai/COD" : `Tempo ${s.payment_terms_days} hr`}) {s.phone ? `• ${s.phone}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                          <UserPlus className="w-3.5 h-3.5" /> Form Input Supplier Baru
                        </span>
                        <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-300 font-medium text-xs">
                          <input
                            type="checkbox"
                            checked={saveToMasterSupplier}
                            onChange={(e) => setSaveToMasterSupplier(e.target.checked)}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          Simpan ke Master Supplier
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            Nama Supplier / Perusahaan *
                          </label>
                          <input
                            type="text"
                            value={supplierNameInput}
                            onChange={(e) => setSupplierNameInput(e.target.value)}
                            placeholder="PT. Sinar Abadi..."
                            className="h-10 w-full px-3.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            Nama Kontak PIC
                          </label>
                          <input
                            type="text"
                            value={supplierContactInput}
                            onChange={(e) => setSupplierContactInput(e.target.value)}
                            placeholder="Bpk. Budi..."
                            className="h-10 w-full px-3.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            No. WhatsApp / Telepon
                          </label>
                          <input
                            type="text"
                            value={supplierPhoneInput}
                            onChange={(e) => setSupplierPhoneInput(e.target.value)}
                            placeholder="081234567..."
                            className="h-10 w-full px-3.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            Termin Jatuh Tempo (Hari)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={supplierPaymentTermsInput}
                            onChange={(e) => {
                              const days = parseInt(e.target.value) || 0;
                              setSupplierPaymentTermsInput(days);
                              if (days > 0) {
                                const d = new Date();
                                d.setDate(d.getDate() + days);
                                setDueDateInput(d.toISOString().split("T")[0]);
                              }
                            }}
                            placeholder="0 = Tunai"
                            className="h-10 w-full px-3.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Nomor Nota & Tanggal */}
                <div className="space-y-1.5 pt-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    No. Nota / Faktur Fisik Supplier (Opsional)
                  </label>
                  <input
                    type="text"
                    value={invoiceNoInput}
                    onChange={(e) => setInvoiceNoInput(e.target.value)}
                    placeholder="INV/2026/09/001"
                    className="h-10 w-full px-3.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="space-y-1.5 pt-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tanggal Transaksi / Pembelian *
                  </label>
                  <DatePicker
                    value={orderDateInput}
                    onChange={(val) => setOrderDateInput(val)}
                    placeholder="Pilih tanggal pembelian..."
                    className="h-10 w-full rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              {/* Step 1 Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    if (supplierMode === "existing" && !selectedSupplierId) {
                      toast.error("Pilih supplier terlebih dahulu");
                      return;
                    }
                    if (supplierMode === "new" && !supplierNameInput.trim()) {
                      toast.error("Nama supplier wajib diisi");
                      return;
                    }
                    setWizardStep(2);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs hover:opacity-90 transition cursor-pointer"
                >
                  <span>Lanjut ke Pilih Barang</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Wizard Step 2: Line Items */}
          {wizardStep === 2 && (
            <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-sm space-y-6 animate-in fade-in-50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 gap-3">
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">
                    Langkah 2: Pilih & Atur Barang Belanja
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Supplier: <strong>{supplierMode === "existing" ? suppliers.find((s) => s.id === selectedSupplierId)?.name : supplierNameInput}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setQuickItemInitialName("");
                      setIsQuickItemCreateOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs border border-amber-500/20 hover:bg-amber-500/20 transition cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>+ Barang Kilat</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsItemPickerOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs hover:opacity-90 transition shadow-sm cursor-pointer"
                  >
                    <PackagePlus className="w-4 h-4" />
                    <span>{lineItems.length === 0 ? "Buka Katalog Barang" : "+ Ubah Pilihan Barang"}</span>
                  </button>
                </div>
              </div>

              {/* Line Items Table (Single Shared Header, Zero Redundant Repetition) */}
              <PurchaseOrderItemsTable
                lineItems={lineItems}
                onUpdateLineItem={handleUpdateLineItem}
                onRemoveLineItem={handleRemoveLineItem}
                onOpenItemPicker={() => setIsItemPickerOpen(true)}
              />

              {/* Step 2 Actions */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setWizardStep(1)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Kembali ke Info Supplier</span>
                </button>

                <button
                  type="button"
                  disabled={lineItems.length === 0}
                  onClick={() => setWizardStep(3)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs hover:opacity-90 disabled:opacity-50 transition cursor-pointer"
                >
                  <span>Lanjut ke Ringkasan Finansial</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Wizard Step 3: Financial & Submission */}
          {wizardStep === 3 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in-50">
              {/* Financial Inputs */}
              <div className="lg:col-span-2 space-y-6">
                <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    Penyesuaian Biaya & Pembayaran
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="text-slate-600 dark:text-slate-300 block mb-1 font-bold">
                        Diskon Global Faktur (Rp)
                      </label>
                      <CurrencyInput
                        value={discountAmountInput}
                        onChange={setDiscountAmountInput}
                        className="h-10 w-full text-xs font-medium"
                        placeholder="0"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-slate-600 dark:text-slate-300 font-bold">
                          PPN Masukan
                        </label>
                        <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5">
                          <button
                            type="button"
                            onClick={() => handleTaxModeToggle("nominal")}
                            className={cn(
                              "px-2 py-0.5 text-[10px] font-bold rounded-md transition cursor-pointer",
                              taxMode === "nominal"
                                ? "bg-white dark:bg-[#1E1E22] text-slate-900 dark:text-white shadow-xs"
                                : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                            )}
                          >
                            Rp
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTaxModeToggle("percent")}
                            className={cn(
                              "px-2 py-0.5 text-[10px] font-bold rounded-md transition cursor-pointer",
                              taxMode === "percent"
                                ? "bg-white dark:bg-[#1E1E22] text-slate-900 dark:text-white shadow-xs"
                                : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                            )}
                          >
                            %
                          </button>
                        </div>
                      </div>

                      {taxMode === "nominal" ? (
                        <CurrencyInput
                          value={taxAmountInput}
                          onChange={setTaxAmountInput}
                          className="h-10 w-full text-xs font-medium"
                          placeholder="0"
                        />
                      ) : (
                        <div className="space-y-1">
                          <div className="relative flex items-center">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={taxPercent}
                              onChange={(e) => handleTaxPercentChange(parseFloat(e.target.value) || 0)}
                              className="h-10 w-full pr-8 text-xs font-bold bg-white dark:bg-slate-800"
                            />
                            <span className="absolute right-3 text-xs font-bold text-slate-400 select-none pointer-events-none">
                              %
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>= Rp {taxAmountInput.toLocaleString("id-ID")}</span>
                            <div className="flex gap-1">
                              {[0, 11, 12].map((p) => (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={() => handleTaxPercentChange(p)}
                                  className={cn(
                                    "px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition",
                                    taxPercent === p
                                      ? "bg-indigo-600 text-white"
                                      : "bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300"
                                  )}
                                >
                                  {p}%
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-slate-600 dark:text-slate-300 block mb-1 font-bold">
                        Ongkos Kirim / Ekspedisi (Rp)
                      </label>
                      <CurrencyInput
                        value={shippingCostInput}
                        onChange={setShippingCostInput}
                        className="h-10 w-full text-xs font-medium"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Payment Method 4-Tile Radio */}
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Metode Pembayaran *
                      </label>
                      {paymentMethodInput === "credit" && (
                        <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                          Tempo: Metode bayar riil dipilih saat pelunasan utang nanti
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: "cash", label: "Tunai", icon: Banknote },
                        { id: "bank_transfer", label: "Transfer Bank", icon: Building2 },
                        { id: "qris", label: "QRIS", icon: QrCode },
                        { id: "credit", label: "Tempo (AP)", icon: Clock },
                      ].map((item) => {
                        const Icon = item.icon;
                        const isSelected = paymentMethodInput === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setPaymentMethodInput(item.id as any);
                              if (item.id === "credit" && amountPaidInput === formTotalAmount) {
                                setAmountPaidInput(0);
                              }
                            }}
                            className={cn(
                              "flex items-center gap-2 h-11 px-3 rounded-xl border text-left transition cursor-pointer",
                              isSelected
                                ? "border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 font-bold ring-1 ring-indigo-600"
                                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                            )}
                          >
                            <Icon className={cn("w-4 h-4 shrink-0", isSelected ? "text-indigo-600" : "text-slate-400")} />
                            <span className="text-xs truncate">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Payment Amount with Quick Action Chips */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                        Jumlah Uang Dibayar Saat Ini ({paymentMethodInput === "credit" ? "Uang Muka / DP" : "DP / Lunas"}):
                      </label>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {paymentMethodInput !== "credit" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleAmountPaidChange(formTotalAmount)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-bold hover:bg-emerald-500/20 active:scale-95 transition cursor-pointer"
                            >
                              Bayar Lunas (100%)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAmountPaidChange(Math.round(formTotalAmount * 0.5))}
                              className="px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30 text-[11px] font-bold hover:bg-indigo-500/20 active:scale-95 transition cursor-pointer"
                            >
                              DP 50%
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentMethodInput("credit");
                                setAmountPaidInput(0);
                              }}
                              className="px-2 py-1 rounded-lg bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold hover:bg-slate-300 active:scale-95 transition cursor-pointer"
                            >
                              Tempo (0)
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleAmountPaidChange(Math.round(formTotalAmount * 0.2))}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[11px] font-bold hover:bg-amber-500/20 active:scale-95 transition cursor-pointer"
                            >
                              DP 20%
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAmountPaidChange(Math.round(formTotalAmount * 0.5))}
                              className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30 text-[11px] font-bold hover:bg-indigo-500/20 active:scale-95 transition cursor-pointer"
                            >
                              DP 50%
                            </button>
                            <button
                              type="button"
                              onClick={() => setAmountPaidInput(0)}
                              className="px-2 py-1 rounded-lg bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold hover:bg-slate-300 active:scale-95 transition cursor-pointer"
                            >
                              Tanpa DP (0)
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="relative">
                      <CurrencyInput
                        value={amountPaidInput}
                        onChange={handleAmountPaidChange}
                        max={formTotalAmount > 0 ? formTotalAmount : undefined}
                        onMaxExceeded={(maxVal) => {
                          setPaymentAdjustHint(
                            `Nominal otomatis dikunci ke Rp ${maxVal.toLocaleString("id-ID")} sesuai Total Tagihan PO.`
                          );
                          if (paymentMethodInput === "credit") {
                            setPaymentMethodInput("bank_transfer");
                          }
                        }}
                        className="h-11 w-full text-base font-bold"
                        placeholder="0"
                      />
                      {paymentAdjustHint && (
                        <div className="mt-1.5 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2 animate-in fade-in-50">
                          <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <span>{paymentAdjustHint}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold pt-1">
                      <span className="text-rose-600 dark:text-rose-400">Sisa Hutang Dagang (AP):</span>
                      <span className="text-rose-600 dark:text-rose-400 font-mono text-sm">
                        Rp {formAmountOwed.toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Catatan Tambahan & Instruksi Khusus
                    </label>
                    <textarea
                      rows={2}
                      value={notesInput}
                      onChange={(e) => setNotesInput(e.target.value)}
                      placeholder="Instruksi pengiriman, kontak supir, no resi, dll..."
                      className="w-full p-3 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>
              </div>

              {/* Summary Card & 1-Tap Execution */}
              <div className="space-y-4">
                <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Ringkasan Tagihan
                  </h3>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Total Item ({lineItems.length} barang):</span>
                      <span>Rp {formSubtotal.toLocaleString("id-ID")}</span>
                    </div>
                    {discountAmountInput > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Diskon:</span>
                        <span>- Rp {discountAmountInput.toLocaleString("id-ID")}</span>
                      </div>
                    )}
                    {shippingCostInput > 0 && (
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Ongkos Kirim:</span>
                        <span>Rp {shippingCostInput.toLocaleString("id-ID")}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-black text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                      <span>Total Faktur:</span>
                      <span>Rp {formTotalAmount.toLocaleString("id-ID")}</span>
                    </div>
                  </div>

                  <div className="pt-2 space-y-2">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleSubmit("received")}
                      className="w-full py-3 rounded-xl bg-[#E2FF66] text-slate-900 font-bold text-xs hover:brightness-95 active:scale-95 transition disabled:opacity-50 shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Beli Langsung (Stok Masuk)</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleSubmit("submitted")}
                      className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>Terbitkan PO Resmi (Inbound)</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleSubmit("draft")}
                      className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>Simpan Draf Saja</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* 📋 MODE 2: CLASSIC ALL-IN-ONE FORM */
        /* ========================================================================= */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Vendor & Items */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-500" />
                Informasi Supplier & Lokasi Penerima
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {outlets.length > 1 ? (
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Outlet / Lokasi Penerima Barang *
                    </label>
                    <Select value={targetOutletId} onValueChange={setTargetOutletId}>
                      <SelectTrigger className="h-10 w-full text-xs font-medium rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3.5">
                        <SelectValue placeholder="Pilih Lokasi Outlet" />
                      </SelectTrigger>
                      <SelectContent>
                        {outlets.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name} {o.is_main ? "(Gudang Utama / Pusat)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="h-10 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 sm:col-span-2 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Lokasi Penerima Stok Masuk:</span>
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                      {outlets[0]?.name || "Gudang Utama / Pusat"}
                    </span>
                  </div>
                )}

                {/* Supplier Mode */}
                <div className="sm:col-span-2 space-y-3 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Supplier / Vendor Rekanan *
                    </label>
                    <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
                      <button
                        type="button"
                        onClick={() => setSupplierMode("existing")}
                        className={cn(
                          "px-3 py-1 rounded-lg font-bold transition cursor-pointer",
                          supplierMode === "existing"
                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        )}
                      >
                        Pilih Supplier Terdaftar
                      </button>
                      <button
                        type="button"
                        onClick={() => setSupplierMode("new")}
                        className={cn(
                          "px-3 py-1 rounded-lg font-bold transition cursor-pointer",
                          supplierMode === "new"
                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        )}
                      >
                        + Input Supplier Baru
                      </button>
                    </div>
                  </div>

                  {supplierMode === "existing" && suppliers.length > 0 ? (
                    <Select
                      value={selectedSupplierId}
                      onValueChange={(val) => {
                        setSelectedSupplierId(val);
                        const s = suppliers.find((sup) => sup.id === val);
                        if (s) {
                          setSupplierNameInput(s.name);
                          if (s.payment_terms_days > 0) {
                            const d = new Date();
                            d.setDate(d.getDate() + s.payment_terms_days);
                            setDueDateInput(d.toISOString().split("T")[0]);
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="h-10 w-full text-xs font-medium rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3.5">
                        <SelectValue placeholder="-- Pilih Supplier Terdaftar --" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} ({s.payment_terms_days === 0 ? "Tunai/COD" : `Tempo ${s.payment_terms_days} hr`}) {s.phone ? `• ${s.phone}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                          <UserPlus className="w-3.5 h-3.5" /> Form Lengkap Supplier Baru
                        </span>
                        <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-300 font-medium text-xs">
                          <input
                            type="checkbox"
                            checked={saveToMasterSupplier}
                            onChange={(e) => setSaveToMasterSupplier(e.target.checked)}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          Simpan ke Master Supplier
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            Nama Supplier / Perusahaan *
                          </label>
                          <input
                            type="text"
                            value={supplierNameInput}
                            onChange={(e) => setSupplierNameInput(e.target.value)}
                            placeholder="PT. Sinar Abadi..."
                            className="h-10 w-full px-3.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            Nama Kontak PIC
                          </label>
                          <input
                            type="text"
                            value={supplierContactInput}
                            onChange={(e) => setSupplierContactInput(e.target.value)}
                            placeholder="Bpk. Budi..."
                            className="h-10 w-full px-3.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            No. WhatsApp / Telepon
                          </label>
                          <input
                            type="text"
                            value={supplierPhoneInput}
                            onChange={(e) => setSupplierPhoneInput(e.target.value)}
                            placeholder="081234567..."
                            className="h-10 w-full px-3.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            Termin Jatuh Tempo (Hari)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={supplierPaymentTermsInput}
                            onChange={(e) => {
                              const days = parseInt(e.target.value) || 0;
                              setSupplierPaymentTermsInput(days);
                              if (days > 0) {
                                const d = new Date();
                                d.setDate(d.getDate() + days);
                                setDueDateInput(d.toISOString().split("T")[0]);
                              }
                            }}
                            placeholder="0 = Tunai"
                            className="h-10 w-full px-3.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    No. Nota / Faktur Fisik
                  </label>
                  <input
                    type="text"
                    value={invoiceNoInput}
                    onChange={(e) => setInvoiceNoInput(e.target.value)}
                    placeholder="INV/2026/09/001"
                    className="h-10 w-full px-3.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tanggal Transaksi *
                  </label>
                  <DatePicker
                    value={orderDateInput}
                    onChange={(val) => setOrderDateInput(val)}
                    placeholder="Pilih tanggal transaksi..."
                    className="h-10 w-full rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>
            </div>

            {/* Line Items Card in Classic Mode */}
            <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Package className="w-4 h-4 text-indigo-500" />
                  Barang Pengadaan ({lineItems.length})
                </h3>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setQuickItemInitialName("");
                      setIsQuickItemCreateOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs border border-amber-500/20 hover:bg-amber-500/20 transition cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>+ Barang Kilat</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsItemPickerOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition cursor-pointer"
                  >
                    <PackagePlus className="w-4 h-4" />
                    <span>{lineItems.length === 0 ? "Pilih dari Katalog" : "+ Ubah Pilihan Item"}</span>
                  </button>
                </div>
              </div>

              {/* Line Items Table (Single Shared Header, Zero Redundant Repetition) */}
              <PurchaseOrderItemsTable
                lineItems={lineItems}
                onUpdateLineItem={handleUpdateLineItem}
                onRemoveLineItem={handleRemoveLineItem}
                onOpenItemPicker={() => setIsItemPickerOpen(true)}
              />
            </div>

            {/* Notes in Classic Mode */}
            <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                Catatan Tambahan & Instruksi Pengadaan
              </h3>
              <textarea
                rows={3}
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder="Tuliskan instruksi pengiriman, rekening transfer, kontak driver, dll..."
                className="w-full p-3 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {/* Right Column: Financial & Actions in Classic Mode */}
          <div className="space-y-6">
            <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                Rekapitulasi Finansial
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-600 dark:text-slate-300 block mb-1 font-bold">
                    Diskon Global Faktur (Rp)
                  </label>
                  <CurrencyInput
                    value={discountAmountInput}
                    onChange={setDiscountAmountInput}
                    className="h-10 w-full text-xs font-medium"
                    placeholder="0"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-600 dark:text-slate-300 font-bold">
                      PPN Masukan
                    </label>
                    <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5">
                      <button
                        type="button"
                        onClick={() => handleTaxModeToggle("nominal")}
                        className={cn(
                          "px-2 py-0.5 text-[10px] font-bold rounded-md transition cursor-pointer",
                          taxMode === "nominal"
                            ? "bg-white dark:bg-[#1E1E22] text-slate-900 dark:text-white shadow-xs"
                            : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                        )}
                      >
                        Rp
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTaxModeToggle("percent")}
                        className={cn(
                          "px-2 py-0.5 text-[10px] font-bold rounded-md transition cursor-pointer",
                          taxMode === "percent"
                            ? "bg-white dark:bg-[#1E1E22] text-slate-900 dark:text-white shadow-xs"
                            : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                        )}
                      >
                        %
                      </button>
                    </div>
                  </div>

                  {taxMode === "nominal" ? (
                    <CurrencyInput
                      value={taxAmountInput}
                      onChange={setTaxAmountInput}
                      className="h-10 w-full text-xs font-medium"
                      placeholder="0"
                    />
                  ) : (
                    <div className="space-y-1">
                      <div className="relative flex items-center">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={taxPercent}
                          onChange={(e) => handleTaxPercentChange(parseFloat(e.target.value) || 0)}
                          className="h-10 w-full pr-8 text-xs font-bold bg-white dark:bg-slate-800"
                        />
                        <span className="absolute right-3 text-xs font-bold text-slate-400 select-none pointer-events-none">
                          %
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>= Rp {taxAmountInput.toLocaleString("id-ID")}</span>
                        <div className="flex gap-1">
                          {[0, 11, 12].map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => handleTaxPercentChange(p)}
                              className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition",
                                taxPercent === p
                                  ? "bg-indigo-600 text-white"
                                  : "bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300"
                              )}
                            >
                              {p}%
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-slate-600 dark:text-slate-300 block mb-1 font-bold">
                    Ongkos Kirim / Ekspedisi (Rp)
                  </label>
                  <CurrencyInput
                    value={shippingCostInput}
                    onChange={setShippingCostInput}
                    className="h-10 w-full text-xs font-medium"
                    placeholder="0"
                  />
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Metode Pembayaran *
                    </label>
                    {paymentMethodInput === "credit" && (
                      <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                        Tempo
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "cash", label: "Tunai", icon: Banknote },
                      { id: "bank_transfer", label: "Transfer", icon: Building2 },
                      { id: "qris", label: "QRIS", icon: QrCode },
                      { id: "credit", label: "Tempo", icon: Clock },
                    ].map((item) => {
                      const Icon = item.icon;
                      const isSelected = paymentMethodInput === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setPaymentMethodInput(item.id as any);
                            if (item.id === "credit" && amountPaidInput === formTotalAmount) {
                              setAmountPaidInput(0);
                            }
                          }}
                          className={cn(
                            "flex items-center gap-2 h-11 px-3 rounded-xl border text-left transition cursor-pointer",
                            isSelected
                              ? "border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 font-bold shadow-xs ring-1 ring-indigo-600"
                              : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                          )}
                        >
                          <Icon className={cn("w-3.5 h-3.5 shrink-0", isSelected ? "text-indigo-600" : "text-slate-400")} />
                          <span className="text-xs truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Subtotal Barang:</span>
                    <span>Rp {formSubtotal.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex justify-between text-base font-black text-slate-900 dark:text-white">
                    <span>Total Tagihan:</span>
                    <span>Rp {formTotalAmount.toLocaleString("id-ID")}</span>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                          Jumlah Dibayar ({paymentMethodInput === "credit" ? "DP" : "DP / Lunas"}):
                        </label>
                        {paymentMethodInput !== "credit" ? (
                          <button
                            type="button"
                            onClick={() => handleAmountPaidChange(formTotalAmount)}
                            className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-bold hover:bg-emerald-500/20 active:scale-95 transition cursor-pointer"
                          >
                            Lunas (100%)
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAmountPaidChange(Math.round(formTotalAmount * 0.2))}
                            className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold hover:bg-amber-500/20 active:scale-95 transition cursor-pointer"
                          >
                            DP 20%
                          </button>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAmountPaidChange(Math.round(formTotalAmount * 0.5))}
                          className="flex-1 py-1 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30 text-[10px] font-bold hover:bg-indigo-500/20 active:scale-95 transition cursor-pointer text-center"
                        >
                          DP 50%
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentMethodInput("credit");
                            setAmountPaidInput(0);
                          }}
                          className="flex-1 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-[10px] font-bold hover:bg-slate-200 active:scale-95 transition cursor-pointer text-center"
                        >
                          Tempo (0)
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      <CurrencyInput
                        value={amountPaidInput}
                        onChange={handleAmountPaidChange}
                        max={formTotalAmount > 0 ? formTotalAmount : undefined}
                        onMaxExceeded={(maxVal) => {
                          setPaymentAdjustHint(
                            `Nominal otomatis dikunci ke Rp ${maxVal.toLocaleString("id-ID")} sesuai Total Tagihan PO.`
                          );
                          if (paymentMethodInput === "credit") {
                            setPaymentMethodInput("bank_transfer");
                          }
                        }}
                        className="h-11 w-full text-sm font-bold"
                        placeholder="0"
                      />
                      {paymentAdjustHint && (
                        <div className="mt-1.5 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2 animate-in fade-in-50">
                          <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <span>{paymentAdjustHint}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between font-bold pt-1 text-xs">
                    <span className="text-rose-600 dark:text-rose-400">Sisa Hutang (AP):</span>
                    <span className="text-rose-600 dark:text-rose-400 font-mono text-sm">
                      Rp {formAmountOwed.toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  disabled={isSubmitting || lineItems.length === 0}
                  onClick={() => handleSubmit("received")}
                  className="w-full py-3 rounded-xl bg-[#E2FF66] text-slate-900 font-bold text-xs hover:brightness-95 active:scale-95 transition disabled:opacity-50 shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Beli Langsung (Stok Masuk)</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting || lineItems.length === 0}
                  onClick={() => handleSubmit("submitted")}
                  className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Terbitkan PO Resmi (Inbound)</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting || lineItems.length === 0}
                  onClick={() => handleSubmit("draft")}
                  className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Draf Saja</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 📦 ITEM SELECTOR MODAL */}
      <ItemSelectorModal
        isOpen={isItemPickerOpen}
        onClose={() => setIsItemPickerOpen(false)}
        items={itemSelectorList}
        selectedItemIds={lineItems.map((l) => l.item_id)}
        onApply={handleApplySelectedItems}
        title="Pilih Barang Pengadaan / Pembelian"
        description="Pilih satu atau lebih barang yang ingin dipesan dari supplier/vendor. Mendukung multi-select."
        confirmButtonText="Terapkan ke Faktur Beli"
        onQuickCreate={(query) => {
          setQuickItemInitialName(query);
          setIsQuickItemCreateOpen(true);
        }}
      />

      {/* ⚡ MODAL: INLINE QUICK ITEM CREATION */}
      <QuickItemCreateDialog
        open={isQuickItemCreateOpen}
        onOpenChange={setIsQuickItemCreateOpen}
        initialName={quickItemInitialName}
        categories={categories}
        onCreated={handleQuickItemCreated}
      />
    </div>
  );
}
