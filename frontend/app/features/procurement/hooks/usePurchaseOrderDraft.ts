import { useState, useEffect } from "react";
import { toast } from "sonner";
import type { LineItemInput, Purchase } from "../types";

export const PO_DRAFT_KEY = "andaya_po_draft_state";

export interface PurchaseOrderDraftSnapshot {
  targetOutletId: string;
  selectedSupplierId: string;
  supplierNameInput: string;
  supplierMode: "existing" | "new";
  invoiceNoInput: string;
  orderDateInput: string;
  dueDateInput: string;
  paymentMethodInput: "cash" | "bank_transfer" | "credit" | "qris";
  discountAmountInput: number;
  taxAmountInput: number;
  taxPercent: number;
  shippingCostInput: number;
  amountPaidInput: number;
  notesInput: string;
  lineItems: LineItemInput[];
  submissionType: "submitted" | "received";
}

interface UsePurchaseOrderDraftParams {
  editPurchase?: Purchase | null;
  snapshot: PurchaseOrderDraftSnapshot;
  onRestoreSnapshot: (restored: Partial<PurchaseOrderDraftSnapshot>) => void;
  language: string;
  t: Record<string, string>;
}

export function usePurchaseOrderDraft({
  editPurchase,
  snapshot,
  onRestoreSnapshot,
  language,
  t,
}: UsePurchaseOrderDraftParams) {
  const [hasSavedDraft, setHasSavedDraft] = useState(false);

  // Check LocalStorage Draft on mount (only for new creation, not editing existing purchase)
  useEffect(() => {
    if (editPurchase) return;
    try {
      const saved = localStorage.getItem(PO_DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.lineItems && parsed.lineItems.length > 0) {
          setHasSavedDraft(true);
        }
      }
    } catch {
      // ignore invalid storage payload
    }
  }, [editPurchase]);

  // Autosave to LocalStorage when lineItems or supplier changes
  useEffect(() => {
    if (editPurchase) return;
    if (snapshot.lineItems.length > 0 || snapshot.supplierNameInput) {
      try {
        localStorage.setItem(PO_DRAFT_KEY, JSON.stringify(snapshot));
      } catch {
        // ignore quota errors
      }
    }
  }, [
    editPurchase,
    snapshot.targetOutletId,
    snapshot.selectedSupplierId,
    snapshot.supplierNameInput,
    snapshot.supplierMode,
    snapshot.invoiceNoInput,
    snapshot.orderDateInput,
    snapshot.dueDateInput,
    snapshot.paymentMethodInput,
    snapshot.discountAmountInput,
    snapshot.taxAmountInput,
    snapshot.taxPercent,
    snapshot.shippingCostInput,
    snapshot.amountPaidInput,
    snapshot.notesInput,
    snapshot.lineItems,
    snapshot.submissionType,
  ]);

  const handleRestoreDraft = () => {
    try {
      const saved = localStorage.getItem(PO_DRAFT_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<PurchaseOrderDraftSnapshot>;
      onRestoreSnapshot(parsed);
      toast.success(t.poDraftRestored);
      setHasSavedDraft(false);
    } catch {
      toast.error(
        language === "id" ? "Gagal membaca draf tersimpan" : "Failed to read saved draft"
      );
    }
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem(PO_DRAFT_KEY);
    setHasSavedDraft(false);
    toast.info(t.poDraftDiscarded);
  };

  const clearSavedDraft = () => {
    localStorage.removeItem(PO_DRAFT_KEY);
    setHasSavedDraft(false);
  };

  return {
    hasSavedDraft,
    handleRestoreDraft,
    handleDiscardDraft,
    clearSavedDraft,
  };
}
