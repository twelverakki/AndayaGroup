import React, { useState, useEffect, useMemo } from "react";
import { ErpDataTable, type ColumnDef } from "../../components/ErpDataTable";
import { ErpSearchBar } from "../../components/ErpSearchBar";
import { CurrencyInput } from "../../components/CurrencyInput";
import { api } from "../../lib/api";
import { toast } from "../../components/ui/sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Checkbox } from "../../components/ui/checkbox";
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
} from "lucide-react";
import { useLanguageStore, translations } from "../../lib/i18n";
import { useAuthStore } from "../../lib/store";

export interface UnifiedItem {
  id: string;
  business_id: string;
  category_id?: string;
  sku?: string;
  name: string;
  item_type: "finished_good" | "raw_material" | "consumable" | "fixed_tool";
  is_sellable: boolean;
  is_inventory_tracked: boolean;
  requires_thaw?: boolean;
  base_unit: string;
  box_unit: string;
  conversion_rate: number;
  sell_price: number;
  box_sell_price: number;
  standard_cost: number;
  status: string;
  category_name?: string;
  image_url?: string;
  qty_sealed: number;
  qty_loose: number;
}

export interface Category {
  id: string;
  name: string;
}

export interface ItemListModuleProps {
  initialView?: "master" | "new" | "edit";
  initialItem?: UnifiedItem | null;
}

export function ItemListModule({
  initialView = "master",
  initialItem = null,
}: ItemListModuleProps) {
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;
  const { activeContext } = useAuthStore();

  const isStaff = activeContext?.role === "staff" || activeContext?.role === "kasir";

  // View Navigation: "master" | "new" | "edit"
  const [currentView, setCurrentView] = useState<"master" | "new" | "edit">(initialView);
  const [editingItem, setEditingItem] = useState<UnifiedItem | null>(initialItem);

  // Data State
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("active");

  // Category Modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>("");

  // Dedicated Form State
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    categoryId: "none",
    itemType: "finished_good" as UnifiedItem["item_type"],
    baseUnit: "pcs",
    boxUnit: "kardus",
    conversionRate: 1,
    sellPrice: 0,
    boxSellPrice: 0,
    standardCost: 0,
    isSellable: true,
    isInventoryTracked: true,
    requiresThaw: false,
    initialStockSealed: 0,
    initialStockLoose: 0,
    status: "active",
    imageUrl: "",
  });

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Fetch Items & Categories
  const fetchItems = async () => {
    setLoading(true);
    try {
      const typeParam = selectedType !== "all" ? `?item_type=${selectedType}` : "";
      const res = await api.get(`/items${typeParam}`);
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
  }, [selectedType]);

  useEffect(() => {
    fetchCategories();
  }, []);

  // Form Initializer
  const handleOpenCreate = () => {
    if (isStaff) {
      toast.error("Akses Dibatasi: Staf tidak memiliki izin menambah item master");
      return;
    }
    setFormData({
      name: "",
      sku: "",
      categoryId: "none",
      itemType: "finished_good",
      baseUnit: "pcs",
      boxUnit: "kardus",
      conversionRate: 1,
      sellPrice: 0,
      boxSellPrice: 0,
      standardCost: 0,
      isSellable: true,
      isInventoryTracked: true,
      requiresThaw: false,
      initialStockSealed: 0,
      initialStockLoose: 0,
      status: "active",
      imageUrl: "",
    });
    setEditingItem(null);
    setCurrentView("new");
  };

  const handleOpenEdit = (item: UnifiedItem) => {
    if (isStaff) {
      toast.error("Akses Dibatasi: Staf tidak memiliki izin mengedit item master");
      return;
    }
    setEditingItem(item);
    setFormData({
      name: item.name,
      sku: item.sku || "",
      categoryId: item.category_id || "none",
      itemType: item.item_type,
      baseUnit: item.base_unit || "pcs",
      boxUnit: item.box_unit || "kardus",
      conversionRate: item.conversion_rate || 1,
      sellPrice: item.sell_price || 0,
      boxSellPrice: item.box_sell_price || 0,
      standardCost: item.standard_cost || 0,
      isSellable: item.is_sellable !== false,
      isInventoryTracked: item.is_inventory_tracked !== false,
      requiresThaw: Boolean(item.requires_thaw),
      initialStockSealed: item.qty_sealed || 0,
      initialStockLoose: item.qty_loose || 0,
      status: item.status || "active",
      imageUrl: item.image_url || "",
    });
    setCurrentView("edit");
  };

  const handleBackToMaster = () => {
    setCurrentView("master");
    setEditingItem(null);
    fetchItems();
  };

  const handleGenerateSku = () => {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const prefix = formData.itemType === "finished_good"
      ? "FG"
      : formData.itemType === "raw_material"
      ? "RAW"
      : formData.itemType === "consumable"
      ? "CSM"
      : "AST";
    setFormData((prev) => ({ ...prev, sku: `${prefix}-${randomNum}` }));
    toast.info(`SKU otomatis dibuat: ${prefix}-${randomNum}`);
  };

  // Image Upload Handler
  const handleImageUpload = async (file: File) => {
    if (!file) return;
    setUploadingImage(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      const res = await api.post("/upload", uploadFormData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data?.file_url) {
        setFormData((prev) => ({ ...prev, imageUrl: res.data.file_url }));
        toast.success("Foto produk berhasil diunggah!");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal mengunggah foto");
    } finally {
      setUploadingImage(false);
    }
  };

  // Save Item (Create or Update)
  const handleSaveItem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Nama item wajib diisi");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        sku: formData.sku.trim() || undefined,
        category_id: formData.categoryId !== "none" ? formData.categoryId : undefined,
        item_type: formData.itemType,
        base_unit: formData.baseUnit.trim() || "pcs",
        box_unit: formData.boxUnit.trim() || "kardus",
        conversion_rate: Number(formData.conversionRate) || 1,
        sell_price: formData.sellPrice,
        box_sell_price: formData.boxSellPrice || formData.sellPrice * (Number(formData.conversionRate) || 1),
        standard_cost: formData.standardCost,
        is_sellable: formData.isSellable,
        is_inventory_tracked: formData.isInventoryTracked,
        requires_thaw: formData.requiresThaw,
        initial_stock_sealed: formData.initialStockSealed,
        initial_stock_loose: formData.initialStockLoose,
        image_url: formData.imageUrl || undefined,
      };

      if (currentView === "edit" && editingItem) {
        await api.put(`/items/${editingItem.id}`, payload);
        toast.success(`Master item "${formData.name}" berhasil diperbarui!`);
      } else {
        await api.post("/items", payload);
        toast.success(`Master item baru "${formData.name}" berhasil ditambahkan!`);
      }

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
      await api.post("/categories", { name: newCategoryName.trim() });
      toast.success("Kategori baru berhasil dibuat!");
      setNewCategoryName("");
      fetchCategories();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal membuat kategori");
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    try {
      await api.delete(`/categories/${catId}`);
      toast.success("Kategori berhasil dihapus");
      fetchCategories();
      fetchItems();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus kategori");
    }
  };

  // Filtered List
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.sku && item.sku.toLowerCase().includes(q));

      const matchCategory =
        selectedCategory === "all" || item.category_id === selectedCategory;

      const matchStatus =
        selectedStatus === "all" || item.status === selectedStatus;

      return matchSearch && matchCategory && matchStatus;
    });
  }, [items, searchQuery, selectedCategory, selectedStatus]);

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
      label: "Item & Barcode / SKU",
      renderCell: (row: UnifiedItem) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-dark-card border border-slate-200 dark:border-dark-border flex items-center justify-center shrink-0 overflow-hidden text-slate-500">
            {row.image_url ? (
              <img src={row.image_url} alt={row.name} className="w-full h-full object-cover" />
            ) : (
              <Package className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              {row.name}
              {row.category_name && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-500">
                  {row.category_name}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
              <span>{row.sku || "Tanpa Barcode"}</span>
              {row.sku && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopySku(row.sku);
                  }}
                  className="hover:text-slate-900 dark:hover:text-white transition-colors p-0.5"
                  title="Salin SKU"
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
      key: "item_type",
      label: "Tipe Domain",
      renderCell: (row: UnifiedItem) => {
        switch (row.item_type) {
          case "finished_good":
            return <Badge variant="info">Produk Jadi</Badge>;
          case "raw_material":
            return <Badge variant="warning">Bahan Baku</Badge>;
          case "consumable":
            return <Badge variant="purple">Kemasan/Alat</Badge>;
          case "fixed_tool":
            return <Badge variant="secondary">Aset Fisik</Badge>;
          default:
            return <Badge variant="outline">{row.item_type}</Badge>;
        }
      },
    },
    {
      key: "stock_balance",
      label: "Saldo Stok (Dual-UOM)",
      renderCell: (row: UnifiedItem) => (
        <div className="text-xs">
          <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">
              {row.qty_sealed}
            </span>{" "}
            {row.box_unit || "Box"}
            <span className="text-slate-400">+</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">
              {row.qty_loose}
            </span>{" "}
            {row.base_unit || "Pcs"}
          </div>
          {row.conversion_rate > 1 && (
            <div className="text-[10px] text-slate-400 mt-0.5">
              1 {row.box_unit} = {row.conversion_rate} {row.base_unit}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "price_cost",
      label: "Harga Jual / Modal",
      renderCell: (row: UnifiedItem) => (
        <div className="text-xs space-y-0.5">
          <div className="font-semibold text-slate-800 dark:text-slate-200">
            Rp {row.sell_price.toLocaleString("id-ID")}{" "}
            <span className="text-[10px] text-slate-400 font-normal">/{row.base_unit}</span>
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            HPP: Rp {row.standard_cost.toLocaleString("id-ID")}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      renderCell: (row: UnifiedItem) => {
        if (row.status === "active") {
          return <Badge variant="success">Aktif</Badge>;
        }
        if (row.status === "inactive") {
          return <Badge variant="warning">Non-aktif</Badge>;
        }
        return <Badge variant="destructive">Dihentikan</Badge>;
      },
    },
    {
      key: "actions",
      label: "Aksi",
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
            <DropdownMenuItem
              onClick={() => handleOpenEdit(row)}
              className="gap-2 rounded-xl text-xs font-medium cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5 text-blue-500" />
              Edit Data Item
            </DropdownMenuItem>
            {row.sku && (
              <DropdownMenuItem
                onClick={() => handleCopySku(row.sku)}
                className="gap-2 rounded-xl text-xs font-medium cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                Salin Barcode / SKU
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Ubah Status
            </div>
            {row.status !== "active" && (
              <DropdownMenuItem
                onClick={() => handleUpdateStatus(row.id, "active")}
                className="gap-2 rounded-xl text-xs font-medium text-emerald-600 dark:text-emerald-400 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Set Aktif
              </DropdownMenuItem>
            )}
            {row.status !== "inactive" && (
              <DropdownMenuItem
                onClick={() => handleUpdateStatus(row.id, "inactive")}
                className="gap-2 rounded-xl text-xs font-medium text-amber-600 dark:text-amber-400 cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                Set Non-aktif
              </DropdownMenuItem>
            )}
            {row.status !== "discontinued" && (
              <DropdownMenuItem
                onClick={() => handleUpdateStatus(row.id, "discontinued")}
                className="gap-2 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5" />
                Set Dihentikan
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

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
      <div className="max-w-6xl mx-auto space-y-6 text-left transition-all p-1">
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
            <Button
              variant="outline"
              onClick={handleBackToMaster}
              className="rounded-full"
            >
              Batal
            </Button>
            <Button
              onClick={handleSaveItem}
              disabled={isSubmitting}
              className="rounded-full bg-[#3F73F7] hover:bg-[#3260d6] text-white shadow-md gap-2"
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
            {/* ── LEFT COLUMN (65% Width / lg:col-span-8): Primary Specifications ── */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-6">
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
                        <SelectValue placeholder="Pilih Kategori" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl shadow-xl">
                        <SelectItem value="none">Tanpa Kategori</SelectItem>
                        {categories.map((c) => (
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
                          onClick={() => setFormData({ ...formData, itemType: typeItem.val as any })}
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
                    <label className={labelClass}>Satuan Ecer (Base Unit)</label>
                    <Input
                      value={formData.baseUnit}
                      onChange={(e) => setFormData({ ...formData, baseUnit: e.target.value })}
                      placeholder="pcs / kg / porsi / butir"
                      className="h-10 rounded-xl"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Satuan terkecil transaksi kasir.
                    </span>
                  </div>

                  <div>
                    <label className={labelClass}>Satuan Grosir (Box Unit)</label>
                    <Input
                      value={formData.boxUnit}
                      onChange={(e) => setFormData({ ...formData, boxUnit: e.target.value })}
                      placeholder="kardus / bal / pack"
                      className="h-10 rounded-xl"
                    />
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

              {/* Card 3: Penetapan Harga & Profit Matrix */}
              <div className={bentoCardClass}>
                <h3 className={cardHeadingClass}>
                  <DollarSign className="w-4 h-4 text-[#3F73F7]" />
                  <span>Penetapan Harga & Margin Keuntungan</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Harga Modal HPP */}
                  <div>
                    <label className={labelClass}>
                      Harga Modal HPP (/{formData.baseUnit}) *
                    </label>
                    <CurrencyInput
                      value={formData.standardCost}
                      onChange={(val) => setFormData({ ...formData, standardCost: val })}
                      placeholder="0"
                    />
                  </div>

                  {/* Harga Jual Ecer */}
                  <div>
                    <label className={labelClass}>
                      Harga Jual Ecer (/{formData.baseUnit}) *
                    </label>
                    <CurrencyInput
                      value={formData.sellPrice}
                      onChange={(val) => setFormData({ ...formData, sellPrice: val })}
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Real-time Profit Margin Matrix Banner */}
                <div className="p-4 bg-slate-50 dark:bg-[#1B1B1E] rounded-2xl border border-slate-200/80 dark:border-[#303035] flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Laba Kotor per {formData.baseUnit}
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

              {/* Card 4: Operasional & Thawing Rules */}
              <div className={bentoCardClass}>
                <h3 className={cardHeadingClass}>
                  <Boxes className="w-4 h-4 text-[#3F73F7]" />
                  <span>Logistik & Karakteristik Operasional</span>
                </h3>

                <div className="space-y-3">
                  {/* F&B Thawing Rule */}
                  <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200/80 dark:border-dark-border hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors">
                    <Checkbox
                      checked={formData.requiresThaw}
                      onCheckedChange={(c) => setFormData({ ...formData, requiresThaw: Boolean(c) })}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <Snowflake className="w-3.5 h-3.5 text-blue-500" />
                        Perlu Proses Thawing (Defrosting Beku)
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Aktifkan untuk item beku F&B (Bakso/Ayam) yang mengalami pencairan bertahap dari pack utuh ke porsi matang.
                      </p>
                    </div>
                  </label>

                  {/* POS Sellable */}
                  <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200/80 dark:border-dark-border hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors">
                    <Checkbox
                      checked={formData.isSellable}
                      onCheckedChange={(c) => setFormData({ ...formData, isSellable: Boolean(c) })}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <ShoppingCart className="w-3.5 h-3.5 text-emerald-500" />
                        Tampilkan di Menu Kasir (Point of Sale)
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Item ini dapat dipilih kasir dan ditambahkan ke keranjang belanja POS.
                      </p>
                    </div>
                  </label>

                  {/* Track Stock */}
                  <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200/80 dark:border-dark-border hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors">
                    <Checkbox
                      checked={formData.isInventoryTracked}
                      onCheckedChange={(c) => setFormData({ ...formData, isInventoryTracked: Boolean(c) })}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <Boxes className="w-3.5 h-3.5 text-amber-500" />
                        Lacak Saldo Stok Fisik (Inventory Ledger)
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Mencatat setiap mutasi keluar/masuk ke buku besar stok double-entry.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN (35% Width / lg:col-span-4): Sidebar, Media, Status, & Live POS Card Preview ── */}
            <div className="lg:col-span-5 xl:col-span-4 space-y-6">
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
                      handleImageUpload(e.dataTransfer.files[0]);
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
                        handleImageUpload(e.target.files[0]);
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
                        src={formData.imageUrl}
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
                          onClick={() => setFormData({ ...formData, imageUrl: "" })}
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
                    {formData.imageUrl ? (
                      <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-8 h-8 text-slate-400" />
                    )}
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
              <div className="flex items-center gap-2">
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nama kategori baru..."
                  className="h-10 rounded-xl flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateCategory();
                    }
                  }}
                />
                <Button
                  onClick={handleCreateCategory}
                  className="h-10 rounded-xl bg-[#3F73F7] text-white"
                >
                  Tambah
                </Button>
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
                      <span className="font-medium">{c.name}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(c.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
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
      </div>
    );
  }

  // =========================================================================
  // RENDER MASTER TABLE VIEW
  // =========================================================================
  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* ── HEADER BANNER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#202024] p-5 rounded-[28px] border border-slate-200/80 dark:border-[#38383C] shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#3F73F7]/10 dark:bg-[#3F73F7]/20 flex items-center justify-center text-[#3F73F7]">
              <Package className="w-5 h-5" />
            </div>
            Unified Master Items Catalog
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Single Table of Truth untuk Master Produk Jadi, Bahan Mentah, Kemasan, dan Aset Fisik 4 Bisnis
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => setIsCategoryModalOpen(true)}
            className="rounded-full gap-2 border-slate-200 dark:border-dark-border"
          >
            <Tag className="w-4 h-4" />
            Kelola Kategori
          </Button>
          <Button
            onClick={handleOpenCreate}
            className="rounded-full gap-2 bg-[#3F73F7] hover:bg-[#3260d6] text-white shadow-md"
          >
            <Plus className="w-4 h-4" />
            Tambah Item Baru
          </Button>
        </div>
      </div>

      {/* ── CONTROL BAR (Search & Dropdown Filters) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="lg:col-span-2">
          <ErpSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Cari nama item, SKU, atau barcode... (Ketik '/' untuk cari)"
          />
        </div>

        {/* Domain Type Filter */}
        <Select value={selectedType} onValueChange={(val) => val && setSelectedType(val)}>
          <SelectTrigger className="w-full h-11 rounded-2xl bg-white dark:bg-dark-card border-slate-200/80 dark:border-dark-border">
            <SelectValue placeholder="Tipe Domain" />
          </SelectTrigger>
          <SelectContent className="rounded-2xl shadow-xl">
            <SelectItem value="all">Semua Tipe Domain</SelectItem>
            <SelectItem value="finished_good">Produk Jadi (Finished Good)</SelectItem>
            <SelectItem value="raw_material">Bahan Baku (Raw Material)</SelectItem>
            <SelectItem value="consumable">Kemasan/Alat (Consumable)</SelectItem>
            <SelectItem value="fixed_tool">Aset Fisik (Fixed Tool)</SelectItem>
          </SelectContent>
        </Select>

        {/* Category Filter */}
        <Select value={selectedCategory} onValueChange={(val) => val && setSelectedCategory(val)}>
          <SelectTrigger className="w-full h-11 rounded-2xl bg-white dark:bg-dark-card border-slate-200/80 dark:border-dark-border">
            <SelectValue placeholder="Kategori" />
          </SelectTrigger>
          <SelectContent className="rounded-2xl shadow-xl">
            <SelectItem value="all">Semua Kategori</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── MASTER DATA TABLE ── */}
      <ErpDataTable
        columns={columns}
        data={filteredItems}
        keyExtractor={(item) => item.id}
        loading={loading}
        emptyText="Tidak ada master item yang sesuai dengan kriteria pencarian atau filter."
        onRowClick={(item) => handleOpenEdit(item)}
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
            <div className="flex items-center gap-2">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Nama kategori baru..."
                className="h-10 rounded-xl flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateCategory();
                  }
                }}
              />
              <Button
                onClick={handleCreateCategory}
                className="h-10 rounded-xl bg-[#3F73F7] text-white"
              >
                Tambah
              </Button>
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
                    <span className="font-medium">{c.name}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(c.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
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
    </div>
  );
}
