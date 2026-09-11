import { useState, useEffect, useRef, useMemo } from "react";
import { api } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { enqueueTransaction } from "../../lib/indexeddb";
import { 
  Search, Trash2, Barcode, ChevronRight, CreditCard, 
  CheckCircle2, RotateCcw, XCircle, ShoppingCart, 
  Package, ClipboardCheck, FileSpreadsheet, BarChart3, 
  ChevronDown, GripVertical, History, Printer, AlertCircle, KeyRound, Menu
} from "lucide-react";
import TransactionHistoryDrawer, { type TransactionRecord } from "../../components/TransactionHistoryDrawer";
import { ErpSearchBar } from "../../components/ErpSearchBar";
import { useLanguageStore, translations } from "../../lib/i18n";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "../../components/ui/drawer";

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
}

export default function POSModule({ gridCols = 4, showNumpad = true }: POSModuleProps) {
  const { activeContext, activeShift, setActiveShift } = useAuthStore();
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;

  // Shift States
  const [loadingShift, setLoadingShift] = useState(true);
  const [openingCash, setOpeningCash] = useState("150000");
  const [closingCashActual, setClosingCashActual] = useState("");

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

  // App UI/Theme State
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  // Fetch active shift & products
  useEffect(() => {
    if (activeContext && activeContext.type !== "fnb_production") {
      fetchShiftStatus();
      fetchProducts();
    }
  }, [activeContext]);

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
      const res = await api.get("/products?status=active");
      const productsList = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setProducts(productsList);
    } catch (err) {
      console.error("Failed to load products:", err);
    }
  };

  // Open Shift Form Submit
  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/shifts/open", {
        opening_cash: parseInt(openingCash) || 0,
      });
      setActiveShift(res.data);
      setSuccess("Shift kasir berhasil dibuka!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Gagal membuka shift kasir");
    } finally {
      setLoading(false);
    }
  };

  // Close Shift Form Submit
  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/shifts/close", {
        closing_cash_actual: parseInt(closingCashActual) || 0,
      });
      setActiveShift(null);
      setShowCloseModal(false);
      setClosingCashActual("");
      setCart([]);
      setSuccess("Shift kasir berhasil ditutup!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Gagal menutup shift kasir");
    } finally {
      setLoading(false);
    }
  };

  // Dynamic products image generator using Unsplash stable links
  const getProductImage = (product: Product) => {
    if (product.image_url) return product.image_url;
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
    const idx = cart.findIndex((item) => item.product.id === product.id);
    if (idx !== -1) {
      const existing = cart[idx];
      if (product.inventory_mode === "dry_strict" && existing.qty + 1 > product.current_stock) {
        setError(`${t.posInsufficientStock} ${product.name}`);
        setTimeout(() => setError(""), 3000);
        return;
      }
      const newCart = [...cart];
      newCart[idx].qty += 1;
      setCart(newCart);
      setSelectedCartIndex(idx);
    } else {
      if (product.inventory_mode === "dry_strict" && product.current_stock < 1) {
        setError(`${t.posOutOfStock} ${product.name}`);
        setTimeout(() => setError(""), 3000);
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

  const updateQty = (index: number, delta: number) => {
    const item = cart[index];
    if (!item) return;

    const isFractional = ["kg", "liter", "gr"].includes(item.product.unit_type?.toLowerCase() || "");
    const step = isFractional && item.qty < 1 ? 0.1 : 1;
    const newQty = Math.round((item.qty + (delta > 0 ? step : -step)) * 1000) / 1000;

    if (newQty <= 0) {
      removeFromCart(index);
      return;
    }

    if (item.product.inventory_mode === "dry_strict" && delta > 0 && newQty > item.product.current_stock) {
      setError(`${t.posInsufficientStock} ${item.product.name}`);
      setTimeout(() => setError(""), 3000);
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
        if (item.product.inventory_mode === "dry_strict" && parsed > item.product.current_stock) {
          setError(`${t.posInsufficientStock} ${item.product.name}`);
          setTimeout(() => setError(""), 3000);
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
      setError(t.posProductNotFound);
      setTimeout(() => setError(""), 3000);
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
        const isFractional = ["kg", "liter", "gr"].includes(product.unit_type?.toLowerCase() || "");
        const step = isFractional && currentItem.qty < 1 ? 0.1 : 1;
        const targetQty = Math.round((currentItem.qty + (val === "+" ? step : -step)) * 1000) / 1000;
        
        if (targetQty <= 0) {
          removeFromCart(selectedCartIndex);
          return;
        }

        if (product.inventory_mode === "dry_strict" && val === "+" && targetQty > product.current_stock) {
          setError(`${t.posInsufficientStock} ${product.name}`);
          setTimeout(() => setError(""), 3000);
          return;
        }
        currentItem.qty = targetQty;
      } else {
        const digit = val;
        let newQtyStr = "";

        if (numpadDecimalActive) {
          const base = currentItem.qty === 0 ? "0" : currentItem.qty.toString();
          newQtyStr = base.includes(".") ? base + digit : base + "." + digit;
        } else {
          newQtyStr = currentItem.qty === 0 ? digit : currentItem.qty.toString() + digit;
        }

        const parsed = parseFloat(newQtyStr);
        if (!isNaN(parsed)) {
          if (product.inventory_mode === "dry_strict" && parsed > product.current_stock) {
            setError(`${t.posInsufficientStock} ${product.name}`);
            setTimeout(() => setError(""), 3000);
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

  // Pricing calculations
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.qty * item.product.sell_price, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    if (!enableDiscount || discountRate <= 0) return 0;
    return subtotal * (discountRate / 100);
  }, [subtotal, discountRate, enableDiscount]);

  const taxAmount = useMemo(() => {
    if (!enableTax || taxRate <= 0) return 0;
    return (subtotal - discountAmount) * (taxRate / 100);
  }, [subtotal, discountAmount, taxRate, enableTax]);

  const totalAmount = useMemo(() => {
    return subtotal - discountAmount + taxAmount;
  }, [subtotal, discountAmount, taxAmount]);

  // Payment Confirmation (Hits API or stores offline)
  const handleConfirmPayment = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    setError("");
    setSuccess("");
    setShowPaymentModal(false);

    const clientUUID = crypto.randomUUID();
    const payload = {
      client_uuid: clientUUID,
      total_amount: Math.round(totalAmount),
      payment_method: paymentMethod,
      type: isInternalTake ? "internal_take" : "sale",
      items: cart.map((item) => ({
        product_id: item.product.id,
        qty: item.qty,
      })),
    };

    try {
      const res = await api.post("/transactions", payload);
      setRecentTx([res.data, ...recentTx].slice(0, 5));
      setShowReceipt({
        ...res.data,
        subtotal,
        discountRate,
        discountAmount,
        taxRate,
        taxAmount,
        totalAmount,
        items: cart.map((c) => ({
          name: c.product.name,
          qty: c.qty,
          unit_price: c.product.sell_price,
          subtotal: c.qty * c.product.sell_price,
        })),
      });
      setCart([]);
      setIsInternalTake(false);
      setSuccess("Transaksi berhasil!");
      fetchProducts();
      setTimeout(() => setSuccess(""), 3000);
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
            status: "completed",
            created_at: new Date().toISOString(),
          };

          setShowReceipt({
            ...mockTx,
            subtotal,
            discountRate,
            discountAmount,
            taxRate,
            taxAmount,
            totalAmount,
            items: cart.map((c) => ({
              name: c.product.name,
              qty: c.qty,
              unit_price: c.product.sell_price,
              subtotal: c.qty * c.product.sell_price,
            })),
          });

          // Deduct stock locally
          setProducts((prevProducts) =>
            (prevProducts || []).map((p) => {
              const cartItem = cart.find((c) => c.product.id === p.id);
              if (cartItem) {
                return { ...p, current_stock: p.current_stock - cartItem.qty };
              }
              return p;
            })
          );

          setCart([]);
          setIsInternalTake(false);
          setSuccess("Transaksi disimpan lokal (offline)!");
          setTimeout(() => setSuccess(""), 3000);
          return;
        } catch (dbErr) {
          console.error("[Offline] Failed to queue transaction in IndexedDB:", dbErr);
        }
      }
      setError(err.response?.data?.message || "Gagal memproses transaksi");
    } finally {
      setLoading(false);
    }
  };

  // Handle Void
  const handleVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showVoidModal || !managerPin) return;

    setLoading(true);
    setError("");

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

      setSuccess("Transaksi berhasil di-void!");
      setShowVoidModal(null);
      setManagerPin("");
      setVoidReason("");
      fetchProducts();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Gagal memproses void");
    } finally {
      setLoading(false);
    }
  };

  // Dynamically Filter products based on search & category select
  const filteredProducts = useMemo(() => {
    return (products || []).filter((p) => {
      const matchesSearch = 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = 
        activeCategory === "ALL_CATEGORY_KEY" || 
        activeCategory === "All" ||
        activeCategory === "Semua" ||
        (p.category || "General") === activeCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, activeCategory]);

  const categories = useMemo(() => {
    const unique = new Set((products || []).map((p) => p.category || "General"));
    return ["ALL_CATEGORY_KEY", ...Array.from(unique)];
  }, [products]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL_CATEGORY_KEY: (products || []).length };
    (products || []).forEach((p) => {
      const cat = p.category || "General";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [products]);

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
        <span className="text-slate-500 dark:text-slate-400 font-bold text-sm">Memeriksa status laci kasir...</span>
      </div>
    );
  }

  // Open Shift Form Layout
  if (!activeShift) {
    return (
      <div className={`max-w-md mx-auto border shadow-xl rounded-3xl p-8 text-center mt-10 transition-colors ${
        isDarkMode ? "bg-dark-card-lighter border-dark-border-lighter text-white" : "bg-[#FFFFFF] border-light-border text-neutral-dark"
      }`}>
        <KeyRound className="w-12 h-12 mx-auto text-primary mb-4 stroke-[2.5]" />
        <h3 className="text-2xl font-bold mb-2">Buka Shift Kasir</h3>
        <p className="opacity-80 text-xs font-semibold leading-relaxed mb-6">
          Laci kasir saat ini terkunci. Anda harus membuka shift baru dan menginput nominal kas awal untuk memulai transaksi.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 text-red-500 text-xs font-bold rounded-xl border border-red-500/20 flex items-center gap-1.5 justify-center">
            <AlertCircle className="w-4 h-4 shrink-0 stroke-[2.5]" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleOpenShift} className="space-y-5">
          <div className="text-left">
            <label className="block text-xs font-bold opacity-75 uppercase tracking-wider mb-2 ml-1">
              Modal Awal Laci Kasir (Rupiah)
            </label>
            <input
              type="number"
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
              placeholder="150000"
              className={`w-full text-center text-xl font-bold px-4 py-3 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-brand-purple/40 focus:border-brand-purple transition-all ${
                isDarkMode ? "bg-[#1E1E1E] border-dark-border-lighter text-white" : "bg-slate-50 border-light-border text-neutral-dark"
              }`}
              style={{ minHeight: "56px" }}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center font-bold text-white bg-brand-purple hover:bg-brand-purple-hover rounded-2xl shadow-md transition-all duration-200 cursor-pointer text-sm"
            style={{ minHeight: "56px" }}
          >
            {loading ? "Membuka Laci..." : "Mulai Shift Baru"}
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

        {/* Top Header Row: Unified ErpSearchBar + Mobile Menu Button Aligned Side-by-Side */}
        <ErpSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          onSubmit={handleBarcodeSubmit}
          placeholder={t.posSearchPlaceholder}
          inputRef={barcodeInputRef}
        />

        {/* Global Error & Success Alerts */}
        {error && (
          <div className="p-3 bg-red-500/10 text-red-500 text-xs font-bold rounded-xl border border-red-500/20 text-left flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0 stroke-[2.5]" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="p-3 bg-emerald-500/10 text-emerald-500 text-xs font-bold rounded-xl border border-emerald-500/20 text-left flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 stroke-[2.5]" />
            <span>{success}</span>
          </div>
        )}

        {/* Horizontal Minimalist Text Category Tabs with Custom Underline */}
        <div className="relative flex items-center w-full flex-shrink-0 border-b border-slate-200/80 dark:border-[#38383C] pt-1">
          <div 
            ref={categoryRef}
            className="flex-1 flex space-x-6 overflow-x-auto scrollbar-none scroll-smooth"
          >
            {categories.map((cat) => {
              const isCatActive = activeCategory === cat;
              const displayLabel = cat === "ALL_CATEGORY_KEY" ? t.posAllCategories : cat;
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
          <h3 className="text-xs font-bold text-left uppercase tracking-wider opacity-80 flex-shrink-0">Choose Products</h3>
          
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
                  const inStock = p.inventory_mode === "wet_infinite" || p.inventory_mode === "batch_thaw" || p.current_stock > 0;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => inStock && addToCart(p)}
                      disabled={!inStock}
                      className={`group relative flex flex-col justify-between overflow-hidden border rounded-2xl p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                        inStock ? "cursor-pointer" : "opacity-45 cursor-not-allowed"
                      } ${
                        isDarkMode
                          ? "bg-dark-card-lighter border-dark-border-lighter hover:border-primary/40"
                          : "bg-[#FFFFFF] border-light-border hover:border-brand-purple/40 text-neutral-dark"
                      }`}
                    >
                      {/* aspect ratio 4/3 Unsplash image */}
                      <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 mb-2 relative">
                        <img
                          src={getProductImage(p)}
                          alt={p.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {!inStock && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="text-[10px] text-white font-bold bg-red-600 px-2 py-0.5 rounded-full">HABIS</span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="font-bold text-xs leading-tight line-clamp-2 mb-1 dark:text-white">{p.name}</h4>
                          <div className="flex items-center justify-between text-[9px] opacity-60">
                            <span>SKU: {p.sku || "-"}</span>
                            {(p.inventory_mode === "dry_strict" || p.inventory_mode === "batch_thaw") && (
                              <span className={`font-bold ${p.current_stock < 5 ? "text-amber-500 font-bold" : ""}`}>
                                Stok: {p.current_stock} {p.inventory_mode === "batch_thaw" ? "pcs" : ""}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-dashed border-light-border/60 dark:border-dark-border-lighter">
                          <span className="text-xs font-bold text-brand-purple dark:text-primary">
                            Rp {p.sell_price.toLocaleString()}
                          </span>
                          <span className="w-6 h-6 rounded-lg bg-brand-purple/10 flex items-center justify-center text-brand-purple text-xs font-bold group-hover:bg-brand-purple group-hover:text-white transition-colors dark:group-hover:bg-primary dark:group-hover:text-neutral-dark dark:text-primary">
                            +
                          </span>
                        </div>
                      </div>
                    </button>
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
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-slate-100">
                        <img src={getProductImage(item.product)} alt={item.product.name} className="w-full h-full object-cover" />
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-[11px] leading-tight truncate">{item.product.name}</h4>
                        <p className="text-[9px] opacity-60">SKU: {item.product.sku || "-"}</p>
                        
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            isDarkMode ? "bg-dark-border-lighter" : "bg-slate-100"
                          }`}>
                            Unit: {item.product.unit_type}
                          </span>
                          
                          {showNumpad ? (
                            <span className="text-[9px] opacity-75 font-semibold text-brand-purple dark:text-primary">
                              Qty: {item.qty} {item.product.unit_type}
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
                        Rp {(item.product.sell_price * item.qty).toLocaleString()}
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
          {/* Pricing breakdown */}
          <div className="space-y-1.5 py-3 border-t border-light-border/60 dark:border-dark-border-lighter text-xs">
            {(enableTax || enableDiscount) && (
              <div className="flex justify-between opacity-75">
                <span>{t.posSubtotal}</span>
                <span>Rp {subtotal.toLocaleString("id-ID")}</span>
              </div>
            )}

            {enableDiscount && (
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

            <div className={`flex justify-between items-center text-sm font-bold ${
              enableDiscount || enableTax ? "pt-1.5 border-t border-dashed border-light-border" : ""
            } text-brand-purple dark:text-primary`}>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-neutral-dark">
          <div className={`w-full max-w-md border rounded-3xl p-6 shadow-2xl transition-all ${
            isDarkMode ? "bg-dark-card-lighter border-dark-border-lighter text-white" : "bg-[#FFFFFF] border-light-border"
          }`}>
            <h3 className="text-lg font-bold mb-1 dark:text-white">{t.posCloseShift}</h3>
            <p className="opacity-70 text-xs font-semibold leading-relaxed mb-5">
              {language === "id"
                ? "Hitung seluruh uang fisik di laci kasir saat ini untuk rekonsiliasi dan penutupan shift."
                : "Count all physical cash in the drawer for end-of-shift reconciliation."}
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 text-red-500 text-xs font-bold rounded-xl border border-red-500/20 text-left flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 stroke-[2.5]" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCloseShift} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold opacity-75 uppercase tracking-wider mb-2 ml-1 text-left">
                  {t.posActualCash} (Rupiah)
                </label>
                <input
                  type="number"
                  value={closingCashActual}
                  onChange={(e) => setClosingCashActual(e.target.value)}
                  placeholder="150000"
                  className={`w-full text-center text-xl font-bold px-4 py-3 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-brand-purple/40 focus:border-brand-purple transition-all ${
                    isDarkMode ? "bg-[#1E1E1E] border-dark-border-lighter text-white" : "bg-slate-50 border-light-border"
                  }`}
                  style={{ minHeight: "56px" }}
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="flex-1 py-3 text-xs font-bold border border-light-border dark:border-dark-border-lighter hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all cursor-pointer dark:text-white"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 text-xs font-bold bg-brand-purple text-white hover:bg-brand-purple-hover rounded-xl transition-all cursor-pointer shadow-md"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-neutral-dark">
          <div className={`w-full max-w-md border rounded-3xl p-6 shadow-2xl transition-all ${
            isDarkMode ? "bg-dark-card-lighter border-dark-border-lighter text-white" : "bg-white border-light-border"
          }`}>
            <h3 className="text-lg font-bold mb-1 text-red-500">{t.posVoidModalTitle}</h3>
            <p className="opacity-70 text-xs font-semibold leading-relaxed mb-5">
              {t.posManagerPinRequired}
            </p>

            <form onSubmit={handleVoid} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold opacity-75 uppercase tracking-wider mb-1 text-left">
                  {t.posVoidManagerPin}
                </label>
                <input
                  type="password"
                  value={managerPin}
                  onChange={(e) => setManagerPin(e.target.value)}
                  placeholder="••••••"
                  maxLength={6}
                  className={`w-full text-center text-xl font-bold px-4 py-2.5 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-all ${
                    isDarkMode ? "bg-[#1E1E1E] border-dark-border-lighter text-white" : "bg-slate-50 border-light-border"
                  }`}
                  required
                />
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
                  className={`w-full text-xs px-4 py-2.5 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-all ${
                    isDarkMode ? "bg-[#1E1E1E] border-dark-border-lighter text-white" : "bg-slate-50 border-light-border"
                  }`}
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowVoidModal(null);
                    setManagerPin("");
                    setVoidReason("");
                  }}
                  className="flex-1 py-3 text-xs font-bold border border-light-border dark:border-dark-border-lighter hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all cursor-pointer dark:text-white"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 text-xs font-bold bg-red-600 text-white hover:bg-red-700 rounded-xl transition-all cursor-pointer shadow-md"
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
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold opacity-75 uppercase tracking-wider block text-left">
                    {language === "id" ? "Metode Pembayaran" : "Payment Method"}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "cash", label: t.posCashMethod },
                      { id: "qris", label: t.posQrisMethod },
                      { id: "other", label: language === "id" ? "Lainnya" : "Other" }
                    ].map((method) => {
                      const isSelected = paymentMethod === method.id;
                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setPaymentMethod(method.id as any)}
                          className={`p-3 rounded-2xl border text-center font-bold text-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                            isSelected
                              ? isDarkMode
                                ? "bg-primary/15 border-primary text-primary"
                                : "bg-brand-purple/10 border-brand-purple text-brand-purple"
                              : isDarkMode
                                ? "bg-dark-border-lighter border-transparent text-[#94A3B8] hover:bg-[#404040]"
                                : "bg-slate-50 border-light-border/60 text-neutral-dark hover:bg-slate-100"
                          }`}
                        >
                          <CreditCard className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{method.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Payment Modal Summary */}
              <div className={`p-4 rounded-2xl text-xs space-y-2 font-semibold ${
                isDarkMode ? "bg-dark-border-lighter text-white" : "bg-[#E7DCFD] text-neutral-dark"
              }`}>
                <div className="flex justify-between">
                  <span className="opacity-75">{language === "id" ? "Total Produk:" : "Total Items:"}</span>
                  <span>{cart.reduce((sum, item) => sum + item.qty, 0)} {t.posUnit}</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-dashed border-light-border text-brand-purple dark:text-primary">
                  <span>{t.posTotalPayment}</span>
                  <span>Rp {Math.round(totalAmount).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 py-3 text-xs font-bold border border-light-border dark:border-dark-border-lighter hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all cursor-pointer dark:text-white"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                className="flex-1 py-3 text-xs font-bold bg-brand-purple text-white hover:bg-brand-purple-hover rounded-xl transition-all cursor-pointer shadow-md"
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
            <div className="space-y-3.5 text-xs font-mono border-t border-b border-dashed border-light-border/60 dark:border-dark-border-lighter py-3.5 my-3.5 max-h-[250px] overflow-y-auto dark:text-white">
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
              
              <div className="space-y-1.5 pt-2 border-t border-light-border/60 dark:border-dark-border-lighter">
                {showReceipt.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-[11px]">
                    <span className="truncate max-w-[70%]">{item.name} (x{item.qty})</span>
                    <span>Rp {item.subtotal.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 pt-2 border-t border-light-border/60 dark:border-dark-border-lighter font-semibold">
                <div className="flex justify-between">
                  <span>{t.posSubtotal}:</span>
                  <span>Rp {showReceipt.subtotal?.toLocaleString() || "0"}</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>{t.posDiscount} ({showReceipt.discountRate || 0}%):</span>
                  <span>-Rp {showReceipt.discountAmount?.toLocaleString() || "0"}</span>
                </div>
                <div className="flex justify-between text-amber-500">
                  <span>{t.posTax} ({showReceipt.taxRate || 0}%):</span>
                  <span>Rp {showReceipt.taxAmount?.toLocaleString() || "0"}</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-light-border/60 dark:border-dark-border-lighter text-brand-purple dark:text-primary">
                  <span>{t.posReceiptTotalBill}:</span>
                  <span>Rp {Math.round(showReceipt.totalAmount || showReceipt.total_amount).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Receipt Modal Footer Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  alert(t.posReceiptPrinted);
                }}
                className="flex-1 py-3 text-xs font-bold border border-light-border dark:border-dark-border-lighter hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all cursor-pointer dark:text-white"
              >
                {t.posPrintReceipt}
              </button>
              <button
                type="button"
                onClick={() => setShowReceipt(null)}
                className="flex-1 py-3 text-xs font-bold bg-brand-purple text-white hover:bg-brand-purple-hover rounded-xl transition-all cursor-pointer shadow-md"
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
                          <img src={getProductImage(item.product)} alt={item.product.name} className="w-10 h-10 rounded-xl object-cover shrink-0" />
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-xs leading-tight truncate">{item.product.name}</h4>
                            <span className="text-[10px] opacity-75 font-semibold text-brand-purple dark:text-primary">
                              Rp {item.product.sell_price.toLocaleString("id-ID")} x {item.qty}
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

    </div>
  );
}
