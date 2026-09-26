import React, { useState, useEffect, useMemo } from "react";
import { ErpDataTable, type ColumnDef } from "../../components/ErpDataTable";
import { ErpSearchBar } from "../../components/ErpSearchBar";
import { ErpFilterPopover } from "../../components/ErpFilterPopover";
import { CurrencyInput } from "../../components/CurrencyInput";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ErpImage } from "../../components/ErpImage";
import { getImageUrl } from "../../lib/utils";
import { api } from "../../lib/api";
import { toast } from "../../components/ui/sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Checkbox } from "../../components/ui/checkbox";
import { Switch } from "../../components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../../components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../../components/ui/dropdown-menu";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "../../components/ui/popover";
import {
  Plus,
  Package,
  MoreVertical,
  Edit2,
  Copy,
  Tag,
  Boxes,
  Layers,
  Trash2,
  CheckCircle2,
  XCircle,
  Archive,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Upload,
  Sparkles,
  Barcode,
  DollarSign,
  TrendingUp,
  Snowflake,
  ShieldAlert,
  ShoppingCart,
  Check,
  AlertTriangle,
  X,
  Eye,
  Calculator,
  Wand2,
  SlidersHorizontal,
  Filter,
  RotateCcw,
  ChefHat,
  Truck,
  HelpCircle,
} from "lucide-react";
import { useLanguageStore, translations } from "../../lib/i18n";
import { useAuthStore } from "../../lib/store";

export interface UnifiedItem {
  id: string;
  business_id: string;
  category_id?: string;
  sku?: string;
  name: string;
  item_type: "finished_good" | "semi_finished" | "raw_material" | "consumable" | "fixed_tool";
  is_sellable: boolean;
  is_inventory_tracked: boolean;
  is_tracking_stock?: boolean;
  is_produced?: boolean;
  is_purchasable?: boolean;
  is_thawable?: boolean;
  requires_thaw?: boolean;
  base_unit: string;
  price_unit?: string;
  box_unit: string;
  conversion_rate: number;
  sell_price: number;
  box_sell_price: number;
  standard_cost: number;
  min_stock_alert?: number;
  status: string;
  category_name?: string;
  image_url?: string;
  qty_sealed: number;
  qty_loose: number;
}

export interface Category {
  id: string;
  name: string;
  category_type?: "finished_good" | "raw_material" | "consumable" | "fixed_tool";
  item_count?: number;
}

export interface ItemListModuleProps {
  initialView?: "master" | "new" | "wizard" | "edit";
  initialItem?: UnifiedItem | null;
  onNavigate?: (view: string) => void;
}

export function ItemListModule({
  initialView = "master",
  initialItem = null,
  onNavigate,
}: ItemListModuleProps) {

  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;
  const { activeContext } = useAuthStore();

  const isStaff = activeContext?.role === "staff" || activeContext?.role === "kasir";
  const isItemAdmin = activeContext?.role === "owner" || activeContext?.role === "superadmin" || activeContext?.role === "admin_gudang";

  // View Navigation: "master" | "new" (form) | "wizard" (step-by-step) | "edit"
  const [currentView, setCurrentView] = useState<"master" | "new" | "wizard" | "edit">(initialView);
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [editingItem, setEditingItem] = useState<UnifiedItem | null>(initialItem);

  useEffect(() => {
    if (initialItem) {
      handleOpenEdit(initialItem);
    } else {
      setCurrentView(initialView);
      setEditingItem(initialItem);
      if (initialView === "wizard") {
        setWizardStep(1);
      }
    }
  }, [initialView, initialItem]);

  // Data State
  const [items, setItems] = useState<UnifiedItem[]>([]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters & Search (Multi-Select Checkboxes inside 1 Popup)
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState<boolean>(false);

  // Category Modal & Deletion Guard
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>("");
  const [newCategoryType, setNewCategoryType] = useState<UnifiedItem["item_type"]>("finished_good");
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState<boolean>(false);

  // Pricing & Kulakan Calculation Helper State
  const [costCalculationMode, setCostCalculationMode] = useState<"unit" | "pack">("unit");
  const [packBuyPrice, setPackBuyPrice] = useState<number>(0);
  const [packFreightExtra, setPackFreightExtra] = useState<number>(0);

  // Predefined Standard Units
  const standardBaseUnits = [
    { value: "pcs", label: "Pcs (Biji / Buah / Batang)" },
    { value: "kg", label: "Kg (Kilogram)" },
    { value: "gram", label: "Gram (gr)" },
    { value: "porsi", label: "Porsi (Hidangan Makanan)" },
    { value: "pack", label: "Pack / Bungkus Kecil" },
    { value: "cup", label: "Cup / Gelas Minuman" },
    { value: "butir", label: "Butir (Telur / Bakso)" },
    { value: "liter", label: "Liter (l)" },
    { value: "ml", label: "Mililiter (ml)" },
    { value: "ikat", label: "Ikat / Unting (Sayuran)" },
    { value: "lembar", label: "Lembar / Helai" },
    { value: "pasang", label: "Pasang" },
    { value: "unit", label: "Unit (Aset / Alat)" },
  ];

  const standardBoxUnits = [
    { value: "kardus", label: "Kardus / Karton (Dus)" },
    { value: "karung", label: "Karung / Sak" },
    { value: "bal", label: "Bal / Balpres" },
    { value: "box", label: "Box / Kontainer" },
    { value: "jerigen", label: "Jerigen" },
    { value: "ikat", label: "Ikat / Bundle Besar" },
    { value: "pack", label: "Pack Besar / Outer" },
    { value: "lusin", label: "Lusin (12 pcs)" },
    { value: "kodi", label: "Kodi (20 pcs)" },
    { value: "gross", label: "Gross (144 pcs)" },
  ];

  // Custom Unit toggle state
  const [isCustomBaseUnit, setIsCustomBaseUnit] = useState<boolean>(false);
  const [isCustomBoxUnit, setIsCustomBoxUnit] = useState<boolean>(false);

  // Dedicated Form State
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    categoryId: "none",
    itemType: "finished_good" as UnifiedItem["item_type"],
    baseUnit: "pcs",
    priceUnit: "base",
    boxUnit: "kardus",
    conversionRate: 1,
    sellPrice: 0,
    boxSellPrice: 0,
    standardCost: 0,
    minStockAlert: 5,
    isSellable: true,
    isInventoryTracked: true,
    isTrackingStock: true,
    isProduced: false,
    isPurchasable: true,
    isThawable: false,
    requiresThaw: false,
    initialStockSealed: 0,
    initialStockLoose: 0,
    status: "active",
    imageUrl: "",
  });

  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [previewImageBlobUrl, setPreviewImageBlobUrl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Filtered List based on Search & Multi-Select Checkboxes
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.sku && item.sku.toLowerCase().includes(q));

      const matchType =
        selectedTypes.length === 0 || selectedTypes.includes(item.item_type);

      const matchCategory =
        selectedCategories.length === 0 ||
        (item.category_id && selectedCategories.includes(item.category_id)) ||
        (selectedCategories.includes("uncategorized") && !item.category_id);

      const matchStatus =
        selectedStatuses.length === 0 || selectedStatuses.includes(item.status);

      return matchSearch && matchType && matchCategory && matchStatus;
    });
  }, [items, searchQuery, selectedTypes, selectedCategories, selectedStatuses]);

  // Combined Filtered Items
  const displayedItems = filteredItems;

  // KPI summary metrics calculated from total items list
  const kpiMetrics = useMemo(() => {
    return {
      total: items.length,
      finished: items.filter((i) => i.item_type === "finished_good").length,
      raw: items.filter((i) => i.item_type === "raw_material").length,
      consumables: items.filter((i) => i.item_type === "consumable" || i.item_type === "fixed_tool").length,
      active: items.filter((i) => i.status === "active").length,
    };
  }, [items]);

  const activeFilterCount =
    selectedTypes.length + selectedCategories.length + selectedStatuses.length;

  const handleResetFilters = () => {
    setSelectedTypes([]);
    setSelectedCategories([]);
    setSelectedStatuses([]);
  };

  // Fetch Items & Categories
  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await api.get("/items");
      if (res.data && Array.isArray(res.data.data)) {
        setItems(res.data.data);
      } else if (Array.isArray(res.data)) {
        setItems(res.data);
      } else {
        setItems([]);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal memuat master item");
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get("/categories");
      const cats = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
        ? res.data
        : [];
      setCategories(cats);
    } catch {
      setCategories([]);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchCategories();
  }, []);

  // Filter categories by itemType
  const filteredCategories = useMemo(() => {
    return categories.filter(
      (c) => !c.category_type || c.category_type === formData.itemType || (c as any).category_type === "all"
    );
  }, [categories, formData.itemType]);

  // Unit Label helper
  const getPricingUnitLabel = (_priceUnit?: string, baseUnit?: string) => {
    return baseUnit || "pcs";
  };

  const currentPriceUnitLabel = formData.baseUnit || "pcs";

  // Form / Wizard Initializers
  const resetFormValues = () => {
    if (previewImageBlobUrl) {
      URL.revokeObjectURL(previewImageBlobUrl);
    }
    setPendingImageFile(null);
    setPreviewImageBlobUrl("");

    setFormData({
      name: "",
      sku: "",
      categoryId: "none",
      itemType: "finished_good",
      baseUnit: "pcs",
      priceUnit: "base",
      boxUnit: "kardus",
      conversionRate: 1,
      sellPrice: 0,
      boxSellPrice: 0,
      standardCost: 0,
      minStockAlert: 5,
      isSellable: true,
      isInventoryTracked: true,
      isTrackingStock: true,
      isProduced: false,
      isPurchasable: true,
      isThawable: false,
      requiresThaw: false,
      initialStockSealed: 0,
      initialStockLoose: 0,
      status: "active",
      imageUrl: "",
    });
    setCostCalculationMode("unit");
    setPackBuyPrice(0);
    setPackFreightExtra(0);
    setNewCategoryType("finished_good");
    setIsCustomBaseUnit(false);
    setIsCustomBoxUnit(false);
    setEditingItem(null);
    setWizardStep(1);
  };

  const handleOpenCreateWizard = () => {
    if (isStaff) {
      toast.error("Akses Dibatasi: Staf tidak memiliki izin menambah item master");
      return;
    }
    resetFormValues();
    setCurrentView("wizard");
    if (onNavigate) {
      onNavigate("items-add");
    }
  };

  const handleOpenCreateForm = () => {
    if (isStaff) {
      toast.error("Akses Dibatasi: Staf tidak memiliki izin menambah item master");
      return;
    }
    resetFormValues();
    setCurrentView("new");
    if (onNavigate) {
      onNavigate("items-add");
    }
  };

  const handleOpenCreate = () => {
    handleOpenCreateWizard();
  };

  const handleOpenEdit = (item: UnifiedItem | any) => {
    if (isStaff) {
      toast.error("Akses Dibatasi: Staf tidak memiliki izin mengedit item master");
      return;
    }
    if (previewImageBlobUrl) {
      URL.revokeObjectURL(previewImageBlobUrl);
    }
    setPendingImageFile(null);
    setPreviewImageBlobUrl("");

    setEditingItem(item);
    setFormData({
      name: item.name || "",
      sku: item.sku || "",
      categoryId: item.category_id || item.category || "none",
      itemType: item.item_type || "finished_good",
      baseUnit: item.base_unit || item.unit_type || "pcs",
      priceUnit: item.price_unit || "base",
      boxUnit: item.box_unit || "kardus",
      conversionRate: Number(item.conversion_rate) || 1,
      sellPrice: Number(item.sell_price) || 0,
      boxSellPrice: Number(item.box_sell_price) || 0,
      standardCost: Number(item.standard_cost) || Number(item.purchase_price) || 0,
      minStockAlert: Number(item.min_stock_alert) || 5,
      isSellable: item.is_sellable !== false,
      isInventoryTracked: item.is_inventory_tracked !== false || item.is_tracking_stock !== false,
      isTrackingStock: item.is_inventory_tracked !== false || item.is_tracking_stock !== false,
      isProduced: Boolean(item.is_produced),
      isPurchasable: item.is_purchasable !== false,
      isThawable: Boolean(item.is_thawable || item.requires_thaw),
      requiresThaw: Boolean(item.is_thawable || item.requires_thaw),
      initialStockSealed: item.qty_sealed || 0,
      initialStockLoose: item.qty_loose || 0,
      status: item.status || "active",
      imageUrl: item.image_url || "",
    });
    const unitVal = item.base_unit || item.unit_type || "pcs";
    const isStandardBase = standardBaseUnits.some((u) => u.value === unitVal);
    setIsCustomBaseUnit(!isStandardBase && Boolean(unitVal));

    const isStandardBox = standardBoxUnits.some((u) => u.value === item.box_unit);
    setIsCustomBoxUnit(!isStandardBox && Boolean(item.box_unit));

    setCostCalculationMode("unit");
    const stdCost = Number(item.standard_cost) || Number(item.purchase_price) || 0;
    const convRate = Number(item.conversion_rate) || 1;
    setPackBuyPrice(convRate > 1 ? stdCost * convRate : 0);
    setPackFreightExtra(0);
    setNewCategoryType(item.item_type || "finished_good");
    setCurrentView("edit");
  };

  const handleBackToMaster = () => {
    if (editingItem?.name) {
      setSearchQuery(editingItem.name);
    }
    setCurrentView("master");
    setEditingItem(null);
    setWizardStep(1);
    if (onNavigate) {
      onNavigate("items");
    }
    fetchItems();
  };


  const handleGenerateSku = () => {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const prefix = formData.itemType === "finished_good"
      ? "FG"
      : formData.itemType === "semi_finished"
      ? "SFG"
      : formData.itemType === "raw_material"
      ? "RAW"
      : formData.itemType === "consumable"
      ? "CSM"
      : "AST";
    setFormData((prev) => ({ ...prev, sku: `${prefix}-${randomNum}` }));
    toast.info(`SKU otomatis dibuat: ${prefix}-${randomNum}`);
  };

  // Image Selection & Preview Handler (Lazy Upload on Submit)
  const handleSelectImageFile = (file: File) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar (PNG, JPG, WebP, dll.)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran file gambar maksimal 5MB");
      return;
    }

    // Revoke old preview object url if exists
    if (previewImageBlobUrl) {
      URL.revokeObjectURL(previewImageBlobUrl);
    }

    const blobUrl = URL.createObjectURL(file);
    setPendingImageFile(file);
    setPreviewImageBlobUrl(blobUrl);
    setFormData((prev) => ({ ...prev, imageUrl: blobUrl }));
    toast.info("Foto produk dipilih (akan diunggah ke server saat disimpan)");
  };

  const handleRemoveImage = () => {
    if (previewImageBlobUrl) {
      URL.revokeObjectURL(previewImageBlobUrl);
    }
    setPendingImageFile(null);
    setPreviewImageBlobUrl("");
    setFormData((prev) => ({ ...prev, imageUrl: "" }));
  };

  // Save Item (Create or Update with Deferred Image Upload)
  const handleSaveItem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Nama item wajib diisi");
      return;
    }

    setIsSubmitting(true);
    try {
      let finalImageUrl: string | undefined = formData.imageUrl.trim() ? formData.imageUrl.trim() : undefined;

      // Deferred Upload: Jika ada file lokal baru yang dipilih, unggah ke server sekarang
      if (pendingImageFile) {
        setUploadingImage(true);
        try {
          const uploadFormData = new FormData();
          uploadFormData.append("file", pendingImageFile);
          const res = await api.post("/upload", uploadFormData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          if (res.data?.file_url) {
            finalImageUrl = res.data.file_url;
          }
        } catch (uploadErr: any) {
          toast.error(uploadErr.response?.data?.message || "Gagal mengunggah foto ke server");
          setIsSubmitting(false);
          setUploadingImage(false);
          return;
        } finally {
          setUploadingImage(false);
        }
      } else if (finalImageUrl && (finalImageUrl.startsWith("blob:") || finalImageUrl.startsWith("data:"))) {
        // Safeguard jika blob url tanpa pendingImageFile
        finalImageUrl = undefined;
      }

      const isTracking = formData.isTrackingStock || formData.isInventoryTracked;
      const isThaw = formData.isThawable || formData.requiresThaw;

      const payload = {
        name: formData.name.trim(),
        sku: formData.sku.trim() || undefined,
        category_id: formData.categoryId !== "none" ? formData.categoryId : undefined,
        item_type: formData.itemType,
        base_unit: formData.baseUnit.trim() || "pcs",
        price_unit: formData.priceUnit || "base",
        box_unit: formData.boxUnit.trim() || "kardus",
        conversion_rate: Number(formData.conversionRate) || 1,
        sell_price: formData.sellPrice,
        box_sell_price: formData.boxSellPrice || formData.sellPrice * (Number(formData.conversionRate) || 1),
        standard_cost: formData.standardCost,
        min_stock_alert: Number(formData.minStockAlert) || 5,
        is_sellable: formData.isSellable,
        is_inventory_tracked: isTracking,
        is_tracking_stock: isTracking,
        is_produced: formData.isProduced,
        is_purchasable: formData.isPurchasable,
        is_thawable: isThaw,
        requires_thaw: isThaw,
        initial_stock_sealed: formData.initialStockSealed,
        initial_stock_loose: formData.initialStockLoose,
        image_url: finalImageUrl,
      };

      if (currentView === "edit" && editingItem) {
        await api.put(`/items/${editingItem.id}`, payload);
        toast.success(`Master item "${formData.name}" berhasil diperbarui!`);
      } else {
        await api.post("/items", payload);
        toast.success(`Master item baru "${formData.name}" berhasil ditambahkan!`);
      }

      // Cleanup local blob object
      if (previewImageBlobUrl) {
        URL.revokeObjectURL(previewImageBlobUrl);
      }
      setPendingImageFile(null);
      setPreviewImageBlobUrl("");

      handleBackToMaster();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menyimpan master item");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (itemId: string, newStatus: string) => {
    try {
      await api.patch(`/items/${itemId}/status`, { status: newStatus });
      toast.success(`Status item berhasil diubah menjadi ${newStatus}`);
      fetchItems();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal mengubah status item");
    }
  };

  const handleCopySku = (sku?: string) => {
    if (!sku) {
      toast.info("Item ini belum memiliki Barcode / SKU");
      return;
    }
    navigator.clipboard.writeText(sku);
    toast.success(`SKU "${sku}" disalin ke clipboard!`);
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error("Nama kategori tidak boleh kosong");
      return;
    }
    try {
      await api.post("/categories", {
        name: newCategoryName.trim(),
        category_type: newCategoryType || formData.itemType,
      });
      toast.success("Kategori baru berhasil dibuat!");
      setNewCategoryName("");
      fetchCategories();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal membuat kategori");
    }
  };

  const handlePromptDeleteCategory = (category: Category) => {
    setCategoryToDelete(category);
  };

  const handleConfirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setIsDeletingCategory(true);
    try {
      await api.delete(`/categories/${categoryToDelete.id}`);
      toast.success(`Kategori "${categoryToDelete.name}" berhasil dihapus`);
      setCategoryToDelete(null);
      await fetchCategories();
      await fetchItems();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus kategori");
    } finally {
      setIsDeletingCategory(false);
    }
  };



  // Calculations for Dedicated Form Margin Matrix
  const unitProfit = formData.sellPrice - formData.standardCost;
  const marginPercent =
    formData.standardCost > 0
      ? Math.round((unitProfit / formData.standardCost) * 100)
      : formData.sellPrice > 0
      ? 100
      : 0;

  // Master Table Columns Definition
  const columns: ColumnDef<UnifiedItem>[] = [
    {
      key: "name",
      label: t.itemsColName || "Item & Barcode / SKU",
      renderCell: (row: UnifiedItem) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-dark-card border border-slate-200 dark:border-dark-border flex items-center justify-center shrink-0 overflow-hidden text-slate-500">
            <ErpImage
              src={row.image_url}
              alt={row.name}
              fallbackType={row.item_type === "consumable" ? "tool" : row.item_type === "raw_material" ? "ingredient" : "product"}
            />
          </div>
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              {row.name}
            </div>
            <div className="text-xs text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
              <span>{row.sku || (t.itemsNoBarcode || "Tanpa Barcode")}</span>
              {row.sku && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopySku(row.sku);
                  }}
                  className="hover:text-slate-900 dark:hover:text-white transition-colors p-0.5 cursor-pointer"
                  title={t.itemsCopySku || "Salin SKU"}
                >
                  <Copy className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      label: t.itemsColCategory || "Kategori",
      renderCell: (row: UnifiedItem) => (
        <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-[#2A2A2E] text-slate-700 dark:text-slate-300 font-semibold text-xs inline-block">
          {row.category_name || "General"}
        </span>
      ),
    },
    {
      key: "item_type",
      label: t.itemsColDomain || "Tipe Domain",
      renderCell: (row: UnifiedItem) => {
        switch (row.item_type) {
          case "finished_good":
            return <Badge variant="info">{t.itemsFinishedGoods || "Produk Jadi"}</Badge>;
          case "semi_finished":
            return <Badge variant="purple">Setengah Jadi</Badge>;
          case "raw_material":
            return <Badge variant="warning">{t.itemsRawMaterials || "Bahan Baku"}</Badge>;
          case "consumable":
            return <Badge variant="purple">{t.itemsToolsPackaging || "Kemasan/Alat"}</Badge>;
          case "fixed_tool":
            return <Badge variant="secondary">{t.itemsPhysicalAssets || "Aset Fisik"}</Badge>;
          default:
            return <Badge variant="outline">{row.item_type}</Badge>;
        }
      },
    },
    {
      key: "capabilities",
      label: "Peran & Kemampuan",
      renderCell: (row: UnifiedItem) => (
        <div className="flex flex-wrap items-center gap-1">
          {row.is_sellable && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60">
              Dijual
            </span>
          )}
          {(row.is_inventory_tracked || row.is_tracking_stock) && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60">
              Lacak Stok
            </span>
          )}
          {row.is_produced && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60">
              Produksi
            </span>
          )}
          {row.is_purchasable !== false && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60">
              Beli
            </span>
          )}
          {(row.is_thawable || row.requires_thaw) && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300 border border-cyan-200/80 dark:border-cyan-800/60">
              Thawing
            </span>
          )}
        </div>
      ),
    },
    {
      key: "uom_spec",
      label: t.itemsColUom || "Satuan & Konversi",
      renderCell: (row: UnifiedItem) => (
        <div className="text-xs">
          <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 font-mono text-slate-700 dark:text-slate-300">
              {row.base_unit || "pcs"}
            </span>
            {row.conversion_rate > 1 && (
              <>
                <span className="text-slate-400">/</span>
                <span className="text-slate-500 font-medium">
                  {row.box_unit || "dus"} ({row.conversion_rate} {row.base_unit})
                </span>
              </>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "price_cost",
      label: t.itemsColPriceCost || "Harga Jual / Modal",
      renderCell: (row: UnifiedItem) => {
        const unitLabel = row.base_unit || "pcs";

        return (
          <div className="text-xs space-y-0.5">
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              Rp {row.sell_price.toLocaleString("id-ID")}{" "}
              <span className="text-[10px] text-slate-400 font-normal">/{unitLabel}</span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              {t.itemsHppLabel || "HPP"}: Rp {row.standard_cost.toLocaleString("id-ID")}{" "}
              <span className="text-[10px] text-slate-400 font-normal">/{unitLabel}</span>
            </div>
          </div>
        );
      },
    },
    {
      key: "status",
      label: t.itemsColStatus || "Status",
      renderCell: (row: UnifiedItem) => {
        if (row.status === "active") {
          return <Badge variant="success">{t.itemsStatusActive || "Aktif"}</Badge>;
        }
        if (row.status === "inactive") {
          return <Badge variant="warning">{t.itemsStatusInactive || "Non-aktif"}</Badge>;
        }
        return <Badge variant="destructive">{t.itemsStatusDiscontinued || "Dihentikan"}</Badge>;
      },
    },
    {
      key: "actions",
      label: t.itemsColActions || "Aksi",
      align: "right",
      renderCell: (row: UnifiedItem) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="w-8 h-8 rounded-full inline-flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors focus:outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-2xl p-1.5 shadow-xl">
            {isItemAdmin ? (
              <DropdownMenuItem
                onClick={() => handleOpenEdit(row)}
                className="gap-2 rounded-xl text-xs font-medium cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                {t.itemsEditItem || "Edit Data Item"}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => handleOpenEdit(row)}
                className="gap-2 rounded-xl text-xs font-medium cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>Lihat Detail Item</span>
              </DropdownMenuItem>
            )}
            {row.sku && (
              <DropdownMenuItem
                onClick={() => handleCopySku(row.sku)}
                className="gap-2 rounded-xl text-xs font-medium cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                {t.itemsCopySku || "Salin Barcode / SKU"}
              </DropdownMenuItem>
            )}
            {isItemAdmin && (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  {t.itemsChangeStatus || "Ubah Status"}
                </div>

                {row.status !== "active" && (
                  <DropdownMenuItem
                    onClick={() => handleUpdateStatus(row.id, "active")}
                    className="gap-2 rounded-xl text-xs font-medium text-emerald-600 dark:text-emerald-400 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {t.itemsStatusActive || "Set Aktif"}
                  </DropdownMenuItem>
                )}
                {row.status !== "inactive" && (
                  <DropdownMenuItem
                    onClick={() => handleUpdateStatus(row.id, "inactive")}
                    className="gap-2 rounded-xl text-xs font-medium text-amber-600 dark:text-amber-400 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    {t.itemsStatusInactive || "Set Non-aktif"}
                  </DropdownMenuItem>
                )}
                {row.status !== "discontinued" && (
                  <DropdownMenuItem
                    onClick={() => handleUpdateStatus(row.id, "discontinued")}
                    className="gap-2 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 cursor-pointer"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    {t.itemsStatusDiscontinued || "Set Dihentikan"}
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // =========================================================================
  // RENDER GUIDED STEP-BY-STEP WIZARD VIEW
  // =========================================================================
  if (currentView === "wizard") {
    const cardHeadingClass =
      "text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-[#333338]";
    const bentoCardClass =
      "bg-white dark:bg-dark-card border border-slate-200/80 dark:border-dark-border rounded-3xl p-6 sm:p-7 shadow-xs space-y-6 text-left";
    const labelClass =
      "block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 text-left";

    const steps = [
      { num: 1, title: t.wizardStep1Title, desc: t.wizardStep1Desc, icon: Package },
      { num: 2, title: t.wizardStep2Title, desc: t.wizardStep2Desc, icon: Tag },
      { num: 3, title: t.wizardStep3Title, desc: t.wizardStep3Desc, icon: Calculator },
      { num: 4, title: t.wizardStep4Title, desc: t.wizardStep4Desc, icon: Boxes },
    ];

    const canProceedStep1 = Boolean(formData.name.trim());
    const canProceedStep2 = Boolean(formData.itemType);
    const canProceedStep3 = formData.sellPrice > 0;

    const handleNextStep = (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (wizardStep === 1) {
        if (!formData.name.trim()) {
          toast.error("Nama item wajib diisi");
          return;
        }
        setWizardStep(2);
      } else if (wizardStep === 2) {
        setWizardStep(3);
      } else if (wizardStep === 3) {
        if (formData.isSellable && formData.sellPrice <= 0) {
          toast.info("Perhatian: Harga jual belum diisi atau bernilai Rp 0");
        }
        setWizardStep(4);
      } else if (wizardStep === 4) {
        handleSaveItem();
      }
    };

    return (
      <div className="w-full max-w-6xl xl:max-w-7xl mx-auto space-y-6 text-left transition-all p-1">
        {/* ── HEADER TITLE BAR (FRAMELESS) ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-[#2E2E34]">
          <div className="flex items-center space-x-3.5">
            <Button
              variant="outline"
              size="icon"
              onClick={handleBackToMaster}
              className="rounded-full w-10 h-10 border-slate-200 dark:border-dark-border shrink-0"
              title="Kembali ke Daftar Master"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#3F73F7] flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5" /> Panduan Wizard
                </span>
                <span className="text-slate-300 dark:text-slate-600">/</span>
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                  {t.wizardStepProgress} {wizardStep} {t.wizardOf} 4
                </span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-0.5">
                {steps[wizardStep - 1].title}
              </h2>
            </div>
          </div>

          {/* Mode Switcher & Quick Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setCurrentView("new");
                if (onNavigate) onNavigate("items-add");
              }}
              className="rounded-full gap-2 border-slate-200 dark:border-dark-border text-xs font-semibold"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#3F73F7]" />
              Mode Formulir Lengkap
            </Button>
            <Button
              variant="outline"
              onClick={handleBackToMaster}
              className="rounded-full text-xs font-medium"
            >
              Batal
            </Button>
          </div>
        </div>

        {/* ── STEPPER PROGRESS BAR ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {steps.map((s) => {
            const Icon = s.icon;
            const isDone = s.num < wizardStep;
            const isCurrent = s.num === wizardStep;
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => {
                  if (isDone || s.num <= wizardStep) {
                    setWizardStep(s.num);
                  }
                }}
                disabled={s.num > wizardStep && !canProceedStep1}
                className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-2.5 ${
                  isCurrent
                    ? "bg-[#3F73F7]/10 dark:bg-[#3F73F7]/20 border-[#3F73F7] text-[#3F73F7]"
                    : isDone
                    ? "bg-white dark:bg-dark-card border-emerald-500/40 text-emerald-600 dark:text-emerald-400 cursor-pointer"
                    : "bg-white/50 dark:bg-dark-card/50 border-slate-200/60 dark:border-dark-border text-slate-400 opacity-60 cursor-not-allowed"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                    isCurrent
                      ? "bg-[#3F73F7] text-white"
                      : isDone
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                  }`}
                >
                  {isDone ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold truncate">Langkah {s.num}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {s.num === 1 ? "Info & Media" : s.num === 2 ? "Klasifikasi" : s.num === 3 ? "Satuan & Harga" : "Aturan Stok"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── STEP CONTENT CARDS ── */}
        <div className={bentoCardClass}>
          {/* STEP 1: INFO DASAR, BARCODE & FOTO */}
          {wizardStep === 1 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#333338]">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Package className="w-4 h-4 text-[#3F73F7]" />
                    Informasi Dasar Item & Barcode
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Masukkan identitas nama barang dan kode barcode scanner
                  </p>
                </div>
              </div>

              {/* Nama Item */}
              <div>
                <label className={labelClass}>Nama Item Master *</label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-slate-400 pointer-events-none">
                    <Tag className="w-4 h-4" />
                  </span>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Contoh: Beras Pandan Wangi 5kg / Daging Sapi Raw / Cup Sealer 16oz"
                    className="h-11 pl-11 rounded-2xl text-sm font-semibold"
                    autoFocus
                    required
                  />
                </div>
              </div>

              {/* Barcode / SKU */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelClass}>Barcode / SKU (Opsional)</label>
                  <button
                    type="button"
                    onClick={handleGenerateSku}
                    className="text-[11px] font-bold text-[#3F73F7] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Auto-Generate SKU</span>
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-slate-400 pointer-events-none">
                    <Barcode className="w-4 h-4" />
                  </span>
                  <Input
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="8998077610012 / FG-10023 (Bisa discan langsung lewat barcode scanner)"
                    className="h-11 pl-11 rounded-2xl text-sm font-mono"
                  />
                </div>
              </div>

              {/* Foto Produk */}
              <div>
                <label className={labelClass}>Foto & Media Produk (Opsional)</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleSelectImageFile(e.dataTransfer.files[0]);
                      }
                    }}
                    className={`relative w-full h-32 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center overflow-hidden transition-all duration-200 cursor-pointer ${
                      dragActive
                        ? "border-[#3F73F7] bg-[#3F73F7]/5"
                        : "border-slate-300 dark:border-dark-border hover:border-slate-400"
                    }`}
                  >
                    {uploadingImage ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-5 h-5 border-2 border-[#3F73F7] border-t-transparent rounded-full animate-spin" />
                        <span className="text-[11px] text-slate-500">Mengunggah...</span>
                      </div>
                    ) : formData.imageUrl ? (
                      <div className="relative w-full h-full group">
                        <img
                          src={getImageUrl(formData.imageUrl)}
                          alt="Foto Produk"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveImage();
                            }}
                            className="p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                            title="Hapus Gambar"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-slate-400 p-2 text-center">
                        <Upload className="w-6 h-6 text-slate-400" />
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          Klik untuk upload foto
                        </span>
                        <span className="text-[10px] text-slate-400">PNG, JPG maks 5MB</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleSelectImageFile(e.target.files[0]);
                        }
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Atau Tempel URL Gambar Eksternal
                    </label>
                    <Input
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      placeholder="https://images.unsplash.com/..."
                      className="h-10 rounded-xl text-xs font-mono"
                    />
                    <p className="text-[11px] text-slate-400">
                      Foto produk akan ditampilkan di kasir POS Retail & Fast Grid Touchscreen.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: KLASIFIKASI DOMAIN & KATEGORI */}
          {wizardStep === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#333338]">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-[#3F73F7]" />
                    Tipe Domain Operasional & Kategori
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Pilih bagaimana item ini digunakan dalam rantai operasional bisnis
                  </p>
                </div>
              </div>

              {/* Tipe Domain 5-Card Selector */}
              <div>
                <label className={labelClass}>Tipe Domain Operasional *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    {
                      id: "finished_good",
                      title: "Produk Jadi (Finished Good)",
                      desc: "Barang siap jual di kasir POS atau hidangan matang saji",
                      badge: "Siap Jual",
                      icon: Package,
                    },
                    {
                      id: "semi_finished",
                      title: "Bahan Olahan (Semi-Finished)",
                      desc: "Hasil olahan setengah jadi dapur (adonan, bumbu marinasi)",
                      badge: "Olahan Dapur",
                      icon: ChefHat,
                    },
                    {
                      id: "raw_material",
                      title: "Bahan Mentah (Raw Material)",
                      desc: "Bahan baku mentah supplier untuk dimasak atau dicairkan",
                      badge: "Bahan Baku",
                      icon: Layers,
                    },
                    {
                      id: "consumable",
                      title: "Kemasan & Penunjang (Consumable)",
                      desc: "Bungkus take-away, cup, sealer, tisu, plastik kresek",
                      badge: "Habis Pakai",
                      icon: Boxes,
                    },
                    {
                      id: "fixed_tool",
                      title: "Aset & Alat Fisik (Fixed Tool)",
                      desc: "Peralatan toko permanen: kompor, wajan, barcode scanner",
                      badge: "Aset Tetap",
                      icon: ShieldAlert,
                    },
                  ].map((dt) => {
                    const Icon = dt.icon;
                    const isSelected = formData.itemType === dt.id;
                    return (
                      <div
                        key={dt.id}
                        onClick={() => {
                          setFormData({
                            ...formData,
                            itemType: dt.id as any,
                            isSellable: dt.id === "finished_good",
                            isProduced: dt.id === "finished_good" || dt.id === "semi_finished",
                            isPurchasable: dt.id !== "semi_finished",
                            isThawable: dt.id === "raw_material" ? formData.isThawable : false,
                          });
                          setNewCategoryType(dt.id as any);
                        }}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? "border-[#3F73F7] bg-[#3F73F7]/5 dark:bg-[#3F73F7]/10 ring-2 ring-[#3F73F7]/20"
                            : "border-slate-200/80 dark:border-dark-border hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-dark-card"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                isSelected ? "bg-[#3F73F7] text-white" : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300"
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="font-bold text-xs text-slate-900 dark:text-slate-100">
                              {dt.title}
                            </div>
                          </div>
                          <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 shrink-0">
                            {dt.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                          {dt.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Kategori Pengelompokan */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={labelClass}>Kategori Master Terkait</label>
                  <button
                    type="button"
                    onClick={() => {
                      setNewCategoryType(formData.itemType);
                      setIsCategoryModalOpen(true);
                    }}
                    className="text-[11px] font-bold text-[#3F73F7] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Buat Kategori Baru</span>
                  </button>
                </div>
                <Select
                  value={formData.categoryId}
                  onValueChange={(val) => val && setFormData({ ...formData, categoryId: val })}
                >
                  <SelectTrigger className="w-full h-11 rounded-2xl bg-slate-50 dark:bg-white/5 border-slate-200/80 dark:border-dark-border text-xs font-semibold">
                    <SelectValue placeholder="Pilih Kategori..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl shadow-xl max-h-60">
                    <SelectItem value="none">-- Tanpa Kategori --</SelectItem>
                    {filteredCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-400">
                  Kategori akan otomatis difilter sesuai tipe domain yang dipilih ({formData.itemType}).
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: SATUAN UOM, HARGA KULAKAN & HARGA JUAL */}
          {wizardStep === 3 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#333338]">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-[#3F73F7]" />
                    Satuan Dual-UOM & Kalkulasi Harga Kulakan
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Atur satuan kulakan grosir (dus/karung) dan satuan jual eceran (pcs/kg)
                  </p>
                </div>
              </div>

              {/* Satuan Terkecil & Satuan Grosir */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={labelClass}>Satuan Dasar / Terkecil *</label>
                    <button
                      type="button"
                      onClick={() => {
                        if (isCustomBaseUnit) {
                          setIsCustomBaseUnit(false);
                          setFormData({ ...formData, baseUnit: "pcs" });
                        } else {
                          setIsCustomBaseUnit(true);
                          setFormData({ ...formData, baseUnit: "" });
                        }
                      }}
                      className="text-[11px] font-bold text-[#3F73F7] hover:underline cursor-pointer"
                    >
                      {isCustomBaseUnit
                        ? (t.itemsChooseStandardUnit || "Pilih...")
                        : (t.itemsCustomUnitOption || "+ Tambah Baru")}
                    </button>
                  </div>

                  {isCustomBaseUnit ? (
                    <Input
                      value={formData.baseUnit}
                      onChange={(e) => setFormData({ ...formData, baseUnit: e.target.value.toLowerCase() })}
                      placeholder="Ketik satuan dasar (cth: ikat, lembar)..."
                      className="h-11 rounded-2xl text-xs font-bold"
                      autoFocus
                    />
                  ) : (
                    <Select
                      value={formData.baseUnit}
                      onValueChange={(val) => val && setFormData({ ...formData, baseUnit: val })}
                    >
                      <SelectTrigger className="w-full h-11 rounded-2xl bg-slate-50 dark:bg-white/5 border-slate-200/80 dark:border-dark-border text-xs font-semibold">
                        <SelectValue placeholder="Satuan Terkecil" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl shadow-xl max-h-60">
                        {standardBaseUnits.map((u) => (
                          <SelectItem key={u.value} value={u.value}>
                            {u.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={labelClass}>Satuan Pembelian / Grosir</label>
                    <button
                      type="button"
                      onClick={() => {
                        if (isCustomBoxUnit) {
                          setIsCustomBoxUnit(false);
                          setFormData({ ...formData, boxUnit: "kardus" });
                        } else {
                          setIsCustomBoxUnit(true);
                          setFormData({ ...formData, boxUnit: "" });
                        }
                      }}
                      className="text-[11px] font-bold text-[#3F73F7] hover:underline cursor-pointer"
                    >
                      {isCustomBoxUnit
                        ? (t.itemsChooseStandardUnit || "Pilih...")
                        : (t.itemsCustomUnitOption || "+ Tambah Baru")}
                    </button>
                  </div>

                  {isCustomBoxUnit ? (
                    <Input
                      value={formData.boxUnit}
                      onChange={(e) => setFormData({ ...formData, boxUnit: e.target.value.toLowerCase() })}
                      placeholder="Ketik satuan grosir (cth: karung 50kg, bal)..."
                      className="h-11 rounded-2xl text-xs font-bold"
                      autoFocus
                    />
                  ) : (
                    <Select
                      value={formData.boxUnit}
                      onValueChange={(val) => val && setFormData({ ...formData, boxUnit: val })}
                    >
                      <SelectTrigger className="w-full h-11 rounded-2xl bg-slate-50 dark:bg-white/5 border-slate-200/80 dark:border-dark-border text-xs font-semibold">
                        <SelectValue placeholder="Satuan Pembelian" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl shadow-xl max-h-60">
                        {standardBoxUnits.map((u) => (
                          <SelectItem key={u.value} value={u.value}>
                            {u.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div>
                  <label className={labelClass}>Isi per Dus / Kemasan Grosir</label>
                  <div className="relative">
                    <Input
                      type="number"
                      min={1}
                      value={formData.conversionRate}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value) || 1);
                        setFormData({ ...formData, conversionRate: val });
                      }}
                      className="h-11 rounded-2xl text-sm font-bold pl-4 pr-16"
                    />
                    <span className="absolute right-4 top-3 text-xs text-slate-400 font-bold uppercase pointer-events-none">
                      {formData.baseUnit}
                    </span>
                  </div>
                </div>
              </div>

              {/* Kalkulator Kulakan HPP Modal */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-dark-border space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-[#3F73F7]" />
                    Kalkulator HPP Kulakan Otomatis
                  </div>
                  <div className="flex items-center gap-1 bg-white dark:bg-[#202024] p-1 rounded-xl border border-slate-200 dark:border-dark-border">
                    <button
                      type="button"
                      onClick={() => setCostCalculationMode("pack")}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-colors ${
                        costCalculationMode === "pack"
                          ? "bg-[#3F73F7] text-white"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      Beli per {formData.boxUnit}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCostCalculationMode("unit")}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-colors ${
                        costCalculationMode === "unit"
                          ? "bg-[#3F73F7] text-white"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      Beli per {currentPriceUnitLabel}
                    </button>
                  </div>
                </div>

                {costCalculationMode === "pack" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Harga Beli / {formData.boxUnit}
                      </label>
                      <CurrencyInput
                        value={packBuyPrice}
                        onChange={(val) => {
                          setPackBuyPrice(val);
                          const totalPack = val + packFreightExtra;
                          const perUnit = Math.round(totalPack / (formData.conversionRate || 1));
                          setFormData((prev) => ({ ...prev, standardCost: perUnit }));
                        }}
                        className="h-10 text-xs rounded-xl"
                        placeholder="Contoh: 150.000"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Biaya Kirim & Ekspedisi
                      </label>
                      <CurrencyInput
                        value={packFreightExtra}
                        onChange={(val) => {
                          setPackFreightExtra(val);
                          const totalPack = packBuyPrice + val;
                          const perUnit = Math.round(totalPack / (formData.conversionRate || 1));
                          setFormData((prev) => ({ ...prev, standardCost: perUnit }));
                        }}
                        className="h-10 text-xs rounded-xl"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        HPP per {currentPriceUnitLabel} (Hasil)
                      </label>
                      <div className="h-10 rounded-xl bg-white dark:bg-[#1a1a1e] border border-slate-200 dark:border-dark-border px-3 flex items-center text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        Rp {formData.standardCost.toLocaleString("id-ID")}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Harga Modal Dasar (HPP) per {currentPriceUnitLabel}
                    </label>
                    <CurrencyInput
                      value={formData.standardCost}
                      onChange={(val) => setFormData({ ...formData, standardCost: val })}
                      className="h-10 text-xs rounded-xl"
                      placeholder="Contoh: 3.500"
                    />
                  </div>
                )}
              </div>

              {/* Harga Jual Eceran & Harga Jual Grosir */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Harga Jual (per {currentPriceUnitLabel}) *</label>
                  <CurrencyInput
                    value={formData.sellPrice}
                    onChange={(val) => setFormData({ ...formData, sellPrice: val })}
                    className="h-11 text-sm font-bold rounded-2xl"
                    placeholder="Contoh: 5.000"
                  />
                  {formData.sellPrice > 0 && formData.standardCost > 0 && (
                    <div className="flex items-center justify-between text-[11px] mt-1.5 px-1 font-semibold">
                      <span className="text-slate-500">Estimasi Margin:</span>
                      <span className={unitProfit >= 0 ? "text-emerald-600" : "text-red-500"}>
                        Rp {unitProfit.toLocaleString("id-ID")} ({marginPercent}%)
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className={labelClass}>Harga Jual Grosir / Dus (Opsional)</label>
                  <CurrencyInput
                    value={formData.boxSellPrice}
                    onChange={(val) => setFormData({ ...formData, boxSellPrice: val })}
                    className="h-11 text-sm font-bold rounded-2xl"
                    placeholder="Contoh: 110.000"
                  />
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    Harga khusus saat pelanggan/warung membeli 1 dus utuh.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: ATURAN STOK, THAWING & RINGKASAN SIMPAN */}
          {wizardStep === 4 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#333338]">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-[#3F73F7]" />
                    Aturan Inventori & Konfirmasi Akhir
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Periksa kembali data item sebelum disimpan ke database master
                  </p>
                </div>
              </div>

              {/* 5 Capability Flags via Shadcn Switch */}
              <div className="space-y-3">
                {/* 1. POS Sellable */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 dark:border-dark-border bg-white dark:bg-dark-card">
                  <div className="space-y-0.5 pr-3">
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <ShoppingCart className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Tampilkan di Menu Kasir (POS Sellable)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Item dapat dicari kasir atau discan barcode saat transaksi penjualan.
                    </p>
                  </div>
                  <Switch
                    checked={formData.isSellable}
                    onCheckedChange={(c) => setFormData({ ...formData, isSellable: Boolean(c) })}
                  />
                </div>

                {/* 2. Track Stock */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 dark:border-dark-border bg-white dark:bg-dark-card">
                  <div className="space-y-0.5 pr-3">
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <Boxes className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span>Lacak Saldo Stok Fisik (Inventory Ledger)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Mencatat setiap mutasi stok keluar/masuk ke buku besar double-entry.
                    </p>
                  </div>
                  <Switch
                    checked={formData.isTrackingStock}
                    onCheckedChange={(c) => setFormData({ ...formData, isTrackingStock: Boolean(c), isInventoryTracked: Boolean(c) })}
                  />
                </div>

                {/* 3. Produced in Kitchen / BOM */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 dark:border-dark-border bg-white dark:bg-dark-card">
                  <div className="space-y-0.5 pr-3">
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <ChefHat className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>Diproduksi Sendiri di Dapur (Manufacturing / BOM)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Item ini dibuat/diolah via resep dapur dan menjadi target output batch produksi.
                    </p>
                  </div>
                  <Switch
                    checked={formData.isProduced}
                    onCheckedChange={(c) => setFormData({ ...formData, isProduced: Boolean(c) })}
                  />
                </div>

                {/* 4. Purchasable from Supplier */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 dark:border-dark-border bg-white dark:bg-dark-card">
                  <div className="space-y-0.5 pr-3">
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span>Dapat Dibeli dari Supplier Luar (Purchasable)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Muncul sebagai pilihan barang saat membuat pesanan pembelian (Purchase Order).
                    </p>
                  </div>
                  <Switch
                    checked={formData.isPurchasable}
                    onCheckedChange={(c) => setFormData({ ...formData, isPurchasable: Boolean(c) })}
                  />
                </div>

                {/* 5. Thawing Process */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/30 dark:bg-blue-950/10">
                  <div className="space-y-0.5 pr-3">
                    <div className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                      <Snowflake className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                      <span>Perlu Proses Pencairan Thawing (Defrosting Beku)</span>
                    </div>
                    <p className="text-[11px] text-blue-700/80 dark:text-blue-400">
                      Aktifkan untuk bahan beku dapur yang mengalami pencairan bertahap dari dus utuh ke eceran.
                    </p>
                  </div>
                  <Switch
                    checked={formData.isThawable}
                    onCheckedChange={(c) => setFormData({ ...formData, isThawable: Boolean(c), requiresThaw: Boolean(c) })}
                  />
                </div>
              </div>

              {/* Saldo Stok Awal (Opsional) */}
              {formData.isInventoryTracked && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-dark-border space-y-3">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-amber-500" />
                    Input Stok Fisik Awal di Outlet (Opsional)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Stok Kemasan Utuh ({formData.boxUnit})
                      </label>
                      <Input
                        type="number"
                        min={0}
                        value={formData.initialStockSealed}
                        onChange={(e) =>
                          setFormData({ ...formData, initialStockSealed: parseInt(e.target.value) || 0 })
                        }
                        className="h-10 text-xs rounded-xl"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Stok Eceran / Lepas ({formData.baseUnit})
                      </label>
                      <Input
                        type="number"
                        min={0}
                        value={formData.initialStockLoose}
                        onChange={(e) =>
                          setFormData({ ...formData, initialStockLoose: parseInt(e.target.value) || 0 })
                        }
                        className="h-10 text-xs rounded-xl"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Preview Ringkasan Item Card */}
              <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-dark-border bg-white dark:bg-[#1a1a1e] space-y-3">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Pratinjau Ringkasan Item
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-dark-card border border-slate-200 dark:border-dark-border flex items-center justify-center shrink-0 overflow-hidden text-slate-500">
                    <ErpImage src={formData.imageUrl} alt={formData.name} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                      {formData.name || "Nama Item Master"}
                    </div>
                    <div className="text-xs text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                      <span>SKU: {formData.sku || "Auto-Generated"}</span>
                      <span>•</span>
                      <span className="capitalize">{formData.itemType.replace("_", " ")}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold font-mono text-[#3F73F7]">
                      Rp {formData.sellPrice.toLocaleString("id-ID")}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      HPP: Rp {formData.standardCost.toLocaleString("id-ID")}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── FOOTER STEPPER NAVIGATION BUTTONS ── */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-[#333338]">
            <Button
              variant="outline"
              disabled={wizardStep === 1}
              onClick={() => setWizardStep((prev) => Math.max(1, prev - 1))}
              className="rounded-full gap-2 text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              {t.wizardPrev}
            </Button>

            <div className="flex items-center gap-2.5">
              {wizardStep < 4 ? (
                <Button
                  onClick={() => handleNextStep()}
                  disabled={wizardStep === 1 ? !canProceedStep1 : false}
                  className="rounded-full bg-[#3F73F7] hover:bg-[#3260d6] text-white shadow-md gap-2 text-xs font-semibold px-5"
                >
                  {t.wizardNext}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSaveItem}
                  disabled={isSubmitting || !formData.name.trim()}
                  className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md gap-2 text-xs font-bold px-6"
                >
                  <Check className="w-4 h-4" />
                  {isSubmitting ? "Menyimpan Master..." : t.wizardFinish}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ── CATEGORY MANAGEMENT MODAL ── */}
        <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
          <DialogContent className="sm:max-w-md rounded-[28px] p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Tag className="w-5 h-5 text-[#3F73F7]" />
                Kelola Kategori Master
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Nama kategori baru..."
                    className="h-10 rounded-xl flex-1 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreateCategory();
                      }
                    }}
                  />
                  <Select
                    value={newCategoryType}
                    onValueChange={(val: any) => setNewCategoryType(val)}
                  >
                    <SelectTrigger className="w-full sm:w-40 h-10 rounded-xl text-xs">
                      <SelectValue placeholder="Tipe Kategori" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-xl">
                      <SelectItem value="finished_good">Produk Jadi</SelectItem>
                      <SelectItem value="raw_material">Bahan Baku</SelectItem>
                      <SelectItem value="consumable">Kemasan/Alat</SelectItem>
                      <SelectItem value="fixed_tool">Aset Fisik</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleCreateCategory}
                    className="h-10 rounded-xl bg-[#3F73F7] text-white text-xs font-bold"
                  >
                    Tambah
                  </Button>
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1.5 divide-y divide-slate-100 dark:divide-white/5">
                {categories.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400">
                    Belum ada kategori yang dibuat.
                  </div>
                ) : (
                  categories.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between py-2 px-1 text-sm text-slate-700 dark:text-slate-300"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs">{c.name}</span>
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase bg-slate-100 dark:bg-white/10 text-slate-500">
                          {c.category_type === "raw_material"
                            ? "Bahan Baku"
                            : c.category_type === "consumable"
                            ? "Kemasan"
                            : c.category_type === "fixed_tool"
                            ? "Aset"
                            : "Produk"}
                        </span>
                        <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-[#3F73F7]/10 text-[#3F73F7]">
                          {c.item_count || 0} item
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePromptDeleteCategory(c)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                        title="Hapus Kategori"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCategoryModalOpen(false)}
                className="rounded-full w-full"
              >
                Tutup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── CONFIRM DELETE CATEGORY DIALOG (SAFEGUARD) ── */}
        <ConfirmDialog
          isOpen={Boolean(categoryToDelete)}
          onClose={() => setCategoryToDelete(null)}
          onConfirm={handleConfirmDeleteCategory}
          loading={isDeletingCategory}
          variant="destructive"
          title={`Hapus Kategori "${categoryToDelete?.name || ""}"?`}
          description={
            (categoryToDelete?.item_count || 0) > 0
              ? `Peringatan: Kategori ini sedang digunakan oleh ${categoryToDelete?.item_count} item produk. Jika dihapus, seluruh item tersebut akan kehilangan kategori (menjadi Uncategorized). Lanjutkan penghapusan?`
              : "Kategori ini belum digunakan oleh produk mana pun dan akan dihapus secara permanen dari daftar."
          }
          confirmText="Hapus Kategori"
          cancelText="Batal"
        />
      </div>
    );
  }

  // =========================================================================
  // RENDER DEDICATED PAGE: ADD NEW OR EDIT ITEM (BENTO GRID 2-COLUMN)
  // =========================================================================
  if (currentView === "new" || currentView === "edit") {
    const cardHeadingClass =
      "text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-[#333338]";
    const bentoCardClass =
      "bg-white dark:bg-dark-card border border-slate-200/80 dark:border-dark-border rounded-3xl p-6 shadow-xs space-y-4 text-left";
    const bentoSidebarCardClass =
      "bg-white dark:bg-dark-card border border-slate-200/80 dark:border-dark-border rounded-3xl p-5 shadow-xs space-y-4 text-left";
    const labelClass =
      "block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 text-left";

    return (
      <div className="w-full max-w-6xl xl:max-w-7xl mx-auto space-y-6 text-left transition-all p-1">
        {/* ── HEADER TITLE BAR ── */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center space-x-3.5">
            <Button
              variant="outline"
              size="icon"
              onClick={handleBackToMaster}
              className="rounded-full w-10 h-10 border-slate-200 dark:border-dark-border"
              title="Kembali ke Daftar Master"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 flex items-center gap-1.5">
                <Package className="w-3 h-3 text-[#3F73F7]" /> Master Items /{" "}
                {currentView === "new" ? "Tambah Item Baru" : "Edit Item"}
              </span>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-0.5">
                {currentView === "new"
                  ? "Tambah Master Item Baru"
                  : `Edit Data Item: ${formData.name || "Tanpa Nama"}`}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {currentView === "new" && (
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentView("wizard");
                  if (onNavigate) onNavigate("items-add");
                }}
                className="rounded-full gap-2 border-slate-200 dark:border-dark-border text-xs font-semibold"
              >
                <Wand2 className="w-3.5 h-3.5 text-[#3F73F7]" />
                Beralih ke Panduan Wizard
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleBackToMaster}
              className="rounded-full text-xs font-medium"
            >
              Batal
            </Button>
            <Button
              onClick={handleSaveItem}
              disabled={isSubmitting}
              className="rounded-full bg-[#3F73F7] hover:bg-[#3260d6] text-white shadow-md gap-2 text-xs font-semibold"
            >
              <Check className="w-4 h-4" />
              {isSubmitting
                ? "Menyimpan..."
                : currentView === "new"
                ? "Simpan Master Item"
                : "Simpan Perubahan"}
            </Button>
          </div>
        </div>

        {/* ── BENTO 2-COLUMN ASYMMETRIC GRID FORM ── */}
        <form onSubmit={handleSaveItem} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* ── LEFT COLUMN (67% Width / lg:col-span-8): Primary Specifications ── */}
            <div className="lg:col-span-8 space-y-6">
              {/* Card 1: Informasi Dasar & Domain */}
              <div className={bentoCardClass}>
                <h3 className={cardHeadingClass}>
                  <Package className="w-4 h-4 text-[#3F73F7]" />
                  <span>Informasi Dasar Item & Kategori</span>
                </h3>

                {/* Nama Item */}
                <div>
                  <label className={labelClass}>Nama Item *</label>
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-slate-400 pointer-events-none">
                      <Tag className="w-4 h-4" />
                    </span>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="misal: Beras Pandan Wangi 5kg / Daging Sapi Raw / Cup Sealer 16oz"
                      className="h-11 pl-11 rounded-2xl text-sm font-semibold"
                      required
                    />
                  </div>
                </div>

                {/* SKU & Kategori */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* SKU with Auto-generate */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className={labelClass}>Barcode / SKU</label>
                      <button
                        type="button"
                        onClick={handleGenerateSku}
                        className="text-[11px] font-bold text-[#3F73F7] hover:underline flex items-center gap-1 cursor-pointer"
                        title="Buat SKU Acak"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Auto-Generate</span>
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-4 top-3 text-slate-400 pointer-events-none">
                        <Barcode className="w-4 h-4" />
                      </span>
                      <Input
                        value={formData.sku}
                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                        placeholder="8998077610012 / FG-10023"
                        className="h-11 pl-11 rounded-2xl text-sm font-mono"
                      />
                    </div>
                  </div>

                  {/* Kategori */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className={labelClass}>Kategori</label>
                      <button
                        type="button"
                        onClick={() => setIsCategoryModalOpen(true)}
                        className="text-[11px] font-bold text-[#3F73F7] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Kelola Kategori</span>
                      </button>
                    </div>
                    <Select
                      value={formData.categoryId}
                      onValueChange={(val) => setFormData({ ...formData, categoryId: val || "none" })}
                    >
                      <SelectTrigger className="w-full h-11 rounded-2xl">
                        <SelectValue placeholder="Pilih Kategori">
                          {formData.categoryId === "none"
                            ? "Tanpa Kategori"
                            : categories.find((c) => c.id === formData.categoryId)?.name || "Pilih Kategori"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl shadow-xl max-h-64">
                        <SelectItem value="none">Tanpa Kategori</SelectItem>
                        {filteredCategories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Tipe Domain (Domain Capability) */}
                <div>
                  <label className={labelClass}>Tipe Domain Item</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[
                      {
                        val: "finished_good",
                        label: "Produk Jadi (Finished Good)",
                        desc: "Barang siap jual langsung ke konsumen melalui kasir POS.",
                      },
                      {
                        val: "semi_finished",
                        label: "Barang Setengah Jadi (WIP)",
                        desc: "Hasil olahan setengah matang / adonan dapur untuk dirakit kembali.",
                      },
                      {
                        val: "raw_material",
                        label: "Bahan Baku (Raw Material)",
                        desc: "Bahan mentah yang diolah pada modul produksi & dapur.",
                      },
                      {
                        val: "consumable",
                        label: "Kemasan / Alat (Consumable)",
                        desc: "Bungkus, kantong plastik, cup, saus, dan pelengkap.",
                      },
                      {
                        val: "fixed_tool",
                        label: "Aset Fisik (Fixed Tool)",
                        desc: "Peralatan operasional, wajan, kompor, dan perlengkapan toko.",
                      },
                    ].map((typeItem) => {
                      const isActive = formData.itemType === typeItem.val;
                      return (
                        <button
                          key={typeItem.val}
                          type="button"
                          onClick={() => {
                            const newType = typeItem.val as any;
                            const updated = { ...formData, itemType: newType };
                            if (newType === "finished_good") {
                              updated.isSellable = true;
                              updated.isTrackingStock = true;
                              updated.isInventoryTracked = true;
                            } else if (newType === "semi_finished") {
                              updated.isSellable = false;
                              updated.isTrackingStock = true;
                              updated.isInventoryTracked = true;
                              updated.isProduced = true;
                            } else if (newType === "raw_material") {
                              updated.isSellable = false;
                              updated.isTrackingStock = true;
                              updated.isInventoryTracked = true;
                              updated.isPurchasable = true;
                            } else if (newType === "consumable" || newType === "fixed_tool") {
                              updated.isSellable = false;
                              updated.isTrackingStock = true;
                              updated.isInventoryTracked = true;
                              updated.isPurchasable = true;
                            }
                            setFormData(updated);
                          }}
                          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                            isActive
                              ? "bg-slate-900 text-white border-slate-900 dark:bg-[#3F73F7] dark:border-[#3F73F7] dark:text-white shadow-sm"
                              : "bg-slate-50/70 dark:bg-dark-bg border-slate-200/80 dark:border-[#333338] text-slate-700 dark:text-slate-300 hover:border-slate-400"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-bold">{typeItem.label}</span>
                            {isActive && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <p
                            className={`text-[10px] leading-relaxed ${
                              isActive ? "opacity-90 font-medium" : "opacity-60"
                            }`}
                          >
                            {typeItem.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Card 2: Dual-UOM (Satuan Ecer, Grosir, dan Rasio Konversi) */}
              <div className={bentoCardClass}>
                <h3 className={cardHeadingClass}>
                  <Layers className="w-4 h-4 text-[#3F73F7]" />
                  <span>Dual-UOM (Multi-Satuan Fisik & Rasio Konversi)</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={labelClass}>Satuan Ecer (Base Unit) *</label>
                      <button
                        type="button"
                        onClick={() => {
                          if (isCustomBaseUnit) {
                            setIsCustomBaseUnit(false);
                            setFormData({ ...formData, baseUnit: "pcs" });
                          } else {
                            setIsCustomBaseUnit(true);
                            setFormData({ ...formData, baseUnit: "" });
                          }
                        }}
                        className="text-[11px] font-bold text-[#3F73F7] hover:underline cursor-pointer"
                      >
                        {isCustomBaseUnit
                          ? (t.itemsChooseStandardUnit || "Pilih...")
                          : (t.itemsCustomUnitOption || "+ Tambah Baru")}
                      </button>
                    </div>

                    {isCustomBaseUnit ? (
                      <Input
                        value={formData.baseUnit}
                        onChange={(e) => setFormData({ ...formData, baseUnit: e.target.value.toLowerCase() })}
                        placeholder="Ketik satuan dasar (cth: ikat, lembar)..."
                        className="h-10 rounded-xl text-xs font-bold"
                        autoFocus
                      />
                    ) : (
                      <Select
                        value={formData.baseUnit}
                        onValueChange={(val) => val && setFormData({ ...formData, baseUnit: val })}
                      >
                        <SelectTrigger className="w-full h-10 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-200/80 dark:border-dark-border text-xs font-semibold">
                          <SelectValue placeholder="Satuan Terkecil" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl shadow-xl max-h-60">
                          {standardBaseUnits.map((u) => (
                            <SelectItem key={u.value} value={u.value}>
                              {u.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Satuan terkecil transaksi kasir.
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={labelClass}>Satuan Grosir (Box Unit)</label>
                      <button
                        type="button"
                        onClick={() => {
                          if (isCustomBoxUnit) {
                            setIsCustomBoxUnit(false);
                            setFormData({ ...formData, boxUnit: "kardus" });
                          } else {
                            setIsCustomBoxUnit(true);
                            setFormData({ ...formData, boxUnit: "" });
                          }
                        }}
                        className="text-[11px] font-bold text-[#3F73F7] hover:underline cursor-pointer"
                      >
                        {isCustomBoxUnit
                          ? (t.itemsChooseStandardUnit || "Pilih...")
                          : (t.itemsCustomUnitOption || "+ Tambah Baru")}
                      </button>
                    </div>

                    {isCustomBoxUnit ? (
                      <Input
                        value={formData.boxUnit}
                        onChange={(e) => setFormData({ ...formData, boxUnit: e.target.value.toLowerCase() })}
                        placeholder="Ketik satuan grosir (cth: karung 50kg, bal)..."
                        className="h-10 rounded-xl text-xs font-bold"
                        autoFocus
                      />
                    ) : (
                      <Select
                        value={formData.boxUnit}
                        onValueChange={(val) => val && setFormData({ ...formData, boxUnit: val })}
                      >
                        <SelectTrigger className="w-full h-10 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-200/80 dark:border-dark-border text-xs font-semibold">
                          <SelectValue placeholder="Satuan Pembelian" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl shadow-xl max-h-60">
                          {standardBoxUnits.map((u) => (
                            <SelectItem key={u.value} value={u.value}>
                              {u.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Satuan pengiriman gudang/supplier.
                    </span>
                  </div>

                  <div>
                    <label className={labelClass}>Rasio Konversi</label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.conversionRate}
                      onChange={(e) => setFormData({ ...formData, conversionRate: Number(e.target.value) || 1 })}
                      placeholder="40"
                      className="h-10 rounded-xl font-bold"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Isi per 1 {formData.boxUnit || "Box"}.
                    </span>
                  </div>
                </div>

                {/* Conversion Visual Pill */}
                <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-200/60 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-200 flex items-center justify-between">
                  <span className="font-medium">Aturan Multi-Satuan:</span>
                  <span className="font-bold font-mono">
                    1 {formData.boxUnit || "Box"} = {formData.conversionRate || 1} {formData.baseUnit || "Pcs"}
                  </span>
                </div>
              </div>

              {/* Card 3: Penetapan Harga & Profit Matrix (With Dual-UOM Kulakan Calculator) */}
              <div className={bentoCardClass}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className={cardHeadingClass}>
                    <DollarSign className="w-4 h-4 text-[#3F73F7]" />
                    <span>Penetapan Harga, HPP & Margin</span>
                  </h3>
                  {formData.conversionRate > 1 && (
                    <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-dark-bg rounded-xl border border-slate-200/80 dark:border-[#333338] self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setCostCalculationMode("unit")}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          costCalculationMode === "unit"
                            ? "bg-white dark:bg-[#3F73F7] text-slate-900 dark:text-white shadow-xs"
                            : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        Input per {currentPriceUnitLabel}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCostCalculationMode("pack")}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          costCalculationMode === "pack"
                            ? "bg-white dark:bg-[#3F73F7] text-slate-900 dark:text-white shadow-xs"
                            : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        <Calculator className="w-3 h-3" />
                        <span>Kalkulator Kulakan ({formData.boxUnit || "Dus"})</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* If Kulakan calculation mode is active */}
                {formData.conversionRate > 1 && costCalculationMode === "pack" && (
                  <div className="p-4 bg-primary/5 dark:bg-primary/10 rounded-2xl border border-primary/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Boxes className="w-4 h-4 text-primary" />
                        Kalkulator HPP dari Pembelian per {formData.boxUnit || "Dus"} (Isi {formData.conversionRate} {formData.baseUnit})
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">
                          Harga Beli per 1 {formData.boxUnit || "Dus"}
                        </label>
                        <CurrencyInput
                          value={packBuyPrice}
                          onChange={(val) => {
                            setPackBuyPrice(val);
                            const totalPack = val + packFreightExtra;
                            const unitCost = Math.round(totalPack / (formData.conversionRate || 1));
                            setFormData((prev) => ({ ...prev, standardCost: unitCost }));
                          }}
                          placeholder="Contoh: 120000"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">
                          Ongkir / Biaya Simpan per {formData.boxUnit || "Dus"} (Opsional)
                        </label>
                        <CurrencyInput
                          value={packFreightExtra}
                          onChange={(val) => {
                            setPackFreightExtra(val);
                            const totalPack = packBuyPrice + val;
                            const unitCost = Math.round(totalPack / (formData.conversionRate || 1));
                            setFormData((prev) => ({ ...prev, standardCost: unitCost }));
                          }}
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="text-slate-500">Hasil HPP per {currentPriceUnitLabel}:</span>
                      <span className="font-mono font-bold text-primary">
                        Rp {formData.standardCost.toLocaleString("id-ID")} / {currentPriceUnitLabel}
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Harga Modal HPP */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className={labelClass}>
                        Harga Modal HPP (/{currentPriceUnitLabel})
                      </label>
                      <span className="text-[10px] text-slate-400 font-semibold">(Opsional)</span>
                    </div>
                    <CurrencyInput
                      value={formData.standardCost}
                      onChange={(val) => setFormData({ ...formData, standardCost: val })}
                      placeholder="0"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Dapat terisi otomatis via faktur pembelian (PO).
                    </span>
                  </div>

                  {/* Harga Jual Ecer */}
                  <div>
                    <label className={labelClass}>
                      Harga Jual (/{currentPriceUnitLabel}) *
                    </label>
                    <CurrencyInput
                      value={formData.sellPrice}
                      onChange={(val) => setFormData({ ...formData, sellPrice: val })}
                      placeholder="0"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Harga dasar yang dipungut kasir per {currentPriceUnitLabel}.
                    </span>
                  </div>
                </div>

                {/* Harga Jual Grosir / Dus (Optional when conversionRate > 1) */}
                {formData.conversionRate > 1 && (
                  <div className="p-3.5 bg-slate-50 dark:bg-dark-bg/60 rounded-2xl border border-slate-200/70 dark:border-[#303035] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-blue-500" />
                        Harga Jual Grosir / 1 {formData.boxUnit || "Dus"} (Opsional)
                      </label>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        Harga Normal Ecer: Rp {(formData.sellPrice * formData.conversionRate).toLocaleString("id-ID")}
                      </span>
                    </div>
                    <CurrencyInput
                      value={formData.boxSellPrice}
                      onChange={(val) => setFormData({ ...formData, boxSellPrice: val })}
                      placeholder={String(formData.sellPrice * formData.conversionRate || 0)}
                    />
                    <span className="text-[10px] text-slate-400 block">
                      Gunakan jika harga jual 1 {formData.boxUnit} utuh lebih murah daripada beli eceran ({formData.conversionRate}x {formData.baseUnit}).
                    </span>
                  </div>
                )}

                {/* Real-time Profit Margin Matrix Banner */}
                <div className="p-4 bg-slate-50 dark:bg-[#1B1B1E] rounded-2xl border border-slate-200/80 dark:border-[#303035] flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Laba Kotor per {currentPriceUnitLabel}
                    </span>
                    <p
                      className={`font-mono font-extrabold text-base ${
                        unitProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
                      }`}
                    >
                      Rp {unitProfit.toLocaleString("id-ID")}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">
                      Persentase Margin
                    </span>
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black ${
                        unitProfit >= 0
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                    >
                      {unitProfit >= 0 ? `+${marginPercent}%` : `${marginPercent}%`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 4: 5 Capability Flags & Karakteristik Operasional */}
              <div className={bentoCardClass}>
                <div className="flex items-center justify-between">
                  <h3 className={cardHeadingClass}>
                    <Boxes className="w-4 h-4 text-[#3F73F7]" />
                    <span>5 Kemampuan Operasional (Capabilities)</span>
                  </h3>
                  <span className="text-[11px] font-semibold text-slate-400">Prinsip Odoo Lean Master</span>
                </div>

                <div className="space-y-3">
                  {/* 1. Dapat Dijual di Kasir (is_sellable) */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 dark:border-[#2D2D32] bg-slate-50/50 dark:bg-[#1B1B1E]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <ShoppingCart className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          <span>Dapat Dijual di Kasir (POS)</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-mono">is_sellable</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Muncul di katalog pencarian kasir POS untuk ditransaksikan langsung ke pelanggan.
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={formData.isSellable}
                      onCheckedChange={(checked) => setFormData({ ...formData, isSellable: checked })}
                    />
                  </div>

                  {/* 2. Lacak Saldo Stok Fisik (is_tracking_stock) */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 dark:border-[#2D2D32] bg-slate-50/50 dark:bg-[#1B1B1E]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Boxes className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          <span>Lacak Saldo Stok Fisik (Inventory Ledger)</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-mono">is_tracking_stock</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Setiap pergerakan masuk/keluar dicatat ke buku besar mutasi stok double-entry.
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={formData.isTrackingStock}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          isTrackingStock: checked,
                          isInventoryTracked: checked,
                        })
                      }
                    />
                  </div>

                  {/* 3. Hasil Produksi Dapur / BOM (is_produced) */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 dark:border-[#2D2D32] bg-slate-50/50 dark:bg-[#1B1B1E]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                        <ChefHat className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          <span>Dihasilkan dari Produksi / Resep Dapur</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 font-mono">is_produced</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Dibuat melalui modul produksi dapur (BOM) atau perakitan bahan baku.
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={formData.isProduced}
                      onCheckedChange={(checked) => setFormData({ ...formData, isProduced: checked })}
                    />
                  </div>

                  {/* 4. Dapat Dibeli dari Supplier / PO (is_purchasable) */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 dark:border-[#2D2D32] bg-slate-50/50 dark:bg-[#1B1B1E]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Truck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          <span>Dapat Dibeli dari Supplier (Procurement / PO)</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 font-mono">is_purchasable</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Dapat dimasukkan ke dokumen Purchase Order dan penerimaan barang dari vendor.
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={formData.isPurchasable}
                      onCheckedChange={(checked) => setFormData({ ...formData, isPurchasable: checked })}
                    />
                  </div>

                  {/* 5. Perlu Proses Thawing Beku (is_thawable) */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 dark:border-[#2D2D32] bg-slate-50/50 dark:bg-[#1B1B1E]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                        <Snowflake className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          <span>Perlu Pencairan / Thawing Beku</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300 font-mono">is_thawable</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Item beku yang membutuhkan waktu persiapan pencairan sebelum siap diolah/dijual.
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={formData.isThawable}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          isThawable: checked,
                          requiresThaw: checked,
                        })
                      }
                    />
                  </div>

                  {/* Batas Minimum Stok Alert */}
                  {formData.isTrackingStock && (
                    <div className="p-3.5 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 space-y-2 mt-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          <span>Peringatan Stok Menipis (Min. Stock Alert)</span>
                        </label>
                        <span className="text-[10px] text-slate-400 font-mono">dalam {formData.baseUnit || "Pcs"}</span>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        value={formData.minStockAlert}
                        onChange={(e) =>
                          setFormData({ ...formData, minStockAlert: parseInt(e.target.value) || 0 })
                        }
                        className="h-10 text-xs rounded-xl font-mono font-bold"
                        placeholder="10"
                      />
                      <p className="text-[10px] text-slate-500">
                        Sistem akan memberikan tanda peringatan visual saat stok fisik menyentuh atau berada di bawah nilai ini.
                      </p>
                    </div>
                  )}

                  {/* Input Stok Fisik Awal (Hanya saat Buat Baru) */}
                  {formData.isTrackingStock && currentView === "new" && (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-dark-border space-y-3 mt-3">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <Boxes className="w-4 h-4 text-amber-500" />
                        Input Stok Fisik Awal di Outlet (Opsional)
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            Stok Kemasan Utuh ({formData.boxUnit})
                          </label>
                          <Input
                            type="number"
                            min={0}
                            value={formData.initialStockSealed}
                            onChange={(e) =>
                              setFormData({ ...formData, initialStockSealed: parseInt(e.target.value) || 0 })
                            }
                            className="h-10 text-xs rounded-xl"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            Stok Eceran / Lepas ({formData.baseUnit})
                          </label>
                          <Input
                            type="number"
                            min={0}
                            value={formData.initialStockLoose}
                            onChange={(e) =>
                              setFormData({ ...formData, initialStockLoose: parseInt(e.target.value) || 0 })
                            }
                            className="h-10 text-xs rounded-xl"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN (33% Width / lg:col-span-4): Sidebar, Media, Status, & Live POS Card Preview ── */}
            <div className="lg:col-span-4 space-y-6">
              {/* Card 5: Media / Foto Produk */}
              <div className={bentoSidebarCardClass}>
                <h3 className={cardHeadingClass}>
                  <Upload className="w-4 h-4 text-[#3F73F7]" />
                  <span>Foto & Gambar Item</span>
                </h3>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleSelectImageFile(e.dataTransfer.files[0]);
                    }
                  }}
                  className={`relative w-full h-44 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center overflow-hidden transition-all duration-200 cursor-pointer ${
                    dragActive
                      ? "border-[#3F73F7] bg-blue-50/20"
                      : formData.imageUrl
                      ? "border-emerald-500/50 bg-emerald-500/[0.02]"
                      : "border-slate-300 dark:border-dark-border hover:border-slate-400 bg-slate-50/50 dark:bg-dark-bg"
                  }`}
                >
                  <input
                    type="file"
                    id="item-image-file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleSelectImageFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />

                  {uploadingImage ? (
                    <div className="flex flex-col items-center space-y-2">
                      <div className="w-7 h-7 border-2 border-slate-300 border-t-[#3F73F7] rounded-full animate-spin" />
                      <span className="text-xs font-bold text-slate-500">Mengunggah gambar...</span>
                    </div>
                  ) : formData.imageUrl ? (
                    <div className="relative w-full h-full group">
                      <img
                        src={getImageUrl(formData.imageUrl)}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => document.getElementById("item-image-file")?.click()}
                          className="rounded-full text-xs font-bold"
                        >
                          Ganti
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={handleRemoveImage}
                          className="rounded-full w-8 h-8"
                          title="Hapus Gambar"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => document.getElementById("item-image-file")?.click()}
                      className="text-center p-4 space-y-2"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 mx-auto flex items-center justify-center">
                        <Upload className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                        Pilih atau seret foto ke sini
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Mendukung PNG, JPG, WebP hingga 5MB
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 6: Status Operasional */}
              <div className={bentoSidebarCardClass}>
                <h3 className={cardHeadingClass}>
                  <Tag className="w-4 h-4 text-[#3F73F7]" />
                  <span>Status Operasional</span>
                </h3>

                <div className="space-y-2">
                  {[
                    { val: "active", label: "Aktif", desc: "Dapat ditransaksikan di seluruh modul." },
                    { val: "inactive", label: "Non-aktif", desc: "Disembunyikan sementara dari kasir." },
                    { val: "discontinued", label: "Dihentikan", desc: "Diarsipkan dan tidak lagi dijual." },
                  ].map((st) => {
                    const isStActive = formData.status === st.val;
                    return (
                      <button
                        key={st.val}
                        type="button"
                        onClick={() => setFormData({ ...formData, status: st.val })}
                        className={`w-full p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                          isStActive
                            ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 shadow-sm"
                            : "bg-slate-50/70 dark:bg-dark-bg border-slate-200/80 dark:border-[#333338] text-slate-700 dark:text-slate-300 hover:border-slate-400"
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold">{st.label}</div>
                          <div className={`text-[10px] ${isStActive ? "opacity-80" : "opacity-50"}`}>
                            {st.desc}
                          </div>
                        </div>
                        {isStActive && <Check className="w-4 h-4" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card 7: Live POS Card Preview */}
              <div className={bentoSidebarCardClass}>
                <h3 className={cardHeadingClass}>
                  <Eye className="w-4 h-4 text-[#3F73F7]" />
                  <span>Preview Kartu Kasir POS</span>
                </h3>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1B1B1E] border border-slate-200/80 dark:border-dark-border space-y-3">
                  <div className="w-full h-28 rounded-xl bg-slate-200 dark:bg-dark-card overflow-hidden relative flex items-center justify-center">
                    <ErpImage src={formData.imageUrl} alt="Preview" />
                    {formData.requiresThaw && (
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-600 text-white shadow-sm flex items-center gap-1">
                        <Snowflake className="w-2.5 h-2.5" /> Thawed
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                      {formData.name || "Nama Produk Kasir"}
                    </div>
                    <div className="text-[11px] font-mono font-bold text-[#3F73F7] mt-0.5">
                      Rp {formData.sellPrice.toLocaleString("id-ID")}{" "}
                      <span className="text-[9px] text-slate-400 font-normal">/{formData.baseUnit || "pcs"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* ── CATEGORY MANAGEMENT MODAL ── */}
        <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
          <DialogContent className="sm:max-w-md rounded-[28px] p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Tag className="w-5 h-5 text-[#3F73F7]" />
                Kelola Kategori Master
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Nama kategori baru..."
                    className="h-10 rounded-xl flex-1 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreateCategory();
                      }
                    }}
                  />
                  <Select
                    value={newCategoryType}
                    onValueChange={(val: any) => setNewCategoryType(val)}
                  >
                    <SelectTrigger className="w-full sm:w-40 h-10 rounded-xl text-xs">
                      <SelectValue placeholder="Tipe Kategori" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-xl">
                      <SelectItem value="finished_good">Produk Jadi</SelectItem>
                      <SelectItem value="raw_material">Bahan Baku</SelectItem>
                      <SelectItem value="consumable">Kemasan/Alat</SelectItem>
                      <SelectItem value="fixed_tool">Aset Fisik</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleCreateCategory}
                    className="h-10 rounded-xl bg-[#3F73F7] text-white text-xs font-bold"
                  >
                    Tambah
                  </Button>
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1.5 divide-y divide-slate-100 dark:divide-white/5">
                {categories.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400">
                    Belum ada kategori yang dibuat.
                  </div>
                ) : (
                  categories.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between py-2 px-1 text-sm text-slate-700 dark:text-slate-300"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs">{c.name}</span>
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase bg-slate-100 dark:bg-white/10 text-slate-500">
                          {c.category_type === "raw_material"
                            ? "Bahan Baku"
                            : c.category_type === "consumable"
                            ? "Kemasan"
                            : c.category_type === "fixed_tool"
                            ? "Aset"
                            : "Produk"}
                        </span>
                        <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-[#3F73F7]/10 text-[#3F73F7]">
                          {c.item_count || 0} item
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePromptDeleteCategory(c)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                        title="Hapus Kategori"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCategoryModalOpen(false)}
                className="rounded-full w-full"
              >
                Tutup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── CONFIRM DELETE CATEGORY DIALOG (SAFEGUARD) ── */}
        <ConfirmDialog
          isOpen={Boolean(categoryToDelete)}
          onClose={() => setCategoryToDelete(null)}
          onConfirm={handleConfirmDeleteCategory}
          loading={isDeletingCategory}
          variant="destructive"
          title={`Hapus Kategori "${categoryToDelete?.name || ""}"?`}
          description={
            (categoryToDelete?.item_count || 0) > 0
              ? `Peringatan: Kategori ini sedang digunakan oleh ${categoryToDelete?.item_count} item produk. Jika dihapus, seluruh item tersebut akan kehilangan kategori (menjadi Uncategorized). Lanjutkan penghapusan?`
              : "Kategori ini belum digunakan oleh produk mana pun dan akan dihapus secara permanen dari daftar."
          }
          confirmText="Hapus Kategori"
          cancelText="Batal"
        />
      </div>
    );
  }

  // =========================================================================
  // RENDER MASTER CATALOG DATA VIEW
  // =========================================================================
  return (
    <div className="space-y-6 text-left transition-all relative">
      {/* ── HEADER BANNER (FRAMELESS - RULE 17) ── */}
      <div className="border-b border-slate-200/80 dark:border-[#2E2E34] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#3F73F7]/10 dark:bg-[#3F73F7]/20 flex items-center justify-center text-[#3F73F7]">
              <Package className="w-5 h-5" />
            </div>
            <span>{t.itemsTitle || "Master Data & Katalog Item"}</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-1">
            {t.itemsDesc || "Katalog master terpadu produk jadi, bahan baku dapur, kemasan, dan aset fisik seluruh unit usaha"}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {!isItemAdmin && (
            <span className="px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 font-bold text-xs flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              {t.itemsReadOnlyBadge || "Mode Baca (Read-Only)"}
            </span>
          )}
          {isItemAdmin && (
            <Button
              variant="outline"
              onClick={() => setIsCategoryModalOpen(true)}
              className="rounded-full gap-2 border-slate-200 dark:border-dark-border text-xs font-semibold"
            >
              <Tag className="w-4 h-4" />
              {t.itemsManageCategories || "Kelola Kategori"}
            </Button>
          )}
        </div>
      </div>

      {/* ── TOP KPI QUICK-FILTER CARDS STRIP ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Card 1: Action Add Card (Only for Owners/Admins) */}
        {isItemAdmin ? (
          <button
            type="button"
            onClick={handleOpenCreateWizard}
            className="p-3.5 rounded-2xl border-2 border-dashed border-[#b8e635] bg-[#E2FF66]/15 dark:bg-[#E2FF66]/10 hover:bg-[#E2FF66]/25 dark:hover:bg-[#E2FF66]/20 transition-all cursor-pointer flex items-center justify-between text-left group active:scale-[0.98] shadow-xs"
          >
            <div className="text-left flex-1 min-w-0 pr-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-[#E2FF66] block mb-0.5 text-left">
                {t.itemsAddWizard || "TAMBAH ITEM"}
              </span>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white group-hover:translate-x-0.5 transition-transform text-left truncate">
                <Package className="w-3.5 h-3.5 text-slate-700 dark:text-[#E2FF66] shrink-0" />
                <span className="truncate">{t.itemsAddWizardSub || "Panduan Wizard"}</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-[#E2FF66] text-slate-950 flex items-center justify-center font-bold shadow-sm group-hover:rotate-90 transition-transform shrink-0">
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </div>
          </button>
        ) : (
          <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-dark-border bg-slate-50/60 dark:bg-dark-card text-slate-500 flex items-center justify-between">
            <div className="text-left flex-1 min-w-0 pr-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                {t.itemsReadOnlyBadge || "MODE BACA"}
              </span>
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                Katalog Terpusat Owner
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-200/70 dark:bg-white/10 text-slate-500 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
        )}

        {/* Card 2: Total Master Item */}
        <div className="p-3.5 rounded-2xl border bg-white dark:bg-dark-card border-slate-200/80 dark:border-dark-border text-slate-700 dark:text-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
              {t.itemsTotalMaster || "Total Master Item"}
            </span>
            <span className="text-lg font-semibold font-mono text-slate-900 dark:text-slate-100">
              {kpiMetrics.total}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#252528] flex items-center justify-center text-slate-600 dark:text-slate-300">
            <Boxes className="w-4 h-4" />
          </div>
        </div>

        {/* Card 3: Produk Siap Jual */}
        <div className="p-3.5 rounded-2xl border bg-white dark:bg-dark-card border-slate-200/80 dark:border-dark-border text-slate-700 dark:text-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-0.5">
              {t.itemsFinishedGoods || "Produk Siap Jual"}
            </span>
            <span className="text-lg font-semibold font-mono text-emerald-600 dark:text-emerald-400">
              {kpiMetrics.finished}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        {/* Card 4: Bahan Baku Dapur */}
        <div className="p-3.5 rounded-2xl border bg-white dark:bg-dark-card border-slate-200/80 dark:border-dark-border text-slate-700 dark:text-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 block mb-0.5">
              {t.itemsRawMaterials || "Bahan Baku Dapur"}
            </span>
            <span className="text-lg font-semibold font-mono text-amber-600 dark:text-amber-400">
              {kpiMetrics.raw}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Layers className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* ── CONTROL BAR (Search & Unified 1-Popup Multi-Column Filter) ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search Bar - Expands to fill available space */}
        <div className="flex-1">
          <ErpSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t.itemsSearchPlaceholder || "Cari nama item, SKU, atau barcode... (Ketik '/' untuk cari)"}
          />
        </div>

        {/* ── UNIFIED REUSABLE POPUP FILTER COMPONENT (ErpFilterPopover) ── */}
        <ErpFilterPopover
          activeCount={activeFilterCount}
          onResetAll={handleResetFilters}
          title={t.itemsFilterTitle || "Filter Kriteria Katalog Master"}
          resetLabel={t.itemsResetFilter || "Reset Filter"}
          filterButtonLabel={t.itemsFilterButton || "Filter Data"}
          columnGroups={[
            {
              id: "item_type",
              title: t.itemsFilterDomainType || "Tipe Domain",
              type: "multi",
              selectedValues: selectedTypes,
              onToggleMulti: (key) => {
                setSelectedTypes((prev) =>
                  prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
                );
              },
              options: [
                { key: "finished_good", label: t.itemsFinishedGoods || "Produk Jadi (POS)", count: kpiMetrics.finished },
                { key: "raw_material", label: t.itemsRawMaterials || "Bahan Baku Dapur", count: kpiMetrics.raw },
                { key: "consumable", label: t.itemsToolsPackaging || "Kemasan / Alat", count: kpiMetrics.consumables },
                { key: "fixed_tool", label: t.itemsPhysicalAssets || "Aset Fisik" },
              ],
            },
            {
              id: "categories",
              title: t.itemsFilterCategory || "Kategori Master",
              type: "multi",
              selectedValues: selectedCategories,
              onToggleMulti: (key) => {
                setSelectedCategories((prev) =>
                  prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
                );
              },
              options: categories.map((c) => ({
                key: c.id,
                label: c.name,
                count: c.item_count || 0,
              })),
            },
            {
              id: "status",
              title: t.itemsFilterStatus || "Status Operasional",
              type: "multi",
              selectedValues: selectedStatuses,
              onToggleMulti: (key) => {
                setSelectedStatuses((prev) =>
                  prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
                );
              },
              options: [
                { key: "active", label: t.itemsStatusActive || "Aktif", count: kpiMetrics.active },
                { key: "inactive", label: t.itemsStatusInactive || "Non-aktif (Arsip)" },
                { key: "discontinued", label: t.itemsStatusDiscontinued || "Dihentikan" },
              ],
            },
          ]}
        />
      </div>

      {/* ── MASTER DATA TABLE (NON-CLICKABLE ROWS) ── */}
      <ErpDataTable
        columns={columns}
        data={displayedItems}
        keyExtractor={(item) => item.id}
        loading={loading}
        emptyText={t.itemsNoData || "Tidak ada master item yang sesuai dengan kriteria pencarian atau filter."}
      />


      {/* ── CATEGORY MANAGEMENT MODAL ── */}
      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent className="sm:max-w-md rounded-[28px] p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Tag className="w-5 h-5 text-[#3F73F7]" />
              Kelola Kategori Master
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nama kategori baru..."
                  className="h-10 rounded-xl flex-1 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateCategory();
                    }
                  }}
                />
                <Select
                  value={newCategoryType}
                  onValueChange={(val: any) => setNewCategoryType(val)}
                >
                  <SelectTrigger className="w-full sm:w-40 h-10 rounded-xl text-xs">
                    <SelectValue placeholder="Tipe Kategori" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-xl">
                    <SelectItem value="finished_good">Produk Jadi</SelectItem>
                    <SelectItem value="raw_material">Bahan Baku</SelectItem>
                    <SelectItem value="consumable">Kemasan/Alat</SelectItem>
                    <SelectItem value="fixed_tool">Aset Fisik</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleCreateCategory}
                  className="h-10 rounded-xl bg-[#3F73F7] text-white text-xs font-bold"
                >
                  Tambah
                </Button>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 divide-y divide-slate-100 dark:divide-white/5">
              {categories.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  Belum ada kategori yang dibuat.
                </div>
              ) : (
                categories.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between py-2 px-1 text-sm text-slate-700 dark:text-slate-300"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs">{c.name}</span>
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase bg-slate-100 dark:bg-white/10 text-slate-500">
                        {c.category_type === "raw_material"
                          ? "Bahan Baku"
                          : c.category_type === "consumable"
                          ? "Kemasan"
                          : c.category_type === "fixed_tool"
                          ? "Aset"
                          : "Produk"}
                      </span>
                      <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-[#3F73F7]/10 text-[#3F73F7]">
                        {c.item_count || 0} item
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePromptDeleteCategory(c)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                      title="Hapus Kategori"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCategoryModalOpen(false)}
              className="rounded-full w-full"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CONFIRM DELETE CATEGORY DIALOG (SAFEGUARD) ── */}
      <ConfirmDialog
        isOpen={Boolean(categoryToDelete)}
        onClose={() => setCategoryToDelete(null)}
        onConfirm={handleConfirmDeleteCategory}
        loading={isDeletingCategory}
        variant="destructive"
        title={`Hapus Kategori "${categoryToDelete?.name || ""}"?`}
        description={
          (categoryToDelete?.item_count || 0) > 0
            ? `Peringatan: Kategori ini sedang digunakan oleh ${categoryToDelete?.item_count} item produk. Jika dihapus, seluruh item tersebut akan kehilangan kategori (menjadi Uncategorized). Lanjutkan penghapusan?`
            : "Kategori ini belum digunakan oleh produk mana pun dan akan dihapus secara permanen dari daftar."
        }
        confirmText="Hapus Kategori"
        cancelText="Batal"
      />
    </div>
  );
}

