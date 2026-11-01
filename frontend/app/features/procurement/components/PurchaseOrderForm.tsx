import React, { useState, useEffect, useMemo, useRef } from "react";
import { ItemSelectorModal } from "../../../components/ItemSelectorModal";
import { QuickItemCreateDialog, type QuickCreatedItem } from "../../../components/QuickItemCreateDialog";
import { PurchaseOrderItemsTable } from "./PurchaseOrderItemsTable";
import { PurchaseOrderVendorSection } from "./PurchaseOrderVendorSection";
import { PurchaseOrderFinancialSection } from "./PurchaseOrderFinancialSection";
import { PurchaseOrderSummaryCard } from "./PurchaseOrderSummaryCard";
import { DatePicker } from "../../../components/ui/date-picker";
import { Button } from "../../../components/ui/button";
import { ButtonGroup } from "../../../components/ui/button-group";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Checkbox } from "../../../components/ui/checkbox";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupText,
  InputGroupTextarea,
} from "../../../components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../../../components/ui/select";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Info,
  Package,
  PackagePlus,
  PackageX,
  Phone,
  Plus,
  RotateCcw,
  Save,
  Send,
  Trash2,
  User,
  UserPlus,
  Banknote,
  QrCode,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../lib/api";
import { cn } from "../../../lib/utils";
import { useLanguageStore, translations } from "../../../lib/i18n";
import { DiscountSliderDialog } from "./DiscountSliderDialog";
import {
  calculateLineSubtotal,
  calculateLinePhysicalCount,
  calculateLineGross,
  calculateLineDiscountAmount,
  buildLineItemsFromPurchase,
} from "../utils/calculations";
import { usePurchaseOrderDraft } from "../hooks/usePurchaseOrderDraft";
import type { Supplier, ItemOption, OutletOption, LineItemInput, Purchase } from "../types";

interface PurchaseOrderFormProps {
  outlets: OutletOption[];
  suppliers: Supplier[];
  purchasableItems: ItemOption[];
  categories: Array<{ id: string; name: string }>;
  defaultOutletId?: string;
  isDirectPurchaseBlocked?: boolean;
  editPurchase?: Purchase | null;
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
  editPurchase = null,
  onBack,
  onSuccess,
  onRefreshSuppliers,
  onAddPurchasableItem,
}: PurchaseOrderFormProps) {
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;

  // Mode & Stepper
  const [createMode, setCreateMode] = useState<"wizard" | "classic">("wizard");
  const [wizardStep, setWizardStep] = useState<number>(editPurchase ? 2 : 1);
  const [maxStepVisited, setMaxStepVisited] = useState<number>(editPurchase ? 3 : 1);
  const isUserManualPayment = useRef<boolean>(!!editPurchase);
  const isUserManualSubmissionType = useRef<boolean>(!!editPurchase);

  // Target Location & Supplier
  const [targetOutletId, setTargetOutletId] = useState<string>(
    editPurchase?.outlet_id || defaultOutletId
  );
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(
    editPurchase?.supplier_id || ""
  );
  const [supplierNameInput, setSupplierNameInput] = useState<string>(
    editPurchase?.supplier_name || ""
  );
  const [supplierMode, setSupplierMode] = useState<"existing" | "new">("existing");
  const [saveToMasterSupplier, setSaveToMasterSupplier] = useState<boolean>(true);
  const [supplierContactInput, setSupplierContactInput] = useState<string>("");
  const [supplierPhoneInput, setSupplierPhoneInput] = useState<string>("");
  const [supplierEmailInput, setSupplierEmailInput] = useState<string>("");
  const [supplierAddressInput, setSupplierAddressInput] = useState<string>("");
  const [supplierPaymentTermsInput, setSupplierPaymentTermsInput] = useState<number>(0);

  // Document metadata
  const [invoiceNoInput, setInvoiceNoInput] = useState<string>(
    editPurchase?.invoice_no || ""
  );
  const [orderDateInput, setOrderDateInput] = useState<string>(
    editPurchase?.order_date ? editPurchase.order_date.split("T")[0] : new Date().toISOString().split("T")[0]
  );
  const [dueDateInput, setDueDateInput] = useState<string>(
    editPurchase?.due_date ? editPurchase.due_date.split("T")[0] : ""
  );
  const [paymentMethodInput, setPaymentMethodInput] = useState<"cash" | "bank_transfer" | "credit" | "qris">(
    (editPurchase?.payment_method as any) || "cash"
  );
  const [discountAmountInput, setDiscountAmountInput] = useState<number>(
    editPurchase?.discount_amount || 0
  );
  const [discountMode, setDiscountMode] = useState<"nominal" | "percent">("nominal");
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [globalDiscountDialogOpen, setGlobalDiscountDialogOpen] = useState<boolean>(false);
  const [submissionType, setSubmissionType] = useState<"submitted" | "received">(() => {
    if (editPurchase) {
      if (editPurchase.purchase_type === "direct") return "received";
      if (editPurchase.purchase_type === "standard") return "submitted";
      return editPurchase.status === "received" ? "received" : "submitted";
    }
    return "submitted";
  });
  const [taxAmountInput, setTaxAmountInput] = useState<number>(
    editPurchase?.tax_amount || 0
  );
  const [taxPercent, setTaxPercent] = useState<number>(11);
  const [shippingCostInput, setShippingCostInput] = useState<number>(
    editPurchase?.shipping_cost || 0
  );
  const [amountPaidInput, setAmountPaidInput] = useState<number>(
    editPurchase?.amount_paid || 0
  );
  const [paymentAdjustHint, setPaymentAdjustHint] = useState<string | null>(null);
  const [notesInput, setNotesInput] = useState<string>(
    editPurchase?.notes || ""
  );

  // Line items
  const [lineItems, setLineItems] = useState<LineItemInput[]>(() => {
    if (editPurchase) {
      return buildLineItemsFromPurchase(editPurchase, purchasableItems);
    }
    return [];
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Rehydrate form when editPurchase changes (e.g. after full fetch from API)
  useEffect(() => {
    if (!editPurchase) return;

    if (editPurchase.outlet_id) setTargetOutletId(editPurchase.outlet_id);
    if (editPurchase.supplier_id) setSelectedSupplierId(editPurchase.supplier_id);
    if (editPurchase.supplier_name) setSupplierNameInput(editPurchase.supplier_name);
    if (editPurchase.purchase_type) {
      setSubmissionType(editPurchase.purchase_type === "direct" ? "received" : "submitted");
    } else if (editPurchase.status === "received") {
      setSubmissionType("received");
    }
    if (editPurchase.invoice_no) setInvoiceNoInput(editPurchase.invoice_no);
    if (editPurchase.order_date) setOrderDateInput(editPurchase.order_date.split("T")[0]);
    if (editPurchase.due_date) setDueDateInput(editPurchase.due_date.split("T")[0]);
    if (editPurchase.payment_method) setPaymentMethodInput(editPurchase.payment_method as any);
    if (editPurchase.discount_amount !== undefined) setDiscountAmountInput(editPurchase.discount_amount);
    if (editPurchase.tax_amount !== undefined) setTaxAmountInput(editPurchase.tax_amount);
    if (editPurchase.shipping_cost !== undefined) setShippingCostInput(editPurchase.shipping_cost);
    if (editPurchase.amount_paid !== undefined) {
      setAmountPaidInput(editPurchase.amount_paid);
      isUserManualPayment.current = true;
    }
    if (editPurchase.notes) setNotesInput(editPurchase.notes);

    if (editPurchase.items && editPurchase.items.length > 0) {
      const mapped = buildLineItemsFromPurchase(editPurchase, purchasableItems);
      setLineItems(mapped);
      setMaxStepVisited(3);
    }
  }, [editPurchase, purchasableItems]);

  // Item Picker & Quick Create Modals
  const [isItemPickerOpen, setIsItemPickerOpen] = useState(false);
  const [isQuickItemCreateOpen, setIsQuickItemCreateOpen] = useState(false);
  const [quickItemInitialName, setQuickItemInitialName] = useState("");

  const handleSelectExistingSupplier = (val: string) => {
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
  };

  const handleSupplierPaymentTermsChange = (days: number) => {
    setSupplierPaymentTermsInput(days);
    if (days > 0) {
      const d = new Date();
      d.setDate(d.getDate() + days);
      setDueDateInput(d.toISOString().split("T")[0]);
    }
  };

  const {
    hasSavedDraft,
    handleRestoreDraft,
    handleDiscardDraft,
    clearSavedDraft,
  } = usePurchaseOrderDraft({
    editPurchase,
    snapshot: {
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
      taxPercent,
      shippingCostInput,
      amountPaidInput,
      notesInput,
      lineItems,
      submissionType,
    },
    onRestoreSnapshot: (parsed) => {
      if (parsed.targetOutletId) setTargetOutletId(parsed.targetOutletId);
      if (parsed.selectedSupplierId) setSelectedSupplierId(parsed.selectedSupplierId);
      if (parsed.supplierNameInput) setSupplierNameInput(parsed.supplierNameInput);
      if (parsed.supplierMode) setSupplierMode(parsed.supplierMode);
      if (parsed.invoiceNoInput) setInvoiceNoInput(parsed.invoiceNoInput);
      if (parsed.orderDateInput) setOrderDateInput(parsed.orderDateInput);
      if (parsed.dueDateInput) setDueDateInput(parsed.dueDateInput);
      if (parsed.paymentMethodInput) setPaymentMethodInput(parsed.paymentMethodInput);
      if (parsed.discountAmountInput) setDiscountAmountInput(parsed.discountAmountInput);
      if (typeof parsed.taxPercent === "number") setTaxPercent(parsed.taxPercent);
      if (parsed.taxAmountInput) setTaxAmountInput(parsed.taxAmountInput);
      if (parsed.shippingCostInput) setShippingCostInput(parsed.shippingCostInput);
      if (parsed.amountPaidInput !== undefined) {
        setAmountPaidInput(parsed.amountPaidInput);
        isUserManualPayment.current = true;
      }
      if (parsed.notesInput) setNotesInput(parsed.notesInput);
      if (parsed.submissionType === "received" || parsed.submissionType === "submitted") {
        setSubmissionType(parsed.submissionType);
      }
      if (parsed.lineItems) {
        setLineItems(parsed.lineItems);
        if (parsed.lineItems.length > 0) {
          setMaxStepVisited(3);
        }
      }
    },
    language,
    t,
  });

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
              original_box_cost: defaultBoxCost,
              qty_pcs: hasDualUom ? 0 : 1,
              pcs_cost: defaultPcsCost,
              original_pcs_cost: defaultPcsCost,
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
      const item = { ...updated[index], [field]: value };
      // If cost or qty changed and item is in percent discount mode, recalculate discount_amount
      if (
        (field === "qty_box" || field === "box_cost" || field === "qty_pcs" || field === "pcs_cost" || field === "qty_ordered" || field === "unit_cost") &&
        item.discount_mode === "percent" &&
        item.discount_percent !== undefined
      ) {
        const gross = calculateLineGross(item);
        item.discount_amount = Math.round((gross * item.discount_percent) / 100);
      }
      updated[index] = item;
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

  // Recalculate global discount if mode is percent
  const handleDiscountPercentChange = (pct: number) => {
    const clamped = Math.min(100, Math.max(0, pct));
    setDiscountPercent(clamped);
    const calculated = formSubtotal > 0 ? Math.round(formSubtotal * (clamped / 100)) : 0;
    setDiscountAmountInput(calculated);
  };

  const handleDiscountModeToggle = (mode: "nominal" | "percent") => {
    setDiscountMode(mode);
    if (mode === "percent") {
      let pct = discountPercent;
      if (pct === 0 && discountAmountInput > 0 && formSubtotal > 0) {
        pct = Math.min(100, Math.round((discountAmountInput / formSubtotal) * 100));
        setDiscountPercent(pct);
      }
      const calculated = formSubtotal > 0 ? Math.round(formSubtotal * (pct / 100)) : 0;
      setDiscountAmountInput(calculated);
    }
  };

  // Sync percent global discount when formSubtotal changes
  useEffect(() => {
    if (discountMode === "percent") {
      const calculated = formSubtotal > 0 ? Math.round(formSubtotal * (discountPercent / 100)) : 0;
      setDiscountAmountInput(calculated);
    } else {
      if (formSubtotal > 0 && discountAmountInput > formSubtotal) {
        setDiscountAmountInput(formSubtotal);
        setDiscountPercent(100);
      } else if (formSubtotal === 0 && discountAmountInput > 0) {
        setDiscountAmountInput(0);
        setDiscountPercent(0);
      }
    }
  }, [formSubtotal, discountMode, discountPercent, discountAmountInput]);

  // Recalculate tax from taxPercent
  const handleTaxPercentChange = (pct: number) => {
    const safePct = isNaN(pct) || pct < 0 ? 0 : Math.min(100, pct);
    setTaxPercent(safePct);
    const base = formSubtotal - discountAmountInput;
    const calculated = base > 0 ? Math.round(base * (safePct / 100)) : 0;
    setTaxAmountInput(calculated);
  };

  // Sync percent tax when subtotal, discount, or tax percent changes
  useEffect(() => {
    const base = formSubtotal - discountAmountInput;
    const calculated = base > 0 ? Math.round(base * (taxPercent / 100)) : 0;
    setTaxAmountInput(calculated);
  }, [formSubtotal, discountAmountInput, taxPercent]);

  // Active Supplier & Terms logic
  const activeSupplier = useMemo(() => {
    if (supplierMode === "existing") {
      return suppliers.find((s) => s.id === selectedSupplierId);
    }
    return null;
  }, [supplierMode, suppliers, selectedSupplierId]);

  const activePaymentTermsDays = useMemo(() => {
    if (supplierMode === "existing") {
      return activeSupplier ? activeSupplier.payment_terms_days : 0;
    }
    return supplierPaymentTermsInput || 0;
  }, [supplierMode, activeSupplier, supplierPaymentTermsInput]);

  const isSupplierCashOnly = activePaymentTermsDays === 0;

  const formTotalAmount = useMemo(() => {
    const total = formSubtotal - discountAmountInput + taxAmountInput + shippingCostInput;
    return total > 0 ? total : 0;
  }, [formSubtotal, discountAmountInput, taxAmountInput, shippingCostInput]);

  // Synchronize amountPaidInput to maximum (full payment) by default,
  // unless user has deliberately edited the amount or switched to credit
  useEffect(() => {
    if (!isUserManualPayment.current && paymentMethodInput !== "credit" && formTotalAmount >= 0) {
      setAmountPaidInput(formTotalAmount);
    }
  }, [formTotalAmount, paymentMethodInput]);

  // Smart auto-adjustment for submissionType based on supplier payment terms and payment status
  useEffect(() => {
    if (isUserManualSubmissionType.current) return;
    // If supplier is COD/Cash only (terms = 0) and payment is in full, default to Direct Purchase (received)
    if (isSupplierCashOnly && amountPaidInput === formTotalAmount && formTotalAmount > 0) {
      setSubmissionType("received");
    } else if (paymentMethodInput === "credit" || (formTotalAmount - amountPaidInput) > 0) {
      // If credit or debt remaining, default to formal PO (submitted)
      setSubmissionType("submitted");
    }
  }, [isSupplierCashOnly, amountPaidInput, formTotalAmount, paymentMethodInput]);

  const formAmountOwed = useMemo(() => {
    const owed = formTotalAmount - amountPaidInput;
    return owed > 0 ? owed : 0;
  }, [formTotalAmount, amountPaidInput]);

  const handleAmountPaidChange = (val: number) => {
    isUserManualPayment.current = true;
    if (val > formTotalAmount && formTotalAmount > 0) {
      setAmountPaidInput(formTotalAmount);
      setPaymentAdjustHint(
        language === "id"
          ? `Nominal disesuaikan ke Rp ${formTotalAmount.toLocaleString("id-ID")} sesuai Total Tagihan.`
          : `Amount adjusted to Rp ${formTotalAmount.toLocaleString("en-US")} matching Total Bill.`
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

  // Stepper navigation permissions
  const canNavigateToStep = (targetStep: number): boolean => {
    if (targetStep === 1) return true;
    if (targetStep === 2) return true;
    if (targetStep === 3) {
      return lineItems.length > 0 || maxStepVisited >= 3;
    }
    return false;
  };

  const handleStepClick = (targetStep: number) => {
    if (targetStep === wizardStep) return;
    if (canNavigateToStep(targetStep)) {
      setWizardStep(targetStep);
      setMaxStepVisited((prev) => Math.max(prev, targetStep));
    } else {
      if (targetStep === 3 && lineItems.length === 0) {
        toast.warning(t.poWizardStepItemsRequiredToast);
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
          const boxDisc = (l.box_discount_amount || 0) * l.qty_box;
          itemsPayload.push({
            item_id: l.item_id,
            uom: "box",
            qty_ordered: l.qty_box,
            conversion_rate: l.conversion_rate,
            unit_cost: l.box_cost,
            discount_amount: boxDisc,
            notes: l.notes || undefined,
          });
        }
        if (l.qty_pcs > 0) {
          const pcsDisc = (l.pcs_discount_amount || 0) * l.qty_pcs;
          itemsPayload.push({
            item_id: l.item_id,
            uom: "base",
            qty_ordered: l.qty_pcs,
            conversion_rate: 1,
            unit_cost: l.pcs_cost,
            discount_amount: pcsDisc,
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
            discount_amount: l.pcs_discount_amount || 0,
            notes: l.notes || undefined,
          });
        }
      } else {
        const qty = l.qty_pcs > 0 ? l.qty_pcs : l.qty_ordered || 1;
        const cost = l.pcs_cost > 0 ? l.pcs_cost : l.unit_cost || 0;
        const unitDisc = l.pcs_discount_amount !== undefined ? l.pcs_discount_amount : l.discount_amount || 0;
        itemsPayload.push({
          item_id: l.item_id,
          uom: "base",
          qty_ordered: qty,
          conversion_rate: 1,
          unit_cost: cost,
          discount_amount: unitDisc * qty,
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
        purchase_type: submissionType === "received" ? "direct" : "standard",
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

      if (editPurchase?.id) {
        await api.put(`/purchases/${editPurchase.id}`, payload);
      } else {
        await api.post("/purchases", payload);
      }

      if (targetStatus === "draft") {
        toast.success(
          language === "id"
            ? (editPurchase ? "Draf faktur pembelian berhasil diperbarui" : "Draf faktur pembelian berhasil disimpan")
            : (editPurchase ? "Purchase draft updated successfully" : "Purchase draft saved successfully")
        );
      } else if (targetStatus === "received") {
        toast.success(language === "id" ? "Pembelian langsung berhasil diselesaikan dan stok telah bertambah!" : "Direct purchase completed and stock updated!");
      } else {
        toast.success(language === "id" ? "Pesanan pembelian berhasil diterbitkan!" : "Purchase order issued successfully!");
      }

      // Cleanup saved draft
      clearSavedDraft();
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Gagal memproses faktur pembelian");
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
              {editPurchase
                ? (language === "id" ? `Edit Draf PO (${editPurchase.po_number})` : `Edit Purchase Draft (${editPurchase.po_number})`)
                : t.poFormTitle}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              {editPurchase
                ? (language === "id" ? "Perbarui rincian barang, supplier, atau lanjutkan untuk menerbitkan PO" : "Update order items, supplier, or proceed to issue PO")
                : t.poFormSubtitle}
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
              {t.poModeWizard}
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
              {t.poModeClassic}
            </button>
          </div>
        </div>
      </div>

      {/* 💾 DRAFT RECOVERY BANNER */}
      {hasSavedDraft && (
        <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-between text-xs animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-medium">
            <Save className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>{t.poDraftFound}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRestoreDraft}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition cursor-pointer"
            >
              {t.poRestoreDraft}
            </button>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition cursor-pointer"
            >
              {t.poDiscardDraft}
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
              { num: 1, label: t.poWizardStep1, icon: Building2 },
              { num: 2, label: t.poWizardStep2, icon: Package },
              { num: 3, label: t.poWizardStep3, icon: DollarSign },
            ].map((s) => {
              const Icon = s.icon;
              const isCurrent = wizardStep === s.num;
              const isAccessible = canNavigateToStep(s.num);
              const isCompleted =
                (s.num === 1 && (!!selectedSupplierId || !!supplierNameInput.trim())) ||
                (s.num === 2 && lineItems.length > 0) ||
                (s.num === 3 && wizardStep === 3);

              return (
                <div
                  key={s.num}
                  onClick={() => handleStepClick(s.num)}
                  className={cn(
                    "p-3.5 rounded-2xl border transition-all flex items-center gap-3 select-none",
                    isCurrent
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-sm ring-1 ring-slate-900 dark:ring-white"
                      : isCompleted || isAccessible
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 cursor-pointer hover:brightness-95 hover:border-emerald-300"
                      : "bg-white dark:bg-[#1E1E22] border-slate-200/80 dark:border-[#2E2E34] text-slate-400 cursor-not-allowed opacity-60"
                  )}
                >
                  <div
                    className={cn(
                      "w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-colors",
                      isCurrent
                        ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900"
                        : isCompleted
                        ? "bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-white"
                        : isAccessible
                        ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                    )}
                  >
                    {isCompleted && !isCurrent ? <Check className="w-4 h-4 text-emerald-700 dark:text-emerald-200" /> : s.num}
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
                  {t.poStep1Title}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t.poStep1Desc}
                </p>
              </div>

              <PurchaseOrderVendorSection
                outlets={outlets}
                suppliers={suppliers}
                targetOutletId={targetOutletId}
                onTargetOutletChange={setTargetOutletId}
                supplierMode={supplierMode}
                onSupplierModeChange={setSupplierMode}
                selectedSupplierId={selectedSupplierId}
                onSelectExistingSupplier={handleSelectExistingSupplier}
                saveToMasterSupplier={saveToMasterSupplier}
                onSaveToMasterSupplierChange={setSaveToMasterSupplier}
                supplierNameInput={supplierNameInput}
                onSupplierNameChange={setSupplierNameInput}
                supplierContactInput={supplierContactInput}
                onSupplierContactChange={setSupplierContactInput}
                supplierPhoneInput={supplierPhoneInput}
                onSupplierPhoneChange={setSupplierPhoneInput}
                supplierPaymentTermsInput={supplierPaymentTermsInput}
                onSupplierPaymentTermsChange={handleSupplierPaymentTermsChange}
                invoiceNoInput={invoiceNoInput}
                onInvoiceNoChange={setInvoiceNoInput}
                orderDateInput={orderDateInput}
                onOrderDateChange={setOrderDateInput}
                t={t}
              />

              {/* Step 1 Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    if (supplierMode === "existing" && !selectedSupplierId) {
                      toast.error(language === "id" ? "Pilih supplier terlebih dahulu" : "Please select a supplier first");
                      return;
                    }
                    if (supplierMode === "new" && !supplierNameInput.trim()) {
                      toast.error(language === "id" ? "Nama supplier wajib diisi" : "Supplier name is required");
                      return;
                    }
                    setWizardStep(2);
                    setMaxStepVisited((prev) => Math.max(prev, 2));
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs hover:opacity-90 transition cursor-pointer"
                >
                  <span>{t.poBtnNextToItems}</span>
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
                    {t.poStep2Title}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t.poStep2SupplierPrefix} <strong>{supplierMode === "existing" ? suppliers.find((s) => s.id === selectedSupplierId)?.name : supplierNameInput}</strong>
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
                    <span>{t.poQuickItemBtn}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsItemPickerOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs hover:opacity-90 transition shadow-sm cursor-pointer"
                  >
                    <PackagePlus className="w-4 h-4" />
                    <span>{lineItems.length === 0 ? t.poOpenCatalogBtn : t.poModifyCatalogBtn}</span>
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
                  <span>{t.poBtnBackToStep1}</span>
                </button>

                <button
                  type="button"
                  disabled={lineItems.length === 0}
                  onClick={() => {
                    setWizardStep(3);
                    setMaxStepVisited((prev) => Math.max(prev, 3));
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs hover:opacity-90 disabled:opacity-50 transition cursor-pointer"
                >
                  <span>{t.poBtnNextToStep3}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Wizard Step 3: Financial & Submission */}
          {wizardStep === 3 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in-50">
              <div className="lg:col-span-2 space-y-6">
                <PurchaseOrderFinancialSection
                  layout="wizard"
                  formSubtotal={formSubtotal}
                  formTotalAmount={formTotalAmount}
                  formAmountOwed={formAmountOwed}
                  discountAmountInput={discountAmountInput}
                  discountPercent={discountPercent}
                  onDiscountAmountChange={(val) => {
                    const safeVal = typeof val === "number" && !isNaN(val) ? Math.max(0, val) : 0;
                    const clampedVal = formSubtotal > 0 ? Math.min(formSubtotal, safeVal) : 0;
                    setDiscountAmountInput(clampedVal);
                    const rawPct = formSubtotal > 0 ? (clampedVal / formSubtotal) * 100 : 0;
                    const pct = !isNaN(rawPct) && isFinite(rawPct) ? Number(rawPct.toFixed(1)) : 0;
                    setDiscountPercent(Math.min(100, Math.max(0, pct)));
                  }}
                  onDiscountPercentChange={(safePct) => {
                    setDiscountPercent(safePct);
                    const calculated = formSubtotal > 0 ? Math.round((formSubtotal * safePct) / 100) : 0;
                    setDiscountAmountInput(calculated);
                  }}
                  onOpenGlobalDiscountSlider={() => setGlobalDiscountDialogOpen(true)}
                  taxAmountInput={taxAmountInput}
                  taxPercent={taxPercent}
                  onTaxPercentChange={handleTaxPercentChange}
                  shippingCostInput={shippingCostInput}
                  onShippingCostChange={setShippingCostInput}
                  paymentMethodInput={paymentMethodInput}
                  onPaymentMethodSelect={(method) => {
                    setPaymentMethodInput(method);
                    if (method === "credit") {
                      isUserManualPayment.current = true;
                      if (amountPaidInput === formTotalAmount) {
                        setAmountPaidInput(0);
                      }
                    } else if (amountPaidInput === 0) {
                      isUserManualPayment.current = false;
                      setAmountPaidInput(formTotalAmount);
                    }
                  }}
                  amountPaidInput={amountPaidInput}
                  onAmountPaidChange={handleAmountPaidChange}
                  onFillMaxAmountPaid={() => {
                    isUserManualPayment.current = false;
                    handleAmountPaidChange(formTotalAmount);
                    if (paymentMethodInput === "credit") {
                      setPaymentMethodInput("cash");
                    }
                  }}
                  onAmountPaidMaxExceeded={(maxVal) => {
                    setPaymentAdjustHint(
                      language === "id"
                        ? `Nominal otomatis dikunci ke Rp ${maxVal.toLocaleString("id-ID")} sesuai Total Tagihan.`
                        : `Amount automatically locked to Rp ${maxVal.toLocaleString("en-US")} matching Total Bill.`
                    );
                    if (paymentMethodInput === "credit") {
                      setPaymentMethodInput("bank_transfer");
                    }
                  }}
                  paymentAdjustHint={paymentAdjustHint}
                  notesInput={notesInput}
                  onNotesChange={setNotesInput}
                  onBackToStep2={() => setWizardStep(2)}
                  language={language}
                  t={t}
                />
              </div>

              <div className="space-y-4">
                <PurchaseOrderSummaryCard
                  lineItemsCount={lineItems.length}
                  formSubtotal={formSubtotal}
                  discountAmountInput={discountAmountInput}
                  taxAmountInput={taxAmountInput}
                  taxPercent={taxPercent}
                  shippingCostInput={shippingCostInput}
                  formTotalAmount={formTotalAmount}
                  formAmountOwed={formAmountOwed}
                  isSupplierCashOnly={isSupplierCashOnly}
                  submissionType={submissionType}
                  onSubmissionTypeSelect={(type) => {
                    isUserManualSubmissionType.current = true;
                    setSubmissionType(type);
                  }}
                  isSubmitting={isSubmitting}
                  onSubmit={handleSubmit}
                  language={language}
                  t={t}
                />
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
                {t.poStep1Title}
              </h3>

              <PurchaseOrderVendorSection
                outlets={outlets}
                suppliers={suppliers}
                targetOutletId={targetOutletId}
                onTargetOutletChange={setTargetOutletId}
                supplierMode={supplierMode}
                onSupplierModeChange={setSupplierMode}
                selectedSupplierId={selectedSupplierId}
                onSelectExistingSupplier={handleSelectExistingSupplier}
                saveToMasterSupplier={saveToMasterSupplier}
                onSaveToMasterSupplierChange={setSaveToMasterSupplier}
                supplierNameInput={supplierNameInput}
                onSupplierNameChange={setSupplierNameInput}
                supplierContactInput={supplierContactInput}
                onSupplierContactChange={setSupplierContactInput}
                supplierPhoneInput={supplierPhoneInput}
                onSupplierPhoneChange={setSupplierPhoneInput}
                supplierPaymentTermsInput={supplierPaymentTermsInput}
                onSupplierPaymentTermsChange={handleSupplierPaymentTermsChange}
                invoiceNoInput={invoiceNoInput}
                onInvoiceNoChange={setInvoiceNoInput}
                orderDateInput={orderDateInput}
                onOrderDateChange={setOrderDateInput}
                t={t}
              />
            </div>

            {/* Line Items Card in Classic Mode */}
            <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Package className="w-4 h-4 text-indigo-500" />
                  {t.poStep2Title} ({lineItems.length})
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
                    <span>{t.poQuickItemBtn}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsItemPickerOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition cursor-pointer"
                  >
                    <PackagePlus className="w-4 h-4" />
                    <span>{lineItems.length === 0 ? t.poOpenCatalogBtn : t.poModifyCatalogBtn}</span>
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
                {t.poNotesLabel}
              </h3>
              <InputGroup>
                <InputGroupTextarea
                  rows={3}
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder={t.poNotesPlaceholder}
                />
              </InputGroup>
            </div>
          </div>

          {/* Right Column: Financial & Actions in Classic Mode */}
          <div className="space-y-6">
            <PurchaseOrderFinancialSection
              layout="classic"
              formSubtotal={formSubtotal}
              formTotalAmount={formTotalAmount}
              formAmountOwed={formAmountOwed}
              discountAmountInput={discountAmountInput}
              discountPercent={discountPercent}
              onDiscountAmountChange={(val) => {
                const safeVal = typeof val === "number" && !isNaN(val) ? Math.max(0, val) : 0;
                const clampedVal = formSubtotal > 0 ? Math.min(formSubtotal, safeVal) : 0;
                setDiscountAmountInput(clampedVal);
                const rawPct = formSubtotal > 0 ? (clampedVal / formSubtotal) * 100 : 0;
                const pct = !isNaN(rawPct) && isFinite(rawPct) ? Number(rawPct.toFixed(1)) : 0;
                setDiscountPercent(Math.min(100, Math.max(0, pct)));
              }}
              onDiscountPercentChange={(safePct) => {
                setDiscountPercent(safePct);
                const calculated = formSubtotal > 0 ? Math.round((formSubtotal * safePct) / 100) : 0;
                setDiscountAmountInput(calculated);
              }}
              onOpenGlobalDiscountSlider={() => setGlobalDiscountDialogOpen(true)}
              taxAmountInput={taxAmountInput}
              taxPercent={taxPercent}
              onTaxPercentChange={handleTaxPercentChange}
              shippingCostInput={shippingCostInput}
              onShippingCostChange={setShippingCostInput}
              paymentMethodInput={paymentMethodInput}
              onPaymentMethodSelect={(method) => {
                setPaymentMethodInput(method);
                if (method === "credit") {
                  isUserManualPayment.current = true;
                  if (amountPaidInput === formTotalAmount) {
                    setAmountPaidInput(0);
                  }
                } else if (amountPaidInput === 0) {
                  isUserManualPayment.current = false;
                  setAmountPaidInput(formTotalAmount);
                }
              }}
              amountPaidInput={amountPaidInput}
              onAmountPaidChange={handleAmountPaidChange}
              onFillMaxAmountPaid={() => {
                isUserManualPayment.current = false;
                handleAmountPaidChange(formTotalAmount);
                if (paymentMethodInput === "credit") {
                  setPaymentMethodInput("cash");
                }
              }}
              onAmountPaidMaxExceeded={(maxVal) => {
                setPaymentAdjustHint(
                  language === "id"
                    ? `Nominal otomatis dikunci ke Rp ${maxVal.toLocaleString("id-ID")} sesuai Total Tagihan.`
                    : `Amount automatically locked to Rp ${maxVal.toLocaleString("en-US")} matching Total Bill.`
                );
                if (paymentMethodInput === "credit") {
                  setPaymentMethodInput("bank_transfer");
                }
              }}
              paymentAdjustHint={paymentAdjustHint}
              language={language}
              t={t}
            />

            <PurchaseOrderSummaryCard
              lineItemsCount={lineItems.length}
              formSubtotal={formSubtotal}
              discountAmountInput={discountAmountInput}
              taxAmountInput={taxAmountInput}
              taxPercent={taxPercent}
              shippingCostInput={shippingCostInput}
              formTotalAmount={formTotalAmount}
              formAmountOwed={formAmountOwed}
              isSupplierCashOnly={isSupplierCashOnly}
              submissionType={submissionType}
              onSubmissionTypeSelect={(type) => {
                isUserManualSubmissionType.current = true;
                setSubmissionType(type);
              }}
              isSubmitting={isSubmitting}
              disableActions={lineItems.length === 0}
              onSubmit={handleSubmit}
              language={language}
              t={t}
            />
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
        title={language === "id" ? "Pilih Barang Pembelian" : "Select Purchase Items"}
        description={
          language === "id"
            ? "Pilih barang yang ingin dipesan dari katalog supplier. Mendukung pilihan ganda."
            : "Select items to purchase from supplier catalog. Supports multi-selection."
        }
        confirmButtonText={language === "id" ? "Terapkan ke Formulir" : "Apply to Form"}
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

      {/* 🏷️ MODAL: GLOBAL PO DISCOUNT SLIDER DIALOG */}
      {globalDiscountDialogOpen && (
        <DiscountSliderDialog
          open={true}
          onOpenChange={setGlobalDiscountDialogOpen}
          itemName={t.poDiscountGlobalLabel}
          grossAmount={typeof formSubtotal === "number" && !isNaN(formSubtotal) ? formSubtotal : 0}
          initialPercent={typeof discountPercent === "number" && !isNaN(discountPercent) ? discountPercent : 0}
          initialAmount={typeof discountAmountInput === "number" && !isNaN(discountAmountInput) ? discountAmountInput : 0}
          onApply={(pct, amt) => {
            handleDiscountModeToggle("percent");
            handleDiscountPercentChange(pct);
            if (typeof amt === "number" && !isNaN(amt)) {
              setDiscountAmountInput(amt);
            }
          }}
        />
      )}
    </div>
  );
}
