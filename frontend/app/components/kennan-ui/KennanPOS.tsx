import { useState, useMemo, useEffect, useRef } from "react";
import { 
  Search, Sun, Moon, Bell, Calendar, Trash2, Barcode, HelpCircle, 
  Settings, Users, FileText, ShoppingBag, LayoutDashboard, 
  CreditCard, ChevronRight, CheckCircle2, RotateCcw, XCircle,
  ShoppingCart, Package, ClipboardCheck, FileSpreadsheet, BarChart3,
  ChevronDown, GripVertical
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  code: string;
  category: string;
  price: number;
  available: number;
  image: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  size: string;
}

export default function KennanPOS() {
  // Theme & UI States
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState("POS");
  const [activeSubTab, setActiveSubTab] = useState("POS Dashboard");
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showProfilePopover, setShowProfilePopover] = useState(false);
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  const [gridCols, setGridCols] = useState(4);
  const [showNumpad, setShowNumpad] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "QRIS" | "Debit" | "Credit">("Cash");
  const [transactionType, setTransactionType] = useState<"Sales" | "Pengambilan Pribadi">("Sales");

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

  // Tools expanded state when sidebar collapsed
  const [isToolsGroupExpanded, setIsToolsGroupExpanded] = useState(false);

  // Categories scroll ref
  const categoryRef = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCartIndex, setSelectedCartIndex] = useState<number | null>(0);
  const [numpadMode, setNumpadMode] = useState<"qty" | "tax" | "discount">("qty");
  
  // Tax / Discount rates (mockup says Tax 2%, Discount 5%)
  const [taxRate, setTaxRate] = useState(2);
  const [discountRate, setDiscountRate] = useState(5);
  
  // Checkout Modal State
  const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(false);
  const [lastOrderDetails, setLastOrderDetails] = useState<any>(null);

  // Seed data matching the mockup products
  const products: Product[] = [
    {
      id: "p1",
      name: "T-Shirt Navy Classic Blue",
      code: "1254654",
      category: "T-shirt",
      price: 120,
      available: 200,
      image: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=300&auto=format&fit=crop&q=60"
    },
    {
      id: "p2",
      name: "Men's Short Sleeve Mustard",
      code: "1254655",
      category: "T-shirt",
      price: 120,
      available: 200,
      image: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=300&auto=format&fit=crop&q=60"
    },
    {
      id: "p3",
      name: "Big Dreams Graphic Tee White",
      code: "1254656",
      category: "T-shirt",
      price: 120,
      available: 200,
      image: "https://images.unsplash.com/photo-1562157873-818bc0726f68?w=300&auto=format&fit=crop&q=60"
    },
    {
      id: "p4",
      name: "Parchment Folded Tee Pack",
      code: "1254657",
      category: "Shirt",
      price: 120,
      available: 200,
      image: "https://images.unsplash.com/photo-1603252109303-2751441dd157?w=300&auto=format&fit=crop&q=60"
    },
    {
      id: "p5",
      name: "Premium Shirts Hanger Rack",
      code: "1254658",
      category: "Shirt",
      price: 120,
      available: 200,
      image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=300&auto=format&fit=crop&q=60"
    },
    {
      id: "p6",
      name: "Classic Blue Striped Dress Shirt",
      code: "1254659",
      category: "Shirt",
      price: 120,
      available: 200,
      image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=300&auto=format&fit=crop&q=60"
    },
    {
      id: "p7",
      name: "Boutique Terracotta Casual Jacket",
      code: "1254660",
      category: "Koti",
      price: 120,
      available: 200,
      image: "https://images.unsplash.com/photo-1544441893-675973e31985?w=300&auto=format&fit=crop&q=60"
    },
    {
      id: "p8",
      name: "Minimalist Black Denim Overcoat",
      code: "1254661",
      category: "Koti",
      price: 120,
      available: 200,
      image: "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=300&auto=format&fit=crop&q=60"
    },
    {
      id: "p9",
      name: "Vintage Straw Hat & Denim Pants",
      code: "1254662",
      category: "Jeans pant",
      price: 120,
      available: 200,
      image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=300&auto=format&fit=crop&q=60"
    },
    {
      id: "p10",
      name: "Folded Denim Jeans Stack",
      code: "1254663",
      category: "Jeans pant",
      price: 120,
      available: 200,
      image: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=300&auto=format&fit=crop&q=60"
    },
    {
      id: "p11",
      name: "Washed Blue Denim Pant Hangers",
      code: "1254664",
      category: "Jeans pant",
      price: 120,
      available: 200,
      image: "https://images.unsplash.com/photo-1582562124811-c09040d0a901?w=300&auto=format&fit=crop&q=60"
    },
    {
      id: "p12",
      name: "Chunky Blue Denim Layflat",
      code: "1254665",
      category: "Jeans pant",
      price: 120,
      available: 200,
      image: "https://images.unsplash.com/photo-1479064555552-3ef4979f8908?w=300&auto=format&fit=crop&q=60"
    }
  ];

  // Cart state initialized with mock items from screenshot
  const [cart, setCart] = useState<CartItem[]>([
    { product: products[0], quantity: 2, size: "M" },
    { product: products[1], quantity: 2, size: "M" },
    { product: products[2], quantity: 2, size: "M" }
  ]);

  // Sidebar menu items array removed to support collapsible layout directly in nav.

  // Category counts computed from products seed data + mockup totals
  const categories = [
    { name: "All", count: 23145 },
    { name: "T-shirt", count: 224 },
    { name: "Jeans pant", count: 125 },
    { name: "Shirt", count: 509 },
    { name: "Trouser", count: 100 },
    { name: "Koti", count: 225 },
    { name: "Wallet", count: 425 },
    { name: "Jackets", count: 180 },
    { name: "Sweaters", count: 95 },
    { name: "Hoodies", count: 140 },
    { name: "Blazers", count: 75 },
    { name: "Suits", count: 45 },
    { name: "Shorts", count: 110 },
    { name: "Skirts", count: 85 },
    { name: "Dresses", count: 160 },
    { name: "Socks", count: 320 },
    { name: "Shoes", count: 215 },
    { name: "Sneakers", count: 190 },
    { name: "Hats", count: 130 },
    { name: "Belts", count: 150 },
    { name: "Sunglasses", count: 90 },
    { name: "Bags", count: 175 },
    { name: "Backpacks", count: 115 },
    { name: "Scarves", count: 65 },
    { name: "Gloves", count: 50 },
    { name: "Watches", count: 80 },
    { name: "Ties", count: 70 },
    { name: "Perfumes", count: 55 },
    { name: "Activewear", count: 105 },
    { name: "Underwear", count: 240 }
  ];

  // Filter products by category and search query
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = activeCategory === "All" || p.category === activeCategory;
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.code.includes(searchQuery);
      return matchCat && matchSearch;
    });
  }, [activeCategory, searchQuery]);

  // Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    return (subtotal * discountRate) / 100;
  }, [subtotal, discountRate]);

  const taxAmount = useMemo(() => {
    return ((subtotal - discountAmount) * taxRate) / 100;
  }, [subtotal, discountAmount, taxRate]);

  const totalAmount = useMemo(() => {
    return subtotal - discountAmount + taxAmount;
  }, [subtotal, discountAmount, taxAmount]);

  // Cart operations
  const handleAddProductToCart = (product: Product) => {
    const existingIndex = cart.findIndex((item) => item.product.id === product.id && item.size === "M");
    if (existingIndex > -1) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
      setSelectedCartIndex(existingIndex);
    } else {
      const newCart = [...cart, { product, quantity: 1, size: "M" }];
      setCart(newCart);
      setSelectedCartIndex(newCart.length - 1);
    }
  };

  const handleRemoveFromCart = (index: number) => {
    const newCart = cart.filter((_, i) => i !== index);
    setCart(newCart);
    if (newCart.length === 0) {
      setSelectedCartIndex(null);
    } else {
      setSelectedCartIndex(Math.max(0, index - 1));
    }
  };

  const handleClearCart = () => {
    setCart([]);
    setSelectedCartIndex(null);
  };

  const handleUpdateQty = (index: number, delta: number) => {
    const newCart = [...cart];
    newCart[index].quantity = Math.max(1, newCart[index].quantity + delta);
    setCart(newCart);
  };

  const handleSetQty = (index: number, qty: number) => {
    const newCart = [...cart];
    newCart[index].quantity = Math.max(1, qty);
    setCart(newCart);
  };

  // Numpad key triggers
  const handleNumpadPress = (val: string) => {
    if (selectedCartIndex === null || cart.length === 0) return;
    
    const newCart = [...cart];
    const currentItem = newCart[selectedCartIndex];

    if (numpadMode === "qty") {
      if (val === "C") {
        currentItem.quantity = 0;
      } else if (val === "+" || val === "-") {
        const delta = val === "+" ? 1 : -1;
        currentItem.quantity = Math.max(1, currentItem.quantity + delta);
      } else {
        const currentQtyStr = currentItem.quantity.toString();
        // Overwrite if quantity is 0 or single placeholder, otherwise append
        const newQty = parseInt(val);
        if (!isNaN(newQty)) {
          currentItem.quantity = currentItem.quantity === 0 ? newQty : parseInt(currentQtyStr + val);
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

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setShowPaymentModal(true);
  };

  const handleConfirmPayment = () => {
    setLastOrderDetails({
      orderNo: Math.floor(100000 + Math.random() * 900000),
      items: [...cart],
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
      transactionType,
      paymentMethod: transactionType === "Pengambilan Pribadi" ? "None" : paymentMethod,
      date: new Date().toLocaleString()
    });
    setShowPaymentModal(false);
    setShowCheckoutSuccess(true);
  };

  const confirmPayment = () => {
    setCart([]);
    setSelectedCartIndex(null);
    setShowCheckoutSuccess(false);
    setTransactionType("Sales");
    setPaymentMethod("Cash");
  };

  return (
    <div 
      style={!isDarkMode ? {
        backgroundImage: "radial-gradient(circle at 50% 50%, #eae5f7 0%, #f5e3f0 35%, #D6D7DC 80%)"
      } : undefined}
      className={`w-full min-h-screen font-sans transition-colors duration-300 ${isDarkMode ? "dark bg-[#1E1E1E] text-[#F8FAFC]" : "text-[#2B2B2B]"}`}
    >
      {/* Scrollbar Customization Styles */}
      <style dangerouslySetInnerHTML={{__html: `
        /* Sleek custom scrollbars */
        ::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(147, 98, 252, 0.25);
          border-radius: 99px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(147, 98, 252, 0.6);
        }
      `}} />



      <div className="flex h-screen overflow-hidden">
        
        {/* ================= LEFT SIDEBAR ================= */}
        <aside className={`${isSidebarCollapsed ? "w-20" : "w-60"} flex flex-col justify-between p-5 transition-all duration-300 bg-transparent shrink-0`}>
          <div className="space-y-5.5">
            
            {/* Brand Logo & Collapse Toggle */}
            <div className={`flex items-center justify-between px-2 ${isSidebarCollapsed ? "flex-col space-y-4" : "flex-row mb-4"}`}>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-[#9362FC] flex items-center justify-center text-white font-bold shrink-0 shadow-sm" title="JnA Mart">
                  JM
                </div>
                {!isSidebarCollapsed && (
                  <div className="text-left leading-tight">
                    <span className="font-bold text-base text-[#2B2B2B] dark:text-white tracking-tight">JnA Mart</span>
                    <p className="text-[10px] opacity-60">Owner Account</p>
                  </div>
                )}
              </div>
              <button 
                type="button" 
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-1.5 hover:bg-white/30 rounded-full cursor-pointer transition-colors text-foreground"
                title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                {isSidebarCollapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4 rotate-180" />
                )}
              </button>
            </div>

            {/* Nav Menu */}
            {isSidebarCollapsed ? (
              <div className="bg-white/45 dark:bg-white/5 shadow-md p-2 rounded-full flex flex-col items-center gap-2 py-3 transition-all duration-300">
                {/* Dashboard */}
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => setActiveTab("Dashboard")}
                    className={`p-2.5 rounded-full transition-all cursor-pointer ${
                      activeTab === "Dashboard"
                        ? "bg-[#E2FF66] text-[#2B2B2B] shadow-sm"
                        : "text-[#2B2B2B] dark:text-[#CBBFAF] hover:bg-white/60 dark:hover:bg-white/10"
                    }`}
                  >
                    <LayoutDashboard className="w-5 h-5 shrink-0" />
                  </button>
                  <div className="absolute left-14 top-1.5 scale-0 transition-all rounded-lg bg-[#2B2B2B] text-white px-2.5 py-1.5 text-xs font-bold group-hover:scale-100 whitespace-nowrap z-50 shadow-md">
                    Dashboard
                  </div>
                </div>

                {/* POS */}
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => setActiveTab("POS")}
                    className={`p-2.5 rounded-full transition-all cursor-pointer ${
                      activeTab === "POS" || activeTab === "POS Machine" || activeTab === "POS Dashboard"
                        ? "bg-[#E2FF66] text-[#2B2B2B] shadow-sm"
                        : "text-[#2B2B2B] dark:text-[#CBBFAF] hover:bg-white/60 dark:hover:bg-white/10"
                    }`}
                  >
                    <ShoppingCart className="w-5 h-5 shrink-0" />
                  </button>
                  <div className="absolute left-14 top-1.5 scale-0 transition-all rounded-lg bg-[#2B2B2B] text-white px-2.5 py-1.5 text-xs font-bold group-hover:scale-100 whitespace-nowrap z-50 shadow-md">
                    Point of Sale (POS)
                  </div>
                </div>

                {/* Inventory / Stok */}
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => {
                      setInventoryOpen(!inventoryOpen);
                      setActiveTab("inventory-master");
                    }}
                    className={`p-2.5 rounded-full transition-all cursor-pointer ${
                      activeTab.startsWith("inventory-")
                        ? "bg-[#E2FF66] text-[#2B2B2B] shadow-sm"
                        : "text-[#2B2B2B] dark:text-[#CBBFAF] hover:bg-white/60 dark:hover:bg-white/10"
                    }`}
                  >
                    <Package className="w-5 h-5 shrink-0" />
                  </button>
                  <div className="absolute left-14 top-1.5 scale-0 transition-all rounded-lg bg-[#2B2B2B] text-white px-2.5 py-1.5 text-xs font-bold group-hover:scale-100 whitespace-nowrap z-50 shadow-md">
                    Inventory / Stok
                  </div>
                </div>

                {/* Opname Fisik */}
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => setActiveTab("Opname")}
                    className={`p-2.5 rounded-full transition-all cursor-pointer ${
                      activeTab === "Opname"
                        ? "bg-[#E2FF66] text-[#2B2B2B] shadow-sm"
                        : "text-[#2B2B2B] dark:text-[#CBBFAF] hover:bg-white/60 dark:hover:bg-white/10"
                    }`}
                  >
                    <ClipboardCheck className="w-5 h-5 shrink-0" />
                  </button>
                  <div className="absolute left-14 top-1.5 scale-0 transition-all rounded-lg bg-[#2B2B2B] text-white px-2.5 py-1.5 text-xs font-bold group-hover:scale-100 whitespace-nowrap z-50 shadow-md">
                    Opname Fisik
                  </div>
                </div>

                {/* Procurement */}
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => setActiveTab("Procurement")}
                    className={`p-2.5 rounded-full transition-all cursor-pointer ${
                      activeTab === "Procurement"
                        ? "bg-[#E2FF66] text-[#2B2B2B] shadow-sm"
                        : "text-[#2B2B2B] dark:text-[#CBBFAF] hover:bg-white/60 dark:hover:bg-white/10"
                    }`}
                  >
                    <FileSpreadsheet className="w-5 h-5 shrink-0" />
                  </button>
                  <div className="absolute left-14 top-1.5 scale-0 transition-all rounded-lg bg-[#2B2B2B] text-white px-2.5 py-1.5 text-xs font-bold group-hover:scale-100 whitespace-nowrap z-50 shadow-md">
                    Procurement
                  </div>
                </div>

                {/* Analytics */}
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => setActiveTab("Analytics")}
                    className={`p-2.5 rounded-full transition-all cursor-pointer ${
                      activeTab === "Analytics"
                        ? "bg-[#E2FF66] text-[#2B2B2B] shadow-sm"
                        : "text-[#2B2B2B] dark:text-[#CBBFAF] hover:bg-white/60 dark:hover:bg-white/10"
                    }`}
                  >
                    <BarChart3 className="w-5 h-5 shrink-0" />
                  </button>
                  <div className="absolute left-14 top-1.5 scale-0 transition-all rounded-lg bg-[#2B2B2B] text-white px-2.5 py-1.5 text-xs font-bold group-hover:scale-100 whitespace-nowrap z-50 shadow-md">
                    Analytics
                  </div>
                </div>
              </div>
            ) : (
              <nav className="space-y-2">
                {/* Dashboard */}
                <button
                  type="button"
                  onClick={() => setActiveTab("Dashboard")}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 cursor-pointer ${
                    activeTab === "Dashboard"
                      ? "bg-[#E2FF66] text-[#2B2B2B] shadow-md font-bold"
                      : isDarkMode
                        ? "bg-white/5 text-[#94A3B8] hover:bg-white/10 hover:text-white"
                        : "bg-white/40 text-[#2B2B2B] hover:bg-white/60 hover:shadow-md"
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  <span>Dashboard</span>
                </button>

                {/* POS */}
                <button
                  type="button"
                  onClick={() => setActiveTab("POS")}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 cursor-pointer ${
                    activeTab === "POS" || activeTab === "POS Machine" || activeTab === "POS Dashboard"
                      ? "bg-[#E2FF66] text-[#2B2B2B] shadow-md font-bold"
                      : isDarkMode
                        ? "bg-white/5 text-[#94A3B8] hover:bg-white/10 hover:text-white"
                        : "bg-white/40 text-[#2B2B2B] hover:bg-white/60 hover:shadow-md"
                  }`}
                >
                  <ShoppingCart className="w-4 h-4 shrink-0" />
                  <span>Point of Sale (POS)</span>
                </button>

                {/* Inventory / Stok */}
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setInventoryOpen(!inventoryOpen);
                      setActiveTab("inventory-master");
                    }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 cursor-pointer ${
                      activeTab.startsWith("inventory-")
                        ? "bg-[#E2FF66] text-[#2B2B2B] shadow-md font-bold"
                        : isDarkMode
                          ? "bg-white/5 text-[#94A3B8] hover:bg-white/10 hover:text-white"
                          : "bg-white/40 text-[#2B2B2B] hover:bg-white/60 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Package className="w-4 h-4 shrink-0" />
                      <span>Inventory / Stok</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${inventoryOpen ? "rotate-180" : ""}`} />
                  </button>

                  {/* Collapsible Submenus */}
                  <div className={`transition-all duration-200 overflow-hidden ${inventoryOpen ? "max-h-[300px] opacity-100 pl-4 space-y-1 mt-1" : "max-h-0 opacity-0"}`}>
                    {[
                      { id: "inventory-master", label: "Master Produk" },
                      { id: "inventory-add", label: "Tambah Baru" },
                      { id: "inventory-discontinued", label: "Produk Discontinued" }
                    ].map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setActiveTab(sub.id)}
                        className={`w-full flex items-center px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 cursor-pointer ${
                          activeTab === sub.id
                            ? "bg-[#9362FC]/20 text-[#9362FC] dark:text-[#E2FF66]"
                            : isDarkMode
                              ? "bg-white/5 text-[#94A3B8]/80 hover:bg-white/10 hover:text-white"
                              : "bg-[#2B2B2B]/10 text-[#2B2B2B] hover:bg-white/50"
                        }`}
                      >
                        <span>{sub.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Opname Fisik */}
                <button
                  type="button"
                  onClick={() => setActiveTab("Opname")}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 cursor-pointer ${
                    activeTab === "Opname"
                      ? "bg-[#E2FF66] text-[#2B2B2B] shadow-md font-bold"
                      : isDarkMode
                        ? "bg-white/5 text-[#94A3B8] hover:bg-white/10 hover:text-white"
                        : "bg-white/40 text-[#2B2B2B] hover:bg-white/60 hover:shadow-md"
                  }`}
                >
                  <ClipboardCheck className="w-4 h-4 shrink-0" />
                  <span>Opname Fisik</span>
                </button>

                {/* Procurement */}
                <button
                  type="button"
                  onClick={() => setActiveTab("Procurement")}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 cursor-pointer ${
                    activeTab === "Procurement"
                      ? "bg-[#E2FF66] text-[#2B2B2B] shadow-md font-bold"
                      : isDarkMode
                        ? "bg-white/5 text-[#94A3B8] hover:bg-white/10 hover:text-white"
                        : "bg-white/40 text-[#2B2B2B] hover:bg-white/60 hover:shadow-md"
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4 shrink-0" />
                  <span>Procurement</span>
                </button>

                {/* Analytics */}
                <button
                  type="button"
                  onClick={() => setActiveTab("Analytics")}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 cursor-pointer ${
                    activeTab === "Analytics"
                      ? "bg-[#E2FF66] text-[#2B2B2B] shadow-md font-bold"
                      : isDarkMode
                        ? "bg-white/5 text-[#94A3B8] hover:bg-white/10 hover:text-white"
                        : "bg-white/40 text-[#2B2B2B] hover:bg-white/60 hover:shadow-md"
                  }`}
                >
                  <BarChart3 className="w-4 h-4 shrink-0" />
                  <span>Analytics</span>
                </button>
              </nav>
            )}
          </div>

          {/* Sidebar Footer — Tools Group (rearranged, reversed, expand handle) */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800/40 mt-auto shrink-0 relative">
            {!isSidebarCollapsed ? (
              /* Expanded Sidebar: Horizontal row of tools in reversed order */
              <div className="flex items-center justify-between px-1">
                
                {/* 1. Profile Avatar */}
                <div className="relative shrink-0">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowProfilePopover(!showProfilePopover);
                      setShowSettingsPopover(false);
                    }}
                    className="w-8 h-8 rounded-full bg-[#9362FC] flex items-center justify-center font-bold text-white shadow-sm shrink-0 cursor-pointer overflow-hidden hover:opacity-90 active:scale-95 transition-all text-xs"
                  >
                    J
                  </button>
                  
                  {/* Profile Popover */}
                  {showProfilePopover && (
                    <>
                      <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowProfilePopover(false)} />
                      <div className={`absolute left-0 bottom-11 w-56 p-3 rounded-2xl shadow-xl border z-50 text-left transition-all duration-200 ${
                        isDarkMode ? "bg-[#292929] border-[#3A3A3A] text-white" : "bg-white border-[#B8B9BE] text-[#2B2B2B]"
                      }`}>
                        <div className="pb-2 border-b border-border/40 mb-2">
                          <p className="text-xs font-bold">Josiah Cashier</p>
                          <p className="text-[9px] opacity-65">Manager POS (Owner Role)</p>
                        </div>
                        <div className="space-y-1">
                          <button type="button" onClick={() => { alert("Profile Settings"); setShowProfilePopover(false); }} className="w-full text-left px-2 py-1.5 text-[10px] font-semibold rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">Profile Settings</button>
                          <button type="button" onClick={() => { alert("Logout successful!"); setShowProfilePopover(false); }} className="w-full text-left px-2 py-1.5 text-[10px] font-bold text-red-500 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer">Sign Out</button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* 2. Settings Gear */}
                <div className="relative shrink-0">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowSettingsPopover(!showSettingsPopover);
                      setShowProfilePopover(false);
                    }}
                    className={`p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-full cursor-pointer transition-colors shrink-0 ${showSettingsPopover ? "text-[#9362FC]" : "text-foreground dark:text-white"}`}
                    title="POS Settings"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  
                  {/* Settings Popover */}
                  {showSettingsPopover && (
                    <>
                      <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowSettingsPopover(false)} />
                      <div className={`absolute left-0 bottom-11 w-64 p-3.5 rounded-2xl shadow-xl border z-50 text-left transition-all duration-200 ${
                        isDarkMode ? "bg-[#292929] border-[#3A3A3A] text-white" : "bg-white border-[#B8B9BE] text-[#2B2B2B]"
                      }`}>
                        <div className="pb-2 border-b border-border/40 mb-2.5">
                          <p className="text-xs font-bold">POS Configuration</p>
                          <p className="text-[10px] opacity-65">Customize your workspace</p>
                        </div>
                        <div className="space-y-3.5">
                          <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                            <span className="opacity-80">Show Virtual Numpad</span>
                            <input 
                              type="checkbox" 
                              checked={showNumpad}
                              onChange={(e) => setShowNumpad(e.target.checked)}
                              className="w-3.5 h-3.5 accent-[#9362FC] dark:accent-[#E2FF66] cursor-pointer rounded"
                            />
                          </label>
                          <div className="space-y-1.5">
                            <p className="text-xs font-bold opacity-80">Product Grid Columns</p>
                            <div className="grid grid-cols-4 gap-1.5">
                              {[3, 4, 5, 6].map((cols) => (
                                <button
                                  key={cols}
                                  type="button"
                                  onClick={() => setGridCols(cols)}
                                  className={`py-1 text-[9px] font-bold rounded-lg transition-all border ${
                                    gridCols === cols ? "bg-[#9362FC] border-[#9362FC] text-white shadow-sm" : isDarkMode ? "bg-[#3A3A3A] border-transparent text-[#94A3B8] hover:bg-[#404040]" : "bg-slate-50 border-[#B8B9BE]/60 text-[#2B2B2B] hover:bg-slate-100"
                                  }`}
                                >
                                  {cols}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* 3. Calendar Icon */}
                <button 
                  type="button" 
                  className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-full cursor-pointer transition-colors shrink-0"
                  onClick={() => alert("Calendar clicked")}
                >
                  <Calendar className="w-4 h-4 text-foreground" />
                </button>

                {/* 4. Bell Icon */}
                <button 
                  type="button" 
                  className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-full cursor-pointer transition-colors relative shrink-0"
                  onClick={() => alert("Notifications clicked")}
                >
                  <Bell className="w-4 h-4 text-foreground" />
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#9362FC]"></span>
                </button>

                {/* 5. Theme Toggle Button */}
                <button
                  type="button"
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-full cursor-pointer transition-all text-foreground"
                  title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                  {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
                </button>

              </div>
            ) : (
              /* Collapsed Sidebar: Only show Profile Avatar and Expand Chevron Right button */
              <div className="flex flex-col items-center space-y-3 relative">
                
                {/* Profile Avatar */}
                <button 
                  type="button"
                  onClick={() => {
                    setShowProfilePopover(!showProfilePopover);
                    setShowSettingsPopover(false);
                    setIsToolsGroupExpanded(false);
                  }}
                  className="w-8 h-8 rounded-full bg-[#9362FC] flex items-center justify-center font-bold text-white shadow-sm shrink-0 cursor-pointer overflow-hidden hover:opacity-90 active:scale-95 transition-all text-xs"
                >
                  J
                </button>

                {/* Profile Popover when collapsed */}
                {showProfilePopover && (
                  <>
                    <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowProfilePopover(false)} />
                    <div className={`absolute left-14 bottom-12 w-56 p-3 rounded-2xl shadow-xl border z-50 text-left transition-all duration-200 ${
                      isDarkMode ? "bg-[#292929] border-[#3A3A3A] text-white" : "bg-white border-[#B8B9BE] text-[#2B2B2B]"
                    }`}>
                      <div className="pb-2 border-b border-border/40 mb-2">
                        <p className="text-xs font-bold">Josiah Cashier</p>
                        <p className="text-[9px] opacity-65">Manager POS (Owner Role)</p>
                      </div>
                      <div className="space-y-1">
                        <button type="button" onClick={() => { alert("Profile Settings"); setShowProfilePopover(false); }} className="w-full text-left px-2 py-1.5 text-[10px] font-semibold rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">Profile Settings</button>
                        <button type="button" onClick={() => { alert("Logout successful!"); setShowProfilePopover(false); }} className="w-full text-left px-2 py-1.5 text-[10px] font-bold text-red-500 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer">Sign Out</button>
                      </div>
                    </div>
                  </>
                )}

                {/* Chevron Right button for non-permanent tools group expand */}
                <button
                  type="button"
                  onClick={() => {
                    setIsToolsGroupExpanded(!isToolsGroupExpanded);
                    setShowProfilePopover(false);
                    setShowSettingsPopover(false);
                  }}
                  className={`p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-full cursor-pointer transition-colors ${
                    isToolsGroupExpanded ? "bg-[#9362FC]/20 text-[#9362FC]" : "text-foreground"
                  }`}
                  title="Show More Tools"
                >
                  <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isToolsGroupExpanded ? "rotate-90" : ""}`} />
                </button>

                {/* Non-permanent expanded Tools Popup */}
                {isToolsGroupExpanded && (
                  <>
                    <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsToolsGroupExpanded(false)} />
                    <div className={`absolute left-14 bottom-0 flex flex-col items-center p-1.5 rounded-xl shadow-xl border z-50 space-y-2 transition-all duration-200 ${
                      isDarkMode ? "bg-[#292929] border-[#3A3A3A] text-white" : "bg-white border-[#B8B9BE] text-[#2B2B2B]"
                    }`}>
                      
                      {/* Settings Gear inside collapsed expand popover */}
                      <div className="relative">
                        <button 
                          type="button"
                          onClick={() => {
                            setShowSettingsPopover(!showSettingsPopover);
                            setShowProfilePopover(false);
                          }}
                          className={`p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-full cursor-pointer transition-colors ${showSettingsPopover ? "text-[#9362FC]" : "text-foreground dark:text-white"}`}
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        {showSettingsPopover && (
                          <>
                            <div className="fixed inset-0 z-55 bg-transparent" onClick={() => setShowSettingsPopover(false)} />
                            <div className={`absolute left-10 bottom-0 w-64 p-3.5 rounded-2xl shadow-xl border z-55 text-left transition-all duration-200 ${
                              isDarkMode ? "bg-[#292929] border-[#3A3A3A] text-white" : "bg-white border-[#B8B9BE] text-[#2B2B2B]"
                            }`}>
                              <div className="pb-2 border-b border-border/40 mb-2.5">
                                <p className="text-xs font-bold">POS Configuration</p>
                                <p className="text-[10px] opacity-65">Customize your workspace</p>
                              </div>
                              <div className="space-y-3.5">
                                <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                                  <span className="opacity-80">Show Virtual Numpad</span>
                                  <input 
                                    type="checkbox" 
                                    checked={showNumpad}
                                    onChange={(e) => setShowNumpad(e.target.checked)}
                                    className="w-3.5 h-3.5 accent-[#9362FC] dark:accent-[#E2FF66] cursor-pointer rounded"
                                  />
                                </label>
                                <div className="space-y-1.5">
                                  <p className="text-xs font-bold opacity-80">Product Grid Columns</p>
                                  <div className="grid grid-cols-4 gap-1.5">
                                    {[3, 4, 5, 6].map((cols) => (
                                      <button
                                        key={cols}
                                        type="button"
                                        onClick={() => { setGridCols(cols); setShowSettingsPopover(false); setIsToolsGroupExpanded(false); }}
                                        className={`py-1 text-[9px] font-bold rounded-lg transition-all border ${
                                          gridCols === cols ? "bg-[#9362FC] border-[#9362FC] text-white shadow-sm" : isDarkMode ? "bg-[#3A3A3A] border-transparent text-[#94A3B8] hover:bg-[#404040]" : "bg-slate-50 border-[#B8B9BE]/60 text-[#2B2B2B] hover:bg-slate-100"
                                        }`}
                                      >
                                        {cols}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Calendar Icon */}
                      <button 
                        type="button" 
                        className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-full cursor-pointer transition-colors"
                        onClick={() => { alert("Calendar clicked"); setIsToolsGroupExpanded(false); }}
                      >
                        <Calendar className="w-4 h-4 text-foreground" />
                      </button>

                      {/* Bell Icon */}
                      <button 
                        type="button" 
                        className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-full cursor-pointer transition-colors relative"
                        onClick={() => { alert("Notifications clicked"); setIsToolsGroupExpanded(false); }}
                      >
                        <Bell className="w-4 h-4 text-foreground" />
                        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#9362FC]"></span>
                      </button>

                      {/* Theme Toggle Button */}
                      <button
                        type="button"
                        onClick={() => { setIsDarkMode(!isDarkMode); setIsToolsGroupExpanded(false); }}
                        className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-full cursor-pointer transition-all text-foreground"
                      >
                        {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
                      </button>

                    </div>
                  </>
                )}

              </div>
            )}
          </div>
        </aside>

        {/* ================= MAIN CONTAINER ================= */}
        <main className="flex-1 flex flex-col overflow-hidden">
          


          {/* INNER GRID */}
          <div className="flex-1 flex overflow-hidden">
            
            {/* ================= PRODUCTS & SEARCH PANEL ================= */}
            <section className="flex-1 flex flex-col overflow-hidden p-6.5 space-y-5">

              {/* Search Bar & Barcode Scanner button (Rounded Pill design) */}
              <div className="flex gap-3 flex-shrink-0">
                <div className="flex-1 relative">
                  <Search className="absolute left-5 top-4.5 w-4 h-4 text-[#2B2B2B] opacity-65" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Products by Name or Barcode..."
                    className={`w-full pl-12 pr-6 py-3 rounded-full border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#9362FC]/40 focus:border-[#9362FC] transition-colors ${
                      isDarkMode ? "bg-[#292929] border-[#3A3A3A] text-white" : "bg-[#FFFFFF] border-[#B8B9BE] text-[#2B2B2B]"
                    }`}
                  />
                </div>
                
                <button 
                  type="button" 
                  className="flex items-center space-x-2 px-6 py-3.5 bg-[#2B2B2B] hover:bg-[#1E1E1E] text-white font-semibold rounded-full shadow-sm transition-all cursor-pointer shrink-0"
                >
                  <Barcode className="w-4 h-4" />
                  <span className="text-xs">Scan Barcode</span>
                </button>
              </div>

              {/* Horizontal Category Pill selector with scroll right help button */}
              <div className="relative flex items-center w-full flex-shrink-0">
                <div 
                  ref={categoryRef}
                  className="flex-1 flex space-x-3 overflow-x-auto pb-3 scrollbar-thin scroll-smooth"
                >
                  {categories.map((cat) => {
                    const isCatActive = activeCategory === cat.name;
                    return (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => setActiveCategory(cat.name)}
                        className={`flex flex-col items-center justify-between p-3.5 min-w-[105px] h-22 rounded-2xl border transition-all duration-200 cursor-pointer shrink-0 ${
                          isCatActive
                            ? isDarkMode
                              ? "bg-[#E2FF66] border-[#E2FF66] text-[#2B2B2B] shadow-md shadow-[#E2FF66]/15"
                              : "bg-[#2B2B2B] border-[#2B2B2B] text-white shadow-md shadow-[#2B2B2B]/15"
                            : isDarkMode
                              ? "bg-[#292929] border-[#3A3A3A] text-[#F3EFE9] hover:bg-[#333333]"
                              : "bg-[#FFFFFF] border-[#B8B9BE] text-[#2B2B2B] hover:bg-[#FFFFFF]/90"
                        }`}
                      >
                        <span className="text-xs opacity-75 font-semibold self-start">{cat.name}</span>
                        <span className="text-lg font-bold self-end mt-1">{cat.count.toLocaleString()}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Chevron Right button helper to scroll categories */}
                <button
                  type="button"
                  onClick={() => {
                    categoryRef.current?.scrollBy({ left: 180, behavior: 'smooth' });
                  }}
                  className="h-22 w-6 flex items-center justify-center bg-transparent border-0 text-muted-foreground hover:text-foreground hover:scale-110 transition-all shrink-0 cursor-pointer ml-1 shadow-none"
                  title="Scroll categories right"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Choose Products Grid */}
              <div className="flex-1 flex flex-col min-h-0 space-y-4">
                <h3 className="text-base font-bold text-left uppercase tracking-wider opacity-85 flex-shrink-0">Choose Products</h3>
                
                <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin pb-4">
                  {filteredProducts.length === 0 ? (
                    <div className={`p-12 text-center border border-dashed rounded-3xl ${isDarkMode ? "border-[#3A3A3A] text-slate-500" : "border-[#E8E4D9] text-slate-400"}`}>
                      <span className="text-4xl block mb-2">🔍</span>
                      <p className="text-sm font-medium">No products found matching your filter</p>
                    </div>
                  ) : (
                    <div className={`grid grid-cols-1 md:grid-cols-2 ${gridColsClass} gap-5`}>
                    {filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleAddProductToCart(p)}
                        className={`group relative flex flex-col justify-between overflow-hidden border rounded-2xl p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
                          isDarkMode
                            ? "bg-[#292929] border-[#3A3A3A] hover:border-[#E2FF66]/50"
                            : "bg-[#FFFFFF] border-[#B8B9BE] hover:border-[#9362FC]/50 text-[#2B2B2B]"
                        }`}
                      >
                        {/* Image aspect ratio square */}
                        <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 mb-3">
                          <img
                            src={p.image}
                            alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>

                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <h4 className="font-bold text-xs leading-snug line-clamp-2 mb-1 text-[#2B2B2B] dark:text-white">{p.name}</h4>
                            <p className="text-[10px] opacity-60">Code: {p.code}</p>
                            <p className={`text-[10px] font-bold mt-1 ${p.available < 20 ? "text-amber-500" : "opacity-60"}`}>
                              Available: {p.available}
                            </p>
                          </div>

                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-dashed border-[#B8B9BE] dark:border-[#3A3A3A]">
                            <span className="text-sm font-bold text-[#9362FC] dark:text-[#E2FF66]">$ {p.price}</span>
                            <span className="w-6.5 h-6.5 rounded-lg bg-[#9362FC]/10 flex items-center justify-center text-[#9362FC] text-xs font-bold group-hover:bg-[#9362FC] group-hover:text-white transition-colors dark:group-hover:bg-[#E2FF66] dark:group-hover:text-[#2B2B2B] dark:text-[#E2FF66]">
                              +
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                    </div>
                )}
              </div>
            </div>

          </section>

            <aside className="w-[430px] flex flex-col justify-between overflow-hidden shrink-0 bg-transparent py-5.5 pr-5.5 space-y-4">
              
              {/* Order Cart list */}
              <div className={`flex-1 flex flex-col overflow-hidden p-5 rounded-2xl transition-colors ${
                isDarkMode ? "bg-[#292929] border border-[#3A3A3A]" : "bg-[#FFFFFF] shadow-sm"
              }`}>
                
                {/* Header info */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/40 mb-4">
                  <div>
                    <h3 className="font-bold text-base text-[#2B2B2B] dark:text-white">Order No: 125125</h3>
                    <p className="text-xs opacity-60">Items in basket: {cart.length}</p>
                  </div>
                  {cart.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearCart}
                      className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
                      title="Clear Cart"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Items List scrollable */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-20 text-center text-slate-450">
                      <span className="text-5xl mb-3">🛒</span>
                      <p className="text-sm font-semibold">Shopping basket is empty</p>
                      <p className="text-xs opacity-60 max-w-xs mt-1">Click on products on the left to add items to this order.</p>
                    </div>
                  ) : (
                    cart.map((item, idx) => {
                      const isSelected = selectedCartIndex === idx;
                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedCartIndex(idx)}
                          className={`p-3 rounded-2xl border transition-all duration-150 flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? isDarkMode
                                ? "border-[#E2FF66] bg-[#E2FF66]/10 text-white"
                                : "border-[#9362FC] bg-[#9362FC]/5"
                              : isDarkMode
                                ? "border-transparent bg-[#3A3A3A]/30 hover:bg-[#3A3A3A]/60"
                                : "border-transparent bg-slate-50/50 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center space-x-3 min-w-0 flex-1">
                            <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-slate-100">
                              <img src={item.product.image} alt={item.product.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-xs leading-snug truncate">{item.product.name}</h4>
                              <p className="text-[10px] opacity-60">Code: {item.product.code}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isDarkMode ? "bg-[#3A3A3A]" : "bg-slate-100"}`}>
                                  Size: {item.size}
                                </span>
                                {showNumpad ? (
                                  <span className="text-[10px] opacity-75 font-semibold text-[#9362FC] dark:text-[#E2FF66]">
                                    Qty: {item.quantity}
                                  </span>
                                ) : (
                                  <div className="flex items-center space-x-1">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUpdateQty(idx, -1);
                                      }}
                                      className={`w-4 h-4 rounded flex items-center justify-center font-bold text-[10px] transition-colors cursor-pointer ${
                                        isDarkMode ? "bg-[#3A3A3A] hover:bg-[#404040] text-white" : "bg-slate-100 hover:bg-slate-200 text-[#2B2B2B]"
                                      }`}
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      min="1"
                                      value={item.quantity}
                                      onChange={(e) => {
                                        const val = Math.max(1, parseInt(e.target.value) || 1);
                                        handleSetQty(idx, val);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className={`w-7 px-1 py-0 rounded border text-center font-bold text-[9px] focus:outline-none focus:ring-1 focus:ring-[#9362FC] no-spinner ${
                                        isDarkMode 
                                          ? "bg-[#292929] border-[#3A3A3A] text-white" 
                                          : "bg-white border-[#B8B9BE] text-[#2B2B2B]"
                                      }`}
                                    />
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUpdateQty(idx, 1);
                                      }}
                                      className={`w-4 h-4 rounded flex items-center justify-center font-bold text-[10px] transition-colors cursor-pointer ${
                                        isDarkMode ? "bg-[#3A3A3A] hover:bg-[#404040] text-white" : "bg-slate-100 hover:bg-slate-200 text-[#2B2B2B]"
                                      }`}
                                    >
                                      +
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end justify-between ml-3 space-y-2 h-full">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveFromCart(idx);
                              }}
                              className="text-slate-400 hover:text-red-500 text-xs font-bold"
                            >
                              ✕
                            </button>
                            <span className="font-bold text-xs">$ {item.product.price * item.quantity}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Subtotal & summary details */}
              <div className={`p-4 space-y-3 shrink-0 rounded-2xl transition-colors ${
                isDarkMode ? "bg-[#292929] border border-[#3A3A3A]" : "bg-[#FFFFFF] shadow-sm"
              }`}>
                {/* Lilac Card background for summary metrics */}
                <div className={`p-3.5 rounded-xl text-xs space-y-1.5 font-semibold ${isDarkMode ? "bg-[#3A3A3A] text-white" : "bg-[#E7DCFD] text-[#2B2B2B]"}`}>
                  <div className="flex justify-between items-center">
                    <span className="opacity-75">Subtotal</span>
                    <span>$ {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[#9362FC] dark:text-[#E2FF66]">
                    {showNumpad ? (
                      <span>Discount ({discountRate}%)</span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="opacity-75">Discount (%):</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={discountRate}
                          onChange={(e) => setDiscountRate(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                          className={`w-12 px-1.5 py-0.5 rounded border text-center font-bold text-xs focus:outline-none focus:ring-1 focus:ring-[#9362FC] no-spinner ${
                            isDarkMode 
                              ? "bg-[#292929] border-[#3A3A3A] text-white" 
                              : "bg-white border-[#B8B9BE] text-[#2B2B2B]"
                          }`}
                        />
                      </div>
                    )}
                    <span>-$ {discountAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    {showNumpad ? (
                      <span className="opacity-75">Tax ({taxRate}%)</span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="opacity-75">Tax (%):</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={taxRate}
                          onChange={(e) => setTaxRate(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                          className={`w-12 px-1.5 py-0.5 rounded border text-center font-bold text-xs focus:outline-none focus:ring-1 focus:ring-[#9362FC] no-spinner ${
                            isDarkMode 
                              ? "bg-[#292929] border-[#3A3A3A] text-white" 
                              : "bg-white border-[#B8B9BE] text-[#2B2B2B]"
                          }`}
                        />
                      </div>
                    )}
                    <span>$ {taxAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-base font-bold pt-2 border-t border-dashed border-[#B8B9BE] text-[#9362FC] dark:text-[#E2FF66]">
                    <span>Total Amount</span>
                    <span>$ {totalAmount.toFixed(2)}</span>
                  </div>
                </div>

                {showNumpad ? (
                  <>
                    {/* Quick actions tabs: Qty, Tax, Discount */}
                    <div className="flex bg-[#F3EFE4] dark:bg-[#292929] p-1 rounded-full gap-1">
                      <button
                        type="button"
                        onClick={() => setNumpadMode("qty")}
                        className={`flex-1 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
                          numpadMode === "qty"
                            ? "bg-[#9362FC] text-white shadow-sm"
                            : "text-muted-foreground hover:text-[#2B2B2B] dark:hover:text-white"
                        }`}
                      >
                        Quantity
                      </button>
                      <button
                        type="button"
                        onClick={() => setNumpadMode("tax")}
                        className={`flex-1 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
                          numpadMode === "tax"
                            ? "bg-[#9362FC] text-white shadow-sm"
                            : "text-muted-foreground hover:text-[#2B2B2B] dark:hover:text-white"
                        }`}
                      >
                        Tax
                      </button>
                      <button
                        type="button"
                        onClick={() => setNumpadMode("discount")}
                        className={`flex-1 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
                          numpadMode === "discount"
                            ? "bg-[#9362FC] text-white shadow-sm"
                            : "text-muted-foreground hover:text-[#2B2B2B] dark:hover:text-white"
                        }`}
                      >
                        Discount
                      </button>
                    </div>

                    {/* Numpad layout & checkout payment button */}
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        "7", "8", "9", "C",
                        "4", "5", "6", "+",
                        "1", "2", "3", "-",
                        ".", "0"
                      ].map((key) => {
                        const isSpecial = ["C", "+", "-"].includes(key);
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => handleNumpadPress(key)}
                            className={`p-3 text-sm font-bold rounded-xl transition-all cursor-pointer ${
                              isSpecial
                                ? "bg-[#9362FC]/10 hover:bg-[#9362FC]/20 text-[#9362FC]"
                                : isDarkMode
                                  ? "bg-[#3A3A3A] hover:bg-[#404040] text-white"
                                  : "bg-[#FFFFFF] hover:bg-slate-50 text-[#2B2B2B] shadow-sm"
                            }`}
                          >
                            {key}
                          </button>
                        );
                      })}
                      
                      {/* Payment Button spanning 2 cols */}
                      <button
                        type="button"
                        onClick={handleCheckout}
                        disabled={cart.length === 0}
                        className="col-span-2 row-span-1 p-3 bg-[#9362FC] hover:bg-[#7D4BE3] disabled:bg-slate-350 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center animate-pulse"
                      >
                        Payment
                      </button>
                    </div>
                  </>
                ) : (
                  /* Pay now full-width button when numpad is hidden */
                  <button
                    type="button"
                    onClick={handleCheckout}
                    disabled={cart.length === 0}
                    className="w-full py-4 bg-[#9362FC] hover:bg-[#7D4BE3] disabled:bg-slate-350 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center text-sm"
                    style={{ minHeight: "56px" }}
                  >
                    Payment
                  </button>
                )}

                {/* Bottom Action buttons */}
                <div className="flex gap-3 pt-1.5">
                  <button
                    type="button"
                    onClick={() => alert("Refund transaction initiated.")}
                    className="flex-1 py-2 text-xs font-bold border border-[#B8B9BE] dark:border-[#3A3A3A] hover:bg-muted text-foreground rounded-xl transition-all cursor-pointer"
                  >
                    Refund
                  </button>
                  <button
                    type="button"
                    onClick={() => alert("POS cashier session ended.")}
                    className="flex-1 py-2 text-xs font-bold border border-[#B8B9BE] dark:border-[#3A3A3A] hover:bg-muted text-[#2B2B2B] dark:text-white rounded-xl transition-all cursor-pointer"
                  >
                    End Session
                  </button>
                </div>

              </div>

            </aside>

          </div>

        </main>
      </div>

      {/* Checkout Payment Modal overlay */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-[#2B2B2B]">
          <div className={`w-full max-w-md border rounded-3xl p-6 shadow-2xl transition-all ${
            isDarkMode ? "bg-[#292929] border-[#3A3A3A] text-white" : "bg-[#FFFFFF] border-[#B8B9BE]"
          }`}>
            
            <div className="pb-4 border-b border-dashed border-[#B8B9BE] dark:border-[#3A3A3A] mb-5">
              <h3 className="text-lg font-bold dark:text-white">Transaction Details</h3>
              <p className="text-xs text-muted-foreground">Select type and payment method</p>
            </div>

            <div className="space-y-5 text-sm">
              {/* Transaction Type Choice */}
              <div className="space-y-2">
                <label className="text-xs font-bold opacity-75">Transaction Type</label>
                <div className="flex bg-[#F3EFE4] dark:bg-[#3A3A3A] p-1 rounded-full gap-1">
                  <button
                    type="button"
                    onClick={() => setTransactionType("Sales")}
                    className={`flex-1 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
                      transactionType === "Sales"
                        ? "bg-[#9362FC] text-white shadow-sm"
                        : "text-muted-foreground hover:text-[#2B2B2B] dark:hover:text-white"
                    }`}
                  >
                    Sales (Penjualan)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransactionType("Pengambilan Pribadi")}
                    className={`flex-1 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
                      transactionType === "Pengambilan Pribadi"
                        ? "bg-[#9362FC] text-white shadow-sm"
                        : "text-muted-foreground hover:text-[#2B2B2B] dark:hover:text-white"
                    }`}
                  >
                    Pengambilan Pribadi
                  </button>
                </div>
              </div>

              {/* Payment Method Choice (only if Sales) */}
              {transactionType === "Sales" && (
                <div className="space-y-2">
                  <label className="text-xs font-bold opacity-75">Payment Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "Cash", label: "Cash (Tunai)" },
                      { id: "QRIS", label: "QRIS" },
                      { id: "Debit", label: "Debit Card" },
                      { id: "Credit", label: "Credit Card" }
                    ].map((method) => {
                      const isSelected = paymentMethod === method.id;
                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setPaymentMethod(method.id as any)}
                          className={`p-3 rounded-2xl border text-center font-bold text-xs transition-all cursor-pointer flex items-center justify-center space-x-2 ${
                            isSelected
                              ? isDarkMode
                                ? "bg-[#E2FF66]/15 border-[#E2FF66] text-[#E2FF66]"
                                : "bg-[#9362FC]/10 border-[#9362FC] text-[#9362FC]"
                              : isDarkMode
                                ? "bg-[#3A3A3A] border-transparent text-[#94A3B8] hover:bg-[#404040]"
                                : "bg-slate-50 border-[#B8B9BE]/60 text-[#2B2B2B] hover:bg-slate-100"
                          }`}
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>{method.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Checkout Summary in Payment Modal */}
              <div className={`p-4 rounded-2xl text-xs space-y-2 font-semibold ${isDarkMode ? "bg-[#3A3A3A] text-white" : "bg-[#E7DCFD] text-[#2B2B2B]"}`}>
                <div className="flex justify-between">
                  <span className="opacity-75">Items Count:</span>
                  <span>{cart.reduce((sum, item) => sum + item.quantity, 0)} items</span>
                </div>
                <div className="flex justify-between text-base font-bold pt-2 border-t border-dashed border-[#B8B9BE] text-[#9362FC] dark:text-[#E2FF66]">
                  <span>Total Amount</span>
                  <span>$ {totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Actions: Cancel (Batal) and Confirm Payment (Konfirmasi) */}
            <div className="flex gap-4 mt-6">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 py-3 text-xs font-bold border border-[#B8B9BE] dark:border-[#3A3A3A] hover:bg-muted rounded-xl transition-all cursor-pointer dark:text-white"
              >
                Cancel (Add More Items)
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                className="flex-1 py-3 text-xs font-bold bg-[#9362FC] text-white hover:bg-[#7D4BE3] rounded-xl transition-all cursor-pointer shadow-md"
              >
                Confirm & Pay
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Checkout Success Modal overlay */}
      {showCheckoutSuccess && lastOrderDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-[#2B2B2B]">
          <div className={`w-full max-w-md border rounded-3xl p-6 shadow-2xl transition-all ${
            isDarkMode ? "bg-[#292929] border-[#3A3A3A] text-white" : "bg-[#FFFFFF] border-[#B8B9BE]"
          }`}>
            <div className="text-center space-y-3 mb-6">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
              <h3 className="text-xl font-bold dark:text-white">Checkout Successful!</h3>
              <p className="text-xs text-muted-foreground">Order No: {lastOrderDetails.orderNo} has been processed</p>
            </div>

            <div className="space-y-4 text-xs font-mono border-t border-b border-dashed border-[#B8B9BE] dark:border-[#3A3A3A] py-4 my-4 max-h-[250px] overflow-y-auto dark:text-white">
              <div className="flex justify-between opacity-75">
                <span>Date:</span>
                <span>{lastOrderDetails.date}</span>
              </div>
              <div className="flex justify-between opacity-75">
                <span>Type:</span>
                <span className="font-bold text-amber-500">{lastOrderDetails.transactionType}</span>
              </div>
              <div className="flex justify-between opacity-75">
                <span>Payment:</span>
                <span className="font-bold text-[#9362FC] dark:text-[#E2FF66]">{lastOrderDetails.paymentMethod}</span>
              </div>
              
              <div className="space-y-1.5 pt-2 border-t border-[#B8B9BE] dark:border-[#3A3A3A]">
                {lastOrderDetails.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between">
                    <span>{item.product.name} (x{item.quantity})</span>
                    <span>$ {(item.product.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 pt-2 border-t border-[#B8B9BE] dark:border-[#3A3A3A] font-semibold">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>$ {lastOrderDetails.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-amber-500 font-bold">
                  <span>Discount:</span>
                  <span>-$ {lastOrderDetails.discountAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span>$ {lastOrderDetails.taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-[#B8B9BE] dark:border-[#3A3A3A] text-[#9362FC] dark:text-[#E2FF66]">
                  <span>TOTAL AMOUNT:</span>
                  <span>$ {lastOrderDetails.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => {
                  alert("Receipt printed successfully!");
                }}
                className="flex-1 py-3 text-xs font-bold border border-[#B8B9BE] dark:border-[#3A3A3A] hover:bg-muted rounded-xl transition-all cursor-pointer dark:text-white"
              >
                Print Receipt
              </button>
              <button
                type="button"
                onClick={confirmPayment}
                className="flex-1 py-3 text-xs font-bold bg-[#9362FC] text-white hover:bg-[#7D4BE3] rounded-xl transition-all cursor-pointer shadow-md"
              >
                New Transaction
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
