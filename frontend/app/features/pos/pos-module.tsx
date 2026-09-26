import { useState, useEffect, useRef, useMemo } from "react";
import { api } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { enqueueTransaction } from "../../lib/indexeddb";
import { getImageUrl } from "../../lib/utils";
import { 
  Search, Trash2, Barcode, ChevronRight, CreditCard, 
  CheckCircle2, RotateCcw, XCircle, ShoppingCart, 
  Package, ClipboardCheck, FileSpreadsheet, BarChart3, 
  ChevronDown, GripVertical, History, Printer, AlertCircle, KeyRound, Menu, Tag, Sparkles, Boxes, ArrowDownToDot, Layers,
  Pin, PinOff, ExternalLink, Ticket, Clock, Calendar, X
} from "lucide-react";
import { toast } from "sonner";
import TransactionHistoryDrawer, { type TransactionRecord } from "../../components/TransactionHistoryDrawer";
import { ErpSearchBar } from "../../components/ErpSearchBar";
import { ErpImage } from "../../components/ErpImage";
import { CurrencyInput } from "../../components/CurrencyInput";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../../components/ui/input-otp";
import { useLanguageStore, translations } from "../../lib/i18n";
import { usePOSSettings } from "../../hooks/use-pos-settings";
import type { Promotion } from "../promotions/promotions-module";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "../../components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";

interface Product {
  id: string;
  name: string;
  sku?: string;
  category?: string;
  category_id?: string;
  item_type?: string;
  is_sellable?: boolean;
  is_inventory_tracked?: boolean;
  unit_type: string;
  inventory_mode: string;
  purchase_price: number;
  sell_price: number;
  current_stock: number;
  min_stock_alert?: number;
  image_url?: string;
  status: "active" | "inactive" | "discontinued";
  base_unit?: string;
  price_unit?: string;
  box_unit?: string;
  conversion_rate?: number;
  qty_sealed?: number;
  qty_loose?: number;
}

interface CartItem {
  product: Product;
  qty: number;
}

interface Transaction {
  id: string;
  total_amount: number;
  payment_method: "cash" | "qris" | "other";
  type: "sale" | "internal_take" | "void";
  status: "completed" | "voided";
  created_at: string;
}

interface POSModuleProps {
  gridCols?: number;
  showNumpad?: boolean;
  onNavigate?: (view: string) => void;
}

export default function POSModule({ gridCols = 4, showNumpad = true, onNavigate }: POSModuleProps) {
  const { activeContext, activeShift, setActiveShift } = useAuthStore();
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;

  // Shift States
  const [loadingShift, setLoadingShift] = useState(true);
  const [openingCash, setOpeningCash] = useState<number>(150000);
  const [closingCashActual, setClosingCashActual] = useState<number>(0);
  const [cashReceived, setCashReceived] = useState<number>(0);

  // Product & Category States
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL_CATEGORY_KEY");

  // Cart & Pricing States
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCartIndex, setSelectedCartIndex] = useState<number | null>(0);
  const [numpadMode, setNumpadMode] = useState<"qty" | "tax" | "discount">("qty");
  const [enableTax, setEnableTax] = useState(() => {
    return localStorage.getItem("pos_enable_tax") === "true";
  });
  const [enableDiscount, setEnableDiscount] = useState(() => {
    return localStorage.getItem("pos_enable_discount") === "true";
  });
  const [taxRate, setTaxRate] = useState(() => {
    const saved = localStorage.getItem("pos_tax_rate");
    return saved ? Number(saved) : 11;
  });
  const [discountRate, setDiscountRate] = useState(() => {
    const saved = localStorage.getItem("pos_discount_rate");
    return saved ? Number(saved) : 0;
  });
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qris" | "other">("cash");
  const [isInternalTake, setIsInternalTake] = useState(false);
  const [isMobileCartExpanded, setIsMobileCartExpanded] = useState(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  // Touch Drag Handlers for Mobile Cart Sheet
  const handleCartTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
  };

  const handleCartTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY === null) return;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaY = touchEndY - touchStartY;

    if (!isMobileCartExpanded && deltaY < -35) {
      setIsMobileCartExpanded(true);
    } else if (isMobileCartExpanded && deltaY > 35) {
      setIsMobileCartExpanded(false);
    }

    setTouchStartY(null);
  };

  // Sync settings when changed from DesktopShell Settings Drawer
  useEffect(() => {
    const handleSettingsChanged = () => {
      setEnableTax(localStorage.getItem("pos_enable_tax") === "true");
      setEnableDiscount(localStorage.getItem("pos_enable_discount") === "true");
      const savedTax = localStorage.getItem("pos_tax_rate");
      if (savedTax) setTaxRate(Number(savedTax) || 0);
      const savedDisc = localStorage.getItem("pos_discount_rate");
      if (savedDisc) setDiscountRate(Number(savedDisc) || 0);
    };

    window.addEventListener("pos_settings_changed", handleSettingsChanged);
    window.addEventListener("storage", handleSettingsChanged);
    return () => {
      window.removeEventListener("pos_settings_changed", handleSettingsChanged);
      window.removeEventListener("storage", handleSettingsChanged);
    };
  }, []);

  // Transaction Lists, Modals & History Drawer
  const [recentTx, setRecentTx] = useState<Transaction[]>([]);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState<string | null>(null);
  const [managerPin, setManagerPin] = useState("");
  const [voidReason, setVoidReason] = useState("");
  
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceipt, setShowReceipt] = useState<any>(null);

  // Transient string state for cart QTY inputs (allows backspace and decimal typing)
  const [transientQty, setTransientQty] = useState<Record<number, string>>({});
  const [numpadDecimalActive, setNumpadDecimalActive] = useState(false);

  // Promotions State & Manual Selection
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);
  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [showPromoDrawer, setShowPromoDrawer] = useState(false);

  // App UI/Theme State
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(false);

  // Refs for scrolling and keys
  const categoryRef = useRef<HTMLDivElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Detect Dark Mode dynamically from document.documentElement
  useEffect(() => {
    const checkDark = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };
    checkDark();

    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"]
    });
    return () => observer.disconnect();
  }, []);

  // Single Product Detail & Unpack Drawer State
  const [selectedProductForDetail, setSelectedProductForDetail] = useState<Product | null>(null);
  const [boxesToUnbox, setBoxesToUnbox] = useState<number>(1);
  const [unboxNotes, setUnboxNotes] = useState<string>("");
  const [unboxingLoading, setUnboxingLoading] = useState(false);

  // Long-press timer ref
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggeredRef = useRef(false);

  // Global Keyboard Listener: Press '/' to focus scan input
  useEffect(() => {
    const handleGlobalKeydown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleGlobalKeydown);
    return () => window.removeEventListener("keydown", handleGlobalKeydown);
  }, []);

  // Open Product Detail & Unpack Drawer
  const handleOpenProductDetail = (p: Product) => {
    setSelectedProductForDetail(p);
    setBoxesToUnbox(1);
    setUnboxNotes("");
  };

  // Long Press Handlers for Touch Devices
  const handleTouchStartProduct = (p: Product) => {
    isLongPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      handleOpenProductDetail(p);
    }, 450); // 450ms longpress threshold
  };

  const handleTouchEndProduct = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Handler for Unbox action directly inside Product Detail Drawer
  const handleConfirmUnbox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForDetail || boxesToUnbox <= 0) return;

    setUnboxingLoading(true);
    try {
      const res = await api.post(`/items/${selectedProductForDetail.id}/unbox`, {
        boxes_to_unbox: boxesToUnbox,
        notes: unboxNotes || "Unbox langsung via POS Kasir",
      });

      toast.success(res.data?.message || t.posUnpackSuccess || "Dus berhasil dibongkar ke rak display!");
      
      const updatedItem = res.data?.data;
      if (updatedItem) {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === updatedItem.id
              ? {
                  ...p,
                  qty_sealed: updatedItem.qty_sealed,
                  qty_loose: updatedItem.qty_loose,
                  current_stock: updatedItem.qty_loose,
                }
              : p
          )
        );
        setSelectedProductForDetail((prev) =>
          prev && prev.id === updatedItem.id
            ? {
                ...prev,
                qty_sealed: updatedItem.qty_sealed,
                qty_loose: updatedItem.qty_loose,
                current_stock: updatedItem.qty_loose,
              }
            : prev
        );
      } else {
        fetchProducts();
      }

      setBoxesToUnbox(1);
      setUnboxNotes("");
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || t.posUnpackInsufficient || "Gagal membongkar dus");
    } finally {
      setUnboxingLoading(false);
    }
  };

  // Fetch active shift, products & active promotions
  useEffect(() => {
    if (activeContext && activeContext.type !== "fnb_production") {
      fetchShiftStatus();
      fetchProducts();
      fetchPromotions();
    }
  }, [activeContext]);

  const fetchPromotions = async () => {
    try {
      const res = await api.get("/promotions?active_only=true");
      const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setPromotions(list);
    } catch (err) {
      console.error("Failed to load promotions:", err);
    }
  };

  const fetchShiftStatus = async () => {
    setLoadingShift(true);
    try {
      const res = await api.get("/shifts/active");
      setActiveShift(res.data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setActiveShift(null);
      } else {
        console.error("Failed to check active shift:", err);
      }
    } finally {
      setLoadingShift(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await api.get("/products?status=active&is_sellable=true");
      const productsList: Product[] = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      const sellableList = productsList.filter(
        (p) => p.is_sellable !== false && (p.item_type ? p.item_type === "finished_good" : true)
      );
      setProducts(sellableList);
    } catch (err) {
      console.error("Failed to load products:", err);
    }
  };

  // Open Shift Form Submit
  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post("/shifts/open", {
        opening_cash: Math.round(openingCash) || 0,
      });
      setActiveShift(res.data);
      toast.success(t.posOpenShiftSuccess || "Shift kasir berhasil dibuka!");
    } catch (err: any) {
      toast.error(err.response?.data?.message || t.posOpenShiftFailed || "Gagal membuka shift kasir");
    } finally {
      setLoading(false);
    }
  };

  // Close Shift Form Submit
  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/shifts/close", {
        closing_cash_actual: Math.round(closingCashActual) || 0,
      });
      setActiveShift(null);
      setShowCloseModal(false);
      setClosingCashActual(0);
      setCart([]);
      toast.success(t.posCloseShiftSuccess || "Shift kasir berhasil ditutup!");
    } catch (err: any) {
      toast.error(err.response?.data?.message || t.posCloseShiftFailed || "Gagal menutup shift kasir");
    } finally {
      setLoading(false);
    }
  };

  // Dynamic products image generator using Unsplash stable links
  const getProductImage = (product: Product) => {
    if (product.image_url) return getImageUrl(product.image_url);
    const cat = (product.category || "general").toLowerCase();
    const name = product.name.toLowerCase();
    
    if (cat.includes("meatball") || cat.includes("soup") || name.includes("kuah") || name.includes("bakso") || name.includes("pentol")) {
      return "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=300&auto=format&fit=crop&q=60";
    }
    if (cat.includes("chicken") || cat.includes("poultry") || name.includes("ayam") || name.includes("crispy")) {
      return "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=300&auto=format&fit=crop&q=60";
    }
    if (cat.includes("snack") || cat.includes("fritter") || name.includes("goreng") || name.includes("tempe") || name.includes("tahu")) {
      return "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=300&auto=format&fit=crop&q=60";
    }
    if (cat.includes("drink") || cat.includes("beverage") || name.includes("teh") || name.includes("kopi") || name.includes("cola")) {
      return "https://images.unsplash.com/photo-1497534446932-c925b458314e?w=300&auto=format&fit=crop&q=60";
    }
    if (cat.includes("shirt") || cat.includes("baju") || cat.includes("jeans") || cat.includes("t-shirt")) {
      return "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=300&auto=format&fit=crop&q=60";
    }
    
    // Stable numeric hash fallback
    const hash = product.id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 5;
    const fallbacks = [
      "https://images.unsplash.com/photo-1542838132-92c53300491e?w=300&auto=format&fit=crop&q=60", // grocery
      "https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=300&auto=format&fit=crop&q=60", // shop
      "https://images.unsplash.com/photo-1607344645866-009c320c5ab8?w=300&auto=format&fit=crop&q=60", // food
      "https://images.unsplash.com/photo-1588964895597-cfccd6e2dbf9?w=300&auto=format&fit=crop&q=60", // cart item
      "https://images.unsplash.com/photo-1534723452862-4c874018d66d?w=300&auto=format&fit=crop&q=60"  // supermaket
    ];
    return fallbacks[hash];
  };

  // Cart operations
  const addToCart = (product: Product) => {
    const isTracked = product.is_inventory_tracked !== false;
    const isDryStrict = product.inventory_mode === "dry_strict" && isTracked;
    const availableStock = product.qty_loose ?? product.current_stock ?? 0;

    const idx = cart.findIndex((item) => item.product.id === product.id);
    if (idx !== -1) {
      const existing = cart[idx];
      if (isDryStrict && existing.qty + 1 > availableStock) {
        toast.error(`${t.posInsufficientStock} ${product.name}`);
        return;
      }
      const newCart = [...cart];
      newCart[idx].qty += 1;
      setCart(newCart);
      setSelectedCartIndex(idx);
    } else {
      if (isDryStrict && availableStock < 1) {
        toast.error(`${t.posOutOfStock} ${product.name}`);
        return;
      }
      setCart([...cart, { product, qty: 1 }]);
      setSelectedCartIndex(cart.length);
    }
  };

  const removeFromCart = (index: number) => {
    const newCart = cart.filter((_, idx) => idx !== index);
    setCart(newCart);
    if (newCart.length === 0) {
      setSelectedCartIndex(null);
    } else {
      setSelectedCartIndex(Math.max(0, (selectedCartIndex || 0) - 1));
    }
  };

  const isFractionalUnit = (unit?: string) => {
    const u = (unit || "").toLowerCase();
    return ["kg", "liter", "l", "gr", "gram", "ml", "meter", "m"].includes(u);
  };

  const updateQty = (index: number, delta: number) => {
    const item = cart[index];
    if (!item) return;

    const isTracked = item.product.is_inventory_tracked !== false;
    const isDryStrict = item.product.inventory_mode === "dry_strict" && isTracked;
    const availableStock = item.product.qty_loose ?? item.product.current_stock ?? 0;

    const isFractional = isFractionalUnit(item.product.unit_type || item.product.base_unit);
    const step = isFractional && item.qty <= 1 ? 0.1 : 1;
    const newQty = Math.round((item.qty + (delta > 0 ? step : -step)) * 1000) / 1000;

    if (newQty <= 0) {
      removeFromCart(index);
      return;
    }

    if (isDryStrict && delta > 0 && newQty > availableStock) {
      toast.error(`${t.posInsufficientStock} ${item.product.name}`);
      return;
    }

    const newCart = [...cart];
    newCart[index].qty = newQty;
    setCart(newCart);
  };

  const handleQtyInputChange = (index: number, valStr: string) => {
    if (!/^\d*\.?\d*$/.test(valStr)) return;

    setTransientQty((prev) => ({ ...prev, [index]: valStr }));

    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed > 0) {
      const item = cart[index];
      if (item) {
        const isTracked = item.product.is_inventory_tracked !== false;
        const isDryStrict = item.product.inventory_mode === "dry_strict" && isTracked;
        const availableStock = item.product.qty_loose ?? item.product.current_stock ?? 0;

        if (isDryStrict && parsed > availableStock) {
          toast.error(`${t.posInsufficientStock} ${item.product.name}`);
        }
        const newCart = [...cart];
        newCart[index].qty = parsed;
        setCart(newCart);
      }
    }
  };

  const handleQtyInputBlur = (index: number) => {
    const rawVal = transientQty[index];
    setTransientQty((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });

    if (rawVal === undefined) return;

    const parsed = parseFloat(rawVal);
    if (isNaN(parsed) || parsed <= 0) {
      if (rawVal === "0") {
        removeFromCart(index);
      } else {
        const newCart = [...cart];
        if (newCart[index]) {
          newCart[index].qty = 1;
          setCart(newCart);
        }
      }
    } else {
      const newCart = [...cart];
      if (newCart[index]) {
        newCart[index].qty = Math.round(parsed * 1000) / 1000;
        setCart(newCart);
      }
    }
  };

  // Barcode or text search submits
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const matched = (products || []).find(
      (p) => p.sku === searchQuery.trim() || p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (matched) {
      addToCart(matched);
      setSearchQuery("");
    } else {
      toast.error(t.posProductNotFound);
    }
  };

  // Numpad key triggers
  const handleNumpadPress = (val: string) => {
    if (selectedCartIndex === null || cart.length === 0) return;
    
    const newCart = [...cart];
    const currentItem = newCart[selectedCartIndex];
    if (!currentItem) return;
    const product = currentItem.product;

    if (numpadMode === "qty") {
      if (val === "C") {
        currentItem.qty = 0;
        setNumpadDecimalActive(false);
      } else if (val === ".") {
        setNumpadDecimalActive(true);
      } else if (val === "+" || val === "-") {
        const isFractional = isFractionalUnit(product.unit_type || product.base_unit);
        const step = isFractional && currentItem.qty <= 1 ? 0.1 : 1;
        const targetQty = Math.round((currentItem.qty + (val === "+" ? step : -step)) * 1000) / 1000;
        
        if (targetQty <= 0) {
          removeFromCart(selectedCartIndex);
          return;
        }

        const isTracked = product.is_inventory_tracked !== false;
        const isDryStrict = product.inventory_mode === "dry_strict" && isTracked;
        const availableStock = product.qty_loose ?? product.current_stock ?? 0;

        if (isDryStrict && val === "+" && targetQty > availableStock) {
          toast.error(`${t.posInsufficientStock} ${product.name}`);
          return;
        }
        currentItem.qty = targetQty;
        setNumpadDecimalActive(false);
      } else {
        const digit = val;
        let newQtyStr = "";

        if (numpadDecimalActive) {
          const currentStr = currentItem.qty === 0 ? "0" : currentItem.qty.toString();
          if (currentStr.includes(".")) {
            // Already has decimal dot, append digit if <= 3 decimal places
            const decimals = currentStr.split(".")[1] || "";
            if (decimals.length < 3) {
              newQtyStr = currentStr + digit;
            } else {
              newQtyStr = currentStr;
            }
          } else {
            // Start decimal portion
            newQtyStr = currentStr + "." + digit;
          }
        } else {
          // If current qty is 0, replace with digit
          newQtyStr = currentItem.qty === 0 ? digit : currentItem.qty.toString() + digit;
        }

        const parsed = parseFloat(newQtyStr);
        if (!isNaN(parsed)) {
          const isTracked = product.is_inventory_tracked !== false;
          const isDryStrict = product.inventory_mode === "dry_strict" && isTracked;
          const availableStock = product.qty_loose ?? product.current_stock ?? 0;

          if (isDryStrict && parsed > availableStock) {
            toast.error(`${t.posInsufficientStock} ${product.name}`);
            return;
          }
          currentItem.qty = parsed;
        }
      }
    } else if (numpadMode === "discount") {
      if (val === "C") {
        setDiscountRate(0);
      } else if (val === "+" || val === "-") {
        const delta = val === "+" ? 1 : -1;
        setDiscountRate(Math.max(0, discountRate + delta));
      } else {
        const newD = parseInt(discountRate.toString() + val);
        if (!isNaN(newD) && newD <= 100) {
          setDiscountRate(newD);
        }
      }
    } else if (numpadMode === "tax") {
      if (val === "C") {
        setTaxRate(0);
      } else if (val === "+" || val === "-") {
        const delta = val === "+" ? 1 : -1;
        setTaxRate(Math.max(0, taxRate + delta));
      } else {
        const newT = parseInt(taxRate.toString() + val);
        if (!isNaN(newT) && newT <= 50) {
          setTaxRate(newT);
        }
      }
    }
    
    setCart(newCart);
  };

  const handleReprintReceipt = (tx: TransactionRecord) => {
    setShowReceipt({
      id: tx.id,
      totalAmount: tx.total_amount,
      paymentMethod: tx.payment_method,
      created_at: tx.created_at,
      items: tx.items || [],
      cashier: tx.staff_name || "Kasir",
      outlet_name: activeContext?.name || "JnA Mart",
    });
  };

  // Helper: check if a promotion is valid right now (Day of week & Happy Hour time range)
  const isPromoCurrentlyValid = (p: Promotion) => {
    if (!p.is_active) return false;
    const now = new Date();
    
    // Check start and end dates
    if (new Date(p.start_date) > now) return false;
    if (p.end_date && new Date(p.end_date) < now) return false;
    
    // Check day of week
    if (p.active_days && p.active_days.length > 0) {
      const day = now.getDay();
      if (!p.active_days.includes(day)) return false;
    }
    
    // Check happy hour time
    if (p.active_time_start && p.active_time_end) {
      const curHours = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
      if (curHours < p.active_time_start || curHours > p.active_time_end) {
        return false;
      }
    }

    // Check usage limit
    if (p.usage_limit && p.usage_count >= p.usage_limit) return false;

    return true;
  };

  // Line total calculation (clean standard multiplication)
  const getLineTotal = (item: CartItem) => {
    return item.qty * item.product.sell_price;
  };

  const getPriceUnitLabel = (p: Product) => {
    return p.base_unit || p.unit_type || "pcs";
  };

  // Pricing calculations with Promotion Engine
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + getLineTotal(item), 0);
  }, [cart]);

  const totalCartQty = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.qty, 0);
  }, [cart]);

  // Evaluate Auto Promotions if no manual promo is selected
  const effectivePromo = useMemo<Promotion | null>(() => {
    if (selectedPromo) {
      if (!isPromoCurrentlyValid(selectedPromo)) return null;
      if (selectedPromo.min_order_amount > 0 && subtotal < selectedPromo.min_order_amount) return null;
      if (selectedPromo.min_qty > 0 && totalCartQty < selectedPromo.min_qty) return null;

      if (selectedPromo.target_scope === "specific_items") {
        const hasMatchingItem = cart.some((c) => selectedPromo.target_ids?.includes(c.product.id));
        if (!hasMatchingItem) return null;
      } else if (selectedPromo.target_scope === "specific_categories") {
        const hasMatchingCat = cart.some((c) =>
          selectedPromo.target_ids?.includes(c.product.category_id || "") ||
          selectedPromo.target_ids?.includes(c.product.category || "")
        );
        if (!hasMatchingCat) return null;
      }
      return selectedPromo;
    }

    // Find first matching automatic promo
    const autoPromos = promotions.filter(
      (p) => p.promo_type === "automatic" && isPromoCurrentlyValid(p)
    );

    for (const p of autoPromos) {
      // Check min order amount and min qty
      if (p.min_order_amount > 0 && subtotal < p.min_order_amount) continue;
      if (p.min_qty > 0 && totalCartQty < p.min_qty) continue;

      // Check target scope
      if (p.target_scope === "entire_order") {
        return p;
      } else if (p.target_scope === "specific_items") {
        const hasMatchingItem = cart.some((c) => p.target_ids?.includes(c.product.id));
        if (hasMatchingItem) return p;
      } else if (p.target_scope === "specific_categories") {
        const hasMatchingCat = cart.some((c) =>
          p.target_ids?.includes(c.product.category_id || "") ||
          p.target_ids?.includes(c.product.category || "")
        );
        if (hasMatchingCat) return p;
      }
    }

    return null;
  }, [cart, subtotal, totalCartQty, selectedPromo, promotions]);

  // Calculate discount from effective promotion OR manual % input
  const discountAmount = useMemo(() => {
    if (effectivePromo) {
      let eligibleSubtotal = 0;
      if (effectivePromo.target_scope === "entire_order") {
        eligibleSubtotal = subtotal;
      } else if (effectivePromo.target_scope === "specific_items") {
        eligibleSubtotal = cart
          .filter((c) => effectivePromo.target_ids?.includes(c.product.id))
          .reduce((acc, item) => acc + getLineTotal(item), 0);
      } else if (effectivePromo.target_scope === "specific_categories") {
        eligibleSubtotal = cart
          .filter((c) =>
            effectivePromo.target_ids?.includes(c.product.category_id || "") ||
            effectivePromo.target_ids?.includes(c.product.category || "")
          )
          .reduce((acc, item) => acc + getLineTotal(item), 0);
      }

      if (eligibleSubtotal <= 0 && effectivePromo.target_scope !== "entire_order") {
        return 0;
      }

      let disc = 0;
      if (effectivePromo.reward_type === "discount_pct") {
        disc = eligibleSubtotal * (effectivePromo.reward_value / 100);
      } else if (effectivePromo.reward_type === "discount_fixed") {
        disc = effectivePromo.reward_value;
      }

      if (effectivePromo.max_discount_cap && disc > effectivePromo.max_discount_cap) {
        disc = effectivePromo.max_discount_cap;
      }
      return Math.min(disc, subtotal);
    }

    if (!enableDiscount || discountRate <= 0) return 0;
    return subtotal * (discountRate / 100);
  }, [subtotal, cart, effectivePromo, discountRate, enableDiscount]);

  const taxAmount = useMemo(() => {
    if (!enableTax || taxRate <= 0) return 0;
    return (subtotal - discountAmount) * (taxRate / 100);
  }, [subtotal, discountAmount, taxRate, enableTax]);

  const totalAmount = useMemo(() => {
    return Math.max(0, subtotal - discountAmount + taxAmount);
  }, [subtotal, discountAmount, taxAmount]);

  // Apply Coupon Code
  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCodeInput.trim()) return;

    const matched = promotions.find(
      (p) => (p.code || "").toUpperCase() === couponCodeInput.trim().toUpperCase() && isPromoCurrentlyValid(p)
    );

    if (!matched) {
      toast.error("Kode voucher tidak valid atau masa berlaku telah habis!");
      return;
    }

    if (matched.min_order_amount > 0 && subtotal < matched.min_order_amount) {
      toast.error(`Minimal belanja untuk kupon ini adalah Rp ${matched.min_order_amount.toLocaleString("id-ID")}`);
      return;
    }

    setSelectedPromo(matched);
    setShowPromoDrawer(false);
    setCouponCodeInput("");
    toast.success(`Kupon "${matched.name}" berhasil digunakan!`);
  };

  // Payment Confirmation (Hits API or stores offline)
  const handleConfirmPayment = async () => {
    if (cart.length === 0) return;
    
    // Validate cash received if paying with cash
    if (paymentMethod === "cash" && !isInternalTake && cashReceived < Math.round(totalAmount)) {
      toast.error(t.posInsufficientCash || "Uang yang diterima kurang dari total tagihan!");
      return;
    }

    setLoading(true);
    setShowPaymentModal(false);

    const clientUUID = crypto.randomUUID();
    const payload = {
      client_uuid: clientUUID,
      total_amount: Math.round(totalAmount),
      subtotal: Math.round(subtotal),
      discount_amount: Math.round(discountAmount),
      promotion_id: effectivePromo?.id || null,
      payment_method: paymentMethod,
      type: isInternalTake ? "internal_take" : "sale",
      items: cart.map((item) => ({
        product_id: item.product.id,
        qty: item.qty,
        promotion_id: effectivePromo?.id || null,
        discount_amount: effectivePromo?.target_scope === "specific_items" && effectivePromo.target_ids?.includes(item.product.id)
          ? Math.round(discountAmount)
          : 0,
      })),
    };

    try {
      const res = await api.post("/transactions", payload);
      setRecentTx([res.data, ...recentTx].slice(0, 5));
      setShowReceipt({
        ...res.data,
        subtotal,
        promoName: effectivePromo?.name,
        discountRate: effectivePromo?.reward_type === "discount_pct" ? effectivePromo.reward_value : discountRate,
        discountAmount,
        taxRate,
        taxAmount,
        totalAmount,
        cashReceived: paymentMethod === "cash" ? cashReceived : Math.round(totalAmount),
        changeDue: paymentMethod === "cash" ? Math.max(0, cashReceived - Math.round(totalAmount)) : 0,
        items: cart.map((c) => ({
          name: c.product.name,
          qty: c.qty,
          unit_price: c.product.sell_price,
          subtotal: Math.round(getLineTotal(c)),
        })),
      });
      setCart([]);
      setSelectedPromo(null);
      setIsInternalTake(false);
      setCashReceived(0);
      toast.success(t.posCheckoutSuccess || "Transaksi berhasil!");
      fetchProducts();
      fetchPromotions();
    } catch (err: any) {
      const isNetworkError = !err.response || err.code === "ERR_NETWORK";
      if (isNetworkError || !navigator.onLine) {
        try {
          await enqueueTransaction({
            client_uuid: clientUUID,
            business_id: activeContext?.business_id || "",
            outlet_id: activeContext?.outlet_id,
            type: isInternalTake ? "internal_take" : "sale",
            payload: payload,
          });

          const mockTx = {
            id: clientUUID,
            client_uuid: clientUUID,
            business_id: activeContext?.business_id,
            outlet_id: activeContext?.outlet_id,
            type: isInternalTake ? "internal_take" : "sale",
            total_amount: Math.round(totalAmount),
            payment_method: paymentMethod,
            status: "completed" as const,
            created_at: new Date().toISOString(),
          };

          setRecentTx([mockTx as any, ...recentTx].slice(0, 5));
          setShowReceipt({
            ...mockTx,
            subtotal,
            promoName: effectivePromo?.name,
            discountRate: effectivePromo?.reward_type === "discount_pct" ? effectivePromo.reward_value : discountRate,
            discountAmount,
            taxRate,
            taxAmount,
            totalAmount,
            cashReceived: paymentMethod === "cash" ? cashReceived : Math.round(totalAmount),
            changeDue: paymentMethod === "cash" ? Math.max(0, cashReceived - Math.round(totalAmount)) : 0,
            items: cart.map((c) => ({
              name: c.product.name,
              qty: c.qty,
              unit_price: c.product.sell_price,
              subtotal: Math.round(getLineTotal(c)),
            })),
          });
          setCart([]);
          setSelectedPromo(null);
          setIsInternalTake(false);
          setCashReceived(0);
          toast.success("Transaksi disimpan offline & akan disinkron saat online.");
          return;
        } catch (dbErr) {
          console.error("Failed to queue transaction offline:", dbErr);
        }
      }
      toast.error(err.response?.data?.message || "Gagal memproses transaksi");
    } finally {
      setLoading(false);
    }
  };

  // Handle Void
  const handleVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showVoidModal || !managerPin || managerPin.length < 6) {
      toast.error(t.posManagerPinRequired || "PIN Manager 6 digit wajib diisi");
      return;
    }

    setLoading(true);

    try {
      const target = recentTx.find((tx) => tx.id === showVoidModal);
      if (!target) throw new Error("Transaksi tidak ditemukan");

      const voidUUID = crypto.randomUUID();
      await api.post("/transactions", {
        client_uuid: voidUUID,
        total_amount: target.total_amount,
        payment_method: target.payment_method,
        type: "void",
        manager_pin: managerPin,
        reason: voidReason || "Void request",
        items: [],
      });

      setRecentTx(
        recentTx.map((tx) =>
          tx.id === target.id ? { ...tx, status: "voided" } : tx
        )
      );

      toast.success(t.posVoidSuccess || "Transaksi berhasil di-void!");
      setShowVoidModal(null);
      setManagerPin("");
      setVoidReason("");
      fetchProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || t.posVoidFailed || "Gagal memproses void");
    } finally {
      setLoading(false);
    }
  };

  // Settings & Pinned Items Hook
  const { pinnedItemIds, togglePinItem, isItemPinned } = usePOSSettings();

  // Dynamically Filter and Sort products (Pinned items always appear first)
  const filteredProducts = useMemo(() => {
    const list = (products || []).filter((p) => {
      const matchesSearch = 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = 
        activeCategory === "ALL_CATEGORY_KEY" || 
        activeCategory === "PINNED_CATEGORY_KEY" ||
        activeCategory === "All" ||
        activeCategory === "Semua" ||
        (p.category || "General") === activeCategory;

      if (activeCategory === "PINNED_CATEGORY_KEY") {
        return matchesSearch && pinnedItemIds.includes(p.id);
      }

      return matchesSearch && matchesCategory;
    });

    // Sort: Pinned items float to top, preserving relative ordering
    return list.sort((a, b) => {
      const aPinned = pinnedItemIds.includes(a.id);
      const bPinned = pinnedItemIds.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });
  }, [products, searchQuery, activeCategory, pinnedItemIds]);

  const pinnedCount = useMemo(() => {
    return (products || []).filter((p) => pinnedItemIds.includes(p.id)).length;
  }, [products, pinnedItemIds]);

  const categories = useMemo(() => {
    const unique = new Set((products || []).map((p) => p.category || "General"));
    const base = ["ALL_CATEGORY_KEY"];
    if (pinnedCount > 0) {
      base.push("PINNED_CATEGORY_KEY");
    }
    return [...base, ...Array.from(unique)];
  }, [products, pinnedCount]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { 
      ALL_CATEGORY_KEY: (products || []).length,
      PINNED_CATEGORY_KEY: pinnedCount
    };
    (products || []).forEach((p) => {
      const cat = p.category || "General";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [products, pinnedCount]);

  const gridColsClass = useMemo(() => {
    switch (gridCols) {
      case 3: return "lg:grid-cols-3";
      case 5: return "lg:grid-cols-5";
      case 6: return "lg:grid-cols-6";
      case 4:
      default:
        return "lg:grid-cols-4";
    }
  }, [gridCols]);

  if (loadingShift) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-brand-purple border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-slate-500 dark:text-slate-400 font-bold text-sm">
          {t.posCheckingShift || "Memeriksa status laci kasir..."}
        </span>
      </div>
    );
  }

  // Open Shift Form Layout
  if (!activeShift) {
    return (
      <div className={`max-w-md mx-auto border shadow-xl rounded-3xl p-8 text-center mt-10 transition-colors ${
        isDarkMode ? "bg-[#202024] border-[#38383C] text-white" : "bg-[#FFFFFF] border-slate-200/80 text-neutral-dark"
      }`}>
        <div className="w-16 h-16 rounded-2xl bg-brand-purple/10 dark:bg-primary/10 flex items-center justify-center mx-auto mb-4 text-brand-purple dark:text-primary">
          <KeyRound className="w-8 h-8 stroke-[2.2]" />
        </div>
        <h3 className="text-2xl font-bold mb-2">{t.posOpenShiftTitle || "Buka Shift Kasir"}</h3>
        <p className="opacity-75 text-xs font-semibold leading-relaxed mb-6">
          {t.posOpenShiftDesc || "Laci kasir saat ini terkunci. Anda harus membuka shift baru dan menginput nominal kas awal untuk memulai transaksi."}
        </p>

        <form onSubmit={handleOpenShift} className="space-y-5">
          <div className="text-left">
            <label className="block text-xs font-bold opacity-75 uppercase tracking-wider mb-2 ml-1">
              {t.posOpeningCashLabel || "Modal Awal Laci Kasir (Rupiah)"}
            </label>
            <CurrencyInput
              value={openingCash}
              onChange={(val) => setOpeningCash(val)}
              placeholder="150.000"
              className="text-center text-xl font-bold h-14 rounded-2xl"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center font-bold text-white bg-brand-purple hover:bg-brand-purple-hover dark:bg-[#E2FF66] dark:text-slate-900 rounded-2xl shadow-md transition-all duration-200 cursor-pointer text-sm h-14"
          >
            {loading ? (t.posOpeningShiftLoading || "Membuka Laci...") : (t.posStartShiftButton || "Mulai Shift Baru")}
          </button>
        </form>
      </div>
    );
  }

  // Active POS Screen Layout
  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden h-full gap-4 lg:gap-6 relative">
      
      {/* ================= LEFT SIDE: PRODUCTS GRID ================= */}
      <section className="flex-1 flex flex-col overflow-hidden space-y-3 lg:space-y-5 pb-16 lg:pb-0">

        {/* Top Header Row: Clean Frameless ErpSearchBar */}
        <ErpSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          onSubmit={handleBarcodeSubmit}
          placeholder={t.posSearchPlaceholder}
          inputRef={barcodeInputRef}
        />

        {/* Horizontal Minimalist Text Category Tabs with Custom Underline */}
        <div className="relative flex items-center w-full flex-shrink-0 border-b border-slate-200/80 dark:border-[#38383C] pt-1">
          <div 
            ref={categoryRef}
            className="flex-1 flex space-x-6 overflow-x-auto scrollbar-none scroll-smooth"
          >
            {categories.map((cat) => {
              const isCatActive = activeCategory === cat;
              const displayLabel = cat === "ALL_CATEGORY_KEY" 
                ? t.posAllCategories 
                : cat === "PINNED_CATEGORY_KEY" 
                ? (t.posPinnedBadge || "Disematkan") 
                : cat;
              const count = categoryCounts[cat] || 0;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`relative pb-2.5 pt-1 px-0.5 text-xs sm:text-sm transition-all cursor-pointer shrink-0 flex items-center space-x-2 select-none group ${
                    isCatActive
                      ? "text-slate-900 dark:text-white font-extrabold"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
                  }`}
                >
                  {cat === "PINNED_CATEGORY_KEY" && (
                    <Pin className="w-3.5 h-3.5 fill-amber-500 text-amber-500 shrink-0" />
                  )}
                  <span className="truncate max-w-[150px]">{displayLabel}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-black transition-colors ${
                    isCatActive
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "bg-slate-100 dark:bg-white/10 text-slate-400 dark:text-slate-500"
                  }`}>
                    {count}
                  </span>

                  {/* Active Custom Underline Indicator (Solid Black in Light Mode / Pure White in Dark Mode) */}
                  {isCatActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-slate-900 dark:bg-white rounded-full transition-all duration-200 shadow-2xs" />
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              categoryRef.current?.scrollBy({ left: 180, behavior: 'smooth' });
            }}
            className="hidden sm:flex shrink-0 p-1.5 ml-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            title="Scroll Kategori"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Choose Products Title and Grid */}
        <div className="flex-1 flex flex-col min-h-0 space-y-3.5">
          <div className="flex items-center justify-between flex-shrink-0">
            <h3 className="text-xs font-bold text-left uppercase tracking-wider opacity-80">Choose Products</h3>
            <span className="text-[11px] text-slate-400 font-medium">
              {filteredProducts.length} item
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin pb-4">
            {filteredProducts.length === 0 ? (
              <div className={`p-12 text-center border border-dashed rounded-3xl ${
                isDarkMode ? "border-dark-border-lighter text-slate-500" : "border-[#E8E4D9] text-slate-400"
              }`}>
                <Search className="w-8 h-8 mx-auto text-slate-400 mb-2 stroke-[2]" />
                <p className="text-xs font-semibold">Tidak ada produk yang cocok dengan filter</p>
              </div>
            ) : (
              <div className={`grid grid-cols-2 sm:grid-cols-3 ${gridColsClass} gap-2.5 sm:gap-4`}>
                {filteredProducts.map((p) => {
                  const isTracked = p.is_inventory_tracked !== false;
                  const shelfStock = p.qty_loose ?? p.current_stock ?? 0;
                  const warehouseStock = p.qty_sealed ?? 0;
                  const inStock = !isTracked || p.inventory_mode === "wet_infinite" || p.inventory_mode === "batch_thaw" || shelfStock > 0;
                  const isPinned = isItemPinned(p.id);
                  
                  return (
                    <div
                      key={p.id}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        handleOpenProductDetail(p);
                      }}
                      onTouchStart={() => handleTouchStartProduct(p)}
                      onTouchEnd={handleTouchEndProduct}
                      onTouchCancel={handleTouchEndProduct}
                      className="relative select-none"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (isLongPressTriggeredRef.current) return;
                          if (inStock) {
                            addToCart(p);
                          } else {
                            handleOpenProductDetail(p);
                          }
                        }}
                        className={`w-full h-full group relative flex flex-col justify-between overflow-hidden border rounded-2xl p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                          inStock ? "cursor-pointer" : "cursor-pointer border-amber-400/50 dark:border-amber-500/40"
                        } ${
                          isDarkMode
                            ? "bg-dark-card-lighter border-dark-border-lighter hover:border-primary/40"
                            : "bg-[#FFFFFF] border-light-border hover:border-brand-purple/40 text-neutral-dark"
                        }`}
                      >
                        {/* Quick Pin Toggle Button on hover / when pinned */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            const newlyPinned = togglePinItem(p.id);
                            if (newlyPinned) {
                              toast.success(
                                (t.posPinSuccess || '"{name}" berhasil disematkan ke posisi teratas!').replace("{name}", p.name)
                              );
                            } else {
                              toast.info(
                                (t.posUnpinSuccess || 'Sematan "{name}" telah dilepas.').replace("{name}", p.name)
                              );
                            }
                          }}
                          className={`absolute top-2 right-2 z-10 p-1.5 rounded-full backdrop-blur-md transition-all cursor-pointer shadow-xs ${
                            isPinned
                              ? "bg-amber-500 text-white opacity-100 scale-100 ring-2 ring-white/50 dark:ring-black/50"
                              : "bg-black/30 text-white opacity-0 group-hover:opacity-100 hover:bg-black/60 scale-95 hover:scale-105"
                          }`}
                          title={isPinned ? (t.posUnpinItem || "Lepas Sematan (Unpin)") : (t.posPinItem || "Sematkan Produk (Pin ke Atas)")}
                        >
                          <Pin className={`w-3.5 h-3.5 ${isPinned ? "fill-white" : ""}`} />
                        </div>

                        {/* aspect ratio 4/3 ErpImage with fallbacks */}
                        <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 dark:bg-white/5 mb-2 relative">
                          <ErpImage
                            src={p.image_url}
                            alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          {!inStock && (
                            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-1 text-center">
                              <span className="text-[9px] text-white font-extrabold bg-amber-600 px-2 py-0.5 rounded-full mb-0.5">RAK KOSONG</span>
                              {warehouseStock > 0 ? (
                                <span className="text-[8px] text-amber-200 font-bold leading-tight">Gudang: {warehouseStock} {p.box_unit || "Dus"}</span>
                              ) : (
                                <span className="text-[8px] text-red-300 font-bold leading-tight">Stok Habis</span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <h4 className="font-bold text-xs leading-tight line-clamp-2 mb-1 dark:text-white">{p.name}</h4>
                            <div className="flex items-center justify-between text-[9px] opacity-60 mb-1">
                              <span>SKU: {p.sku || "-"}</span>
                            </div>

                            {/* Stock Display Badge */}
                            {!isTracked ? (
                              <div className="flex items-center text-[9px] mt-0.5">
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-md">
                                  {language === "id" ? "♾️ Tanpa Lacak Stok" : "♾️ Untracked Stock"}
                                </span>
                              </div>
                            ) : (p.inventory_mode === "dry_strict" || p.inventory_mode === "batch_thaw") && (
                              <div className="flex items-center justify-between text-[9px] mt-0.5">
                                <span className={`font-bold ${
                                  shelfStock <= 0 
                                    ? "text-red-500 font-black" 
                                    : shelfStock < 5 
                                      ? "text-amber-500 font-bold" 
                                      : "text-slate-600 dark:text-slate-400"
                                }`}>
                                  Stok: {shelfStock} {p.base_unit || p.unit_type}
                                </span>

                                {warehouseStock > 0 && (
                                  <span className="text-purple-600 dark:text-purple-400 font-extrabold text-[8px] bg-purple-50 dark:bg-purple-950/40 px-1 py-0.2 rounded">
                                    +{warehouseStock} {p.box_unit || "Dus"}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-dashed border-light-border/60 dark:border-dark-border-lighter">
                            <span className="text-xs font-bold text-brand-purple dark:text-primary">
                              Rp {p.sell_price.toLocaleString("id-ID")}
                              <span className="text-[10px] font-normal text-slate-400 dark:text-slate-400">/{getPriceUnitLabel(p)}</span>
                            </span>
                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${
                              inStock 
                                ? "bg-brand-purple/10 text-brand-purple group-hover:bg-brand-purple group-hover:text-white dark:group-hover:bg-primary dark:group-hover:text-neutral-dark dark:text-primary"
                                : "bg-amber-500/20 text-amber-700 dark:text-amber-300 group-hover:bg-amber-500 group-hover:text-white"
                            }`}>
                              {inStock ? "+" : <ArrowDownToDot className="w-3.5 h-3.5" />}
                            </span>
                          </div>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ================= RIGHT SIDE: BASKET & BILL ================= */}
      <aside className="hidden lg:flex w-[380px] xl:w-[420px] flex-col justify-between overflow-hidden shrink-0 space-y-4">
        
        {/* Shopping Basket List Card */}
        <div className={`flex-1 flex flex-col overflow-hidden p-4.5 rounded-3xl border transition-colors ${
          isDarkMode ? "bg-dark-card-lighter border-dark-border-lighter text-white" : "bg-[#FFFFFF] border-light-border shadow-sm"
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800/40 mb-3.5">
            <div>
              <h3 className="font-bold text-sm text-neutral-dark dark:text-white">{t.posCartTitle}</h3>
              <p className="text-[10px] opacity-60">Item: {cart.length}</p>
            </div>
            <div className="flex items-center space-x-2">
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="p-2 text-red-500 hover:text-red-600 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-all cursor-pointer"
                  title={t.posEmptyCartTooltip}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* List area */}
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 scrollbar-thin">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-20 text-center text-slate-400">
                <ShoppingCart className="w-8 h-8 mb-2 text-slate-400 stroke-[2]" />
                <p className="text-xs font-bold">{t.posCartEmptyTitle}</p>
                <p className="text-[10px] opacity-60 max-w-[200px] mt-1">{t.posCartEmptyDesc}</p>
              </div>
            ) : (
              cart.map((item, idx) => {
                const isSelected = selectedCartIndex === idx;
                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedCartIndex(idx)}
                    className={`p-2.5 rounded-2xl border transition-all duration-150 flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? isDarkMode
                          ? "border-primary bg-primary/10 text-white"
                          : "border-brand-purple bg-brand-purple/5 text-neutral-dark"
                        : isDarkMode
                          ? "border-transparent bg-dark-border-lighter/30 hover:bg-dark-border-lighter/60 text-white"
                          : "border-transparent bg-slate-50/50 hover:bg-slate-50 text-neutral-dark"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-white/5">
                        <ErpImage src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-[11px] leading-tight truncate">{item.product.name}</h4>
                        <p className="text-[9px] opacity-60">SKU: {item.product.sku || "-"}</p>
                        
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            isDarkMode ? "bg-dark-border-lighter" : "bg-slate-100"
                          }`}>
                            Unit: {item.product.base_unit || item.product.unit_type}
                          </span>
                          
                          {showNumpad ? (
                            <span className="text-[9px] opacity-75 font-semibold text-brand-purple dark:text-primary">
                              Qty: {item.qty} {item.product.base_unit || item.product.unit_type}
                            </span>
                          ) : (
                            <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => updateQty(idx, -1)}
                                className={`w-4.5 h-4.5 rounded flex items-center justify-center font-bold text-[10px] transition-colors cursor-pointer ${
                                  isDarkMode ? "bg-dark-border-lighter hover:bg-[#404040] text-white" : "bg-slate-100 hover:bg-slate-200"
                                }`}
                              >
                                -
                              </button>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={transientQty[idx] !== undefined ? transientQty[idx] : item.qty}
                                onChange={(e) => handleQtyInputChange(idx, e.target.value)}
                                onBlur={() => handleQtyInputBlur(idx)}
                                className={`w-10 px-1 py-0 rounded border text-center font-bold text-[9px] focus:outline-none focus:ring-1 focus:ring-brand-purple no-spinner ${
                                  isDarkMode ? "bg-dark-card-lighter border-dark-border-lighter text-white" : "bg-white border-light-border"
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => updateQty(idx, 1)}
                                className={`w-4.5 h-4.5 rounded flex items-center justify-center font-bold text-[10px] transition-colors cursor-pointer ${
                                  isDarkMode ? "bg-dark-border-lighter hover:bg-[#404040] text-white" : "bg-slate-100 hover:bg-slate-200"
                                }`}
                              >
                                +
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end justify-between ml-2 h-9">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromCart(idx);
                        }}
                        className="text-slate-400 hover:text-red-500 text-xs font-bold"
                      >
                        ✕
                      </button>
                      <span className="font-bold text-[11px]">
                        Rp {Math.round(getLineTotal(item)).toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Subtotal, Numpad & Payment Actions Card */}
        <div className={`p-4 rounded-3xl border space-y-3.5 shrink-0 transition-colors ${
          isDarkMode ? "bg-dark-card-lighter border-dark-border-lighter text-white" : "bg-[#FFFFFF] border-light-border shadow-sm"
        }`}>
          {/* Active Promo / Voucher Selector */}
          <div className="flex items-center justify-between pb-2 border-b border-light-border/60 dark:border-dark-border-lighter">
            <button
              type="button"
              onClick={() => setShowPromoDrawer(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-brand-purple dark:text-primary hover:opacity-80 transition-opacity cursor-pointer"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>{effectivePromo ? effectivePromo.name : (t.posSelectPromo || "Pilih Promo / Kupon")}</span>
            </button>
            {effectivePromo ? (
              <button
                type="button"
                onClick={() => setSelectedPromo(null)}
                className="text-[10px] text-red-500 hover:underline font-semibold cursor-pointer"
              >
                ✕ {t.posRemovePromo || "Batal"}
              </button>
            ) : (
              <span className="text-[10px] text-slate-400 font-medium">
                {promotions.filter(isPromoCurrentlyValid).length} {language === "id" ? "Tersedia" : "Available"}
              </span>
            )}
          </div>

          {/* Pricing breakdown */}
          <div className="space-y-1.5 py-1 text-xs">
            <div className="flex justify-between opacity-75">
              <span>{t.posSubtotal}</span>
              <span>Rp {subtotal.toLocaleString("id-ID")}</span>
            </div>

            {effectivePromo && discountAmount > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-primary font-bold">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{effectivePromo.name}</span>
                </div>
                <span>- Rp {Math.round(discountAmount).toLocaleString("id-ID")}</span>
              </div>
            )}

            {!effectivePromo && enableDiscount && (
              <div className="flex justify-between text-emerald-600 dark:text-primary">
                <div className="flex items-center gap-1.5">
                  <span>{t.posDiscount}</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={discountRate}
                    onChange={(e) => setDiscountRate(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                    className={`w-11 px-1 py-0.5 rounded text-center font-bold text-[10px] border focus:outline-none focus:ring-1 focus:ring-emerald-500 no-spinner ${
                      isDarkMode ? "bg-dark-card-lighter border-dark-border-lighter text-white" : "bg-white border-light-border"
                    }`}
                  />
                  <span>%</span>
                </div>
                <span>- Rp {discountAmount.toLocaleString("id-ID")}</span>
              </div>
            )}

            {enableTax && (
              <div className="flex justify-between text-amber-500">
                <div className="flex items-center gap-1.5">
                  <span>{t.posTax}</span>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={taxRate}
                    onChange={(e) => setTaxRate(Math.max(0, Math.min(50, Number(e.target.value) || 0)))}
                    className={`w-11 px-1 py-0.5 rounded text-center font-bold text-[10px] border focus:outline-none focus:ring-1 focus:ring-amber-500 no-spinner ${
                      isDarkMode ? "bg-dark-card-lighter border-dark-border-lighter text-white" : "bg-white border-light-border"
                    }`}
                  />
                  <span>%</span>
                </div>
                <span>Rp {taxAmount.toLocaleString("id-ID")}</span>
              </div>
            )}

            <div className={`flex justify-between items-center text-sm font-bold pt-1.5 border-t border-dashed border-light-border text-brand-purple dark:text-primary`}>
              <span>{t.posTotalPayment}</span>
              <span>Rp {Math.round(totalAmount).toLocaleString("id-ID")}</span>
            </div>
          </div>

          {showNumpad ? (
            <>
              {/* Numpad Mode Tabs */}
              <div className="flex bg-[#F3EFE4] dark:bg-[#1E1E1E] p-0.5 rounded-full gap-0.5">
                {[
                  { id: "qty", label: t.posQtyTab, show: true },
                  { id: "discount", label: t.posDiscountTab, show: enableDiscount },
                  { id: "tax", label: t.posTaxTab, show: enableTax }
                ]
                  .filter((m) => m.show)
                  .map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setNumpadMode(mode.id as any)}
                      className={`flex-1 py-1.5 text-[10px] font-bold rounded-full transition-all cursor-pointer ${
                        numpadMode === mode.id
                          ? "bg-brand-purple text-white shadow-sm"
                          : "text-muted-foreground hover:text-neutral-dark dark:hover:text-white"
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
              </div>

              {/* 3x4 Modern Touch Numpad Grid */}
              <div className="grid grid-cols-4 grid-rows-3 gap-1.5 h-38">
                {["1", "2", "3", "+", "4", "5", "6", "-", "7", "8", "9", "C", "0", "."].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleNumpadPress(val)}
                    className={`rounded-xl border font-bold text-sm transition-all duration-150 active:scale-95 cursor-pointer flex items-center justify-center ${
                      val === "C"
                        ? "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20"
                        : val === "+" || val === "-"
                        ? "bg-brand-purple/10 dark:bg-primary/10 text-brand-purple dark:text-primary border-brand-purple/20 dark:border-primary/20 font-extrabold"
                        : isDarkMode
                        ? "bg-dark-border-lighter/40 border-transparent text-white hover:bg-dark-border-lighter"
                        : "bg-slate-50 border-slate-200 text-neutral-dark hover:bg-slate-100"
                    }`}
                  >
                    {val}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setShowPaymentModal(true)}
                  disabled={cart.length === 0 || loading}
                  className="col-span-2 row-span-1 p-2.5 bg-brand-purple hover:bg-brand-purple-hover disabled:bg-dark-border-lighter/40 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center text-xs"
                >
                  {t.posPayButton}
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowPaymentModal(true)}
              disabled={cart.length === 0 || loading}
              className="w-full py-3.5 bg-brand-purple hover:bg-brand-purple-hover disabled:bg-dark-border-lighter/40 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center text-xs"
            >
              {t.posPayButton}
            </button>
          )}

          {/* Quick link to Open Shift Transaction History Drawer */}
          <button
            type="button"
            onClick={() => setShowHistoryDrawer(true)}
            className="w-full pt-1 pb-0.5 text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-primary flex items-center justify-between px-1.5 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-brand-purple dark:text-primary" />
              <span>{t.posHistoryLink}</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </aside>

      {/* =========================================================================
          MODALS & OVERLAYS SECTION
          ========================================================================= */}

      {/* 1. Close Shift Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-neutral-dark">
          <div className={`w-full max-w-md border rounded-3xl p-6 shadow-2xl transition-all ${
            isDarkMode ? "bg-[#202024] border-[#38383C] text-white" : "bg-[#FFFFFF] border-slate-200/80 text-neutral-dark"
          }`}>
            <h3 className="text-lg font-bold mb-1 dark:text-white">{t.posCloseShift}</h3>
            <p className="opacity-75 text-xs font-semibold leading-relaxed mb-6">
              {language === "id" 
                ? "Hitung total fisik uang tunai di laci kasir saat ini untuk proses rekonsiliasi akhir sesi."
                : "Count total physical cash inside the register drawer for end-of-session reconciliation."}
            </p>

            <form onSubmit={handleCloseShift} className="space-y-5">
              <div className="text-left">
                <label className="block text-xs font-bold opacity-75 uppercase tracking-wider mb-2 ml-1">
                  {t.posActualCash || "Kas Akhir Dihitung (Rupiah)"}
                </label>
                <CurrencyInput
                  value={closingCashActual}
                  onChange={(val) => setClosingCashActual(val)}
                  placeholder="0"
                  className="text-center text-xl font-bold h-14 rounded-2xl"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="flex-1 py-3 text-xs font-bold border border-slate-200 dark:border-[#38383C] hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all cursor-pointer dark:text-white"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 text-xs font-bold bg-brand-purple text-white hover:bg-brand-purple-hover dark:bg-[#E2FF66] dark:text-slate-900 rounded-xl transition-all cursor-pointer shadow-md"
                >
                  {loading ? t.saving : t.posConfirmCloseShift}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Manager Override / Void Transaction Modal */}
      {showVoidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-neutral-dark">
          <div className={`w-full max-w-md border rounded-3xl p-6 shadow-2xl transition-all ${
            isDarkMode ? "bg-[#202024] border-[#38383C] text-white" : "bg-white border-slate-200/80"
          }`}>
            <h3 className="text-lg font-bold mb-1 text-red-500">{t.posVoidModalTitle}</h3>
            <p className="opacity-75 text-xs font-semibold leading-relaxed mb-5">
              {t.posManagerPinRequired}
            </p>

            <form onSubmit={handleVoid} className="space-y-4">
              <div className="flex flex-col items-center">
                <label className="block text-[10px] font-bold opacity-75 uppercase tracking-wider mb-2 self-start">
                  {t.posVoidManagerPin} (6-Digit)
                </label>
                <InputOTP
                  maxLength={6}
                  value={managerPin}
                  onChange={(val) => setManagerPin(val)}
                  containerClassName="justify-center"
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <div>
                <label className="block text-[10px] font-bold opacity-75 uppercase tracking-wider mb-1 text-left">
                  {t.posVoidReason}
                </label>
                <input
                  type="text"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder={t.posVoidPlaceholder}
                  className={`w-full text-xs px-4 py-3 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-all ${
                    isDarkMode ? "bg-[#1A1A1E] border-[#38383C] text-white" : "bg-slate-50 border-slate-200"
                  }`}
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowVoidModal(null);
                    setManagerPin("");
                    setVoidReason("");
                  }}
                  className="flex-1 py-3 text-xs font-bold border border-slate-200 dark:border-[#38383C] hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all cursor-pointer dark:text-white"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={loading || managerPin.length < 6}
                  className="flex-1 py-3 text-xs font-bold bg-red-600 text-white hover:bg-red-700 rounded-xl transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? t.saving : t.posVoidConfirm}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Checkout Payment Selection Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-neutral-dark">
          <div className={`w-full max-w-md border rounded-3xl p-6 shadow-2xl transition-all ${
            isDarkMode ? "bg-dark-card-lighter border-dark-border-lighter text-white" : "bg-[#FFFFFF] border-light-border"
          }`}>
            
            <div className="pb-4 border-b border-dashed border-light-border dark:border-dark-border-lighter mb-5">
              <h3 className="text-lg font-bold dark:text-white">{t.posPaymentModalTitle}</h3>
              <p className="text-xs text-muted-foreground">
                {language === "id" ? "Tentukan tipe transaksi dan metode pembayaran" : "Specify transaction type and payment method"}
              </p>
            </div>

            <div className="space-y-4 text-sm">
              {/* Type selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold opacity-75 uppercase tracking-wider block text-left">
                  {language === "id" ? "Tipe Transaksi" : "Transaction Type"}
                </label>
                <div className="flex bg-[#F3EFE4] dark:bg-[#1E1E1E] p-1 rounded-full gap-1">
                  <button
                    type="button"
                    onClick={() => setIsInternalTake(false)}
                    className={`flex-1 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
                      !isInternalTake
                        ? "bg-brand-purple text-white shadow-sm"
                        : "text-muted-foreground hover:text-neutral-dark dark:hover:text-white"
                    }`}
                  >
                    {language === "id" ? "Sales (Pelanggan)" : "Customer Sale"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsInternalTake(true)}
                    className={`flex-1 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
                      isInternalTake
                        ? "bg-brand-purple text-white shadow-sm"
                        : "text-muted-foreground hover:text-neutral-dark dark:hover:text-white"
                    }`}
                  >
                    {language === "id" ? "Konsumsi Internal" : "Internal Take"}
                  </button>
                </div>
              </div>

              {/* Payment Methods */}
              {!isInternalTake && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold opacity-75 uppercase tracking-wider block text-left">
                      {t.posReceiptPaymentMethod || "Metode Pembayaran"}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "cash", label: t.posCashMethod },
                        { id: "qris", label: t.posQrisMethod },
                        { id: "other", label: t.posOtherMethod || "Lainnya" }
                      ].map((method) => {
                        const isSelected = paymentMethod === method.id;
                        return (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() => {
                              setPaymentMethod(method.id as any);
                              if (method.id === "cash" && cashReceived === 0) {
                                setCashReceived(Math.round(totalAmount));
                              }
                            }}
                            className={`p-3 rounded-2xl border text-center font-bold text-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                              isSelected
                                ? isDarkMode
                                  ? "bg-primary/15 border-primary text-primary"
                                  : "bg-brand-purple/10 border-brand-purple text-brand-purple"
                                : isDarkMode
                                  ? "bg-[#1E1E22] border-transparent text-[#94A3B8] hover:bg-[#28282C]"
                                  : "bg-slate-50 border-slate-200 text-neutral-dark hover:bg-slate-100"
                            }`}
                          >
                            <CreditCard className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{method.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Cash Details: Quick Cash Buttons & Change Due */}
                  {paymentMethod === "cash" && (
                    <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-[#38383C] bg-slate-50/70 dark:bg-[#1E1E22]/60 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold opacity-75 uppercase tracking-wider">
                          {t.posCashReceived || "Uang Diterima (Cash)"}
                        </label>
                        <button
                          type="button"
                          onClick={() => setCashReceived(Math.round(totalAmount))}
                          className="text-[10px] font-bold text-brand-purple dark:text-primary hover:underline cursor-pointer"
                        >
                          {t.posCashExact || "Uang Pas"}
                        </button>
                      </div>

                      <CurrencyInput
                        value={cashReceived}
                        onChange={(val) => setCashReceived(val)}
                        placeholder="0"
                        className="text-center font-bold text-lg h-12 rounded-xl"
                      />

                      {/* Quick Cash Presets */}
                      <div className="grid grid-cols-4 gap-1.5 pt-1">
                        {[
                          Math.round(totalAmount),
                          Math.ceil(Math.round(totalAmount) / 10000) * 10000,
                          Math.ceil(Math.round(totalAmount) / 50000) * 50000,
                          Math.ceil(Math.round(totalAmount) / 100000) * 100000
                        ]
                          .filter((val, index, self) => val > 0 && self.indexOf(val) === index)
                          .slice(0, 4)
                          .map((preset, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setCashReceived(preset)}
                              className="py-1.5 px-1 bg-white dark:bg-[#28282C] border border-slate-200 dark:border-[#38383C] rounded-lg text-[10px] font-bold hover:border-brand-purple dark:hover:border-primary transition-all cursor-pointer truncate"
                            >
                              {preset === Math.round(totalAmount) ? "Pas" : `Rp ${preset.toLocaleString("id-ID")}`}
                            </button>
                          ))}
                      </div>

                      {/* Change breakdown */}
                      <div className="flex items-center justify-between pt-2 border-t border-dashed border-slate-200 dark:border-[#38383C] text-xs font-bold">
                        <span className="text-slate-500 dark:text-slate-400">{t.posChangeDue || "Kembalian"}:</span>
                        <span className={`text-sm ${
                          cashReceived >= Math.round(totalAmount)
                            ? "text-emerald-600 dark:text-primary"
                            : "text-red-500"
                        }`}>
                          Rp {Math.max(0, cashReceived - Math.round(totalAmount)).toLocaleString("id-ID")}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Payment Modal Summary */}
              <div className={`p-4 rounded-2xl text-xs space-y-2 font-semibold ${
                isDarkMode ? "bg-[#1E1E22] text-white" : "bg-[#F3EFE4] text-neutral-dark"
              }`}>
                <div className="flex justify-between">
                  <span className="opacity-75">{t.posTotalItemsLabel || "Total Produk:"}</span>
                  <span>{cart.reduce((sum, item) => sum + item.qty, 0)} {t.posUnit}</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-dashed border-slate-300 dark:border-slate-700 text-brand-purple dark:text-primary">
                  <span>{t.posTotalPayment}</span>
                  <span>Rp {Math.round(totalAmount).toLocaleString("id-ID")}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 py-3 text-xs font-bold border border-slate-200 dark:border-[#38383C] hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all cursor-pointer dark:text-white"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                className="flex-1 py-3 text-xs font-bold bg-brand-purple text-white hover:bg-brand-purple-hover dark:bg-[#E2FF66] dark:text-slate-900 rounded-xl transition-all cursor-pointer shadow-md"
              >
                {t.posProcessPayment}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 4. Checkout Success Modal / Print Receipt Overlay */}
      {showReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-neutral-dark">
          <div className={`w-full max-w-md border rounded-3xl p-6 shadow-2xl transition-all ${
            isDarkMode ? "bg-dark-card-lighter border-dark-border-lighter text-white" : "bg-[#FFFFFF] border-light-border"
          }`}>
            <div className="text-center space-y-2.5 mb-5">
              <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto animate-bounce" />
              <h3 className="text-lg font-bold dark:text-white">{t.posCheckoutSuccess}</h3>
              <p className="text-[10px] text-muted-foreground truncate">{t.posTransactionId}: {showReceipt.id}</p>
            </div>

            {/* Receipt Monospace Card */}
            <div className="space-y-3.5 text-xs font-mono border-t border-b border-dashed border-slate-200 dark:border-[#38383C] py-3.5 my-3.5 max-h-[260px] overflow-y-auto dark:text-white">
              <div className="flex justify-between opacity-75">
                <span>{t.posReceiptDate}:</span>
                <span>{new Date(showReceipt.created_at).toLocaleString(language === "id" ? "id-ID" : "en-US")}</span>
              </div>
              <div className="flex justify-between opacity-75">
                <span>{t.posReceiptType}:</span>
                <span className="font-bold text-amber-500 uppercase">{showReceipt.type}</span>
              </div>
              <div className="flex justify-between opacity-75">
                <span>{t.posReceiptPaymentMethod}:</span>
                <span className="font-bold text-brand-purple dark:text-primary uppercase">{showReceipt.payment_method}</span>
              </div>
              
              <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-[#38383C]">
                {showReceipt.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-[11px]">
                    <span className="truncate max-w-[70%]">{item.name} (x{item.qty})</span>
                    <span>Rp {item.subtotal.toLocaleString("id-ID")}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-[#38383C] font-semibold">
                <div className="flex justify-between">
                  <span>{t.posSubtotal}:</span>
                  <span>Rp {showReceipt.subtotal?.toLocaleString("id-ID") || "0"}</span>
                </div>
                {showReceipt.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>{t.posDiscount} ({showReceipt.discountRate || 0}%):</span>
                    <span>-Rp {showReceipt.discountAmount?.toLocaleString("id-ID")}</span>
                  </div>
                )}
                {showReceipt.taxAmount > 0 && (
                  <div className="flex justify-between text-amber-500">
                    <span>{t.posTax} ({showReceipt.taxRate || 0}%):</span>
                    <span>Rp {showReceipt.taxAmount?.toLocaleString("id-ID")}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-slate-200 dark:border-[#38383C] text-brand-purple dark:text-primary">
                  <span>{t.posReceiptTotalBill}:</span>
                  <span>Rp {Math.round(showReceipt.totalAmount || showReceipt.total_amount).toLocaleString("id-ID")}</span>
                </div>
                {showReceipt.payment_method === "cash" && (
                  <>
                    <div className="flex justify-between text-[11px] pt-1 opacity-80">
                      <span>{t.posCashReceived}:</span>
                      <span>Rp {(showReceipt.cashReceived || showReceipt.total_amount).toLocaleString("id-ID")}</span>
                    </div>
                    <div className="flex justify-between text-[11px] font-bold text-emerald-600 dark:text-primary">
                      <span>{t.posChangeDue}:</span>
                      <span>Rp {(showReceipt.changeDue || 0).toLocaleString("id-ID")}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Receipt Modal Footer Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  toast.success(t.posReceiptPrinted || "Struk nota berhasil dicetak!");
                }}
                className="flex-1 py-3 text-xs font-bold border border-slate-200 dark:border-[#38383C] hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all cursor-pointer dark:text-white flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{t.posPrintReceipt}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowReceipt(null)}
                className="flex-1 py-3 text-xs font-bold bg-brand-purple text-white hover:bg-brand-purple-hover dark:bg-[#E2FF66] dark:text-slate-900 rounded-xl transition-all cursor-pointer shadow-md"
              >
                {t.posNewTransaction}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 5. Shift Transaction History Drawer */}
      <TransactionHistoryDrawer
        open={showHistoryDrawer}
        onOpenChange={setShowHistoryDrawer}
        onReprintReceipt={handleReprintReceipt}
      />

      {/* 6. Mobile Cart Bottom Sheet Drawer (Fixed Bottom Anchored with 80% Expand, Always Visible on Mobile) */}
      <>
        {/* Backdrop Overlay when expanded */}
        {isMobileCartExpanded && (
          <div
            onClick={() => setIsMobileCartExpanded(false)}
            className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          />
        )}

        {/* Bottom Sheet Drawer Container */}
        <div
          onTouchStart={handleCartTouchStart}
          onTouchEnd={handleCartTouchEnd}
          className={`lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#202024] border-t border-slate-200 dark:border-[#38383C] rounded-t-[28px] shadow-[0_-8px_30px_rgba(0,0,0,0.18)] flex flex-col transition-all duration-300 ease-out overflow-hidden ${
            isMobileCartExpanded ? "h-[80vh] max-h-[85vh]" : "h-[76px]"
          }`}
        >
          {/* Top Drag Handle Pill */}
          <div
            onClick={() => setIsMobileCartExpanded(!isMobileCartExpanded)}
            className="w-full pt-2.5 pb-1 cursor-pointer flex items-center justify-center shrink-0 touch-none"
          >
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
          </div>

          <div className="flex-1 flex flex-col overflow-hidden px-4 pb-4 space-y-3">
            {/* Peek Header (Visible both when collapsed & expanded) */}
            <div
              onClick={() => setIsMobileCartExpanded(!isMobileCartExpanded)}
              className="flex items-center justify-between cursor-pointer select-none pb-2.5 border-b border-slate-100 dark:border-slate-800/80 shrink-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-brand-purple/10 dark:bg-primary/10 flex items-center justify-center font-extrabold text-xs text-brand-purple dark:text-primary shrink-0">
                  {cart.reduce((sum, item) => sum + item.qty, 0)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black text-neutral-dark dark:text-white truncate">
                    Rp {Math.round(totalAmount).toLocaleString("id-ID")}
                  </div>
                  <div className="text-[10px] opacity-75 font-semibold text-slate-500 dark:text-slate-400 truncate">
                    {cart.length > 0
                      ? `${cart.reduce((sum, item) => sum + item.qty, 0)} ${language === "id" ? "Item Belanjaan" : "Items"} (${cart.length} SKU)`
                      : (language === "id" ? "Keranjang Kosong" : "Empty Cart")}
                  </div>
                </div>
              </div>

              {/* Right side: Reset Cart Button (Visible when cart has items) */}
              <div className="flex items-center space-x-1.5 shrink-0">
                {cart.length > 0 ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCart([]);
                      setIsMobileCartExpanded(false);
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 text-red-500 hover:text-red-600 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-all cursor-pointer text-xs font-bold"
                    title={t.posEmptyCartTooltip}
                  >
                    <Trash2 className="w-3.5 h-3.5 stroke-[2]" />
                    <span>Reset</span>
                  </button>
                ) : (
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 px-2.5 py-1 bg-slate-100 dark:bg-white/5 rounded-lg">
                    {language === "id" ? "Pilih Produk" : "Select Product"}
                  </span>
                )}
              </div>
            </div>

            {/* Expanded Content: Item List & Checkout Action (Only visible when expanded) */}
            {isMobileCartExpanded && (
              <>
                {cart.length === 0 ? (
                  <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center p-6 space-y-2">
                    <ShoppingCart className="w-12 h-12 text-slate-300 dark:text-slate-600 stroke-[1.5]" />
                    <p className="font-bold text-sm text-slate-600 dark:text-slate-300">
                      {language === "id" ? "Keranjang Masih Kosong" : "Cart is Empty"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {language === "id" ? "Pilih produk di atas untuk menambahkan ke keranjang" : "Select products above to add to cart"}
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 py-1 scrollbar-thin">
                    {cart.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                          isDarkMode ? "border-dark-border-lighter bg-dark-card-lighter/60 text-white" : "border-slate-200 bg-slate-50 text-neutral-dark"
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-slate-100 dark:bg-white/5">
                            <ErpImage src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-xs leading-tight truncate">{item.product.name}</h4>
                            <span className="text-[10px] opacity-75 font-semibold text-brand-purple dark:text-primary">
                              Rp {Math.round(getLineTotal(item)).toLocaleString("id-ID")}{" "}
                              <span className="text-slate-400 font-normal">
                                ({item.qty} {item.product.base_unit || item.product.unit_type} @ Rp {item.product.sell_price.toLocaleString("id-ID")}/{getPriceUnitLabel(item.product)})
                              </span>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5 ml-2">
                          <button
                            type="button"
                            onClick={() => updateQty(idx, -1)}
                            className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-white/10 font-bold text-xs flex items-center justify-center cursor-pointer"
                          >
                            -
                          </button>
                          <span className="w-6 text-center text-xs font-extrabold">{item.qty}</span>
                          <button
                            type="button"
                            onClick={() => updateQty(idx, 1)}
                            className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-white/10 font-bold text-xs flex items-center justify-center cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Sticky Action Footer */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5 shrink-0">
                  {/* Mobile Active Promo / Voucher Selector */}
                  <div className="flex items-center justify-between pb-1">
                    <button
                      type="button"
                      onClick={() => setShowPromoDrawer(true)}
                      className="flex items-center gap-1.5 text-xs font-bold text-brand-purple dark:text-primary hover:opacity-80 transition-opacity cursor-pointer"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>{effectivePromo ? effectivePromo.name : (t.posSelectPromo || "Pilih Promo / Kupon")}</span>
                    </button>
                    {effectivePromo ? (
                      <button
                        type="button"
                        onClick={() => setSelectedPromo(null)}
                        className="text-[10px] text-red-500 hover:underline font-semibold cursor-pointer"
                      >
                        ✕ {t.posRemovePromo || "Batal"}
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium">
                        {promotions.filter(isPromoCurrentlyValid).length} {language === "id" ? "Tersedia" : "Available"}
                      </span>
                    )}
                  </div>

                  {effectivePromo && discountAmount > 0 && (
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-primary">
                      <span>{language === "id" ? "Potongan Promo:" : "Promo Discount:"}</span>
                      <span>- Rp {Math.round(discountAmount).toLocaleString("id-ID")}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm font-extrabold">
                    <span>{t.posTotalPayment}</span>
                    <span className="text-brand-purple dark:text-primary text-base">
                      Rp {Math.round(totalAmount).toLocaleString("id-ID")}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (cart.length === 0) return;
                      setIsMobileCartExpanded(false);
                      setShowPaymentModal(true);
                    }}
                    disabled={cart.length === 0}
                    className="w-full py-3.5 bg-brand-purple hover:bg-brand-purple-hover text-white dark:bg-primary dark:text-neutral-dark font-extrabold text-sm rounded-2xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-4 h-4 stroke-[2.5]" />
                    <span>
                      {cart.length > 0 
                        ? `Bayar Sekarang (Rp ${Math.round(totalAmount).toLocaleString("id-ID")})` 
                        : (language === "id" ? "Keranjang Kosong" : "Cart Empty")}
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </>

      {/* 7. Single Product Detail & Unbox Drawer */}
      <Drawer
        open={!!selectedProductForDetail}
        onOpenChange={(open) => !open && setSelectedProductForDetail(null)}
        direction="right"
      >
        <DrawerContent className={`w-[440px] max-w-[95vw] border-l ${
          isDarkMode ? "bg-[#202024] border-[#38383C] text-white" : "bg-white border-slate-200 text-neutral-dark"
        }`}>
          {selectedProductForDetail && (() => {
            const p = selectedProductForDetail;
            const isTracked = p.is_inventory_tracked !== false;
            const shelfStock = p.qty_loose ?? p.current_stock ?? 0;
            const warehouseStock = p.qty_sealed ?? 0;
            const convRate = p.conversion_rate || 1;
            const totalEquiv = (warehouseStock * convRate) + shelfStock;
            const hasWarehouseStock = warehouseStock > 0;

            return (
              <div className="flex flex-col h-full p-6 overflow-y-auto">
                {/* Header */}
                {/* Header */}
                <DrawerHeader className="p-0 pb-4 border-b border-slate-200 dark:border-[#38383C]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-left">
                      <div className="w-10 h-10 rounded-2xl bg-brand-purple/10 dark:bg-primary/10 flex items-center justify-center text-brand-purple dark:text-primary shrink-0">
                        <Package className="w-5 h-5 stroke-[2.2]" />
                      </div>
                      <div>
                        <DrawerTitle className="text-base font-extrabold">{t.posItemDetailTitle || "Detail Produk & Stok"}</DrawerTitle>
                        <DrawerDescription className="text-xs text-slate-500 dark:text-slate-400">
                          {t.posItemDetailDesc || "Informasi stok rak, gudang dus, dan pembongkaran kemasan."}
                        </DrawerDescription>
                      </div>
                    </div>

                    {/* Pin/Unpin Action Button in Drawer */}
                    <button
                      type="button"
                      onClick={() => {
                        const newlyPinned = togglePinItem(p.id);
                        if (newlyPinned) {
                          toast.success(
                            (t.posPinSuccess || '"{name}" berhasil disematkan ke posisi teratas!').replace("{name}", p.name)
                          );
                        } else {
                          toast.info(
                            (t.posUnpinSuccess || 'Sematan "{name}" telah dilepas.').replace("{name}", p.name)
                          );
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        isItemPinned(p.id)
                          ? "bg-amber-500 text-white shadow-xs"
                          : "bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200"
                      }`}
                      title={isItemPinned(p.id) ? (t.posUnpinItem || "Lepas Sematan (Unpin)") : (t.posPinItem || "Sematkan Produk (Pin ke Atas)")}
                    >
                      <Pin className={`w-3.5 h-3.5 ${isItemPinned(p.id) ? "fill-white" : ""}`} />
                      <span>{isItemPinned(p.id) ? (t.posPinnedBadge || "Disematkan") : (t.posPinItem || "Pin")}</span>
                    </button>
                  </div>
                </DrawerHeader>

                {/* Product Identity Hero */}
                <div className="py-4 border-b border-slate-200 dark:border-[#38383C] flex items-center gap-3.5">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10">
                    <ErpImage src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight truncate">{p.name}</h3>
                      {onNavigate && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProductForDetail(null);
                            onNavigate("items");
                          }}
                          className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-white/10 hover:bg-slate-200 transition-colors cursor-pointer"
                          title={t.viewInMasterItem || "Buka Detail"}
                        >
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                          <span>{t.viewInMasterItem || "Buka Detail"}</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-slate-500 mt-0.5">SKU: {p.sku || "-"}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs font-black text-brand-purple dark:text-primary">
                        Rp {p.sell_price.toLocaleString("id-ID")}{" "}
                        <span className="text-[10px] font-normal text-slate-400">/{getPriceUnitLabel(p)}</span>
                      </span>
                      <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-bold">
                        {p.category || "General"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Real-time 3-Tier Stock Cards */}
                {isTracked ? (
                  <div className="py-4 space-y-2 border-b border-slate-200 dark:border-[#38383C]">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Status Ketersediaan Stok
                    </span>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-[#28282C] border border-slate-200/80 dark:border-white/5">
                        <span className="text-[9px] font-bold text-slate-400 block uppercase">{t.posShelfStock || "Rak Kasir"}</span>
                        <span className={`text-sm font-black mt-1 block ${
                          shelfStock <= 0 ? "text-red-500" : shelfStock < 5 ? "text-amber-500" : "text-slate-800 dark:text-slate-100"
                        }`}>
                          {shelfStock} <span className="text-[10px] font-semibold">{p.base_unit || p.unit_type}</span>
                        </span>
                      </div>

                      <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-[#28282C] border border-slate-200/80 dark:border-white/5">
                        <span className="text-[9px] font-bold text-slate-400 block uppercase">{t.posWarehouseStock || "Gudang Dus"}</span>
                        <span className="text-sm font-black text-purple-600 dark:text-purple-400 mt-1 block">
                          {warehouseStock} <span className="text-[10px] font-semibold">{p.box_unit || "Dus"}</span>
                        </span>
                      </div>

                      <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-[#28282C] border border-slate-200/80 dark:border-white/5">
                        <span className="text-[9px] font-bold text-slate-400 block uppercase">{t.posTotalEquivStock || "Total Fisik"}</span>
                        <span className="text-sm font-black text-slate-900 dark:text-white mt-1 block">
                          {totalEquiv} <span className="text-[10px] font-semibold">{p.base_unit || p.unit_type}</span>
                        </span>
                      </div>
                    </div>

                    {p.box_unit && p.conversion_rate && (
                      <p className="text-[10px] text-slate-500 italic text-right pt-1">
                        1 {p.box_unit} = {p.conversion_rate} {p.base_unit || p.unit_type}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="py-4 border-b border-slate-200 dark:border-[#38383C]">
                    <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-left space-y-1.5">
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                        <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>{t.posUntrackedStockBadge || "Tanpa Lacak Stok (Jasa / Unlimited)"}</span>
                      </div>
                      <p className="text-[11px] text-emerald-600/90 dark:text-emerald-400 leading-relaxed">
                        {t.posUntrackedStockNote || "Item ini berstatus non-inventori atau jasa. Kasir dapat melakukan penjualan bebas tanpa limitasi kuantitas stok rak maupun gudang."}
                      </p>
                    </div>
                  </div>
                )}

                {/* Inline Unbox Section (Only for tracked items) */}
                {isTracked ? (
                  <div className="flex-1 py-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <ArrowDownToDot className="w-4 h-4 text-brand-purple dark:text-primary" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        {t.posUnpackSectionTitle || "Bongkar Dus ke Rak (Unbox)"}
                      </span>
                    </div>

                    {hasWarehouseStock ? (
                      <form onSubmit={handleConfirmUnbox} className="space-y-3.5 p-4 rounded-2xl bg-brand-purple/5 dark:bg-primary/5 border border-brand-purple/20">
                        {/* Box Quantity Input */}
                        <div className="space-y-1.5 text-left">
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                            {t.posUnpackQtyLabel || "Jumlah Dus yang Dibongkar"}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              max={warehouseStock}
                              value={boxesToUnbox}
                              onChange={(e) => setBoxesToUnbox(Math.max(1, parseInt(e.target.value) || 1))}
                              className="flex-1 px-3 py-2 text-sm font-extrabold rounded-xl border border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#28282C] focus:outline-none focus:ring-2 focus:ring-brand-purple"
                              required
                            />
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{p.box_unit || "Dus"}</span>
                          </div>
                        </div>

                        {/* Yield preview */}
                        <div className="p-2.5 rounded-xl bg-white dark:bg-[#202024] border border-slate-200/80 dark:border-white/5 text-xs flex items-center justify-between">
                          <span className="text-slate-500 font-medium">{t.posUnpackYieldLabel || "Hasil Tambahan Satuan Rak"}:</span>
                          <span className="font-black text-brand-purple dark:text-primary text-sm">
                            + {boxesToUnbox * convRate} {p.base_unit || p.unit_type}
                          </span>
                        </div>

                        {/* Notes Input */}
                        <div className="space-y-1 text-left">
                          <label className="text-[10px] font-bold text-slate-500">
                            Catatan (Opsional)
                          </label>
                          <input
                            type="text"
                            placeholder="Misal: Restock etalase kasir"
                            value={unboxNotes}
                            onChange={(e) => setUnboxNotes(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#28282C] focus:outline-none"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={unboxingLoading || warehouseStock < boxesToUnbox}
                          className="w-full py-2.5 rounded-xl bg-brand-purple hover:bg-brand-purple-hover text-white dark:bg-primary dark:text-slate-900 text-xs font-bold transition-all shadow-md disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          {unboxingLoading ? (t.posUnpackLoading || "Memproses...") : (t.posUnpackSubmit || "Konfirmasi Bongkar Dus")}
                        </button>
                      </form>
                    ) : (
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#28282C] border border-slate-200 dark:border-[#38383C] text-center text-slate-400 text-xs py-6">
                        <Boxes className="w-8 h-8 mx-auto opacity-40 mb-2" />
                        <p className="font-bold text-slate-600 dark:text-slate-300">{t.posNoWarehouseStockNotice || "Tidak ada stok dus di gudang"}</p>
                        <p className="text-[10px] mt-1 text-slate-400">Seluruh stok barang ini sudah berada di rak display kasir atau habis.</p>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Footer Quick Action */}
                <div className="pt-3 border-t border-slate-200 dark:border-[#38383C] flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedProductForDetail(null)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#38383C] text-xs font-bold hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                  >
                    {t.close || "Tutup"}
                  </button>
                  {shelfStock > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        addToCart(p);
                        setSelectedProductForDetail(null);
                        toast.success(`1x ${p.name} dimasukkan ke keranjang`);
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold hover:opacity-90 cursor-pointer flex items-center justify-center gap-1"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      + Keranjang
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </DrawerContent>
      </Drawer>

      {/* 9. Voucher & Promotion Selector Drawer */}
      <Drawer
        open={showPromoDrawer}
        onOpenChange={setShowPromoDrawer}
        direction="right"
      >
        <DrawerContent className="w-[500px] sm:w-[540px] md:w-[560px] max-w-[95vw] border-l bg-white dark:bg-[#202024] text-neutral-dark dark:text-white">
          <div className="flex flex-col h-full w-full p-5 sm:p-6 overflow-hidden">
            
            {/* Header */}
            <DrawerHeader className="p-0 pb-4 border-b border-slate-200 dark:border-[#38383C] shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-2xl bg-brand-purple/10 dark:bg-primary/10 flex items-center justify-center text-brand-purple dark:text-primary shrink-0 font-bold">
                    <Ticket className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <DrawerTitle className="text-base font-extrabold text-slate-800 dark:text-slate-100">
                      {language === "id" ? "Voucher & Promo Kasir" : "Vouchers & Cashier Promo"}
                    </DrawerTitle>
                    <DrawerDescription className="text-xs text-slate-500 dark:text-slate-400">
                      {language === "id"
                        ? "Pilih program promosi aktif atau masukkan kode voucher kupon."
                        : "Select active promotion program or enter coupon voucher code."}
                    </DrawerDescription>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPromoDrawer(false)}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-[#2C2C30] hover:bg-slate-200 dark:hover:bg-[#38383C] text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  title={t.close || "Tutup"}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Cart Context Summary Strip */}
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-white/5">
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-[#28282C] border border-slate-200/80 dark:border-white/5 text-left">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    {language === "id" ? "Subtotal Keranjang" : "Cart Subtotal"}
                  </span>
                  <span className="text-xs font-black text-slate-900 dark:text-white mt-0.5 block">
                    Rp {subtotal.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-[#28282C] border border-slate-200/80 dark:border-white/5 text-left">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    {language === "id" ? "Total Item Belanja" : "Total Cart Items"}
                  </span>
                  <span className="text-xs font-black text-brand-purple dark:text-primary mt-0.5 block">
                    {totalCartQty} {language === "id" ? "Unit" : "Units"} ({cart.length} SKU)
                  </span>
                </div>
              </div>
            </DrawerHeader>

            {/* Scrollable Body Content */}
            <div className="flex-1 overflow-y-auto py-4 space-y-5 pr-1 scrollbar-thin">
              
              {/* Coupon Code Input Form */}
              <form onSubmit={handleApplyCoupon} className="space-y-2">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block text-left">
                  {language === "id" ? "Punya Kode Voucher Kupon?" : "Have a Coupon Code?"}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={language === "id" ? "Contoh: DISKONHEMAT10" : "E.g. SUMMERPROMO10"}
                    value={couponCodeInput}
                    onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#38383C] bg-slate-50 dark:bg-[#28282C] font-mono font-bold text-xs uppercase focus:outline-none focus:ring-2 focus:ring-brand-purple dark:focus:ring-primary"
                  />
                  <button
                    type="submit"
                    disabled={!couponCodeInput.trim()}
                    className="px-4 py-2.5 rounded-xl bg-brand-purple hover:bg-brand-purple-hover text-white dark:bg-primary dark:text-slate-900 text-xs font-bold transition-all disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    {language === "id" ? "Terapkan" : "Apply"}
                  </button>
                </div>
              </form>

              {/* List of Available Promotions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                    {language === "id" ? "Daftar Promo Tersedia" : "Available Promotions"}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">
                    {promotions.length} {language === "id" ? "Program" : "Programs"}
                  </span>
                </div>

                {promotions.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-[#28282C] border border-slate-200 dark:border-[#38383C] space-y-2">
                    <Ticket className="w-8 h-8 mx-auto opacity-30 text-slate-400" />
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {language === "id" ? "Belum ada promo yang terdaftar" : "No promotions registered yet"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {promotions.map((p) => {
                      const isTimeValid = isPromoCurrentlyValid(p);
                      const isMinOrderValid = p.min_order_amount <= 0 || subtotal >= p.min_order_amount;
                      const isMinQtyValid = p.min_qty <= 0 || totalCartQty >= p.min_qty;
                      const isTargetValid = p.target_scope === "entire_order" || (
                        p.target_scope === "specific_items"
                          ? cart.some((c) => p.target_ids?.includes(c.product.id))
                          : cart.some((c) =>
                              p.target_ids?.includes(c.product.category_id || "") ||
                              p.target_ids?.includes(c.product.category || "")
                            )
                      );
                      const isEligible = isTimeValid && isMinOrderValid && isMinQtyValid && isTargetValid && cart.length > 0;
                      const isSelected = selectedPromo?.id === p.id;
                      const isAutoEffective = !selectedPromo && effectivePromo?.id === p.id;

                      // Reason why ineligible
                      let ineligibleHint = "";
                      if (!isTimeValid) {
                        ineligibleHint = language === "id" ? "Di luar jadwal / jam aktif" : "Outside active schedule";
                      } else if (cart.length === 0) {
                        ineligibleHint = language === "id" ? "Keranjang masih kosong" : "Cart is empty";
                      } else if (!isMinOrderValid) {
                        const diff = p.min_order_amount - subtotal;
                        ineligibleHint = (language === "id" ? "Kurang Rp {diff} lagi" : "Needs Rp {diff} more").replace("{diff}", diff.toLocaleString("id-ID"));
                      } else if (!isMinQtyValid) {
                        const diffQty = p.min_qty - totalCartQty;
                        ineligibleHint = (language === "id" ? "Kurang {diff} item lagi" : "Needs {diff} more items").replace("{diff}", String(diffQty));
                      } else if (!isTargetValid) {
                        ineligibleHint = language === "id" ? "Item target belum ada di keranjang" : "Target item not in cart";
                      }

                      return (
                        <div
                          key={p.id}
                          className={`rounded-2xl border transition-all p-4 relative overflow-hidden ${
                            isSelected || isAutoEffective
                              ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/25 shadow-xs"
                              : isEligible
                                ? "border-slate-200 dark:border-[#38383C] bg-white dark:bg-[#28282C] hover:border-brand-purple/50 dark:hover:border-primary/50 shadow-xs"
                                : "border-dashed border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-[#202024]/60 opacity-75"
                          }`}
                        >
                          {/* Ticket Header & Value */}
                          <div className="flex items-start justify-between gap-3 mb-2.5">
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">
                                  {p.name}
                                </span>
                                {p.code && (
                                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-purple/10 text-brand-purple dark:bg-primary/10 dark:text-primary">
                                    {p.code}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-black text-brand-purple dark:text-primary">
                                {p.reward_type === "discount_pct"
                                  ? `Diskon ${p.reward_value}%${p.max_discount_cap ? ` (Maks. Rp ${p.max_discount_cap.toLocaleString("id-ID")})` : ""}`
                                  : `Potongan Rp ${p.reward_value.toLocaleString("id-ID")}`}
                              </p>
                            </div>

                            <div className="shrink-0">
                              {isSelected || isAutoEffective ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 px-2.5 py-1 rounded-full">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  {language === "id" ? "Aktif Digunakan" : "Active"}
                                </span>
                              ) : isEligible ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/10 px-2.5 py-1 rounded-full">
                                  <Sparkles className="w-3 h-3 text-amber-500" />
                                  {language === "id" ? "Dapat Digunakan" : "Eligible"}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-full">
                                  <AlertCircle className="w-3 h-3" />
                                  {ineligibleHint}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Rules summary badges */}
                          <div className="flex flex-wrap gap-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-3">
                            {p.min_order_amount > 0 && (
                              <span className={`px-2 py-0.5 rounded-md border ${
                                isMinOrderValid
                                  ? "border-slate-200 dark:border-white/10 bg-white dark:bg-black/20"
                                  : "border-red-200 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400 font-semibold"
                              }`}>
                                Min. Rp {p.min_order_amount.toLocaleString("id-ID")}
                              </span>
                            )}
                            {p.min_qty > 0 && (
                              <span className={`px-2 py-0.5 rounded-md border ${
                                isMinQtyValid
                                  ? "border-slate-200 dark:border-white/10 bg-white dark:bg-black/20"
                                  : "border-red-200 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400 font-semibold"
                              }`}>
                                Min. {p.min_qty} Item
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20">
                              {p.target_scope === "entire_order"
                                ? (language === "id" ? "Semua Item" : "Entire Order")
                                : p.target_scope === "specific_items"
                                  ? `${p.target_ids?.length || 0} Item Sasaran`
                                  : `${p.target_ids?.length || 0} Kategori Sasaran`}
                            </span>
                            {p.active_time_start && p.active_time_end && (
                              <span className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {p.active_time_start} - {p.active_time_end}
                              </span>
                            )}
                          </div>

                          {/* Footer Action */}
                          <div className="pt-2.5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">
                              {p.promo_type === "automatic"
                                ? (language === "id" ? "Otomatis aktif" : "Auto applied")
                                : (language === "id" ? "Kupon manual" : "Manual coupon")}
                            </span>

                            {isSelected ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPromo(null);
                                  toast.info(language === "id" ? "Promo dilepas dari keranjang" : "Promo removed from cart");
                                }}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                              >
                                {language === "id" ? "Lepas Promo" : "Remove"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={!isEligible}
                                onClick={() => {
                                  setSelectedPromo(p);
                                  setShowPromoDrawer(false);
                                  toast.success(`Promo "${p.name}" berhasil diterapkan!`);
                                }}
                                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                  isEligible
                                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 shadow-sm"
                                    : "bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500 cursor-not-allowed"
                                }`}
                              >
                                {language === "id" ? "Pakai Voucher" : "Use Voucher"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>
        </DrawerContent>
      </Drawer>

    </div>
  );
}
