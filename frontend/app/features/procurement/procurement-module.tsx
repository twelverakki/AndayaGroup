import { useState, useEffect, useRef } from "react";
import { ErpDataTable } from "../../components/ErpDataTable";
import { ErpSearchBar } from "../../components/ErpSearchBar";
import { DatePicker } from "../../components/ui/date-picker";
import { api } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import {
  useLanguageStore,
  translations,
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
  FileSpreadsheet, Plus, Search, Filter, Eye, Copy, Check,
  ChevronLeft, ChevronRight, SlidersHorizontal, ArrowLeft,
  DollarSign, Package, Calendar, Clock, AlertCircle, CheckCircle2,
  Trash2, X, MoreHorizontal, Layers, Sparkles, Building2, CreditCard,
  Menu, ArrowUpDown, ChevronDown, RotateCcw
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku?: string;
  unit_type: string;
  inventory_mode: string;
  purchase_price?: number;
}

interface Procurement {
  id: string;
  supplier_name: string;
  total_cost: number;
  payment_status: "paid" | "unpaid" | "partial";
  amount_owed: number;
  procurement_date: string;
  due_date?: string;
  created_at: string;
}

interface ProcurementItemDetail {
  id: string;
  product_id?: string;
  product_name: string;
  product_unit: string;
  product_sku?: string;
  qty: number;
  unit_cost: number;
  subtotal: number;
  weight_actual?: number;
}

interface ProcurementDetail extends Procurement {
  items: ProcurementItemDetail[];
}

interface ProcurementItemInput {
  product_id: string;
  product_name: string;
  product_unit: string;
  qty: number;
  unit_cost: number;
  weight_actual?: number;
}

interface ProcurementModuleProps {
  view?: "history" | "new";
  onSuccess?: () => void;
  onCancel?: () => void;
  onNavigate?: (subView: string) => void;
}

const ITEMS_PER_PAGE = 8;

export default function ProcurementModule({
  view = "history",
  onSuccess,
  onCancel,
  onNavigate,
}: ProcurementModuleProps) {
  const { activeContext } = useAuthStore();
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;

  // Data States
  const [procurements, setProcurements] = useState<Procurement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Form States (New Procurement)
  const [supplierName, setSupplierName] = useState("");
  const [procurementDate, setProcurementDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "unpaid" | "partial">("paid");
  const [amountOwed, setAmountOwed] = useState("");
  
  // Selected Items in Form
  const [items, setItems] = useState<ProcurementItemInput[]>([]);

  // Item Selector Row in Form
  const [selectedProductId, setSelectedProductId] = useState("");
  const [itemQty, setItemQty] = useState("");
  const [itemCost, setItemCost] = useState("");
  const [itemWeight, setItemWeight] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // Internal Navigation View & Accordion Expansion States
  const [internalView, setInternalView] = useState<"history" | "new">(view || "history");
  const [expandedProcurementId, setExpandedProcurementId] = useState<string | null>(null);

  useEffect(() => {
    setInternalView(view || "history");
  }, [view]);

  const activeView = internalView;
  const isManagerOrOwner = activeContext?.role === "manager" || activeContext?.role === "owner";

  // Scroll & Floating Header States
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 80) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
        setIsSearchExpanded(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Sorting State (Date, Cost, Supplier)
  type SortOption = "date_desc" | "date_asc" | "cost_desc" | "cost_asc" | "supplier_asc";
  const [sortBy, setSortBy] = useState<SortOption>("date_desc");

  const handleTriggerAdd = () => {
    if (onNavigate) onNavigate("procurement-new");
    else setInternalView("new");
  };

  useEffect(() => {
    const handleMobileAdd = () => {
      handleTriggerAdd();
    };
    window.addEventListener("trigger_mobile_add", handleMobileAdd);
    return () => window.removeEventListener("trigger_mobile_add", handleMobileAdd);
  }, [onNavigate]);

  const handleFormBack = () => {
    if (onCancel) onCancel();
    setInternalView("history");
    fetchData();
  };

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPayment, setFilterPayment] = useState<string>("all");
  const [filterSupplier, setFilterSupplier] = useState<string>("all");

  // Detail Modal State
  const [detailProcurement, setDetailProcurement] = useState<ProcurementDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    procurement: Procurement;
  } | null>(null);

  // Column Visibility State
  const [columnVisibility, setColumnVisibility] = useState({
    supplier: true,
    date: true,
    totalCost: true,
    paymentStatus: true,
    amountOwed: true,
    dueDate: true,
    actions: true,
  });

  const [headerContextMenu, setHeaderContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Shortcut search input ref
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Theme observer for styling
  const [isDarkMode, setIsDarkMode] = useState(false);

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

  // Keyboard shortcut "/" to focus search bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Global click listener to close context menus
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

  // Fetch all procurement records and product catalog
  const fetchData = async () => {
    setLoading(true);
    try {
      const [procRes, prodRes] = await Promise.all([
        api.get("/procurements"),
        api.get("/products"),
      ]);
      const procList = Array.isArray(procRes.data) ? procRes.data : (procRes.data?.data || []);
      const prodList = Array.isArray(prodRes.data) ? prodRes.data : (prodRes.data?.data || []);
      setProcurements(Array.isArray(procList) ? procList : []);
      setProducts(Array.isArray(prodList) ? prodList : []);
    } catch (err: any) {
      toast.error(t.errorFetchProcurements);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeContext, activeView]);

  // When product is selected in item builder, pre-fill its purchase price
  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    const prod = products.find((p) => p.id === productId);
    if (prod && prod.purchase_price) {
      setItemCost(formatNumberInput(prod.purchase_price));
    }
  };

  // Add Item to Temp List
  const handleAddItem = () => {
    if (!selectedProductId || !itemQty || !itemCost) {
      toast.error(language === "id" ? "Mohon lengkapi produk, jumlah, dan harga beli" : "Please complete product, quantity, and cost");
      return;
    }

    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) return;

    const newItem: ProcurementItemInput = {
      product_id: selectedProductId,
      product_name: prod.name,
      product_unit: prod.unit_type || "pcs",
      qty: parseFloat(itemQty) || 0,
      unit_cost: parseNumberInput(itemCost),
      weight_actual: itemWeight ? parseFloat(itemWeight) : undefined,
    };

    setItems([...items, newItem]);
    
    // Clear item inputs
    setSelectedProductId("");
    setItemQty("");
    setItemCost("");
    setItemWeight("");
  };

  const handleRemoveItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  // Calculate Total Cost of items
  const totalCostCalculated = items.reduce(
    (acc, item) => acc + item.qty * item.unit_cost,
    0
  );

  // Submit Procurement Order
  const handleSubmitProcurement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error(t.minOneItemRequired);
      return;
    }

    setFormLoading(true);

    const numericAmountOwed = paymentStatus === "paid" 
      ? 0 
      : amountOwed 
      ? parseNumberInput(amountOwed) 
      : totalCostCalculated;

    const payload = {
      supplier_name: supplierName,
      total_cost: totalCostCalculated,
      payment_status: paymentStatus,
      amount_owed: numericAmountOwed,
      procurement_date: procurementDate ? new Date(procurementDate) : new Date(),
      due_date: dueDate ? new Date(dueDate) : undefined,
      items: items.map((it) => ({
        product_id: it.product_id,
        qty: it.qty,
        unit_cost: it.unit_cost,
        weight_actual: it.weight_actual,
      })),
    };

    try {
      await api.post("/procurements", payload);
      toast.success(t.successAddProcurement);
      
      // Reset form
      setSupplierName("");
      setItems([]);
      setAmountOwed("");
      setDueDate("");
      setPaymentStatus("paid");
      
      if (onSuccess) onSuccess();
      handleFormBack();
    } catch (err: any) {
      toast.error(err.response?.data?.message || t.errorAddProcurement);
    } finally {
      setFormLoading(false);
    }
  };

  // Fetch full detail for a procurement
  const handleOpenDetail = async (proc: Procurement) => {
    setIsDetailOpen(true);
    setLoadingDetail(true);
    try {
      const res = await api.get(`/procurements/${proc.id}`);
      setDetailProcurement(res.data);
    } catch (err) {
      // Fallback with basic header
      setDetailProcurement({
        ...proc,
        items: [],
      });
    } finally {
      setLoadingDetail(false);
    }
  };

  // Quick update payment status
  const handleUpdatePaymentStatus = async (
    procId: string,
    newStatus: "paid" | "unpaid" | "partial",
    newAmountOwed = 0
  ) => {
    try {
      await api.put(`/procurements/${procId}/payment`, {
        payment_status: newStatus,
        amount_owed: newStatus === "paid" ? 0 : newAmountOwed,
      });
      setProcurements((prev) =>
        prev.map((p) =>
          p.id === procId
            ? { ...p, payment_status: newStatus, amount_owed: newStatus === "paid" ? 0 : newAmountOwed }
            : p
        )
      );
      toast.success(t.paymentUpdatedSuccess);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal memperbarui status pembayaran");
    }
  };

  // Metrics Summary
  const totalDebt = procurements
    .filter((p) => p.payment_status !== "paid")
    .reduce((acc, p) => acc + (p.amount_owed || 0), 0);

  const totalSpend = procurements.reduce((acc, p) => acc + (p.total_cost || 0), 0);
  const paidCount = procurements.filter((p) => p.payment_status === "paid").length;
  const unpaidCount = procurements.filter((p) => p.payment_status !== "paid").length;

  // Filtered procurements
  const filteredProcurements = procurements.filter((p) => {
    const matchesSearch =
      !searchQuery.trim() ||
      p.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPayment =
      filterPayment === "all" || p.payment_status === filterPayment;

    const matchesSupplier =
      filterSupplier === "all" || p.supplier_name.toLowerCase() === filterSupplier.toLowerCase();

    return matchesSearch && matchesPayment && matchesSupplier;
  });

  // Sorted procurements
  const sortedProcurements = [...filteredProcurements].sort((a, b) => {
    switch (sortBy) {
      case "date_desc":
        return new Date(b.procurement_date || b.created_at || 0).getTime() - new Date(a.procurement_date || a.created_at || 0).getTime();
      case "date_asc":
        return new Date(a.procurement_date || a.created_at || 0).getTime() - new Date(b.procurement_date || b.created_at || 0).getTime();
      case "cost_desc":
        return b.total_cost - a.total_cost;
      case "cost_asc":
        return a.total_cost - b.total_cost;
      case "supplier_asc":
        return a.supplier_name.localeCompare(b.supplier_name, "id", { sensitivity: "base" });
      default:
        return 0;
    }
  });

  const isSearchActive = isSearchExpanded || searchQuery.trim().length > 0;

  // Extract unique supplier list
  const uniqueSuppliers = Array.from(
    new Set(procurements.map((p) => p.supplier_name).filter(Boolean))
  );

  // Styles
  const labelClass = "block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 text-left";
  const inputClass = `w-full px-4 py-2.5 rounded-full border text-sm font-semibold focus:outline-none focus:ring-2 transition-all duration-200 ${
    isDarkMode
      ? "bg-dark-bg border-dark-border text-white focus:ring-primary/20 focus:border-primary"
      : "bg-slate-50/70 border-slate-200 text-slate-850 focus:ring-slate-400/20 focus:border-slate-500"
  }`;
  const bentoCardClass = `p-6 rounded-3xl border transition-all duration-200 ${
    isDarkMode
      ? "bg-dark-card border-dark-border text-slate-100 shadow-xl"
      : "bg-white border-slate-200/80 text-slate-900 shadow-sm"
  }`;
  const cardHeadingClass = "text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-[#303035] pb-3 mb-4";

  // =========================================================================
  // VIEW: NEW PROCUREMENT FORM
  // =========================================================================
  if (activeView === "new") {
    return (
      <div className="space-y-6 text-left w-full text-slate-900 dark:text-slate-100">
        
        {/* Top Header */}
        <div className="flex items-center gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-4">
          <button
            type="button"
            onClick={handleFormBack}
            className="p-2 rounded-full border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-all"
            title={t.cancel}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {t.procurementNewTitle}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              {t.procurementNewDesc}
            </p>
          </div>
        </div>

        {/* ── BENTO 2-COLUMN WIDESCREEN FORM ── */}
        <form onSubmit={handleSubmitProcurement} className="space-y-6 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full">
            
            {/* LEFT COLUMN (lg:col-span-8): Form Fields, Item Builder & Added Items Table */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Card 1: Informasi Faktur & Supplier */}
              <div className={bentoCardClass}>
                <h4 className={cardHeadingClass}>
                  <Building2 className="w-4 h-4 text-slate-700 dark:text-primary" />
                  <span>Informasi Supplier & Faktur</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Nama Supplier */}
                  <div className="sm:col-span-2">
                    <label className={labelClass}>{t.supplierLabel} *</label>
                    <input
                      type="text"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      placeholder={t.supplierPlaceholder}
                      className={inputClass}
                      required
                    />
                  </div>

                  {/* Tanggal Pengadaan */}
                  <div>
                    <label className={labelClass}>{t.procurementDateLabel} *</label>
                    <DatePicker
                      value={procurementDate}
                      onChange={(val) => setProcurementDate(val)}
                      className="w-full h-11 px-4 text-xs font-semibold rounded-2xl"
                    />
                  </div>

                  {/* Tanggal Jatuh Tempo */}
                  <div>
                    <label className={labelClass}>{t.dueDateLabel} {paymentStatus !== "paid" ? "*" : "(Opsional)"}</label>
                    <DatePicker
                      value={dueDate}
                      onChange={(val) => setDueDate(val)}
                      className="w-full h-11 px-4 text-xs font-semibold rounded-2xl"
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Tambah Barang ke Nota */}
              <div className={bentoCardClass}>
                <h4 className={cardHeadingClass}>
                  <Package className="w-4 h-4 text-slate-700 dark:text-primary" />
                  <span>{t.addItemButton}</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end p-4 bg-slate-50/70 dark:bg-[#1A1A1D] rounded-2xl border border-slate-100 dark:border-[#333338] mb-4">
                  
                  {/* Select Product */}
                  <div className="sm:col-span-5">
                    <label className={labelClass}>{t.selectProductLabel}</label>
                    <DropdownMenu>
                      <DropdownMenuTrigger className={`w-full flex items-center justify-between px-4 py-2.5 rounded-full border text-xs font-bold transition-all text-left outline-none cursor-pointer ${
                        isDarkMode
                          ? "bg-dark-card border-dark-border text-white"
                          : "bg-white border-slate-200 text-slate-850"
                      }`}>
                        <span className="truncate">
                          {products.find((p) => p.id === selectedProductId)
                            ? `${products.find((p) => p.id === selectedProductId)?.name} (${products.find((p) => p.id === selectedProductId)?.unit_type})`
                            : t.selectProductPrompt}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-2 shrink-0">▼</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-white dark:bg-[#202024] border border-slate-200 dark:border-dark-border shadow-xl rounded-2xl p-1.5 min-w-[260px] max-h-[280px] overflow-y-auto">
                        {products.map((p) => (
                          <DropdownMenuItem
                            key={p.id}
                            onClick={() => handleProductSelect(p.id)}
                            className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg flex items-center justify-between"
                          >
                            <span className="truncate">{p.name}</span>
                            <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-2">({p.unit_type})</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Qty */}
                  <div className="sm:col-span-2">
                    <label className={labelClass}>{t.qtyInvoiceLabel}</label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      value={itemQty}
                      onChange={(e) => setItemQty(e.target.value)}
                      placeholder="0"
                      className={inputClass}
                    />
                  </div>

                  {/* Harga Satuan Modal (HPP) with Thousands Separator */}
                  <div className="sm:col-span-3">
                    <label className={labelClass}>{t.unitCostLabel}</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={itemCost}
                        onChange={(e) => setItemCost(formatNumberInput(e.target.value))}
                        placeholder="0"
                        className="w-full pl-9 pr-3 py-2.5 rounded-full border text-sm font-semibold focus:outline-none focus:ring-2 transition-all bg-slate-50/70 dark:bg-dark-bg border-slate-200 dark:border-dark-border text-slate-850 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Add Button */}
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      disabled={!selectedProductId || !itemQty || !itemCost}
                      className="w-full py-2.5 px-4 font-bold text-xs bg-slate-900 hover:bg-slate-800 dark:bg-primary dark:hover:bg-primary/85 text-white dark:text-slate-900 rounded-full transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>{t.addItemButton.split(" ")[0]}</span>
                    </button>
                  </div>
                </div>

                {/* Added Items Table (Standard ERP Table) */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-separate" style={{ borderSpacing: 0 }}>
                    <thead>
                      <tr className="text-slate-600 dark:text-slate-300 select-none">
                        <th className="py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap bg-[#E7E9ED] dark:bg-[#2E2E34] rounded-l-full">
                          {t.colName}
                        </th>
                        <th className="py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider text-center whitespace-nowrap bg-[#E7E9ED] dark:bg-[#2E2E34]">
                          {t.qtyInvoiceLabel}
                        </th>
                        <th className="py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider text-right whitespace-nowrap bg-[#E7E9ED] dark:bg-[#2E2E34]">
                          {t.unitCostLabel}
                        </th>
                        <th className="py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider text-right whitespace-nowrap bg-[#E7E9ED] dark:bg-[#2E2E34]">
                          {t.itemSubtotal}
                        </th>
                        <th className="py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider text-center whitespace-nowrap bg-[#E7E9ED] dark:bg-[#2E2E34] rounded-r-full w-16">
                          {t.actions}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-10 text-slate-400 dark:text-slate-500 font-bold border-b border-slate-200/80 dark:border-dark-border">
                            {t.noItemsAdded}
                          </td>
                        </tr>
                      ) : (
                        items.map((item, idx) => {
                          const subtotal = item.qty * item.unit_cost;
                          return (
                            <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.03] transition-colors">
                              <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200/80 dark:border-dark-border">
                                {item.product_name}
                              </td>
                              <td className="px-5 py-3.5 text-center font-mono font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200/80 dark:border-dark-border">
                                {item.qty} {item.product_unit}
                              </td>
                              <td className="px-5 py-3.5 text-right font-mono text-slate-600 dark:text-slate-300 border-b border-slate-200/80 dark:border-dark-border">
                                Rp {item.unit_cost.toLocaleString("id-ID")}
                              </td>
                              <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900 dark:text-primary border-b border-slate-200/80 dark:border-dark-border">
                                Rp {subtotal.toLocaleString("id-ID")}
                              </td>
                              <td className="px-5 py-3.5 text-center border-b border-slate-200/80 dark:border-dark-border">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors cursor-pointer"
                                  title="Hapus Baris"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN (lg:col-span-4): Payment Status, Debt, & Live Summary */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Card 3: Status Pembayaran & Hutang */}
              <div className={bentoCardClass}>
                <h4 className={cardHeadingClass}>
                  <CreditCard className="w-4 h-4 text-slate-700 dark:text-primary" />
                  <span>{t.paymentStatusLabel}</span>
                </h4>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    {[
                      { val: "paid", label: t.statusPaid, color: "text-emerald-500" },
                      { val: "unpaid", label: t.statusUnpaid, color: "text-red-500" },
                      { val: "partial", label: t.statusPartial, color: "text-amber-500" },
                    ].map((opt) => {
                      const isActive = paymentStatus === opt.val;
                      return (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => setPaymentStatus(opt.val as any)}
                          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                            isActive
                              ? "bg-slate-900 text-white border-slate-900 dark:bg-primary dark:border-primary dark:text-slate-900 font-bold shadow-xs"
                              : "bg-slate-50/70 dark:bg-dark-bg border-slate-200/80 dark:border-[#333338] text-slate-700 dark:text-slate-300 hover:border-slate-400"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="capitalize">{opt.label}</span>
                          </div>
                          {isActive && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>

                  {paymentStatus !== "paid" && (
                    <div className="pt-3 border-t border-slate-100 dark:border-[#303035]">
                      <label className={labelClass}>{t.amountOwedLabel} *</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={amountOwed}
                          onChange={(e) => setAmountOwed(formatNumberInput(e.target.value))}
                          placeholder={totalCostCalculated ? totalCostCalculated.toLocaleString("id-ID") : "0"}
                          className="w-full pl-9 pr-3 py-2.5 rounded-full border text-sm font-bold focus:outline-none focus:ring-2 bg-slate-50/70 dark:bg-dark-bg border-slate-200 dark:border-dark-border text-red-600 dark:text-red-400"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 4: Ringkasan Total Faktur PO */}
              <div className={bentoCardClass}>
                <h4 className={cardHeadingClass}>
                  <Sparkles className="w-4 h-4 text-slate-700 dark:text-primary" />
                  <span>Ringkasan Nota PO</span>
                </h4>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Total Item</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {items.length} Macam Barang
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Total Qty</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {items.reduce((sum, it) => sum + it.qty, 0)} Unit
                    </span>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-[#303035] flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                      {t.totalProcurementCost}
                    </span>
                    <span className="font-mono font-black text-base text-slate-900 dark:text-primary">
                      Rp {totalCostCalculated.toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* Sticky Bottom Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/80 dark:border-slate-800">
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
              disabled={items.length === 0 || formLoading}
              className="px-8 py-3 font-extrabold rounded-full cursor-pointer text-xs shadow-md transition-all bg-slate-900 hover:bg-slate-800 dark:bg-primary dark:hover:bg-primary/85 text-white dark:text-slate-900 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {formLoading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4 stroke-[3]" />
              )}
              <span>{formLoading ? t.saving : t.saveProcurementButton}</span>
            </button>
          </div>
        </form>

      </div>
    );
  }

  // =========================================================================
  // VIEW: PROCUREMENT LIST / HISTORY & DEBT (FRAMELESS ACCORDION MOBILE LIST)
  // =========================================================================
  return (
    <div className="space-y-6 text-left relative">

      {/* ── HEADER TITLE & ACTIONS ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-4">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t.procurementHistoryTitle}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
            {t.procurementHistoryDesc}
          </p>
        </div>

        {isManagerOrOwner && (
          <button
            type="button"
            onClick={handleTriggerAdd}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-primary dark:hover:bg-primary/85 text-white dark:text-slate-900 text-xs font-extrabold rounded-full shadow-sm transition-all cursor-pointer self-start sm:self-auto shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>{t.procurementNewTitle}</span>
          </button>
        )}
      </div>

      {/* ── KPI METRICS SUMMARY CARDS (CLICKABLE QUICK FILTERS) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Card 1: Total Pengadaan */}
        <button
          type="button"
          onClick={() => setFilterPayment("all")}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between group ${
            filterPayment === "all"
              ? "bg-slate-900 dark:bg-[#2A2A30] border-slate-900 dark:border-primary text-white shadow-sm"
              : "bg-white dark:bg-dark-card border-slate-200/80 dark:border-dark-border text-slate-700 dark:text-slate-200 hover:border-slate-300"
          }`}
        >
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">
              Total Pengadaan
            </span>
            <span className="text-base font-extrabold font-mono text-slate-900 dark:text-slate-100">
              Rp {totalSpend.toLocaleString("id-ID")}
            </span>
          </div>
          <DollarSign className="w-5 h-5 opacity-40 shrink-0" />
        </button>

        {/* Card 2: Hutang / Belum Lunas */}
        <button
          type="button"
          onClick={() => setFilterPayment("unpaid")}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between group ${
            filterPayment === "unpaid"
              ? "bg-red-950/80 border-red-500 text-white shadow-sm"
              : "bg-white dark:bg-dark-card border-slate-200/80 dark:border-dark-border text-slate-700 dark:text-slate-200 hover:border-slate-300"
          }`}
        >
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">
              Total Utang
            </span>
            <span className="text-base font-extrabold font-mono text-red-500">
              Rp {totalDebt.toLocaleString("id-ID")}
            </span>
          </div>
          <CreditCard className="w-5 h-5 text-red-500 opacity-60 shrink-0" />
        </button>

        {/* Card 3: Faktur Lunas */}
        <button
          type="button"
          onClick={() => setFilterPayment("paid")}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between group ${
            filterPayment === "paid"
              ? "bg-emerald-950/80 border-emerald-500 text-white shadow-sm"
              : "bg-white dark:bg-dark-card border-slate-200/80 dark:border-dark-border text-slate-700 dark:text-slate-200 hover:border-slate-300"
          }`}
        >
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">
              Lunas
            </span>
            <span className="text-base font-extrabold font-mono text-emerald-500">
              {paidCount} Faktur
            </span>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-500 opacity-60 shrink-0" />
        </button>

        {/* Card 4: Total Transaksi */}
        <button
          type="button"
          onClick={() => setFilterPayment("all")}
          className="p-3.5 rounded-2xl border bg-white dark:bg-dark-card border-slate-200/80 dark:border-dark-border text-slate-700 dark:text-slate-200 text-left cursor-pointer flex items-center justify-between"
        >
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">
              Total PO
            </span>
            <span className="text-base font-extrabold font-mono text-slate-900 dark:text-slate-100">
              {procurements.length} Transaksi
            </span>
          </div>
          <FileSpreadsheet className="w-5 h-5 text-slate-400 opacity-60 shrink-0" />
        </button>
      </div>

      {/* ── SEARCH & RICH TOOLBAR CONTROLS ── */}
      <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
        {/* Unified ErpSearchBar */}
        <ErpSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Cari nama supplier atau ID faktur..."
          inputRef={searchInputRef}
          className="flex-1 min-w-[200px]"
        />

        {/* Sort Dropdown Button (Shadcn UI) */}
        <DropdownMenu>
          <DropdownMenuTrigger className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-full border text-xs font-bold cursor-pointer transition-all ${
            sortBy !== "date_desc"
              ? "bg-slate-900 text-white border-slate-900 dark:bg-primary dark:border-primary dark:text-slate-900 shadow-sm"
              : isDarkMode
              ? "bg-dark-card border-dark-border text-slate-200 hover:bg-white/5"
              : "bg-white border-light-border/60 text-slate-700 hover:bg-slate-50"
          }`}>
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="font-semibold text-[11px]">
              {sortBy === "date_desc"
                ? "Terbaru"
                : sortBy === "date_asc"
                ? "Terlama"
                : sortBy === "cost_desc"
                ? "Nominal Terbesar"
                : sortBy === "cost_asc"
                ? "Nominal Terkecil"
                : "Supplier (A-Z)"}
            </span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#3A3A3E] shadow-2xl rounded-2xl p-1.5 min-w-[200px]">
            {[
              { key: "date_desc", label: "Tanggal: Terbaru → Terlama" },
              { key: "date_asc", label: "Tanggal: Terlama → Terbaru" },
              { key: "cost_desc", label: "Nominal: Terbesar → Terkecil" },
              { key: "cost_asc", label: "Nominal: Terkecil → Terbesar" },
              { key: "supplier_asc", label: "Nama Supplier (A - Z)" },
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

        {/* Supplier Filter Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-full border text-xs font-bold cursor-pointer transition-all ${
            filterSupplier !== "all"
              ? "bg-slate-900 text-white border-slate-900 dark:bg-primary dark:border-primary dark:text-slate-900 shadow-sm"
              : isDarkMode
              ? "bg-dark-card border-dark-border text-slate-200 hover:bg-white/5"
              : "bg-white border-light-border/60 text-slate-700 hover:bg-slate-50"
          }`}>
            <Building2 className="w-3.5 h-3.5" />
            <span className="truncate max-w-[120px]">
              {filterSupplier === "all" ? "Semua Supplier" : filterSupplier}
            </span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#3A3A3E] shadow-2xl rounded-2xl p-1.5 min-w-[200px] max-h-[260px] overflow-y-auto">
            <DropdownMenuItem
              onClick={() => setFilterSupplier("all")}
              className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl flex items-center justify-between"
            >
              <span>Semua Supplier</span>
              {filterSupplier === "all" && <Check className="w-3.5 h-3.5 text-emerald-500" />}
            </DropdownMenuItem>
            {uniqueSuppliers.map((sup) => (
              <DropdownMenuItem
                key={sup}
                onClick={() => setFilterSupplier(sup)}
                className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl flex items-center justify-between"
              >
                <span className="truncate">{sup}</span>
                {filterSupplier.toLowerCase() === sup.toLowerCase() && (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Quick Payment Status Filter Pills */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#202023] border border-slate-200/70 dark:border-[#35353A] rounded-full shadow-2xs">
          {[
            { val: "all", label: "Semua" },
            { val: "paid", label: "Lunas" },
            { val: "unpaid", label: "Belum Lunas" },
            { val: "partial", label: "Sebagian" },
          ].map((st) => {
            const isActive = filterPayment === st.val;
            return (
              <button
                key={st.val}
                type="button"
                onClick={() => setFilterPayment(st.val)}
                className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "bg-slate-900 text-white dark:bg-primary dark:text-slate-900 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {st.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── REUSABLE UNIFIED ERP DATA TABLE (DESKTOP TABLE + MOBILE ACCORDION) ── */}
      <ErpDataTable<Procurement>
        data={sortedProcurements}
        keyExtractor={(proc) => proc.id}
        loading={loading}
        emptyText="Tidak ada faktur pengadaan yang cocok"
        onRowClick={(proc) => handleOpenDetail(proc)}
        onRowContextMenu={(e, proc) => {
          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            procurement: proc,
          });
        }}
        renderMobileItem={(proc) => {
          const isExpanded = expandedProcurementId === proc.id;
          const isDueExpired = proc.due_date && new Date(proc.due_date) < new Date() && proc.payment_status !== "paid";

          return (
            <div className="transition-colors">
              <div
                onClick={() => setExpandedProcurementId(isExpanded ? null : proc.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    procurement: proc,
                  });
                }}
                className="flex items-center justify-between py-3.5 px-1 hover:bg-slate-100/50 dark:hover:bg-white/[0.03] active:bg-slate-200/40 dark:active:bg-white/5 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#1C1C1F] flex items-center justify-center text-slate-700 dark:text-primary font-bold text-xs shrink-0 border border-slate-200/60 dark:border-dark-border">
                    <Building2 className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate group-hover:text-slate-700 dark:group-hover:text-primary transition-colors">
                      {proc.supplier_name}
                    </h4>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      {new Date(proc.procurement_date).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 text-right">
                  <div>
                    <div className="font-mono font-extrabold text-sm text-slate-900 dark:text-slate-100">
                      Rp {proc.total_cost.toLocaleString("id-ID")}
                    </div>
                    <div className="flex items-center justify-end gap-1.5 mt-0.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[9px] font-extrabold uppercase ${
                        proc.payment_status === "paid"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : proc.payment_status === "partial"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
                          : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          proc.payment_status === "paid" ? "bg-emerald-500" : proc.payment_status === "partial" ? "bg-amber-500" : "bg-red-500"
                        }`} />
                        <span>{proc.payment_status}</span>
                      </span>

                      {proc.amount_owed && proc.amount_owed > 0 ? (
                        <span className="font-mono font-bold text-red-500 text-[10px]">
                          (Utang Rp {proc.amount_owed.toLocaleString("id-ID")})
                        </span>
                      ) : null}
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
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-200/80 dark:bg-[#25252A] text-slate-700 dark:text-slate-300">
                      ID: {proc.id}
                    </span>
                    {proc.due_date && (
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isDueExpired
                          ? "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                          : "bg-slate-200/60 dark:bg-[#25252A] text-slate-600 dark:text-slate-400"
                      }`}>
                        Jatuh Tempo: {new Date(proc.due_date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                        {isDueExpired && " (Lewat Tempo)"}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <button
                      type="button"
                      onClick={() => handleOpenDetail(proc)}
                      className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 dark:bg-primary text-white dark:text-slate-900 font-bold text-xs cursor-pointer transition-all active:scale-95 shadow-2xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Rincian Item / PO</span>
                    </button>

                    {isManagerOrOwner && (
                      <DropdownMenu>
                        <DropdownMenuTrigger className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[#222226] border border-slate-200/80 dark:border-[#333338] hover:bg-slate-100 dark:hover:bg-white/10 font-bold text-xs text-slate-700 dark:text-slate-300 cursor-pointer transition-all">
                          <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                          <span>Ubah Pembayaran</span>
                          <ChevronDown className="w-3 h-3 text-slate-400" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#3A3A3E] shadow-xl rounded-xl p-1 min-w-[170px]">
                          <DropdownMenuItem
                            onClick={() => handleUpdatePaymentStatus(proc.id, "paid")}
                            className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span>Tandai Lunas</span>
                            </div>
                            {proc.payment_status === "paid" && <Check className="w-3 h-3 text-emerald-500 stroke-[3]" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleUpdatePaymentStatus(proc.id, "unpaid", proc.total_cost)}
                            className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-red-500" />
                              <span>Belum Lunas</span>
                            </div>
                            {proc.payment_status === "unpaid" && <Check className="w-3 h-3 text-red-500 stroke-[3]" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleUpdatePaymentStatus(proc.id, "partial", Math.round(proc.total_cost / 2))}
                            className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-amber-500" />
                              <span>Bayar Sebagian</span>
                            </div>
                            {proc.payment_status === "partial" && <Check className="w-3 h-3 text-amber-500 stroke-[3]" />}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(proc.id);
                        toast.success(t.invoiceIdCopied);
                      }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[#222226] border border-slate-200/80 dark:border-[#333338] hover:bg-slate-100 dark:hover:bg-white/10 font-bold text-xs text-slate-700 dark:text-slate-300 cursor-pointer transition-all active:scale-95"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Salin ID</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        }}
        columns={[
          {
            key: "supplier",
            label: t.supplierLabel.split("/")[0],
            renderCell: (proc) => (
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-[#2E2E34] flex items-center justify-center text-slate-700 dark:text-primary font-bold text-[11px] shrink-0">
                  {proc.supplier_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <span className="block truncate font-bold text-slate-900 dark:text-slate-100">{proc.supplier_name}</span>
                  <span className="text-[10px] font-mono text-slate-400 truncate block">ID: {proc.id.substring(0, 8)}...</span>
                </div>
              </div>
            ),
          },
          {
            key: "date",
            label: t.procurementDateLabel,
            align: "center",
            renderCell: (proc) => (
              <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
                {new Date(proc.procurement_date).toLocaleDateString("id-ID", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            ),
          },
          {
            key: "totalCost",
            label: t.totalProcurementCost,
            align: "right",
            renderCell: (proc) => (
              <span className="font-mono font-black text-slate-900 dark:text-slate-100">
                Rp {proc.total_cost.toLocaleString("id-ID")}
              </span>
            ),
          },
          {
            key: "paymentStatus",
            label: t.paymentStatusLabel,
            align: "center",
            renderCell: (proc) => (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                  proc.payment_status === "paid"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50"
                    : proc.payment_status === "partial"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50"
                    : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-900/50"
                }`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    proc.payment_status === "paid"
                      ? "bg-emerald-500"
                      : proc.payment_status === "partial"
                      ? "bg-amber-500"
                      : "bg-red-500"
                  }`}
                />
                <span>{proc.payment_status}</span>
              </span>
            ),
          },
          {
            key: "amountOwed",
            label: t.totalProcurementDebt,
            align: "right",
            renderCell: (proc) => (
              <span
                className={`font-mono font-bold ${
                  proc.amount_owed && proc.amount_owed > 0
                    ? "text-red-500 dark:text-red-400 font-extrabold"
                    : "text-slate-400"
                }`}
              >
                Rp {proc.amount_owed ? proc.amount_owed.toLocaleString("id-ID") : 0}
              </span>
            ),
          },
          {
            key: "dueDate",
            label: t.dueDateLabel,
            align: "center",
            renderCell: (proc) => {
              const isDueExpired =
                proc.due_date &&
                new Date(proc.due_date) < new Date() &&
                proc.payment_status !== "paid";

              return proc.due_date ? (
                <div className="flex items-center justify-center gap-1 font-mono text-xs text-slate-500 dark:text-slate-400">
                  {isDueExpired && <AlertCircle className="w-3 h-3 text-red-500" />}
                  <span className={isDueExpired ? "text-red-500 font-bold" : ""}>
                    {new Date(proc.due_date).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              ) : (
                <span className="text-slate-400">-</span>
              );
            },
          },
          {
            key: "actions",
            label: t.actions,
            align: "center",
            renderCell: (proc) => (
              <DropdownMenu>
                <DropdownMenuTrigger
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 dark:text-slate-500 cursor-pointer transition-colors"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#3A3A3E] shadow-xl rounded-xl p-1 min-w-[170px]">
                  <DropdownMenuItem
                    onClick={() => handleOpenDetail(proc)}
                    className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-700 dark:text-primary" />
                    <span>{t.viewDetails}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      navigator.clipboard.writeText(proc.id);
                      toast.success(t.invoiceIdCopied);
                    }}
                    className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t.copyInvoiceId}</span>
                  </DropdownMenuItem>

                  {proc.payment_status !== "paid" && (
                    <>
                      <div className="border-t border-slate-100 dark:border-[#333338] my-1" />
                      <DropdownMenuItem
                        onClick={() => handleUpdatePaymentStatus(proc.id, "paid", 0)}
                        className="cursor-pointer px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{t.markAsPaid}</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          },
        ]}
      />

      {/* ── ROW CONTEXT MENU ON RIGHT CLICK ── */}
      {contextMenu && (
        <div
          style={{
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
          }}
          className="fixed z-50 min-w-[200px] bg-white dark:bg-[#202024] border border-slate-200 dark:border-dark-border rounded-2xl shadow-2xl p-1.5 animate-in fade-in-0 zoom-in-95 text-slate-800 dark:text-slate-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-[#333338] mb-1 truncate max-w-[210px]">
            {contextMenu.procurement.supplier_name}
          </div>
          
          <button
            type="button"
            onClick={() => {
              handleOpenDetail(contextMenu.procurement);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-slate-700 dark:text-primary" />
            <span>{t.viewDetails}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(contextMenu.procurement.id);
              toast.success(t.invoiceIdCopied);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Copy className="w-3.5 h-3.5 text-slate-400" />
            <span>{t.copyInvoiceId}</span>
          </button>

          {contextMenu.procurement.payment_status !== "paid" && (
            <>
              <div className="border-t border-slate-100 dark:border-[#333338] my-1" />
              <button
                type="button"
                onClick={() => {
                  handleUpdatePaymentStatus(contextMenu.procurement.id, "paid", 0);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{t.markAsPaid}</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* ── DETAIL DIALOG (SHADCN DIALOG) ── */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl bg-white dark:bg-[#202024] border border-slate-200 dark:border-dark-border text-slate-900 dark:text-slate-100 rounded-3xl p-6 shadow-2xl">
          <DialogHeader className="border-b border-slate-100 dark:border-[#303035] pb-4 text-left">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-slate-800 dark:text-primary" />
              <span>{t.procurementDetailTitle}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 font-medium">
              {t.procurementDetailDesc}
            </DialogDescription>
          </DialogHeader>

          {loadingDetail ? (
            <div className="py-16 flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-3 border-slate-900 dark:border-primary border-t-transparent rounded-full animate-spin mb-3" />
              <span className="text-xs font-bold text-slate-400">Memuat rincian barang...</span>
            </div>
          ) : detailProcurement ? (
            <div className="space-y-5 text-left py-2">
              
              {/* Header Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-[#1A1A1D] p-4 rounded-2xl border border-slate-100 dark:border-[#333338]">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Supplier</span>
                  <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate block">
                    {detailProcurement.supplier_name}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t.procurementDateLabel}</span>
                  <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 block">
                    {new Date(detailProcurement.procurement_date).toLocaleDateString("id-ID")}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t.paymentStatusLabel}</span>
                  <span className="text-xs font-bold capitalize text-slate-800 dark:text-primary block">
                    {detailProcurement.payment_status}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t.totalProcurementDebt}</span>
                  <span className="text-xs font-mono font-black text-red-500 block">
                    Rp {(detailProcurement.amount_owed || 0).toLocaleString("id-ID")}
                  </span>
                </div>
              </div>

              {/* Items List (Standard ERP Table) */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-separate" style={{ borderSpacing: 0 }}>
                  <thead>
                    <tr className="text-slate-600 dark:text-slate-300 select-none">
                      <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap bg-[#E7E9ED] dark:bg-[#2E2E34] rounded-l-full">
                        {t.colName}
                      </th>
                      <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-center whitespace-nowrap bg-[#E7E9ED] dark:bg-[#2E2E34]">
                        {t.qtyInvoiceLabel}
                      </th>
                      <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-right whitespace-nowrap bg-[#E7E9ED] dark:bg-[#2E2E34]">
                        {t.unitCostLabel}
                      </th>
                      <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-right whitespace-nowrap bg-[#E7E9ED] dark:bg-[#2E2E34] rounded-r-full">
                        {t.itemSubtotal}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailProcurement.items && detailProcurement.items.length > 0 ? (
                      detailProcurement.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.03]">
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200/80 dark:border-dark-border">
                            {it.product_name}
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200/80 dark:border-dark-border">
                            {it.qty} {it.product_unit}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-300 border-b border-slate-200/80 dark:border-dark-border">
                            Rp {it.unit_cost.toLocaleString("id-ID")}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-primary border-b border-slate-200/80 dark:border-dark-border">
                            Rp {it.subtotal.toLocaleString("id-ID")}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="text-center py-6 text-slate-400 font-medium border-b border-slate-200/80 dark:border-dark-border">
                          Data rincian barang tidak ditemukan
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Total Summary Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-[#303035]">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  {t.totalProcurementCost}
                </span>
                <span className="text-base font-mono font-black text-slate-900 dark:text-primary">
                  Rp {detailProcurement.total_cost.toLocaleString("id-ID")}
                </span>
              </div>

            </div>
          ) : null}

          <DialogFooter className="border-t border-slate-100 dark:border-[#303035] pt-4">
            <button
              type="button"
              onClick={() => setIsDetailOpen(false)}
              className="px-6 py-2.5 font-bold text-xs bg-slate-900 dark:bg-primary text-white dark:text-slate-900 rounded-full cursor-pointer hover:opacity-90 transition-opacity"
            >
              {t.close}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
