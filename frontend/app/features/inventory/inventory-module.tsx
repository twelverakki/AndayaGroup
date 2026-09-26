import { useState, useEffect, useRef } from "react";
import { ErpDataTable } from "../../components/ErpDataTable";
import { ErpSearchBar } from "../../components/ErpSearchBar";
import { ErpFilterPopover } from "../../components/ErpFilterPopover";
import { StockAdjustmentModal } from "../../components/StockAdjustmentModal";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ErpImage } from "../../components/ErpImage";
import { StockMatrixView } from "./stock-matrix-view";
import { api } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import {
  useLanguageStore,
  translations,
  getInventoryModes,
  getUnitTypes,
  getStatusOptions,
  formatNumberInput,
  parseNumberInput,
} from "../../lib/i18n";
import { toast } from "../../components/ui/sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../../components/ui/dropdown-menu";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "../../components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "../../components/ui/sheet";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../../components/ui/select";
import { 
  ArrowLeft, Barcode, CheckCircle2, AlertCircle, AlertTriangle,
  Info, Sparkles, Tag, DollarSign, Package, Plus, Minus, Edit3, Menu,
  Upload, X, MoreHorizontal, Search, SlidersHorizontal, ChevronDown, ArrowUpDown,
  Eye, Filter, Copy, Check, ChevronLeft, ChevronRight, LayoutGrid,
  Globe, RotateCcw, Archive, Layers, Trash2, ShieldAlert, Boxes, ExternalLink
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku?: string;
  category?: string;
  category_name?: string;
  unit_type: string;
  base_unit?: string;
  box_unit?: string;
  conversion_rate?: number;
  inventory_mode: string;
  purchase_price: number;
  standard_cost?: number;
  sell_price: number;
  box_sell_price?: number;
  current_stock: number;
  qty_sealed?: number;
  qty_loose?: number;
  min_stock_alert?: number;
  image_url?: string;
  created_at?: string;
  status: "active" | "inactive" | "discontinued";
}


interface InventoryModuleProps {
  view?: "master" | "matrix" | "new" | "edit" | "discontinued";
  product?: Product | null;
  onEditProduct?: (p: Product) => void;
  onAddNew?: () => void;
  onViewMasterItem?: (p: Product) => void;
  onNavigate?: (view: string, payload?: any) => void;
  onCancel?: () => void;
  onSuccess?: () => void;
}

export default function InventoryModule({
  view = "master",
  product = null,
  onEditProduct,
  onAddNew,
  onViewMasterItem,
  onNavigate,
  onCancel,
  onSuccess,
}: InventoryModuleProps) {
  const { activeContext } = useAuthStore();
  const { language, setLanguage } = useLanguageStore();
  const t = translations[language];

  const inventoryModes = getInventoryModes(language);
  const unitTypes = getUnitTypes(language);
  const statusOptions = getStatusOptions(language);

  const isManagerOrOwner = activeContext?.role === "manager" || activeContext?.role === "owner" || activeContext?.role === "superadmin" || activeContext?.role === "admin_gudang";
  const isStaff = activeContext?.role === "staff" || activeContext?.role === "kasir";

  const handleTriggerAdd = () => {
    if (isStaff) {
      toast.error(language === "en" ? "Access Denied: Staff cannot add or edit master products" : "Akses Dibatasi: Staf tidak memiliki izin menambah atau mengedit master data");
      return;
    }
    if (onAddNew) onAddNew();
    else if (onNavigate) onNavigate("items-add");
  };

  useEffect(() => {
    const handleMobileAdd = () => {
      handleTriggerAdd();
    };
    window.addEventListener("trigger_mobile_add", handleMobileAdd);
    return () => window.removeEventListener("trigger_mobile_add", handleMobileAdd);
  }, [onAddNew, onNavigate]);

  const handleViewMasterItem = (targetProd: Product) => {
    if (onViewMasterItem) {
      onViewMasterItem(targetProd);
    } else if (onNavigate) {
      onNavigate("items-edit", targetProd);
    }
  };

  // Search & Rich Multi-Filter States
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Unbox (Buka Dus ke Rak Etalase) Modal State
  const [itemToUnbox, setItemToUnbox] = useState<Product | null>(null);
  const [boxesToUnbox, setBoxesToUnbox] = useState<number>(1);
  const [unboxNotes, setUnboxNotes] = useState<string>("");
  const [isUnboxing, setIsUnboxing] = useState<boolean>(false);

  const [statusFilter, setStatusFilter] = useState<{
    active: boolean;
    inactive: boolean;
    discontinued: boolean;
  }>({
    active: true,
    inactive: true,
    discontinued: false,
  });
  const [filterMode, setFilterMode] = useState<string>("all");
  const [filterStock, setFilterStock] = useState<string>("all");

  // Sorting State (A-Z, Z-A, Price, Stock, Newest)
  type SortOption = "name_asc" | "name_desc" | "price_asc" | "price_desc" | "stock_desc" | "stock_asc" | "newest";
  const [sortBy, setSortBy] = useState<SortOption>("name_asc");


  // Global Keyboard Shortcut: Press '/' to focus search field
  useEffect(() => {
    if (view !== "master" && view !== "discontinued") return;
    const handleGlobalKeydown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleGlobalKeydown);
    return () => window.removeEventListener("keydown", handleGlobalKeydown);
  }, [view]);

  // Calculate active filters count (excluding category and search)
  const isCustomStatus = !statusFilter.active || !statusFilter.inactive || statusFilter.discontinued;
  const isCustomSort = sortBy !== "name_asc";
  const activeFiltersCount = 
    (isCustomStatus ? 1 : 0) + 
    (filterMode !== "all" ? 1 : 0) + 
    (filterStock !== "all" ? 1 : 0) +
    (isCustomSort ? 1 : 0);

  const handleResetFilters = () => {
    setStatusFilter({ active: true, inactive: true, discontinued: false });
    setFilterMode("all");
    setFilterStock("all");
    setSortBy("name_asc");
  };

  // Column Visibility State (Shadcn Data Table pattern with smart defaults for user-friendliness)
  const [visibleColumns, setVisibleColumns] = useState({
    image: true,
    name: true,
    sku: true,
    category: true,
    mode: false,
    buyPrice: false,
    sellPrice: true,
    stock: true,
    status: true,
    action: true,
  });



  // Header Context Menu State (Right-click on table header for column visibility)
  const [headerContextMenu, setHeaderContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Accordion Expand State (Replaces separate detail sub-page)
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  // Dynamic Floating Action Header States (3 Conditions)
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  // Category Dialog & Scroll States
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const mainContainer = document.querySelector("main");
      const scrollPos = mainContainer ? mainContainer.scrollTop : window.scrollY;
      if (scrollPos > 40) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
        setIsSearchExpanded(false);
      }
    };

    const mainContainer = document.querySelector("main");
    if (mainContainer) {
      mainContainer.addEventListener("scroll", handleScroll);
    }
    window.addEventListener("scroll", handleScroll);

    return () => {
      if (mainContainer) {
        mainContainer.removeEventListener("scroll", handleScroll);
      }
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const handleScrollCategory = (direction: "left" | "right") => {
    if (categoryScrollRef.current) {
      const scrollAmount = 240;
      categoryScrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // Domain Capability Inventory Tabs
  const [inventoryDomainTab, setInventoryDomainTab] = useState<"products" | "raw_materials" | "tool_supplies" | "stock_matrix">("products");

  // Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Ingredient Form Modal & Filter States
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<any | null>(null);
  const [deletingIngredientItem, setDeletingIngredientItem] = useState<any | null>(null);
  const [ingName, setIngName] = useState("");
  const [ingCategory, setIngCategory] = useState<"raw_material" | "tool_supplies">("raw_material");
  const [ingSubCategory, setIngSubCategory] = useState("General");
  const [isCustomIngSubCat, setIsCustomIngSubCat] = useState(false);
  const [ingUnit, setIngUnit] = useState("kg");
  const [isCustomIngUnit, setIsCustomIngUnit] = useState(false);
  const [ingStock, setIngStock] = useState("0");
  const [ingMinAlert, setIngMinAlert] = useState("5");
  const [ingCost, setIngCost] = useState("0");
  const [selectedIngredientSubCategory, setSelectedIngredientSubCategory] = useState("all");
  
  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, ingRes] = await Promise.all([
        api.get("/products"),
        api.get("/ingredients"),
      ]);
      const prodList = Array.isArray(prodRes.data) ? prodRes.data : (prodRes.data?.data || []);
      const ingList = Array.isArray(ingRes.data) ? ingRes.data : (ingRes.data?.data || []);
      setProducts(Array.isArray(prodList) ? prodList : []);
      setIngredients(Array.isArray(ingList) ? ingList : []);
    } catch (err) {
      console.error("Failed to load inventory data:", err);
      toast.error(t.errorFetchProducts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    setExpandedProductId(null);
  }, [activeContext, view]);

  // Quick Action Unbox Handler (Dual-UOM: Buka Dus ke Rak Etalase)
  const handlePromptUnbox = (p: Product) => {
    if (isStaff) {
      toast.error(language === "en" ? "Access Denied: Staff cannot unbox inventory" : "Akses Dibatasi: Staf kasir tidak memiliki izin membongkar stok");
      return;
    }
    const sealedStock = Number(p.qty_sealed ?? 0);
    if (sealedStock <= 0) {
      toast.error(
        language === "en"
          ? `Stock ${p.box_unit || "Box"} is empty (0).`
          : `Stok ${p.box_unit || "Dus"} habis (0). Tidak ada dus yang bisa dibongkar.`
      );
      return;
    }
    setItemToUnbox(p);
    setBoxesToUnbox(1);
    setUnboxNotes("");
  };

  const handleUnboxSubmit = async () => {
    if (!itemToUnbox) return;
    const sealedStock = Number(itemToUnbox.qty_sealed ?? 0);
    const convRate = Number(itemToUnbox.conversion_rate || 1);
    const boxUnitName = itemToUnbox.box_unit || "Dus";
    const baseUnitName = itemToUnbox.base_unit || itemToUnbox.unit_type || "Pcs";

    if (boxesToUnbox <= 0) {
      toast.error(language === "en" ? "Boxes to unbox must be greater than 0" : "Jumlah dus yang dibongkar harus lebih dari 0");
      return;
    }
    if (boxesToUnbox > sealedStock) {
      toast.error(
        language === "en"
          ? `Exceeds available sealed stock (${sealedStock} ${boxUnitName})`
          : `Jumlah melebihi stok dus tersedia (${sealedStock} ${boxUnitName})`
      );
      return;
    }

    setIsUnboxing(true);
    const addedLoose = boxesToUnbox * convRate;
    try {
      await api.post(`/items/${itemToUnbox.id}/unbox`, {
        boxes_to_unbox: boxesToUnbox,
        notes: unboxNotes.trim() || undefined,
      });

      toast.success(
        language === "en"
          ? `Successfully unboxed ${boxesToUnbox} ${boxUnitName} to +${addedLoose} ${baseUnitName}!`
          : `Berhasil membongkar ${boxesToUnbox} ${boxUnitName} menjadi +${addedLoose} ${baseUnitName} di rak etalase!`
      );

      // Optimistic UI state update
      setProducts((prev: any) =>
        prev.map((it: Product) => {
          if (it.id === itemToUnbox.id) {
            const curSealed = Number(it.qty_sealed ?? 0);
            const curLoose = Number(it.qty_loose ?? it.current_stock ?? 0);
            return {
              ...it,
              qty_sealed: curSealed - boxesToUnbox,
              qty_loose: curLoose + addedLoose,
              current_stock: curLoose + addedLoose,
            };
          }
          return it;
        })
      );

      setItemToUnbox(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || (language === "en" ? "Failed to unbox" : "Gagal membongkar dus"));
    } finally {
      setIsUnboxing(false);
    }
  };

  // Ingredient CRUD Handlers (Bahan Baku & Alat Kemasan)

  const handleOpenIngredientModal = (ing?: any) => {
    if (ing) {
      setEditingIngredient(ing);
      setIngName(ing.name);
      setIngCategory(ing.category || (inventoryDomainTab === "tool_supplies" ? "tool_supplies" : "raw_material"));
      setIngSubCategory(ing.sub_category || "General");
      setIsCustomIngSubCat(false);
      setIngUnit(ing.unit_type || (inventoryDomainTab === "tool_supplies" ? "pcs" : "kg"));
      setIsCustomIngUnit(false);
      setIngStock(ing.current_stock?.toString() || "0");
      setIngMinAlert(ing.min_stock_alert?.toString() || "5");
      setIngCost(formatNumberInput(ing.unit_cost || 0));
    } else {
      setEditingIngredient(null);
      setIngName("");
      const isTool = inventoryDomainTab === "tool_supplies";
      setIngCategory(isTool ? "tool_supplies" : "raw_material");
      setIngSubCategory(isTool ? "Kemasan & Plastik" : "Daging & Protein");
      setIsCustomIngSubCat(false);
      setIngUnit(isTool ? "pcs" : "kg");
      setIsCustomIngUnit(false);
      setIngStock("0");
      setIngMinAlert("5");
      setIngCost("0");
    }
    setShowIngredientModal(true);
  };

  const handleIngredientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingName.trim()) {
      toast.error(language === "en" ? "Name is required" : "Nama item wajib diisi");
      return;
    }

    const payload = {
      name: ingName,
      category: ingCategory,
      sub_category: ingSubCategory,
      unit_type: ingUnit,
      current_stock: parseFloat(ingStock) || 0,
      min_stock_alert: parseFloat(ingMinAlert) || 5,
      unit_cost: parseNumberInput(ingCost),
    };

    try {
      if (editingIngredient) {
        await api.put(`/ingredients/${editingIngredient.id}`, payload);
        toast.success(language === "en" ? "Item updated successfully!" : "Detail item berhasil diperbarui!");
      } else {
        await api.post("/ingredients", payload);
        toast.success(language === "en" ? "New item created successfully!" : "Item baru berhasil didaftarkan!");
      }
      setShowIngredientModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || (language === "en" ? "Failed to save item" : "Gagal menyimpan data bahan/alat"));
    }
  };

  const handleDeleteIngredient = (ing: any) => {
    setDeletingIngredientItem(ing);
  };

  const confirmDeleteIngredient = async () => {
    if (!deletingIngredientItem) return;
    try {
      await api.delete(`/ingredients/${deletingIngredientItem.id}`);
      toast.success(
        language === "en"
          ? `Item "${deletingIngredientItem.name}" deleted successfully!`
          : `Item "${deletingIngredientItem.name}" berhasil dihapus!`
      );
      fetchData();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          (language === "en" ? "Failed to delete item" : "Gagal menghapus item")
      );
    } finally {
      setDeletingIngredientItem(null);
    }
  };
  const handleQuickStatusChange = async (
    targetProd: Product,
    newStatus: "active" | "inactive" | "discontinued"
  ) => {
    if (targetProd.status === newStatus) return;
    try {
      const payload = {
        name: targetProd.name,
        sku: targetProd.sku || undefined,
        category: targetProd.category || undefined,
        unit_type: targetProd.unit_type,
        inventory_mode: targetProd.inventory_mode,
        purchase_price: targetProd.purchase_price,
        sell_price: targetProd.sell_price,
        current_stock: targetProd.current_stock,
        min_stock_alert: targetProd.min_stock_alert,
        image_url: targetProd.image_url,
        status: newStatus,
      };
      await api.put(`/products/${targetProd.id}`, payload);
      setProducts((prev) =>
        prev.map((p) => (p.id === targetProd.id ? { ...p, status: newStatus } : p))
      );
      const statusLabel =
        newStatus === "active"
          ? t.statusActive
          : newStatus === "inactive"
          ? t.statusInactive
          : t.statusDiscontinued;
      toast.success(`${t.statusChangedSuccess}: "${targetProd.name}" → ${statusLabel}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || t.errorSaveProduct);
    }
  };

  // Soft Delete / Archive Product
  const handleDeleteProduct = async (pId: string) => {
    if (!confirm(t.confirmArchive)) return;
    try {
      await api.delete(`/products/${pId}`);
      toast.success(t.successArchiveProduct);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || t.errorArchiveProduct);
    }
  };

  // ================= RENDER PRODUCT LIST (MASTER INVENTORY) =================

  const safeProducts = Array.isArray(products) ? products : [];

  // Dynamically multi-filter products
  const filteredProducts = safeProducts.filter((p) => {
    // Search query filter
    const matchesSearch =
      !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));

    // Category filter
    const matchesCategory =
      selectedCategory === "all" ||
      (p.category || "General").toLowerCase() === selectedCategory.toLowerCase();

    // Status filter (Multi-checkbox: active, inactive, discontinued)
    const matchesStatus = statusFilter[p.status as keyof typeof statusFilter] ?? true;

    // Inventory Mode filter
    const matchesMode =
      filterMode === "all" || p.inventory_mode === filterMode;

    // Stock Level filter
    let matchesStock = true;
    if (filterStock === "out_of_stock") {
      matchesStock = p.current_stock <= 0;
    } else if (filterStock === "low_stock") {
      matchesStock = p.min_stock_alert !== undefined && p.current_stock <= p.min_stock_alert && p.current_stock > 0;
    } else if (filterStock === "in_stock") {
      matchesStock = p.current_stock > 0;
    }

    return matchesSearch && matchesCategory && matchesStatus && matchesMode && matchesStock;
  });

  // Sort filtered products based on sortBy option
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case "name_asc":
        return a.name.localeCompare(b.name, "id", { sensitivity: "base" });
      case "name_desc":
        return b.name.localeCompare(a.name, "id", { sensitivity: "base" });
      case "price_asc":
        return a.sell_price - b.sell_price;
      case "price_desc":
        return b.sell_price - a.sell_price;
      case "stock_desc":
        return b.current_stock - a.current_stock;
      case "stock_asc":
        return a.current_stock - b.current_stock;
      case "newest":
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      default:
        return 0;
    }
  });

  // Synchronized search active state (open floating search if searchQuery has text OR explicitly expanded)
  const isSearchActive = isSearchExpanded || searchQuery.trim().length > 0;

  // Extract unique categories for category pills
  const categoriesList = [
    "all",
    ...Array.from(new Set(safeProducts.map((p) => p.category || "General"))).filter(Boolean),
  ];

  // KPI summary metrics calculated from total products list
  const kpiMetrics = {
    total: safeProducts.length,
    inStock: safeProducts.filter((p) => {
      const isLow = p.min_stock_alert !== undefined && p.current_stock <= p.min_stock_alert;
      return p.current_stock > 0 && !isLow;
    }).length,
    lowStock: safeProducts.filter(
      (p) => p.min_stock_alert !== undefined && p.current_stock <= p.min_stock_alert && p.current_stock > 0
    ).length,
    outOfStock: safeProducts.filter((p) => p.current_stock <= 0).length,
    inactive: safeProducts.filter((p) => p.status !== "active").length,
  };

  // If view is matrix, directly render StockMatrixView without extra wrappers
  if (view === "matrix") {
    return (
      <StockMatrixView
        onNavigateToDistribution={(payload) => {
          if (onNavigate) {
            onNavigate("distribusi", payload);
          } else {
            toast.info("Mengalihkan ke modul distribusi...");
          }
        }}
        onBackToInventory={() => {
          if (onNavigate) onNavigate("inventory-master");
        }}
      />
    );
  }

  return (
    <div className="space-y-6 text-left transition-all relative">

      {/* ── PAGE HEADER ── */}
      <div className="border-b border-slate-200/80 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-medium tracking-tight text-slate-900 dark:text-slate-100 capitalize">
            {view === "master" ? t.masterInventoryTitle : t.discontinuedTitle}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-1">
            {view === "master" ? t.masterInventoryDesc : t.discontinuedDesc}
          </p>
        </div>
      </div>

      {view === "master" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Card 1: Semua Data / Total Stock Items */}
          <button
            type="button"
            onClick={() => {
              setFilterStock("all");
              setStatusFilter({ active: true, inactive: true, discontinued: false });
            }}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between group ${
              filterStock === "all" && statusFilter.active && statusFilter.inactive && !statusFilter.discontinued
                ? "bg-slate-900 dark:bg-[#2A2A30] border-slate-900 dark:border-primary text-white ring-2 ring-slate-900/10 dark:ring-primary/20 shadow-sm"
                : "bg-white dark:bg-dark-card border-slate-200/80 dark:border-dark-border text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                {t.kpiAllProducts}
              </span>
              <span className="text-lg font-semibold font-mono text-slate-900 dark:text-slate-100 group-hover:scale-105 transition-transform inline-block">
                {kpiMetrics.total}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#252528] flex items-center justify-center text-slate-600 dark:text-slate-300">
              <Package className="w-4 h-4" />
            </div>
          </button>

          {/* Card 2: Stok Aman / Tersedia */}
          <button
            type="button"
            onClick={() => {
              setFilterStock("in_stock");
              setStatusFilter({ active: true, inactive: true, discontinued: false });
            }}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between group ${
              filterStock === "in_stock"
                ? "bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500 text-emerald-900 dark:text-emerald-300 ring-2 ring-emerald-500/20 shadow-sm"
                : "bg-white dark:bg-dark-card border-slate-200/80 dark:border-dark-border text-slate-700 dark:text-slate-200 hover:border-emerald-300"
            }`}
          >
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-0.5">
                {t.filterStockAvailable || "Stok Tersedia"}
              </span>
              <span className="text-lg font-semibold font-mono text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform inline-block">
                {kpiMetrics.inStock}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </button>

          {/* Card 3: Stok Menipis */}
          <button
            type="button"
            onClick={() => {
              setFilterStock("low_stock");
              setStatusFilter({ active: true, inactive: true, discontinued: true });
            }}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between group ${
              filterStock === "low_stock"
                ? "bg-amber-500/10 dark:bg-amber-500/20 border-amber-500 text-amber-900 dark:text-amber-300 ring-2 ring-amber-500/20 shadow-sm"
                : "bg-white dark:bg-dark-card border-slate-200/80 dark:border-dark-border text-slate-700 dark:text-slate-200 hover:border-amber-300"
            }`}
          >
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 block mb-0.5">
                {t.kpiLowStock}
              </span>
              <span className="text-xl font-extrabold font-mono text-amber-700 dark:text-amber-400 group-hover:scale-105 transition-transform inline-block">
                {kpiMetrics.lowStock}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 dark:bg-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-400">
              <AlertCircle className="w-4 h-4" />
            </div>
          </button>

          {/* Card 4: Stok Habis */}
          <button
            type="button"
            onClick={() => {
              setFilterStock("out_of_stock");
              setStatusFilter({ active: true, inactive: true, discontinued: true });
            }}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between group ${
              filterStock === "out_of_stock"
                ? "bg-red-500/10 dark:bg-red-500/20 border-red-500 text-red-900 dark:text-red-300 ring-2 ring-red-500/20 shadow-sm"
                : "bg-white dark:bg-dark-card border-slate-200/80 dark:border-dark-border text-slate-700 dark:text-slate-200 hover:border-red-300"
            }`}
          >
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-600 dark:text-red-400 block mb-0.5">
                {t.kpiOutOfStock}
              </span>
              <span className="text-xl font-extrabold font-mono text-red-600 dark:text-red-400 group-hover:scale-105 transition-transform inline-block">
                {kpiMetrics.outOfStock}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-red-500/15 dark:bg-red-500/20 flex items-center justify-center text-red-600 dark:text-red-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* ── SEARCH BAR & RICH HORIZONTAL MULTI-FILTER TOOLBAR ── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          
          {/* Unified ErpSearchBar */}
          <ErpSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t.searchPlaceholder}
            inputRef={searchInputRef}
            className="flex-1"
          />

          {/* Controls: Rich Horizontal Multi-Filter & Sort Menu */}
          <div className="flex items-center gap-2 shrink-0">
            
            {/* Sort Dropdown Button (Shadcn UI) */}
            <DropdownMenu>
              <DropdownMenuTrigger className={`flex items-center gap-1.5 px-3.5 py-3 rounded-full border text-xs font-bold cursor-pointer transition-all ${
                sortBy !== "name_asc"
                  ? "bg-slate-900 text-white border-slate-900 dark:bg-primary dark:border-primary dark:text-slate-900 shadow-sm"
                  : "bg-white dark:bg-dark-card border-light-border/60 dark:border-dark-border text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
              }`}>
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span className="font-semibold text-[11px]">
                  {sortBy === "name_asc"
                    ? "A-Z"
                    : sortBy === "name_desc"
                    ? "Z-A"
                    : sortBy === "price_asc"
                    ? "Harga Terendah"
                    : sortBy === "price_desc"
                    ? "Harga Tertinggi"
                    : sortBy === "stock_desc"
                    ? "Stok Terbanyak"
                    : sortBy === "stock_asc"
                    ? "Stok Tersedikit"
                    : "Terbaru"}
                </span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#3A3A3E] shadow-2xl rounded-2xl p-1.5 min-w-[210px]">
                {[
                  { key: "name_asc", label: "Nama (A - Z)" },
                  { key: "name_desc", label: "Nama (Z - A)" },
                  { key: "price_asc", label: "Harga: Terendah → Tertinggi" },
                  { key: "price_desc", label: "Harga: Tertinggi → Terendah" },
                  { key: "stock_desc", label: "Stok: Terbanyak → Tersedikit" },
                  { key: "stock_asc", label: "Stok: Tersedikit → Terbanyak" },
                  { key: "newest", label: "Produk Terbaru" },
                ].map((s) => (
                  <DropdownMenuItem
                    key={s.key}
                    onClick={() => setSortBy(s.key as any)}
                    className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl flex items-center justify-between"
                  >
                    <span>{s.label}</span>
                    {sortBy === s.key && <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[3]" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* ── UNIFIED REUSABLE FILTER COMPONENT (ErpFilterPopover) ── */}
            <ErpFilterPopover
              activeCount={activeFiltersCount}
              onResetAll={handleResetFilters}
              title={t.filter || "Filter Data Inventori"}
              resetLabel={t.resetFilter || "Reset Filter"}
              filterButtonLabel={t.filter || "Filter"}
              columnGroups={[
                {
                  id: "status",
                  title: t.filterStatusLabel,
                  type: "multi",
                  selectedValues: Object.keys(statusFilter).filter((k) => statusFilter[k as keyof typeof statusFilter]),
                  onToggleMulti: (key) => {
                    setStatusFilter((prev) => ({
                      ...prev,
                      [key]: !prev[key as keyof typeof prev],
                    }));
                  },
                  options: [
                    { key: "active", label: t.statusActive },
                    { key: "inactive", label: t.statusInactive },
                    { key: "discontinued", label: t.statusDiscontinued },
                  ],
                },
                {
                  id: "mode",
                  title: t.filterModeLabel,
                  type: "single",
                  selectedValue: filterMode,
                  onSelectSingle: (val) => setFilterMode(val),
                  options: [
                    { key: "all", label: t.filterModeAll },
                    ...inventoryModes.map((m) => ({ key: m.val, label: m.label })),
                  ],
                },
                {
                  id: "stock",
                  title: t.filterStockLabel,
                  type: "single",
                  selectedValue: filterStock,
                  onSelectSingle: (val) => setFilterStock(val),
                  options: [
                    { key: "all", label: t.filterStockAll },
                    { key: "in_stock", label: t.filterStockAvailable },
                    { key: "low_stock", label: t.filterStockLow },
                    { key: "out_of_stock", label: t.filterStockOut },
                  ],
                },
                {
                  id: "sort",
                  title: "Urutkan Data",
                  type: "single",
                  selectedValue: sortBy,
                  onSelectSingle: (val) => setSortBy(val as any),
                  options: [
                    { key: "name_asc", label: "Nama (A - Z)" },
                    { key: "name_desc", label: "Nama (Z - A)" },
                    { key: "price_asc", label: "Harga: Terendah → Tertinggi" },
                    { key: "price_desc", label: "Harga: Tertinggi → Terendah" },
                    { key: "stock_desc", label: "Stok: Terbanyak → Tersedikit" },
                    { key: "stock_asc", label: "Stok: Tersedikit → Terbanyak" },
                    { key: "newest", label: "Produk Terbaru" },
                  ],
                },
              ]}
            />
          </div>
        </div>

        {/* Domain Category Pill Group */}
        <div className="flex items-center justify-between bg-slate-100 dark:bg-[#202023] p-1.5 rounded-full border border-slate-200/70 dark:border-[#35353A] w-full gap-2 shadow-sm">
          {/* Scrollable Categories List */}
          <div
            ref={categoryScrollRef}
            className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 py-0.5 px-1 scroll-smooth"
          >
            {inventoryDomainTab === "products"
              ? categoriesList.map((cat) => {
                  const isCatActive = selectedCategory.toLowerCase() === cat.toLowerCase();
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`relative px-4 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer whitespace-nowrap capitalize shrink-0 ${
                        isCatActive
                          ? "text-slate-900 dark:text-primary"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                      }`}
                    >
                      {cat === "all" ? t.allCategories : cat}
                      {isCatActive && (
                        <span className="absolute bottom-0 left-3.5 right-3.5 h-[2px] bg-slate-900 dark:bg-primary rounded-full" />
                      )}
                    </button>
                  );
                })
              : (inventoryDomainTab === "raw_materials"
                  ? [
                      { id: "all", label: language === "en" ? "All Sub-Categories" : "Semua Sub-Kategori" },
                      { id: "Daging & Protein", label: "Daging & Protein" },
                      { id: "Tepung & Pati", label: "Tepung & Pati" },
                      { id: "Bumbu & Rempah", label: "Bumbu & Rempah" },
                      { id: "Minyak & Cairan", label: "Minyak & Cairan" },
                      { id: "Bumbu Racik", label: "Bumbu Racik" },
                      { id: "Bahan Penolong", label: "Bahan Penolong" },
                    ]
                  : [
                      { id: "all", label: language === "en" ? "All Sub-Categories" : "Semua Sub-Kategori" },
                      { id: "Kemasan & Plastik", label: "Kemasan & Plastik" },
                      { id: "Peralatan Dapur", label: "Peralatan Dapur" },
                      { id: "Tabung & Gas", label: "Tabung & Gas" },
                      { id: "Kebersihan & Sanitasi", label: "Kebersihan & Sanitasi" },
                      { id: "Perlengkapan", label: "Perlengkapan" },
                    ]
                ).map((c) => {
                  const isCatActive = selectedIngredientSubCategory === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedIngredientSubCategory(c.id)}
                      className={`relative px-4 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer whitespace-nowrap capitalize shrink-0 ${
                        isCatActive
                          ? "text-slate-900 dark:text-primary"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                      }`}
                    >
                      {c.label}
                      {isCatActive && (
                        <span className="absolute bottom-0 left-3.5 right-3.5 h-[2px] bg-slate-900 dark:bg-primary rounded-full" />
                      )}
                    </button>
                  );
                })}
          </div>

          {/* Right Controls: Chevrons */}
          <div className="flex items-center gap-1 shrink-0 pl-1 pr-0.5">
            <button
              type="button"
              onClick={() => handleScrollCategory("left")}
              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/80 dark:hover:bg-white/10 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleScrollCategory("right")}
              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/80 dark:hover:bg-white/10 transition-all cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-dark-card border border-slate-200/80 dark:border-slate-800 rounded-[28px] shadow-sm">
          <div className="w-10 h-10 border-4 border-slate-700 dark:border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <span className="text-slate-500 dark:text-slate-400 text-xs font-bold">{t.loading}</span>
        </div>
      ) : (
        /* ── REUSABLE UNIFIED ERP DATA TABLE (DESKTOP TABLE + MOBILE ACCORDION - NON CLICKABLE ROWS) ── */
        <ErpDataTable<Product>
          data={sortedProducts}
          keyExtractor={(p) => p.id}
          loading={loading}
          emptyText={t.noData}
        renderMobileItem={(p) => {
          const isExpanded = expandedProductId === p.id;
          const buyPrice = Number(p.purchase_price ?? (p as any).standard_cost ?? 0);
          const sellPrice = Number(p.sell_price ?? 0);
          const currentStock = Number(p.current_stock ?? (p as any).qty_loose ?? 0);
          const unitType = p.unit_type || (p as any).base_unit || "pcs";
          const categoryName = p.category || (p as any).category_name || "General";
          const profitNominal = sellPrice - buyPrice;
          const marginPercent = buyPrice > 0 ? Math.round((profitNominal / buyPrice) * 100) : 100;

          return (
            <div className="transition-all duration-300 ease-out">
              <div
                onClick={() => setExpandedProductId(isExpanded ? null : p.id)}
                className="flex items-center justify-between py-3 px-1 hover:bg-slate-100/50 dark:hover:bg-white/[0.03] active:bg-slate-200/40 dark:active:bg-white/5 transition-all duration-200 cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 dark:bg-dark-bg flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-dark-border">
                    <ErpImage src={p.image_url} alt={p.name} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
                      {p.name}
                    </h4>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 text-right">
                  <div>
                    <div className="font-mono font-semibold text-sm text-slate-900 dark:text-slate-100">
                      Rp {sellPrice.toLocaleString("id-ID")}
                    </div>
                    <div className="flex items-center justify-end gap-1.5 mt-0.5">
                      <span className="text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400">
                        {currentStock} {unitType}
                      </span>
                      <div
                        className={`w-2 h-2 rounded-full ${
                          p.status === "active" ? "bg-emerald-500" : p.status === "inactive" ? "bg-slate-400" : "bg-red-500"
                        }`}
                        title={`Status: ${p.status}`}
                      />
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-300 ease-out ${
                    isExpanded ? "rotate-90 text-slate-900 dark:text-slate-100" : ""
                  }`} />
                </div>
              </div>

              {isExpanded && (
                <div className="px-3.5 pb-4 pt-2.5 bg-slate-50/80 dark:bg-[#1A1A1E]/90 rounded-2xl mb-2.5 border border-slate-200/60 dark:border-[#25252A] space-y-3 transition-all duration-300 ease-out animate-in fade-in-50 slide-in-from-top-2">
                  <div className="flex items-center gap-2 text-xs flex-wrap pb-1.5 border-b border-slate-200/50 dark:border-[#2A2A30]">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-200/80 dark:bg-[#25252A] text-slate-700 dark:text-slate-300">
                      {t.colCategory}: <span className="font-semibold">{categoryName}</span>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-slate-200/80 dark:bg-[#25252A] text-slate-700 dark:text-slate-300">
                      SKU: <span className="font-semibold">{p.sku || "-"}</span>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-200/80 dark:bg-[#25252A] text-slate-700 dark:text-slate-300">
                      Satuan: <span className="font-semibold">{unitType}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-3 bg-white dark:bg-[#222226] rounded-xl border border-slate-200/60 dark:border-[#303035] space-y-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Matriks Keuangan</span>
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 font-medium">
                        <span>Harga Modal (HPP):</span>
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">Rp {buyPrice.toLocaleString("id-ID")}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-[#2F2F34] font-medium">
                        <span>Margin Profit:</span>
                        <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">+Rp {profitNominal.toLocaleString("id-ID")} ({marginPercent}%)</span>
                      </div>
                    </div>

                    <div className="p-3 bg-white dark:bg-[#222226] rounded-xl border border-slate-200/60 dark:border-[#303035] space-y-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Aturan Mode Inventori</span>
                      <div className="flex items-center justify-between font-medium">
                        <span className="text-slate-600 dark:text-slate-400">Mode:</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100 capitalize">{p.inventory_mode === "dry_strict" ? "Dry Strict" : p.inventory_mode === "wet_batch_thaw" ? "Wet Batch Thaw" : "Infinite"}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-[#2F2F34] font-medium">
                        <span>Limit Peringatan Stok:</span>
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{p.min_stock_alert ?? 0} {unitType}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    {/* Primary Action 1: Adjustment */}
                    <button
                      type="button"
                      onClick={() => setAdjustingProduct(p)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold text-xs cursor-pointer transition-all active:scale-95 shadow-xs"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>Adjustment</span>
                    </button>

                    {/* Far-Right 3-Dots Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger className="flex items-center justify-center w-9 h-9 rounded-xl bg-white dark:bg-[#222226] border border-slate-200/80 dark:border-[#333338] hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 cursor-pointer transition-all shrink-0">
                        <MoreHorizontal className="w-4 h-4 text-slate-500" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#3A3A3E] shadow-xl rounded-2xl p-1.5 min-w-[160px] space-y-1">
                        {/* View in Master Item */}
                        <DropdownMenuItem
                          onClick={() => handleViewMasterItem(p)}
                          className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl flex items-center gap-2"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                          <span>{t.viewInMasterItem || "Buka Detail di Master Item"}</span>
                        </DropdownMenuItem>

                        {/* Copy SKU */}
                        <DropdownMenuItem
                          onClick={() => {
                            if (p.sku) {
                              navigator.clipboard.writeText(p.sku);
                              toast.success(t.skuCopied);
                            }
                          }}
                          className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl flex items-center gap-2"
                        >
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>Salin SKU</span>
                        </DropdownMenuItem>

                        {/* Status Change Subitems */}
                        <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-t border-slate-100 dark:border-[#2F2F34] mt-1 pt-1.5">
                          Ubah Status
                        </div>
                        {[
                          { val: "active", label: "Aktif", color: "bg-emerald-500" },
                          { val: "inactive", label: "Non-Aktif", color: "bg-slate-400" },
                          { val: "discontinued", label: "Dihentikan", color: "bg-red-500" },
                        ].map((st) => (
                          <DropdownMenuItem
                            key={st.val}
                            onClick={() => handleQuickStatusChange(p, st.val as any)}
                            className="cursor-pointer px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${st.color}`} />
                              <span>{st.label}</span>
                            </div>
                            {p.status === st.val && <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[2]" />}
                          </DropdownMenuItem>
                        ))}

                        {/* Archive / Delete Product */}
                        <div className="border-t border-slate-100 dark:border-[#2F2F34] mt-1 pt-1">
                          <DropdownMenuItem
                            onClick={() => handleDeleteProduct(p.id)}
                            className="cursor-pointer px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl flex items-center gap-2"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            <span>{t.archive}</span>
                          </DropdownMenuItem>
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )}
            </div>
          );
        }}
        columns={[
          {
            key: "name",
            label: language === "en" ? "Item & Barcode / SKU" : "Item & Barcode / SKU",
            renderCell: (p) => (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 dark:bg-dark-bg flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-dark-border">
                  <ErpImage src={p.image_url} alt={p.name} />
                </div>
                <div>
                  <span className="truncate block font-bold text-sm text-slate-900 dark:text-slate-100">{p.name}</span>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">{p.sku || "-"}</div>
                </div>
              </div>
            ),
          },
          {
            key: "category",
            label: t.colCategory,
            renderCell: (p) => (
              <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-[#2A2A2E] text-slate-700 dark:text-slate-300 font-semibold text-xs">
                {p.category || (p as any).category_name || "General"}
              </span>
            ),
          },
          {
            key: "mode",
            label: t.colMode,
            align: "center",
            renderCell: (p) => (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                p.inventory_mode === "dry_strict"
                  ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                  : p.inventory_mode === "wet_batch_thaw"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
                  : "bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300"
              }`}>
                {p.inventory_mode === "dry_strict" ? "Dry Strict" : p.inventory_mode === "wet_batch_thaw" ? "Wet Thaw" : "Infinite"}
              </span>
            ),
          },
          {
            key: "uom_spec",
            label: language === "en" ? "UOM & Conversion" : "Satuan & Konversi",
            renderCell: (p) => {
              const baseUnitName = p.base_unit || p.unit_type || "pcs";
              const boxUnitName = p.box_unit || "dus";
              const convRate = Number(p.conversion_rate || 1);

              return (
                <div className="text-xs">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 font-mono text-slate-700 dark:text-slate-300">
                      {baseUnitName}
                    </span>
                    {convRate > 1 && (
                      <>
                        <span className="text-slate-400">/</span>
                        <span className="text-slate-500 font-medium">
                          {boxUnitName} ({convRate} {baseUnitName})
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            },
          },
          {
            key: "stock",
            label: language === "en" ? "Physical Stock" : "Saldo Stok",
            align: "right",
            renderCell: (p: any) => {
              const isTracked = p.is_inventory_tracked !== false;
              if (!isTracked) {
                return (
                  <div className="text-right text-xs">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                      <Sparkles className="w-3 h-3" />
                      <span>{language === "en" ? "Untracked" : "Tanpa Lacak"}</span>
                    </span>
                  </div>
                );
              }

              const sealedStock = Number(p.qty_sealed ?? 0);
              const looseStock = Number(p.qty_loose ?? p.current_stock ?? 0);
              const baseUnitName = p.base_unit || p.unit_type || "Pcs";
              const boxUnitName = p.box_unit || "Dus";
              const isLowStock = p.inventory_mode === "dry_strict" && looseStock <= (p.min_stock_alert || 0) && sealedStock <= 0;

              return (
                <div className="text-right text-xs">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center justify-end gap-1.5">
                    {sealedStock > 0 && (
                      <>
                        <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm font-mono">
                          {sealedStock}
                        </span>{" "}
                        <span className="text-slate-500 font-medium">{boxUnitName}</span>
                        <span className="text-slate-400">+</span>
                      </>
                    )}
                    <span className={`font-extrabold text-sm font-mono ${isLowStock ? "text-red-500" : "text-blue-600 dark:text-blue-400"}`}>
                      {looseStock}
                    </span>{" "}
                    <span className="text-slate-500 font-medium">{baseUnitName}</span>
                  </div>
                </div>
              );
            },
          },
          {
            key: "status",
            label: t.colStatus,
            align: "center",
            renderCell: (p) => (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                p.status === "active"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : p.status === "inactive"
                  ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${
                  p.status === "active" ? "bg-emerald-500" : p.status === "inactive" ? "bg-slate-400" : "bg-red-500"
                }`} />
                <span>{p.status}</span>
              </span>
            ),
          },
          {
            key: "action",
            label: t.colAction,
            align: "center",
            renderCell: (p) => (
              <div className="flex items-center justify-center gap-1">
                {Number(p.qty_sealed ?? 0) > 0 && !isStaff && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePromptUnbox(p);
                    }}
                    className="p-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#3F73F7] dark:text-blue-400 hover:bg-blue-100 transition-colors"
                    title="Bongkar Dus ke Rak Etalase (Unbox)"
                  >
                    <Boxes className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAdjustingProduct(p);
                  }}
                  className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 transition-colors"
                  title="Penyesuaian Stok (Adjust Stock)"
                >
                  <SlidersHorizontal className="w-4 h-4 text-slate-700 dark:text-white" />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 cursor-pointer transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#3A3A3E] shadow-xl rounded-xl p-1 min-w-[180px]">
                    {Number(p.qty_sealed ?? 0) > 0 && !isStaff && (
                      <DropdownMenuItem
                        onClick={() => handlePromptUnbox(p)}
                        className="cursor-pointer px-3 py-2 text-xs font-bold text-[#3F73F7] dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-lg flex items-center gap-2 mb-1"
                      >
                        <Boxes className="w-3.5 h-3.5" />
                        <span>Buka Dus (Unbox)</span>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => handleViewMasterItem(p)}
                      className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                      <span>{t.viewInMasterItem || "Buka Detail di Master Item"}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setAdjustingProduct(p)}
                      className="cursor-pointer px-3 py-2 text-xs font-bold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-slate-900 dark:text-white" />
                      <span>Penyesuaian Stok</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        if (p.sku) {
                          navigator.clipboard.writeText(p.sku);
                          toast.success(t.skuCopied);
                        }
                      }}
                      className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Salin SKU</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDeleteProduct(p.id)}
                      className="cursor-pointer px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg flex items-center gap-2"
                    >
                      <Archive className="w-3.5 h-3.5 text-red-500" />
                      <span>{t.archive}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ),
          },

        ]}
      />
      )}

      {/* ── HEADER CONTEXT MENU ON RIGHT CLICK (MANAGE COLUMNS WITH SHADCN CHECKBOX) ── */}
      {headerContextMenu && (
        <div
          style={{
            top: `${headerContextMenu.y}px`,
            left: `${headerContextMenu.x}px`,
          }}
          className="fixed z-50 min-w-[210px] bg-white dark:bg-[#202024] border border-slate-200 dark:border-dark-border rounded-2xl shadow-2xl p-2 animate-in fade-in-0 zoom-in-95 text-slate-800 dark:text-slate-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-[#333338] mb-1 flex items-center justify-between">
            <span>{t.showColumns}</span>
            <SlidersHorizontal className="w-3 h-3 text-slate-400" />
          </div>
          {[
            { key: "image", label: t.colImage },
            { key: "name", label: t.colName },
            { key: "sku", label: t.colSku },
            { key: "category", label: t.colCategory },
            { key: "mode", label: t.colMode },
            { key: "buyPrice", label: t.colBuyPrice },
            { key: "sellPrice", label: t.colSellPrice },
            { key: "stock", label: t.colStock },
            { key: "status", label: t.colStatus },
            { key: "action", label: t.colAction },
          ].map((col) => {
            const isChecked = visibleColumns[col.key as keyof typeof visibleColumns];
            return (
              <div
                key={col.key}
                onClick={() =>
                  setVisibleColumns((prev) => ({
                    ...prev,
                    [col.key]: !prev[col.key as keyof typeof prev],
                  }))
                }
                className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg cursor-pointer transition-colors"
              >
                <span>{col.label}</span>
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({
                      ...prev,
                      [col.key]: Boolean(checked),
                    }))
                  }
                />
              </div>
            );
          })}
        </div>
      )}

      {/* ── ALL CATEGORIES MODAL DIALOG ── */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="max-w-2xl p-6 bg-white dark:bg-[#202024] border-slate-200 dark:border-dark-border">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-[#2E2E34] flex items-center justify-center text-slate-700 dark:text-primary">
                <LayoutGrid className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {t.allCategories}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                  {t.chooseCategoryDesc}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Search inside dialog if many categories */}
          <div className="relative mt-2">
            <Search className="absolute left-4 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              placeholder={t.searchCategories}
              className="w-full pl-10 pr-4 py-2.5 rounded-full border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-[#1C1C1F] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-400/20"
            />
            {categorySearch && (
              <button
                type="button"
                onClick={() => setCategorySearch("")}
                className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Categories Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[50vh] overflow-y-auto p-1 mt-3 scrollbar-thin">
            {categoriesList
              .filter((cat) =>
                !categorySearch.trim() ||
                cat.toLowerCase().includes(categorySearch.toLowerCase()) ||
                (cat === "all" && t.allCategories.toLowerCase().includes(categorySearch.toLowerCase()))
              )
              .map((cat) => {
                const isCatActive = selectedCategory.toLowerCase() === cat.toLowerCase();
                const count = cat === "all" 
                  ? safeProducts.length 
                  : safeProducts.filter(p => (p.category || "General").toLowerCase() === cat.toLowerCase()).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat);
                      setIsCategoryDialogOpen(false);
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 group ${
                      isCatActive
                        ? "bg-slate-900 dark:bg-primary border-slate-900 dark:border-primary text-white dark:text-slate-900 shadow-md"
                        : "bg-slate-50 dark:bg-dark-bg border-slate-200/80 dark:border-[#35353A] hover:border-slate-400 dark:hover:border-slate-600 text-slate-800 dark:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Tag className={`w-4 h-4 ${isCatActive ? "text-white dark:text-slate-900" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"}`} />
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isCatActive
                          ? "bg-white/20 dark:bg-black/10 text-white dark:text-slate-900"
                          : "bg-slate-200/80 dark:bg-[#2A2A30] text-slate-600 dark:text-slate-400"
                      }`}>
                        {count} {t.products}
                      </span>
                    </div>
                    <div>
                      <div className="font-bold text-xs capitalize truncate">
                        {cat === "all" ? t.allCategories : cat}
                      </div>
                    </div>
                  </button>
                );
              })}
          </div>

          <DialogFooter className="pt-2">
            <DialogClose className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#2B2B30] dark:hover:bg-[#34343A] text-slate-700 dark:text-slate-200 text-xs font-bold rounded-full transition-all cursor-pointer">
              {t.close}
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Adjustment Modal */}
      <StockAdjustmentModal
        isOpen={Boolean(adjustingProduct)}
        onClose={() => setAdjustingProduct(null)}
        product={adjustingProduct}
        onSuccess={fetchData}
      />

      {/* Ingredient Form Modal (Dedicated Raw Materials vs Tools & Supplies Form) */}
      <Dialog open={showIngredientModal} onOpenChange={setShowIngredientModal}>
        <DialogContent className="sm:max-w-2xl rounded-2xl bg-white dark:bg-[#202024] text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-[#38383C] p-6 shadow-xl">
          {(() => {
            const isTool = ingCategory === "tool_supplies" || inventoryDomainTab === "tool_supplies";
            return (
              <>
                <DialogHeader className="pb-3 border-b border-slate-100 dark:border-[#2E2E34]">
                  <DialogTitle className="flex items-center gap-2.5 text-lg font-medium">
                    <div className="w-9 h-9 rounded-xl bg-[#E2FF66]/20 dark:bg-[#E2FF66]/15 text-slate-900 dark:text-[#E2FF66] flex items-center justify-center shrink-0">
                      {isTool ? <Tag className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
                    </div>
                    <div>
                      <span className="block font-medium text-slate-900 dark:text-slate-100">
                        {editingIngredient
                          ? isTool
                            ? (language === "en" ? "Edit Tool & Supply Item" : "Edit Alat & Kemasan")
                            : (language === "en" ? "Edit Raw Material Item" : "Edit Bahan Baku Mentah")
                          : isTool
                          ? (language === "en" ? "Add New Tool & Supply Item" : "Tambah Alat & Kemasan Baru")
                          : (language === "en" ? "Add New Raw Material Item" : "Tambah Bahan Baku Baru")}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-normal block mt-0.5">
                        {isTool
                          ? (language === "en"
                              ? "Input kitchen equipment, packaging, or operational gas details."
                              : "Input detail peralatan dapur, kemasan, atau tabung gas operasional.")
                          : (language === "en"
                              ? "Input raw ingredients, production spices, and supplier unit costs."
                              : "Input detail bahan mentah, resep, dan bumbu produksi.")}
                      </span>
                    </div>
                  </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleIngredientSubmit} className="space-y-5 pt-4">
                  {/* Section 1: Informasi Utama Item */}
                  <div className="space-y-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      {language === "en" ? "1. Item Identification" : "1. Identitas Item"}
                    </span>

                    {/* Item Name */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {isTool
                          ? (language === "en" ? "Tool / Supply Name *" : "Nama Alat / Kemasan *")
                          : (language === "en" ? "Raw Material Name *" : "Nama Bahan Baku *")}
                      </label>
                      <input
                        type="text"
                        value={ingName}
                        onChange={(e) => setIngName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#18181C] border border-slate-200 dark:border-[#38383C] text-slate-900 dark:text-slate-100 text-sm font-medium focus:ring-2 focus:ring-slate-900 dark:focus:ring-[#E2FF66]"
                        placeholder={
                          isTool
                            ? (language === "en" ? "e.g. 500ml Plastic Bowl / 3kg Gas Tank" : "cth: Mangkuk Plastik 500ml / Gas Elpiji 3kg")
                            : (language === "en" ? "e.g. Fresh Beef Meat / Tapioca Flour" : "cth: Daging Sapi Murni / Tepung Tapioka Super")
                        }
                        required
                      />
                    </div>

                    {/* Sub-Category & Unit Type Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                      {/* Sub-Category */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {language === "en" ? "Sub-Category" : "Sub-Kategori"}
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setIsCustomIngSubCat(!isCustomIngSubCat);
                              if (!isCustomIngSubCat) setIngSubCategory("");
                            }}
                            className="text-[10px] font-medium text-slate-500 hover:text-slate-900 dark:hover:text-[#E2FF66] hover:underline cursor-pointer"
                          >
                            {isCustomIngSubCat
                              ? (language === "en" ? "Pilih Daftar" : "Pilih Daftar")
                              : (language === "en" ? "+ Custom" : "+ Custom")}
                          </button>
                        </div>

                        {isCustomIngSubCat ? (
                          <input
                            type="text"
                            value={ingSubCategory}
                            onChange={(e) => setIngSubCategory(e.target.value)}
                            placeholder={language === "en" ? "Type sub-category..." : "Tulis sub-kategori custom..."}
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#18181C] border border-slate-200 dark:border-[#38383C] text-slate-900 dark:text-slate-100 text-xs font-medium"
                            required
                          />
                        ) : (
                          <Select value={ingSubCategory} onValueChange={(v) => v && setIngSubCategory(v)}>
                            <SelectTrigger className="w-full rounded-xl bg-slate-50 dark:bg-[#18181C] border-slate-200 dark:border-[#38383C] text-slate-900 dark:text-slate-100 text-xs font-medium">
                              <SelectValue placeholder="Pilih Sub-Kategori" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-[#202024] text-slate-900 dark:text-slate-100 border-slate-200 dark:border-[#38383C]">
                              {isTool ? (
                                <>
                                  <SelectItem value="Kemasan & Plastik">Kemasan & Plastik</SelectItem>
                                  <SelectItem value="Peralatan Dapur">Peralatan Dapur</SelectItem>
                                  <SelectItem value="Tabung & Gas">Tabung & Gas</SelectItem>
                                  <SelectItem value="Kebersihan & Sanitasi">Kebersihan & Sanitasi</SelectItem>
                                  <SelectItem value="Perlengkapan">Perlengkapan</SelectItem>
                                </>
                              ) : (
                                <>
                                  <SelectItem value="Daging & Protein">Daging & Protein</SelectItem>
                                  <SelectItem value="Tepung & Pati">Tepung & Pati</SelectItem>
                                  <SelectItem value="Bumbu & Rempah">Bumbu & Rempah</SelectItem>
                                  <SelectItem value="Minyak & Cairan">Minyak & Cairan</SelectItem>
                                  <SelectItem value="Bumbu Racik">Bumbu Racik</SelectItem>
                                  <SelectItem value="Bahan Penolong">Bahan Penolong</SelectItem>
                                </>
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {/* Unit Type */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {language === "en" ? "Unit Type" : "Satuan Unit"}
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setIsCustomIngUnit(!isCustomIngUnit);
                              if (!isCustomIngUnit) setIngUnit("");
                            }}
                            className="text-[10px] font-medium text-slate-500 hover:text-slate-900 dark:hover:text-[#E2FF66] hover:underline cursor-pointer"
                          >
                            {isCustomIngUnit
                              ? (language === "en" ? "Pilih Daftar" : "Pilih Daftar")
                              : (language === "en" ? "+ Custom" : "+ Custom")}
                          </button>
                        </div>

                        {isCustomIngUnit ? (
                          <input
                            type="text"
                            value={ingUnit}
                            onChange={(e) => setIngUnit(e.target.value)}
                            placeholder={language === "en" ? "Type unit (e.g. botol, cup)..." : "Tulis satuan custom (cth: botol, cup)..."}
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#18181C] border border-slate-200 dark:border-[#38383C] text-slate-900 dark:text-slate-100 text-xs font-medium"
                            required
                          />
                        ) : (
                          <Select value={ingUnit} onValueChange={(v) => v && setIngUnit(v)}>
                            <SelectTrigger className="w-full rounded-xl bg-slate-50 dark:bg-[#18181C] border-slate-200 dark:border-[#38383C] text-slate-900 dark:text-slate-100 text-xs font-medium">
                              <SelectValue placeholder="Pilih Satuan" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-[#202024] text-slate-900 dark:text-slate-100 border-slate-200 dark:border-[#38383C]">
                              {isTool ? (
                                <>
                                  <SelectItem value="pcs">Pieces (pcs)</SelectItem>
                                  <SelectItem value="unit">Unit</SelectItem>
                                  <SelectItem value="roll">Roll</SelectItem>
                                  <SelectItem value="set">Set</SelectItem>
                                  <SelectItem value="tabung">Tabung (Gas)</SelectItem>
                                  <SelectItem value="dus">Dus / Box</SelectItem>
                                  <SelectItem value="pack">Pack</SelectItem>
                                </>
                              ) : (
                                <>
                                  <SelectItem value="kg">Kilogram (kg)</SelectItem>
                                  <SelectItem value="gram">Gram (g)</SelectItem>
                                  <SelectItem value="liter">Liter (l)</SelectItem>
                                  <SelectItem value="ml">MiliLiter (ml)</SelectItem>
                                  <SelectItem value="pack">Pack</SelectItem>
                                  <SelectItem value="ikat">Ikat</SelectItem>
                                  <SelectItem value="botol">Botol</SelectItem>
                                </>
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Financial & Inventory Parameters */}
                  <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-[#2E2E34]">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      {language === "en" ? "2. Inventory & Cost Parameters" : "2. Parameter Stok & Harga Modal"}
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      {/* Initial Stock */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {language === "en" ? "Initial Stock" : "Stok Awal"}
                        </label>
                        <input
                          type="text"
                          value={ingStock}
                          onChange={(e) => setIngStock(formatNumberInput(e.target.value))}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#18181C] border border-slate-200 dark:border-[#38383C] text-slate-900 dark:text-slate-100 text-sm font-semibold font-mono"
                          placeholder="0"
                        />
                      </div>

                      {/* Min Stock Alert */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {language === "en" ? "Min Stock Alert" : "Batas Alert Min"}
                        </label>
                        <input
                          type="text"
                          value={ingMinAlert}
                          onChange={(e) => setIngMinAlert(formatNumberInput(e.target.value))}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#18181C] border border-slate-200 dark:border-[#38383C] text-slate-900 dark:text-slate-100 text-sm font-semibold font-mono"
                          placeholder="5"
                        />
                      </div>

                      {/* Purchase Cost */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {language === "en" ? "Unit Cost (Rp)" : "Harga Beli / Unit (Rp)"}
                        </label>
                        <input
                          type="text"
                          value={ingCost}
                          onChange={(e) => setIngCost(formatNumberInput(e.target.value))}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#18181C] border border-slate-200 dark:border-[#38383C] text-slate-900 dark:text-slate-100 text-sm font-semibold font-mono"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer Buttons */}
                  <DialogFooter className="pt-4 border-t border-slate-100 dark:border-[#2E2E34] flex flex-row items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowIngredientModal(false)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#38383C] text-slate-700 dark:text-slate-300 font-medium text-xs hover:bg-slate-100 dark:hover:bg-[#2E2E34] cursor-pointer transition-colors"
                    >
                      {language === "en" ? "Cancel" : "Batal"}
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-[#E2FF66] text-slate-950 font-semibold text-xs hover:brightness-105 cursor-pointer shadow-sm transition-all"
                    >
                      {language === "en" ? "Save Item" : "Simpan Data"}
                    </button>
                  </DialogFooter>
                </form>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Delete Ingredient Confirm Modal */}
      <ConfirmDialog
        isOpen={Boolean(deletingIngredientItem)}
        onClose={() => setDeletingIngredientItem(null)}
        onConfirm={confirmDeleteIngredient}
        title={
          language === "en"
            ? `Delete "${deletingIngredientItem?.name}"?`
            : `Hapus "${deletingIngredientItem?.name}"?`
        }
        description={
          language === "en"
            ? `Are you sure you want to delete ${deletingIngredientItem?.name}? This action cannot be undone.`
            : `Apakah Anda yakin ingin menghapus "${deletingIngredientItem?.name}" dari sistem? Data ini tidak dapat dikembalikan.`
        }
        variant="destructive"
      />

      {/* ── UNBOX (BUKA DUS KE ETALASE) MODAL ── */}
      <Dialog open={Boolean(itemToUnbox)} onOpenChange={(open) => !open && setItemToUnbox(null)}>
        <DialogContent className="sm:max-w-lg bg-white dark:bg-[#1C1C20] border border-slate-200/90 dark:border-[#2E2E34] text-slate-900 dark:text-slate-100 rounded-[32px] p-6 sm:p-8 shadow-2xl overflow-hidden text-center">
          {itemToUnbox && (() => {
            const sealedStock = Number(itemToUnbox.qty_sealed ?? 0);
            const looseStock = Number(itemToUnbox.qty_loose ?? itemToUnbox.current_stock ?? 0);
            const boxUnitName = itemToUnbox.box_unit || "Dus";
            const baseUnitName = itemToUnbox.base_unit || itemToUnbox.unit_type || "Pcs";
            const convRate = Number(itemToUnbox.conversion_rate || 1);
            const addedLoose = (boxesToUnbox || 0) * convRate;
            const remainingSealed = Math.max(0, sealedStock - (boxesToUnbox || 0));

            return (
              <div className="space-y-6">
                {/* Centered Header */}
                <DialogHeader className="flex flex-col items-center text-center space-y-2 pb-1">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
                    <Boxes className="w-6 h-6 stroke-[2]" />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                      {language === "en" ? "Stock Conversion / Unbox" : "Konversi Stok / Buka Dus"}
                    </span>
                    <DialogTitle className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight px-4">
                      {itemToUnbox.name}
                    </DialogTitle>
                  </div>

                  <DialogDescription className="sr-only">
                    {language === "en" ? "Unbox sealed inventory to display shelf" : "Bongkar dus segel ke rak etalase"}
                  </DialogDescription>

                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 font-mono text-[11px] text-blue-700 dark:text-blue-300 font-bold">
                      1 {boxUnitName} = {convRate} {baseUnitName}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-[11px]">
                      {language === "en" ? "Sealed Warehouse" : "Gudang Dus Segel"}:{" "}
                      <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{sealedStock} {boxUnitName}</strong>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-[11px]">
                      {language === "en" ? "Display Shelf" : "Rak Etalase"}:{" "}
                      <strong className="text-blue-600 dark:text-blue-400 font-bold">{looseStock} {baseUnitName}</strong>
                    </span>
                  </div>
                </DialogHeader>

                {/* Frameless Large Number with Stepper Buttons */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 px-2">
                    {/* Minus Stepper Button */}
                    <button
                      type="button"
                      onClick={() => setBoxesToUnbox(Math.max(1, (boxesToUnbox || 1) - 1))}
                      disabled={boxesToUnbox <= 1}
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white flex items-center justify-center transition-all active:scale-90 cursor-pointer shrink-0 border border-slate-200/80 dark:border-white/10 shadow-xs disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Minus className="w-6 h-6 stroke-[2.5]" />
                    </button>

                    {/* Frameless Number Display */}
                    <div className="flex-1 flex flex-col items-center justify-center min-w-0">
                      <input
                        type="number"
                        min="1"
                        max={sealedStock}
                        value={boxesToUnbox || ""}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setBoxesToUnbox(Math.min(sealedStock, Math.max(0, val)));
                        }}
                        placeholder="1"
                        className="w-full text-5xl sm:text-6xl font-black font-mono text-center bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-slate-900 dark:text-white tracking-tight [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        autoFocus
                      />
                      <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-1">
                        {boxUnitName} {language === "en" ? "to unbox" : "yang dibongkar"}
                      </span>
                    </div>

                    {/* Plus Stepper Button */}
                    <button
                      type="button"
                      onClick={() => setBoxesToUnbox(Math.min(sealedStock, (boxesToUnbox || 0) + 1))}
                      disabled={boxesToUnbox >= sealedStock}
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white flex items-center justify-center transition-all active:scale-90 cursor-pointer shrink-0 border border-slate-200/80 dark:border-white/10 shadow-xs disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Plus className="w-6 h-6 stroke-[2.5]" />
                    </button>
                  </div>

                  {/* Quick Preset Chips */}
                  <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                    {[1, 2, 5, 10].filter((n) => n <= sealedStock).map((qty) => (
                      <button
                        key={qty}
                        type="button"
                        onClick={() => setBoxesToUnbox(qty)}
                        className={`px-3 py-1.5 rounded-xl font-mono font-bold text-xs transition-all active:scale-95 cursor-pointer border ${
                          boxesToUnbox === qty
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs"
                            : "bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border-slate-200/60 dark:border-white/5"
                        }`}
                      >
                        {qty} {boxUnitName}
                      </button>
                    ))}
                    {sealedStock > 0 && (
                      <button
                        type="button"
                        onClick={() => setBoxesToUnbox(sealedStock)}
                        className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer border ${
                          boxesToUnbox === sealedStock
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs"
                            : "bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border-slate-200/60 dark:border-white/5"
                        }`}
                      >
                        {language === "en" ? `All (${sealedStock})` : `Semua (${sealedStock})`}
                      </button>
                    )}
                  </div>
                </div>

                {/* Centered Result Calculation Preview Box */}
                <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 space-y-2 text-xs text-left">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 font-medium">
                    <span>{language === "en" ? "Stock Conversion Yield:" : "Hasil Konversi Eceran:"}</span>
                    <span className="font-mono font-black text-blue-600 dark:text-blue-400 text-sm">
                      +{addedLoose} {baseUnitName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 font-medium">
                    <span>{language === "en" ? "Remaining Sealed Stock:" : "Sisa Stok Dus Segel:"}</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {remainingSealed} {boxUnitName}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-blue-200/50 dark:border-blue-800/40 flex items-center justify-between font-bold text-slate-900 dark:text-white">
                    <span>{language === "en" ? "Total Loose on Shelf After:" : "Total Eceran di Rak Nanti:"}</span>
                    <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
                      {looseStock + addedLoose} {baseUnitName}
                    </span>
                  </div>
                </div>

                {/* Operational Notes */}
                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {language === "en" ? "Operational Notes (Optional)" : "Catatan Operasional (Opsional)"}
                  </label>
                  <input
                    value={unboxNotes}
                    onChange={(e) => setUnboxNotes(e.target.value)}
                    placeholder={language === "en" ? "e.g. Restock front cashier shelf..." : "Contoh: Restock rak etalase depan kasir..."}
                    className="w-full px-4 py-2.5 rounded-2xl border border-slate-200/90 dark:border-[#38383C] bg-white dark:bg-[#222226] text-xs font-normal text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/15 dark:focus:ring-white/20 transition-all shadow-xs"
                  />
                </div>

                {/* Footer Buttons */}
                <DialogFooter className="gap-2 sm:gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setItemToUnbox(null)}
                    className="py-3 px-6 rounded-2xl border border-slate-200 dark:border-[#38383C] text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
                  >
                    {language === "en" ? "Cancel" : "Batal"}
                  </button>
                  <button
                    type="button"
                    onClick={handleUnboxSubmit}
                    disabled={isUnboxing || boxesToUnbox <= 0 || boxesToUnbox > sealedStock}
                    className="py-3 px-8 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs shadow-md hover:bg-black dark:hover:bg-slate-100 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isUnboxing
                      ? (language === "en" ? "Processing..." : "Memproses...")
                      : (language === "en" ? "Confirm Unbox" : "Konfirmasi Buka Dus")}
                  </button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

    </div>
  );
}

