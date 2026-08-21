import { useState, useEffect, useRef } from "react";
import { ErpDataTable } from "../../components/ErpDataTable";
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
  ArrowLeft, Barcode, CheckCircle2, AlertCircle, AlertTriangle,
  Info, Sparkles, Tag, DollarSign, Package, Plus, Edit3, Menu,
  Upload, X, MoreHorizontal, Search, SlidersHorizontal, ChevronDown, ArrowUpDown,
  Eye, Filter, Copy, Check, ChevronLeft, ChevronRight, LayoutGrid,
  Globe, RotateCcw, Archive, Layers
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku?: string;
  category?: string;
  unit_type: string;
  inventory_mode: string;
  purchase_price: number;
  sell_price: number;
  current_stock: number;
  min_stock_alert?: number;
  image_url?: string;
  created_at?: string;
  status: "active" | "inactive" | "discontinued";
}

interface InventoryModuleProps {
  view?: "master" | "new" | "edit" | "discontinued";
  product?: Product | null;
  onEditProduct?: (p: Product) => void;
  onAddNew?: () => void;
  onNavigate?: (view: string) => void;
  onCancel?: () => void;
  onSuccess?: () => void;
}

export default function InventoryModule({
  view = "master",
  product = null,
  onEditProduct,
  onAddNew,
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

  const isManagerOrOwner = activeContext?.role === "manager" || activeContext?.role === "owner";

  // Internal Navigation View & Selection States
  const [internalView, setInternalView] = useState<"master" | "new" | "edit" | "discontinued">(view || "master");
  const [internalProduct, setInternalProduct] = useState<Product | null>(product);

  useEffect(() => {
    setInternalView(view || "master");
    setInternalProduct(product || null);
  }, [view, product]);

  const activeView = internalView;
  const activeProduct = internalProduct;

  const handleTriggerAdd = () => {
    if (onAddNew) onAddNew();
    else if (onNavigate) onNavigate("inventory-add");
    else {
      setInternalProduct(null);
      setInternalView("new");
    }
  };

  const handleTriggerEdit = (targetProd: Product) => {
    if (onEditProduct) onEditProduct(targetProd);
    else {
      setInternalProduct(targetProd);
      setInternalView("edit");
    }
  };

  const handleFormBack = () => {
    if (onCancel) onCancel();
    setInternalView("master");
    setInternalProduct(null);
    fetchData();
  };

  // Search & Rich Multi-Filter States
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
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

  // Context Menu State (Right-click on table row)
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    product: Product;
  } | null>(null);

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

  // Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Product Form Inputs
  const [prodName, setProdName] = useState("");
  const [prodSku, setProdSku] = useState("");
  const [prodCat, setProdCat] = useState("General");
  const [prodUnit, setProdUnit] = useState("pcs");
  const [prodMode, setProdMode] = useState("dry_strict");
  const [prodBuy, setProdBuy] = useState("0");
  const [prodSell, setProdSell] = useState("0");
  const [prodStock, setProdStock] = useState("0");
  const [prodMinAlert, setProdMinAlert] = useState("");
  const [prodStatus, setProdStatus] = useState("active");
  const [prodImage, setProdImage] = useState("");
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const [formLoading, setFormLoading] = useState(false);

  // App UI/Theme State
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Category & Unit Selection States
  const [existingCategories, setExistingCategories] = useState<{ id: string; name: string }[]>([]);
  const [isCustomCat, setIsCustomCat] = useState(false);
  const [isCustomUnit, setIsCustomUnit] = useState(false);

  useEffect(() => {
    setIsDarkMode(document.documentElement.classList.contains("dark"));
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  // Global listener to close context menus on click outside or scroll
  useEffect(() => {
    const handleCloseMenu = () => {
      setContextMenu(null);
      setHeaderContextMenu(null);
    };
    window.addEventListener("click", handleCloseMenu);
    window.addEventListener("scroll", handleCloseMenu);
    return () => {
      window.removeEventListener("click", handleCloseMenu);
      window.removeEventListener("scroll", handleCloseMenu);
    };
  }, []);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get("/categories");
        setExistingCategories(res.data || []);
      } catch (err) {
        console.error("Failed to load categories:", err);
      }
    };
    if (activeView === "new" || activeView === "edit") {
      fetchCategories();
    }
  }, [activeView, activeContext]);

  useEffect(() => {
    if (activeView === "edit" && activeProduct && existingCategories.length > 0) {
      const catName = activeProduct.category || "General";
      const hasCat = existingCategories.some(c => c.name.toLowerCase() === catName.toLowerCase());
      if (catName !== "General" && !hasCat) {
        setIsCustomCat(true);
      } else {
        setIsCustomCat(false);
      }
    }
  }, [activeView, activeProduct, existingCategories]);

  const fetchData = async () => {
    if (activeView === "new" || activeView === "edit") {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const prodRes = await api.get("/products");
      setProducts(prodRes.data || []);
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
  }, [activeContext, activeView]);

  // Pre-fill form when entering edit mode or new mode
  useEffect(() => {
    if (previewImageUrl) {
      URL.revokeObjectURL(previewImageUrl);
    }
    setPendingImageFile(null);
    setPreviewImageUrl("");

    if (activeView === "edit" && activeProduct) {
      setProdName(activeProduct.name);
      setProdSku(activeProduct.sku || "");
      setProdCat(activeProduct.category || "General");
      setProdUnit(activeProduct.unit_type);
      
      const standardUnitVals = unitTypes.map((u) => u.val.toLowerCase());
      if (activeProduct.unit_type && !standardUnitVals.includes(activeProduct.unit_type.toLowerCase())) {
        setIsCustomUnit(true);
      } else {
        setIsCustomUnit(false);
      }

      setProdMode(activeProduct.inventory_mode);
      setProdBuy(formatNumberInput(activeProduct.purchase_price));
      setProdSell(formatNumberInput(activeProduct.sell_price));
      setProdStock(activeProduct.current_stock.toString());
      setProdMinAlert(activeProduct.min_stock_alert?.toString() || "");
      setProdStatus(activeProduct.status || "active");
      setProdImage(activeProduct.image_url || "");
    } else if (activeView === "new") {
      setProdName("");
      setProdSku("");
      setProdCat("General");
      setProdUnit("pcs");
      setIsCustomUnit(false);
      setProdMode("dry_strict");
      setProdBuy("");
      setProdSell("");
      setProdStock("0");
      setProdMinAlert("");
      setProdStatus("active");
      setProdImage("");
    }
  }, [activeView, activeProduct]);

  // Get full image url helper
  const getFullImageUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("/uploads/")) {
      const host = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api/v1").replace("/api/v1", "");
      return `${host}${url}`;
    }
    return url;
  };

  // Active display image helper (local blob preview takes precedence over stored image url)
  const activeDisplayImage = previewImageUrl || (prodImage ? getFullImageUrl(prodImage) : "");

  // Select file handler (Creates local blob preview without immediate HTTP upload)
  const handleFileChange = (file: File) => {
    if (!file) return;

    // 1. Validate MIME format
    const validImageTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "image/svg+xml"];
    const isImage = file.type ? validImageTypes.includes(file.type.toLowerCase()) || file.type.startsWith("image/") : /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name);

    if (!isImage) {
      toast.error(
        language === "id" ? "Format File Tidak Didukung" : "Unsupported File Format",
        {
          description: language === "id"
            ? `File "${file.name}" memiliki format (${file.type || "tidak diketahui"}). Harap gunakan format gambar: PNG, JPG, JPEG, WEBP, atau GIF.`
            : `File "${file.name}" has format (${file.type || "unknown"}). Please use an image file: PNG, JPG, JPEG, WEBP, or GIF.`,
        }
      );
      return;
    }

    // 2. Validate file size (Max 5MB)
    const MAX_SIZE_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      const currentSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      toast.error(
        language === "id" ? "Ukuran File Terlalu Besar" : "File Size Exceeds Limit",
        {
          description: language === "id"
            ? `Ukuran file "${file.name}" (${currentSizeMB} MB) melebihi batas maksimal 5.00 MB. Silakan kompres foto atau pilih file lain.`
            : `File "${file.name}" (${currentSizeMB} MB) exceeds the 5.00 MB limit. Please compress the image or select a smaller file.`,
        }
      );
      return;
    }

    // 3. Set local blob preview (Deferred upload until form submission)
    if (previewImageUrl) {
      URL.revokeObjectURL(previewImageUrl);
    }
    const localBlobUrl = URL.createObjectURL(file);
    setPendingImageFile(file);
    setPreviewImageUrl(localBlobUrl);

    toast.info(
      language === "id" ? "Foto Produk Dipilih" : "Photo Selected",
      {
        description: `${file.name} (${(file.size / 1024).toFixed(1)} KB) - Pratinjau lokal siap disimpan.`,
      }
    );
  };

  // Drag & drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Submit Product Form (Add New or Edit with deferred image upload)
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    let finalImageUrl = prodImage;

    // If a new local image file was picked, upload it now
    if (pendingImageFile) {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", pendingImageFile);

      try {
        const uploadRes = await api.post("/upload", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
        if (uploadRes.data && uploadRes.data.url) {
          finalImageUrl = uploadRes.data.url;
        }
      } catch (err: any) {
        const status = err.response?.status;
        const serverMsg = err.response?.data?.message || err.response?.data?.error;
        let detailedReason = serverMsg || err.message;

        if (status === 413) {
          detailedReason = language === "id"
            ? "Ukuran file foto melebihi kapasitas server (Payload Too Large)."
            : "File size exceeds server payload limits.";
        } else if (status === 401 || status === 403) {
          detailedReason = language === "id"
            ? "Sesi Anda tidak memiliki izin untuk mengunggah file media."
            : "Unauthorized to upload media files.";
        }

        toast.error(
          language === "id" ? "Gagal Mengunggah Foto Produk" : "Failed to Upload Image",
          {
            description: detailedReason,
          }
        );
        setUploading(false);
        setFormLoading(false);
        return;
      } finally {
        setUploading(false);
      }
    }

    const payload = {
      name: prodName,
      sku: prodSku || undefined,
      category: prodCat || undefined,
      unit_type: prodUnit,
      inventory_mode: prodMode,
      purchase_price: parseNumberInput(prodBuy),
      sell_price: parseNumberInput(prodSell),
      current_stock: parseFloat(prodStock) || 0,
      min_stock_alert: prodMinAlert ? parseFloat(prodMinAlert) : undefined,
      status: prodStatus,
      image_url: finalImageUrl || undefined,
    };

    try {
      if (activeView === "new") {
        await api.post("/products", payload);
        toast.success(t.successAddProduct);
        if (onSuccess) onSuccess();
        handleFormBack();
      } else if (activeView === "edit" && activeProduct) {
        await api.put(`/products/${activeProduct.id}`, payload);
        toast.success(t.successEditProduct);
        if (onSuccess) onSuccess();
        handleFormBack();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || t.errorSaveProduct);
    } finally {
      setFormLoading(false);
    }
  };

  // Quick Change Status directly from row menu or context menu
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

  // Render Form Page (For New & Edit)
  if (activeView === "new" || activeView === "edit") {
    const labelClass = "block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 text-left";
    
    // Icon-prefixed input (with padding left)
    const inputClass = `w-full pl-11 pr-4 py-2.5 rounded-full border text-sm font-semibold focus:outline-none focus:ring-2 transition-all duration-200 ${
      isDarkMode 
        ? "bg-dark-bg border-dark-border text-white focus:ring-primary/20 focus:border-primary" 
        : "bg-slate-50/70 border-slate-200 text-slate-850 focus:ring-slate-400/20 focus:border-slate-500"
    }`;

    // Normal input without left icon
    const normalInputClass = `w-full px-4 py-2.5 rounded-full border text-sm font-semibold focus:outline-none focus:ring-2 transition-all duration-200 ${
      isDarkMode 
        ? "bg-dark-bg border-dark-border text-white focus:ring-primary/20 focus:border-primary" 
        : "bg-slate-50/70 border-slate-200 text-slate-850 focus:ring-slate-400/20 focus:border-slate-500"
    }`;

    const dropdownTriggerClass = `w-full flex items-center justify-between px-4 py-2.5 rounded-full border focus:outline-none focus:ring-2 bg-slate-50/70 dark:bg-dark-bg border-slate-200 dark:border-dark-border text-slate-800 dark:text-slate-100 text-sm font-semibold cursor-pointer transition-all`;

    const bentoCardClass = "bg-white dark:bg-dark-card border border-slate-200/80 dark:border-dark-border rounded-3xl p-6 shadow-xs space-y-4 text-left";
    const bentoSidebarCardClass = "bg-white dark:bg-dark-card border border-slate-200/80 dark:border-dark-border rounded-3xl p-5 shadow-xs space-y-4 text-left";

    const cardHeadingClass = "text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-primary flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-[#333338]";

    // Calculations for real-time Profit Matrix
    const buyNum = parseNumberInput(prodBuy);
    const sellNum = parseNumberInput(prodSell);
    const profitNominal = sellNum - buyNum;
    const marginPercent = buyNum > 0 ? Math.round((profitNominal / buyNum) * 100) : (sellNum > 0 ? 100 : 0);

    const handleGenerateSku = () => {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const cleanCat = prodCat && prodCat !== "all" 
        ? prodCat.replace(/[^a-zA-Z]/g, "").substring(0, 3).toUpperCase() 
        : "PRD";
      setProdSku(`${cleanCat}-${randomSuffix}`);
    };

    return (
      <div className="max-w-6xl mx-auto space-y-6 text-left transition-all p-1">
        
        {/* ── HEADER TITLE BAR ── */}
        <div className="flex items-center space-x-3.5 pb-4 border-b border-slate-200/80 dark:border-slate-800">
          <button
            type="button"
            onClick={handleFormBack}
            className={`p-2.5 rounded-full border transition-all cursor-pointer ${
              isDarkMode ? "bg-dark-card border-dark-border text-white hover:bg-white/5" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
            title={t.cancel}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest opacity-60 flex items-center gap-1.5 text-slate-500">
              <Package className="w-3 h-3 text-slate-700 dark:text-primary" /> {t.inventoryBreadcrumb} / {activeView === "new" ? t.addNewProduct : t.edit}
            </span>
            <h3 className="text-xl font-bold tracking-tight mt-0.5 text-slate-900 dark:text-slate-100">
              {activeView === "new" ? t.addNewProduct : t.editProductTitle}
            </h3>
          </div>
        </div>

        {/* ── BENTO 2-COLUMN ASYMMETRIC GRID FORM ── */}
        <form onSubmit={handleProductSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* ── LEFT COLUMN (65% Width / lg:col-span-8): Primary Product & Business Data ── */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-6">
              
              {/* Card 1: Informasi Dasar Produk */}
              <div className={bentoCardClass}>
                <h4 className={cardHeadingClass}>
                  <Package className="w-4 h-4 text-slate-700 dark:text-primary" />
                  <span>{t.basicInfoSection}</span>
                </h4>

                {/* Nama Produk */}
                <div>
                  <label className={labelClass}>{t.productNameLabel} *</label>
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-slate-400">
                      <Tag className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={prodName}
                      onChange={(e) => setProdName(e.target.value)}
                      placeholder={t.productNamePlaceholder}
                      className={inputClass}
                      required
                    />
                  </div>
                </div>

                {/* Row: SKU & Barcode */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* SKU with Generate Button */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {t.skuLabel}
                      </label>
                      <button
                        type="button"
                        onClick={handleGenerateSku}
                        className="text-[10px] font-bold text-slate-700 dark:text-primary hover:underline flex items-center gap-1 cursor-pointer"
                        title={t.generateSku}
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>{t.generateSku}</span>
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-4 top-3 text-slate-400">
                        <Barcode className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        value={prodSku}
                        onChange={(e) => setProdSku(e.target.value)}
                        placeholder={t.barcodeSkuPlaceholder}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {/* Kategori */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {t.productCategoryLabel}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomCat(!isCustomCat);
                          if (!isCustomCat) {
                            setProdCat("");
                          } else {
                            setProdCat("General");
                          }
                        }}
                        className="text-[10px] font-bold text-slate-700 dark:text-primary hover:underline cursor-pointer"
                      >
                        {isCustomCat ? t.backToListCategory : t.customCategoryOption}
                      </button>
                    </div>

                    {isCustomCat ? (
                      <input
                        type="text"
                        value={prodCat}
                        onChange={(e) => setProdCat(e.target.value)}
                        placeholder={t.customCategoryPlaceholder}
                        className={normalInputClass}
                        required
                      />
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger className={dropdownTriggerClass}>
                          <span>{prodCat || t.selectCategory}</span>
                          <span className="text-[10px] opacity-60">▼</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-white dark:bg-[#202024] border border-slate-200 dark:border-dark-border shadow-xl rounded-xl p-1.5 min-w-[220px] max-h-60 overflow-y-auto">
                          {existingCategories.length === 0 ? (
                            <DropdownMenuItem disabled className="text-xs opacity-60 px-3 py-2">
                              {t.noCategoriesYet}
                            </DropdownMenuItem>
                          ) : (
                            existingCategories.map((c) => (
                              <DropdownMenuItem
                                key={c.id}
                                onClick={() => setProdCat(c.name)}
                                className="cursor-pointer px-3 py-2 text-xs text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg font-semibold"
                              >
                                {c.name}
                              </DropdownMenuItem>
                            ))
                          )}
                          <div className="border-t border-slate-100 dark:border-[#333338] my-1" />
                          <DropdownMenuItem
                            onClick={() => {
                              setIsCustomCat(true);
                              setProdCat("");
                            }}
                            className="cursor-pointer px-3 py-2 text-xs text-slate-800 dark:text-primary hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg font-extrabold flex items-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" /> {t.customCategoryOption}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>

                {/* Satuan Unit */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t.unitTypeLabel}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomUnit(!isCustomUnit);
                        if (!isCustomUnit) {
                          setProdUnit("");
                        } else {
                          setProdUnit("pcs");
                        }
                      }}
                      className="text-[10px] font-bold text-slate-700 dark:text-primary hover:underline cursor-pointer"
                    >
                      {isCustomUnit ? t.backToListUnit : t.customUnitOption}
                    </button>
                  </div>

                  {isCustomUnit ? (
                    <input
                      type="text"
                      value={prodUnit}
                      onChange={(e) => setProdUnit(e.target.value)}
                      placeholder={t.customUnitPlaceholder}
                      className={normalInputClass}
                      required
                    />
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger className={dropdownTriggerClass}>
                        <span className="capitalize">{unitTypes.find(u => u.val === prodUnit)?.label || prodUnit}</span>
                        <span className="text-[10px] opacity-60">▼</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-white dark:bg-[#202024] border border-slate-200 dark:border-dark-border shadow-xl rounded-xl p-1.5 min-w-[220px]">
                        {unitTypes.map((u) => (
                          <DropdownMenuItem
                            key={u.val}
                            onClick={() => setProdUnit(u.val)}
                            className="cursor-pointer px-3 py-2 text-xs text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg font-semibold"
                          >
                            {u.label}
                          </DropdownMenuItem>
                        ))}
                        <div className="border-t border-slate-100 dark:border-[#333338] my-1" />
                        <DropdownMenuItem
                          onClick={() => {
                            setIsCustomUnit(true);
                            setProdUnit("");
                          }}
                          className="cursor-pointer px-3 py-2 text-xs text-slate-800 dark:text-primary hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg font-extrabold flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" /> {t.customUnitOption}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>

              {/* Card 2: Penetapan Harga & Margin Matrix */}
              <div className={bentoCardClass}>
                <h4 className={cardHeadingClass}>
                  <DollarSign className="w-4 h-4 text-slate-700 dark:text-primary" />
                  <span>{t.pricingSection}</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Harga Modal (HPP) */}
                  <div>
                    <label className={labelClass}>{t.costPriceHpp} *</label>
                    <div className="relative">
                      <span className="absolute left-4 top-2.5 text-slate-400 text-xs font-bold">Rp</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={prodBuy}
                        onChange={(e) => setProdBuy(formatNumberInput(e.target.value))}
                        className={inputClass}
                        required
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Harga Jual */}
                  <div>
                    <label className={labelClass}>{t.sellingPrice} *</label>
                    <div className="relative">
                      <span className="absolute left-4 top-2.5 text-slate-400 text-xs font-bold">Rp</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={prodSell}
                        onChange={(e) => setProdSell(formatNumberInput(e.target.value))}
                        className={inputClass}
                        required
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Real-time Profit Margin Calculation Banner */}
                <div className="p-3.5 bg-slate-50 dark:bg-[#1B1B1E] rounded-2xl border border-slate-200/80 dark:border-[#303035] flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      {t.grossProfit}
                    </span>
                    <p className={`font-mono font-extrabold text-sm ${profitNominal >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                      Rp {profitNominal.toLocaleString("id-ID")}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">
                      {t.profitMargin}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black ${
                      profitNominal >= 0 
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    }`}>
                      {profitNominal >= 0 ? `+${marginPercent}%` : `${marginPercent}%`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: Inventori & Aturan Mode */}
              <div className={bentoCardClass}>
                <h4 className={cardHeadingClass}>
                  <Layers className="w-4 h-4 text-slate-700 dark:text-primary" />
                  <span>{t.inventorySection}</span>
                </h4>

                {/* Interactive Inventory Mode Selector */}
                <div>
                  <label className={labelClass}>{t.inventoryModeLabel}</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {inventoryModes.map((m) => {
                      const isModeActive = prodMode === m.val;
                      return (
                        <button
                          key={m.val}
                          type="button"
                          onClick={() => setProdMode(m.val)}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                            isModeActive
                              ? "bg-slate-900 text-white border-slate-900 dark:bg-primary dark:border-primary dark:text-slate-900 shadow-xs"
                              : "bg-slate-50/70 dark:bg-dark-bg border-slate-200/80 dark:border-[#333338] text-slate-700 dark:text-slate-300 hover:border-slate-400"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-extrabold">{m.label}</span>
                            {isModeActive && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <p className={`text-[10px] leading-relaxed line-clamp-2 ${
                            isModeActive ? "opacity-90 font-medium" : "opacity-60"
                          }`}>
                            {m.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Row: Stok Awal & Min Alert */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className={labelClass}>{t.initialStockLabel} *</label>
                    <input
                      type="number"
                      value={prodStock}
                      onChange={(e) => setProdStock(e.target.value)}
                      className={normalInputClass}
                      required
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>{t.minAlertOptionalLabel}</label>
                    <input
                      type="number"
                      value={prodMinAlert}
                      onChange={(e) => setProdMinAlert(e.target.value)}
                      placeholder={t.minAlertPlaceholder}
                      className={normalInputClass}
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* ── RIGHT COLUMN (35% Width / lg:col-span-4): Sidebar, Media, Status, & Live Preview ── */}
            <div className="lg:col-span-5 xl:col-span-4 space-y-6">
              
              {/* Card 4: Media / Foto Produk */}
              <div className={bentoSidebarCardClass}>
                <h4 className={cardHeadingClass}>
                  <Upload className="w-4 h-4 text-slate-700 dark:text-primary" />
                  <span>{t.mediaSection}</span>
                </h4>

                {/* Dropzone */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`relative w-full h-40 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center overflow-hidden transition-all duration-200 cursor-pointer ${
                    dragActive 
                      ? "border-slate-800 dark:border-primary bg-slate-100/50 dark:bg-primary/5 scale-[1.01]" 
                      : prodImage 
                        ? "border-emerald-500/50 bg-emerald-500/[0.02]" 
                        : "border-slate-300 dark:border-dark-border-lighter hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-dark-bg"
                  }`}
                >
                  <input
                    type="file"
                    id="product-image-file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileChange(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />

                  {uploading ? (
                    <div className="flex flex-col items-center space-y-2">
                      <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-800 dark:border-t-primary rounded-full animate-spin" />
                      <span className="text-xs font-bold opacity-75">{t.uploadingImage}</span>
                    </div>
                  ) : activeDisplayImage ? (
                    <div className="relative w-full h-full group">
                      <img
                        src={activeDisplayImage}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => document.getElementById("product-image-file")?.click()}
                          className="px-3 py-1.5 bg-white text-slate-800 text-[11px] font-extrabold rounded-full shadow-md cursor-pointer"
                        >
                          {t.changeFile}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (previewImageUrl) {
                              URL.revokeObjectURL(previewImageUrl);
                            }
                            setPendingImageFile(null);
                            setPreviewImageUrl("");
                            setProdImage("");
                          }}
                          className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md cursor-pointer"
                          title={t.removeImage}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      onClick={() => document.getElementById("product-image-file")?.click()}
                      className="w-full h-full flex flex-col items-center justify-center p-4 text-center space-y-1.5"
                    >
                      <Upload className="w-7 h-7 text-slate-400 dark:text-primary opacity-70" />
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {t.dragDropPrompt} <span className="text-slate-800 dark:text-primary underline">{t.browseFile}</span>
                      </div>
                      <p className="text-[10px] opacity-60">{t.fileSupportHint}</p>
                    </div>
                  )}
                </div>

                {/* Direct URL input */}
                <div className="relative">
                  <span className="absolute left-4 top-3 text-slate-400">
                    <Sparkles className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="url"
                    value={prodImage}
                    onChange={(e) => {
                      if (previewImageUrl) {
                        URL.revokeObjectURL(previewImageUrl);
                        setPreviewImageUrl("");
                        setPendingImageFile(null);
                      }
                      setProdImage(e.target.value);
                    }}
                    placeholder={t.imageUrlPlaceholder}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Card 5: Status & Visibilitas */}
              <div className={bentoSidebarCardClass}>
                <h4 className={cardHeadingClass}>
                  <Eye className="w-4 h-4 text-slate-700 dark:text-primary" />
                  <span>{t.statusSection}</span>
                </h4>

                <div className="space-y-1.5">
                  {statusOptions.map((s) => {
                    const isStatusActive = prodStatus === s.val;
                    return (
                      <button
                        key={s.val}
                        type="button"
                        onClick={() => setProdStatus(s.val as any)}
                        className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          isStatusActive
                            ? "bg-slate-900 text-white border-slate-900 dark:bg-primary dark:border-primary dark:text-slate-900 font-bold shadow-xs"
                            : "bg-slate-50/70 dark:bg-dark-bg border-slate-200/80 dark:border-[#333338] text-slate-700 dark:text-slate-300 hover:border-slate-400"
                        }`}
                      >
                        <span className="capitalize">{s.label}</span>
                        {isStatusActive && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card 6: Pratinjau Kartu Produk (Live Preview) */}
              <div className={bentoSidebarCardClass}>
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#333338]">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-primary flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{t.livePreview}</span>
                  </h4>
                  <span className="text-[10px] font-bold text-slate-400">POS Mockup</span>
                </div>

                {/* Mockup Card */}
                <div className="bg-slate-50 dark:bg-[#1A1A1D] border border-slate-200/80 dark:border-[#333338] rounded-2xl p-3 space-y-2.5">
                  <div className="w-full h-28 rounded-xl bg-slate-200 dark:bg-[#252528] overflow-hidden flex items-center justify-center">
                    {activeDisplayImage ? (
                      <img
                        src={activeDisplayImage}
                        alt={prodName || "Preview"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-8 h-8 text-slate-400 opacity-50" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-slate-200/80 dark:bg-[#303035] rounded-full text-slate-600 dark:text-slate-300">
                        {prodCat || "General"}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        {prodStock || 0} {prodUnit}
                      </span>
                    </div>
                    <p className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                      {prodName || "Nama Produk Anda"}
                    </p>
                    <p className="font-mono font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                      Rp {parseNumberInput(prodSell).toLocaleString("id-ID")}
                    </p>
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* ── STICKY FOOTER ACTIONS ── */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200/80 dark:border-slate-800">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-3 font-bold border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 rounded-full cursor-pointer text-xs transition-all"
              >
                {t.cancel}
              </button>
            )}
            <button
              type="submit"
              disabled={formLoading}
              className="px-8 py-3 font-extrabold rounded-full cursor-pointer text-xs shadow-md transition-all bg-slate-900 hover:bg-slate-800 dark:bg-primary dark:hover:bg-primary/85 text-white dark:text-slate-900 flex items-center gap-2"
            >
              {formLoading ? (
                <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4 stroke-[3]" />
              )}
              <span>{formLoading ? t.saving : t.saveProductButton}</span>
            </button>
          </div>
        </form>

      </div>
    );
  }

  // ================= RENDER PRODUCT LIST (MASTER INVENTORY) =================

  // Dynamically multi-filter products
  const filteredProducts = products.filter((p) => {
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
    ...Array.from(new Set(products.map((p) => p.category || "General"))).filter(Boolean),
  ];

  // KPI summary metrics calculated from total products list
  const kpiMetrics = {
    total: products.length,
    lowStock: products.filter(
      (p) => p.min_stock_alert !== undefined && p.current_stock <= p.min_stock_alert && p.current_stock > 0
    ).length,
    outOfStock: products.filter((p) => p.current_stock <= 0).length,
    inactive: products.filter((p) => p.status !== "active").length,
  };

  return (
    <div className="space-y-6 text-left transition-all relative">
      
      {/* ── DYNAMIC FLOATING HEADER BAR (SYNCHRONIZED SEARCH) ── */}
      {/* Kondisi 1: Unscrolled (isScrolled === false) -> Menu icon ONLY at top-right with NO background */}
      {!isScrolled && (
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("open_mobile_menu"))}
          className="fixed top-3 right-3 z-40 p-2 text-slate-800 dark:text-slate-100 drop-shadow-md hover:opacity-80 active:scale-95 transition-all cursor-pointer"
          title="Menu Navigasi"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-6 h-6 stroke-[2.5]" />
        </button>
      )}

      {/* Kondisi 2: Scrolled Down & Search Inactive (isScrolled === true & !isSearchActive) */}
      {isScrolled && !isSearchActive && (
        <>
          {/* Search Trigger Button slides in from Left */}
          <button
            type="button"
            onClick={() => setIsSearchExpanded(true)}
            className="fixed top-3 left-3 z-40 w-10 h-10 rounded-full backdrop-blur-xl bg-slate-900/85 dark:bg-[#202024]/90 text-white flex items-center justify-center shadow-lg border border-white/20 active:scale-95 transition-all cursor-pointer animate-in slide-in-from-left-4 duration-300"
            title="Cari Produk"
            aria-label="Open Floating Search"
          >
            <Search className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Combined Plus + Menu Glass Pill at Top Right */}
          <div className="fixed top-3 right-3 z-40 backdrop-blur-xl bg-slate-900/85 dark:bg-[#202024]/90 text-white rounded-full p-1.5 px-2.5 border border-white/20 shadow-xl flex items-center gap-1.5 transition-all duration-300 animate-in fade-in zoom-in-95">
            {isManagerOrOwner && (
              <>
                <button
                  type="button"
                  onClick={handleTriggerAdd}
                  className="p-1 hover:bg-white/10 rounded-full transition-colors active:scale-95 cursor-pointer"
                  title="Tambah Produk Baru"
                  aria-label="Add Product"
                >
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                </button>
                <div className="w-px h-4 bg-white/25" />
              </>
            )}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("open_mobile_menu"))}
              className="p-1 hover:bg-white/10 rounded-full transition-colors active:scale-95 cursor-pointer"
              title="Menu Navigasi"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </>
      )}

      {/* Kondisi 3: Scrolled Down & Search Active (isScrolled === true & isSearchActive) */}
      {isScrolled && isSearchActive && (
        <>
          {/* Full Width Floating Search Bar Pill from Left to Right */}
          <div className="fixed top-3 left-3 right-16 z-50 backdrop-blur-xl bg-white/95 dark:bg-[#202024]/95 text-slate-900 dark:text-slate-100 rounded-full border border-slate-300/80 dark:border-[#38383C] shadow-2xl px-3.5 py-1.5 flex items-center gap-2.5 transition-all duration-300 animate-in fade-in slide-in-from-left-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0 stroke-[2.5]" />
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari produk, SKU, kategori..."
              className="w-full bg-transparent text-xs font-semibold focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setIsSearchExpanded(false);
              }}
              className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
              title="Tutup & Reset Pencarian"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          {/* Top Right Floating Menu Button ONLY (Plus icon hidden) */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("open_mobile_menu"))}
            className="fixed top-3 right-3 z-40 w-10 h-10 rounded-full backdrop-blur-xl bg-slate-900/85 dark:bg-[#202024]/90 text-white flex items-center justify-center shadow-lg border border-white/20 active:scale-95 transition-all cursor-pointer"
            title="Menu Navigasi"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5 stroke-[2.5]" />
          </button>
        </>
      )}

      {/* ── PAGE HEADER ── */}
      <div className="border-b border-slate-200/80 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 capitalize">
            {activeView === "master" ? t.masterInventoryTitle : t.discontinuedTitle}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
            {activeView === "master" ? t.masterInventoryDesc : t.discontinuedDesc}
          </p>
        </div>

        {/* Action Button: Add New Product */}
        {activeView === "master" && (
          <button
            type="button"
            onClick={handleTriggerAdd}
            className="px-4 py-2.5 rounded-full font-bold text-xs bg-primary dark:bg-primary text-slate-900 shadow-sm hover:brightness-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{t.menuAddNewProduct}</span>
          </button>
        )}
      </div>

      {/* ── TOP KPI QUICK-FILTER CARDS STRIP (OPSI A: BEST PRACTICE UX FOR USER-FRIENDLINESS) ── */}
      {view === "master" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Card 1: Semua Produk */}
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
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                {t.kpiAllProducts}
              </span>
              <span className="text-xl font-extrabold font-mono text-slate-900 dark:text-slate-100 group-hover:scale-105 transition-transform inline-block">
                {kpiMetrics.total}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#252528] flex items-center justify-center text-slate-600 dark:text-slate-300">
              <Package className="w-4 h-4" />
            </div>
          </button>

          {/* Card 2: Stok Menipis */}
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

          {/* Card 3: Stok Habis */}
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

          {/* Card 4: Non-Aktif / Arsip */}
          <button
            type="button"
            onClick={() => {
              setFilterStock("all");
              setStatusFilter({ active: false, inactive: true, discontinued: true });
            }}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between group ${
              !statusFilter.active && (statusFilter.inactive || statusFilter.discontinued)
                ? "bg-slate-700 dark:bg-[#333339] border-slate-700 dark:border-slate-500 text-white ring-2 ring-slate-700/20 shadow-sm"
                : "bg-white dark:bg-dark-card border-slate-200/80 dark:border-dark-border text-slate-700 dark:text-slate-200 hover:border-slate-300"
            }`}
          >
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                {t.kpiInactive}
              </span>
              <span className="text-xl font-extrabold font-mono text-slate-600 dark:text-slate-400 group-hover:scale-105 transition-transform inline-block">
                {kpiMetrics.inactive}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#252528] flex items-center justify-center text-slate-500 dark:text-slate-400">
              <Archive className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* ── SEARCH BAR & RICH HORIZONTAL MULTI-FILTER TOOLBAR ── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-5 top-3.5 w-4 h-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
              }}
              placeholder={t.searchPlaceholder}
              className={`w-full pl-12 pr-16 py-3 rounded-full border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-400/20 transition-all ${
                isDarkMode 
                  ? "bg-dark-card border-dark-border text-white focus:border-primary" 
                  : "bg-white border-light-border/60 text-slate-800 focus:border-slate-500"
              }`}
            />
            <div className="absolute right-4 top-3 flex items-center gap-1.5">
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 cursor-pointer"
                  title="Hapus"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <kbd
                  className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-dark-bg border border-slate-200 dark:border-dark-border rounded-md pointer-events-none shadow-2xs"
                  title={t.shortcutSearchHint}
                >
                  /
                </kbd>
              )}
            </div>
          </div>

          {/* Controls: Rich Horizontal Multi-Filter & Sort Menu */}
          <div className="flex items-center gap-2 shrink-0">
            
            {/* Sort Dropdown Button (Shadcn UI) */}
            <DropdownMenu>
              <DropdownMenuTrigger className={`flex items-center gap-1.5 px-3.5 py-3 rounded-full border text-xs font-bold cursor-pointer transition-all ${
                sortBy !== "name_asc"
                  ? "bg-slate-900 text-white border-slate-900 dark:bg-primary dark:border-primary dark:text-slate-900 shadow-sm"
                  : isDarkMode
                  ? "bg-dark-card border-dark-border text-slate-200 hover:bg-white/5"
                  : "bg-white border-light-border/60 text-slate-700 hover:bg-slate-50"
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

            {/* Multi-Filter Dropdown Button */}
            <DropdownMenu>
              <DropdownMenuTrigger className={`flex items-center gap-2 px-4 py-3 rounded-full border text-xs font-bold cursor-pointer transition-all ${
                activeFiltersCount > 0
                  ? "bg-slate-900 text-white border-slate-900 dark:bg-primary dark:border-primary dark:text-slate-900 shadow-sm"
                  : isDarkMode
                  ? "bg-dark-card border-dark-border text-slate-200 hover:bg-white/5"
                  : "bg-white border-light-border/60 text-slate-700 hover:bg-slate-50"
              }`}>
                <Filter className="w-3.5 h-3.5" />
                <span>{t.filter}</span>
                {activeFiltersCount > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    isDarkMode ? "bg-black text-primary" : "bg-white text-slate-900"
                  }`}>
                    {activeFiltersCount}
                  </span>
                )}
                <span className="text-[10px] opacity-60">▼</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#3A3A3E] shadow-2xl rounded-2xl p-5 w-[760px] max-w-[95vw] space-y-4">
                
                {/* Header of Filter Dropdown */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#333338]">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5" /> {t.filter}
                  </span>
                  {activeFiltersCount > 0 && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="text-[11px] font-bold text-red-500 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" /> {t.resetFilter}
                    </button>
                  )}
                </div>

                {/* Horizontal 4-Column Layout */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-[#333338]">
                  
                  {/* Column 1: Filter Status */}
                  <div className="space-y-2 pr-2">
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      {t.filterStatusLabel}
                    </label>
                    <div className="space-y-1">
                      {[
                        { key: "active", label: t.statusActive },
                        { key: "inactive", label: t.statusInactive },
                        { key: "discontinued", label: t.statusDiscontinued },
                      ].map((s) => {
                        const isChecked = statusFilter[s.key as keyof typeof statusFilter];
                        return (
                          <label
                            key={s.key}
                            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer select-none transition-colors"
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                setStatusFilter((prev) => ({
                                  ...prev,
                                  [s.key]: Boolean(checked),
                                }));
                              }}
                            />
                            <span className={`truncate font-semibold ${isChecked ? "text-slate-900 dark:text-slate-100" : "text-slate-400"}`}>
                              {s.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Column 2: Filter Inventory Mode */}
                  <div className="space-y-2 pl-0 sm:pl-4 pr-2 pt-3 sm:pt-0">
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      {t.filterModeLabel}
                    </label>
                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                      <button
                        type="button"
                        onClick={() => {
                          setFilterMode("all");
                        }}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer text-left ${
                          filterMode === "all"
                            ? "text-slate-900 dark:text-primary font-bold bg-slate-100 dark:bg-white/5"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                        }`}
                      >
                        <div className="w-4 h-4 flex items-center justify-center shrink-0">
                          {filterMode === "all" && <Check className="w-3.5 h-3.5 stroke-[2.5] text-slate-900 dark:text-primary" />}
                        </div>
                        <span className="truncate">{t.filterModeAll}</span>
                      </button>
                      {inventoryModes.map((m) => {
                        const isSelected = filterMode === m.val;
                        return (
                          <button
                            key={m.val}
                            type="button"
                            onClick={() => {
                              setFilterMode(m.val);
                            }}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer text-left ${
                              isSelected
                                ? "text-slate-900 dark:text-primary font-bold bg-slate-100 dark:bg-white/5"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                            }`}
                          >
                            <div className="w-4 h-4 flex items-center justify-center shrink-0">
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5] text-slate-900 dark:text-primary" />}
                            </div>
                            <span className="truncate">{m.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Column 3: Filter Stock Availability */}
                  <div className="space-y-2 pl-0 sm:pl-4 pr-2 pt-3 sm:pt-0">
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      {t.filterStockLabel}
                    </label>
                    <div className="space-y-1">
                      {[
                        { val: "all", label: t.filterStockAll },
                        { val: "in_stock", label: t.filterStockAvailable },
                        { val: "low_stock", label: t.filterStockLow },
                        { val: "out_of_stock", label: t.filterStockOut },
                      ].map((stk) => {
                        const isSelected = filterStock === stk.val;
                        return (
                          <button
                            key={stk.val}
                            type="button"
                            onClick={() => {
                              setFilterStock(stk.val);
                            }}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer text-left ${
                              isSelected
                                ? "text-slate-900 dark:text-primary font-bold bg-slate-100 dark:bg-white/5"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                            }`}
                          >
                            <div className="w-4 h-4 flex items-center justify-center shrink-0">
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5] text-slate-900 dark:text-primary" />}
                            </div>
                            <span className="truncate">{stk.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Column 4: Urutkan (Sorting) */}
                  <div className="space-y-2 pl-0 sm:pl-4 pt-3 sm:pt-0">
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Urutkan Produk
                    </label>
                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                      {[
                        { key: "name_asc", label: "Nama (A - Z)" },
                        { key: "name_desc", label: "Nama (Z - A)" },
                        { key: "price_asc", label: "Harga: Terendah → Tertinggi" },
                        { key: "price_desc", label: "Harga: Tertinggi → Terendah" },
                        { key: "stock_desc", label: "Stok: Terbanyak → Tersedikit" },
                        { key: "stock_asc", label: "Stok: Tersedikit → Terbanyak" },
                        { key: "newest", label: "Produk Terbaru" },
                      ].map((s) => {
                        const isSelected = sortBy === s.key;
                        return (
                          <button
                            key={s.key}
                            type="button"
                            onClick={() => setSortBy(s.key as any)}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer text-left ${
                              isSelected
                                ? "text-slate-900 dark:text-primary font-bold bg-slate-100 dark:bg-white/5"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                            }`}
                          >
                            <div className="w-4 h-4 flex items-center justify-center shrink-0">
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5] text-slate-900 dark:text-primary" />}
                            </div>
                            <span className="truncate">{s.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>

              </DropdownMenuContent>
            </DropdownMenu>

            {/* Quick Reset Filters button if any active */}
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3.5 py-3 rounded-full border text-xs font-bold cursor-pointer transition-all bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 hover:bg-red-500/20 flex items-center gap-1.5"
                title={t.filterResetAll}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.resetFilter}</span>
              </button>
            )}

          </div>
        </div>

        {/* Category Pill Group (Full Width with Active Underline, Scroll Chevrons, and Grid Modal Trigger) */}
        <div className="flex items-center justify-between bg-slate-100 dark:bg-[#202023] p-1.5 rounded-full border border-slate-200/70 dark:border-[#35353A] w-full gap-2 shadow-sm">
          {/* Scrollable Categories List */}
          <div
            ref={categoryScrollRef}
            className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 py-0.5 px-1 scroll-smooth"
          >
            {categoriesList.map((cat) => {
              const isCatActive = selectedCategory.toLowerCase() === cat.toLowerCase();
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat);
                  }}
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
            })}
          </div>

          {/* Right Controls: Chevrons & Grid Button */}
          <div className="flex items-center gap-1 shrink-0 pl-1 pr-0.5">
            <button
              type="button"
              onClick={() => handleScrollCategory("left")}
              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/80 dark:hover:bg-white/10 transition-all cursor-pointer"
              title="Scroll Left"
              aria-label="Scroll Categories Left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleScrollCategory("right")}
              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/80 dark:hover:bg-white/10 transition-all cursor-pointer"
              title="Scroll Right"
              aria-label="Scroll Categories Right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="w-[1px] h-4 bg-slate-300 dark:bg-dark-border mx-0.5" />
            <button
              type="button"
              onClick={() => {
                setCategorySearch("");
                setIsCategoryDialogOpen(true);
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-white dark:bg-[#2B2B30] text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-primary hover:scale-105 border border-slate-200/80 dark:border-dark-border shadow-sm transition-all cursor-pointer"
              title={t.viewAllCategories}
              aria-label={t.viewAllCategories}
            >
              <LayoutGrid className="w-4 h-4" />
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
        <>
          {/* ── REUSABLE UNIFIED ERP DATA TABLE (DESKTOP TABLE + MOBILE ACCORDION) ── */}
          <ErpDataTable<Product>
        data={sortedProducts}
        keyExtractor={(p) => p.id}
        loading={loading}
        emptyText={t.noData}
        onRowClick={(p) => handleTriggerEdit(p)}
        onRowContextMenu={(e, p) => {
          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            product: p,
          });
        }}
        renderMobileItem={(p) => {
          const isExpanded = expandedProductId === p.id;
          const profitNominal = p.sell_price - p.purchase_price;
          const marginPercent = p.purchase_price > 0 ? Math.round((profitNominal / p.purchase_price) * 100) : 100;

          return (
            <div className="transition-colors">
              <div
                onClick={() => setExpandedProductId(isExpanded ? null : p.id)}
                className="flex items-center justify-between py-3 px-1 hover:bg-slate-100/50 dark:hover:bg-white/[0.03] active:bg-slate-200/40 dark:active:bg-white/5 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 dark:bg-dark-bg flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-dark-border">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate group-hover:text-slate-700 dark:group-hover:text-primary transition-colors">
                      {p.name}
                    </h4>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 text-right">
                  <div>
                    <div className="font-mono font-extrabold text-sm text-slate-900 dark:text-slate-100">
                      Rp {p.sell_price.toLocaleString("id-ID")}
                    </div>
                    <div className="flex items-center justify-end gap-1.5 mt-0.5">
                      <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
                        {p.current_stock} {p.unit_type}
                      </span>
                      <div
                        className={`w-2 h-2 rounded-full ${
                          p.status === "active" ? "bg-emerald-500" : p.status === "inactive" ? "bg-slate-400" : "bg-red-500"
                        }`}
                        title={`Status: ${p.status}`}
                      />
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${
                    isExpanded ? "rotate-90 text-slate-900 dark:text-slate-100" : ""
                  }`} />
                </div>
              </div>

              {isExpanded && (
                <div className="px-3 pb-4 pt-2 bg-slate-50/70 dark:bg-[#1A1A1E]/80 rounded-2xl mb-2 border border-slate-200/50 dark:border-[#25252A] space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center gap-2 text-xs flex-wrap pb-1 border-b border-slate-200/40 dark:border-[#2A2A30]">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200/80 dark:bg-[#25252A] text-slate-700 dark:text-slate-300">
                      {t.colCategory}: <strong className="font-bold">{p.category || "General"}</strong>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-slate-200/80 dark:bg-[#25252A] text-slate-700 dark:text-slate-300">
                      SKU: <strong className="font-bold">{p.sku || "-"}</strong>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200/80 dark:bg-[#25252A] text-slate-700 dark:text-slate-300">
                      Satuan: <strong className="font-bold">{p.unit_type}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-3 bg-white dark:bg-[#222226] rounded-xl border border-slate-200/60 dark:border-[#303035] space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Matriks Keuangan</span>
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                        <span>Harga Modal (HPP):</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-slate-100">Rp {p.purchase_price.toLocaleString("id-ID")}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-[#2F2F34]">
                        <span>Margin Profit:</span>
                        <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400">+Rp {profitNominal.toLocaleString("id-ID")} ({marginPercent}%)</span>
                      </div>
                    </div>

                    <div className="p-3 bg-white dark:bg-[#222226] rounded-xl border border-slate-200/60 dark:border-[#303035] space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Aturan Mode Inventori</span>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Mode:</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100 capitalize">{p.inventory_mode === "dry_strict" ? "Dry Strict" : p.inventory_mode === "wet_batch_thaw" ? "Wet Batch Thaw" : "Infinite"}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-[#2F2F34]">
                        <span>Limit Peringatan Stok:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{p.min_stock_alert} {p.unit_type}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <button
                      type="button"
                      onClick={() => handleTriggerEdit(p)}
                      className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 dark:bg-primary text-white dark:text-slate-900 font-bold text-xs cursor-pointer transition-all active:scale-95 shadow-2xs"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Detail</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (p.sku) {
                          navigator.clipboard.writeText(p.sku);
                          toast.success(t.skuCopied);
                        }
                      }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[#222226] border border-slate-200/80 dark:border-[#333338] hover:bg-slate-100 dark:hover:bg-white/10 font-bold text-xs text-slate-700 dark:text-slate-300 cursor-pointer transition-all active:scale-95"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Salin SKU</span>
                    </button>

                    <DropdownMenu>
                      <DropdownMenuTrigger className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[#222226] border border-slate-200/80 dark:border-[#333338] hover:bg-slate-100 dark:hover:bg-white/10 font-bold text-xs text-slate-700 dark:text-slate-300 cursor-pointer transition-all">
                        <span className={`w-2 h-2 rounded-full ${p.status === "active" ? "bg-emerald-500" : p.status === "inactive" ? "bg-slate-400" : "bg-red-500"}`} />
                        <span className="capitalize">{p.status}</span>
                        <ChevronDown className="w-3 h-3 text-slate-400" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#3A3A3E] shadow-xl rounded-xl p-1 min-w-[140px]">
                        {[
                          { val: "active", label: "Aktif", color: "bg-emerald-500" },
                          { val: "inactive", label: "Non-Aktif", color: "bg-slate-400" },
                          { val: "discontinued", label: "Dihentikan", color: "bg-red-500" },
                        ].map((st) => (
                          <DropdownMenuItem
                            key={st.val}
                            onClick={() => handleQuickStatusChange(p, st.val as any)}
                            className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${st.color}`} />
                              <span>{st.label}</span>
                            </div>
                            {p.status === st.val && <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[3]" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(p.id)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200/60 dark:border-red-900/40 text-red-600 dark:text-red-400 font-bold text-xs cursor-pointer transition-all active:scale-95 hover:bg-red-100"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>{t.archive}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        }}
        columns={[
          {
            key: "image",
            label: t.colImage,
            width: "w-14",
            renderCell: (p) => (
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 dark:bg-dark-bg flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-dark-border">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                )}
              </div>
            ),
          },
          {
            key: "name",
            label: t.colName,
            renderCell: (p) => (
              <span className="truncate block font-bold text-sm text-slate-900 dark:text-slate-100">{p.name}</span>
            ),
          },
          {
            key: "sku",
            label: t.colSku,
            renderCell: (p) => (
              <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{p.sku || "-"}</span>
            ),
          },
          {
            key: "category",
            label: t.colCategory,
            renderCell: (p) => (
              <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-[#2A2A2E] text-slate-700 dark:text-slate-300 font-semibold text-xs">
                {p.category || "General"}
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
            key: "buyPrice",
            label: t.colBuyPrice,
            align: "right",
            renderCell: (p) => (
              <span className="font-mono text-slate-600 dark:text-slate-300 text-xs">
                Rp {p.purchase_price.toLocaleString("id-ID")}
              </span>
            ),
          },
          {
            key: "sellPrice",
            label: t.colSellPrice,
            align: "right",
            renderCell: (p) => (
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                Rp {p.sell_price.toLocaleString("id-ID")}
              </span>
            ),
          },
          {
            key: "stock",
            label: t.colStock,
            align: "right",
            renderCell: (p) => {
              const isLowStock = p.inventory_mode === "dry_strict" && p.current_stock <= (p.min_stock_alert || 0);
              return (
                <span className={`font-mono font-bold text-xs ${isLowStock ? "text-red-500 font-extrabold" : "text-slate-900 dark:text-slate-100"}`}>
                  {p.current_stock} {p.unit_type}
                </span>
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
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTriggerEdit(p);
                  }}
                  className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors"
                  title="Edit Produk"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 cursor-pointer transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#3A3A3E] shadow-xl rounded-xl p-1 min-w-[150px]">
                    <DropdownMenuItem
                      onClick={() => handleTriggerEdit(p)}
                      className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Edit Produk</span>
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

      {/* ── ROW CONTEXT MENU ON RIGHT CLICK ── */}
      {contextMenu && (
        <div
          style={{
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
          }}
          className="fixed z-50 min-w-[190px] bg-white dark:bg-[#202024] border border-slate-200 dark:border-dark-border rounded-2xl shadow-2xl p-1.5 animate-in fade-in-0 zoom-in-95 text-slate-800 dark:text-slate-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-[#333338] mb-1 truncate max-w-[200px]">
            {contextMenu.product.name}
          </div>
          <button
            type="button"
            onClick={() => {
              setExpandedProductId(contextMenu.product.id);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-slate-700 dark:text-primary" />
            {t.viewDetails}
          </button>
          {isManagerOrOwner && onEditProduct && (
            <button
              type="button"
              onClick={() => {
                onEditProduct(contextMenu.product);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              {t.editProduct}
            </button>
          )}
          {contextMenu.product.sku && (
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(contextMenu.product.sku || "");
                toast.success(t.skuCopied);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              {t.copySku}
            </button>
          )}

          {/* Quick Status Submenu */}
          {isManagerOrOwner && (
            <>
              <div className="border-t border-slate-100 dark:border-[#333338] my-1" />
              <div className="px-3 py-1 text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
                {t.changeStatus}
              </div>
              <button
                type="button"
                onClick={() => {
                  handleQuickStatusChange(contextMenu.product, "active");
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${contextMenu.product.status === "active" ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`} />
                  <span>{t.setStatusActive}</span>
                </div>
                {contextMenu.product.status === "active" && <Check className="w-3 h-3 text-emerald-500 stroke-[3]" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  handleQuickStatusChange(contextMenu.product, "inactive");
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${contextMenu.product.status === "inactive" ? "bg-slate-400" : "bg-slate-300 dark:bg-slate-600"}`} />
                  <span>{t.setStatusInactive}</span>
                </div>
                {contextMenu.product.status === "inactive" && <Check className="w-3 h-3 text-slate-400 stroke-[3]" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  handleQuickStatusChange(contextMenu.product, "discontinued");
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${contextMenu.product.status === "discontinued" ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-600"}`} />
                  <span>{t.setStatusDiscontinued}</span>
                </div>
                {contextMenu.product.status === "discontinued" && <Check className="w-3 h-3 text-amber-500 stroke-[3]" />}
              </button>
            </>
          )}

          {isManagerOrOwner && contextMenu.product.status === "active" && (
            <>
              <div className="border-t border-slate-100 dark:border-[#333338] my-1" />
              <button
                type="button"
                onClick={() => {
                  handleDeleteProduct(contextMenu.product.id);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Archive className="w-3.5 h-3.5 text-red-500" />
                {t.archiveProduct}
              </button>
            </>
          )}
        </div>
      )}
      </>)}

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
                  ? products.length 
                  : products.filter(p => (p.category || "General").toLowerCase() === cat.toLowerCase()).length;
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

    </div>
  );
}
