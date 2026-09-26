import React, { useState, useEffect, useMemo } from "react";
import { ErpDataTable, type ColumnDef } from "../../components/ErpDataTable";
import { ErpSearchBar } from "../../components/ErpSearchBar";
import { ErpFilterPopover } from "../../components/ErpFilterPopover";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { useAuthStore } from "../../lib/store";
import { useLanguageStore, translations } from "../../lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../../components/ui/select";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { ItemSelectorModal } from "../../components/ItemSelectorModal";
import { CurrencyInput } from "../../components/CurrencyInput";
import { ErpImage } from "../../components/ErpImage";
import QRCode from "qrcode";
import {
  Truck,
  CheckCircle2,
  Send,
  Printer,
  Clock,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  FileText,
  RotateCcw,
  RefreshCw,
  Plus,
  Trash2,
  Package,
  PackagePlus,
  Eye,
  Check,
  User,
  MapPin,
  Lock,
  Search,
  Filter,
  Layers,
  Boxes,
  Building2,
  Calendar,
  AlertTriangle,
  Info,
  Phone,
  Car,
  HelpCircle,
  Loader2,
  Banknote,
  CreditCard,
  Copy,
  QrCode,
  Receipt,
  ExternalLink,
  ShieldCheck,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Fuel,
  Coins,
  Calculator,
  Pencil,
  MoreVertical,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../../components/ui/dropdown-menu";

export interface StockTransferItemLine {
  id?: string;
  transfer_id?: string;
  item_id: string;
  item_name?: string;
  item_sku?: string;
  image_url?: string;
  base_unit?: string;
  box_unit?: string;
  conversion_rate?: number;
  qty_requested_sealed?: number;
  qty_requested_loose?: number;
  qty_sent_sealed: number;
  qty_sent_loose: number;
  qty_received_sealed?: number;
  qty_received_loose?: number;
  shrinkage_qty?: number;
  allocation_notes?: string;
  notes?: string;
  // Local stock snapshot for validation
  avail_sealed?: number;
  avail_loose?: number;
  standard_cost?: number;
}

export interface DistributionItem {
  id: string;
  transfer_no?: string;
  business_id: string;
  item_id?: string;
  from_outlet_id?: string;
  to_outlet_id?: string;
  sent_by_user_id?: string;
  sent_to_user_id?: string;
  received_by_user_id?: string;
  driver_name?: string;
  driver_phone?: string;
  vehicle_plate?: string;
  carrier_type?: "internal_fleet" | "online_courier" | "3rd_party" | "pickup" | string;
  shipping_cost?: number;
  shipping_cost_payer?: "origin" | "destination" | "central" | string;
  shipping_payment_method?: "cash" | "bank_transfer" | "on_account" | string;
  tracking_ref_no?: string;
  shipping_cost_mode?: "fixed" | "driver_claim" | "free" | string;
  max_claim_budget?: number;
  claim_token?: string;
  claim_status?: "none" | "pending" | "approved" | "rejected" | string;
  claimed_amount?: number;
  claimed_notes?: string;
  claimed_attachment_url?: string;
  claimed_at?: string;
  claim_reviewed_by?: string;
  claim_reviewed_by_name?: string;
  claim_reviewed_at?: string;
  claim_rejection_reason?: string;
  backorder_status?: "none" | "has_backorder" | "is_backorder" | "closed" | string;
  parent_transfer_id?: string;
  qty: number;
  qty_sealed: number;
  qty_loose: number;
  qty_received_sealed?: number;
  qty_received_loose?: number;
  status: "draft" | "pending_approval" | "in_transit" | "sent" | "received" | "returned" | "cancelled" | string;
  distribution_type?: "outbound" | "return" | "requisition" | string;
  transfer_type?: "outbound" | "return" | "requisition" | string;
  type?: "outbound" | "return" | "requisition" | string;
  shrinkage_tolerance_pct?: number;
  shrinkage_qty?: number;
  notes?: string;
  sent_at: string;
  received_at?: string;
  created_at: string;

  // Joined display helpers
  item_name?: string;
  item_sku?: string;
  base_unit?: string;
  box_unit?: string;
  conversion_rate?: number;
  from_outlet_name?: string;
  to_outlet_name?: string;
  sent_by_user_name?: string;
  sent_to_user_name?: string;
  received_by_user_name?: string;

  // Multi-item lines
  items?: StockTransferItemLine[];
}

export interface ItemSimple {
  id: string;
  name: string;
  sku?: string;
  image_url?: string;
  base_unit?: string;
  box_unit?: string;
  conversion_rate?: number;
  qty_sealed?: number;
  qty_loose?: number;
  item_type?: string;
  standard_cost?: number;
  category_name?: string;
}

export interface OutletSimple {
  id: string;
  name: string;
  address?: string;
}

export interface StaffUser {
  id: string;
  name: string;
  role?: string;
}

export interface DistributionModuleProps {
  initialView?: "master" | "new" | "detail";
  initialTransferId?: string | null;
  onNavigate?: (view: string) => void;
}

export function DistributionModule({
  initialView = "master",
  initialTransferId = null,
  onNavigate,
}: DistributionModuleProps) {
  const { user, activeContext } = useAuthStore();
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;

  const isStaffOrCashier = activeContext?.role === "staff" || activeContext?.role === "cashier";
  const isOwnerOrAdmin = activeContext?.role === "owner" || activeContext?.role === "superadmin" || activeContext?.role === "admin_gudang" || activeContext?.role === "manager";
  const isBranchScoped = Boolean((activeContext?.outlet_id && !activeContext?.is_main_outlet) || isStaffOrCashier);

  // View Navigation: "master" (List) | "new" (Full Page Creator) | "detail" (Full Page Detail View)
  const [currentView, setCurrentView] = useState<"master" | "new" | "detail">(initialView);
  const [selectedTransfer, setSelectedTransfer] = useState<DistributionItem | null>(null);

  // Data State
  const [distributions, setDistributions] = useState<DistributionItem[]>([]);
  const [items, setItems] = useState<ItemSimple[]>([]);
  const [outlets, setOutlets] = useState<OutletSimple[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Quick lookup map for items (image, sku, units)
  const itemMap = useMemo(() => {
    const map = new Map<string, ItemSimple>();
    items.forEach((it) => map.set(it.id, it));
    return map;
  }, [items]);

  // Master Filter State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedCarriers, setSelectedCarriers] = useState<string[]>([]);
  const [selectedOriginOutlets, setSelectedOriginOutlets] = useState<string[]>([]);
  const [selectedDestOutlets, setSelectedDestOutlets] = useState<string[]>([]);

  const activeFilterCount =
    selectedStatuses.length +
    selectedTypes.length +
    selectedCarriers.length +
    selectedOriginOutlets.length +
    selectedDestOutlets.length;

  const handleResetFilters = () => {
    setSelectedStatuses([]);
    setSelectedTypes([]);
    setSelectedCarriers([]);
    setSelectedOriginOutlets([]);
    setSelectedDestOutlets([]);
    setSearchQuery("");
  };

  // Handshake & Print Modals
  const [handshakeDist, setHandshakeDist] = useState<DistributionItem | null>(null);
  const [printSlipDist, setPrintSlipDist] = useState<DistributionItem | null>(null);

  // Form State: Multi-item Shipment Creator (Page "new")
  const [shipFromOutletID, setShipFromOutletID] = useState<string>("");
  const [shipToOutletID, setShipToOutletID] = useState<string>("");
  const [shipToUserID, setShipToUserID] = useState<string>("");
  const [driverName, setDriverName] = useState<string>("");
  const [driverPhone, setDriverPhone] = useState<string>("");
  const [vehiclePlate, setVehiclePlate] = useState<string>("");
  const [carrierType, setCarrierType] = useState<string>("internal_fleet");
  const [shippingCostMode, setShippingCostMode] = useState<"fixed" | "driver_claim" | "free">("fixed");
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [costOngkir, setCostOngkir] = useState<number>(0);
  const [costBBM, setCostBBM] = useState<number>(0);
  const [costTolParkir, setCostTolParkir] = useState<number>(0);
  const [costUangJalan, setCostUangJalan] = useState<number>(0);
  const [maxClaimBudget, setMaxClaimBudget] = useState<number>(0);
  const [shippingCostPayer, setShippingCostPayer] = useState<string>("origin");
  const [shippingPaymentMethod, setShippingPaymentMethod] = useState<string>("cash");
  const [trackingRefNo, setTrackingRefNo] = useState<string>("");

  // Derived: Total Direct Cost from 4 Preset Components
  const totalDirectCost = useMemo(() => {
    return (Number(costOngkir) || 0) + (Number(costBBM) || 0) + (Number(costTolParkir) || 0) + (Number(costUangJalan) || 0);
  }, [costOngkir, costBBM, costTolParkir, costUangJalan]);

  // Keep shippingCost in sync with totalDirectCost
  useEffect(() => {
    if (shippingCostMode === "fixed") {
      setShippingCost(totalDirectCost);
    }
  }, [totalDirectCost, shippingCostMode]);
  const [shipType, setShipType] = useState<"outbound" | "return" | "requisition">("outbound");
  const [shipNotes, setShipNotes] = useState<string>("");
  const [shipLines, setShipLines] = useState<StockTransferItemLine[]>([]);
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Smart Reorder Auto-Suggest & Backorder States
  const [isAutoSuggestingReorder, setIsAutoSuggestingReorder] = useState<boolean>(false);
  const [createBackorder, setCreateBackorder] = useState<boolean>(true);

  // Central Quota Matrix State
  const [isQuotaMatrixOpen, setIsQuotaMatrixOpen] = useState<boolean>(false);
  const [isSavingQuotaMatrix, setIsSavingQuotaMatrix] = useState<boolean>(false);

  // Editing Draft State
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null);

  // Unsaved Form Dirty Guard State
  const [showExitConfirmDialog, setShowExitConfirmDialog] = useState<boolean>(false);
  const [pendingExitCallback, setPendingExitCallback] = useState<(() => void) | null>(null);

  // Dirty detection for shipment creation form
  const isFormDirty = useMemo(() => {
    return (
      shipLines.length > 0 ||
      Boolean(driverName.trim()) ||
      Boolean(shipNotes.trim()) ||
      Boolean(trackingRefNo.trim()) ||
      costOngkir > 0 ||
      costBBM > 0 ||
      costTolParkir > 0 ||
      costUangJalan > 0
    );
  }, [shipLines, driverName, shipNotes, trackingRefNo, costOngkir, costBBM, costTolParkir, costUangJalan]);

  const handleRequestExit = (callback?: () => void) => {
    const exitAction = callback || (() => setCurrentView("master"));
    if (isFormDirty) {
      setPendingExitCallback(() => exitAction);
      setShowExitConfirmDialog(true);
    } else {
      exitAction();
    }
  };

  const handleConfirmDiscard = () => {
    setEditingTransferId(null);
    setShipLines([]);
    setShipNotes("");
    setDriverName("");
    setDriverPhone("");
    setVehiclePlate("");
    setCostOngkir(0);
    setCostBBM(0);
    setCostTolParkir(0);
    setCostUangJalan(0);
    setShippingCost(0);
    setMaxClaimBudget(0);
    setShippingCostMode("fixed");
    setShippingCostPayer("origin");
    setShippingPaymentMethod("cash");
    setTrackingRefNo("");
    setWizardStep(1);

    setShowExitConfirmDialog(false);
    if (pendingExitCallback) {
      pendingExitCallback();
      setPendingExitCallback(null);
    } else {
      setCurrentView("master");
    }
  };

  // Delete Draft Dialog State
  const [deleteDraftDialogTransfer, setDeleteDraftDialogTransfer] = useState<DistributionItem | null>(null);
  const [isDeletingDraft, setIsDeletingDraft] = useState<boolean>(false);

  // Cancel Distribution Dialog State
  const [cancelDialogTransfer, setCancelDialogTransfer] = useState<DistributionItem | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [isCancellingDistribution, setIsCancellingDistribution] = useState<boolean>(false);

  const handleConfirmDeleteDraft = async () => {
    if (!deleteDraftDialogTransfer) return;
    setIsDeletingDraft(true);
    try {
      await api.delete(`/transfers/${deleteDraftDialogTransfer.id}`);
      setDistributions((prev) => prev.filter((d) => d.id !== deleteDraftDialogTransfer.id));
      toast.success("Draf surat jalan berhasil dihapus");
      if (editingTransferId === deleteDraftDialogTransfer.id) {
        setEditingTransferId(null);
        setCurrentView("master");
      }
      if (selectedTransfer?.id === deleteDraftDialogTransfer.id) {
        setSelectedTransfer(null);
        setCurrentView("master");
      }
      setDeleteDraftDialogTransfer(null);
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus draf");
    } finally {
      setIsDeletingDraft(false);
    }
  };

  const handleConfirmCancelDistribution = async () => {
    if (!cancelDialogTransfer) return;
    setIsCancellingDistribution(true);
    try {
      await api.post(`/transfers/${cancelDialogTransfer.id}/cancel`, {
        notes: cancelReason.trim() || "Dibatalkan oleh pengguna",
      });
      setDistributions((prev) =>
        prev.map((d) =>
          d.id === cancelDialogTransfer.id
            ? { ...d, status: "cancelled", notes: cancelReason.trim() || d.notes }
            : d
        )
      );
      if (selectedTransfer?.id === cancelDialogTransfer.id) {
        setSelectedTransfer((prev) =>
          prev
            ? { ...prev, status: "cancelled", notes: cancelReason.trim() || prev.notes }
            : null
        );
      }
      toast.success("Pengiriman surat jalan berhasil dibatalkan & saldo stok dikembalikan ke asal");
      setCancelDialogTransfer(null);
      setCancelReason("");
    } catch (err: any) {
      toast.error(err.message || "Gagal membatalkan pengiriman surat jalan");
    } finally {
      setIsCancellingDistribution(false);
    }
  };

  // Open existing Draft in Creator Form with all pre-filled data
  const handleOpenEditDraft = (dist: DistributionItem) => {
    setEditingTransferId(dist.id);
    setShipFromOutletID(dist.from_outlet_id || "");
    setShipToOutletID(dist.to_outlet_id || "");
    setShipToUserID(dist.sent_to_user_id || "");
    const docType = (dist.transfer_type || (dist as any).distribution_type || (dist as any).type || "outbound");
    setShipType(docType === "return" ? "return" : docType === "requisition" ? "requisition" : "outbound");
    setDriverName(dist.driver_name || "");
    setDriverPhone(dist.driver_phone || "");
    setVehiclePlate(dist.vehicle_plate || "");
    setCarrierType(dist.carrier_type || "internal_fleet");
    setTrackingRefNo(dist.tracking_ref_no || "");
    const costMode = ((dist.shipping_cost_mode as any) || "fixed");
    setShippingCostMode(costMode);
    setShippingCostPayer(dist.shipping_cost_payer || "origin");
    setShippingPaymentMethod(dist.shipping_payment_method || "cash");
    setMaxClaimBudget(dist.max_claim_budget || 0);

    // Parse breakdown if stored in notes
    let parsedBBM = 0;
    let parsedOngkir = 0;
    let parsedTol = 0;
    let parsedUangJalan = 0;
    let cleanNotes = dist.notes || "";

    if (cleanNotes.includes("[Rincian Biaya:")) {
      const match = cleanNotes.match(/\[Rincian Biaya:\s*([^\]]+)\]/);
      if (match && match[1]) {
        const parts = match[1].split(",");
        for (const p of parts) {
          const trimmed = p.trim();
          if (trimmed.startsWith("BBM:")) {
            parsedBBM = parseInt(trimmed.replace(/[^\d]/g, ""), 10) || 0;
          } else if (trimmed.startsWith("Ongkir:")) {
            parsedOngkir = parseInt(trimmed.replace(/[^\d]/g, ""), 10) || 0;
          } else if (trimmed.startsWith("Tol:")) {
            parsedTol = parseInt(trimmed.replace(/[^\d]/g, ""), 10) || 0;
          } else if (trimmed.startsWith("Uang Jalan:")) {
            parsedUangJalan = parseInt(trimmed.replace(/[^\d]/g, ""), 10) || 0;
          }
        }
      }
      cleanNotes = cleanNotes.replace(/\[Rincian Biaya:\s*[^\]]+\]/g, "").replace(/•\s*•/g, "•").replace(/^[•\s]+|[•\s]+$/g, "").trim();
    }

    if (parsedBBM > 0 || parsedOngkir > 0 || parsedTol > 0 || parsedUangJalan > 0) {
      setCostBBM(parsedBBM);
      setCostOngkir(parsedOngkir);
      setCostTolParkir(parsedTol);
      setCostUangJalan(parsedUangJalan);
    } else {
      setCostOngkir(Number(dist.shipping_cost) || 0);
      setCostBBM(0);
      setCostTolParkir(0);
      setCostUangJalan(0);
    }
    setShipNotes(cleanNotes);

    // Populate line items
    const rawItems: StockTransferItemLine[] = dist.items && dist.items.length > 0
      ? dist.items
      : (dist.item_id ? [{
          item_id: dist.item_id,
          item_name: dist.item_name || "Produk",
          item_sku: dist.item_sku || "",
          base_unit: dist.base_unit || "pcs",
          box_unit: dist.box_unit || "Dus",
          conversion_rate: dist.conversion_rate || 1,
          qty_sent_sealed: Number(dist.qty_sealed) || 0,
          qty_sent_loose: Number(dist.qty_loose) || 0,
          notes: dist.notes || "",
        }] : []);

    const lines: StockTransferItemLine[] = rawItems.map((it) => {
      const itmObj = items.find((i) => i.id === it.item_id);
      return {
        item_id: it.item_id,
        item_name: it.item_name || itmObj?.name || "Produk",
        item_sku: it.item_sku || itmObj?.sku || "",
        base_unit: it.base_unit || itmObj?.base_unit || "pcs",
        box_unit: it.box_unit || itmObj?.box_unit || "Dus",
        conversion_rate: it.conversion_rate || itmObj?.conversion_rate || 1,
        qty_requested_sealed: it.qty_requested_sealed !== undefined ? Number(it.qty_requested_sealed) : Number(it.qty_sent_sealed) || 0,
        qty_requested_loose: it.qty_requested_loose !== undefined ? Number(it.qty_requested_loose) : Number(it.qty_sent_loose) || 0,
        qty_sent_sealed: Number(it.qty_sent_sealed) || 0,
        qty_sent_loose: Number(it.qty_sent_loose) || 0,
        allocation_notes: it.allocation_notes || "",
        notes: it.notes || "",
        avail_sealed: itmObj?.qty_sealed || 0,
        avail_loose: itmObj?.qty_loose || 0,
        standard_cost: itmObj?.standard_cost || 0,
      };
    });

    setShipLines(lines);
    setWizardStep(1);
    setCurrentView("new");
    toast.info(`Membuka form Draf ${dist.transfer_no || "Transfer"} untuk dilanjutkan.`);
  };

  const QUOTA_ADJUSTMENT_PRESETS = [
    "Stok Pusat Menipis (Dibagi Rata Cabang)",
    "Penyesuaian Kapasitas Armada / Angkut",
    "Kenaikan Bertahap (Buffer Batch)",
    "Stok Menunggu Pasokan Supplier",
  ];

  // Auto-Suggest Reorder Handler (Pintar Odoo Way)
  const handleAutoSuggestReorder = async () => {
    const targetOutletId = shipToOutletID || (isStaffOrCashier ? (activeContext?.outlet_id || "") : "");
    if (!targetOutletId) {
      toast.error(language === "en" ? "Please select destination branch first" : "Pilih outlet cabang tujuan terlebih dahulu");
      return;
    }

    setIsAutoSuggestingReorder(true);
    try {
      const res = await api.get(`/transfers/suggest-reorder?outlet_id=${targetOutletId}`);
      const suggestions: any[] = res.data?.data || [];
      const needed = suggestions.filter((s) => (s.suggested_sealed > 0 || s.suggested_loose > 0));

      if (needed.length === 0) {
        toast.info(t.distSmartReorderOptimal || "Semua stok di outlet cabang masih dalam batas aman / di atas threshold minimum.");
        return;
      }

      const updatedLines = [...shipLines];
      let addedCount = 0;

      for (const sug of needed) {
        const existingIdx = updatedLines.findIndex((l) => l.item_id === sug.item_id);
        const itmObj = items.find((i) => i.id === sug.item_id);

        if (existingIdx >= 0) {
          updatedLines[existingIdx].qty_sent_sealed = sug.suggested_sealed;
          updatedLines[existingIdx].qty_sent_loose = sug.suggested_loose;
          if (isStaffOrCashier) {
            updatedLines[existingIdx].qty_requested_sealed = sug.suggested_sealed;
            updatedLines[existingIdx].qty_requested_loose = sug.suggested_loose;
          }
          if (sug.reason) {
            updatedLines[existingIdx].notes = sug.reason;
          }
        } else {
          updatedLines.push({
            item_id: sug.item_id,
            item_name: sug.item_name,
            item_sku: sug.item_sku,
            base_unit: sug.base_unit,
            box_unit: sug.box_unit || "Dus",
            conversion_rate: sug.conversion_rate || 1,
            qty_sent_sealed: sug.suggested_sealed,
            qty_sent_loose: sug.suggested_loose,
            qty_requested_sealed: isStaffOrCashier ? sug.suggested_sealed : undefined,
            qty_requested_loose: isStaffOrCashier ? sug.suggested_loose : undefined,
            notes: sug.reason || "",
            avail_sealed: itmObj?.qty_sealed || 0,
            avail_loose: itmObj?.qty_loose || 0,
            standard_cost: itmObj?.standard_cost || 0,
          });
          addedCount++;
        }
      }

      setShipLines(updatedLines);
      toast.success(
        (t.distSmartReorderSuccess || "{count} item kebutuhan pasokan berhasil dimuat berdasarkan kalkulasi threshold stok & kecepatan penjualan!")
          .replace("{count}", String(needed.length))
      );
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Gagal mengalkulasi saran reorder");
    } finally {
      setIsAutoSuggestingReorder(false);
    }
  };

  // Claim Rejection & Processing State (Detail Page)
  const [rejectDialogDist, setRejectDialogDist] = useState<DistributionItem | null>(null);
  const [rejectReason, setRejectReason] = useState<string>("");
  const [isProcessingClaim, setIsProcessingClaim] = useState<boolean>(false);

  // QR Data URL State for Print Slip
  const [slipQrDataUrl, setSlipQrDataUrl] = useState<string>("");

  // Edit Transfer & Cost State
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);
  const [editDist, setEditDist] = useState<DistributionItem | null>(null);
  const [editCarrierType, setEditCarrierType] = useState<string>("internal_fleet");
  const [editDriverName, setEditDriverName] = useState<string>("");
  const [editDriverPhone, setEditDriverPhone] = useState<string>("");
  const [editVehiclePlate, setEditVehiclePlate] = useState<string>("");
  const [editTrackingRefNo, setEditTrackingRefNo] = useState<string>("");
  const [editShippingCostMode, setEditShippingCostMode] = useState<"fixed" | "driver_claim" | "free">("fixed");
  const [editCostOngkir, setEditCostOngkir] = useState<number>(0);
  const [editCostBBM, setEditCostBBM] = useState<number>(0);
  const [editCostTolParkir, setEditCostTolParkir] = useState<number>(0);
  const [editCostUangJalan, setEditCostUangJalan] = useState<number>(0);
  const [editMaxClaimBudget, setEditMaxClaimBudget] = useState<number>(0);
  const [editShippingCostPayer, setEditShippingCostPayer] = useState<string>("origin");
  const [editShippingPaymentMethod, setEditShippingPaymentMethod] = useState<string>("cash");
  const [editNotes, setEditNotes] = useState<string>("");
  const [isEditingSubmitting, setIsEditingSubmitting] = useState<boolean>(false);

  const editTotalDirectCost = useMemo(() => {
    return (Number(editCostOngkir) || 0) + (Number(editCostBBM) || 0) + (Number(editCostTolParkir) || 0) + (Number(editCostUangJalan) || 0);
  }, [editCostOngkir, editCostBBM, editCostTolParkir, editCostUangJalan]);

  // Form State: Multi-item Shipment Creator (Page "new")

  // Handshake Receive Form State (Detail Page)
  const [receiveLines, setReceiveLines] = useState<{
    item_id: string;
    item_name: string;
    item_sku?: string;
    base_unit: string;
    box_unit: string;
    conversion_rate: number;
    qty_sent_sealed: number;
    qty_sent_loose: number;
    qty_received_sealed: number;
    qty_received_loose: number;
    mode: "sesuai" | "selisih";
  }[]>([]);
  const [recvNotes, setRecvNotes] = useState<string>("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const bizId = activeContext?.business_id;
      const isBranchOnly = activeContext?.outlet_id && !activeContext?.is_main_outlet;
      const transferUrl = isBranchOnly ? `/transfers?outlet_id=${activeContext.outlet_id}` : "/transfers";
      const [distRes, itemsRes, outletsRes, staffRes] = await Promise.all([
        api.get(transferUrl).catch(() => api.get("/transfers")).catch(() => api.get("/logistics/distributions")),
        api.get("/items?status=active"),
        api.get(`/organization/outlets${bizId ? `?business_id=${bizId}` : ""}`)
          .catch(() => api.get("/organization/outlets"))
          .catch(() => api.get("/outlets"))
          .catch(() => ({ data: [] })),
        api.get("/organization/staff").catch(() => api.get("/auth/staff")).catch(() => ({ data: [] })),
      ]);

      const distList: DistributionItem[] = Array.isArray(distRes.data) ? distRes.data : (distRes.data?.data || []);
      const itemsList = Array.isArray(itemsRes.data) ? itemsRes.data : (itemsRes.data?.data || []);
      const outletsList = Array.isArray(outletsRes.data) ? outletsRes.data : (outletsRes.data?.data || []);
      const staffList = Array.isArray(staffRes.data) ? staffRes.data : (staffRes.data?.data || []);

      setDistributions(distList);
      setItems(itemsList);
      setOutlets(outletsList);
      setStaffUsers(staffList);

      // Lock origin outlet strictly to active context
      const defaultOrigin = activeContext?.outlet_id || (outletsList.length > 0 ? outletsList[0].id : "");
      setShipFromOutletID(defaultOrigin);

      // Default destination to first available other outlet
      if (outletsList.length > 1) {
        const otherOutlet = outletsList.find((o: OutletSimple) => o.id !== defaultOrigin);
        if (otherOutlet) {
          setShipToOutletID(otherOutlet.id);
        }
      }
      return distList;
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal memuat data transfer logistik");
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeContext]);

  // Derived: Active Origin Outlet Object
  const originOutletObj = useMemo(() => {
    const found = outlets.find((o) => o.id === shipFromOutletID);
    if (found) return found;
    if (activeContext?.outlet_id) {
      const byContext = outlets.find((o) => o.id === activeContext.outlet_id);
      if (byContext) return byContext;
    }
    if (outlets.length > 0) return outlets[0];
    return {
      id: shipFromOutletID || activeContext?.outlet_id || "",
      name: activeContext?.outlet_name || activeContext?.name || "Gudang / Outlet Asal",
    };
  }, [outlets, shipFromOutletID, activeContext]);

  // Destination outlets (excluding origin outlet)
  const availableDestinations = useMemo(() => {
    return outlets.filter((o) => o.id !== shipFromOutletID);
  }, [outlets, shipFromOutletID]);

  // Derived: Active Destination Outlet Object
  const selectedDestinationObj = useMemo(() => {
    return outlets.find((o) => o.id === shipToOutletID) || (availableDestinations.length === 1 ? availableDestinations[0] : undefined);
  }, [outlets, shipToOutletID, availableDestinations]);

  // Auto-select destination outlet if only 1 exists
  useEffect(() => {
    if (availableDestinations.length === 1) {
      if (shipToOutletID !== availableDestinations[0].id) {
        setShipToOutletID(availableDestinations[0].id);
      }
    } else if (availableDestinations.length > 1 && (!shipToOutletID || !availableDestinations.some((d) => d.id === shipToOutletID))) {
      setShipToOutletID(availableDestinations[0].id);
    }
  }, [availableDestinations, shipToOutletID]);

  // Item Selector Modal State
  const [isItemPickerOpen, setIsItemPickerOpen] = useState<boolean>(false);
  const handleOpenItemPicker = () => setIsItemPickerOpen(true);

  // Apply selected items from ItemSelectorModal to Manifest Lines
  const handleApplySelectedItems = (selectedIds: string[]) => {
    const newLines: StockTransferItemLine[] = [];

    // Keep existing lines if they remain selected
    for (const line of shipLines) {
      if (selectedIds.includes(line.item_id)) {
        newLines.push(line);
      }
    }

    // Add newly selected items with default 0 quantities
    for (const id of selectedIds) {
      const alreadyIn = newLines.some((l) => l.item_id === id);
      if (!alreadyIn) {
        const itemObj = items.find((i) => i.id === id);
        if (itemObj) {
          newLines.push({
            item_id: itemObj.id,
            item_name: itemObj.name,
            item_sku: itemObj.sku,
            base_unit: itemObj.base_unit || "pcs",
            box_unit: itemObj.box_unit || "Dus",
            conversion_rate: itemObj.conversion_rate || 1,
            qty_sent_sealed: 0,
            qty_sent_loose: 0,
            notes: "",
            avail_sealed: itemObj.qty_sealed || 0,
            avail_loose: itemObj.qty_loose || 0,
            standard_cost: itemObj.standard_cost || 0,
          });
        }
      }
    }

    setShipLines(newLines);
    toast.success(`${newLines.length} item muatan siap dikonfigurasi`);
  };

  // Remove single line from draft
  const handleRemoveShipLine = (index: number) => {
    setShipLines(shipLines.filter((_, i) => i !== index));
  };

  // Update specific line field
  const handleUpdateShipLine = (index: number, field: keyof StockTransferItemLine, value: any) => {
    const updated = [...shipLines];
    updated[index] = { ...updated[index], [field]: value };
    setShipLines(updated);
  };

  // Set maximum stock for a line item
  const handleSetMaxStock = (index: number) => {
    const line = shipLines[index];
    const itmObj = items.find((i) => i.id === line.item_id);
    if (!itmObj) return;

    const isDualUom = (itmObj.conversion_rate || 1) > 1 && !!itmObj.box_unit;

    const updated = [...shipLines];
    if (isDualUom) {
      updated[index] = {
        ...updated[index],
        qty_sent_sealed: itmObj.qty_sealed || 0,
        qty_sent_loose: itmObj.qty_loose || 0,
      };
    } else {
      updated[index] = {
        ...updated[index],
        qty_sent_sealed: 0,
        qty_sent_loose: (itmObj.qty_loose || 0) || (itmObj.qty_sealed || 0),
      };
    }
    setShipLines(updated);
  };

  // Summary calculation for Creator
  const creationSummary = useMemo(() => {
    let totalSealed = 0;
    let totalLoose = 0;
    let totalItemsCount = 0;
    let totalCostEst = 0;
    let hasStockOverage = false;
    let hasZeroQuantity = false;

    for (const itm of shipLines) {
      const itmObj = items.find((i) => i.id === itm.item_id);
      const isDualUom = (itmObj?.conversion_rate || 1) > 1 && !!itmObj?.box_unit;

      const sealed = Number(itm.qty_sent_sealed) || 0;
      const loose = Number(itm.qty_sent_loose) || 0;

      if (sealed > 0 || loose > 0) {
        totalItemsCount++;
        totalSealed += sealed;
        totalLoose += loose;

        if (itmObj) {
          const conv = itmObj.conversion_rate || 1;
          const totalBaseUnits = (sealed * conv) + loose;
          totalCostEst += totalBaseUnits * (itmObj.standard_cost || 0);

          if (isDualUom) {
            if (sealed > (itmObj.qty_sealed || 0) || loose > (itmObj.qty_loose || 0)) {
              hasStockOverage = true;
            }
          } else {
            const avail = (itmObj.qty_loose || 0) || (itmObj.qty_sealed || 0);
            if (loose > avail) {
              hasStockOverage = true;
            }
          }
        }
      } else {
        hasZeroQuantity = true;
      }
    }

    return { totalItemsCount, totalSealed, totalLoose, totalCostEst, hasStockOverage, hasZeroQuantity };
  }, [shipLines, items]);

  // Handle Save Transfer as Draft (Tanpa Memotong Stok Gudang Asal)
  const handleSaveDraft = async (redirectAfterSave = true) => {
    if (shipLines.length === 0) {
      toast.error("Pilih minimal 1 barang untuk disimpan ke dalam Draf Rencana");
      return false;
    }

    const validLines = shipLines.filter(
      (line) => line.item_id
    );

    if (validLines.length === 0) {
      toast.error("Pilih minimal 1 barang untuk disimpan ke dalam draf");
      return false;
    }

    if (!shipToOutletID) {
      toast.error("Pilih outlet tujuan pengiriman");
      return false;
    }

    if (shipFromOutletID === shipToOutletID) {
      toast.error("Outlet asal dan tujuan tidak boleh sama");
      return false;
    }

    setIsSubmitting(true);
    try {
      const breakdownItems: string[] = [];
      if (costBBM > 0) breakdownItems.push(`BBM: Rp ${costBBM.toLocaleString("id-ID")}`);
      if (costOngkir > 0) breakdownItems.push(`Ongkir: Rp ${costOngkir.toLocaleString("id-ID")}`);
      if (costTolParkir > 0) breakdownItems.push(`Tol: Rp ${costTolParkir.toLocaleString("id-ID")}`);
      if (costUangJalan > 0) breakdownItems.push(`Uang Jalan: Rp ${costUangJalan.toLocaleString("id-ID")}`);

      let combinedNotes = shipNotes ? shipNotes.trim() : "";
      if (shippingCostMode === "fixed" && breakdownItems.length > 0) {
        const costStr = `[Rincian Biaya: ${breakdownItems.join(", ")}]`;
        combinedNotes = combinedNotes ? `${combinedNotes} • ${costStr}` : costStr;
      }

      const directSum = (Number(costOngkir) || 0) + (Number(costBBM) || 0) + (Number(costTolParkir) || 0) + (Number(costUangJalan) || 0);

      const payload = {
        from_outlet_id: shipFromOutletID || undefined,
        to_outlet_id: shipToOutletID || undefined,
        sent_to_user_id: shipToUserID || undefined,
        driver_name: driverName || undefined,
        driver_phone: driverPhone || undefined,
        vehicle_plate: vehiclePlate || undefined,
        carrier_type: carrierType || "internal_fleet",
        shipping_cost: shippingCostMode === "fixed" ? directSum : 0,
        shipping_cost_payer: shippingCostPayer || "origin",
        shipping_payment_method: shippingPaymentMethod || "cash",
        tracking_ref_no: trackingRefNo || undefined,
        shipping_cost_mode: shippingCostMode,
        max_claim_budget: shippingCostMode === "driver_claim" ? (Number(maxClaimBudget) || 0) : 0,
        transfer_type: shipType,
        status: "draft",
        notes: combinedNotes || undefined,
        items: validLines.map((l) => ({
          item_id: l.item_id,
          qty_sent_sealed: Number(l.qty_sent_sealed) || 0,
          qty_sent_loose: Number(l.qty_sent_loose) || 0,
          notes: l.notes || undefined,
        })),
      };

      let res: any;
      if (editingTransferId) {
        try {
          res = await api.put(`/transfers/${editingTransferId}`, payload);
        } catch {
          res = await api.put(`/logistics/distributions/${editingTransferId}`, payload);
        }
      } else {
        res = await api.post("/transfers", payload);
      }

      const createdDraft = res.data?.data;
      toast.success(res.data?.message || (editingTransferId ? "Draf rencana distribusi berhasil diperbarui" : "Draf rencana distribusi berhasil disimpan (Stok belum dipotong)"));

      // Reset form
      setEditingTransferId(null);
      setShipLines([]);
      setShipNotes("");
      setDriverName("");
      setDriverPhone("");
      setVehiclePlate("");
      setCostOngkir(0);
      setCostBBM(0);
      setCostTolParkir(0);
      setCostUangJalan(0);
      setShippingCost(0);
      setMaxClaimBudget(0);
      setShippingCostMode("fixed");
      setShippingCostPayer("origin");
      setShippingPaymentMethod("cash");
      setTrackingRefNo("");
      setWizardStep(1);
      setShowExitConfirmDialog(false);

      await fetchData();

      if (redirectAfterSave) {
        setCurrentView("master");
      }
      return true;
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Gagal menyimpan draf distribusi");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Create Multi-Item Shipment (Official Delivery Order - Deduct Stock Immediately)
  const handleCreateShipment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (shipLines.length === 0) {
      toast.error("Pilih minimal 1 barang untuk dimuat ke dalam Surat Jalan");
      return;
    }

    const validLines = shipLines.filter(
      (line) => line.item_id && (line.qty_sent_sealed > 0 || line.qty_sent_loose > 0)
    );

    if (validLines.length === 0) {
      toast.error("Isi kuantitas kirim pada minimal 1 barang");
      return;
    }

    if (!shipToOutletID) {
      toast.error("Pilih outlet tujuan penerima surat jalan");
      return;
    }

    if (shipFromOutletID === shipToOutletID) {
      toast.error("Outlet asal dan tujuan tidak boleh sama");
      return;
    }

    if (!isStaffOrCashier && creationSummary.hasStockOverage) {
      toast.error("Kuantitas kirim melebihi sisa stok di gudang asal. Harap sesuaikan.");
      return;
    }

    setIsSubmitting(true);
    try {
      const breakdownItems: string[] = [];
      if (costBBM > 0) breakdownItems.push(`BBM: Rp ${costBBM.toLocaleString("id-ID")}`);
      if (costOngkir > 0) breakdownItems.push(`Ongkir: Rp ${costOngkir.toLocaleString("id-ID")}`);
      if (costTolParkir > 0) breakdownItems.push(`Tol: Rp ${costTolParkir.toLocaleString("id-ID")}`);
      if (costUangJalan > 0) breakdownItems.push(`Uang Jalan: Rp ${costUangJalan.toLocaleString("id-ID")}`);

      let combinedNotes = shipNotes ? shipNotes.trim() : "";
      if (shippingCostMode === "fixed" && breakdownItems.length > 0) {
        const costStr = `[Rincian Biaya: ${breakdownItems.join(", ")}]`;
        combinedNotes = combinedNotes ? `${combinedNotes} • ${costStr}` : costStr;
      }

      const directSum = (Number(costOngkir) || 0) + (Number(costBBM) || 0) + (Number(costTolParkir) || 0) + (Number(costUangJalan) || 0);

      const targetStatus = isStaffOrCashier ? "pending_approval" : "in_transit";

      const payload = {
        from_outlet_id: shipFromOutletID || undefined,
        to_outlet_id: shipToOutletID || undefined,
        sent_to_user_id: shipToUserID || undefined,
        driver_name: driverName || undefined,
        driver_phone: driverPhone || undefined,
        vehicle_plate: vehiclePlate || undefined,
        carrier_type: carrierType || "internal_fleet",
        shipping_cost: shippingCostMode === "fixed" ? directSum : 0,
        shipping_cost_payer: shippingCostPayer || "origin",
        shipping_payment_method: shippingPaymentMethod || "cash",
        tracking_ref_no: trackingRefNo || undefined,
        shipping_cost_mode: shippingCostMode,
        max_claim_budget: shippingCostMode === "driver_claim" ? (Number(maxClaimBudget) || 0) : 0,
        transfer_type: shipType,
        status: targetStatus,
        notes: combinedNotes || undefined,
        create_backorder: createBackorder,
        items: validLines.map((l) => ({
          item_id: l.item_id,
          qty_sent_sealed: Number(l.qty_sent_sealed) || 0,
          qty_sent_loose: Number(l.qty_sent_loose) || 0,
          qty_requested_sealed: l.qty_requested_sealed !== undefined ? Number(l.qty_requested_sealed) : undefined,
          qty_requested_loose: l.qty_requested_loose !== undefined ? Number(l.qty_requested_loose) : undefined,
          allocation_notes: l.allocation_notes || undefined,
          notes: l.notes || undefined,
        })),
      };

      let res: any;
      if (editingTransferId) {
        try {
          res = await api.put(`/transfers/${editingTransferId}`, payload);
        } catch {
          res = await api.put(`/logistics/distributions/${editingTransferId}`, payload);
        }
      } else {
        res = await api.post("/transfers", payload);
      }

      const createdDist = res.data?.data;
      toast.success(
        res.data?.message ||
          (isStaffOrCashier
            ? "Permintaan pasokan stok berhasil diajukan ke gudang pusat!"
            : editingTransferId
            ? "Surat Jalan pengiriman berhasil disetujui & diterbitkan (Stok terpotong)!"
            : (t.logisticsShipmentSuccess || "Surat Jalan pengiriman berhasil diterbitkan!"))
      );

      // Reset form
      setEditingTransferId(null);
      setShipLines([]);
      setShipNotes("");
      setDriverName("");
      setDriverPhone("");
      setVehiclePlate("");
      setCostOngkir(0);
      setCostBBM(0);
      setCostTolParkir(0);
      setCostUangJalan(0);
      setShippingCost(0);
      setMaxClaimBudget(0);
      setShippingCostMode("fixed");
      setShippingCostPayer("origin");
      setShippingPaymentMethod("cash");
      setTrackingRefNo("");
      setWizardStep(1);

      const updatedList = await fetchData();
      const freshRecord = updatedList?.find((d) => d.id === createdDist?.id) || createdDist;

      if (freshRecord) {
        setSelectedTransfer(freshRecord);
        setCurrentView("detail");
      } else {
        setCurrentView("master");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Gagal menerbitkan surat jalan pengiriman");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate QR Code for Print Slip when opened
  useEffect(() => {
    if (printSlipDist && printSlipDist.shipping_cost_mode === "driver_claim" && printSlipDist.claim_token) {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const claimUrl = `${origin}/claim/${printSlipDist.claim_token}`;
      QRCode.toDataURL(claimUrl, { width: 140, margin: 1, errorCorrectionLevel: "M" })
        .then((url: string) => setSlipQrDataUrl(url))
        .catch(() => setSlipQrDataUrl(""));
    } else {
      setSlipQrDataUrl("");
    }
  }, [printSlipDist]);

  // Open Edit Dialog for Transfer
  const handleOpenEdit = (dist: DistributionItem) => {
    setEditDist(dist);
    setEditCarrierType(dist.carrier_type || "internal_fleet");
    setEditDriverName(dist.driver_name || "");
    setEditDriverPhone(dist.driver_phone || "");
    setEditVehiclePlate(dist.vehicle_plate || "");
    setEditTrackingRefNo(dist.tracking_ref_no || "");
    const mode = (dist.shipping_cost_mode as any) || "fixed";
    setEditShippingCostMode(mode);
    setEditMaxClaimBudget(dist.max_claim_budget || 0);
    setEditShippingCostPayer(dist.shipping_cost_payer || "origin");
    setEditShippingPaymentMethod(dist.shipping_payment_method || "cash");
    setEditNotes(dist.notes || "");

    const cost = Number(dist.shipping_cost) || 0;
    // Parse components if available in notes e.g. [Rincian Biaya: BBM: Rp 20.000, Ongkir: Rp 50.000]
    let parsedBBM = 0;
    let parsedOngkir = 0;
    let parsedTol = 0;
    let parsedUangJalan = 0;

    if (dist.notes && dist.notes.includes("[Rincian Biaya:")) {
      const match = dist.notes.match(/\[Rincian Biaya:\s*([^\]]+)\]/);
      if (match && match[1]) {
        const parts = match[1].split(",");
        for (const p of parts) {
          const trimmed = p.trim();
          if (trimmed.startsWith("BBM:")) {
            parsedBBM = parseInt(trimmed.replace(/[^\d]/g, ""), 10) || 0;
          } else if (trimmed.startsWith("Ongkir:")) {
            parsedOngkir = parseInt(trimmed.replace(/[^\d]/g, ""), 10) || 0;
          } else if (trimmed.startsWith("Tol:")) {
            parsedTol = parseInt(trimmed.replace(/[^\d]/g, ""), 10) || 0;
          } else if (trimmed.startsWith("Uang Jalan:")) {
            parsedUangJalan = parseInt(trimmed.replace(/[^\d]/g, ""), 10) || 0;
          }
        }
      }
    }

    if (parsedBBM > 0 || parsedOngkir > 0 || parsedTol > 0 || parsedUangJalan > 0) {
      setEditCostBBM(parsedBBM);
      setEditCostOngkir(parsedOngkir);
      setEditCostTolParkir(parsedTol);
      setEditCostUangJalan(parsedUangJalan);
    } else {
      setEditCostOngkir(cost);
      setEditCostBBM(0);
      setEditCostTolParkir(0);
      setEditCostUangJalan(0);
    }

    setIsEditDialogOpen(true);
  };

  // Save Edit Transfer Changes
  const handleSaveEdit = async () => {
    if (!editDist) return;
    setIsEditingSubmitting(true);
    try {
      const editDirectSum = (Number(editCostOngkir) || 0) + (Number(editCostBBM) || 0) + (Number(editCostTolParkir) || 0) + (Number(editCostUangJalan) || 0);

      const breakdownItems: string[] = [];
      if (editCostBBM > 0) breakdownItems.push(`BBM: Rp ${editCostBBM.toLocaleString("id-ID")}`);
      if (editCostOngkir > 0) breakdownItems.push(`Ongkir: Rp ${editCostOngkir.toLocaleString("id-ID")}`);
      if (editCostTolParkir > 0) breakdownItems.push(`Tol: Rp ${editCostTolParkir.toLocaleString("id-ID")}`);
      if (editCostUangJalan > 0) breakdownItems.push(`Uang Jalan: Rp ${editCostUangJalan.toLocaleString("id-ID")}`);

      let combinedNotes = editNotes ? editNotes.trim() : "";
      if (editShippingCostMode === "fixed" && breakdownItems.length > 0) {
        // Strip previous [Rincian Biaya: ...] if present to prevent duplication
        const cleanBase = combinedNotes.replace(/\[Rincian Biaya: [^\]]+\]/g, "").replace(/•\s*•/g, "•").trim();
        const costStr = `[Rincian Biaya: ${breakdownItems.join(", ")}]`;
        combinedNotes = cleanBase ? `${cleanBase} • ${costStr}` : costStr;
      }

      const payload = {
        driver_name: editDriverName || "",
        driver_phone: editDriverPhone || "",
        vehicle_plate: editVehiclePlate || "",
        carrier_type: editCarrierType || "internal_fleet",
        tracking_ref_no: editTrackingRefNo || "",
        shipping_cost: editShippingCostMode === "fixed" ? editDirectSum : 0,
        shipping_cost_mode: editShippingCostMode,
        shipping_cost_payer: editShippingCostPayer || "origin",
        shipping_payment_method: editShippingPaymentMethod || "cash",
        max_claim_budget: editShippingCostMode === "driver_claim" ? (Number(editMaxClaimBudget) || 0) : 0,
        notes: combinedNotes,
      };

      let res: any;
      try {
        res = await api.put(`/transfers/${editDist.id}`, payload);
      } catch {
        try {
          res = await api.post(`/transfers/${editDist.id}/update`, payload);
        } catch {
          res = await api.put(`/logistics/distributions/${editDist.id}`, payload);
        }
      }
      const updatedTransfer = res?.data?.data;

      toast.success(res.data?.message || (t.distEditSuccess || "Data pengiriman dan biaya berhasil diperbarui!"));
      setIsEditDialogOpen(false);

      if (updatedTransfer) {
        if (selectedTransfer?.id === editDist.id) {
          setSelectedTransfer(updatedTransfer);
        }
        setDistributions((prev) =>
          prev.map((d) => (d.id === editDist.id ? updatedTransfer : d))
        );
      } else {
        await fetchData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Gagal memperbarui data pengiriman");
    } finally {
      setIsEditingSubmitting(false);
    }
  };

  // Handle Manager Approving Driver Claim
  const handleApproveClaim = async (transferId: string) => {
    setIsProcessingClaim(true);
    try {
      await api.post(`/transfers/${transferId}/claim/approve`);
      toast.success("Klaim biaya perjalanan kurir berhasil disetujui!");
      await fetchData();
      const updatedList = await api.get("/transfers").catch(() => api.get("/logistics/distributions"));
      const listData = Array.isArray(updatedList.data) ? updatedList.data : (updatedList.data?.data || []);
      const found = listData.find((d: DistributionItem) => d.id === transferId);
      if (found) setSelectedTransfer(found);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menyetujui klaim kurir");
    } finally {
      setIsProcessingClaim(false);
    }
  };

  // Handle Manager Confirming Rejection of Driver Claim
  const handleConfirmRejectClaim = async () => {
    if (!rejectDialogDist) return;
    if (!rejectReason.trim()) {
      toast.error(t.distRejectReasonTitle || "Alasan penolakan klaim wajib diisi");
      return;
    }
    setIsProcessingClaim(true);
    try {
      await api.post(`/transfers/${rejectDialogDist.id}/claim/reject`, { reason: rejectReason });
      toast.success(t.distClaimStatusRejected || "Klaim biaya kurir telah ditolak");
      const targetId = rejectDialogDist.id;
      setRejectDialogDist(null);
      setRejectReason("");
      await fetchData();
      const updatedList = await api.get("/transfers").catch(() => api.get("/logistics/distributions"));
      const listData = Array.isArray(updatedList.data) ? updatedList.data : (updatedList.data?.data || []);
      const found = listData.find((d: DistributionItem) => d.id === targetId);
      if (found) setSelectedTransfer(found);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menolak klaim");
    } finally {
      setIsProcessingClaim(false);
    }
  };

  // Sync receiveLines whenever selectedTransfer changes
  useEffect(() => {
    if (selectedTransfer) {
      const rawItems: StockTransferItemLine[] = selectedTransfer.items && selectedTransfer.items.length > 0
        ? selectedTransfer.items
        : [{
            id: selectedTransfer.id,
            item_id: selectedTransfer.item_id || "",
            item_name: selectedTransfer.item_name || "Produk",
            item_sku: selectedTransfer.item_sku || "",
            base_unit: selectedTransfer.base_unit || "pcs",
            box_unit: selectedTransfer.box_unit || "Dus",
            conversion_rate: selectedTransfer.conversion_rate || 1,
            qty_sent_sealed: selectedTransfer.qty_sealed || 0,
            qty_sent_loose: selectedTransfer.qty_loose || 0,
            qty_received_sealed: selectedTransfer.qty_received_sealed,
            qty_received_loose: selectedTransfer.qty_received_loose,
            shrinkage_qty: selectedTransfer.shrinkage_qty,
            notes: selectedTransfer.notes || "",
          }];

      setReceiveLines(
        rawItems.map((it) => {
          const sentSealed = Number(it.qty_sent_sealed) || 0;
          const sentLoose = Number(it.qty_sent_loose) || 0;
          const isFinished = selectedTransfer.status === "received";
          const recvSealed = it.qty_received_sealed !== undefined && it.qty_received_sealed !== null
            ? Number(it.qty_received_sealed)
            : (isFinished ? sentSealed : sentSealed);
          const recvLoose = it.qty_received_loose !== undefined && it.qty_received_loose !== null
            ? Number(it.qty_received_loose)
            : (isFinished ? sentLoose : sentLoose);
          const isDiff = recvSealed !== sentSealed || recvLoose !== sentLoose;

          return {
            item_id: it.item_id || "",
            item_name: it.item_name || "Produk",
            item_sku: it.item_sku || "",
            base_unit: it.base_unit || "pcs",
            box_unit: it.box_unit || "Dus",
            conversion_rate: it.conversion_rate || 1,
            qty_sent_sealed: sentSealed,
            qty_sent_loose: sentLoose,
            qty_received_sealed: recvSealed,
            qty_received_loose: recvLoose,
            mode: isDiff ? "selisih" : "sesuai",
          };
        })
      );
      setRecvNotes(selectedTransfer.notes || "");
    }
  }, [selectedTransfer]);

  // Navigate directly to Detail View for Handshake (No popup modal needed)
  const handleOpenHandshake = (dist: DistributionItem) => {
    setSelectedTransfer(dist);
    setCurrentView("detail");
  };

  // Toggle single line between Sesuai (Intact) and Selisih (Variance)
  const handleToggleLineMode = (index: number, newMode: "sesuai" | "selisih") => {
    setReceiveLines((prev) => {
      const updated = [...prev];
      if (newMode === "sesuai") {
        updated[index] = {
          ...updated[index],
          mode: "sesuai",
          qty_received_sealed: updated[index].qty_sent_sealed,
          qty_received_loose: updated[index].qty_sent_loose,
        };
      } else {
        updated[index] = {
          ...updated[index],
          mode: "selisih",
        };
      }
      return updated;
    });
  };

  // 1-Click: Set all lines to Sesuai (100% Intact)
  const handleSetAllSesuai = () => {
    setReceiveLines((prev) =>
      prev.map((l) => ({
        ...l,
        mode: "sesuai",
        qty_received_sealed: l.qty_sent_sealed,
        qty_received_loose: l.qty_sent_loose,
      }))
    );
    toast.info(t.distReceiveAllIntactToast || "Seluruh kuantitas terima disetel 100% sesuai kuantitas kirim");
  };

  // Update specific quantity for a line item
  const handleUpdateReceiveQty = (
    index: number,
    field: "qty_received_sealed" | "qty_received_loose",
    val: number
  ) => {
    setReceiveLines((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: Math.max(0, val || 0),
      };
      return updated;
    });
  };

  // Real-time summary for Detail Handshake
  const receiveSummary = useMemo(() => {
    let totalItems = receiveLines.length;
    let totalSentSealed = 0;
    let totalSentLoose = 0;
    let totalRecvSealed = 0;
    let totalRecvLoose = 0;
    let totalShrinkageSealed = 0;
    let totalShrinkageLoose = 0;
    let hasOverage = false;

    for (const l of receiveLines) {
      totalSentSealed += Number(l.qty_sent_sealed) || 0;
      totalSentLoose += Number(l.qty_sent_loose) || 0;
      totalRecvSealed += Number(l.qty_received_sealed) || 0;
      totalRecvLoose += Number(l.qty_received_loose) || 0;

      if (l.qty_received_sealed > l.qty_sent_sealed || l.qty_received_loose > l.qty_sent_loose) {
        hasOverage = true;
      }

      if (l.qty_received_sealed < l.qty_sent_sealed) {
        totalShrinkageSealed += (l.qty_sent_sealed - l.qty_received_sealed);
      }
      if (l.qty_received_loose < l.qty_sent_loose) {
        totalShrinkageLoose += (l.qty_sent_loose - l.qty_received_loose);
      }
    }

    const isAllIntact = totalShrinkageSealed === 0 && totalShrinkageLoose === 0 && !hasOverage;
    return {
      totalItems,
      totalSentSealed,
      totalSentLoose,
      totalRecvSealed,
      totalRecvLoose,
      totalShrinkageSealed,
      totalShrinkageLoose,
      hasOverage,
      isAllIntact,
    };
  }, [receiveLines]);

  // Handle Handshake Receive Confirm in Detail View
  const handleConfirmReceiveDetail = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedTransfer) return;

    if (receiveSummary.hasOverage) {
      toast.error(t.distReceiveOverageError || "Kuantitas terima tidak boleh melebihi kuantitas kirim. Harap periksa kembali.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        notes: recvNotes || undefined,
        items: receiveLines.map((l) => ({
          item_id: l.item_id,
          qty_received_sealed: Number(l.qty_received_sealed) || 0,
          qty_received_loose: Number(l.qty_received_loose) || 0,
        })),
      };

      const res = await api.post(`/transfers/${selectedTransfer.id}/receive`, payload);
      toast.success(res.data?.message || (t.logisticsReceiveSuccess || "Serah terima barang berhasil dikonfirmasi!"));

      // Refresh master list and update local selectedTransfer
      const updatedList = await api.get("/transfers").catch(() => api.get("/logistics/distributions"));
      const listData = Array.isArray(updatedList.data) ? updatedList.data : (updatedList.data?.data || []);
      setDistributions(listData);

      const found = listData.find((d: DistributionItem) => d.id === selectedTransfer.id);
      if (found) {
        setSelectedTransfer(found);
      } else {
        setSelectedTransfer({
          ...selectedTransfer,
          status: "received",
          received_at: new Date().toISOString(),
          received_by_user_name: activeContext?.name || "Petugas Cabang",
          items: receiveLines.map((l) => ({
            ...l,
            qty_received_sealed: l.qty_received_sealed,
            qty_received_loose: l.qty_received_loose,
            shrinkage_qty: ((l.qty_sent_sealed - l.qty_received_sealed) * l.conversion_rate) + (l.qty_sent_loose - l.qty_received_loose),
          })),
        });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Gagal mengonfirmasi penerimaan barang");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Scoped Distributions (Strict Branch Outlet Isolation)
  const scopedDistributions = useMemo(() => {
    if (isBranchScoped && activeContext?.outlet_id) {
      const branchId = activeContext.outlet_id;
      return distributions.filter((d) => d.from_outlet_id === branchId || d.to_outlet_id === branchId);
    }
    return distributions;
  }, [distributions, isBranchScoped, activeContext]);

  // Filtered Distributions for Master Table
  const filteredDistributions = useMemo(() => {
    return scopedDistributions.filter((d) => {
      // Status filter
      if (selectedStatuses.length > 0) {
        const matchesStatus = selectedStatuses.some((st) => {
          if (st === "in_transit") return d.status === "in_transit" || d.status === "sent";
          if (st === "received") return d.status === "received";
          if (st === "returned") return d.distribution_type === "return" || d.type === "return" || d.transfer_type === "return" || d.status === "returned";
          return d.status === st;
        });
        if (!matchesStatus) return false;
      }

      // Document Type filter (outbound vs return)
      if (selectedTypes.length > 0) {
        const isReturn = d.distribution_type === "return" || d.type === "return" || d.transfer_type === "return";
        const docType = isReturn ? "return" : "outbound";
        if (!selectedTypes.includes(docType)) return false;
      }

      // Carrier Type filter
      if (selectedCarriers.length > 0) {
        const carrier = d.carrier_type || "internal_fleet";
        if (!selectedCarriers.includes(carrier)) return false;
      }

      // Origin Outlet filter
      if (selectedOriginOutlets.length > 0) {
        if (!selectedOriginOutlets.includes(d.from_outlet_id || "")) return false;
      }

      // Destination Outlet filter
      if (selectedDestOutlets.length > 0) {
        if (!selectedDestOutlets.includes(d.to_outlet_id || "")) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNo = (d.transfer_no || "").toLowerCase().includes(q);
        const matchItem = (d.item_name || "").toLowerCase().includes(q);
        const matchSKU = (d.item_sku || "").toLowerCase().includes(q);
        const matchFrom = (d.from_outlet_name || "").toLowerCase().includes(q);
        const matchTo = (d.to_outlet_name || "").toLowerCase().includes(q);
        const matchDriver = (d.driver_name || "").toLowerCase().includes(q) || (d.vehicle_plate || "").toLowerCase().includes(q);
        const matchLineItems = (d.items || []).some(
          (it) => (it.item_name || "").toLowerCase().includes(q) || (it.item_sku || "").toLowerCase().includes(q)
        );
        return matchNo || matchItem || matchSKU || matchFrom || matchTo || matchDriver || matchLineItems;
      }
      return true;
    });
  }, [scopedDistributions, selectedStatuses, selectedTypes, selectedCarriers, selectedOriginOutlets, selectedDestOutlets, searchQuery]);

  // KPI Counts (Computed strictly from scoped distribution view)
  const countInTransit = scopedDistributions.filter((d) => d.status === "in_transit" || d.status === "sent").length;
  const countReceived = scopedDistributions.filter((d) => d.status === "received").length;
  const countReturned = scopedDistributions.filter((d) => d.distribution_type === "return" || d.type === "return" || d.transfer_type === "return" || d.status === "returned").length;

  // Distribution Table Columns
  const distributionColumns: ColumnDef<DistributionItem>[] = [
    {
      key: "transfer_no",
      label: t.logisticsTransferNo || "No. Surat Jalan & Waktu",
      renderCell: (d: DistributionItem) => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-extrabold text-xs text-slate-900 dark:text-white">
              {d.transfer_no || `SJ-${d.id.slice(0, 8).toUpperCase()}`}
            </span>
            {d.transfer_type === "return" || d.distribution_type === "return" || d.type === "return" ? (
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400">
                {t.distReturnBadge || "Retur"}
              </span>
            ) : d.transfer_type === "requisition" ? (
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">
                Permintaan Cabang
              </span>
            ) : (
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
                {t.distOutboundBadge || "Pasokan Pusat"}
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {new Date(d.sent_at || d.created_at).toLocaleString(language === "en" ? "en-US" : "id-ID", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      ),
    },
    {
      key: "route",
      label: t.logisticsRoute || "Rute Distribusi",
      renderCell: (d: DistributionItem) => (
        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold text-slate-700 dark:text-slate-300">
            {d.from_outlet_name || (language === "en" ? "Central Warehouse" : "Gudang Pusat")}
          </span>
          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="font-extrabold text-brand-purple dark:text-primary">
            {d.to_outlet_name || (language === "en" ? "Branch Outlet" : "Outlet Cabang")}
          </span>
        </div>
      ),
    },
    {
      key: "items_summary",
      label: t.distColItemsLoaded || "Muatan Barang",
      renderCell: (d: DistributionItem) => {
        const lines = d.items && d.items.length > 0
          ? d.items
          : (d.item_name ? [{ item_id: d.item_id || "", item_name: d.item_name, qty_sent_sealed: d.qty_sealed || 0, qty_sent_loose: d.qty_loose || 0, box_unit: d.box_unit, base_unit: d.base_unit }] : []);

        if (lines.length === 0) {
          return <span className="text-xs text-slate-400 italic">Tidak ada item</span>;
        }

        const first = lines[0];
        const firstItemObj = itemMap.get(first.item_id);
        const firstName = first.item_name || firstItemObj?.name || d.item_name || (language === "en" ? "Product" : "Produk");
        const moreCount = lines.length - 1;
        const cascadeItems = lines.slice(0, 3);

        return (
          <div className="flex items-center gap-3 min-w-[200px] max-w-[340px]">
            {/* 1. Overlapping Photo Cascade / Avatar Stack */}
            <div className="flex items-center -space-x-2.5 overflow-hidden py-0.5 shrink-0">
              {cascadeItems.map((line, idx) => {
                const itemObj = itemMap.get(line.item_id);
                const imgUrl = line.image_url || itemObj?.image_url;
                const name = line.item_name || itemObj?.name || `Item ${idx + 1}`;

                return (
                  <div
                    key={line.id || line.item_id || idx}
                    title={name}
                    className="relative w-8 h-8 rounded-full ring-2 ring-white dark:ring-[#202024] bg-slate-100 dark:bg-white/10 overflow-hidden shrink-0 shadow-2xs"
                  >
                    <ErpImage
                      src={imgUrl}
                      alt={name}
                      className="w-full h-full object-cover"
                      fallbackType="product"
                    />
                  </div>
                );
              })}
              {lines.length > 3 && (
                <div
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full text-[10px] font-extrabold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 ring-2 ring-white dark:ring-[#202024] shrink-0 shadow-2xs"
                  title={`${lines.length - 3} item lainnya`}
                >
                  +{lines.length - 3}
                </div>
              )}
            </div>

            {/* 2. Text Content: First item name & secondary info */}
            <div className="space-y-0.5 text-xs truncate">
              <span className="font-extrabold text-slate-900 dark:text-slate-100 block truncate" title={firstName}>
                {firstName}
              </span>
              {moreCount > 0 ? (
                <span className="text-[10px] font-semibold text-brand-purple dark:text-[#E2FF66] block">
                  +{moreCount} {language === "en" ? "other items" : "barang lainnya"}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 block truncate">
                  {first.qty_sent_sealed > 0 ? `${first.qty_sent_sealed} ${first.box_unit || (language === "en" ? "Box" : "Dus")}` : ""}
                  {first.qty_sent_sealed > 0 && first.qty_sent_loose > 0 ? " • " : ""}
                  {first.qty_sent_loose > 0 ? `${first.qty_sent_loose} ${first.base_unit || "Pcs"}` : ""}
                  {first.qty_sent_sealed === 0 && first.qty_sent_loose === 0 ? "1 Muatan" : ""}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "driver",
      label: t.distColCarrier || "Armada / Kurir",
      renderCell: (d: DistributionItem) => (
        <div className="text-xs space-y-0.5">
          <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
            <Truck className="w-3 h-3 text-slate-400" />
            <span>{d.driver_name || d.sent_to_user_name || (language === "en" ? "Internal Fleet" : "Armada Internal")}</span>
          </div>
          {d.vehicle_plate && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/10 text-slate-500 block w-fit">
              {d.vehicle_plate}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "shipping_cost",
      label: t.distColShippingCost || "Ongkos Kirim",
      renderCell: (d: DistributionItem) => {
        const cost = Number(d.shipping_cost) || 0;
        if (cost <= 0) {
          return <span className="text-xs text-slate-400">-</span>;
        }
        return (
          <div className="text-xs space-y-0.5">
            <span className="font-extrabold text-slate-800 dark:text-slate-100 block">
              Rp {cost.toLocaleString("id-ID")}
            </span>
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
                {d.shipping_cost_payer === "destination"
                  ? (t.distPayerDestShort || "Tujuan")
                  : d.shipping_cost_payer === "central"
                  ? (t.distPayerCentralShort || "Pusat")
                  : (t.distPayerOriginShort || "Pengirim")}
              </span>
              <span className="text-[9px] text-slate-400">
                {d.shipping_payment_method === "bank_transfer"
                  ? "Transfer"
                  : d.shipping_payment_method === "on_account"
                  ? (t.distPaymentAccount || "Tagihan")
                  : "Tunai"}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      key: "status",
      label: t.logisticsStatus || "Status",
      renderCell: (d: DistributionItem) => {
        const isDraft = d.status === "draft";
        const isPending = d.status === "pending_approval";
        const isTransit = d.status === "in_transit" || d.status === "sent";
        const isRecv = d.status === "received";
        const isRet = d.status === "returned";
        const isCancelled = d.status === "cancelled";

        return (
          <div>
            {isDraft && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/10">
                <FileText className="w-3 h-3 text-slate-500" />
                <span>{t.logisticsStatusDraft || "Draf"}</span>
              </span>
            )}
            {isPending && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-purple-500/10 text-purple-600 border border-purple-500/20">
                <Clock className="w-3 h-3 text-purple-500" />
                <span>{t.logisticsStatusPending || "Menunggu"}</span>
              </span>
            )}
            {isTransit && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                <Truck className="w-3 h-3 animate-pulse" />
                <span>{t.logisticsStatusInTransit || "Transit"}</span>
              </span>
            )}
            {isRecv && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" />
                <span>{t.logisticsStatusReceived || "Diterima"}</span>
              </span>
            )}
            {isRet && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-red-500/10 text-red-600 border border-red-500/20">
                <RotateCcw className="w-3 h-3" />
                <span>{t.logisticsStatusReturned || "Retur"}</span>
              </span>
            )}
            {isCancelled && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-slate-100 dark:bg-white/5 text-slate-400 line-through">
                <span>{t.logisticsStatusCancelled || "Batal"}</span>
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "actions",
      label: "",
      align: "right",
      renderCell: (d: DistributionItem) => {
        const isDraft = d.status === "draft";
        const isTransit = d.status === "in_transit" || d.status === "sent";
        const isPending = d.status === "pending_approval";
        const canEdit = d.status === "in_transit" || d.status === "sent" || d.status === "pending_approval";
        const canPrint = d.status !== "draft";

        return (
          <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
            {/* Floating Action Popup Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="w-8 h-8 rounded-xl border border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#202024] hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 inline-flex items-center justify-center transition-colors focus:outline-none cursor-pointer shadow-2xs"
                title="Opsi & Aksi Surat Jalan"
              >
                <MoreVertical className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-2xl p-1.5 shadow-xl bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#38383C]">
                {isDraft || (isPending && isOwnerOrAdmin) ? (
                  <DropdownMenuItem
                    onClick={() => handleOpenEditDraft(d)}
                    className="gap-2.5 rounded-xl text-xs font-semibold text-brand-purple dark:text-[#E2FF66] cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>{isPending ? "Proses & Alokasikan Stok" : "Lanjutkan & Edit Draf"}</span>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => {
                      setSelectedTransfer(d);
                      setCurrentView("detail");
                    }}
                    className="gap-2.5 rounded-xl text-xs font-semibold cursor-pointer text-slate-700 dark:text-slate-200"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-500" />
                    <span>{t.distBtnViewDetail || "Lihat Rincian Surat Jalan"}</span>
                  </DropdownMenuItem>
                )}

                {isTransit && (!isStaffOrCashier || (activeContext?.outlet_id && d.to_outlet_id === activeContext?.outlet_id)) && (
                  <DropdownMenuItem
                    onClick={() => handleOpenHandshake(d)}
                    className="gap-2.5 rounded-xl text-xs font-semibold text-emerald-600 dark:text-emerald-400 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{t.logisticsHandshakeConfirm || "Konfirmasi Penerimaan"}</span>
                  </DropdownMenuItem>
                )}

                {canEdit && (
                  <DropdownMenuItem
                    onClick={() => {
                      setSelectedTransfer(d);
                      setCurrentView("detail");
                      handleOpenEdit(d);
                    }}
                    className="gap-2.5 rounded-xl text-xs font-semibold cursor-pointer text-slate-700 dark:text-slate-200"
                  >
                    <Pencil className="w-3.5 h-3.5 text-amber-500" />
                    <span>{t.distBtnEdit || "Edit Biaya & Sopir"}</span>
                  </DropdownMenuItem>
                )}

                {canPrint && (
                  <DropdownMenuItem
                    onClick={() => {
                      setSelectedTransfer(d);
                      setCurrentView("detail");
                      setPrintSlipDist(d);
                    }}
                    className="gap-2.5 rounded-xl text-xs font-semibold cursor-pointer text-slate-700 dark:text-slate-200"
                  >
                    <Printer className="w-3.5 h-3.5 text-purple-500" />
                    <span>{t.distBtnPrint || "Cetak Surat Jalan"}</span>
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator className="my-1 bg-slate-100 dark:bg-white/10" />

                <DropdownMenuItem
                  onClick={() => {
                    navigator.clipboard.writeText(d.transfer_no || "");
                    toast.success("Nomor surat jalan berhasil disalin");
                  }}
                  className="gap-2.5 rounded-xl text-xs font-medium cursor-pointer text-slate-600 dark:text-slate-400"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Salin No. Surat Jalan</span>
                </DropdownMenuItem>

                {d.tracking_ref_no && (
                  <DropdownMenuItem
                    onClick={() => {
                      navigator.clipboard.writeText(d.tracking_ref_no || "");
                      toast.success("Nomor resi/tracking berhasil disalin");
                    }}
                    className="gap-2.5 rounded-xl text-xs font-medium cursor-pointer text-slate-600 dark:text-slate-400"
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Salin No. Resi</span>
                  </DropdownMenuItem>
                )}

                {isDraft && (
                  <>
                    <DropdownMenuSeparator className="my-1 bg-slate-100 dark:bg-white/10" />
                    <DropdownMenuItem
                      onClick={() => setDeleteDraftDialogTransfer(d)}
                      className="gap-2.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Draf</span>
                    </DropdownMenuItem>
                  </>
                )}

                {(isTransit || isPending) && (
                  <>
                    <DropdownMenuSeparator className="my-1 bg-slate-100 dark:bg-white/10" />
                    <DropdownMenuItem
                      onClick={() => {
                        setCancelDialogTransfer(d);
                        setCancelReason("");
                      }}
                      className="gap-2.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Batalkan Pengiriman</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  // Calculations and helpers for View 1: Creator
  const destOutletObj = outlets.find((o) => o.id === shipToOutletID);
  const destName = destOutletObj?.name || (availableDestinations.length === 1 ? availableDestinations[0].name : "Outlet Tujuan");

  const wizardSteps = [
    { id: 1, title: t.distWizard3Step1 || "1. Rute & Biaya", subtitle: t.distWizard3Step1Desc || "Jenis transfer, rute & kebijakan ongkir", icon: Banknote },
    { id: 2, title: t.distWizard3Step2 || "2. Daftar Muatan Barang", subtitle: t.distWizard3Step2Desc || "Pilih katalog item gudang & kuantitas", icon: Package },
    { id: 3, title: t.distWizard3Step3 || "3. Kurir & Finalisasi", subtitle: t.distWizard3Step3Desc || "Identitas armada, supir & terbitkan", icon: Truck },
  ];

  const isStep1Valid = isStaffOrCashier
    ? (!!shipFromOutletID && shipFromOutletID !== (activeContext?.outlet_id || ""))
    : (availableDestinations.length === 1 || (!!shipToOutletID && shipToOutletID !== shipFromOutletID));

  // Calculations and helpers for View 2: Detail
  const isReceived = selectedTransfer?.status === "received";
  const isInTransit = selectedTransfer?.status === "in_transit" || selectedTransfer?.status === "sent";
  const isReturned = selectedTransfer?.status === "returned";
  const isCancelled = selectedTransfer?.status === "cancelled";
  const isReturnDoc = selectedTransfer ? ((selectedTransfer.transfer_type || (selectedTransfer as any).distribution_type || (selectedTransfer as any).type) === "return") : false;
  const isRecipientForSelected = !isStaffOrCashier || (Boolean(activeContext?.outlet_id) && selectedTransfer?.to_outlet_id === activeContext?.outlet_id);

  const carrierLabels: Record<string, string> = {
    internal_fleet: t.distCarrierInternal || "Armada Sendiri (Internal)",
    online_courier: t.distCarrierOnline || "Ojek Online (Gojek / Grab / Maxim)",
    "3rd_party": t.distCarrier3rdParty || "Ekspedisi (Lalamove / Deliveree / JNE)",
    pickup: t.distCarrierPickup || "Diambil Sendiri (Pickup Cabang)",
  };
  const activeCarrierLabel = selectedTransfer ? (carrierLabels[selectedTransfer.carrier_type || "internal_fleet"] || (t.distCarrierInternal || "Armada Sendiri")) : "";

  // Normalize items manifest for Detail
  const manifestItems: StockTransferItemLine[] = selectedTransfer?.items && selectedTransfer.items.length > 0
    ? selectedTransfer.items
    : (selectedTransfer ? [{
        id: selectedTransfer.id,
        item_id: selectedTransfer.item_id || "",
        item_name: selectedTransfer.item_name || "Produk",
        item_sku: selectedTransfer.item_sku || "",
        base_unit: selectedTransfer.base_unit || "pcs",
        box_unit: selectedTransfer.box_unit || "Dus",
        conversion_rate: selectedTransfer.conversion_rate || 1,
        qty_sent_sealed: selectedTransfer.qty_sealed || 0,
        qty_sent_loose: selectedTransfer.qty_loose || 0,
        qty_received_sealed: selectedTransfer.qty_received_sealed,
        qty_received_loose: selectedTransfer.qty_received_loose,
        shrinkage_qty: selectedTransfer.shrinkage_qty || 0,
        notes: selectedTransfer.notes || "",
      }] : []);

  // Calculations for summary metrics
  const totalKinds = manifestItems.length;
  const totalSealedSent = manifestItems.reduce((acc, it) => acc + (it.qty_sent_sealed || 0), 0);
  const totalLooseSent = manifestItems.reduce((acc, it) => acc + (it.qty_sent_loose || 0), 0);
  const totalBaseEquivalentSent = manifestItems.reduce((acc, it) => {
    const rate = it.conversion_rate && it.conversion_rate > 0 ? it.conversion_rate : 1;
    return acc + ((it.qty_sent_sealed || 0) * rate) + (it.qty_sent_loose || 0);
  }, 0);

  const totalSealedReceived = manifestItems.reduce((acc, it) => acc + (it.qty_received_sealed ?? (isReceived ? it.qty_sent_sealed : 0)), 0);
  const totalLooseReceived = manifestItems.reduce((acc, it) => acc + (it.qty_received_loose ?? (isReceived ? it.qty_sent_loose : 0)), 0);
  const totalShrinkageUnits = manifestItems.reduce((acc, it) => acc + (it.shrinkage_qty || 0), 0);

  return (
    <div className="w-full">
      {/* ========================================================================= */}
      {/* VIEW 1: CREATOR FORM (3-STEP BALANCED MANIFEST WIZARD)                    */}
      {/* ========================================================================= */}
      {currentView === "new" && (
        <div className="w-full max-w-7xl mx-auto space-y-6 pb-24 text-left">
        {/* 1. Frameless Header Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200/80 dark:border-[#2E2E34] gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleRequestExit()}
              className="p-2.5 rounded-2xl border border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#202024] hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-xs"
              title={t.cancel || "Kembali ke Daftar Surat Jalan"}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-extrabold text-xs text-brand-purple dark:text-primary uppercase tracking-wider">
                  {t.distWizardModuleTag || "Modul Transfer Stok Logistik"}
                </span>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-brand-purple/10 text-brand-purple dark:bg-primary/10 dark:text-primary">
                  {language === "en" ? `Step ${wizardStep} of 3` : `Langkah ${wizardStep} dari 3`}
                </span>
              </div>
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5">
                {editingTransferId
                  ? ((t as any).distEditDraftTitle || "Edit & Lanjutkan Draf Rencana Distribusi")
                  : (t.distWizardTitle || "Penerbitan Surat Jalan Pengiriman Stok Antar-Lokasi")}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={() => handleRequestExit()}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#202024] hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
            >
              {t.cancel || "Batal"}
            </button>

            {/* Save as Draft Button (Always accessible when items are present) */}
            <button
              type="button"
              onClick={() => handleSaveDraft(true)}
              disabled={isSubmitting || shipLines.length === 0}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-[#38383C] bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-100 text-xs font-bold transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="Simpan rencana pengiriman sebagai Draf tanpa memotong saldo stok fisik gudang asal"
            >
              <FileText className="w-4 h-4 text-slate-500 dark:text-slate-300" />
              <span>{isSubmitting ? "Menyimpan..." : "Simpan Draf"}</span>
            </button>

            {wizardStep === 3 && (
              <button
                type="button"
                onClick={() => handleCreateShipment()}
                disabled={isSubmitting || shipLines.length === 0 || (!isStaffOrCashier && creationSummary.hasStockOverage)}
                className="px-6 py-2.5 rounded-2xl bg-brand-purple hover:bg-brand-purple-hover text-white dark:bg-[#E2FF66] dark:text-slate-900 font-extrabold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {isStaffOrCashier ? <PackagePlus className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                <span>
                  {isSubmitting
                    ? (t.distBtnPublishing || "Memproses...")
                    : isStaffOrCashier
                    ? "Kirim Permintaan Pasokan Stok"
                    : editingTransferId
                    ? "Setujui & Terbitkan Surat Jalan"
                    : (t.distBtnPublish || "Terbitkan Surat Jalan")}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* 2. Interactive Stepper Capsule Indicator (Constrained Compact Width) */}
        <div className="max-w-4xl mx-auto w-full">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {wizardSteps.map((step) => {
              const isCurrent = wizardStep === step.id;
              const isPast = wizardStep > step.id;
              const StepIcon = step.icon;

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => {
                    if (isPast || isCurrent) {
                      setWizardStep(step.id);
                    }
                  }}
                  disabled={!isPast && !isCurrent}
                  className={`p-3.5 sm:p-4 rounded-3xl border text-left transition-all flex items-center gap-3.5 ${
                    isCurrent
                      ? "bg-brand-purple text-white dark:bg-[#E2FF66] dark:text-slate-900 border-transparent shadow-sm ring-2 ring-brand-purple/20 dark:ring-[#E2FF66]/20"
                      : isPast
                      ? "bg-white dark:bg-[#202024] border-emerald-500/40 text-slate-800 dark:text-slate-200 hover:border-emerald-500 cursor-pointer"
                      : "bg-white/50 dark:bg-[#202024]/50 border-slate-200/60 dark:border-white/5 text-slate-400 cursor-not-allowed opacity-70"
                  }`}
                >
                  <div
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center shrink-0 font-bold text-sm ${
                      isCurrent
                        ? "bg-white/20 dark:bg-black/15 text-white dark:text-slate-900"
                        : isPast
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-slate-100 dark:bg-white/5 text-slate-400"
                    }`}
                  >
                    {isPast ? <Check className="w-5 h-5 stroke-[3]" /> : <StepIcon className="w-5 h-5" />}
                  </div>
                  <div className="overflow-hidden min-w-0">
                    <p className="text-xs sm:text-sm font-extrabold truncate leading-tight">
                      {step.title}
                    </p>
                    <p
                      className={`text-[10px] sm:text-[11px] truncate leading-tight mt-0.5 ${
                        isCurrent
                          ? "text-white/80 dark:text-slate-800/80 font-medium"
                          : isPast
                          ? "text-slate-500 dark:text-slate-400"
                          : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {step.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* STEP 1: INFORMASI RUTE & BIAYA DISTRIBUSI                                 */}
        {/* ========================================================================= */}
        {wizardStep === 1 && (
          <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#202024] border border-slate-200/80 dark:border-[#38383C] shadow-xs space-y-7">
            {/* Section: Parameter Rute & Distribusi */}
            <div className="space-y-5">
              {/* Jenis Transfer */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  {t.distTransferTypeLabel || "Jenis Transfer / Dokumen"}
                </label>
                {isStaffOrCashier ? (
                  <div className="p-4 rounded-2xl border border-brand-purple bg-brand-purple/10 dark:border-[#E2FF66] dark:bg-[#E2FF66]/10 text-slate-900 dark:text-white font-bold flex items-center gap-3">
                    <PackagePlus className="w-5 h-5 text-brand-purple dark:text-[#E2FF66] shrink-0" />
                    <div>
                      <span className="text-xs font-extrabold block">
                        {language === "en" ? "Stock Requisition (Branch Request)" : "Permintaan Pasokan Stok (Requisition)"}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-normal">
                        {language === "en"
                          ? "Submit a stock replenishment request to the central warehouse/kitchen for your branch."
                          : "Mengajukan permintaan pasokan barang/bahan ke gudang pusat atau dapur utama untuk dikirim ke outlet Anda."}
                      </span>
                    </div>
                  </div>
                ) : (
                  <RadioGroup
                    value={shipType}
                    onValueChange={(val) => setShipType(val as "outbound" | "return")}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                  >
                    <div
                      onClick={() => setShipType("outbound")}
                      className={`p-4 rounded-2xl border flex items-center gap-3 cursor-pointer transition-all ${
                        shipType === "outbound"
                          ? "border-brand-purple bg-brand-purple/10 dark:border-[#E2FF66] dark:bg-[#E2FF66]/10 text-slate-900 dark:text-white font-bold ring-2 ring-brand-purple/20"
                          : "border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                      }`}
                    >
                      <RadioGroupItem value="outbound" />
                      <div className="text-left">
                        <span className="text-xs font-extrabold block">{t.distTypeOutboundTitle || "Distribusi Cabang (Outbound)"}</span>
                        <span className="text-[11px] text-slate-400 block font-normal">{t.distTypeOutboundDesc || "Pengisian stok operasional ke cabang"}</span>
                      </div>
                    </div>

                    <div
                      onClick={() => setShipType("return")}
                      className={`p-4 rounded-2xl border flex items-center gap-3 cursor-pointer transition-all ${
                        shipType === "return"
                          ? "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400 font-bold ring-2 ring-red-500/20"
                          : "border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                      }`}
                    >
                      <RadioGroupItem value="return" />
                      <div className="text-left">
                        <span className="text-xs font-extrabold block">{t.distTypeReturnTitle || "Retur Pengembalian (Return)"}</span>
                        <span className="text-[11px] text-slate-400 block font-normal">{t.distTypeReturnDesc || "Pengembalian sisa shift / barang rusak"}</span>
                      </div>
                    </div>
                  </RadioGroup>
                )}
              </div>

              {/* Alur Rute Pengiriman */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  {t.distRouteFlowLabel || "Alur Rute Pengiriman Antar-Lokasi"}
                </label>

                <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Origin Outlet */}
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        {isStaffOrCashier ? "Gudang / Dapur Penyedia" : (t.distOriginOutletLabel || "Outlet Asal")}
                      </span>
                      {isStaffOrCashier ? (
                        <span className="text-[9px] font-bold text-red-500">* Wajib</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                          <Lock className="w-2.5 h-2.5" />
                          {t.distOriginLocked || "Asal"}
                        </span>
                      )}
                    </div>

                    {isStaffOrCashier ? (
                      <Select
                        value={shipFromOutletID}
                        onValueChange={(val) => {
                          setShipFromOutletID(val || "");
                          // Reset loaded lines on source switch
                          setShipLines([]);
                        }}
                      >
                        <SelectTrigger className="w-full text-xs font-semibold rounded-xl bg-white dark:bg-[#202024] border-slate-200 dark:border-[#38383C] min-h-[58px]">
                          <SelectValue placeholder="-- Pilih Gudang / Dapur Pusat --">
                            {shipFromOutletID ? (
                              <div className="text-left">
                                <p className="font-extrabold text-slate-900 dark:text-white">
                                  {outlets.find((o) => o.id === shipFromOutletID)?.name || "Pilih Gudang Asal"}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {outlets.find((o) => o.id === shipFromOutletID)?.address || "Pusat Pasokan Stok"}
                                </p>
                              </div>
                            ) : (
                              <span className="text-slate-400 font-semibold">-- Pilih Gudang / Dapur Pusat --</span>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {outlets
                            .filter((o) => o.id !== (activeContext?.outlet_id || ""))
                            .map((o) => (
                              <SelectItem key={o.id} value={o.id} className="text-xs font-bold">
                                {o.name} {o.address ? `(${o.address})` : ""}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-white dark:bg-[#202024] border border-slate-200/60 dark:border-white/5 min-h-[58px] flex flex-col justify-center">
                        <p className="font-extrabold text-sm text-slate-900 dark:text-white line-clamp-1">
                          {originOutletObj.name}
                        </p>
                        <p className="text-[11px] text-slate-400 line-clamp-1">
                          {t.distOriginBalanceNote || "Saldo fisik berkurang seketika di gudang ini"}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Center: Direction Arrow Flow Badge */}
                  <div className="flex items-center justify-center shrink-0 py-1 md:py-0 self-center">
                    <div className="w-10 h-10 rounded-full bg-brand-purple/10 dark:bg-primary/10 text-brand-purple dark:text-primary flex items-center justify-center shadow-xs border border-brand-purple/20 dark:border-primary/20">
                      <ArrowRight className="w-5 h-5 stroke-[2.5] rotate-90 md:rotate-0 animate-arrow-flow" />
                    </div>
                  </div>

                  {/* Right: Destination Outlet */}
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-brand-purple dark:text-primary" />
                        {isStaffOrCashier ? "Outlet Pemohon (Tujuan)" : (t.distDestOutletLabel || "Outlet Tujuan")}
                      </span>
                      {isStaffOrCashier ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-brand-purple/10 text-brand-purple dark:bg-primary/10 dark:text-primary border border-brand-purple/20 dark:border-primary/20">
                          <Lock className="w-2.5 h-2.5" />
                          Outlet Anda
                        </span>
                      ) : availableDestinations.length === 1 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-brand-purple/10 text-brand-purple dark:bg-primary/10 dark:text-primary border border-brand-purple/20 dark:border-primary/20">
                          {t.distDestAuto || "Otomatis"}
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-red-500">{t.distDestRequired || "* Wajib Dipilih"}</span>
                      )}
                    </div>

                    {isStaffOrCashier ? (
                      <div className="p-3.5 rounded-xl bg-white dark:bg-[#202024] border border-brand-purple/30 dark:border-primary/30 min-h-[58px] flex flex-col justify-center space-y-0.5">
                        <p className="font-extrabold text-sm text-brand-purple dark:text-primary line-clamp-1">
                          {activeContext?.outlet_name || activeContext?.name || "Outlet Anda"}
                        </p>
                        <p className="text-[11px] text-slate-400 line-clamp-1">
                          Stok masuk setelah diverifikasi serah terima (handshake) di outlet ini
                        </p>
                      </div>
                    ) : availableDestinations.length === 0 ? (
                      <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/10 min-h-[58px] flex items-center justify-center text-center">
                        <span className="text-xs text-slate-400 font-semibold">
                          {t.distDestNoOther || "Tidak ada cabang lain terdaftar di tenant ini"}
                        </span>
                      </div>
                    ) : availableDestinations.length === 1 ? (
                      <div className="p-3.5 rounded-xl bg-white dark:bg-[#202024] border border-brand-purple/30 dark:border-primary/30 min-h-[58px] flex flex-col justify-center space-y-0.5">
                        <p className="font-extrabold text-sm text-brand-purple dark:text-primary line-clamp-1">
                          {availableDestinations[0].name}
                        </p>
                        <p className="text-[11px] text-slate-400 line-clamp-1">
                          {availableDestinations[0].address || (t.distDestSingleAutoNote || "Stok masuk setelah verifikasi serah terima")}
                        </p>
                      </div>
                    ) : (
                      <Select value={shipToOutletID} onValueChange={(val) => setShipToOutletID(val || "")}>
                        <SelectTrigger className="w-full text-xs font-semibold rounded-xl bg-white dark:bg-[#202024] border-slate-200 dark:border-[#38383C] min-h-[58px]">
                          <SelectValue placeholder={t.distDestSelectPlaceholder || "-- Pilih Cabang Tujuan --"}>
                            {shipToOutletID ? (
                              <div className="text-left">
                                <p className="font-extrabold text-slate-900 dark:text-white">
                                  {outlets.find((o) => o.id === shipToOutletID)?.name}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {outlets.find((o) => o.id === shipToOutletID)?.address || "Alamat Cabang"}
                                </p>
                              </div>
                            ) : (
                              <span className="text-slate-400 font-semibold">{t.distDestSelectPlaceholder || "-- Pilih Cabang Tujuan --"}</span>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {availableDestinations.map((o) => (
                            <SelectItem key={o.id} value={o.id} className="text-xs font-bold">
                              {o.name} {o.address ? `(${o.address})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Biaya Distribusi & Kebijakan Klaim Kurir */}
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-white/5">
              {/* 3-Way Mode Selector */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  {t.distCostModeLabel || "Metode Penentuan Biaya Kirim"}
                </label>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Mode 1: Fixed */}
                  <div
                    onClick={() => setShippingCostMode("fixed")}
                    className={`p-4 rounded-2xl border flex flex-col justify-between cursor-pointer transition-all ${
                      shippingCostMode === "fixed"
                        ? "border-brand-purple bg-brand-purple/10 dark:border-[#E2FF66] dark:bg-[#E2FF66]/10 text-slate-900 dark:text-white font-bold ring-2 ring-brand-purple/20"
                        : "border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-brand-purple/10 dark:bg-primary/10 flex items-center justify-center text-brand-purple dark:text-primary shrink-0">
                        <Banknote className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-extrabold">{t.distCostModeFixed || "Input Langsung"}</p>
                        <p className="text-[10px] text-slate-400 font-normal">Nominal ongkir sudah pasti</p>
                      </div>
                    </div>
                  </div>

                  {/* Mode 2: Driver Claim via QR */}
                  <div
                    onClick={() => setShippingCostMode("driver_claim")}
                    className={`p-4 rounded-2xl border flex flex-col justify-between cursor-pointer transition-all ${
                      shippingCostMode === "driver_claim"
                        ? "border-brand-purple bg-brand-purple/10 dark:border-[#E2FF66] dark:bg-[#E2FF66]/10 text-slate-900 dark:text-white font-bold ring-2 ring-brand-purple/20"
                        : "border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-brand-purple/10 dark:bg-primary/10 flex items-center justify-center text-brand-purple dark:text-primary shrink-0">
                        <QrCode className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-extrabold">{t.distCostModeDriverClaim || "Klaim Kurir (QR)"}</p>
                        <p className="text-[10px] text-slate-400 font-normal">Diinput kurir via scan QR di jalan</p>
                      </div>
                    </div>
                  </div>

                  {/* Mode 3: Free */}
                  <div
                    onClick={() => setShippingCostMode("free")}
                    className={`p-4 rounded-2xl border flex flex-col justify-between cursor-pointer transition-all ${
                      shippingCostMode === "free"
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold ring-2 ring-emerald-500/20"
                        : "border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-extrabold">{t.distCostModeFree || "Bebas Biaya (Gratis)"}</p>
                        <p className="text-[10px] text-slate-400 font-normal">Internal tanpa potongan kas</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Sub-Fields according to Mode (Max 2 fields per row) */}
              {shippingCostMode === "fixed" && (
                <div className="space-y-4 pt-1">
                  {/* Preset 4-Category Breakdown Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Component 1: BBM / Bensin */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Fuel className="w-3.5 h-3.5 text-amber-500" />
                        <span>{t.distCostBBM || "BBM / Bahan Bakar"}</span>
                      </label>
                      <CurrencyInput
                        value={costBBM}
                        onChange={setCostBBM}
                        placeholder={t.distCostBBMPlaceholder || "0 (Bensin / Solar)"}
                        className="bg-white dark:bg-[#202024] border-slate-200 dark:border-[#38383C] text-xs font-bold py-2.5"
                      />
                    </div>

                    {/* Component 2: Ongkir / Tarif Ekspedisi */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-brand-purple dark:text-primary" />
                        <span>{t.distCostOngkir || "Ongkir / Tarif Ekspedisi"}</span>
                      </label>
                      <CurrencyInput
                        value={costOngkir}
                        onChange={setCostOngkir}
                        placeholder={t.distCostOngkirPlaceholder || "0 (Tarif kirim / 3PL)"}
                        className="bg-white dark:bg-[#202024] border-slate-200 dark:border-[#38383C] text-xs font-bold py-2.5"
                      />
                    </div>

                    {/* Component 3: Tol & Parkir */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Car className="w-3.5 h-3.5 text-blue-500" />
                        <span>{t.distCostTolParkir || "Tol & Parkir"}</span>
                      </label>
                      <CurrencyInput
                        value={costTolParkir}
                        onChange={setCostTolParkir}
                        placeholder={t.distCostTolParkirPlaceholder || "0 (Karcis tol / retribusi)"}
                        className="bg-white dark:bg-[#202024] border-slate-200 dark:border-[#38383C] text-xs font-bold py-2.5"
                      />
                    </div>

                    {/* Component 4: Uang Jalan / Lainnya */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{t.distCostUangJalan || "Uang Jalan / Lainnya"}</span>
                      </label>
                      <CurrencyInput
                        value={costUangJalan}
                        onChange={setCostUangJalan}
                        placeholder={t.distCostUangJalanPlaceholder || "0 (Uang makan / kuli / bongkar)"}
                        className="bg-white dark:bg-[#202024] border-slate-200 dark:border-[#38383C] text-xs font-bold py-2.5"
                      />
                    </div>
                  </div>

                  {/* Auto-Calculated Grand Total Strip */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-brand-purple dark:text-primary" />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {t.distTotalCostAuto || "Total Akumulasi Biaya Distribusi"}:
                      </span>
                    </div>
                    <span className="text-sm font-black text-brand-purple dark:text-primary">
                      Rp {totalDirectCost.toLocaleString("id-ID")}
                    </span>
                  </div>

                  {/* Payment Party & Methods (Max 2 cols) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    {/* Payer Party */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {t.distShippingPayerLabel || "Pihak Penanggung Kas"}
                      </label>
                      <Select value={shippingCostPayer} onValueChange={(val) => setShippingCostPayer(val || "origin")}>
                        <SelectTrigger className="w-full text-xs font-semibold rounded-xl bg-white dark:bg-[#202024] border-slate-200 dark:border-[#38383C] py-2.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="origin">{t.distPayerOrigin || "Outlet Asal (Pengirim)"}</SelectItem>
                          <SelectItem value="destination">{t.distPayerDest || "Outlet Tujuan (Penerima)"}</SelectItem>
                          <SelectItem value="central">{t.distPayerCentral || "Kantor Pusat / Owner"}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {t.distPaymentMethodLabel || "Metode Bayar"}
                      </label>
                      <Select value={shippingPaymentMethod} onValueChange={(val) => setShippingPaymentMethod(val || "cash")}>
                        <SelectTrigger className="w-full text-xs font-semibold rounded-xl bg-white dark:bg-[#202024] border-slate-200 dark:border-[#38383C] py-2.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">{t.distPaymentCash || "Tunai (Cash / Uang Jalan)"}</SelectItem>
                          <SelectItem value="bank_transfer">{t.distPaymentTransfer || "Transfer Bank"}</SelectItem>
                          <SelectItem value="on_account">{t.distPaymentAccount || "Tagihan Tempo (3PL)"}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Tracking Ref No / AWB (Full width) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {t.distTrackingRefLabel || "No. Resi / AWB / No. Bukti Kas (Opsional)"}
                    </label>
                    <input
                      type="text"
                      value={trackingRefNo}
                      onChange={(e) => setTrackingRefNo(e.target.value)}
                      placeholder={t.distTrackingRefPlaceholder || "Contoh: JNE-0982312 / BKK-2026-001"}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#202024] text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-brand-purple"
                    />
                  </div>
                </div>
              )}

              {shippingCostMode === "driver_claim" && (
                <div className="p-5 rounded-2xl bg-brand-purple/5 dark:bg-primary/5 border border-brand-purple/20 dark:border-primary/20 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-brand-purple/10 dark:bg-primary/10 flex items-center justify-center text-brand-purple dark:text-primary shrink-0 mt-0.5">
                      <QrCode className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {t.distDriverClaimHelpTitle || "Fitur Klaim Reimbursement Kurir Aktif"}
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                        {t.distDriverClaimHelpDesc || "QR Code akan otomatis dicetak pada lembar Surat Jalan fisik. Kurir dapat scan QR menggunakan kamera HP untuk menginput riil biaya bensin, tol, dan foto nota struk tanpa perlu login akun ERP."}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-brand-purple/10 dark:border-primary/10">
                    {/* Row 1 - Field 1: Max Claim Budget */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {t.distMaxBudgetLabel || "Plafon Anggaran Maksimal"}
                        </label>
                        <span className="text-[10px] text-slate-400">{t.distMaxBudgetOptional || "Opsional"}</span>
                      </div>
                      <CurrencyInput
                        value={maxClaimBudget}
                        onChange={setMaxClaimBudget}
                        placeholder="0 (Tanpa Batas)"
                        className="bg-white dark:bg-[#202024] border-slate-200 dark:border-[#38383C] text-xs font-bold py-2.5"
                      />
                      <p className="text-[10px] text-slate-400">
                        {t.distMaxBudgetHelp || "Peringatan otomatis muncul jika kurir mengajukan klaim melebihi plafon ini."}
                      </p>
                    </div>

                    {/* Row 1 - Field 2: Payer Party */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {t.distShippingPayerLabel || "Pihak Penanggung Kas"}
                      </label>
                      <Select value={shippingCostPayer} onValueChange={(val) => setShippingCostPayer(val || "origin")}>
                        <SelectTrigger className="w-full text-xs font-semibold rounded-xl bg-white dark:bg-[#202024] border-slate-200 dark:border-[#38383C] py-2.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="origin">{t.distPayerOrigin || "Outlet Asal (Pengirim)"}</SelectItem>
                          <SelectItem value="destination">{t.distPayerDest || "Outlet Tujuan (Penerima)"}</SelectItem>
                          <SelectItem value="central">{t.distPayerCentral || "Kantor Pusat / Owner"}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {shippingCostMode === "free" && (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium leading-relaxed">
                    {t.distCostModeFreeDesc || "Pengiriman internal bebas biaya distribusi. Tidak ada beban kas atau pencatatan pengeluaran logistik."}
                  </p>
                </div>
              )}
            </div>

            {/* Step 1 Navigation Footer */}
            <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleRequestExit()}
                  className="px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#202024] text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
                >
                  {t.cancel || "Batal"}
                </button>
                {editingTransferId && (
                  <button
                    type="button"
                    onClick={() => {
                      const currentDraft = distributions.find((d) => d.id === editingTransferId) || ({ id: editingTransferId } as DistributionItem);
                      setDeleteDraftDialogTransfer(currentDraft);
                    }}
                    className="px-4 py-2.5 rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Draf</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {shipLines.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleSaveDraft(true)}
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-[#38383C] bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-100 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    <FileText className="w-4 h-4 text-slate-500 dark:text-slate-300" />
                    <span>{isSubmitting ? "Menyimpan..." : "Simpan Draf"}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  disabled={!isStep1Valid}
                  className="px-6 py-3 rounded-2xl bg-brand-purple hover:bg-brand-purple-hover text-white dark:bg-[#E2FF66] dark:text-slate-900 font-extrabold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span>{t.distBtnNextToItems || "Lanjut: Muatan Barang"}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: DAFTAR MUATAN BARANG (ITEMS MANIFEST)                             */}
        {/* ========================================================================= */}
        {wizardStep === 2 && (
          <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#202024] border border-slate-200/80 dark:border-[#38383C] shadow-xs space-y-6">
            {/* Step 2 Action Bar & Quick Recap Strip */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-brand-purple/10 dark:bg-primary/10 flex items-center justify-center text-brand-purple dark:text-primary shrink-0">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                        {shipLines.length} {language === "en" ? (shipLines.length === 1 ? "Item Selected" : "Items Selected") : "Item Terpilih"}
                      </span>
                      {shipLines.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          {creationSummary.totalItemsCount} aktif
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      {t.distSecManifestDesc || "Item dipilih langsung dari katalog gudang asal dan tervalidasi dengan saldo fisik"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <button
                    type="button"
                    onClick={handleAutoSuggestReorder}
                    disabled={isAutoSuggestingReorder}
                    className="px-4 py-2.5 rounded-2xl border border-purple-200 dark:border-purple-800/40 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 text-xs font-extrabold shadow-2xs hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {isAutoSuggestingReorder ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>{t.distSmartReorderBtn || "Auto-Reorder Pintar"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenItemPicker}
                    className="px-5 py-2.5 rounded-2xl bg-brand-purple hover:bg-brand-purple-hover dark:bg-[#E2FF66] dark:text-slate-900 text-white text-xs font-extrabold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                  >
                    <PackagePlus className="w-4 h-4" />
                    <span>{shipLines.length === 0 ? (t.distBtnPickItems || "Pilih Barang dari Gudang") : (t.distBtnModifyItems || "Tambah / Ubah Item Muatan")}</span>
                  </button>
                </div>
              </div>

              {/* Quick Summary Recap Strip of Step 1 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-[#28282C] border border-slate-200/60 dark:border-white/5 text-xs">
                <div className="flex items-center gap-2.5">
                  <MapPin className="w-4 h-4 text-brand-purple dark:text-primary shrink-0" />
                  <div className="overflow-hidden">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">{t.distRouteFlowLabel || "Rute Pengiriman"}</span>
                    <span className="font-extrabold text-slate-900 dark:text-white truncate block">
                      {originOutletObj.name} → {destName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Banknote className="w-4 h-4 text-brand-purple dark:text-primary shrink-0" />
                  <div className="overflow-hidden">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">{t.distSecCostTitle || "Biaya Distribusi"}</span>
                    <span className="font-extrabold text-slate-900 dark:text-white truncate block">
                      {shippingCostMode === "free"
                        ? (t.distCostModeFree || "Bebas Biaya")
                        : shippingCostMode === "driver_claim"
                        ? `Klaim Kurir (Plafon: ${maxClaimBudget > 0 ? `Rp ${maxClaimBudget.toLocaleString("id-ID")}` : "Bebas"})`
                        : `Rp ${totalDirectCost.toLocaleString("id-ID")}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Table or Empty State */}
            {shipLines.length === 0 ? (
              <div className="py-14 border-2 border-dashed border-slate-200 dark:border-[#38383C] rounded-3xl flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="w-14 h-14 rounded-3xl bg-brand-purple/10 dark:bg-primary/10 flex items-center justify-center text-brand-purple dark:text-primary">
                  <PackagePlus className="w-7 h-7 stroke-[1.8]" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <p className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                    {t.distEmptyManifestTitle || "Belum Ada Item Muatan yang Dipilih"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {(t.distEmptyManifestDesc || "Klik tombol di bawah untuk membuka daftar stok master item di {origin}.").replace("{origin}", originOutletObj.name)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenItemPicker}
                  className="px-6 py-2.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-extrabold hover:opacity-90 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <PackagePlus className="w-4 h-4" />
                  <span>{t.distBtnPickNow || "Pilih Barang Sekarang"}</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/10 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-3">{t.distThNo || "No"}</th>
                      <th className="py-3 px-3 min-w-[220px]">{t.distThItem || "Item Barang"}</th>
                      <th className="py-3 px-3 min-w-[140px]">{t.distThOriginBalance || "Saldo Gudang Asal"}</th>
                      <th className="py-3 px-3 min-w-[260px]">{isStaffOrCashier ? "Kuantitas Diminta" : (t.distThShipQty || "Kuantitas Kirim")}</th>
                      <th className="py-3 px-3 min-w-[130px]">{t.distThBaseTotal || "Total Unit Dasar"}</th>
                      <th className="py-3 px-3 min-w-[140px]">{t.distThLineNotes || "Catatan Baris"}</th>
                      <th className="py-3 px-3 text-right">{t.distThAction || "Aksi"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipLines.map((line, idx) => {
                      const itmObj = items.find((i) => i.id === line.item_id);
                      const convRate = itmObj?.conversion_rate || 1;
                      const isDualUom = convRate > 1 && !!itmObj?.box_unit;

                      const availSealed = itmObj?.qty_sealed || 0;
                      const availLoose = (itmObj?.qty_loose || 0) || (!isDualUom ? availSealed : 0);

                      // Overage guard
                      const isSealedOverage = isDualUom && line.qty_sent_sealed > availSealed;
                      const isLooseOverage = line.qty_sent_loose > availLoose;
                      const hasOverage = isSealedOverage || isLooseOverage;

                      const totalBaseUnits = (line.qty_sent_sealed * convRate) + line.qty_sent_loose;

                      return (
                        <tr
                          key={line.item_id || idx}
                          className={`border-b border-slate-100 dark:border-white/5 transition-colors ${
                            hasOverage && !isStaffOrCashier ? "bg-red-500/5" : "hover:bg-slate-50/50 dark:hover:bg-white/5"
                          }`}
                        >
                          <td className="py-3.5 px-3 text-xs font-mono font-bold text-slate-400">{idx + 1}</td>

                          {/* Item Details */}
                          <td className="py-3.5 px-3">
                            <div className="space-y-0.5">
                              <span className="font-extrabold text-xs text-slate-900 dark:text-white block">
                                {line.item_name || itmObj?.name || (language === "en" ? "Product" : "Produk")}
                              </span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {line.item_sku && (
                                  <span className="text-[10px] font-mono font-semibold text-slate-400">
                                    SKU: {line.item_sku}
                                  </span>
                                )}
                                {isDualUom && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300">
                                    1 {line.box_unit} = {convRate} {line.base_unit}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Origin Stock Balance */}
                          <td className="py-3.5 px-3">
                            <div className="space-y-0.5">
                              {activeContext?.hide_central_stock_from_branches && isStaffOrCashier ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                                  <CheckCircle2 className="w-3 h-3" />
                                  {t.distBlindStockBadge || "Katalog Aktif / Siap Dipesan"}
                                </span>
                              ) : isDualUom ? (
                                <>
                                  <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 block">
                                    {availSealed} {line.box_unit}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block">
                                    + {availLoose} {line.base_unit} {language === "en" ? "loose" : "eceran"}
                                  </span>
                                </>
                              ) : (
                                <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 block">
                                  {availLoose} {line.base_unit}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Input Dual-UOM Adaptive */}
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-2">
                              {isDualUom ? (
                                <div className="flex items-center gap-1.5">
                                  {/* Box Input */}
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[9px] font-bold text-slate-500">
                                      <span>{(isStaffOrCashier ? "Minta {unit}" : (t.distSendBox || "Kirim {unit}")).replace("{unit}", line.box_unit || "Dus")}</span>
                                    </div>
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={line.qty_sent_sealed}
                                      onChange={(e) =>
                                        handleUpdateShipLine(
                                          idx,
                                          "qty_sent_sealed",
                                          Math.max(0, parseFloat(e.target.value) || 0)
                                        )
                                      }
                                      className={`w-20 px-2.5 py-1.5 rounded-xl border font-extrabold text-xs bg-white dark:bg-[#202024] ${
                                        !isStaffOrCashier && isSealedOverage
                                          ? "border-red-500 text-red-600 ring-2 ring-red-500/20"
                                          : "border-slate-200 dark:border-[#38383C]"
                                      }`}
                                      placeholder="0"
                                    />
                                  </div>

                                  <span className="text-slate-400 font-bold text-xs pt-4">+</span>

                                  {/* Loose Input */}
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[9px] font-bold text-slate-500">
                                      <span>{(isStaffOrCashier ? "Minta {unit}" : (t.distSendLoose || "Kirim {unit}")).replace("{unit}", line.base_unit || "pcs")}</span>
                                    </div>
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={line.qty_sent_loose}
                                      onChange={(e) =>
                                        handleUpdateShipLine(
                                          idx,
                                          "qty_sent_loose",
                                          Math.max(0, parseFloat(e.target.value) || 0)
                                        )
                                      }
                                      className={`w-20 px-2.5 py-1.5 rounded-xl border font-extrabold text-xs bg-white dark:bg-[#202024] ${
                                        !isStaffOrCashier && isLooseOverage
                                          ? "border-red-500 text-red-600 ring-2 ring-red-500/20"
                                          : "border-slate-200 dark:border-[#38383C]"
                                      }`}
                                      placeholder="0"
                                    />
                                  </div>
                                </div>
                              ) : (
                                /* Single UOM item */
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-[9px] font-bold text-slate-500">
                                    <span>{(isStaffOrCashier ? "Minta {unit}" : (t.distSendLoose || "Kirim {unit}")).replace("{unit}", line.base_unit || "pcs")}</span>
                                  </div>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={line.qty_sent_loose}
                                    onChange={(e) =>
                                      handleUpdateShipLine(
                                        idx,
                                        "qty_sent_loose",
                                        Math.max(0, parseFloat(e.target.value) || 0)
                                      )
                                    }
                                    className={`w-28 px-2.5 py-1.5 rounded-xl border font-extrabold text-xs bg-white dark:bg-[#202024] ${
                                      !isStaffOrCashier && isLooseOverage
                                        ? "border-red-500 text-red-600 ring-2 ring-red-500/20"
                                        : "border-slate-200 dark:border-[#38383C]"
                                    }`}
                                    placeholder="0"
                                  />
                                </div>
                              )}

                              {/* Max Button */}
                              {!(activeContext?.hide_central_stock_from_branches && isStaffOrCashier) && (
                                <button
                                  type="button"
                                  onClick={() => handleSetMaxStock(idx)}
                                  className="mt-4 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-[#38383C] text-[10px] font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-white/5 cursor-pointer shrink-0"
                                  title={t.distTooltipMax || "Isi seluruh sisa stok yang tersedia di gudang"}
                                >
                                  {t.distBtnMax || "Maks"}
                                </button>
                              )}
                            </div>

                            {hasOverage && (
                              <p className={`text-[10px] font-bold mt-1 flex items-center gap-1 ${!isStaffOrCashier ? "text-red-500" : "text-amber-600 dark:text-amber-400"}`}>
                                {!isStaffOrCashier ? (
                                  <>
                                    <AlertCircle className="w-3 h-3" />
                                    <span>{t.distOverageWarning || "Melebihi saldo gudang asal"}</span>
                                  </>
                                ) : (
                                  <>
                                    <Info className="w-3 h-3" />
                                    <span>Permintaan melebihi stok gudang saat ini (Gudang akan menyesuaikan alokasi kirim)</span>
                                  </>
                                )}
                              </p>
                            )}

                            {/* Audit Requested vs Allocated & Quota Adjustment Reason Dropdown */}
                            {((line.qty_requested_sealed || 0) > 0 || (line.qty_requested_loose || 0) > 0) && !isStaffOrCashier && (
                              <div className="mt-2 p-2 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/70 dark:border-purple-800/40 space-y-1.5">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="font-bold text-purple-700 dark:text-purple-300">
                                    {t.distRequestedQty || "Permintaan Cabang"}: {line.qty_requested_sealed || 0} {line.box_unit || "Dus"} + {line.qty_requested_loose || 0} {line.base_unit || "pcs"}
                                  </span>
                                  {(line.qty_sent_sealed < (line.qty_requested_sealed || 0) || line.qty_sent_loose < (line.qty_requested_loose || 0)) && (
                                    <span className="text-amber-600 dark:text-amber-400 font-extrabold text-[9px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60">
                                      {t.distQuotaCutBadge || "Penyesuaian Kuota"}
                                    </span>
                                  )}
                                </div>
                                {(line.qty_sent_sealed < (line.qty_requested_sealed || 0) || line.qty_sent_loose < (line.qty_requested_loose || 0)) && (
                                  <select
                                    value={line.allocation_notes || ""}
                                    onChange={(e) => handleUpdateShipLine(idx, "allocation_notes", e.target.value)}
                                    className="w-full px-2 py-1 text-[10px] font-semibold rounded-lg border border-purple-200 dark:border-purple-800/60 bg-white dark:bg-[#202024] text-slate-800 dark:text-slate-200"
                                  >
                                    <option value="">{t.distSelectReasonPlaceholder || "-- Pilih Alasan Penyesuaian Kuota --"}</option>
                                    {QUOTA_ADJUSTMENT_PRESETS.map((p) => (
                                      <option key={p} value={p}>{p}</option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Base Unit Total Formula */}
                          <td className="py-3.5 px-3">
                            <span className="font-extrabold text-xs text-brand-purple dark:text-primary">
                              = {totalBaseUnits} {line.base_unit}
                            </span>
                          </td>

                          {/* Row Note */}
                          <td className="py-3.5 px-3">
                            <input
                              type="text"
                              value={line.notes || ""}
                              onChange={(e) => handleUpdateShipLine(idx, "notes", e.target.value)}
                              placeholder={t.distThLineNotes || "Catatan baris"}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#202024] text-xs"
                            />
                          </td>

                          {/* Delete */}
                          <td className="py-3.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveShipLine(idx)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer"
                              title={t.delete || "Hapus baris item"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Overage alert */}
            {creationSummary.hasStockOverage && !isStaffOrCashier && (
              <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {t.distGlobalOverageAlert || "Perhatian: Terdapat baris barang dengan kuantitas kirim melebihi saldo fisik gudang asal. Harap sesuaikan kuantitas sebelum menerbitkan Surat Jalan."}
                </span>
              </div>
            )}

            {/* Backorder Option Strip */}
            {shipLines.some((l) => (l.qty_sent_sealed < (l.qty_requested_sealed || 0) || l.qty_sent_loose < (l.qty_requested_loose || 0))) && !isStaffOrCashier && (
              <div className="p-4 rounded-2xl bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-purple-700 dark:text-purple-300 shrink-0">
                    <SlidersHorizontal className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {t.distBackorderCheckbox || "Buat Dokumen Backorder Otomatis"}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {t.distBackorderCheckboxDesc || "Sisa kuantitas pasokan yang belum terpenuhi saat ini akan otomatis dibuatkan dokumen pesanan susulan (backorder) berstatus draf."}
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={createBackorder}
                  onChange={(e) => setCreateBackorder(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer shrink-0"
                />
              </div>
            )}

            {/* Manifest Summary Footer */}
            {shipLines.length > 0 && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#28282C] border border-slate-200/80 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-500">{t.distSummaryTotalHeader || "Ringkasan Total Muatan:"}</span>
                  <p className="font-black text-slate-900 dark:text-white text-sm">
                    {(t.distSummaryTotalText || "{items} Macam Barang — {sealed} Dus / Karton + {loose} Pcs Eceran")
                      .replace("{items}", String(creationSummary.totalItemsCount))
                      .replace("{sealed}", String(creationSummary.totalSealed))
                      .replace("{loose}", String(creationSummary.totalLoose))}
                  </p>
                </div>
              </div>
            )}

            {/* Step 2 Navigation Footer */}
            <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWizardStep(1)}
                  className="px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#202024] text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>{t.distBtnBackToRouteCost || "Kembali ke Rute & Biaya"}</span>
                </button>
                {editingTransferId && (
                  <button
                    type="button"
                    onClick={() => {
                      const currentDraft = distributions.find((d) => d.id === editingTransferId) || ({ id: editingTransferId } as DistributionItem);
                      setDeleteDraftDialogTransfer(currentDraft);
                    }}
                    className="px-4 py-2.5 rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Draf</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveDraft(true)}
                  disabled={isSubmitting || shipLines.length === 0}
                  className="px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-[#38383C] bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-100 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  title="Simpan daftar muatan ini sebagai Draf Rencana"
                >
                  <FileText className="w-4 h-4 text-slate-500 dark:text-slate-300" />
                  <span>{isSubmitting ? "Menyimpan..." : "Simpan Draf"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setWizardStep(3)}
                  disabled={shipLines.length === 0 || creationSummary.hasStockOverage}
                  className="px-6 py-3 rounded-2xl bg-brand-purple hover:bg-brand-purple-hover text-white dark:bg-[#E2FF66] dark:text-slate-900 font-extrabold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span>{t.distBtnNextToCourierFinal || "Lanjut: Kurir & Finalisasi"}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: INFORMASI KURIR, ARMADA & KONFIRMASI TERBITKAN                    */}
        {/* ========================================================================= */}
        {wizardStep === 3 && (
          <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#202024] border border-slate-200/80 dark:border-[#38383C] shadow-xs space-y-7">
            {/* Section: Informasi Kurir & Armada (Max 2 fields per row) */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Row 1 - Field 1: Carrier Type */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t.distCarrierTypeLabel || "Jenis Armada"}
                  </label>
                  <Select value={carrierType} onValueChange={(val) => setCarrierType(val || "internal_fleet")}>
                    <SelectTrigger className="w-full text-xs font-semibold rounded-xl bg-slate-50 dark:bg-[#28282C] border-slate-200 dark:border-[#38383C] py-2.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal_fleet">{t.distCarrierInternal || "Armada Sendiri (Internal)"}</SelectItem>
                      <SelectItem value="online_courier">{t.distCarrierOnline || "Ojek Online (Gojek / Grab / Maxim)"}</SelectItem>
                      <SelectItem value="3rd_party">{t.distCarrier3rdParty || "Ekspedisi (Lalamove / Deliveree / JNE)"}</SelectItem>
                      <SelectItem value="pickup">{t.distCarrierPickup || "Diambil Sendiri (Pickup Cabang)"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Row 1 - Field 2: Driver Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t.distDriverNameLabel || "Nama Sopir / Kurir"}
                  </label>
                  <div className="relative flex items-center">
                    <User className="w-4 h-4 absolute left-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      placeholder={t.distDriverNamePlaceholder || "Contoh: Pak Bambang"}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#38383C] bg-slate-50 dark:bg-[#28282C] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-purple"
                    />
                  </div>
                </div>

                {/* Row 2 - Field 3: Vehicle Plate */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t.distVehiclePlateLabel || "Nomor Plat Kendaraan"}
                  </label>
                  <div className="relative flex items-center">
                    <Car className="w-4 h-4 absolute left-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={vehiclePlate}
                      onChange={(e) => setVehiclePlate(e.target.value)}
                      placeholder={t.distVehiclePlatePlaceholder || "Contoh: AB 1234 CD"}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#38383C] bg-slate-50 dark:bg-[#28282C] text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand-purple uppercase"
                    />
                  </div>
                </div>

                {/* Row 2 - Field 4: Driver Phone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t.distDriverPhoneLabel || "No. Kontak / HP Kurir"}
                  </label>
                  <div className="relative flex items-center">
                    <Phone className="w-4 h-4 absolute left-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={driverPhone}
                      onChange={(e) => setDriverPhone(e.target.value)}
                      placeholder={t.distDriverPhonePlaceholder || "0812xxxx"}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#38383C] bg-slate-50 dark:bg-[#28282C] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-purple"
                    />
                  </div>
                </div>
              </div>

              {/* Row 3 - Field 5: Notes (Full width within section) */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.distShipNotesLabel || "Catatan & Instruksi Pengiriman"}
                </label>
                <textarea
                  rows={3}
                  value={shipNotes}
                  onChange={(e) => setShipNotes(e.target.value)}
                  placeholder={t.distShipNotesPlaceholder || "Contoh: Muatan beku -18°C, hubungi kasir saat tiba di tujuan"}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#38383C] bg-slate-50 dark:bg-[#28282C] text-xs focus:outline-none focus:ring-2 focus:ring-brand-purple resize-none leading-relaxed whitespace-pre-wrap break-words"
                />
              </div>
            </div>

            {/* Section: Final Dispatch Summary Review */}
            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {t.distStepSummaryTitle || "Ringkasan Final Surat Jalan"}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* Route Card */}
                <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t.distRouteFlowLabel || "Rute & Dokumen"}</span>
                  <p className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {originOutletObj.name} → {destName}
                  </p>
                  <p className="text-[11px] text-brand-purple dark:text-primary font-bold">
                    {shipType === "return" ? (t.distTypeReturnTitle || "Retur Pengembalian") : (t.distTypeOutboundTitle || "Distribusi Cabang")}
                  </p>
                </div>

                {/* Cost Card */}
                <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t.distSecCostTitle || "Biaya & Penanggung"}</span>
                  <p className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {shippingCostMode === "free"
                      ? (t.distCostModeFree || "Bebas Biaya")
                      : shippingCostMode === "driver_claim"
                      ? `Klaim Kurir (Plafon: ${maxClaimBudget > 0 ? `Rp ${maxClaimBudget.toLocaleString("id-ID")}` : "Bebas"})`
                      : `Rp ${totalDirectCost.toLocaleString("id-ID")}`}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Beban: {shippingCostPayer === "destination" ? "Outlet Tujuan" : shippingCostPayer === "central" ? "Kantor Pusat" : "Outlet Asal"}
                    {shippingCostMode === "fixed" && totalDirectCost > 0 && (
                      <span className="block text-[10px] text-slate-400 mt-0.5">
                        {[
                          costBBM > 0 ? `BBM: Rp ${costBBM.toLocaleString("id-ID")}` : "",
                          costOngkir > 0 ? `Ongkir: Rp ${costOngkir.toLocaleString("id-ID")}` : "",
                          costTolParkir > 0 ? `Tol: Rp ${costTolParkir.toLocaleString("id-ID")}` : "",
                          costUangJalan > 0 ? `Lainnya: Rp ${costUangJalan.toLocaleString("id-ID")}` : "",
                        ].filter(Boolean).join(" • ")}
                      </span>
                    )}
                  </p>
                </div>

                {/* Items Cargo Card */}
                <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t.distSummaryTotalHeader || "Total Muatan"}</span>
                  <p className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {creationSummary.totalItemsCount} Macam Barang
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {creationSummary.totalSealed > 0 && `${creationSummary.totalSealed} Dus `}
                    {creationSummary.totalLoose} Pcs Eceran
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3 Navigation Footer */}
            <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className="px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#202024] text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>{t.distBtnBackToItems || "Kembali ke Muatan Barang"}</span>
                </button>
                {editingTransferId && (
                  <button
                    type="button"
                    onClick={() => {
                      const currentDraft = distributions.find((d) => d.id === editingTransferId) || ({ id: editingTransferId } as DistributionItem);
                      setDeleteDraftDialogTransfer(currentDraft);
                    }}
                    className="px-4 py-2.5 rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Draf</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveDraft(true)}
                  disabled={isSubmitting || shipLines.length === 0}
                  className="px-5 py-3 rounded-2xl border border-slate-200 dark:border-[#38383C] bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-100 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  title="Simpan rencana pengiriman sebagai Draf tanpa memotong saldo stok fisik gudang asal"
                >
                  <FileText className="w-4 h-4 text-slate-500 dark:text-slate-300" />
                  <span>{isSubmitting ? "Menyimpan..." : "Simpan Draf"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCreateShipment()}
                  disabled={isSubmitting || shipLines.length === 0 || (!isStaffOrCashier && creationSummary.hasStockOverage)}
                  className="px-6 py-3 rounded-2xl bg-brand-purple hover:bg-brand-purple-hover text-white dark:bg-[#E2FF66] dark:text-slate-900 font-extrabold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isStaffOrCashier ? <PackagePlus className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                  <span>
                    {isSubmitting
                      ? (t.distBtnPublishing || "Memproses...")
                      : isStaffOrCashier
                      ? "Kirim Permintaan Pasokan Stok"
                      : editingTransferId
                      ? "Setujui & Terbitkan Surat Jalan"
                      : (t.distBtnPublishAndDeduct || "Terbitkan Surat Jalan & Potong Stok Gudang")}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* REUSABLE ITEM SELECTOR MODAL (DRAG-HOVER MULTI-SELECTION)                */}
        {/* ========================================================================= */}
        <ItemSelectorModal
          open={isItemPickerOpen}
          onOpenChange={setIsItemPickerOpen}
          title={`${language === "en" ? "Select Cargo Items from " : "Pilih Item Muatan dari "}${originOutletObj?.name || ""}`}
          description={t.itemPickerDescDefault || "Pilih barang yang akan dimuat ke armada pengiriman • Tahan & geser (drag) kursor untuk multi-pilih cepat"}
          items={items}
          selectedIds={shipLines.map((l) => l.item_id)}
          onConfirm={handleApplySelectedItems}
          showStockFilter={true}
          defaultInStockOnly={!isStaffOrCashier}
          confirmButtonText={t.itemPickerApply || "Terapkan ke Surat Jalan"}
        />
      </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: FULL-PAGE DETAIL & DELIVERY NOTE INSPECTION                       */}
      {/* ========================================================================= */}
      {currentView === "detail" && selectedTransfer && (
        <div className="space-y-6 pb-24 text-left">
          {/* 1. Header with Back Button & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200/80 dark:border-[#2E2E34] gap-4">
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={() => setCurrentView("master")}
              className="p-2.5 rounded-2xl border border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#202024] hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-xs"
              title={t.back || "Kembali"}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-extrabold text-sm text-brand-purple dark:text-primary tracking-wide">
                  {selectedTransfer.transfer_no || `SJ-${selectedTransfer.id.slice(0, 8).toUpperCase()}`}
                </span>

                {/* Transfer Type Badge */}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isReturnDoc
                    ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                    : "bg-brand-purple/10 text-brand-purple dark:bg-primary/10 dark:text-primary border-brand-purple/20"
                }`}>
                  {isReturnDoc ? (t.distReturnBadge || "Retur") : (t.distOutboundBadge || "Outbound")}
                </span>

                {/* Status Badges */}
                {isInTransit && (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 animate-pulse flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5" />
                    {t.logisticsInTransit || "Dalam Perjalanan"}
                  </span>
                )}
                {isReceived && (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {t.logisticsReceived || "Selesai Diterima"}
                  </span>
                )}
                {isReturned && (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-600 border border-red-500/20 flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5" />
                    {t.distKpiReturned || "Retur / Batal"}
                  </span>
                )}
                {selectedTransfer.backorder_status === "is_backorder" && (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800/50 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>{t.distBackorderChildBadge || "Pecahan Backorder"}</span>
                  </span>
                )}
                {selectedTransfer.backorder_status === "has_backorder" && (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800/50 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>{t.distBackorderParentBadge || "Memiliki Backorder"}</span>
                  </span>
                )}
                {isCancelled && (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-500/10 text-slate-600 border border-slate-500/20 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {t.logisticsStatusCancelled || "Dibatalkan"}
                  </span>
                )}
              </div>
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
                {t.distDetailTitle || "Rincian Surat Jalan & Serah Terima Fisik"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {isInTransit && isRecipientForSelected && (
              <button
                type="button"
                onClick={() => handleConfirmReceiveDetail()}
                disabled={isSubmitting || receiveSummary.hasOverage}
                className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t.processing || "Memproses..."}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t.distReceiveConfirmBtn || "Konfirmasi Terima (Handshake)"}</span>
                  </>
                )}
              </button>
            )}

            {isInTransit && !isRecipientForSelected && (
              <span className="px-3.5 py-2 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 text-amber-700 dark:text-amber-400 text-xs font-semibold flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span>Menunggu serah terima oleh {selectedTransfer.to_outlet_name || "Outlet Penerima"}</span>
              </span>
            )}

            {selectedTransfer.status === "pending_approval" && isOwnerOrAdmin && (
              <button
                type="button"
                onClick={() => handleOpenEditDraft(selectedTransfer)}
                className="px-5 py-2.5 rounded-2xl bg-brand-purple hover:bg-brand-purple-hover text-white dark:bg-[#E2FF66] dark:text-slate-900 font-extrabold text-xs shadow-sm transition-all cursor-pointer flex items-center gap-2"
              >
                <Package className="w-4 h-4" />
                <span>Proses & Alokasikan Pasokan</span>
              </button>
            )}

            {(selectedTransfer.status === "in_transit" || selectedTransfer.status === "sent") && (
              <button
                type="button"
                onClick={() => handleOpenEdit(selectedTransfer)}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#202024] hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-xs"
              >
                <Pencil className="w-4 h-4 text-slate-500" />
                <span>{t.distBtnEdit || "Edit Pengiriman & Biaya"}</span>
              </button>
            )}

            {(selectedTransfer.status === "in_transit" || selectedTransfer.status === "sent" || selectedTransfer.status === "pending_approval") && (
              <button
                type="button"
                onClick={() => {
                  setCancelDialogTransfer(selectedTransfer);
                  setCancelReason("");
                }}
                className="px-4 py-2.5 rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-xs"
              >
                <XCircle className="w-4 h-4" />
                <span>Batalkan Pengiriman</span>
              </button>
            )}

            {selectedTransfer.status === "draft" && (
              <button
                type="button"
                onClick={() => setDeleteDraftDialogTransfer(selectedTransfer)}
                className="px-4 py-2.5 rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-xs"
              >
                <Trash2 className="w-4 h-4" />
                <span>Hapus Draf</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setPrintSlipDist(selectedTransfer)}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#202024] hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-xs"
            >
              <Printer className="w-4 h-4 text-brand-purple dark:text-primary" />
              <span>{t.distBtnPrint || "Cetak Surat Jalan"}</span>
            </button>
          </div>
        </div>

        {/* 2. Visual Delivery Flow Tracking Stepper */}
        <div className="p-5 rounded-3xl bg-white dark:bg-[#202024] border border-slate-200/80 dark:border-[#38383C] shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
            {/* Step 1: Dispatched */}
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-brand-purple/10 text-brand-purple dark:bg-primary/10 dark:text-primary flex items-center justify-center shrink-0 mt-0.5">
                <Package className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {t.distDetailStepperSent || "Pengiriman Diterbitkan"}
                </span>
                <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                  {selectedTransfer.from_outlet_name || "Gudang Asal"}
                </p>
                <p className="text-[11px] text-slate-500">
                  {selectedTransfer.sent_by_user_name || "Admin"} • {new Date(selectedTransfer.sent_at || selectedTransfer.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
            </div>

            {/* Step 2: In Transit */}
            <div className="flex items-start gap-3.5">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${
                isInTransit
                  ? "bg-amber-500/10 text-amber-600 ring-2 ring-amber-500/20"
                  : "bg-slate-100 dark:bg-[#28282C] text-slate-500"
              }`}>
                <Truck className={`w-5 h-5 ${isInTransit ? "animate-pulse" : ""}`} />
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {t.distDetailStepperInTransit || "Dalam Perjalanan"}
                </span>
                <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                  {selectedTransfer.driver_name || selectedTransfer.sent_to_user_name || "Armada Internal"}
                </p>
                <p className="text-[11px] text-slate-500">
                  {activeCarrierLabel} {selectedTransfer.vehicle_plate ? `(${selectedTransfer.vehicle_plate})` : ""}
                </p>
              </div>
            </div>

            {/* Step 3: Received / Handshake */}
            <div className="flex items-start gap-3.5">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${
                isReceived
                  ? "bg-emerald-500/10 text-emerald-600 ring-2 ring-emerald-500/20"
                  : "bg-slate-100 dark:bg-[#28282C] text-slate-400"
              }`}>
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {t.distDetailStepperReceived || "Serah Terima Selesai"}
                </span>
                <p className={`text-xs font-extrabold ${isReceived ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"}`}>
                  {isReceived ? (selectedTransfer.to_outlet_name || "Cabang") : (t.distDetailWaitingArrival || "Menunggu Kedatangan")}
                </p>
                <p className="text-[11px] text-slate-500">
                  {isReceived && selectedTransfer.received_at
                    ? `${selectedTransfer.received_by_user_name || "Petugas Cabang"} • ${new Date(selectedTransfer.received_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}`
                    : (t.distWaitingConfirm || "Menunggu verifikasi fisik kasir")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 3. 4-Column Info Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
          {/* Origin Card */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#202024] border border-slate-200/80 dark:border-[#38383C] space-y-3 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {t.distDetailOriginTitle || "Gudang Asal (Pengirim)"}
                </span>
                <Building2 className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-base font-black text-slate-900 dark:text-white mt-1">
                {selectedTransfer.from_outlet_name || "Gudang Pusat"}
              </p>
            </div>

            <div className="text-xs text-slate-500 space-y-1.5 pt-3 border-t border-slate-100 dark:border-white/5">
              <div className="flex items-center justify-between">
                <span>{t.distDetailIssuedBy || "Diterbitkan Oleh:"}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedTransfer.sent_by_user_name || "Admin"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t.distDetailIssuedAt || "Waktu Terbit:"}</span>
                <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                  {new Date(selectedTransfer.sent_at || selectedTransfer.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] pt-1 text-slate-400">
                <span>{t.distDetailLedgerStatus || "Status Ledger"}:</span>
                <span className="text-brand-purple dark:text-primary font-bold">Stok Asal Terpotong</span>
              </div>
            </div>
          </div>

          {/* Destination Card */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#202024] border border-slate-200/80 dark:border-[#38383C] space-y-3 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {t.distDetailDestTitle || "Outlet Tujuan (Penerima)"}
                </span>
                <MapPin className="w-4 h-4 text-brand-purple dark:text-primary" />
              </div>
              <p className="text-base font-black text-brand-purple dark:text-primary mt-1">
                {selectedTransfer.to_outlet_name || "Cabang"}
              </p>
            </div>

            <div className="text-xs text-slate-500 space-y-1.5 pt-3 border-t border-slate-100 dark:border-white/5">
              <div className="flex items-center justify-between">
                <span>{t.distDetailReceivedBy || "Diterima Oleh:"}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {selectedTransfer.received_by_user_name || (isInTransit ? (t.distDetailWaitingArrival || "Menunggu Kedatangan") : "-")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t.distDetailReceivedAt || "Waktu Terima:"}</span>
                <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                  {selectedTransfer.received_at
                    ? new Date(selectedTransfer.received_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })
                    : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="text-slate-400">{t.distDetailLedgerStatus || "Status Ledger"}:</span>
                <span className={`font-bold ${isReceived ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"}`}>
                  {isReceived ? "Stok Masuk Neraca" : "Menunggu Serah Terima"}
                </span>
              </div>
            </div>
          </div>

          {/* Courier Card */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#202024] border border-slate-200/80 dark:border-[#38383C] space-y-3 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {t.distDetailCarrierTitle || "Armada & Kurir"}
                </span>
                <Car className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-base font-black text-slate-900 dark:text-white">
                  {selectedTransfer.driver_name || selectedTransfer.sent_to_user_name || "Armada Internal"}
                </p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                  {activeCarrierLabel}
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-500 space-y-1.5 pt-3 border-t border-slate-100 dark:border-white/5">
              <div className="flex items-center justify-between">
                <span>{t.distDetailPlate || "Plat Kendaraan:"}</span>
                <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#28282C] text-slate-800 dark:text-slate-200">
                  {selectedTransfer.vehicle_plate || "-"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t.distDetailContact || "No. Kontak:"}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {selectedTransfer.driver_phone || "-"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] pt-1 text-slate-400">
                <span>{t.distDetailDocRef || "No. Dokumen"}:</span>
                <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400">
                  {selectedTransfer.transfer_no || selectedTransfer.id.slice(0, 8)}
                </span>
              </div>
            </div>
          </div>

          {/* Shipping & Logistics Cost Card */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#202024] border border-slate-200/80 dark:border-[#38383C] space-y-3 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {selectedTransfer.shipping_cost_mode === "driver_claim"
                    ? (t.distCostModeDriverClaim || "Klaim Kurir (QR)")
                    : selectedTransfer.shipping_cost_mode === "free"
                    ? (t.distCostModeFree || "Bebas Biaya")
                    : (t.distDetailShippingTitle || "Biaya Distribusi & Ongkir")}
                </span>
                {selectedTransfer.shipping_cost_mode === "driver_claim" ? (
                  <QrCode className="w-4 h-4 text-brand-purple dark:text-primary" />
                ) : (
                  <Banknote className="w-4 h-4 text-emerald-500" />
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-base font-black text-slate-900 dark:text-white">
                  {Number(selectedTransfer.shipping_cost || 0) > 0
                    ? `Rp ${Number(selectedTransfer.shipping_cost).toLocaleString("id-ID")}`
                    : selectedTransfer.shipping_cost_mode === "driver_claim"
                    ? (selectedTransfer.claim_status === "pending"
                        ? `Rp ${Number(selectedTransfer.claimed_amount || 0).toLocaleString("id-ID")}`
                        : selectedTransfer.claim_status === "approved"
                        ? `Rp ${Number(selectedTransfer.claimed_amount || 0).toLocaleString("id-ID")}`
                        : (t.distClaimStatusUnsubmitted || "Menunggu Klaim"))
                    : (t.distShippingFree || "Gratis / Rp 0")}
                </p>
                {selectedTransfer.shipping_cost_mode === "driver_claim" ? (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    selectedTransfer.claim_status === "approved"
                      ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                      : selectedTransfer.claim_status === "rejected"
                      ? "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                      : selectedTransfer.claim_status === "pending"
                      ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 animate-pulse"
                      : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300"
                  }`}>
                    {selectedTransfer.claim_status === "approved"
                      ? (t.distClaimStatusApproved || "Disetujui")
                      : selectedTransfer.claim_status === "rejected"
                      ? (t.distClaimStatusRejected || "Ditolak")
                      : selectedTransfer.claim_status === "pending"
                      ? (t.distClaimStatusPending || "Menunggu ACC")
                      : (t.distClaimStatusUnsubmitted || "Belum Klaim")}
                  </span>
                ) : Number(selectedTransfer.shipping_cost || 0) > 0 ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
                    {selectedTransfer.shipping_cost_payer === "destination"
                      ? (t.distPayerDestShort || "Tujuan")
                      : selectedTransfer.shipping_cost_payer === "central"
                      ? (t.distPayerCentralShort || "Pusat")
                      : (t.distPayerOriginShort || "Pengirim")}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="text-xs text-slate-500 space-y-1.5 pt-3 border-t border-slate-100 dark:border-white/5">
              <div className="flex items-center justify-between">
                <span>{selectedTransfer.shipping_cost_mode === "driver_claim" ? "Batas Plafon:" : (t.distPaymentMethodLabel || "Metode Bayar:")}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {selectedTransfer.shipping_cost_mode === "driver_claim"
                    ? (Number(selectedTransfer.max_claim_budget || 0) > 0
                        ? `Rp ${Number(selectedTransfer.max_claim_budget).toLocaleString("id-ID")}`
                        : "Tanpa Batas")
                    : selectedTransfer.shipping_payment_method === "bank_transfer"
                    ? "Transfer Bank"
                    : selectedTransfer.shipping_payment_method === "on_account"
                    ? (t.distPaymentAccount || "Tagihan Tempo")
                    : "Tunai (Cash)"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>{selectedTransfer.shipping_cost_mode === "driver_claim" ? "Token Klaim:" : (t.distSlipTracking || "No. Resi / AWB:")}</span>
                {selectedTransfer.shipping_cost_mode === "driver_claim" && selectedTransfer.claim_token ? (
                  <span
                    onClick={() => {
                      if (selectedTransfer.claim_token) {
                        navigator.clipboard.writeText(selectedTransfer.claim_token);
                        toast.success("Token klaim kurir disalin");
                      }
                    }}
                    className="font-mono text-[11px] font-bold text-brand-purple dark:text-primary cursor-pointer hover:underline flex items-center gap-1"
                    title="Klik untuk menyalin token klaim"
                  >
                    {selectedTransfer.claim_token}
                    <Copy className="w-3 h-3" />
                  </span>
                ) : selectedTransfer.tracking_ref_no ? (
                  <span
                    onClick={() => {
                      if (selectedTransfer.tracking_ref_no) {
                        navigator.clipboard.writeText(selectedTransfer.tracking_ref_no);
                        toast.success("No. Resi disalin");
                      }
                    }}
                    className="font-mono text-[11px] font-bold text-brand-purple dark:text-primary cursor-pointer hover:underline flex items-center gap-1"
                    title="Klik untuk menyalin resi"
                  >
                    {selectedTransfer.tracking_ref_no}
                    <Copy className="w-3 h-3" />
                  </span>
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </div>
              <div className="flex items-center justify-between text-[11px] pt-1 text-slate-400">
                <span>Pihak Penanggung:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {selectedTransfer.shipping_cost_payer === "destination"
                    ? (t.distPayerDest || "Cabang Penerima")
                    : selectedTransfer.shipping_cost_payer === "central"
                    ? (t.distPayerCentral || "Kantor Pusat")
                    : (t.distPayerOrigin || "Gudang Pengirim")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Manager Claim Review & Decision Card (Only for driver_claim mode) */}
        {selectedTransfer.shipping_cost_mode === "driver_claim" && (
          <div className={`p-6 rounded-3xl border shadow-xs space-y-4 ${
            selectedTransfer.claim_status === "pending"
              ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-300/80 dark:border-amber-700/50"
              : selectedTransfer.claim_status === "approved"
              ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300/80 dark:border-emerald-700/50"
              : selectedTransfer.claim_status === "rejected"
              ? "bg-red-50/40 dark:bg-red-950/20 border-red-300/80 dark:border-red-700/50"
              : "bg-white dark:bg-[#202024] border-slate-200/80 dark:border-[#38383C]"
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200/60 dark:border-white/10 gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  selectedTransfer.claim_status === "approved"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : selectedTransfer.claim_status === "rejected"
                    ? "bg-red-500/10 text-red-600 dark:text-red-400"
                    : selectedTransfer.claim_status === "pending"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "bg-brand-purple/10 text-brand-purple dark:bg-primary/10 dark:text-primary"
                }`}>
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {t.distClaimReviewTitle || "Persetujuan Klaim Biaya Kurir (Reimbursement)"}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t.distClaimReviewDesc || "Verifikasi pengeluaran riil bensin, tol, atau ongkir yang diajukan kurir di jalan."}
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="shrink-0">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                  selectedTransfer.claim_status === "approved"
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                    : selectedTransfer.claim_status === "rejected"
                    ? "bg-red-500/10 text-red-600 border-red-500/30"
                    : selectedTransfer.claim_status === "pending"
                    ? "bg-amber-500/10 text-amber-600 border-amber-500/30 animate-pulse"
                    : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10"
                }`}>
                  {selectedTransfer.claim_status === "approved" && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {selectedTransfer.claim_status === "rejected" && <XCircle className="w-3.5 h-3.5" />}
                  {selectedTransfer.claim_status === "pending" && <Clock className="w-3.5 h-3.5" />}
                  <span>
                    {selectedTransfer.claim_status === "approved"
                      ? (t.distClaimStatusApproved || "Klaim Disetujui")
                      : selectedTransfer.claim_status === "rejected"
                      ? (t.distClaimStatusRejected || "Klaim Ditolak")
                      : selectedTransfer.claim_status === "pending"
                      ? (t.distClaimStatusPending || "Menunggu Persetujuan Manager")
                      : (t.distClaimStatusUnsubmitted || "Belum Diajukan oleh Kurir")}
                  </span>
                </span>
              </div>
            </div>

            {/* Claim Content when submitted */}
            {selectedTransfer.claim_status && selectedTransfer.claim_status !== "unsubmitted" ? (
              <div className="space-y-4">
                {/* Plafon Budget Alert if exceeded */}
                {Number(selectedTransfer.max_claim_budget || 0) > 0 &&
                  Number(selectedTransfer.claimed_amount || 0) > Number(selectedTransfer.max_claim_budget || 0) && (
                  <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      {(t.distBudgetExceededAlert || "Perhatian: Pengajuan klaim Rp {amount} melebihi plafon anggaran maksimal Rp {budget} (Selisih +Rp {diff})")
                        .replace("{amount}", Number(selectedTransfer.claimed_amount).toLocaleString("id-ID"))
                        .replace("{budget}", Number(selectedTransfer.max_claim_budget).toLocaleString("id-ID"))
                        .replace("{diff}", (Number(selectedTransfer.claimed_amount) - Number(selectedTransfer.max_claim_budget)).toLocaleString("id-ID"))}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Nominal Claimed */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-[#202024] border border-slate-200/80 dark:border-[#38383C] space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {t.distClaimNominalSubmitted || "Nominal Diajukan Kurir"}
                    </span>
                    <p className="text-xl font-black text-slate-900 dark:text-white">
                      Rp {Number(selectedTransfer.claimed_amount || 0).toLocaleString("id-ID")}
                    </p>
                    {Number(selectedTransfer.max_claim_budget || 0) > 0 && (
                      <span className="text-[10px] text-slate-400 block">
                        Plafon: Rp {Number(selectedTransfer.max_claim_budget).toLocaleString("id-ID")}
                      </span>
                    )}
                  </div>

                  {/* Claim Notes */}
                  <div className="sm:col-span-2 p-4 rounded-2xl bg-white dark:bg-[#202024] border border-slate-200/80 dark:border-[#38383C] space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {t.distClaimNotes || "Rincian & Catatan Kurir"}
                    </span>
                    <p className="text-xs text-slate-800 dark:text-slate-200 font-medium">
                      {selectedTransfer.claimed_notes || "- (Tidak ada catatan rincian)"}
                    </p>
                    {selectedTransfer.claimed_at && (
                      <span className="text-[10px] text-slate-400 block pt-1">
                        Diajukan pada: {new Date(selectedTransfer.claimed_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Receipt Attachment Link / Preview if available */}
                {selectedTransfer.claimed_attachment_url && (
                  <div className="p-3.5 rounded-2xl bg-white dark:bg-[#202024] border border-slate-200/80 dark:border-[#38383C] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-brand-purple dark:text-primary" />
                      <span className="font-bold text-slate-800 dark:text-slate-200">{t.distClaimReceipt || "Foto Bukti Struk / Nota"}</span>
                    </div>
                    <a
                      href={selectedTransfer.claimed_attachment_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-purple dark:text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Lihat Bukti Foto</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}

                {/* Manager Decision Actions when Pending */}
                {selectedTransfer.claim_status === "pending" && (
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRejectDialogDist(selectedTransfer);
                        setRejectReason("");
                      }}
                      disabled={isProcessingClaim}
                      className="px-4 py-2.5 rounded-2xl border border-red-200 dark:border-red-800/40 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>{t.distBtnRejectClaim || "Tolak Klaim"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApproveClaim(selectedTransfer.id)}
                      disabled={isProcessingClaim}
                      className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isProcessingClaim ? (t.processing || "Memproses...") : (t.distBtnApproveClaim || "Setujui Klaim")}</span>
                    </button>
                  </div>
                )}

                {/* Approved / Rejected Banner */}
                {selectedTransfer.claim_status === "approved" && (
                  <div className="p-3.5 rounded-2xl bg-emerald-100/70 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/50 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>
                      Klaim telah <strong>disetujui</strong> oleh {selectedTransfer.claim_reviewed_by_name || "Manager"}
                      {selectedTransfer.claim_reviewed_at && ` pada ${new Date(selectedTransfer.claim_reviewed_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}`}. Nominal Rp {Number(selectedTransfer.shipping_cost || selectedTransfer.claimed_amount || 0).toLocaleString("id-ID")} telah dibukukan.
                    </span>
                  </div>
                )}

                {selectedTransfer.claim_status === "rejected" && (
                  <div className="p-3.5 rounded-2xl bg-red-100/70 dark:bg-red-950/40 border border-red-300 dark:border-red-800/50 space-y-1 text-xs text-red-800 dark:text-red-300">
                    <div className="flex items-center gap-2 font-bold">
                      <XCircle className="w-4 h-4 shrink-0" />
                      <span>
                        Klaim <strong>ditolak</strong> oleh {selectedTransfer.claim_reviewed_by_name || "Manager"}
                        {selectedTransfer.claim_reviewed_at && ` pada ${new Date(selectedTransfer.claim_reviewed_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}`}
                      </span>
                    </div>
                    {selectedTransfer.claim_rejection_reason && (
                      <p className="pl-6 text-[11px] italic text-red-700 dark:text-red-400">
                        Alasan penolakan: &quot;{selectedTransfer.claim_rejection_reason}&quot;
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Unsubmitted Claim State */
              <div className="p-4 rounded-2xl bg-white dark:bg-[#202024] border border-slate-200/80 dark:border-[#38383C] space-y-3 text-xs">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <QrCode className="w-4 h-4 text-brand-purple dark:text-primary shrink-0" />
                  <span>
                    Kurir belum mengajukan klaim pengeluaran perjalanan. Kurir dapat memindai QR Code di lembar Surat Jalan fisik atau membuka tautan portal kurir berikut:
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                  <div className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#28282C] border border-slate-200 dark:border-[#38383C] font-mono text-[11px] text-slate-600 dark:text-slate-400 truncate">
                    {typeof window !== "undefined" ? window.location.origin : ""}/claim/{selectedTransfer.claim_token}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const origin = typeof window !== "undefined" ? window.location.origin : "";
                      navigator.clipboard.writeText(`${origin}/claim/${selectedTransfer.claim_token}`);
                      toast.success(t.distCopyClaimLink || "Link portal klaim kurir disalin!");
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-slate-200 font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{t.distCopyClaimLink || "Salin Link"}</span>
                  </button>
                  <a
                    href={`/claim/${selectedTransfer.claim_token}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 rounded-xl bg-brand-purple/10 text-brand-purple dark:bg-primary/10 dark:text-primary font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{t.distOpenClaimPortal || "Buka Portal"}</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. Delivery Notes & Special Instructions Card (if any) */}
        {selectedTransfer.notes && (
          <div className="p-4 rounded-3xl bg-slate-50 dark:bg-[#202024] border border-slate-200/80 dark:border-[#38383C] text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">
              <Info className="w-3.5 h-3.5 text-brand-purple dark:text-primary" />
              <span>{t.distDetailInstructions || "Instruksi & Catatan Khusus Pengiriman"}</span>
            </div>
            <p className="font-medium text-slate-800 dark:text-slate-200 pl-5 whitespace-pre-wrap break-words leading-relaxed">
              {selectedTransfer.notes}
            </p>
          </div>
        )}

        {/* 5. Multi-Item Table / Handshake Verification Form in Detail */}
        {isInTransit && isRecipientForSelected ? (
          /* ========================================================================= */
          /* INLINE HANDSHAKE VERIFICATION FORM (SESUAI VS SELISIH PER BARIS)          */
          /* ========================================================================= */
          <div className="p-6 rounded-3xl bg-white dark:bg-[#202024] border border-slate-200/80 dark:border-[#38383C] shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-white/5 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {t.distVerificationFormTitle || "Verifikasi Fisik & Serah Terima Muatan (Handshake)"}
                  </h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {t.distVerificationFormDesc || "Periksa kondisi fisik barang saat tiba. Tandai 'Sesuai' jika kuantitas utuh, atau pilih 'Selisih' untuk mencatat kuantitas nyata yang diterima."}
                </p>
              </div>

              <button
                type="button"
                onClick={handleSetAllSesuai}
                className="px-4 py-2 rounded-xl bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-xs active:scale-95"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{t.distAllSesuai || "Semua Sesuai (100% Utuh)"}</span>
              </button>
            </div>

            {/* Table of Verification Items */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3">{t.distThNo || "No"}</th>
                    <th className="py-2.5 px-3">{t.distThItem || "Item Barang"}</th>
                    <th className="py-2.5 px-3 text-right">{t.distThQtySent || "Kuantitas Dikirim"}</th>
                    <th className="py-2.5 px-3 text-center">{t.distColPhysicalStatus || "Kondisi Fisik"}</th>
                    <th className="py-2.5 px-3">{t.distThQtyReceived || "Kuantitas Diterima Fisik"}</th>
                    <th className="py-2.5 px-3 text-right">{t.distThShrinkage || "Status / Selisih"}</th>
                  </tr>
                </thead>
                <tbody>
                  {receiveLines.map((l, idx) => {
                    const hasBox = (l.qty_sent_sealed || 0) > 0;
                    const hasSentLoose = (l.qty_sent_loose || 0) > 0;
                    const isIntact = l.qty_received_sealed === l.qty_sent_sealed && l.qty_received_loose === l.qty_sent_loose;
                    const isOverage = l.qty_received_sealed > l.qty_sent_sealed || l.qty_received_loose > l.qty_sent_loose;
                    const isShrinkage = !isOverage && (l.qty_received_sealed < l.qty_sent_sealed || l.qty_received_loose < l.qty_sent_loose);
                    const isSesuaiMode = l.mode === "sesuai";

                    return (
                      <tr
                        key={l.item_id || idx}
                        className={`border-b border-slate-100 dark:border-white/5 text-xs transition-colors ${
                          !isSesuaiMode ? "bg-amber-500/5 dark:bg-amber-500/10" : "hover:bg-slate-50/50 dark:hover:bg-white/5"
                        }`}
                      >
                        {/* No */}
                        <td className="py-3 px-3 text-slate-400 font-mono font-bold">{idx + 1}</td>

                        {/* Item Name & SKU */}
                        <td className="py-3 px-3">
                          <span className="font-extrabold text-slate-900 dark:text-white block">{l.item_name}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            {l.item_sku && (
                              <span className="text-[10px] font-mono text-slate-400 block">SKU: {l.item_sku}</span>
                            )}
                            {l.conversion_rate > 1 && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/10 text-slate-500">
                                1 {l.box_unit} = {l.conversion_rate} {l.base_unit}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Quantity Sent */}
                        <td className="py-3 px-3 text-right font-extrabold text-slate-900 dark:text-white">
                          <div>
                            {hasBox && <span>{l.qty_sent_sealed} {l.box_unit}</span>}
                            {hasBox && hasSentLoose && <span> + </span>}
                            {hasSentLoose && <span>{l.qty_sent_loose} {l.base_unit}</span>}
                            {!hasBox && !hasSentLoose && <span>0 {l.base_unit}</span>}
                          </div>
                          {l.conversion_rate > 1 && hasBox && (
                            <span className="text-[10px] font-mono text-slate-400 font-normal block">
                              (Total {(l.qty_sent_sealed * l.conversion_rate) + l.qty_sent_loose} {l.base_unit})
                            </span>
                          )}
                        </td>

                        {/* Sesuai vs Selisih Toggle */}
                        <td className="py-3 px-3 text-center">
                          <div className="inline-flex p-0.5 rounded-xl bg-slate-100 dark:bg-[#28282C] border border-slate-200/80 dark:border-white/5">
                            <button
                              type="button"
                              onClick={() => handleToggleLineMode(idx, "sesuai")}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                isSesuaiMode
                                  ? "bg-emerald-600 text-white shadow-xs"
                                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                              }`}
                            >
                              <Check className="w-3 h-3" />
                              <span>{t.distBtnSesuai || "Sesuai"}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleLineMode(idx, "selisih")}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                !isSesuaiMode
                                  ? "bg-amber-500 text-white shadow-xs"
                                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                              }`}
                            >
                              <AlertTriangle className="w-3 h-3" />
                              <span>{t.distBtnSelisih || "Selisih"}</span>
                            </button>
                          </div>
                        </td>

                        {/* Physical Quantity Received Input / Display */}
                        <td className="py-3 px-3">
                          {isSesuaiMode ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800/40">
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>
                                {hasBox && `${l.qty_received_sealed} ${l.box_unit} + `}{l.qty_received_loose} {l.base_unit} (100% Utuh)
                              </span>
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              {hasBox && (
                                <div className="space-y-0.5">
                                  <label className="text-[9px] font-bold text-slate-400 block">
                                    {l.box_unit}
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    max={l.qty_sent_sealed}
                                    step="1"
                                    value={l.qty_received_sealed}
                                    onChange={(e) => handleUpdateReceiveQty(idx, "qty_received_sealed", parseFloat(e.target.value) || 0)}
                                    className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#202024] font-bold text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                                  />
                                </div>
                              )}
                              <div className="space-y-0.5">
                                <label className="text-[9px] font-bold text-slate-400 block">
                                  {l.base_unit}
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={l.qty_received_loose}
                                  onChange={(e) => handleUpdateReceiveQty(idx, "qty_received_loose", parseFloat(e.target.value) || 0)}
                                  className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#202024] font-bold text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Status / Shrinkage Feedback */}
                        <td className="py-3 px-3 text-right font-extrabold">
                          {isIntact && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs inline-flex items-center gap-1">
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>{t.distDetailStatusIntact || "Utuh (0 Selisih)"}</span>
                            </span>
                          )}

                          {isOverage && (
                            <span className="text-rose-600 dark:text-rose-400 font-bold text-xs inline-flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>{t.distReceiveOverageWarning || "Melebihi Kirim"}</span>
                            </span>
                          )}

                          {isShrinkage && (
                            <span className="text-amber-600 dark:text-amber-400 font-bold text-xs inline-flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>
                                -{l.qty_sent_sealed - l.qty_received_sealed > 0 && `${l.qty_sent_sealed - l.qty_received_sealed} ${l.box_unit} `}
                                {l.qty_sent_loose - l.qty_received_loose > 0 && `${l.qty_sent_loose - l.qty_received_loose} ${l.base_unit}`} Susut
                              </span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Physical Condition Notes Input */}
            <div className="space-y-1.5 pt-2">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                {t.distReceiveNotesLabel || "Catatan Kondisi Barang Fisik"}
              </label>
              <textarea
                rows={2}
                value={recvNotes}
                onChange={(e) => setRecvNotes(e.target.value)}
                placeholder={t.distReceiveNotesPlaceholder || "Contoh: Kondisi beku utuh / segel aman / ada kemasan rusak..."}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#38383C] bg-slate-50 dark:bg-[#28282C] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none leading-relaxed whitespace-pre-wrap break-words"
              />
            </div>

            {/* Handshake Summary Bar & Submit Action */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#28282C] border border-slate-200/80 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {t.distReceiveSummaryTotalItems || "Total Item"}
                  </span>
                  <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                    {receiveSummary.totalItems} Macam
                  </span>
                </div>

                <div className="h-6 w-px bg-slate-200 dark:bg-white/10 hidden sm:block" />

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {t.distReceiveSummaryReceived || "Total Diterima"}
                  </span>
                  <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                    {receiveSummary.totalRecvSealed > 0 && `${receiveSummary.totalRecvSealed} Dus `}
                    {receiveSummary.totalRecvLoose} Pcs
                  </span>
                </div>

                <div className="h-6 w-px bg-slate-200 dark:bg-white/10 hidden sm:block" />

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {t.distReceiveSummaryStatus || "Status Verifikasi"}
                  </span>
                  {receiveSummary.isAllIntact ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[11px] font-extrabold border border-emerald-200 dark:border-emerald-800/40 inline-flex items-center gap-1 mt-0.5">
                      <Check className="w-3 h-3 stroke-[2.5]" />
                      {t.distReceiveStatusAllIntact || "Semua Sesuai (100% Utuh)"}
                    </span>
                  ) : receiveSummary.hasOverage ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 text-[11px] font-extrabold border border-rose-200 dark:border-rose-800/40 inline-flex items-center gap-1 mt-0.5">
                      <AlertCircle className="w-3 h-3 stroke-[2.5]" />
                      {t.distReceiveStatusOverage || "Kuantitas Melebihi Kirim"}
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-[11px] font-extrabold border border-amber-200 dark:border-amber-800/40 inline-flex items-center gap-1 mt-0.5">
                      <AlertCircle className="w-3 h-3 stroke-[2.5]" />
                      {t.distReceiveStatusShrinkage || "Terdapat Selisih Susut Fisik"}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setCurrentView("master")}
                  className="flex-1 sm:flex-initial px-4 py-3 rounded-2xl border border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#202024] hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer text-center"
                >
                  {t.cancel || "Batal"}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReceiveDetail}
                  disabled={isSubmitting || receiveSummary.hasOverage}
                  className="flex-1 sm:flex-initial px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t.processing || "Memproses..."}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{t.distBtnConfirmHandshakeDetail || "Konfirmasi Terima Barang & Masukkan ke Stok Outlet"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* HISTORICAL READ-ONLY INSPECTION TABLE (RECEIVED / RETURNED / CANCELLED)   */
          /* ========================================================================= */
          <div className="p-6 rounded-3xl bg-white dark:bg-[#202024] border border-slate-200/80 dark:border-[#38383C] shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {t.distDetailManifestTitle || "Daftar Barang dalam Surat Jalan"}
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {(t.distSummaryTotalText || "{items} Macam Barang — {sealed} Dus / Karton + {loose} Pcs Eceran")
                    .replace("{items}", String(totalKinds))
                    .replace("{sealed}", String(totalSealedSent))
                    .replace("{loose}", String(totalLooseSent))}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                  {totalBaseEquivalentSent} Unit Dasar
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3">{t.distThNo || "No"}</th>
                    <th className="py-2.5 px-3">{t.distThItem || "Item Barang"}</th>
                    {manifestItems.some((it) => (it.qty_requested_sealed || 0) > 0 || (it.qty_requested_loose || 0) > 0) && (
                      <th className="py-2.5 px-3 text-right">{t.distRequestedQty || "Kuantitas Diminta"}</th>
                    )}
                    <th className="py-2.5 px-3 text-right">{t.distThQtySent || "Kuantitas Dikirim / Alokasi"}</th>
                    <th className="py-2.5 px-3 text-right">{t.distThQtyReceived || "Kuantitas Diterima"}</th>
                    <th className="py-2.5 px-3 text-right">{t.distThShrinkage || "Susut / Selisih"}</th>
                    <th className="py-2.5 px-3">{t.distThNotes || "Catatan / Alasan"}</th>
                  </tr>
                </thead>
                <tbody>
                  {manifestItems.map((it, idx) => {
                    const hasSentSealed = (it.qty_sent_sealed || 0) > 0;
                    const hasSentLoose = (it.qty_sent_loose || 0) > 0;
                    const hasReqSealed = (it.qty_requested_sealed || 0) > 0;
                    const hasReqLoose = (it.qty_requested_loose || 0) > 0;
                    const hasAnyRequested = manifestItems.some((m) => (m.qty_requested_sealed || 0) > 0 || (m.qty_requested_loose || 0) > 0);
                    const boxLabel = it.box_unit || "Dus";
                    const baseLabel = it.base_unit || "pcs";
                    const convRate = it.conversion_rate && it.conversion_rate > 0 ? it.conversion_rate : 1;

                    return (
                      <tr key={it.id || idx} className="border-b border-slate-100 dark:border-white/5 text-xs hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                        <td className="py-3 px-3 text-slate-400 font-mono font-bold">{idx + 1}</td>
                        <td className="py-3 px-3">
                          <span className="font-extrabold text-slate-900 dark:text-white block">{it.item_name}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            {it.item_sku && (
                              <span className="text-[10px] font-mono text-slate-400 block">SKU: {it.item_sku}</span>
                            )}
                            {convRate > 1 && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/10 text-slate-500">
                                {(t.distDetailConversionTag || "1 {box} = {rate} {base}")
                                  .replace("{box}", boxLabel)
                                  .replace("{rate}", String(convRate))
                                  .replace("{base}", baseLabel)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Requested column */}
                        {hasAnyRequested && (
                          <td className="py-3 px-3 text-right font-bold text-purple-700 dark:text-purple-300">
                            <div>
                              {hasReqSealed && <span>{it.qty_requested_sealed} {boxLabel}</span>}
                              {hasReqSealed && hasReqLoose && <span> + </span>}
                              {hasReqLoose && <span>{it.qty_requested_loose} {baseLabel}</span>}
                              {!hasReqSealed && !hasReqLoose && <span>-</span>}
                            </div>
                          </td>
                        )}

                        <td className="py-3 px-3 text-right font-extrabold text-slate-900 dark:text-white">
                          <div>
                            {hasSentSealed && <span>{it.qty_sent_sealed} {boxLabel}</span>}
                            {hasSentSealed && hasSentLoose && <span> + </span>}
                            {hasSentLoose && <span>{it.qty_sent_loose} {baseLabel}</span>}
                            {!hasSentSealed && !hasSentLoose && <span>0 {baseLabel}</span>}
                          </div>
                          {convRate > 1 && hasSentSealed && (
                            <span className="text-[10px] font-mono text-slate-400 font-normal block">
                              (Total {((it.qty_sent_sealed || 0) * convRate) + (it.qty_sent_loose || 0)} {baseLabel})
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                          {isReceived ? (
                            <div>
                              {(it.qty_received_sealed ?? it.qty_sent_sealed) > 0 && (
                                <span>{(it.qty_received_sealed ?? it.qty_sent_sealed)} {boxLabel}</span>
                              )}
                              {(it.qty_received_sealed ?? it.qty_sent_sealed) > 0 && (it.qty_received_loose ?? it.qty_sent_loose) > 0 && (
                                <span> + </span>
                              )}
                              {(it.qty_received_loose ?? it.qty_sent_loose) > 0 && (
                                <span>{(it.qty_received_loose ?? it.qty_sent_loose)} {baseLabel}</span>
                              )}
                              {!(it.qty_received_sealed ?? it.qty_sent_sealed) && !(it.qty_received_loose ?? it.qty_sent_loose) && (
                                <span>0 {baseLabel}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 font-normal">{t.distWaitingConfirm || "Menunggu konfirmasi"}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-extrabold">
                          {it.shrinkage_qty && it.shrinkage_qty > 0 ? (
                            <span className="text-red-500 font-bold px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[11px] inline-block">
                              -{it.shrinkage_qty} {baseLabel}
                            </span>
                          ) : isReceived ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                              {t.distDetailStatusIntact || "Utuh (0 Selisih)"}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-500 text-[11px]">
                          {it.allocation_notes ? (
                            <span className="inline-block font-semibold px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">
                              {it.allocation_notes}
                            </span>
                          ) : (
                            it.notes || "-"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 6. Summary Metric Footer Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100 dark:border-white/5">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#28282C] border border-slate-100 dark:border-white/5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {t.distDetailTotalKinds || "Total Macam"}
                </span>
                <span className="text-lg font-black text-slate-900 dark:text-white mt-0.5 block">{totalKinds} Item</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#28282C] border border-slate-100 dark:border-white/5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {t.distDetailTotalSealedSent || "Total Dus Dikirim"}
                </span>
                <span className="text-lg font-black text-slate-900 dark:text-white mt-0.5 block">
                  {totalSealedSent} <span className="text-xs font-semibold text-slate-400">/ Diterima: {isReceived ? totalSealedReceived : "-"}</span>
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#28282C] border border-slate-100 dark:border-white/5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {t.distDetailTotalLooseSent || "Total Eceran Dikirim"}
                </span>
                <span className="text-lg font-black text-slate-900 dark:text-white mt-0.5 block">
                  {totalLooseSent} <span className="text-xs font-semibold text-slate-400">/ Diterima: {isReceived ? totalLooseReceived : "-"}</span>
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#28282C] border border-slate-100 dark:border-white/5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {t.distDetailTotalShrinkage || "Total Susut Fisik"}
                </span>
                <span className={`text-lg font-black mt-0.5 block ${totalShrinkageUnits > 0 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {totalShrinkageUnits > 0 ? `-${totalShrinkageUnits} Unit` : (isReceived ? "0 (Utuh)" : "-")}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: MASTER LIST VIEW (DEFAULT)                                        */}
      {/* ========================================================================= */}
      {currentView === "master" && (
        <div className="space-y-6 pb-24 text-left">
          {/* 1. Frameless Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200/80 dark:border-[#2E2E34] gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-extrabold text-xs text-brand-purple dark:text-primary uppercase tracking-wider">
                  {t.logisticsTitle || "Logistik & Rantai Pasok"}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-purple/10 text-brand-purple dark:bg-primary/10 dark:text-primary">
                  {t.distSubTitle || "Surat Jalan Multi-Item"}
                </span>
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5">
                {t.distMainTitle || "Transfer Stok & Distribusi Antar-Lokasi"}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t.distMainDesc || "Pusat penerbitan Surat Jalan, mutasi persediaan double-entry, pelacakan armada, dan konfirmasi fisik (Handshake)."}
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={fetchData}
                className="p-2.5 rounded-2xl border border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#202024] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-pointer"
                title={t.refresh || "Muat Ulang Data"}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>

              {isOwnerOrAdmin && (
                <button
                  type="button"
                  onClick={() => setIsQuotaMatrixOpen(true)}
                  className="px-4 py-2.5 rounded-2xl border border-purple-200 dark:border-purple-800/40 bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-extrabold text-xs shadow-2xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>{t.distQuotaMatrixBtn || "Matriks Alokasi Kuota"}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (isStaffOrCashier || isBranchScoped) {
                    const defaultSupplying = outlets.find((o) => o.id !== (activeContext?.outlet_id || ""))?.id || "";
                    setShipFromOutletID(defaultSupplying);
                    setShipToOutletID(activeContext?.outlet_id || "");
                    setShipType("requisition");
                  } else {
                    setShipFromOutletID(originOutletObj.id);
                    setShipType("outbound");
                  }
                  setShipLines([]);
                  setCarrierType("internal_fleet");
                  setDriverName("");
                  setVehiclePlate("");
                  setDriverPhone("");
                  setTrackingRefNo("");
                  setShippingCostMode("fixed");
                  setCostBBM(0);
                  setCostOngkir(0);
                  setCostTolParkir(0);
                  setCostUangJalan(0);
                  setShippingCostPayer("origin");
                  setShippingPaymentMethod("cash");
                  setMaxClaimBudget(0);
                  setShipNotes("");
                  setWizardStep(1);
                  setCurrentView("new");
                }}
                className="px-5 py-2.5 rounded-2xl bg-brand-purple hover:bg-brand-purple-hover text-white dark:bg-[#E2FF66] dark:text-slate-900 font-extrabold text-xs shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                {isStaffOrCashier || isBranchScoped ? (
                  <>
                    <PackagePlus className="w-4 h-4 stroke-[2.5]" />
                    <span>{t.distBtnCreateRequisition || "Minta Pasokan Stok (Requisition)"}</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>{t.distBtnCreate || "Buat Surat Jalan Baru"}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 2. Key Logistics Status KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div
              onClick={() => setSelectedStatuses([])}
              className={`p-4 rounded-3xl border transition-all cursor-pointer select-none ${
                selectedStatuses.length === 0
                  ? "border-brand-purple bg-brand-purple/10 dark:border-primary dark:bg-primary/10 ring-2 ring-brand-purple/20"
                  : "border-slate-200/80 dark:border-[#38383C] bg-white dark:bg-[#202024] hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t.distKpiTotal || "Total Surat Jalan"}</span>
                <div className="p-2 rounded-xl bg-brand-purple/10 text-brand-purple dark:bg-primary/10 dark:text-primary">
                  <Truck className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">{distributions.length}</p>
              <span className="text-[10px] text-slate-400 font-semibold">{t.distKpiTotalDesc || "Semua histori pengiriman"}</span>
            </div>

            <div
              onClick={() =>
                setSelectedStatuses((prev) =>
                  prev.includes("in_transit") && prev.length === 1 ? [] : ["in_transit"]
                )
              }
              className={`p-4 rounded-3xl border transition-all cursor-pointer select-none ${
                selectedStatuses.includes("in_transit")
                  ? "border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/20"
                  : "border-slate-200/80 dark:border-[#38383C] bg-white dark:bg-[#202024] hover:border-amber-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider">{t.distKpiInTransit || "Dalam Perjalanan"}</span>
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-amber-600 mt-2">{countInTransit}</p>
              <span className="text-[10px] text-slate-400 font-semibold">{t.distKpiInTransitDesc || "Menunggu verifikasi cabang"}</span>
            </div>

            <div
              onClick={() =>
                setSelectedStatuses((prev) =>
                  prev.includes("received") && prev.length === 1 ? [] : ["received"]
                )
              }
              className={`p-4 rounded-3xl border transition-all cursor-pointer select-none ${
                selectedStatuses.includes("received")
                  ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20"
                  : "border-slate-200/80 dark:border-[#38383C] bg-white dark:bg-[#202024] hover:border-emerald-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider">{t.distKpiReceived || "Selesai Diterima"}</span>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-emerald-600 mt-2">{countReceived}</p>
              <span className="text-[10px] text-slate-400 font-semibold">{t.distKpiReceivedDesc || "Stok telah mutasi sempurna"}</span>
            </div>

            <div
              onClick={() =>
                setSelectedStatuses((prev) =>
                  prev.includes("returned") && prev.length === 1 ? [] : ["returned"]
                )
              }
              className={`p-4 rounded-3xl border transition-all cursor-pointer select-none ${
                selectedStatuses.includes("returned")
                  ? "border-red-500 bg-red-500/10 ring-2 ring-red-500/20"
                  : "border-slate-200/80 dark:border-[#38383C] bg-white dark:bg-[#202024] hover:border-red-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider">{t.distKpiReturned || "Retur / Batal"}</span>
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600">
                  <Banknote className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-rose-600 mt-2">{countReturned}</p>
              <span className="text-[10px] text-slate-400 font-semibold">{t.distKpiReturnedDesc || "Pengembalian stok"}</span>
            </div>
          </div>

          {/* 3. Search & Comprehensive Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1">
              <ErpSearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={t.distSearchPlaceholder || "Cari no. transfer, tujuan, produk, kurir, atau plat armada..."}
              />
            </div>

            <ErpFilterPopover
              activeCount={activeFilterCount}
              onResetAll={handleResetFilters}
              title={t.distFilterPopoverTitle || "Filter Kriteria Pengiriman & Logistik"}
              resetLabel={t.resetFilter || "Reset Filter"}
              filterButtonLabel={t.filter || "Filter Data"}
              columnGroups={[
                {
                  id: "status",
                  title: t.distFilterStatusGroup || "Status Pengiriman",
                  type: "multi",
                  selectedValues: selectedStatuses,
                  onToggleMulti: (key: string) => {
                    setSelectedStatuses((prev) =>
                      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
                    );
                  },
                  options: [
                    { key: "in_transit", label: t.logisticsInTransit || "Dalam Perjalanan", count: countInTransit },
                    { key: "received", label: t.logisticsReceived || "Selesai Diterima", count: countReceived },
                    { key: "returned", label: t.distKpiReturned || "Retur / Batal", count: countReturned },
                  ],
                },
                {
                  id: "distribution_type",
                  title: t.distFilterTypeGroup || "Jenis Dokumen",
                  type: "multi",
                  selectedValues: selectedTypes,
                  onToggleMulti: (key: string) => {
                    setSelectedTypes((prev) =>
                      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
                    );
                  },
                  options: [
                    { key: "outbound", label: t.distOutboundBadge || "Outbound" },
                    { key: "return", label: t.distReturnBadge || "Retur" },
                  ],
                },
                {
                  id: "carrier_type",
                  title: t.distFilterCarrierGroup || "Jenis Armada",
                  type: "multi",
                  selectedValues: selectedCarriers,
                  onToggleMulti: (key: string) => {
                    setSelectedCarriers((prev) =>
                      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
                    );
                  },
                  options: [
                    { key: "internal_fleet", label: t.distCarrierInternal || "Armada Sendiri (Internal)" },
                    { key: "online_courier", label: t.distCarrierOnline || "Ojek Online (Gojek / Grab / Maxim)" },
                    { key: "3rd_party", label: t.distCarrier3rdParty || "Ekspedisi (Lalamove / Deliveree / JNE)" },
                    { key: "pickup", label: t.distCarrierPickup || "Diambil Sendiri (Pickup Cabang)" },
                  ],
                },
                {
                  id: "from_outlet",
                  title: t.distFilterOriginGroup || "Gudang / Cabang Asal",
                  type: "multi",
                  selectedValues: selectedOriginOutlets,
                  onToggleMulti: (key: string) => {
                    setSelectedOriginOutlets((prev) =>
                      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
                    );
                  },
                  options: outlets.map((o) => ({
                    key: o.id,
                    label: o.name,
                  })),
                },
                {
                  id: "to_outlet",
                  title: t.distFilterDestGroup || "Outlet Tujuan",
                  type: "multi",
                  selectedValues: selectedDestOutlets,
                  onToggleMulti: (key: string) => {
                    setSelectedDestOutlets((prev) =>
                      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
                    );
                  },
                  options: outlets.map((o) => ({
                    key: o.id,
                    label: o.name,
                  })),
                },
              ]}
            />
          </div>

          {/* 4. Distribution Table */}
          <ErpDataTable<DistributionItem>
            data={filteredDistributions}
            columns={distributionColumns}
            keyExtractor={(d) => d.id}
            loading={loading}
            emptyText={t.logisticsEmpty || "Belum ada riwayat pengiriman surat jalan"}
            onRowClick={(d) => {
              if (d.status === "draft") {
                handleOpenEditDraft(d);
              } else {
                setSelectedTransfer(d);
                setCurrentView("detail");
              }
            }}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TOLAK KLAIM BIAYA KURIR (REJECT CLAIM DIALOG)                      */}
      {/* ========================================================================= */}
      <Dialog open={!!rejectDialogDist} onOpenChange={(open) => !open && setRejectDialogDist(null)}>
        <DialogContent className="max-w-md bg-white dark:bg-[#202024] border-slate-200 dark:border-[#38383C] text-slate-900 dark:text-white p-6 rounded-3xl">
          <DialogHeader className="p-0 pb-4 border-b border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
                <XCircle className="w-5 h-5" />
              </div>
              <div className="text-left">
                <DialogTitle className="text-base font-extrabold text-slate-900 dark:text-white">
                  {t.distRejectReasonTitle || "Alasan Penolakan Klaim"}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  {rejectDialogDist?.transfer_no || "Surat Jalan"} • Klaim Rp {Number(rejectDialogDist?.claimed_amount || 0).toLocaleString("id-ID")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-2 text-left">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Sampaikan alasan penolakan agar kurir mendapatkan catatan yang jelas mengenai penyesuaian biaya operasional di jalan.
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Alasan Penolakan <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t.distRejectReasonPlaceholder || "Contoh: Foto struk bensin buram / biaya melebihi kesepakatan"}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-[#38383C] bg-slate-50 dark:bg-[#28282C] text-xs focus:outline-none focus:ring-2 focus:ring-red-500 resize-none font-medium"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-white/5">
            <button
              type="button"
              onClick={() => setRejectDialogDist(null)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-[#38383C] text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
            >
              {t.cancel || "Batal"}
            </button>
            <button
              type="button"
              onClick={handleConfirmRejectClaim}
              disabled={isProcessingClaim || !rejectReason.trim()}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold shadow-sm transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>{isProcessingClaim ? (t.processing || "Memproses...") : (t.distRejectConfirmBtn || "Konfirmasi Tolak Klaim")}</span>
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 2: CETAK SURAT JALAN RESMI (STANDARD A4 PAPER FORMAT)               */}
      {/* ========================================================================= */}
      <Dialog open={!!printSlipDist} onOpenChange={(open) => !open && setPrintSlipDist(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto bg-slate-100 dark:bg-[#18181B] border-slate-200 dark:border-[#38383C] text-slate-900 dark:text-white p-4 sm:p-6 rounded-3xl print:p-0 print:m-0 print:border-none print:bg-white print:max-h-none print:overflow-visible">
          {/* Print Style Injector for Standard A4 Paper */}
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #printable-delivery-slip, #printable-delivery-slip * {
                visibility: visible !important;
              }
              #printable-delivery-slip {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 10mm 12mm !important;
                background: white !important;
                color: #0f172a !important;
                box-shadow: none !important;
                border: none !important;
              }
              @page {
                size: A4 portrait;
                margin: 8mm 10mm;
              }
            }
          `}</style>

          <DialogHeader className="p-0 pb-4 border-b border-slate-200 dark:border-[#38383C] print:hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-left">
                <FileText className="w-5 h-5 text-brand-purple dark:text-primary" />
                <div>
                  <DialogTitle className="text-base font-extrabold">{t.distSlipTitle || "Surat Jalan Pengiriman Resmi (Format A4)"}</DialogTitle>
                  <DialogDescription className="text-xs text-slate-500">
                    {t.distSlipSubtitle || "Bukti serah terima dan mutasi persediaan double-entry antar-lokasi"}
                  </DialogDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-2xl bg-brand-purple hover:bg-brand-purple-hover text-white dark:bg-[#E2FF66] dark:text-slate-900 text-xs font-extrabold flex items-center gap-2 shadow-sm cursor-pointer transition-all"
                >
                  <Printer className="w-4 h-4" />
                  <span>{t.print || "Cetak Dokumen (A4)"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintSlipDist(null)}
                  className="px-3 py-2 rounded-2xl border border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#202024] hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
                >
                  {t.close || "Tutup"}
                </button>
              </div>
            </div>
          </DialogHeader>

          {printSlipDist && (
            <div
              id="printable-delivery-slip"
              className="bg-white text-slate-900 p-8 sm:p-10 rounded-2xl shadow-sm border border-slate-200/80 max-w-[210mm] mx-auto text-left font-sans print:border-none print:shadow-none print:p-0"
            >
              {/* 1. KOP SURAT RESMI */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-4">
                <div className="space-y-1">
                  <h2 className="font-black text-xl tracking-tight text-slate-950 uppercase">
                    {activeContext?.business_name || "ANDAYA GROUP"}
                  </h2>
                  <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    {t.distSlipDivision || "DIVISI LOGISTIK & RANTAI PASOK PERSUSUDIAN"}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Sistem Terintegrasi Multi-Tenant Lean ERP • Dokumen Mutasi Double-Entry
                  </p>
                </div>

                <div className="text-right space-y-1">
                  <span className="inline-block px-3 py-1 rounded-full bg-slate-900 text-white font-extrabold text-xs tracking-wider uppercase">
                    SURAT JALAN
                  </span>
                  <p className="font-mono font-black text-sm text-slate-900 tracking-wide mt-1">
                    {printSlipDist.transfer_no || `SJ-${printSlipDist.id.slice(0, 8).toUpperCase()}`}
                  </p>
                  <p className="text-[10px] text-slate-600 font-medium">
                    Tanggal: {new Date(printSlipDist.sent_at || printSlipDist.created_at).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}
                  </p>
                </div>
              </div>

              {/* 2. KARTU RUTE & PENANGGUNG JAWAB (ORIGIN & DESTINATION) */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3.5 rounded-xl border border-slate-300 bg-slate-50/70 text-xs space-y-1">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">
                    PENGIRIM (GUDANG / OUTLET ASAL)
                  </span>
                  <p className="font-extrabold text-sm text-slate-900">
                    {printSlipDist.from_outlet_name || "Gudang Pusat"}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Petugas Dispatcher: <span className="font-bold text-slate-800">{printSlipDist.sent_by_user_name || "Admin Logistik"}</span>
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-300 bg-slate-50/70 text-xs space-y-1">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">
                    PENERIMA (OUTLET / CABANG TUJUAN)
                  </span>
                  <p className="font-extrabold text-sm text-slate-900">
                    {printSlipDist.to_outlet_name || "Cabang Tujuan"}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Petugas Penerima: <span className="font-bold text-slate-800">{printSlipDist.received_by_user_name || "Staf Outlet Penerima"}</span>
                  </p>
                </div>
              </div>

              {/* 3. LOGISTIK, ARMADA & RESI BAR */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-100/60 mb-4 text-[11px]">
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Jenis Armada</span>
                  <span className="font-bold text-slate-800">
                    {carrierLabels[printSlipDist.carrier_type || "internal_fleet"] || "Armada Sendiri"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Nama Kurir / Supir</span>
                  <span className="font-bold text-slate-800">
                    {printSlipDist.driver_name || printSlipDist.sent_to_user_name || "Armada Internal"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">No. Plat Kendaraan</span>
                  <span className="font-mono font-bold text-slate-800">
                    {printSlipDist.vehicle_plate || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">No. Resi / AWB</span>
                  <span className="font-mono font-bold text-slate-800">
                    {printSlipDist.tracking_ref_no || "-"}
                  </span>
                </div>
              </div>

              {/* 4. TABEL MANIFEST MUATAN BARANG */}
              <div className="mb-4">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-y-2 border-slate-800 bg-slate-100 text-[10px] text-slate-700 uppercase font-black tracking-wider">
                      <th className="py-2.5 px-3 text-center w-10">No</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3">Deskripsi Produk / Item</th>
                      <th className="py-2.5 px-3 text-center">Konversi Kemasan</th>
                      <th className="py-2.5 px-3 text-right">Kuantitas Kirim</th>
                      {printSlipDist.status === "received" && (
                        <th className="py-2.5 px-3 text-right">Kuantitas Diterima</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {printSlipDist.items && printSlipDist.items.length > 0 ? (
                      printSlipDist.items.map((it, idx) => {
                        const boxLabel = it.box_unit || "Dus";
                        const baseLabel = it.base_unit || "pcs";
                        const rate = it.conversion_rate && it.conversion_rate > 0 ? it.conversion_rate : 1;
                        return (
                          <tr key={it.id || idx} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 text-center font-bold text-slate-500">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">{it.item_sku || "-"}</td>
                            <td className="py-2.5 px-3">
                              <p className="font-extrabold text-slate-900">{it.item_name}</p>
                              {it.notes && <p className="text-[10px] text-slate-500 italic mt-0.5">Ket: {it.notes}</p>}
                            </td>
                            <td className="py-2.5 px-3 text-center text-[11px] text-slate-600">
                              {rate > 1 ? `1 ${boxLabel} = ${rate} ${baseLabel}` : `1 ${baseLabel}`}
                            </td>
                            <td className="py-2.5 px-3 text-right font-extrabold text-slate-900">
                              {it.qty_sent_sealed > 0 && `${it.qty_sent_sealed} ${boxLabel}`}
                              {it.qty_sent_sealed > 0 && it.qty_sent_loose > 0 && " + "}
                              {it.qty_sent_loose > 0 && `${it.qty_sent_loose} ${baseLabel}`}
                              {it.qty_sent_sealed === 0 && it.qty_sent_loose === 0 && `0 ${baseLabel}`}
                            </td>
                            {printSlipDist.status === "received" && (
                              <td className="py-2.5 px-3 text-right font-extrabold text-emerald-700">
                                {(it.qty_received_sealed ?? it.qty_sent_sealed) > 0 && `${(it.qty_received_sealed ?? it.qty_sent_sealed)} ${boxLabel}`}
                                {(it.qty_received_sealed ?? it.qty_sent_sealed) > 0 && (it.qty_received_loose ?? it.qty_sent_loose) > 0 && " + "}
                                {(it.qty_received_loose ?? it.qty_sent_loose) > 0 && `${(it.qty_received_loose ?? it.qty_sent_loose)} ${baseLabel}`}
                              </td>
                            )}
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-500">1</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">{printSlipDist.item_sku || "-"}</td>
                        <td className="py-2.5 px-3 font-extrabold text-slate-900">{printSlipDist.item_name}</td>
                        <td className="py-2.5 px-3 text-center text-[11px] text-slate-600">
                          {printSlipDist.conversion_rate && printSlipDist.conversion_rate > 1
                            ? `1 ${printSlipDist.box_unit || "Dus"} = ${printSlipDist.conversion_rate} ${printSlipDist.base_unit || "pcs"}`
                            : `1 ${printSlipDist.base_unit || "pcs"}`}
                        </td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-slate-900">
                          {printSlipDist.qty_sealed > 0 && `${printSlipDist.qty_sealed} ${printSlipDist.box_unit || "Dus"}`}
                          {printSlipDist.qty_sealed > 0 && printSlipDist.qty_loose > 0 && " + "}
                          {printSlipDist.qty_loose > 0 && `${printSlipDist.qty_loose} ${printSlipDist.base_unit || "pcs"}`}
                        </td>
                        {printSlipDist.status === "received" && (
                          <td className="py-2.5 px-3 text-right font-extrabold text-emerald-700">
                            {(printSlipDist.qty_received_sealed ?? printSlipDist.qty_sealed) > 0 && `${(printSlipDist.qty_received_sealed ?? printSlipDist.qty_sealed)} ${printSlipDist.box_unit || "Dus"}`}
                            {(printSlipDist.qty_received_loose ?? printSlipDist.qty_loose) > 0 && ` + ${(printSlipDist.qty_received_loose ?? printSlipDist.qty_loose)} ${printSlipDist.base_unit || "pcs"}`}
                          </td>
                        )}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* 5. RINCIAN BIAYA & QR KLAIM OPERASIONAL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {/* Panel Kiri: Biaya Distribusi / Ongkir */}
                <div className="p-3 rounded-xl border border-slate-300 bg-slate-50/80 text-[11px] space-y-1.5">
                  <span className="font-bold text-slate-500 uppercase block text-[9px]">
                    INFORMASI BIAYA DISTRIBUSI & ONGKIR
                  </span>
                  {printSlipDist.shipping_cost_mode === "free" ? (
                    <p className="font-bold text-emerald-700">Bebas Biaya / Gratis (Internal)</p>
                  ) : printSlipDist.shipping_cost_mode === "driver_claim" ? (
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-800">Metode: Klaim Kurir Berjalan (QR Code)</p>
                      {Number(printSlipDist.max_claim_budget || 0) > 0 && (
                        <p className="text-slate-600">Plafon Maksimal: Rp {Number(printSlipDist.max_claim_budget).toLocaleString("id-ID")}</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex justify-between font-extrabold text-slate-900">
                        <span>Total Biaya Distribusi:</span>
                        <span>Rp {Number(printSlipDist.shipping_cost || 0).toLocaleString("id-ID")}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Penanggung:</span>
                        <span className="font-semibold text-slate-800">
                          {printSlipDist.shipping_cost_payer === "destination" ? "Outlet Tujuan" : printSlipDist.shipping_cost_payer === "central" ? "Kantor Pusat" : "Outlet Asal"}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Metode Pembayaran:</span>
                        <span className="font-semibold text-slate-800">
                          {printSlipDist.shipping_payment_method === "bank_transfer" ? "Transfer Bank" : printSlipDist.shipping_payment_method === "on_account" ? "Tagihan Tempo" : "Tunai (Kas Kasir)"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Panel Kanan: Driver Claim QR Code atau Catatan Khusus */}
                {printSlipDist.shipping_cost_mode === "driver_claim" ? (
                  <div className="p-3 rounded-xl border border-slate-300 bg-slate-50/80 flex items-center gap-3">
                    {slipQrDataUrl ? (
                      <img src={slipQrDataUrl} alt="QR Klaim Kurir" className="w-16 h-16 rounded-lg bg-white p-1 shrink-0 border border-slate-300" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
                        <QrCode className="w-6 h-6 text-slate-500" />
                      </div>
                    )}
                    <div className="text-[10px] space-y-0.5">
                      <p className="font-black text-slate-900 uppercase">KLAIM BIAYA OPERASIONAL</p>
                      <p className="text-slate-600 leading-tight">Scan QR ini untuk mengajukan nota bensin, tol, dan biaya jalan.</p>
                      <p className="font-mono text-[9px] text-slate-500">Token: {printSlipDist.claim_token}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl border border-slate-300 bg-slate-50/80 text-[11px] space-y-1">
                    <span className="font-bold text-slate-500 uppercase block text-[9px]">CATATAN & INSTRUKSI PENGIRIMAN</span>
                    <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {printSlipDist.notes || "Pastikan barang diperiksa secara teliti sebelum menandatangani bukti serah terima."}
                    </p>
                  </div>
                )}
              </div>

              {/* 6. LEMBAR PENGESAHAN & TANDA TANGAN RESMI (3 PIHAK) */}
              <div className="pt-6 border-t-2 border-slate-900 mt-6">
                <p className="text-[10px] text-slate-500 text-center mb-6 font-medium italic">
                  Barang telah diperiksa, dimuat, dan diterima dalam kondisi baik dan kuantitas sesuai manifes di atas.
                </p>

                <div className="grid grid-cols-3 gap-6 text-center text-xs">
                  {/* Kolom 1: Pengirim */}
                  <div className="flex flex-col justify-between h-28 border border-slate-200 p-2.5 rounded-xl bg-slate-50/50">
                    <span className="font-bold text-slate-600 uppercase text-[10px]">1. Diserahkan Oleh (Pengirim)</span>
                    <div className="space-y-0.5">
                      <p className="font-black text-slate-900 underline underline-offset-4">
                        ( {printSlipDist.sent_by_user_name || "Admin Gudang"} )
                      </p>
                      <p className="text-[9px] text-slate-500">Petugas Gudang / Dispatcher</p>
                    </div>
                  </div>

                  {/* Kolom 2: Kurir */}
                  <div className="flex flex-col justify-between h-28 border border-slate-200 p-2.5 rounded-xl bg-slate-50/50">
                    <span className="font-bold text-slate-600 uppercase text-[10px]">2. Dibawa / Diantar Oleh (Kurir)</span>
                    <div className="space-y-0.5">
                      <p className="font-black text-slate-900 underline underline-offset-4">
                        ( {printSlipDist.driver_name || printSlipDist.sent_to_user_name || "Driver / Kurir"} )
                      </p>
                      <p className="text-[9px] text-slate-500">Pengemudi / Ekspedisi</p>
                    </div>
                  </div>

                  {/* Kolom 3: Penerima */}
                  <div className="flex flex-col justify-between h-28 border border-slate-200 p-2.5 rounded-xl bg-slate-50/50">
                    <span className="font-bold text-slate-600 uppercase text-[10px]">3. Diterima & Diverifikasi Oleh</span>
                    <div className="space-y-0.5">
                      <p className="font-black text-slate-900 underline underline-offset-4">
                        ( {printSlipDist.received_by_user_name || "........................................"} )
                      </p>
                      <p className="text-[9px] text-slate-500">Petugas Outlet / Cabang Penerima</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: EDIT INFORMASI & BIAYA PENGIRIMAN                                  */}
      {/* ========================================================================= */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-8 bg-white dark:bg-[#202024] border-slate-200 dark:border-[#38383C]">
          <DialogHeader className="pb-4 border-b border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-2 text-xs font-bold text-brand-purple dark:text-primary">
              <Pencil className="w-4 h-4" />
              <span>{editDist?.transfer_no || "Surat Jalan"}</span>
            </div>
            <DialogTitle className="text-lg font-extrabold text-slate-900 dark:text-white">
              {t.distEditTitle || "Edit Informasi & Biaya Pengiriman"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {t.distEditDesc || "Perbarui komponen biaya operasional, kurir, nomor resi, atau catatan surat jalan ini."}
            </DialogDescription>
          </DialogHeader>

          {editDist && (
            <div className="space-y-6 pt-2">
              {/* 1. Biaya Distribusi & Ongkir */}
              <div className="space-y-4">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  {t.distCostModeLabel || "Metode Penentuan Biaya Kirim"}
                </label>

                {/* 3-Way Mode Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div
                    onClick={() => setEditShippingCostMode("fixed")}
                    className={`p-3 rounded-2xl border flex flex-col justify-between cursor-pointer transition-all ${
                      editShippingCostMode === "fixed"
                        ? "border-brand-purple bg-brand-purple/10 dark:border-[#E2FF66] dark:bg-[#E2FF66]/10 text-slate-900 dark:text-white font-bold ring-2 ring-brand-purple/20"
                        : "border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-brand-purple dark:text-primary shrink-0" />
                      <span className="text-xs font-extrabold">{t.distCostModeFixed || "Input Langsung"}</span>
                    </div>
                  </div>

                  <div
                    onClick={() => setEditShippingCostMode("driver_claim")}
                    className={`p-3 rounded-2xl border flex flex-col justify-between cursor-pointer transition-all ${
                      editShippingCostMode === "driver_claim"
                        ? "border-brand-purple bg-brand-purple/10 dark:border-[#E2FF66] dark:bg-[#E2FF66]/10 text-slate-900 dark:text-white font-bold ring-2 ring-brand-purple/20"
                        : "border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-brand-purple dark:text-primary shrink-0" />
                      <span className="text-xs font-extrabold">{t.distCostModeDriverClaim || "Klaim Kurir (QR)"}</span>
                    </div>
                  </div>

                  <div
                    onClick={() => setEditShippingCostMode("free")}
                    className={`p-3 rounded-2xl border flex flex-col justify-between cursor-pointer transition-all ${
                      editShippingCostMode === "free"
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold ring-2 ring-emerald-500/20"
                        : "border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-xs font-extrabold">{t.distCostModeFree || "Bebas Biaya"}</span>
                    </div>
                  </div>
                </div>

                {/* Sub-inputs if Mode is Fixed */}
                {editShippingCostMode === "fixed" && (
                  <div className="space-y-3.5 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <Fuel className="w-3.5 h-3.5 text-amber-500" />
                          <span>{t.distCostBBM || "BBM / Bahan Bakar"}</span>
                        </label>
                        <CurrencyInput
                          value={editCostBBM}
                          onChange={setEditCostBBM}
                          placeholder="0"
                          className="bg-white dark:bg-[#202024] border-slate-200 dark:border-[#38383C] text-xs font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <Package className="w-3.5 h-3.5 text-brand-purple dark:text-primary" />
                          <span>{t.distCostOngkir || "Ongkir / Tarif Ekspedisi"}</span>
                        </label>
                        <CurrencyInput
                          value={editCostOngkir}
                          onChange={setEditCostOngkir}
                          placeholder="0"
                          className="bg-white dark:bg-[#202024] border-slate-200 dark:border-[#38383C] text-xs font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <Car className="w-3.5 h-3.5 text-blue-500" />
                          <span>{t.distCostTolParkir || "Tol & Parkir"}</span>
                        </label>
                        <CurrencyInput
                          value={editCostTolParkir}
                          onChange={setEditCostTolParkir}
                          placeholder="0"
                          className="bg-white dark:bg-[#202024] border-slate-200 dark:border-[#38383C] text-xs font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5 text-emerald-500" />
                          <span>{t.distCostUangJalan || "Uang Jalan / Lainnya"}</span>
                        </label>
                        <CurrencyInput
                          value={editCostUangJalan}
                          onChange={setEditCostUangJalan}
                          placeholder="0"
                          className="bg-white dark:bg-[#202024] border-slate-200 dark:border-[#38383C] text-xs font-bold"
                        />
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calculator className="w-4 h-4 text-brand-purple dark:text-primary" />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {t.distTotalCostAuto || "Total Akumulasi Biaya"}:
                        </span>
                      </div>
                      <span className="text-sm font-black text-brand-purple dark:text-primary">
                        Rp {editTotalDirectCost.toLocaleString("id-ID")}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {t.distShippingPayerLabel || "Pihak Penanggung Kas"}
                        </label>
                        <Select value={editShippingCostPayer} onValueChange={(val) => setEditShippingCostPayer(val || "origin")}>
                          <SelectTrigger className="w-full text-xs font-semibold rounded-xl bg-white dark:bg-[#202024] border-slate-200 dark:border-[#38383C]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="origin">{t.distPayerOrigin || "Outlet Asal (Pengirim)"}</SelectItem>
                            <SelectItem value="destination">{t.distPayerDest || "Outlet Tujuan (Penerima)"}</SelectItem>
                            <SelectItem value="central">{t.distPayerCentral || "Kantor Pusat / Owner"}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {t.distPaymentMethodLabel || "Metode Bayar"}
                        </label>
                        <Select value={editShippingPaymentMethod} onValueChange={(val) => setEditShippingPaymentMethod(val || "cash")}>
                          <SelectTrigger className="w-full text-xs font-semibold rounded-xl bg-white dark:bg-[#202024] border-slate-200 dark:border-[#38383C]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Tunai (Kas Kasir / Petty Cash)</SelectItem>
                            <SelectItem value="bank_transfer">Transfer Bank / QRIS Operasional</SelectItem>
                            <SelectItem value="on_account">{t.distPaymentAccount || "Tagihan Tempo / 3PL Invoicing"}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                {editShippingCostMode === "driver_claim" && (
                  <div className="space-y-1 pt-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {t.distMaxBudgetLabel || "Plafon Anggaran Maksimal (Opsional)"}
                    </label>
                    <CurrencyInput
                      value={editMaxClaimBudget}
                      onChange={setEditMaxClaimBudget}
                      placeholder={t.distMaxBudgetPlaceholder || "0 (Opsional, 0 = Tanpa Batas)"}
                      className="bg-white dark:bg-[#202024] border-slate-200 dark:border-[#38383C] text-xs font-bold"
                    />
                  </div>
                )}
              </div>

              {/* 2. Informasi Kurir & Armada */}
              <div className="space-y-3.5 pt-4 border-t border-slate-100 dark:border-white/5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  {t.distSec2Title || "Informasi Kurir & Armada"}
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {t.distCarrierTypeLabel || "Jenis Armada"}
                    </label>
                    <Select value={editCarrierType} onValueChange={(val) => setEditCarrierType(val || "internal_fleet")}>
                      <SelectTrigger className="w-full text-xs font-semibold rounded-xl bg-white dark:bg-[#202024] border-slate-200 dark:border-[#38383C]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="internal_fleet">{t.distCarrierInternal || "Armada Sendiri (Internal)"}</SelectItem>
                        <SelectItem value="online_courier">{t.distCarrierOnline || "Ojek Online (Gojek / Grab / Maxim)"}</SelectItem>
                        <SelectItem value="3rd_party">{t.distCarrier3rdParty || "Ekspedisi (Lalamove / Deliveree / JNE)"}</SelectItem>
                        <SelectItem value="pickup">{t.distCarrierPickup || "Diambil Sendiri (Pickup Cabang)"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {t.distDriverNameLabel || "Nama Supir / Kurir"}
                    </label>
                    <input
                      type="text"
                      value={editDriverName}
                      onChange={(e) => setEditDriverName(e.target.value)}
                      placeholder={t.distDriverNamePlaceholder || "Contoh: Pak Bambang"}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#202024] text-xs font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {t.distVehiclePlateLabel || "Nomor Plat Kendaraan"}
                    </label>
                    <input
                      type="text"
                      value={editVehiclePlate}
                      onChange={(e) => setEditVehiclePlate(e.target.value.toUpperCase())}
                      placeholder={t.distVehiclePlatePlaceholder || "Contoh: AB 1234 CD"}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#202024] text-xs font-bold uppercase font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {t.distDriverPhoneLabel || "No. Kontak / HP Kurir"}
                    </label>
                    <input
                      type="tel"
                      value={editDriverPhone}
                      onChange={(e) => setEditDriverPhone(e.target.value)}
                      placeholder={t.distDriverPhonePlaceholder || "0812xxxx"}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#202024] text-xs font-bold"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {t.distSlipTracking || "No. Resi / AWB (Opsional)"}
                    </label>
                    <input
                      type="text"
                      value={editTrackingRefNo}
                      onChange={(e) => setEditTrackingRefNo(e.target.value)}
                      placeholder="Contoh: RESI-JNE-987123"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#202024] text-xs font-bold font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Catatan & Instruksi */}
              <div className="space-y-1.5 pt-4 border-t border-slate-100 dark:border-white/5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.distShipNotesLabel || "Catatan & Instruksi Pengiriman"}
                </label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder={t.distShipNotesPlaceholder || "Catatan khusus..."}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#202024] text-xs font-medium whitespace-pre-wrap break-words leading-relaxed resize-y outline-none focus:ring-2 focus:ring-brand-purple/20 dark:focus:ring-[#E2FF66]/20"
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsEditDialogOpen(false)}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#202024] hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
            >
              {t.cancel || "Batal"}
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={isEditingSubmitting}
              className="px-6 py-2.5 rounded-2xl bg-brand-purple hover:bg-brand-purple-hover text-white dark:bg-[#E2FF66] dark:text-slate-900 font-extrabold text-xs shadow-sm transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              {isEditingSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t.distEditSaving || "Menyimpan..."}</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{t.distEditSave || "Simpan Perubahan"}</span>
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── UNSAVED CHANGES / EXIT GUARD CONFIRMATION MODAL ── */}
      <Dialog open={showExitConfirmDialog} onOpenChange={setShowExitConfirmDialog}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2.5 text-slate-900 dark:text-white">
              <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <span>Simpan Rencana Distribusi?</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 pt-2 leading-relaxed text-left">
              Kamu memiliki data formulir muatan pengiriman yang belum tersimpan. Apakah ingin menyimpannya sebagai <strong>Draf Rencana</strong> agar tidak hilang, atau membuang seluruh perubahan ini?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-4 border-t border-slate-100 dark:border-white/5 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowExitConfirmDialog(false)}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#202024] hover:bg-slate-50 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer w-full sm:w-auto"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleConfirmDiscard}
              className="px-4 py-2.5 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-bold transition-all cursor-pointer w-full sm:w-auto"
            >
              Buang Perubahan
            </button>

            <button
              type="button"
              onClick={() => handleSaveDraft(true)}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 w-full sm:w-auto disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              <span>{isSubmitting ? "Menyimpan..." : "Simpan Draf"}</span>
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: HAPUS DRAF SURAT JALAN ── */}
      <ConfirmDialog
        isOpen={!!deleteDraftDialogTransfer}
        onClose={() => setDeleteDraftDialogTransfer(null)}
        onConfirm={handleConfirmDeleteDraft}
        loading={isDeletingDraft}
        variant="destructive"
        title={language === "en" ? "Delete Draft Delivery Order?" : "Hapus Draf Surat Jalan?"}
        description={
          language === "en"
            ? `Are you sure you want to permanently delete draft ${deleteDraftDialogTransfer?.transfer_no || "this delivery order"}? No ledger movements were made.`
            : `Apakah Anda yakin ingin menghapus draf ${deleteDraftDialogTransfer?.transfer_no || "surat jalan ini"} secara permanen? Data draf yang belum terbit tidak memiliki mutasi stok.`
        }
        confirmText={language === "en" ? "Delete Draft" : "Hapus Draf"}
        cancelText={language === "en" ? "Cancel" : "Batal"}
      />

      {/* ── MODAL: BATALKAN PENGIRIMAN SURAT JALAN ── */}
      <Dialog open={!!cancelDialogTransfer} onOpenChange={(open) => !open && setCancelDialogTransfer(null)}>
        <DialogContent className="max-w-md bg-white dark:bg-[#202024] border-slate-200 dark:border-[#38383C] text-slate-900 dark:text-white p-6 rounded-3xl">
          <DialogHeader className="p-0 pb-4 border-b border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="text-left">
                <DialogTitle className="text-base font-extrabold text-slate-900 dark:text-white">
                  {language === "en" ? "Cancel Shipment?" : "Batalkan Pengiriman Surat Jalan?"}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  {cancelDialogTransfer?.transfer_no || "Surat Jalan"} • {cancelDialogTransfer?.to_outlet_name || "Outlet Tujuan"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-2 text-left">
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/30 text-amber-800 dark:text-amber-300 text-xs leading-relaxed space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Pengembalian Saldo Stok Otomatis</span>
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Seluruh barang yang sedang dalam perjalanan akan <strong>dikembalikan secara otomatis ke saldo fisik outlet pengirim</strong> dan dicatat ke mutasi buku besar (<em>double-entry reversal</em>).
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Alasan Pembatalan <span className="text-slate-400">(Opsional)</span>
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Contoh: Kendaraan kurir mogok / permintaan dibatalkan oleh cabang"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-[#38383C] bg-slate-50 dark:bg-[#28282C] text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none font-medium"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-white/5">
            <button
              type="button"
              onClick={() => setCancelDialogTransfer(null)}
              disabled={isCancellingDistribution}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-[#38383C] text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
            >
              {t.cancel || "Batal"}
            </button>
            <button
              type="button"
              onClick={handleConfirmCancelDistribution}
              disabled={isCancellingDistribution}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-sm transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              {isCancellingDistribution ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Konfirmasi Batalkan</span>
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* CENTRAL QUOTA MATRIX DIALOG (MULTI-BRANCH ALLOCATION / THE LEAN ODOO WAY) */}
      {/* ========================================================================= */}
      <Dialog open={isQuotaMatrixOpen} onOpenChange={setIsQuotaMatrixOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6 rounded-3xl bg-white dark:bg-[#1A1A1E] border border-slate-200 dark:border-[#2E2E34] shadow-2xl">
          <DialogHeader className="pb-4 border-b border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-slate-900 dark:text-white">
                  {t.distQuotaMatrixTitle || "Matriks Alokasi Kuota Pasokan Multi-Cabang"}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                  {t.distQuotaMatrixDesc || "Tinjau seluruh permintaan stok dari berbagai cabang dan distribusikan kuota gudang pusat secara merata."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto py-4 space-y-6">
            {(() => {
              const pendingTransfers = distributions.filter((d) => d.status === "pending_approval");
              if (pendingTransfers.length === 0) {
                return (
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                      {t.distQuotaNoPendingTitle || "Tidak Ada Permintaan Stok Tertunda"}
                    </p>
                    <p className="text-xs text-slate-400 max-w-sm">
                      {t.distQuotaNoPendingDesc || "Seluruh permintaan pasokan dari cabang telah disetujui atau belum ada cabang yang mengajukan permintaan baru."}
                    </p>
                  </div>
                );
              }

              // Group items across pending requisitions
              const itemGroupsMap = new Map<string, {
                itemId: string;
                itemName: string;
                itemSKU: string;
                boxUnit: string;
                baseUnit: string;
                conversionRate: number;
                availSealed: number;
                availLoose: number;
                transfers: Array<{
                  transfer: DistributionItem;
                  itemLine: StockTransferItemLine;
                }>;
              }>();

              for (const tr of pendingTransfers) {
                const trItems = tr.items && tr.items.length > 0 ? tr.items : (tr.item_id ? [{
                  item_id: tr.item_id,
                  item_name: tr.item_name,
                  item_sku: tr.item_sku,
                  box_unit: tr.box_unit,
                  base_unit: tr.base_unit,
                  conversion_rate: tr.conversion_rate,
                  qty_requested_sealed: tr.qty_sealed,
                  qty_requested_loose: tr.qty_loose,
                  qty_sent_sealed: tr.qty_sealed,
                  qty_sent_loose: tr.qty_loose,
                }] : []);

                for (const it of trItems) {
                  const masterItm = items.find((i) => i.id === it.item_id);
                  const key = it.item_id;
                  if (!itemGroupsMap.has(key)) {
                    itemGroupsMap.set(key, {
                      itemId: it.item_id,
                      itemName: it.item_name || masterItm?.name || "Produk",
                      itemSKU: it.item_sku || masterItm?.sku || "",
                      boxUnit: it.box_unit || masterItm?.box_unit || "Dus",
                      baseUnit: it.base_unit || masterItm?.base_unit || "pcs",
                      conversionRate: it.conversion_rate || masterItm?.conversion_rate || 1,
                      availSealed: masterItm?.qty_sealed || 0,
                      availLoose: masterItm?.qty_loose || 0,
                      transfers: [],
                    });
                  }
                  itemGroupsMap.get(key)!.transfers.push({
                    transfer: tr,
                    itemLine: it,
                  });
                }
              }

              const itemGroups = Array.from(itemGroupsMap.values());

              return (
                <div className="space-y-6">
                  {itemGroups.map((group) => {
                    const totalReqSealed = group.transfers.reduce((sum, t) => sum + (t.itemLine.qty_requested_sealed || t.itemLine.qty_sent_sealed || 0), 0);
                    const totalReqLoose = group.transfers.reduce((sum, t) => sum + (t.itemLine.qty_requested_loose || t.itemLine.qty_sent_loose || 0), 0);
                    const totalReqBaseUnits = (totalReqSealed * group.conversionRate) + totalReqLoose;
                    const totalAvailBaseUnits = (group.availSealed * group.conversionRate) + group.availLoose;
                    const isShortage = totalReqBaseUnits > totalAvailBaseUnits;

                    return (
                      <div key={group.itemId} className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-[#202024] border border-slate-200/80 dark:border-[#2E2E34] space-y-4">
                        {/* Item Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 dark:border-white/5">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-slate-900 dark:text-white">
                                {group.itemName}
                              </span>
                              {group.itemSKU && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                                  {group.itemSKU}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs">
                              <span className="text-slate-500">
                                Saldo Gudang Pusat: <strong className="text-slate-800 dark:text-slate-200">{group.availSealed} {group.boxUnit} + {group.availLoose} {group.baseUnit}</strong>
                              </span>
                              <span className="text-slate-300 dark:text-slate-700">•</span>
                              <span className="text-slate-500">
                                Total Diminta: <strong className="text-purple-600 dark:text-purple-400">{totalReqSealed} {group.boxUnit} + {totalReqLoose} {group.baseUnit}</strong>
                              </span>
                            </div>
                          </div>

                          {/* Equal Split Action Button */}
                          <button
                            type="button"
                            onClick={() => {
                              const branchesCount = group.transfers.length;
                              if (branchesCount === 0) return;
                              const unitsPerBranch = Math.floor(totalAvailBaseUnits / branchesCount);
                              const splitSealed = group.conversionRate > 1 ? Math.floor(unitsPerBranch / group.conversionRate) : 0;
                              const splitLoose = group.conversionRate > 1 ? unitsPerBranch % group.conversionRate : unitsPerBranch;

                              setDistributions((prev) =>
                                prev.map((d) => {
                                  const matchTr = group.transfers.find((t) => t.transfer.id === d.id);
                                  if (!matchTr) return d;
                                  const updatedItems = (d.items || []).map((it) => {
                                    if (it.item_id === group.itemId) {
                                      return {
                                        ...it,
                                        qty_sent_sealed: splitSealed,
                                        qty_sent_loose: splitLoose,
                                        allocation_notes: "Stok Pusat Menipis (Dibagi Rata Cabang)",
                                      };
                                    }
                                    return it;
                                  });
                                  return { ...d, items: updatedItems };
                                })
                              );
                              toast.success(`Kuota ${group.itemName} berhasil dibagi rata ke ${branchesCount} cabang!`);
                            }}
                            className="px-3 py-1.5 rounded-xl border border-purple-200 dark:border-purple-800/50 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            <span>{t.distQuotaEqualSplitBtn || "Bagi Rata (Equal Split)"}</span>
                          </button>
                        </div>

                        {/* Branch Allocations Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 dark:border-white/10 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                <th className="py-2 px-2">Outlet Cabang</th>
                                <th className="py-2 px-2 text-right">Diminta Cabang</th>
                                <th className="py-2 px-2 text-center">Alokasi Kirim</th>
                                <th className="py-2 px-2">Alasan Penyesuaian Kuota</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.transfers.map(({ transfer, itemLine }) => {
                                const liveDist = distributions.find((d) => d.id === transfer.id) || transfer;
                                const liveItem = (liveDist.items || []).find((i) => i.item_id === group.itemId) || itemLine;
                                const isCut = (liveItem.qty_sent_sealed < (liveItem.qty_requested_sealed || 0)) ||
                                              (liveItem.qty_sent_loose < (liveItem.qty_requested_loose || 0));

                                return (
                                  <tr key={transfer.id} className="border-b border-slate-100 dark:border-white/5">
                                    <td className="py-2.5 px-2 font-bold text-slate-900 dark:text-white">
                                      {transfer.to_outlet_name || "Cabang"}
                                    </td>
                                    <td className="py-2.5 px-2 text-right text-purple-700 dark:text-purple-300 font-bold">
                                      {(liveItem.qty_requested_sealed || 0)} {group.boxUnit} + {(liveItem.qty_requested_loose || 0)} {group.baseUnit}
                                    </td>
                                    <td className="py-2.5 px-2 text-center">
                                      <div className="inline-flex items-center gap-1.5">
                                        {group.conversionRate > 1 && (
                                          <div className="flex items-center gap-1">
                                            <input
                                              type="number"
                                              min="0"
                                              value={liveItem.qty_sent_sealed}
                                              onChange={(e) => {
                                                const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                                setDistributions((prev) =>
                                                  prev.map((d) => {
                                                    if (d.id !== transfer.id) return d;
                                                    const updated = (d.items || []).map((it) =>
                                                      it.item_id === group.itemId ? { ...it, qty_sent_sealed: val } : it
                                                    );
                                                    return { ...d, items: updated };
                                                  })
                                                );
                                              }}
                                              className="w-16 px-2 py-1 rounded-lg border border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#1A1A1E] text-xs font-bold"
                                            />
                                            <span className="text-[10px] text-slate-400 font-semibold">{group.boxUnit}</span>
                                          </div>
                                        )}
                                        <div className="flex items-center gap-1">
                                          <input
                                            type="number"
                                            min="0"
                                            value={liveItem.qty_sent_loose}
                                            onChange={(e) => {
                                              const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                              setDistributions((prev) =>
                                                prev.map((d) => {
                                                  if (d.id !== transfer.id) return d;
                                                  const updated = (d.items || []).map((it) =>
                                                    it.item_id === group.itemId ? { ...it, qty_sent_loose: val } : it
                                                  );
                                                  return { ...d, items: updated };
                                                })
                                              );
                                            }}
                                            className="w-16 px-2 py-1 rounded-lg border border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#1A1A1E] text-xs font-bold"
                                          />
                                          <span className="text-[10px] text-slate-400 font-semibold">{group.baseUnit}</span>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-2">
                                      {isCut ? (
                                        <select
                                          value={liveItem.allocation_notes || ""}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setDistributions((prev) =>
                                              prev.map((d) => {
                                                if (d.id !== transfer.id) return d;
                                                const updated = (d.items || []).map((it) =>
                                                  it.item_id === group.itemId ? { ...it, allocation_notes: val } : it
                                                );
                                                return { ...d, items: updated };
                                              })
                                            );
                                          }}
                                          className="w-full px-2 py-1 text-[11px] font-semibold rounded-lg border border-purple-200 dark:border-purple-800/60 bg-white dark:bg-[#1A1A1E] text-slate-800 dark:text-slate-200"
                                        >
                                          <option value="">-- Pilih Alasan Penyesuaian --</option>
                                          {QUOTA_ADJUSTMENT_PRESETS.map((p) => (
                                            <option key={p} value={p}>{p}</option>
                                          ))}
                                        </select>
                                      ) : (
                                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                          Terpenuhi 100%
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          <DialogFooter className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5 gap-3">
            <button
              type="button"
              onClick={() => setIsQuotaMatrixOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#38383C] text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
            >
              {t.cancel || "Tutup"}
            </button>

            <button
              type="button"
              disabled={isSavingQuotaMatrix}
              onClick={async () => {
                const pendingTransfers = distributions.filter((d) => d.status === "pending_approval");
                if (pendingTransfers.length === 0) {
                  setIsQuotaMatrixOpen(false);
                  return;
                }

                setIsSavingQuotaMatrix(true);
                try {
                  for (const tr of pendingTransfers) {
                    const payload = {
                      from_outlet_id: tr.from_outlet_id,
                      to_outlet_id: tr.to_outlet_id,
                      status: "in_transit",
                      transfer_type: tr.transfer_type || "outbound",
                      create_backorder: true,
                      items: (tr.items || []).map((it) => ({
                        item_id: it.item_id,
                        qty_sent_sealed: Number(it.qty_sent_sealed) || 0,
                        qty_sent_loose: Number(it.qty_sent_loose) || 0,
                        qty_requested_sealed: it.qty_requested_sealed !== undefined ? Number(it.qty_requested_sealed) : undefined,
                        qty_requested_loose: it.qty_requested_loose !== undefined ? Number(it.qty_requested_loose) : undefined,
                        allocation_notes: it.allocation_notes || undefined,
                        notes: it.notes || undefined,
                      })),
                    };
                    await api.put(`/transfers/${tr.id}`, payload);
                  }
                  toast.success(t.distQuotaSaveSuccess || "Seluruh alokasi kuota cabang berhasil diterapkan & diterbitkan!");
                  setIsQuotaMatrixOpen(false);
                  fetchData();
                } catch (err: any) {
                  toast.error(err.response?.data?.message || err.message || "Gagal menerapkan alokasi kuota");
                } finally {
                  setIsSavingQuotaMatrix(false);
                }
              }}
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {isSavingQuotaMatrix ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan Alokasi...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>{t.distQuotaSaveBtn || "Terapkan & Terbitkan Semua Alokasi"}</span>
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
