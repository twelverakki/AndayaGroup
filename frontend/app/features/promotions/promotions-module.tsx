import { useState, useEffect, useMemo } from "react";
import { api } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { useLanguageStore, translations } from "../../lib/i18n";
import { ErpSearchBar } from "../../components/ErpSearchBar";
import { ErpDataTable, type ColumnDef } from "../../components/ErpDataTable";
import { ErpFilterPopover } from "../../components/ErpFilterPopover";
import { CurrencyInput } from "../../components/CurrencyInput";
import {
  Tag,
  Plus,
  Calendar,
  Clock,
  Percent,
  Coins,
  Sparkles,
  Ticket,
  Check,
  Zap,
  Hand,
  ArrowLeft,
  Search,
  Receipt,
  HelpCircle,
  ShoppingBag,
  FolderTree,
  ExternalLink,
  X,
  LayoutGrid,
  List,
  RotateCcw,
  Image as ImageIcon,
  MoreVertical,
  Eye,
  Edit2,
  Copy,
  CheckCircle2,
  XCircle,
  Pause,
  Play,
  ShieldAlert,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../../components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../components/ui/tooltip";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { getImageUrl } from "../../lib/utils";
import { toast } from "sonner";

export interface Promotion {
  id: string;
  business_id: string;
  outlet_id?: string | null;
  outlet_name?: string;
  name: string;
  code?: string;
  promo_type: "automatic" | "coupon_code" | "catalog_sale" | "manual_select";
  start_date: string;
  end_date?: string | null;
  active_days: number[];
  active_time_start?: string;
  active_time_end?: string;
  min_order_amount: number;
  min_qty: number;
  usage_limit?: number | null;
  usage_count: number;
  reward_type: "discount_pct" | "discount_fixed" | "fixed_price";
  reward_value: number;
  max_discount_cap?: number | null;
  target_scope: "entire_order" | "specific_items" | "specific_categories";
  is_active: boolean;
  target_ids?: string[];
  target_items?: { id: string; name: string; sku?: string }[];
}

interface ItemOption {
  id: string;
  name: string;
  sku?: string;
  category_name?: string;
  image_url?: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

export function PromotionsModule() {
  const { activeContext } = useAuthStore();
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;

  const isPromoAdmin = activeContext?.role === "owner" || activeContext?.role === "superadmin" || activeContext?.role === "admin_gudang" || activeContext?.role === "manager";

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [itemsList, setItemsList] = useState<ItemOption[]>([]);
  const [categoriesList, setCategoriesList] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Multi-Filter Popover States (Standardized like master items)
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [selectedRewards, setSelectedRewards] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [quickKpiFilter, setQuickKpiFilter] = useState<"all" | "active_today" | "coupon" | "claims">("all");

  // View Mode: "list" | "form"
  const [currentView, setCurrentView] = useState<"list" | "form">("list");
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [isReadOnly, setIsReadOnly] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);

  // Form States
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formPromoType, setFormPromoType] = useState<Promotion["promo_type"]>("automatic");
  const [formRewardType, setFormRewardType] = useState<Promotion["reward_type"]>("discount_pct");
  const [formRewardValue, setFormRewardValue] = useState<number>(10);
  const [formMaxCap, setFormMaxCap] = useState<number>(0);
  const [formTargetScope, setFormTargetScope] = useState<Promotion["target_scope"]>("entire_order");
  const [formMinOrder, setFormMinOrder] = useState<number>(0);
  const [formMinQty, setFormMinQty] = useState<number>(0);
  
  // Date & Schedule Options
  const [hasEndDate, setHasEndDate] = useState(false);
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [formEndDate, setFormEndDate] = useState("");
  
  const [hasHappyHour, setHasHappyHour] = useState(false);
  const [formTimeStart, setFormTimeStart] = useState("14:00");
  const [formTimeEnd, setFormTimeEnd] = useState("17:00");

  const [formActiveDays, setFormActiveDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [formUsageLimit, setFormUsageLimit] = useState<number>(0);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formTargetIDs, setFormTargetIDs] = useState<string[]>([]);
  const [targetSearchQuery, setTargetSearchQuery] = useState("");

  useEffect(() => {
    fetchPromotions();
    fetchTargetsMaster();
  }, [activeContext]);

  const fetchPromotions = async () => {
    setLoading(true);
    try {
      const res = await api.get("/promotions");
      const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setPromotions(list);
    } catch (err: any) {
      console.error("Failed to load promotions:", err);
      toast.error(err.response?.data?.message || "Gagal memuat daftar promosi");
    } finally {
      setLoading(false);
    }
  };

  const fetchTargetsMaster = async () => {
    try {
      const [itemsRes, catRes] = await Promise.all([
        api.get("/items?status=active"),
        api.get("/categories"),
      ]);
      const itemsData = Array.isArray(itemsRes.data) ? itemsRes.data : itemsRes.data?.data || [];
      const catData = Array.isArray(catRes.data) ? catRes.data : catRes.data?.data || [];
      setItemsList(itemsData);
      setCategoriesList(catData);
    } catch (err) {
      console.error("Failed to load targets master:", err);
    }
  };

  const handleOpenCreate = () => {
    if (!isPromoAdmin) {
      toast.error("Akses Dibatasi: Staf tidak memiliki izin membuat program promo");
      return;
    }
    setEditingPromo(null);
    setIsReadOnly(false);
    setFormName("");
    setFormCode("");
    setFormPromoType("automatic");
    setFormRewardType("discount_pct");
    setFormRewardValue(10);
    setFormMaxCap(0);
    setFormTargetScope("entire_order");
    setFormMinOrder(0);
    setFormMinQty(0);
    setFormStartDate(new Date().toISOString().split("T")[0]);
    setFormEndDate("");
    setHasEndDate(false);
    setFormActiveDays([0, 1, 2, 3, 4, 5, 6]);
    setHasHappyHour(false);
    setFormTimeStart("14:00");
    setFormTimeEnd("17:00");
    setFormUsageLimit(0);
    setFormIsActive(true);
    setFormTargetIDs([]);
    setTargetSearchQuery("");
    setCurrentView("form");
  };

  const populateFormFields = (p: Promotion) => {
    setEditingPromo(p);
    setFormName(p.name);
    setFormCode(p.code || "");
    setFormPromoType(p.promo_type);
    setFormRewardType(p.reward_type);
    setFormRewardValue(p.reward_value);
    setFormMaxCap(p.max_discount_cap || 0);
    setFormTargetScope(p.target_scope);
    setFormMinOrder(p.min_order_amount);
    setFormMinQty(p.min_qty);
    setFormStartDate(p.start_date ? p.start_date.split("T")[0] : new Date().toISOString().split("T")[0]);
    setFormEndDate(p.end_date ? p.end_date.split("T")[0] : "");
    setHasEndDate(Boolean(p.end_date));
    setFormActiveDays(p.active_days || [0, 1, 2, 3, 4, 5, 6]);
    setFormTimeStart(p.active_time_start || "14:00");
    setFormTimeEnd(p.active_time_end || "17:00");
    setHasHappyHour(Boolean(p.active_time_start && p.active_time_end));
    setFormUsageLimit(p.usage_limit || 0);
    setFormIsActive(p.is_active);
    setFormTargetIDs(p.target_ids || []);
    setTargetSearchQuery("");
  };

  const handleOpenEdit = (p: Promotion) => {
    if (!isPromoAdmin) {
      toast.error("Akses Dibatasi: Staf tidak memiliki izin mengedit program promo");
      return;
    }
    populateFormFields(p);
    setIsReadOnly(false);
    setCurrentView("form");
  };

  const handleOpenView = (p: Promotion) => {
    populateFormFields(p);
    setIsReadOnly(true);
    setCurrentView("form");
  };

  const handleResetFilters = () => {
    setSelectedTypes([]);
    setSelectedScopes([]);
    setSelectedRewards([]);
    setSelectedStatuses([]);
    setQuickKpiFilter("all");
    setSearchQuery("");
  };

  const activeFilterCount =
    selectedTypes.length +
    selectedScopes.length +
    selectedRewards.length +
    selectedStatuses.length +
    (quickKpiFilter !== "all" ? 1 : 0);

  // Drag/Hold Hover Day Selection State
  const [isDayDragging, setIsDayDragging] = useState(false);
  const [dayDragMode, setDayDragMode] = useState<"select" | "deselect">("select");

  useEffect(() => {
    const handleMouseUp = () => setIsDayDragging(false);
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []);

  const handleDayMouseDown = (dayIndex: number) => {
    setIsDayDragging(true);
    if (formActiveDays.includes(dayIndex)) {
      if (formActiveDays.length > 1) {
        setDayDragMode("deselect");
        setFormActiveDays(formActiveDays.filter((d) => d !== dayIndex));
      }
    } else {
      setDayDragMode("select");
      setFormActiveDays([...formActiveDays, dayIndex].sort());
    }
  };

  const handleDayMouseEnter = (dayIndex: number) => {
    if (!isDayDragging) return;
    if (dayDragMode === "select" && !formActiveDays.includes(dayIndex)) {
      setFormActiveDays((prev) => [...prev, dayIndex].sort());
    } else if (dayDragMode === "deselect" && formActiveDays.includes(dayIndex)) {
      if (formActiveDays.length > 1) {
        setFormActiveDays((prev) => prev.filter((d) => d !== dayIndex));
      }
    }
  };

  const handleToggleDay = (dayIndex: number) => {
    if (formActiveDays.includes(dayIndex)) {
      if (formActiveDays.length > 1) {
        setFormActiveDays(formActiveDays.filter((d) => d !== dayIndex));
      }
    } else {
      setFormActiveDays([...formActiveDays, dayIndex].sort());
    }
  };

  // Target Picker Modal State & View Mode ("grid" | "list")
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
  const [targetViewMode, setTargetViewMode] = useState<"grid" | "list">("grid");

  // Drag/Hold Hover Selection State for Products in List Mode
  const [isItemDragging, setIsItemDragging] = useState(false);
  const [itemDragMode, setItemDragMode] = useState<"select" | "deselect">("select");

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDayDragging(false);
      setIsItemDragging(false);
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, []);

  // Active Days Preset Helper (returns active preset or "custom")
  const activeDayPreset = useMemo(() => {
    const sorted = [...formActiveDays].sort().join(",");
    if (sorted === "0,1,2,3,4,5,6") return "all";
    if (sorted === "1,2,3,4,5") return "weekdays";
    if (sorted === "0,6") return "weekends";
    return "custom";
  }, [formActiveDays]);

  const handleSetDayPreset = (preset: "all" | "weekdays" | "weekends") => {
    if (preset === "all") {
      setFormActiveDays([0, 1, 2, 3, 4, 5, 6]);
    } else if (preset === "weekdays") {
      setFormActiveDays([1, 2, 3, 4, 5]);
    } else if (preset === "weekends") {
      setFormActiveDays([0, 6]);
    }
  };

  const handleToggleTarget = (id: string) => {
    if (formTargetIDs.includes(id)) {
      setFormTargetIDs(formTargetIDs.filter((tID) => tID !== id));
    } else {
      setFormTargetIDs([...formTargetIDs, id]);
    }
  };

  // Drag selection handlers for items (List view)
  const handleItemMouseDown = (id: string) => {
    setIsItemDragging(true);
    if (formTargetIDs.includes(id)) {
      setItemDragMode("deselect");
      setFormTargetIDs((prev) => prev.filter((tID) => tID !== id));
    } else {
      setItemDragMode("select");
      setFormTargetIDs((prev) => [...prev, id]);
    }
  };

  const handleItemMouseEnter = (id: string) => {
    if (!isItemDragging) return;
    if (itemDragMode === "select" && !formTargetIDs.includes(id)) {
      setFormTargetIDs((prev) => [...prev, id]);
    } else if (itemDragMode === "deselect" && formTargetIDs.includes(id)) {
      setFormTargetIDs((prev) => prev.filter((tID) => tID !== id));
    }
  };

  const handleRemoveTarget = (id: string) => {
    setFormTargetIDs((prev) => prev.filter((tID) => tID !== id));
  };

  const handleSelectAllTargets = (selectAll: boolean) => {
    if (selectAll) {
      if (formTargetScope === "specific_items") {
        setFormTargetIDs(itemsList.map((i) => i.id));
      } else if (formTargetScope === "specific_categories") {
        setFormTargetIDs(categoriesList.map((c) => c.id));
      }
    } else {
      setFormTargetIDs([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPromoAdmin) {
      toast.error("Akses Dibatasi: Staf tidak memiliki izin menyimpan program promo");
      return;
    }
    if (!formName.trim()) {
      toast.error(t.promoNameLabel + " wajib diisi");
      return;
    }

    if (formPromoType === "coupon_code" && !formCode.trim()) {
      toast.error("Kode voucher wajib diisi untuk tipe Kupon");
      return;
    }

    if (formTargetScope !== "entire_order" && formTargetIDs.length === 0) {
      toast.error("Pilih minimal 1 item/kategori sasaran promo");
      return;
    }

    setSubmitting(true);
    const payload = {
      name: formName.trim(),
      code: formCode.trim() ? formCode.trim().toUpperCase() : undefined,
      promo_type: formPromoType,
      reward_type: formRewardType,
      reward_value: formRewardValue,
      max_discount_cap: formRewardType === "discount_pct" && formMaxCap > 0 ? formMaxCap : undefined,
      target_scope: formTargetScope,
      min_order_amount: formMinOrder,
      min_qty: formMinQty,
      start_date: new Date(formStartDate).toISOString(),
      end_date: hasEndDate && formEndDate ? new Date(formEndDate).toISOString() : undefined,
      active_days: formActiveDays,
      active_time_start: hasHappyHour && formTimeStart ? formTimeStart : undefined,
      active_time_end: hasHappyHour && formTimeEnd ? formTimeEnd : undefined,
      usage_limit: formUsageLimit > 0 ? formUsageLimit : undefined,
      is_active: formIsActive,
      target_ids: formTargetScope === "entire_order" ? [] : formTargetIDs,
    };

    try {
      if (editingPromo) {
        await api.put(`/promotions/${editingPromo.id}`, payload);
        toast.success("Program promosi berhasil diperbarui!");
      } else {
        await api.post("/promotions", payload);
        toast.success("Program promosi baru berhasil dibuat!");
      }
      setCurrentView("list");
      fetchPromotions();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menyimpan promosi");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (p: Promotion) => {
    if (!isPromoAdmin) {
      toast.error("Akses Dibatasi: Staf tidak memiliki izin mengubah status promosi");
      return;
    }
    const nextStatus = !p.is_active;
    try {
      await api.put(`/promotions/${p.id}`, { is_active: nextStatus });
      setPromotions((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, is_active: nextStatus } : item))
      );
      toast.success(nextStatus ? "Promo diaktifkan!" : "Promo dinonaktifkan!");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal mengubah status promosi");
    }
  };

  // Smart Status Evaluator (Multi-condition real-time evaluation)
  const getSmartPromoStatus = (p: Promotion) => {
    if (!p.is_active) {
      return {
        statusKey: "paused",
        label: "Dijeda",
        badgeClass: "bg-slate-200/80 dark:bg-white/10 text-slate-600 dark:text-slate-400 border border-slate-300/60 dark:border-white/10",
        dotClass: "bg-slate-400",
        description: "Promo dinonaktifkan sementara oleh pemilik usaha",
        isLive: false,
      };
    }

    const now = new Date();
    const start = new Date(p.start_date);
    if (now < start) {
      const startStr = start.toLocaleDateString(language === "id" ? "id-ID" : "en-US", { day: "numeric", month: "short", year: "numeric" });
      return {
        statusKey: "scheduled",
        label: "Terjadwal",
        badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20",
        dotClass: "bg-sky-500",
        description: `Belum mulai (Jadwal rilis: ${startStr})`,
        isLive: false,
      };
    }

    if (p.end_date) {
      const end = new Date(p.end_date);
      if (now > end) {
        return {
          statusKey: "expired",
          label: "Kadaluarsa",
          badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
          dotClass: "bg-rose-500",
          description: "Masa berlaku periode promosi telah berakhir",
          isLive: false,
        };
      }
    }

    if (p.usage_limit && p.usage_limit > 0 && p.usage_count >= p.usage_limit) {
      return {
        statusKey: "quota_full",
        label: "Kuota Habis",
        badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
        dotClass: "bg-purple-500",
        description: `Batas kuota ${p.usage_limit}x klaim telah terpenuhi`,
        isLive: false,
      };
    }

    const currentDay = now.getDay();
    if (p.active_days && p.active_days.length > 0 && !p.active_days.includes(currentDay)) {
      const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      return {
        statusKey: "off_day",
        label: "Di Luar Hari",
        badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20",
        dotClass: "bg-amber-500",
        description: `Tidak aktif pada hari ini (${dayNames[currentDay]})`,
        isLive: false,
      };
    }

    if (p.active_time_start && p.active_time_end) {
      const currentHours = String(now.getHours()).padStart(2, "0");
      const currentMinutes = String(now.getMinutes()).padStart(2, "0");
      const currentTimeStr = `${currentHours}:${currentMinutes}:00`;
      if (currentTimeStr < p.active_time_start || currentTimeStr > p.active_time_end) {
        return {
          statusKey: "off_hour",
          label: "Di Luar Jam",
          badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20",
          dotClass: "bg-amber-500",
          description: `Happy Hour aktif jam ${p.active_time_start.slice(0, 5)} - ${p.active_time_end.slice(0, 5)}`,
          isLive: false,
        };
      }
    }

    return {
      statusKey: "live",
      label: "Live",
      badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20",
      dotClass: "bg-emerald-500 animate-pulse",
      description: "Program promo aktif & siap diklaim di kasir POS",
      isLive: true,
    };
  };

  // KPI Calculations
  const kpiMetrics = useMemo(() => {
    const total = promotions.length;
    const activeToday = promotions.filter((p) => getSmartPromoStatus(p).isLive).length;
    const couponCount = promotions.filter((p) => p.promo_type === "coupon_code" && p.is_active).length;
    const totalClaims = promotions.reduce((sum, p) => sum + (p.usage_count || 0), 0);

    return { total, activeToday, couponCount, totalClaims };
  }, [promotions]);

  const filteredPromos = useMemo(() => {
    return promotions.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.code && p.code.toLowerCase().includes(q));

      if (!matchSearch) return false;

      // Quick KPI Filter Strip Logic
      if (quickKpiFilter === "active_today") {
        if (!getSmartPromoStatus(p).isLive) return false;
      } else if (quickKpiFilter === "coupon") {
        if (p.promo_type !== "coupon_code") return false;
      } else if (quickKpiFilter === "claims") {
        if (!p.usage_count || p.usage_count <= 0) return false;
      }

      const matchType =
        selectedTypes.length === 0 || selectedTypes.includes(p.promo_type);

      const matchScope =
        selectedScopes.length === 0 || selectedScopes.includes(p.target_scope);

      const matchReward =
        selectedRewards.length === 0 || selectedRewards.includes(p.reward_type);

      const statusInfo = getSmartPromoStatus(p);
      const matchStatus =
        selectedStatuses.length === 0 ||
        (selectedStatuses.includes("active") && p.is_active) ||
        (selectedStatuses.includes("inactive") && !p.is_active) ||
        selectedStatuses.includes(statusInfo.statusKey);

      return matchType && matchScope && matchReward && matchStatus;
    });
  }, [promotions, searchQuery, selectedTypes, selectedScopes, selectedRewards, selectedStatuses, quickKpiFilter]);

  const daysLabels = [
    { idx: 0, short: "Min", full: "Minggu" },
    { idx: 1, short: "Sen", full: "Senin" },
    { idx: 2, short: "Sel", full: "Selasa" },
    { idx: 3, short: "Rab", full: "Rabu" },
    { idx: 4, short: "Kam", full: "Kamis" },
    { idx: 5, short: "Jum", full: "Jumat" },
    { idx: 6, short: "Sab", full: "Sabtu" },
  ];

  const filteredTargetItems = useMemo(() => {
    const q = targetSearchQuery.toLowerCase().trim();
    if (!q) return itemsList;
    return itemsList.filter(
      (item) => item.name.toLowerCase().includes(q) || (item.sku && item.sku.toLowerCase().includes(q))
    );
  }, [itemsList, targetSearchQuery]);

  const filteredTargetCategories = useMemo(() => {
    const q = targetSearchQuery.toLowerCase().trim();
    if (!q) return categoriesList;
    return categoriesList.filter((cat) => cat.name.toLowerCase().includes(q));
  }, [categoriesList, targetSearchQuery]);

  const handleCopyCode = (code?: string) => {
    if (!code) {
      toast.info("Program promo ini tidak memiliki voucher kode");
      return;
    }
    navigator.clipboard.writeText(code);
    toast.success(`Kode voucher "${code}" disalin ke clipboard!`);
  };

  const columns: ColumnDef<Promotion>[] = [
    {
      key: "name",
      label: "Program & Kode",
      renderCell: (p: Promotion) => (
        <div className="flex items-center gap-3 py-1">
          <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
            p.promo_type === "automatic"
              ? "bg-purple-500/10 text-brand-purple dark:text-primary"
              : p.promo_type === "coupon_code"
              ? "bg-blue-500/10 text-blue-500"
              : "bg-emerald-500/10 text-emerald-500"
          }`}>
            {p.promo_type === "coupon_code" ? (
              <Ticket className="w-4 h-4 stroke-[2]" />
            ) : (
              <Sparkles className="w-4 h-4 stroke-[2]" />
            )}
          </div>
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => handleOpenView(p)}
              className="font-extrabold text-sm text-slate-900 dark:text-white hover:text-brand-purple dark:hover:text-primary transition-colors truncate text-left cursor-pointer block"
              title="Lihat Detail Program Promo"
            >
              {p.name}
            </button>

            <div className="flex items-center gap-1.5 mt-0.5">
              {p.code ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyCode(p.code);
                  }}
                  className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:border-brand-purple transition-colors cursor-pointer flex items-center gap-1"
                  title="Klik untuk salin kode voucher"
                >
                  <span>{p.code}</span>
                  <Copy className="w-2.5 h-2.5 opacity-60" />
                </button>
              ) : p.promo_type === "automatic" ? (
                <span className="flex items-center gap-1 text-[10px] text-purple-600 dark:text-primary font-semibold">
                  <Zap className="w-3 h-3" />
                  <span>Otomatis di Kasir</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] text-slate-500 font-semibold">
                  <Hand className="w-3 h-3" />
                  <span>Pilihan Kasir</span>
                </span>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "scope",
      label: "Sasaran & Cabang",
      renderCell: (p: Promotion) => {
        const targetPreview =
          p.target_scope === "specific_items"
            ? p.target_items && p.target_items.length > 0
              ? p.target_items.slice(0, 4).map((i) => i.name).join(", ") +
                (p.target_items.length > 4 ? ` (+${p.target_items.length - 4} lainnya)` : "")
              : `${p.target_ids?.length || 0} item khusus`
            : p.target_scope === "specific_categories"
            ? `${p.target_ids?.length || 0} kategori khusus`
            : "Semua belanjaan keranjang";

        return (
          <div className="space-y-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold cursor-help ${
                    p.target_scope === "entire_order"
                      ? "bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300"
                      : p.target_scope === "specific_items"
                      ? "bg-purple-50 dark:bg-purple-950/40 text-brand-purple dark:text-primary border border-purple-200/60 dark:border-purple-800/40"
                      : "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40"
                  }`}>
                    {p.target_scope === "entire_order" ? (
                      <Receipt className="w-3 h-3 text-slate-400" />
                    ) : p.target_scope === "specific_items" ? (
                      <ShoppingBag className="w-3 h-3" />
                    ) : (
                      <FolderTree className="w-3 h-3" />
                    )}
                    <span>
                      {p.target_scope === "entire_order"
                        ? "Total Nota"
                        : p.target_scope === "specific_items"
                        ? `${p.target_ids?.length || 0} Item Khusus`
                        : `${p.target_ids?.length || 0} Kategori`}
                    </span>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs font-normal">
                  <p className="font-bold mb-0.5">Cakupan Sasaran:</p>
                  <p>{targetPreview}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <p className="text-[10px] text-slate-400 font-medium">
              {p.outlet_name ? `📍 ${p.outlet_name}` : "Semua Cabang"}
            </p>
          </div>
        );
      },
    },
    {
      key: "reward",
      label: "Potongan & Nilai",
      renderCell: (p: Promotion) => (
        <div>
          <span className="font-extrabold text-sm text-emerald-600 dark:text-primary">
            {p.reward_type === "discount_pct"
              ? `${p.reward_value}% OFF`
              : `Rp ${Number(p.reward_value).toLocaleString("id-ID")}`}
          </span>
          {p.max_discount_cap && p.max_discount_cap > 0 && p.reward_type === "discount_pct" ? (
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              Maks: Rp {p.max_discount_cap.toLocaleString("id-ID")}
            </p>
          ) : p.min_order_amount > 0 ? (
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              Min. Belanja: Rp {p.min_order_amount.toLocaleString("id-ID")}
            </p>
          ) : (
            <p className="text-[10px] text-slate-400 font-normal">Tanpa Minimum</p>
          )}
        </div>
      ),
    },
    {
      key: "period",
      label: "Masa Berlaku & Waktu",
      renderCell: (p: Promotion) => {
        const start = new Date(p.start_date).toLocaleDateString(language === "id" ? "id-ID" : "en-US", {
          day: "numeric",
          month: "short",
        });
        const end = p.end_date
          ? new Date(p.end_date).toLocaleDateString(language === "id" ? "id-ID" : "en-US", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "Permanen";
        return (
          <div className="text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{start} - {end}</span>
            </div>
            {p.active_time_start && p.active_time_end ? (
              <div className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                <Clock className="w-3 h-3" />
                <span>{p.active_time_start.slice(0, 5)} - {p.active_time_end.slice(0, 5)} (Happy Hour)</span>
              </div>
            ) : (
              <div className="text-[10px] text-slate-400 mt-0.5">
                {p.active_days && p.active_days.length === 7 ? "Aktif Setiap Hari" : `${p.active_days?.length || 0} hari / minggu`}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "status",
      label: "Status & Kuota",
      renderCell: (p: Promotion) => {
        const statusInfo = getSmartPromoStatus(p);

        return (
          <div className="space-y-1.5">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <button
                    type="button"
                    disabled={!isPromoAdmin}
                    onClick={() => handleToggleActive(p)}
                    className={`px-3 py-0.5 rounded-full text-[11px] font-extrabold transition-all flex items-center gap-1.5 ${statusInfo.badgeClass} ${isPromoAdmin ? "cursor-pointer" : "cursor-default opacity-90"}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                    <span>{statusInfo.label}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-xs max-w-xs font-normal">
                  <p className="font-bold mb-0.5">Status: {statusInfo.label}</p>
                  <p className="text-slate-200">{statusInfo.description}</p>
                  <p className="text-[10px] text-slate-400 mt-1 italic">
                    {isPromoAdmin ? "Klik tombol untuk mengubah switch aktif/jeda." : "Status operasional promo saat ini."}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {p.usage_limit && p.usage_limit > 0 ? (
              (() => {
                const pct = Math.min(100, Math.round((p.usage_count / p.usage_limit) * 100));
                const isNearLimit = pct >= 85;
                return (
                  <div className="w-28 space-y-0.5">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-700 dark:text-slate-300">
                      <span>{p.usage_count}x</span>
                      <span className={`${isNearLimit ? "text-amber-600 dark:text-amber-400 font-extrabold" : "text-slate-400 font-medium"}`}>
                        {pct}% ({p.usage_limit})
                      </span>
                    </div>
                    <div className="w-full h-1 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isNearLimit
                            ? "bg-amber-500"
                            : pct >= 100
                            ? "bg-rose-500"
                            : "bg-brand-purple dark:bg-[#E2FF66]"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })()
            ) : (
              <p className="text-[10px] text-slate-400 font-medium">
                {p.usage_count > 0 ? `${p.usage_count}x klaim (Tak terbatas)` : "Belum ada klaim"}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "actions",
      label: "Aksi",
      align: "right",
      renderCell: (p: Promotion) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="w-8 h-8 rounded-full inline-flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors focus:outline-none cursor-pointer"
            onClick={(e) => e.stopPropagation()}
            title="Aksi Tambahan"
          >
            <MoreVertical className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-2xl p-1.5 shadow-xl bg-white dark:bg-[#202024] border border-slate-200/80 dark:border-[#38383C]">
            <DropdownMenuItem
              onClick={() => handleOpenView(p)}
              className="gap-2 rounded-xl text-xs font-medium cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-slate-500" />
              <span>Lihat Detail Program</span>
            </DropdownMenuItem>

            {isPromoAdmin && (
              <DropdownMenuItem
                onClick={() => handleOpenEdit(p)}
                className="gap-2 rounded-xl text-xs font-medium cursor-pointer text-slate-800 dark:text-slate-100"
              >
                <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                <span>Edit Parameter Promo</span>
              </DropdownMenuItem>
            )}

            {p.code && (
              <DropdownMenuItem
                onClick={() => handleCopyCode(p.code)}
                className="gap-2 rounded-xl text-xs font-medium cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Salin Kode Kupon</span>
              </DropdownMenuItem>
            )}

            {isPromoAdmin && (
              <>
                <DropdownMenuSeparator className="my-1 border-slate-100 dark:border-white/10" />
                
                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Kontrol Status
                </div>

                {p.is_active ? (
                  <DropdownMenuItem
                    onClick={() => handleToggleActive(p)}
                    className="gap-2 rounded-xl text-xs font-medium text-amber-600 dark:text-amber-400 cursor-pointer"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>Jeda Program (Nonaktifkan)</span>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => handleToggleActive(p)}
                    className="gap-2 rounded-xl text-xs font-medium text-emerald-600 dark:text-emerald-400 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Lanjutkan (Aktifkan Kembali)</span>
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // ══════════════════════════════════════════════════════════════════════
  // RENDER: FULL-PAGE FORM VIEW (NO MODAL)
  // ══════════════════════════════════════════════════════════════════════
  if (currentView === "form") {
    return (
      <TooltipProvider>
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Frameless Form Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200/80 dark:border-[#2E2E34] gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentView("list")}
                className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                    {isReadOnly
                      ? "Detail Program Promosi"
                      : editingPromo
                      ? "Edit Program Promosi"
                      : "Buat Program Promosi Baru"}
                  </h1>
                  {isReadOnly && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/10 text-brand-purple dark:text-primary border border-purple-500/20">
                      Mode Pratinjau
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {isReadOnly
                    ? "Menampilkan parameter promo yang telah dikonfigurasi. Klik tombol Edit di kanan untuk mengubah data."
                    : "Atur besaran potongan diskon, trigger kasir, jadwal tayang, dan target produk secara presisi."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setCurrentView("list")}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-[#38383C] font-bold text-xs text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
              >
                {isReadOnly ? "Kembali ke Daftar" : (t.cancel || "Batal")}
              </button>

              {isReadOnly ? (
                isPromoAdmin && (
                  <button
                    type="button"
                    onClick={() => setIsReadOnly(false)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-2xl shadow-md transition-all cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Edit Promo Ini</span>
                  </button>
                )
              ) : (
                isPromoAdmin && (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex items-center gap-2 px-6 py-2.5 bg-brand-purple hover:bg-brand-purple-hover dark:bg-[#E2FF66] dark:text-slate-900 text-white font-bold text-xs rounded-2xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>{submitting ? "Menyimpan..." : (editingPromo ? "Perbarui Promo" : "Simpan & Luncurkan")}</span>
                  </button>
                )
              )}
            </div>
          </div>

          {/* 2-Column Bento Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start text-left">
            {/* Left Column: Form Controls (8 Cols) */}
            <fieldset disabled={isReadOnly || !isPromoAdmin} className="lg:col-span-8 space-y-6 border-0 p-0 m-0 min-w-0">
              
              {/* CARD 1: Identitas & Besaran Diskon */}
              <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] space-y-5 shadow-xs">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-white/5">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-brand-purple dark:text-primary flex items-center justify-center shrink-0">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      1. Identitas & Nilai Potongan Diskon
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Tentukan nama kampanye, pemicu di kasir, dan format reward harga.
                    </p>
                  </div>
                </div>

                {/* Promo Name & Voucher Code */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {t.promoNameLabel || "Nama Program Promo"} <span className="text-rose-500">*</span>
                      </Label>
                      <Tooltip>
                        <TooltipTrigger type="button" tabIndex={-1}>
                          <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                        </TooltipTrigger>
                        <TooltipContent className="text-xs max-w-xs">
                          Nama yang akan tampil pada struk belanja, layar kasir POS, dan laporan analitik.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Contoh: Diskon Jam Istirahat 15% / Gajian Sale"
                      className="h-10 text-xs rounded-xl"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {formPromoType === "coupon_code" ? "Kode Kupon / Voucher *" : "Kode Kupon (Opsional)"}
                      </Label>
                      <Tooltip>
                        <TooltipTrigger type="button" tabIndex={-1}>
                          <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                        </TooltipTrigger>
                        <TooltipContent className="text-xs max-w-xs">
                          Kode yang wajib diinput atau di-scan kasir pada dialog voucher untuk mengaktifkan diskon.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      type="text"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                      placeholder={formPromoType === "coupon_code" ? "Contoh: HEMAT50 (Wajib)" : "Contoh: PROMO10 (Opsional)"}
                      className="h-10 text-xs font-mono font-bold uppercase rounded-xl"
                      required={formPromoType === "coupon_code"}
                    />
                  </div>
                </div>

                {/* Trigger Type Selection */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Tipe & Cara Aktivasi Diskon di Kasir
                    </Label>
                    <Tooltip>
                      <TooltipTrigger type="button" tabIndex={-1}>
                        <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                      </TooltipTrigger>
                      <TooltipContent className="text-xs max-w-xs">
                        Tentukan apakah promo aktif otomatis saat syarat belanja terpenuhi, via kode voucher, atau dipilih manual oleh kasir.
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setFormPromoType("automatic")}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        formPromoType === "automatic"
                          ? "border-brand-purple bg-brand-purple/10 dark:border-primary dark:bg-primary/10 shadow-xs"
                          : "border-slate-200 dark:border-[#38383C] hover:bg-slate-50 dark:hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <Zap className={`w-4 h-4 ${formPromoType === "automatic" ? "text-brand-purple dark:text-primary" : "text-slate-400"}`} />
                        {formPromoType === "automatic" && <Check className="w-3.5 h-3.5 text-brand-purple dark:text-primary" />}
                      </div>
                      <div>
                        <span className="font-bold text-xs text-slate-900 dark:text-white block">⚡ Otomatis Kasir</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal leading-tight block mt-0.5">
                          Aktif otomatis begitu syarat keranjang terpenuhi
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormPromoType("coupon_code")}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        formPromoType === "coupon_code"
                          ? "border-blue-500 bg-blue-500/10 shadow-xs"
                          : "border-slate-200 dark:border-[#38383C] hover:bg-slate-50 dark:hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <Ticket className={`w-4 h-4 ${formPromoType === "coupon_code" ? "text-blue-500" : "text-slate-400"}`} />
                        {formPromoType === "coupon_code" && <Check className="w-3.5 h-3.5 text-blue-500" />}
                      </div>
                      <div>
                        <span className="font-bold text-xs text-slate-900 dark:text-white block">🎟️ Kode Voucher</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal leading-tight block mt-0.5">
                          Kasir wajib memasukkan kode kupon unik
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormPromoType("manual_select")}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        formPromoType === "manual_select"
                          ? "border-emerald-500 bg-emerald-500/10 shadow-xs"
                          : "border-slate-200 dark:border-[#38383C] hover:bg-slate-50 dark:hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <Hand className={`w-4 h-4 ${formPromoType === "manual_select" ? "text-emerald-500" : "text-slate-400"}`} />
                        {formPromoType === "manual_select" && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                      </div>
                      <div>
                        <span className="font-bold text-xs text-slate-900 dark:text-white block">🖐️ Pilihan Kasir</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal leading-tight block mt-0.5">
                          Ditampilkan sebagai opsi diskon klik kasir
                        </span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Reward Value & Reward Type */}
                <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-[#38383C] bg-slate-50/50 dark:bg-white/[0.02] space-y-3.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Bentuk & Nilai Potongan
                    </Label>
                    <div className="inline-flex p-1 bg-slate-200/80 dark:bg-[#1A1A1E] rounded-xl border border-slate-300/70 dark:border-dark-border">
                      <button
                        type="button"
                        onClick={() => setFormRewardType("discount_pct")}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          formRewardType === "discount_pct"
                            ? "bg-white dark:bg-[#2A2A2E] text-slate-900 dark:text-white shadow-xs"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                      >
                        <Percent className="w-3 h-3" />
                        <span>Persen (%)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormRewardType("discount_fixed")}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          formRewardType === "discount_fixed"
                            ? "bg-white dark:bg-[#2A2A2E] text-slate-900 dark:text-white shadow-xs"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                      >
                        <Coins className="w-3 h-3" />
                        <span>Nominal (Rp)</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    <div>
                      <Label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                        {formRewardType === "discount_pct" ? "Besar Persentase Diskon" : "Besar Potongan Tunai"}
                      </Label>
                      {formRewardType === "discount_pct" ? (
                        <div className="relative flex items-center">
                          <Input
                            type="number"
                            min="1"
                            max="100"
                            value={formRewardValue}
                            onChange={(e) => setFormRewardValue(Number(e.target.value) || 0)}
                            className="h-10 text-xs font-bold rounded-xl pr-8"
                            required
                          />
                          <span className="absolute right-3 text-slate-400 font-bold text-xs">%</span>
                        </div>
                      ) : (
                        <CurrencyInput
                          value={formRewardValue}
                          onChange={(val) => setFormRewardValue(val)}
                          placeholder="0"
                          className="h-10 text-xs font-bold rounded-xl"
                        />
                      )}
                    </div>

                    {formRewardType === "discount_pct" && (
                      <div>
                        <div className="flex items-center gap-1 mb-1">
                          <Label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                            Maksimal Diskon (Cap Limit)
                          </Label>
                          <Tooltip>
                            <TooltipTrigger type="button" tabIndex={-1}>
                              <HelpCircle className="w-3 h-3 text-slate-400" />
                            </TooltipTrigger>
                            <TooltipContent className="text-xs max-w-xs">
                              Batas atas rupiah potongan harga agar tidak melampaui margin keuntungan.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <CurrencyInput
                          value={formMaxCap}
                          onChange={(val) => setFormMaxCap(val)}
                          placeholder="0 (Tanpa batas)"
                          className="h-10 text-xs rounded-xl"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Target Scope Selection (3 Styled Cards like Trigger Type) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {t.promoTargetScopeLabel || "Sasaran Penerapan Promo"}
                    </Label>
                    <Tooltip>
                      <TooltipTrigger type="button" tabIndex={-1}>
                        <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                      </TooltipTrigger>
                      <TooltipContent className="text-xs max-w-xs">
                        Pilih apakah potongan dihitung dari total nota keseluruhan, atau hanya item/kategori produk tertentu.
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (formTargetScope !== "entire_order") {
                          setFormTargetScope("entire_order");
                          setFormTargetIDs([]);
                        }
                      }}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        formTargetScope === "entire_order"
                          ? "border-brand-purple bg-brand-purple/10 dark:border-primary dark:bg-primary/10 shadow-xs"
                          : "border-slate-200 dark:border-[#38383C] hover:bg-slate-50 dark:hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <Receipt className={`w-4 h-4 ${formTargetScope === "entire_order" ? "text-brand-purple dark:text-primary" : "text-slate-400"}`} />
                        {formTargetScope === "entire_order" && <Check className="w-4 h-4 text-brand-purple dark:text-primary stroke-[2.5]" />}
                      </div>
                      <div>
                        <span className="font-bold text-xs text-slate-900 dark:text-white block">Seluruh Transaksi</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal leading-tight block mt-0.5">
                          Potongan dihitung dari total nominal nota kasir
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (formTargetScope !== "specific_items") {
                          setFormTargetScope("specific_items");
                          setFormTargetIDs([]);
                          setIsTargetModalOpen(true);
                        } else if (formTargetIDs.length === 0) {
                          setIsTargetModalOpen(true);
                        }
                      }}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        formTargetScope === "specific_items"
                          ? "border-brand-purple bg-brand-purple/10 dark:border-primary dark:bg-primary/10 shadow-xs"
                          : "border-slate-200 dark:border-[#38383C] hover:bg-slate-50 dark:hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <ShoppingBag className={`w-4 h-4 ${formTargetScope === "specific_items" ? "text-brand-purple dark:text-primary" : "text-slate-400"}`} />
                        {formTargetScope === "specific_items" && <Check className="w-4 h-4 text-brand-purple dark:text-primary stroke-[2.5]" />}
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-900 dark:text-white block">Item Produk Tertentu</span>
                          {formTargetScope === "specific_items" && formTargetIDs.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded-md bg-brand-purple text-white dark:bg-[#E2FF66] dark:text-slate-900 text-[10px] font-bold">
                              {formTargetIDs.length}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal leading-tight block mt-0.5">
                          Hanya berlaku untuk produk SKU spesifik
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (formTargetScope !== "specific_categories") {
                          setFormTargetScope("specific_categories");
                          setFormTargetIDs([]);
                          setIsTargetModalOpen(true);
                        } else if (formTargetIDs.length === 0) {
                          setIsTargetModalOpen(true);
                        }
                      }}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        formTargetScope === "specific_categories"
                          ? "border-brand-purple bg-brand-purple/10 dark:border-primary dark:bg-primary/10 shadow-xs"
                          : "border-slate-200 dark:border-[#38383C] hover:bg-slate-50 dark:hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <FolderTree className={`w-4 h-4 ${formTargetScope === "specific_categories" ? "text-brand-purple dark:text-primary" : "text-slate-400"}`} />
                        {formTargetScope === "specific_categories" && <Check className="w-4 h-4 text-brand-purple dark:text-primary stroke-[2.5]" />}
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-900 dark:text-white block">Kategori Tertentu</span>
                          {formTargetScope === "specific_categories" && formTargetIDs.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded-md bg-brand-purple text-white dark:bg-[#E2FF66] dark:text-slate-900 text-[10px] font-bold">
                              {formTargetIDs.length}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal leading-tight block mt-0.5">
                          Berlaku untuk semua menu dalam kategori
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Summary of Selected Target Items / Categories with Modal Launcher & Reset Button */}
                  {formTargetScope !== "entire_order" && (
                    <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-[#38383C] bg-slate-50/60 dark:bg-white/[0.02] space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {formTargetScope === "specific_items" ? `Produk Terpilih (${formTargetIDs.length})` : `Kategori Terpilih (${formTargetIDs.length})`}
                            </span>
                            {formTargetIDs.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setFormTargetIDs([])}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 transition-colors cursor-pointer px-1.5 py-0.5 rounded-md hover:bg-rose-500/10"
                                title="Hapus semua pilihan"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Reset</span>
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 font-normal">
                            {formTargetIDs.length === 0 ? "Belum ada yang dipilih. Klik tombol di kanan untuk memilih." : "Daftar sasaran yang mendapatkan potongan harga promo ini."}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setTargetSearchQuery("");
                            setIsTargetModalOpen(true);
                          }}
                          className="px-3.5 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs rounded-xl shadow-xs hover:opacity-90 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>{formTargetIDs.length === 0 ? "Pilih Sasaran" : "Ubah Pilihan"}</span>
                        </button>
                      </div>

                      {/* Pill Badge List of Selected Items */}
                      {formTargetIDs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pt-1 scrollbar-thin">
                          {formTargetScope === "specific_items"
                            ? itemsList
                                .filter((i) => formTargetIDs.includes(i.id))
                                .map((item) => (
                                  <span
                                    key={item.id}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-[#1E1E22] border border-slate-200 dark:border-[#38383C] text-slate-700 dark:text-slate-200 text-xs font-medium shadow-2xs"
                                  >
                                    <span className="truncate max-w-[200px]">{item.name}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveTarget(item.id)}
                                      className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </span>
                                ))
                            : categoriesList
                                .filter((c) => formTargetIDs.includes(c.id))
                                .map((cat) => (
                                  <span
                                    key={cat.id}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-[#1E1E22] border border-slate-200 dark:border-[#38383C] text-slate-700 dark:text-slate-200 text-xs font-medium shadow-2xs"
                                  >
                                    <span>{cat.name}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveTarget(cat.id)}
                                      className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </span>
                                ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* CARD 2: Syarat & Batasan Belanja */}
              <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] space-y-4 shadow-xs">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-white/5">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                    <Percent className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      2. Syarat Transaksi & Kuota Klaim
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Tentukan ambang minimum pembelian dan limit total penggunaan promo.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {t.promoMinOrderLabel || "Min. Belanja (Rp)"}
                    </Label>
                    <CurrencyInput
                      value={formMinOrder}
                      onChange={(val) => setFormMinOrder(val)}
                      placeholder="0 (Tanpa minimum)"
                      className="h-10 text-xs rounded-xl"
                    />
                    <p className="text-[10px] text-slate-400 font-normal">
                      0 = promo aktif tanpa batasan nilai nota
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {t.promoMinQtyLabel || "Min. Kuantitas (Pcs)"}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={formMinQty}
                      onChange={(e) => setFormMinQty(parseInt(e.target.value) || 0)}
                      placeholder="0 (Tanpa batas)"
                      className="h-10 text-xs rounded-xl"
                    />
                    <p className="text-[10px] text-slate-400 font-normal">
                      Contoh: minimal beli 2 pcs/porsi
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {t.promoUsageLimitLabel || "Batas Kuota Promo"}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={formUsageLimit}
                      onChange={(e) => setFormUsageLimit(parseInt(e.target.value) || 0)}
                      placeholder="0 (Tak terbatas)"
                      className="h-10 text-xs rounded-xl"
                    />
                    <p className="text-[10px] text-slate-400 font-normal">
                      Maks total klaim oleh seluruh kasir
                    </p>
                  </div>
                </div>
              </div>

              {/* CARD 3: Waktu, Hari & Jadwal */}
              <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] space-y-5 shadow-xs">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-white/5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      3. Jadwal Tayang & Happy Hour
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Atur hari aktif, tanggal kadaluarsa promo, dan jam khusus (Happy Hour).
                    </p>
                  </div>
                </div>

                {/* Days selection (Centered layout with sleek Segmented Control Presets & Circular Buttons) */}
                <div className="space-y-4 pt-1">
                  <div className="text-center space-y-1">
                    <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      Hari Aktif Promo
                    </Label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                      Pilih preset jadwal atau klik / tahan geser (hold & drag) lingkaran hari di bawah.
                    </p>
                  </div>

                  {/* Sleek Segmented Control Presets (Centered) */}
                  <div className="flex justify-center">
                    <div className="inline-flex p-1 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/10 gap-1 shadow-2xs max-w-full overflow-x-auto">
                      <button
                        type="button"
                        onClick={() => handleSetDayPreset("all")}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                          activeDayPreset === "all"
                            ? "bg-white dark:bg-[#2A2A2E] text-slate-900 dark:text-white shadow-xs"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        Setiap Hari
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetDayPreset("weekdays")}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                          activeDayPreset === "weekdays"
                            ? "bg-white dark:bg-[#2A2A2E] text-slate-900 dark:text-white shadow-xs"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        Sen - Jum
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetDayPreset("weekends")}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                          activeDayPreset === "weekends"
                            ? "bg-white dark:bg-[#2A2A2E] text-slate-900 dark:text-white shadow-xs"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        Sab - Min
                      </button>
                      <button
                        type="button"
                        disabled
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-default whitespace-nowrap ${
                          activeDayPreset === "custom"
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                            : "opacity-40 text-slate-400"
                        }`}
                      >
                        Kustom
                      </button>
                    </div>
                  </div>

                  {/* Centered Circular Day Buttons */}
                  <div className="flex items-center justify-center gap-2 sm:gap-3 select-none pt-1">
                    {daysLabels.map((d) => {
                      const isSelected = formActiveDays.includes(d.idx);
                      return (
                        <button
                          key={d.idx}
                          type="button"
                          onMouseDown={() => handleDayMouseDown(d.idx)}
                          onMouseEnter={() => handleDayMouseEnter(d.idx)}
                          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center select-none shadow-xs ${
                            isSelected
                              ? "bg-brand-purple text-white dark:bg-[#E2FF66] dark:text-slate-900 ring-2 ring-brand-purple/30 dark:ring-[#E2FF66]/40 scale-105"
                              : "border border-slate-200 dark:border-[#38383C] text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 opacity-70 hover:opacity-100"
                          }`}
                        >
                          <span>{d.short}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date & Happy Hour Switches (Always Visible, Disabled When Switch is Off) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className={`p-4 rounded-2xl border transition-all space-y-3 ${
                    hasEndDate 
                      ? "border-slate-200/80 dark:border-[#38383C] bg-white dark:bg-[#1E1E22]" 
                      : "border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01]"
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Batas Tanggal Promo
                        </Label>
                        <p className="text-[10px] text-slate-400 font-normal">
                          {hasEndDate ? "Promo memiliki rentang tanggal aktif" : "Promo berlaku permanen selamanya"}
                        </p>
                      </div>
                      <Switch checked={hasEndDate} onCheckedChange={setHasEndDate} />
                    </div>

                    <div className="space-y-2 pt-1">
                      <div>
                        <Label className="text-[11px] text-slate-600 dark:text-slate-400 block mb-1">
                          Tanggal Mulai
                        </Label>
                        <Input
                          type="date"
                          value={formStartDate}
                          onChange={(e) => setFormStartDate(e.target.value)}
                          className="h-9 text-xs rounded-xl"
                          required
                        />
                      </div>
                      <div>
                        <Label className={`text-[11px] block mb-1 ${hasEndDate ? "text-slate-600 dark:text-slate-400" : "text-slate-400/70 dark:text-slate-500"}`}>
                          Tanggal Selesai {hasEndDate ? "" : "(Nonaktif - Permanen)"}
                        </Label>
                        <Input
                          type="date"
                          value={formEndDate}
                          disabled={!hasEndDate}
                          onChange={(e) => setFormEndDate(e.target.value)}
                          className={`h-9 text-xs rounded-xl transition-all ${
                            !hasEndDate ? "opacity-40 bg-slate-100 dark:bg-white/5 cursor-not-allowed border-dashed" : ""
                          }`}
                          required={hasEndDate}
                        />
                      </div>
                    </div>
                  </div>

                  <div className={`p-4 rounded-2xl border transition-all space-y-3 ${
                    hasHappyHour 
                      ? "border-slate-200/80 dark:border-[#38383C] bg-white dark:bg-[#1E1E22]" 
                      : "border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01]"
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Happy Hour (Jam Khusus)
                        </Label>
                        <p className="text-[10px] text-slate-400 font-normal">
                          {hasHappyHour ? "Aktif di jam tertentu per hari" : "Aktif 24 jam sepanjang hari"}
                        </p>
                      </div>
                      <Switch checked={hasHappyHour} onCheckedChange={setHasHappyHour} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <Label className={`text-[11px] block mb-1 ${hasHappyHour ? "text-slate-600 dark:text-slate-400" : "text-slate-400/70 dark:text-slate-500"}`}>
                          Jam Mulai {hasHappyHour ? "" : "(24 Jam)"}
                        </Label>
                        <Input
                          type="time"
                          value={formTimeStart}
                          disabled={!hasHappyHour}
                          onChange={(e) => setFormTimeStart(e.target.value)}
                          className={`h-9 text-xs rounded-xl transition-all ${
                            !hasHappyHour ? "opacity-40 bg-slate-100 dark:bg-white/5 cursor-not-allowed border-dashed" : ""
                          }`}
                          required={hasHappyHour}
                        />
                      </div>
                      <div>
                        <Label className={`text-[11px] block mb-1 ${hasHappyHour ? "text-slate-600 dark:text-slate-400" : "text-slate-400/70 dark:text-slate-500"}`}>
                          Jam Selesai {hasHappyHour ? "" : "(24 Jam)"}
                        </Label>
                        <Input
                          type="time"
                          value={formTimeEnd}
                          disabled={!hasHappyHour}
                          onChange={(e) => setFormTimeEnd(e.target.value)}
                          className={`h-9 text-xs rounded-xl transition-all ${
                            !hasHappyHour ? "opacity-40 bg-slate-100 dark:bg-white/5 cursor-not-allowed border-dashed" : ""
                          }`}
                          required={hasHappyHour}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </fieldset>

            {/* Right Column: Live POS Receipt Preview & Status (4 Cols) */}
            <div className="lg:col-span-4 space-y-5 sticky top-6">
              {/* Status Activation Toggle Card */}
              <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] flex items-center justify-between shadow-xs">
                <div>
                  <span className="font-extrabold text-xs text-slate-900 dark:text-white block">
                    Status Operasional Promo
                  </span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    {formIsActive ? "Aktif dan dapat dipakai di kasir" : "Di-nonaktifkan sementara"}
                  </span>
                </div>
                <Switch checked={formIsActive} onCheckedChange={setFormIsActive} disabled={isReadOnly || !isPromoAdmin} />
              </div>

              {/* POS Cashier Receipt Simulation Card */}
              <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] space-y-4 shadow-sm">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-white/5">
                  <Receipt className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Live Cashier Preview
                  </span>
                </div>

                {/* Voucher Ticket UI */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-purple/10 via-purple-500/5 to-transparent dark:from-primary/10 dark:via-transparent border border-brand-purple/20 dark:border-primary/20 space-y-3 relative overflow-hidden">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-extrabold font-mono tracking-widest text-brand-purple dark:text-primary uppercase block">
                        {formPromoType === "automatic" ? "⚡ AUTO DISCOUNT" : formPromoType === "coupon_code" ? `🎟️ VOUCHER ${formCode || "CODE"}` : "🖐️ CASHIER DISCOUNT"}
                      </span>
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight mt-0.5">
                        {formName.trim() || "Nama Diskon / Promosi"}
                      </h4>
                    </div>
                    <div className="px-2.5 py-1 rounded-xl bg-brand-purple text-white dark:bg-[#E2FF66] dark:text-slate-900 font-extrabold text-xs shrink-0 shadow-xs">
                      {formRewardType === "discount_pct" ? `${formRewardValue}% OFF` : `Rp ${(formRewardValue || 0).toLocaleString("id-ID")}`}
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1 pt-1 border-t border-slate-200/60 dark:border-white/5">
                    <div className="flex justify-between">
                      <span>Cakupan:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {formTargetScope === "entire_order" ? "Total Belanja" : formTargetScope === "specific_items" ? `${formTargetIDs.length} Item Terpilih` : `${formTargetIDs.length} Kategori`}
                      </span>
                    </div>
                    {formMinOrder > 0 && (
                      <div className="flex justify-between">
                        <span>Min. Belanja:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          Rp {formMinOrder.toLocaleString("id-ID")}
                        </span>
                      </div>
                    )}
                    {formMaxCap > 0 && formRewardType === "discount_pct" && (
                      <div className="flex justify-between">
                        <span>Maks. Potongan:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          Rp {formMaxCap.toLocaleString("id-ID")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Struk Kasir Simulator */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200/80 dark:border-white/5 font-mono text-[11px] space-y-2 text-slate-600 dark:text-slate-400">
                  <div className="text-center pb-2 border-b border-dashed border-slate-300 dark:border-white/10">
                    <p className="font-bold text-slate-800 dark:text-slate-200">STRUK SIMULASI POS</p>
                  </div>
                  <div className="flex justify-between">
                    <span>Subtotal Simulasi</span>
                    <span>Rp 100.000</span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-600 dark:text-primary">
                    <span className="truncate pr-2">Disc ({formName.trim() || "Promo"})</span>
                    <span>- Rp {formRewardType === "discount_pct" ? Math.min(formMaxCap > 0 ? formMaxCap : 100000, 100000 * (formRewardValue / 100)).toLocaleString("id-ID") : Math.min(100000, formRewardValue).toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex justify-between font-black text-slate-900 dark:text-white pt-2 border-t border-dashed border-slate-300 dark:border-white/10">
                    <span>TOTAL BAYAR</span>
                    <span>Rp {(100000 - (formRewardType === "discount_pct" ? Math.min(formMaxCap > 0 ? formMaxCap : 100000, 100000 * (formRewardValue / 100)) : Math.min(100000, formRewardValue))).toLocaleString("id-ID")}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* TARGET SELECTION MODAL DIALOG (LARGE, DUAL VIEW & PILL LAYOUT)  */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* TARGET SELECTION MODAL DIALOG (LARGE, DUAL VIEW & PILL LAYOUT)  */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <Dialog open={isTargetModalOpen} onOpenChange={setIsTargetModalOpen}>
            <DialogContent className="max-w-4xl max-h-[85vh] rounded-3xl p-6 bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#38383C] shadow-2xl flex flex-col gap-4 overflow-hidden">
              <DialogHeader className="text-left pb-3 border-b border-slate-100 dark:border-white/5 space-y-1 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-brand-purple dark:text-primary flex items-center justify-center shrink-0">
                    {formTargetScope === "specific_items" ? <ShoppingBag className="w-5 h-5" /> : <FolderTree className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-base font-black text-slate-900 dark:text-white leading-tight">
                      {formTargetScope === "specific_items" ? "Pilih Produk Promo" : "Pilih Kategori Promo"}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {formTargetScope === "specific_items"
                        ? `${filteredTargetItems.length} produk tersedia • Tahan & geser (drag) kursor untuk multi-pilih cepat`
                        : `${filteredTargetCategories.length} kategori tersedia • Tahan & geser (drag) kursor untuk multi-pilih cepat`}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {/* Search Bar & Actions Bar with Standard ErpSearchBar & Icon-Only View Switcher */}
              <div className="space-y-2.5 shrink-0">
                <ErpSearchBar
                  value={targetSearchQuery}
                  onChange={setTargetSearchQuery}
                  placeholder={formTargetScope === "specific_items" ? "Cari nama produk, SKU (Barcode), atau kategori..." : "Cari nama kategori..."}
                  size="sm"
                  enableShortcut={true}
                />

                <div className="flex items-center justify-between text-xs font-bold px-1">
                  {/* Left: View Mode Toggle for Items (Icon only, no text) */}
                  <div>
                    {formTargetScope === "specific_items" ? (
                      <div className="inline-flex p-0.5 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200/80 dark:border-white/10">
                        <button
                          type="button"
                          onClick={() => setTargetViewMode("grid")}
                          className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                            targetViewMode === "grid"
                              ? "bg-white dark:bg-[#2A2A2E] text-slate-900 dark:text-white shadow-xs"
                              : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          }`}
                          title="Tampilan Grid"
                        >
                          <LayoutGrid className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setTargetViewMode("list")}
                          className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                            targetViewMode === "list"
                              ? "bg-white dark:bg-[#2A2A2E] text-slate-900 dark:text-white shadow-xs"
                              : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          }`}
                          title="Tampilan List"
                        >
                          <List className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-normal">
                        Klik atau tahan geser pill kategori di bawah:
                      </span>
                    )}
                  </div>

                  {/* Right: Select All & Deselect Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectAllTargets(true)}
                      className="text-brand-purple dark:text-primary hover:underline cursor-pointer"
                    >
                      Pilih Semua
                    </button>
                    <span className="text-slate-300 dark:text-slate-600">|</span>
                    <button
                      type="button"
                      onClick={() => handleSelectAllTargets(false)}
                      className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                    >
                      Kosongkan Pilihan
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Body: Scrollable Content with Grid / List / Centered Category Pills with Drag-to-Select */}
              <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin select-none min-h-[300px] max-h-[50vh]">
                {formTargetScope === "specific_items" ? (
                  filteredTargetItems.length > 0 ? (
                    targetViewMode === "grid" ? (
                      /* ─── GRID MODE: Image + Details Card with Drag-to-Select ─── */
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-1">
                        {filteredTargetItems.map((item) => {
                          const isSelected = formTargetIDs.includes(item.id);
                          return (
                            <div
                              key={item.id}
                              onMouseDown={() => handleItemMouseDown(item.id)}
                              onMouseEnter={() => handleItemMouseEnter(item.id)}
                              className={`group relative p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between overflow-hidden select-none ${
                                isSelected
                                  ? "bg-brand-purple/10 border-brand-purple dark:bg-primary/10 dark:border-primary shadow-xs ring-2 ring-brand-purple/30 dark:ring-primary/30"
                                  : "bg-white dark:bg-[#1A1A1E] border-slate-200 dark:border-[#38383C] hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-2xs"
                              }`}
                            >
                              {/* Selection Indicator Top-Right */}
                              <div className="absolute top-2.5 right-2.5 z-10 pointer-events-none">
                                <div
                                  className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all ${
                                    isSelected
                                      ? "bg-brand-purple text-white dark:bg-[#E2FF66] dark:text-slate-900 shadow-xs"
                                      : "bg-black/10 dark:bg-white/10 text-transparent group-hover:bg-slate-200 dark:group-hover:bg-white/20"
                                  }`}
                                >
                                  <Check className={`w-3.5 h-3.5 stroke-[3] ${isSelected ? "opacity-100" : "opacity-0"}`} />
                                </div>
                              </div>

                              {/* Thumbnail Image Container */}
                              <div className="w-full aspect-square rounded-xl bg-slate-100 dark:bg-white/5 mb-2.5 overflow-hidden flex items-center justify-center border border-slate-100 dark:border-white/5 relative pointer-events-none">
                                {item.image_url ? (
                                  <img
                                    src={getImageUrl(item.image_url)}
                                    alt={item.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <ImageIcon className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                                )}
                              </div>

                              {/* Item Details */}
                              <div className="min-w-0 space-y-1 pointer-events-none">
                                {item.category_name && (
                                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 truncate max-w-full">
                                    {item.category_name}
                                  </span>
                                )}
                                <h5 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-2 leading-tight">
                                  {item.name}
                                </h5>
                                {item.sku && (
                                  <p className="text-[10px] font-mono text-slate-400 truncate">
                                    {item.sku}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* ─── LIST MODE: Grab/Drag to Select with Mouse Enter ─── */
                      <div className="space-y-1.5 p-1">
                        <div className="px-2 py-1 bg-purple-500/5 dark:bg-primary/5 rounded-xl border border-purple-500/10 text-[11px] text-brand-purple dark:text-primary font-medium mb-2 flex items-center justify-between">
                          <span>💡 Tahan klik & geser mouse melintasi item untuk multi-select cepat.</span>
                          {isItemDragging && (
                            <span className="font-bold animate-pulse text-[10px] uppercase">
                              Mode: {itemDragMode === "select" ? "Memilih..." : "Membatalkan..."}
                            </span>
                          )}
                        </div>

                        {filteredTargetItems.map((item) => {
                          const isSelected = formTargetIDs.includes(item.id);
                          return (
                            <div
                              key={item.id}
                              onMouseDown={() => handleItemMouseDown(item.id)}
                              onMouseEnter={() => handleItemMouseEnter(item.id)}
                              className={`p-2.5 rounded-xl border cursor-pointer flex items-center justify-between text-xs transition-all select-none ${
                                isSelected
                                  ? "bg-brand-purple/10 border-brand-purple dark:bg-primary/10 dark:border-primary text-slate-900 dark:text-white font-bold shadow-2xs"
                                  : "bg-white dark:bg-[#1A1A1E] border-slate-200/80 dark:border-[#38383C] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0 pr-2 pointer-events-none">
                                {/* Small Thumbnail */}
                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center shrink-0 overflow-hidden border border-slate-200/50 dark:border-white/5">
                                  {item.image_url ? (
                                    <img
                                      src={getImageUrl(item.image_url)}
                                      alt={item.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = "none";
                                      }}
                                    />
                                  ) : (
                                    <ImageIcon className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate block font-bold text-slate-900 dark:text-white">
                                      {item.name}
                                    </span>
                                    {item.category_name && (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 shrink-0">
                                        {item.category_name}
                                      </span>
                                    )}
                                  </div>
                                  {item.sku && (
                                    <span className="text-[10px] text-slate-400 font-mono block">
                                      SKU: {item.sku}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="shrink-0 pl-2 pointer-events-none">
                                {isSelected ? (
                                  <div className="w-5 h-5 rounded-md bg-brand-purple dark:bg-[#E2FF66] text-white dark:text-slate-900 flex items-center justify-center shadow-2xs">
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  </div>
                                ) : (
                                  <div className="w-5 h-5 rounded-md border border-slate-300 dark:border-white/20" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : (
                    <div className="py-16 text-center text-xs text-slate-400">
                      Tidak ada produk yang cocok dengan pencarian "{targetSearchQuery}"
                    </div>
                  )
                ) : (
                  /* ─── CATEGORY MODE: Centered Interactive Pill Badges with Drag-to-Select ─── */
                  filteredTargetCategories.length > 0 ? (
                    <div className="space-y-4 p-3">
                      <div className="flex flex-wrap justify-center items-center gap-2.5 max-w-2xl mx-auto">
                        {filteredTargetCategories.map((cat) => {
                          const isSelected = formTargetIDs.includes(cat.id);
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onMouseDown={() => handleItemMouseDown(cat.id)}
                              onMouseEnter={() => handleItemMouseEnter(cat.id)}
                              className={`group inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border transition-all cursor-pointer shadow-2xs select-none ${
                                isSelected
                                  ? "bg-brand-purple text-white dark:bg-[#E2FF66] dark:text-slate-900 border-brand-purple dark:border-[#E2FF66] shadow-sm scale-105"
                                  : "bg-white dark:bg-[#1A1A1E] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#38383C] hover:bg-slate-50 dark:hover:bg-white/10 hover:border-slate-300"
                              }`}
                            >
                              <FolderTree className={`w-3.5 h-3.5 ${isSelected ? "text-white dark:text-slate-900" : "text-slate-400"}`} />
                              <span>{cat.name}</span>
                              {isSelected ? (
                                <Check className="w-3.5 h-3.5 stroke-[3] text-white dark:text-slate-900 ml-0.5" />
                              ) : (
                                <Plus className="w-3 h-3 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 ml-0.5" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="py-16 text-center text-xs text-slate-400">
                      Tidak ada kategori yang cocok dengan pencarian "{targetSearchQuery}"
                    </div>
                  )
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/5 shrink-0">
                <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  <span className="text-brand-purple dark:text-primary font-black">{formTargetIDs.length}</span> {formTargetScope === "specific_items" ? "produk" : "kategori"} terpilih
                </div>
                <button
                  type="button"
                  onClick={() => setIsTargetModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl bg-brand-purple hover:bg-brand-purple-hover dark:bg-[#E2FF66] dark:text-slate-900 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer"
                >
                  Selesai Memilih
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </TooltipProvider>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // RENDER: LIST VIEW (KPI SUMMARY + FILTERS + FRAMELESS TABLE)
  // ══════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      {/* 1. Frameless Page Header (GEMINI.md rule 17) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200/80 dark:border-[#2E2E34] gap-4">
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500">
              <Tag className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                {t.promotionsTitle || "Master Diskon & Promosi"}
              </h1>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t.promotionsDesc || "Kelola program promo terencana, diskon bertingkat, voucher kupon, dan penetapan harga periode."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {!isPromoAdmin && (
            <span className="px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 font-bold text-xs flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              {t.itemsReadOnlyBadge || "Mode Baca (Read-Only)"}
            </span>
          )}
          {isPromoAdmin && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-purple hover:bg-brand-purple-hover dark:bg-[#E2FF66] dark:text-slate-900 text-white font-bold text-xs rounded-2xl shadow-md transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{t.promoCreateNew || "Buat Program Promo"}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Interactive KPI Summary Metric Strip (Quick Filters) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-left">
        <button
          type="button"
          onClick={() => setQuickKpiFilter("all")}
          className={`p-4 rounded-3xl border shadow-xs text-left transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] ${
            quickKpiFilter === "all"
              ? "ring-2 ring-brand-purple dark:ring-[#E2FF66] bg-purple-50/40 dark:bg-white/5 border-transparent shadow-sm"
              : "bg-white dark:bg-[#1E1E22] border-slate-200/80 dark:border-[#2E2E34]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Total Program</span>
            <div className="w-7 h-7 rounded-xl bg-purple-500/10 text-brand-purple dark:text-primary flex items-center justify-center">
              <Tag className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {kpiMetrics.total}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Semua program terdaftar</p>
        </button>

        <button
          type="button"
          onClick={() => setQuickKpiFilter((prev) => (prev === "active_today" ? "all" : "active_today"))}
          className={`p-4 rounded-3xl border shadow-xs text-left transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] ${
            quickKpiFilter === "active_today"
              ? "ring-2 ring-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 border-transparent shadow-sm"
              : "bg-white dark:bg-[#1E1E22] border-slate-200/80 dark:border-[#2E2E34]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Live Hari Ini</span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-primary mt-1">
            {kpiMetrics.activeToday}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Siap klaim di kasir POS</p>
        </button>

        <button
          type="button"
          onClick={() => setQuickKpiFilter((prev) => (prev === "coupon" ? "all" : "coupon"))}
          className={`p-4 rounded-3xl border shadow-xs text-left transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] ${
            quickKpiFilter === "coupon"
              ? "ring-2 ring-blue-500 bg-blue-50/40 dark:bg-blue-950/20 border-transparent shadow-sm"
              : "bg-white dark:bg-[#1E1E22] border-slate-200/80 dark:border-[#2E2E34]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Voucher Kupon</span>
            <div className="w-7 h-7 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Ticket className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {kpiMetrics.couponCount}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Kupon dengan kode unik</p>
        </button>

        <button
          type="button"
          onClick={() => setQuickKpiFilter((prev) => (prev === "claims" ? "all" : "claims"))}
          className={`p-4 rounded-3xl border shadow-xs text-left transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] ${
            quickKpiFilter === "claims"
              ? "ring-2 ring-amber-500 bg-amber-50/40 dark:bg-amber-950/20 border-transparent shadow-sm"
              : "bg-white dark:bg-[#1E1E22] border-slate-200/80 dark:border-[#2E2E34]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Total Klaim Terpakai</span>
            <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {kpiMetrics.totalClaims.toLocaleString("id-ID")}x
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Total transaksi terdiskon</p>
        </button>
      </div>

      {/* 3. Control Bar (Search & Unified 1-Popup Multi-Column Filter standard ala Master Item) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search Bar */}
        <div className="flex-1">
          <ErpSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Cari program promo, kode kupon, atau SKU... (Ketik '/' untuk cari)"
          />
        </div>

        {/* Unified Reusable Popup Filter Component */}
        <ErpFilterPopover
          activeCount={activeFilterCount}
          onResetAll={handleResetFilters}
          title="Filter Kriteria Program Promosi"
          resetLabel="Reset Filter"
          filterButtonLabel="Filter Promo"
          columnGroups={[
            {
              id: "promo_type",
              title: "Tipe & Trigger Promo",
              type: "multi",
              selectedValues: selectedTypes,
              onToggleMulti: (key) => {
                setSelectedTypes((prev) =>
                  prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
                );
              },
              options: [
                { key: "automatic", label: "Diskon Otomatis (Keranjang)" },
                { key: "coupon_code", label: "Voucher Kupon (Kode)" },
                { key: "manual_select", label: "Pilihan Kasir (POS)" },
              ],
            },
            {
              id: "target_scope",
              title: "Sasaran Promo",
              type: "multi",
              selectedValues: selectedScopes,
              onToggleMulti: (key) => {
                setSelectedScopes((prev) =>
                  prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
                );
              },
              options: [
                { key: "entire_order", label: "Seluruh Transaksi (Total Nota)" },
                { key: "specific_items", label: "Item Produk Khusus" },
                { key: "specific_categories", label: "Kategori Produk Khusus" },
              ],
            },
            {
              id: "reward_type",
              title: "Bentuk Potongan",
              type: "multi",
              selectedValues: selectedRewards,
              onToggleMulti: (key) => {
                setSelectedRewards((prev) =>
                  prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
                );
              },
              options: [
                { key: "discount_pct", label: "% Persentase Diskon" },
                { key: "discount_fixed", label: "Rp Potongan Tunai (Nominal)" },
              ],
            },
            {
              id: "status",
              title: "Status Operasional",
              type: "multi",
              selectedValues: selectedStatuses,
              onToggleMulti: (key) => {
                setSelectedStatuses((prev) =>
                  prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
                );
              },
              options: [
                { key: "active", label: "Aktif di Master" },
                { key: "live", label: "Live & Siap Klaim Sekarang" },
                { key: "inactive", label: "Dijeda / Nonaktif" },
              ],
            },
          ]}
        />
      </div>

      {/* 4. Frameless Reusable ErpDataTable */}
      <ErpDataTable
        data={filteredPromos}
        columns={columns}
        keyExtractor={(item) => item.id}
        loading={loading}
        emptyText="Belum ada program promo yang terdaftar untuk kriteria ini"
      />
    </div>
  );
}

export default PromotionsModule;
