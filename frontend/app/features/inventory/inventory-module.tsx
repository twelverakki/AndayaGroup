import { useState, useEffect, useRef } from "react";
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
  ArrowLeft, Barcode, CheckCircle2, AlertCircle, 
  Info, Sparkles, Tag, DollarSign, Package, Plus, Edit3,
  Upload, X, MoreHorizontal, Search, SlidersHorizontal, 
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
  const activeFiltersCount = 
    (isCustomStatus ? 1 : 0) + 
    (filterMode !== "all" ? 1 : 0) + 
    (filterStock !== "all" ? 1 : 0);

  const handleResetFilters = () => {
    setStatusFilter({ active: true, inactive: true, discontinued: false });
    setFilterMode("all");
    setFilterStock("all");
    setCurrentPage(1);
  };

  // Column Visibility State (Shadcn Data Table pattern)
  const [visibleColumns, setVisibleColumns] = useState({
    image: true,
    name: true,
    sku: true,
    category: true,
    mode: true,
    buyPrice: true,
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

  // Detail Dialog State
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Category Dialog & Scroll States
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  const handleScrollCategory = (direction: "left" | "right") => {
    if (categoryScrollRef.current) {
      const scrollAmount = 240;
      categoryScrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

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
    if (view === "new" || view === "edit") {
      fetchCategories();
    }
  }, [view, activeContext]);

  useEffect(() => {
    if (view === "edit" && product && existingCategories.length > 0) {
      const catName = product.category || "General";
      const hasCat = existingCategories.some(c => c.name.toLowerCase() === catName.toLowerCase());
      if (catName !== "General" && !hasCat) {
        setIsCustomCat(true);
      } else {
        setIsCustomCat(false);
      }
    }
  }, [view, product, existingCategories]);

  const fetchData = async () => {
    if (view === "new" || view === "edit") {
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
    setCurrentPage(1);
  }, [activeContext, view]);

  // Pre-fill form when entering edit mode or new mode
  useEffect(() => {
    if (previewImageUrl) {
      URL.revokeObjectURL(previewImageUrl);
    }
    setPendingImageFile(null);
    setPreviewImageUrl("");

    if (view === "edit" && product) {
      setProdName(product.name);
      setProdSku(product.sku || "");
      setProdCat(product.category || "General");
      setProdUnit(product.unit_type);
      
      const standardUnitVals = unitTypes.map((u) => u.val.toLowerCase());
      if (product.unit_type && !standardUnitVals.includes(product.unit_type.toLowerCase())) {
        setIsCustomUnit(true);
      } else {
        setIsCustomUnit(false);
      }

      setProdMode(product.inventory_mode);
      setProdBuy(formatNumberInput(product.purchase_price));
      setProdSell(formatNumberInput(product.sell_price));
      setProdStock(product.current_stock.toString());
      setProdMinAlert(product.min_stock_alert?.toString() || "");
      setProdStatus(product.status || "active");
      setProdImage(product.image_url || "");
    } else if (view === "new") {
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
  }, [view, product]);

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
      if (view === "new") {
        await api.post("/products", payload);
        toast.success(t.successAddProduct);
        if (onSuccess) {
          setTimeout(() => onSuccess(), 500);
        }
      } else if (view === "edit" && product) {
        await api.put(`/products/${product.id}`, payload);
        toast.success(t.successEditProduct);
        if (onSuccess) {
          setTimeout(() => onSuccess(), 500);
        }
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
  if (view === "new" || view === "edit") {
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
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className={`p-2.5 rounded-full border transition-all cursor-pointer ${
                isDarkMode ? "bg-dark-card border-dark-border text-white hover:bg-white/5" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
              title={t.cancel}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest opacity-60 flex items-center gap-1.5 text-slate-500">
              <Package className="w-3 h-3 text-slate-700 dark:text-primary" /> {t.inventoryBreadcrumb} / {view === "new" ? t.addNewProduct : t.edit}
            </span>
            <h3 className="text-xl font-bold tracking-tight mt-0.5 text-slate-900 dark:text-slate-100">
              {view === "new" ? t.addNewProduct : t.editProductTitle}
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

  // Extract unique categories for category pills
  const categoriesList = [
    "all",
    ...Array.from(new Set(products.map((p) => p.category || "General"))).filter(Boolean),
  ];

  // Pagination computed values
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Build page number list (show max 5 around current)
  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="space-y-6 text-left text-slate-900 dark:text-slate-100">
      
      {/* ── PAGE HEADER ── */}
      <div className="border-b border-slate-200/80 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 capitalize">
            {view === "master" ? t.masterInventoryTitle : t.discontinuedTitle}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
            {view === "master" ? t.masterInventoryDesc : t.discontinuedDesc}
          </p>
        </div>

        {/* Action Button: Add New Product */}
        {view === "master" && (
          <button
            type="button"
            onClick={() => {
              if (onAddNew) onAddNew();
              else if (onNavigate) onNavigate("inventory-add");
            }}
            className="px-4 py-2.5 rounded-full font-bold text-xs bg-primary dark:bg-primary text-slate-900 shadow-sm hover:brightness-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{t.menuAddNewProduct}</span>
          </button>
        )}
      </div>

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
                setCurrentPage(1);
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

          {/* Controls: Rich Horizontal Multi-Filter Menu */}
          <div className="flex items-center gap-2.5 shrink-0">
            
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
              <DropdownMenuContent className="bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#3A3A3E] shadow-2xl rounded-2xl p-5 w-[660px] max-w-[95vw] space-y-4">
                
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

                {/* Horizontal 3-Column Layout for Desktop */}
                <div className="grid grid-cols-3 gap-5 divide-x divide-slate-100 dark:divide-[#333338]">
                  
                  {/* Column 1: Filter Status (Shadcn Checkbox multi-select) */}
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
                                setCurrentPage(1);
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

                  {/* Column 2: Filter Inventory Mode (Shadcn Radio style with check icon, no box) */}
                  <div className="space-y-2 pl-4 pr-2">
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      {t.filterModeLabel}
                    </label>
                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                      <button
                        type="button"
                        onClick={() => {
                          setFilterMode("all");
                          setCurrentPage(1);
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
                              setCurrentPage(1);
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

                  {/* Column 3: Filter Stock Availability (Shadcn Radio style with check icon, no box) */}
                  <div className="space-y-2 pl-4">
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
                              setCurrentPage(1);
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
                    setCurrentPage(1);
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
          {/* ── TABLE CARD ── */}
          <div
            className="bg-white dark:bg-dark-card border border-slate-200/80 dark:border-dark-border rounded-[28px] shadow-sm p-4 sm:p-6"
            style={{ boxShadow: isDarkMode ? "0 4px 24px 0 rgba(0,0,0,0.35)" : "0 4px 20px 0 rgba(0,0,0,0.06)" }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate" style={{ borderSpacing: 0 }}>
                {/* ── HEADER (PILL SHAPED WITH DEPTH GRAY BACKGROUND, COLUMN SETTINGS ICON & RIGHT-CLICK TO MANAGE) ── */}
                <thead
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setHeaderContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                    });
                  }}
                  title="Klik kanan di header untuk mengatur kolom"
                >
                  <tr className="text-slate-600 dark:text-slate-300 select-none">
                    {visibleColumns.image && (
                      <th className="py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap bg-[#E7E9ED] dark:bg-[#2E2E34] rounded-l-full">
                        {t.colImage}
                      </th>
                    )}
                    {visibleColumns.name && (
                      <th className={`py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap bg-[#E7E9ED] dark:bg-[#2E2E34] ${
                        !visibleColumns.image ? "rounded-l-full" : ""
                      }`}>
                        {t.colName}
                      </th>
                    )}
                    {visibleColumns.sku && (
                      <th className="py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap bg-[#E7E9ED] dark:bg-[#2E2E34]">
                        {t.colSku}
                      </th>
                    )}
                    {visibleColumns.category && (
                      <th className="py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap bg-[#E7E9ED] dark:bg-[#2E2E34]">
                        {t.colCategory}
                      </th>
                    )}
                    {visibleColumns.mode && (
                      <th className="py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap bg-[#E7E9ED] dark:bg-[#2E2E34]">
                        {t.colMode}
                      </th>
                    )}
                    {visibleColumns.buyPrice && (
                      <th className="py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider text-right whitespace-nowrap bg-[#E7E9ED] dark:bg-[#2E2E34]">
                        {t.colBuyPrice}
                      </th>
                    )}
                    {visibleColumns.sellPrice && (
                      <th className="py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider text-right whitespace-nowrap bg-[#E7E9ED] dark:bg-[#2E2E34]">
                        {t.colSellPrice}
                      </th>
                    )}
                    {visibleColumns.stock && (
                      <th className="py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider text-center whitespace-nowrap bg-[#E7E9ED] dark:bg-[#2E2E34]">
                        {t.colStock}
                      </th>
                    )}
                    {visibleColumns.status && (
                      <th className="py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider text-center whitespace-nowrap bg-[#E7E9ED] dark:bg-[#2E2E34]">
                        {t.colStatus}
                      </th>
                    )}
                    
                    {/* Action Column + Column Settings Icon Trigger Button in Table Header */}
                    <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-right whitespace-nowrap bg-[#E7E9ED] dark:bg-[#2E2E34] rounded-r-full">
                      <div className="flex items-center justify-end gap-2">
                        {visibleColumns.action && isManagerOrOwner && (
                          <span className="hidden sm:inline">{t.colAction}</span>
                        )}
                        {/* Icon-only Column Config Trigger in Table Header */}
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/70 dark:bg-black/20 hover:bg-white dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-300/60 dark:border-white/10 shadow-xs transition-all cursor-pointer focus:outline-none"
                            title={t.configureColumns}
                            aria-label={t.configureColumns}
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#3A3A3E] shadow-2xl rounded-2xl p-2 min-w-[200px] space-y-1">
                            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between border-b border-slate-100 dark:border-[#333338] mb-1">
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
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </th>
                  </tr>
                </thead>

                {/* ── BODY WITH CRISP BOTTOM BORDERS ON EVERY TD ── */}
                <tbody>
                  {paginatedProducts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="text-center py-14 text-slate-400 dark:text-slate-500 text-sm font-semibold"
                      >
                        {t.noData}
                      </td>
                    </tr>
                  ) : (
                    paginatedProducts.map((p) => (
                      <tr
                        key={p.id}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            product: p,
                          });
                        }}
                        onClick={() => {
                          setDetailProduct(p);
                          setIsDetailOpen(true);
                        }}
                        className="group transition-colors duration-150 cursor-pointer"
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.background = isDarkMode
                            ? "rgba(255,255,255,0.03)"
                            : "#f9fafb";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                        }}
                      >
                        {/* Gambar Produk */}
                        {visibleColumns.image && (
                          <td className="px-5 py-3.5 border-b border-slate-200/80 dark:border-dark-border">
                            <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 dark:bg-[#1C1C1F] flex items-center justify-center border border-slate-200/60 dark:border-dark-border shrink-0">
                              {p.image_url ? (
                                <img
                                  src={getFullImageUrl(p.image_url)}
                                  alt={p.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                              )}
                            </div>
                          </td>
                        )}

                        {/* Nama Produk */}
                        {visibleColumns.name && (
                          <td className="px-5 py-3.5 border-b border-slate-200/80 dark:border-dark-border text-sm font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                            {p.name}
                          </td>
                        )}

                        {/* SKU */}
                        {visibleColumns.sku && (
                          <td className="px-5 py-3.5 border-b border-slate-200/80 dark:border-dark-border font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {p.sku || "—"}
                          </td>
                        )}

                        {/* Kategori */}
                        {visibleColumns.category && (
                          <td className="px-5 py-3.5 border-b border-slate-200/80 dark:border-dark-border">
                            <span
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
                              style={{
                                background: isDarkMode ? "rgba(255,255,255,0.06)" : "#f1f2f5",
                                color: isDarkMode ? "#94a3b8" : "#64748b",
                              }}
                            >
                              {p.category || "General"}
                            </span>
                          </td>
                        )}

                        {/* Inventory Mode */}
                        {visibleColumns.mode && (
                          <td className="px-5 py-3.5 border-b border-slate-200/80 dark:border-dark-border text-xs text-slate-600 dark:text-slate-400 capitalize whitespace-nowrap">
                            {p.inventory_mode.replace(/_/g, " ")}
                          </td>
                        )}

                        {/* Harga Modal */}
                        {visibleColumns.buyPrice && (
                          <td className="px-5 py-3.5 border-b border-slate-200/80 dark:border-dark-border text-right font-mono text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            Rp {p.purchase_price.toLocaleString("id-ID")}
                          </td>
                        )}

                        {/* Harga Jual */}
                        {visibleColumns.sellPrice && (
                          <td className="px-5 py-3.5 border-b border-slate-200/80 dark:border-dark-border text-right font-mono text-sm font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                            Rp {p.sell_price.toLocaleString("id-ID")}
                          </td>
                        )}

                        {/* Stok */}
                        {visibleColumns.stock && (
                          <td className="px-5 py-3.5 border-b border-slate-200/80 dark:border-dark-border text-center whitespace-nowrap">
                            <span
                              className={`font-bold text-sm font-mono ${
                                p.current_stock <= 0
                                  ? "text-red-500"
                                  : p.min_stock_alert && p.current_stock <= p.min_stock_alert
                                  ? "text-amber-500"
                                  : "text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {p.current_stock}
                            </span>
                            <span className="ml-1 text-[10px] text-slate-400 dark:text-slate-500 capitalize">
                              {p.unit_type}
                            </span>
                          </td>
                        )}

                        {/* Status */}
                        {visibleColumns.status && (
                          <td className="px-5 py-3.5 border-b border-slate-200/80 dark:border-dark-border text-center whitespace-nowrap">
                            <span
                              className={`text-sm font-semibold ${
                                p.status === "active"
                                  ? "text-emerald-500"
                                  : p.status === "discontinued"
                                  ? "text-amber-500"
                                  : "text-slate-400 dark:text-slate-500"
                              }`}
                            >
                              {p.status === "active"
                                ? t.statusActive
                                : p.status === "discontinued"
                                ? t.statusDiscontinued
                                : t.statusInactive}
                            </span>
                          </td>
                        )}

                        {/* Aksi — three-dot menu */}
                        <td 
                          className="px-6 py-3.5 border-b border-slate-200/80 dark:border-dark-border text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className="inline-flex items-center justify-center w-7 h-7 rounded-full transition-colors hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer focus:outline-none"
                              title={t.options}
                            >
                              <MoreHorizontal className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#3A3A3E] shadow-xl rounded-xl p-1 min-w-[170px]">
                              <DropdownMenuItem
                                onClick={() => {
                                  setDetailProduct(p);
                                  setIsDetailOpen(true);
                                }}
                                className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-700 dark:text-primary" />
                                {t.viewDetails}
                              </DropdownMenuItem>
                              {onEditProduct && (
                                <DropdownMenuItem
                                  onClick={() => onEditProduct(p)}
                                  className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                                  {t.editProduct}
                                </DropdownMenuItem>
                              )}
                              {p.sku && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    navigator.clipboard.writeText(p.sku || "");
                                    toast.success(t.skuCopied);
                                  }}
                                  className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                                >
                                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                                  {t.copySku}
                                </DropdownMenuItem>
                              )}

                              {/* Quick Status Submenu */}
                              {isManagerOrOwner && (
                                <>
                                  <div className="border-t border-slate-100 dark:border-[#333338] my-1" />
                                  <div className="px-3 py-1 text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
                                    {t.changeStatus}
                                  </div>
                                  <DropdownMenuItem
                                    onClick={() => handleQuickStatusChange(p, "active")}
                                    className="cursor-pointer px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg flex items-center justify-between"
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className={`w-2 h-2 rounded-full ${p.status === "active" ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`} />
                                      <span>{t.setStatusActive}</span>
                                    </div>
                                    {p.status === "active" && <Check className="w-3 h-3 text-emerald-500 stroke-[3]" />}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleQuickStatusChange(p, "inactive")}
                                    className="cursor-pointer px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg flex items-center justify-between"
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className={`w-2 h-2 rounded-full ${p.status === "inactive" ? "bg-slate-400" : "bg-slate-300 dark:bg-slate-600"}`} />
                                      <span>{t.setStatusInactive}</span>
                                    </div>
                                    {p.status === "inactive" && <Check className="w-3 h-3 text-slate-400 stroke-[3]" />}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleQuickStatusChange(p, "discontinued")}
                                    className="cursor-pointer px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg flex items-center justify-between"
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className={`w-2 h-2 rounded-full ${p.status === "discontinued" ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-600"}`} />
                                      <span>{t.setStatusDiscontinued}</span>
                                    </div>
                                    {p.status === "discontinued" && <Check className="w-3 h-3 text-amber-500 stroke-[3]" />}
                                  </DropdownMenuItem>
                                </>
                              )}

                              {p.status === "active" && (
                                <>
                                  <div className="border-t border-slate-100 dark:border-[#333338] my-1" />
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteProduct(p.id)}
                                    className="cursor-pointer px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex items-center gap-2"
                                  >
                                    <Archive className="w-3.5 h-3.5 text-red-500" />
                                    {t.archive}
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── PAGINATION (MATCHING REFERENCE) ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-start gap-1.5 pt-1">
              {/* Prev Arrow */}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-9 h-9 rounded-full flex items-center justify-center border text-sm font-semibold transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: isDarkMode ? "#232326" : "white",
                  borderColor: isDarkMode ? "#38383C" : "#e2e4ea",
                  color: isDarkMode ? "#94a3b8" : "#64748b",
                }}
                aria-label={t.prevPage}
              >
                ‹
              </button>

              {/* Page Numbers */}
              {getPageNumbers().map((page, idx) =>
                page === "..." ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="w-9 h-9 flex items-center justify-center text-sm text-slate-400"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page as number)}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-150 cursor-pointer"
                    style={
                      currentPage === page
                        ? {
                            background: isDarkMode ? "#E2FF66" : "#c5ff00",
                            color: "#1a1a1a",
                            border: "none",
                            fontWeight: 700,
                          }
                        : {
                            background: isDarkMode ? "#232326" : "white",
                            border: isDarkMode ? "1px solid #38383C" : "1px solid #e2e4ea",
                            color: isDarkMode ? "#94a3b8" : "#64748b",
                          }
                    }
                    aria-label={`Halaman ${page}`}
                    aria-current={currentPage === page ? "page" : undefined}
                  >
                    {page}
                  </button>
                )
              )}

              {/* Next Arrow */}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-9 h-9 rounded-full flex items-center justify-center border text-sm font-semibold transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: isDarkMode ? "#232326" : "white",
                  borderColor: isDarkMode ? "#38383C" : "#e2e4ea",
                  color: isDarkMode ? "#94a3b8" : "#64748b",
                }}
                aria-label={t.nextPage}
              >
                ›
              </button>

              {/* Page info */}
              <span className="ml-2 text-xs text-slate-400 dark:text-slate-500 font-medium">
                {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)} {t.pageOf} {filteredProducts.length} {t.products}
              </span>
            </div>
          )}
        </>
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
              setDetailProduct(contextMenu.product);
              setIsDetailOpen(true);
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
                      setCurrentPage(1);
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

      {/* ── PRODUCT DETAIL DIALOG ── */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-xl p-6 bg-white dark:bg-[#202024] border-slate-200 dark:border-dark-border">
          {detailProduct && (
            <div className="space-y-5">
              <DialogHeader>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-[#1C1C1F] flex items-center justify-center overflow-hidden border border-slate-200/80 dark:border-dark-border shrink-0">
                    {detailProduct.image_url ? (
                      <img
                        src={getFullImageUrl(detailProduct.image_url)}
                        alt={detailProduct.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-7 h-7 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {detailProduct.name}
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-slate-500 dark:text-slate-400">
                      {t.skuLabel}: <span className="font-mono text-slate-700 dark:text-slate-300 font-bold">{detailProduct.sku || "—"}</span> • {t.categoryLabel}: <span className="font-semibold text-slate-700 dark:text-slate-300">{detailProduct.category || "General"}</span>
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {/* Detailed Financial & Inventory Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 p-4 bg-slate-50 dark:bg-[#1B1B1E] rounded-2xl border border-slate-200/60 dark:border-[#303035] text-xs">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t.costPriceHpp}</span>
                  <span className="font-mono font-bold text-sm text-slate-800 dark:text-slate-200">
                    Rp {detailProduct.purchase_price.toLocaleString("id-ID")}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t.sellingPrice}</span>
                  <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                    Rp {detailProduct.sell_price.toLocaleString("id-ID")}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t.estimatedMargin}</span>
                  <span className="font-mono font-bold text-sm text-slate-700 dark:text-slate-300">
                    Rp {(detailProduct.sell_price - detailProduct.purchase_price).toLocaleString("id-ID")}{" "}
                    {detailProduct.purchase_price > 0 && (
                      <span className="text-[10px] text-emerald-500 font-semibold block">
                        (+{Math.round(((detailProduct.sell_price - detailProduct.purchase_price) / detailProduct.purchase_price) * 100)}%)
                      </span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t.currentStock}</span>
                  <span className="font-mono font-bold text-sm text-slate-800 dark:text-slate-200">
                    {detailProduct.current_stock} <span className="text-[10px] font-normal uppercase text-slate-400">{detailProduct.unit_type}</span>
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t.minStockAlert}</span>
                  <span className="font-mono font-bold text-sm text-slate-800 dark:text-slate-200">
                    {detailProduct.min_stock_alert !== undefined ? `${detailProduct.min_stock_alert} ${detailProduct.unit_type}` : t.notSet}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t.operationalStatus}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 mt-0.5 rounded-full text-[10px] font-bold uppercase ${
                    detailProduct.status === "active"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : detailProduct.status === "discontinued"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}>
                    {detailProduct.status === "active" ? t.statusActive : detailProduct.status === "discontinued" ? t.statusDiscontinued : t.statusInactive}
                  </span>
                </div>
              </div>

              {/* Mode Rule Explanation (Depth Gray palette) */}
              <div className="p-3.5 bg-slate-100/90 dark:bg-[#1B1B1E] rounded-2xl border border-slate-200/80 dark:border-[#303035] text-xs flex items-start gap-3">
                <Info className="w-4 h-4 text-slate-600 dark:text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 capitalize">
                    {t.inventoryModeLabel}: {detailProduct.inventory_mode.replace(/_/g, " ")}
                  </span>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                    {inventoryModes.find(m => m.val === detailProduct.inventory_mode)?.desc || t.modeExplanation}
                  </p>
                </div>
              </div>

              <DialogFooter className="flex flex-row justify-between items-center w-full pt-2">
                {isManagerOrOwner && onEditProduct ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDetailOpen(false);
                      onEditProduct(detailProduct);
                    }}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-primary dark:hover:bg-primary/85 text-white dark:text-slate-900 text-xs font-bold rounded-full transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    {t.editThisProduct}
                  </button>
                ) : <div />}
                <DialogClose className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#2B2B30] dark:hover:bg-[#34343A] text-slate-700 dark:text-slate-200 text-xs font-bold rounded-full transition-all cursor-pointer">
                  {t.close}
                </DialogClose>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
