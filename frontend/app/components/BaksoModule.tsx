import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useAuthStore } from "../lib/store";
import { useLanguageStore } from "../lib/i18n";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "./ui/dropdown-menu";
import { 
  Sparkles, 
  Send, 
  CheckCircle, 
  AlertTriangle, 
  Flame, 
  Layers, 
  LogOut, 
  ClipboardCheck 
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku?: string;
  unit_type: string;
  inventory_mode: string;
  current_stock: number;
  min_stock_alert?: number;
  purchase_price: number;
  sell_price: number;
}

interface Production {
  id: string;
  product_id: string;
  qty_produced: number;
  produced_by: string;
  produced_at: string;
}

interface Distribution {
  id: string;
  product_id: string;
  sent_to_user_id: string;
  qty: number;
  status: "sent" | "received";
  sent_at: string;
  received_at?: string;
}

interface StockBatch {
  id: string;
  product_id: string;
  held_by_user_id: string;
  batch_status: "sealed" | "opened";
  quantity: number;
  opened_at?: string;
  quality_checked_at?: string;
  quality_check_status?: "pending" | "pass" | "discard";
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
  status: string;
}

export default function BaksoModule() {
  const { activeContext } = useAuthStore();
  const { language } = useLanguageStore();
  const isOwnerOrAdmin = activeContext?.role === "owner" || activeContext?.role === "admin_gudang";
  
  // Tabs configuration based on roles
  const tabs = isOwnerOrAdmin 
    ? [
        { id: "produksi", label: "Produksi Mandiri", icon: Sparkles },
        { id: "distribusi", label: "Kirim Distribusi", icon: Send },
        { id: "alerts", label: "Stok Menipis", icon: AlertTriangle }
      ]
    : [
        { id: "thaw", label: "Buka Pack (Thaw)", icon: Flame },
        { id: "penerimaan", label: "Terima Stok", icon: CheckCircle },
        { id: "qc", label: "Quality Check", icon: ClipboardCheck },
        { id: "closing", label: "Closing Harian", icon: LogOut },
        { id: "batches", label: "Stok Anda", icon: Layers }
      ];

  const [activeTab, setActiveTab] = useState(tabs[0].id);

  // Data lists
  const [products, setProducts] = useState<Product[]>([]);
  const [productions, setProductions] = useState<Production[]>([]);
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [stockBatches, setStockBatches] = useState<StockBatch[]>([]);
  const [stockAlerts, setStockAlerts] = useState<Product[]>([]);

  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form Inputs - Production
  const [prodProductID, setProdProductID] = useState("");
  const [prodQty, setProdQty] = useState("");

  // Form Inputs - Distribution
  const [distProductID, setDistProductID] = useState("");
  const [distStaffID, setDistStaffID] = useState("");
  const [distQty, setDistQty] = useState("");

  // Form Inputs - Thaw
  const [thawProductID, setThawProductID] = useState("");
  const [thawPacks, setThawPacks] = useState("");

  // Form Inputs - Closing
  const [closingQuantities, setClosingQuantities] = useState<Record<string, { sealed: string; opened: string }>>({});

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      // 1. Fetch products (filter by batch_thaw mode)
      const prodRes = await api.get("/products");
      const filteredProds = (prodRes.data || []).filter(
        (p: Product) => p.inventory_mode === "batch_thaw"
      );
      setProducts(filteredProds);

      if (isOwnerOrAdmin) {
        // Fetch production history
        const productionRes = await api.get("/productions");
        setProductions(productionRes.data || []);

        // Fetch distribution history
        const distRes = await api.get("/distributions");
        setDistributions(distRes.data || []);

        // Fetch staff members
        const staffRes = await api.get("/auth/staff");
        setStaffList(staffRes.data || []);

        // Fetch stock alerts
        const alertsRes = await api.get("/bakso/stock-alerts");
        setStockAlerts(alertsRes.data || []);
      } else {
        // Fetch staff's current batches
        const batchesRes = await api.get("/bakso/batches");
        setStockBatches(batchesRes.data || []);

        // Fetch staff's distribution receipts
        const distRes = await api.get("/distributions");
        setDistributions(distRes.data || []);

        // Initialize closing forms
        const initClosing: Record<string, { sealed: string; opened: string }> = {};
        filteredProds.forEach((p: Product) => {
          initClosing[p.id] = { sealed: "", opened: "" };
        });
        setClosingQuantities(initClosing);
      }
    } catch (err: any) {
      console.error("Error loading Bakso module data:", err);
      setError("Gagal memuat data Bakso");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeContext, activeTab]);

  // Form submissions
  const handleProductionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodProductID || !prodQty) {
      setError("Semua field produksi wajib diisi");
      return;
    }
    setError("");
    setSuccess("");
    try {
      await api.post("/productions", {
        product_id: prodProductID,
        qty_produced: parseFloat(prodQty) || 0
      });
      setSuccess("Produksi berhasil dicatat!");
      setProdQty("");
      fetchData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Gagal mencatat produksi");
    }
  };

  const handleDistributionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!distProductID || !distStaffID || !distQty) {
      setError("Semua field distribusi wajib diisi");
      return;
    }
    setError("");
    setSuccess("");
    try {
      await api.post("/distributions", {
        product_id: distProductID,
        sent_to_user_id: distStaffID,
        qty: parseFloat(distQty) || 0
      });
      setSuccess("Pengiriman distribusi berhasil dibuat!");
      setDistQty("");
      fetchData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Gagal membuat pengiriman");
    }
  };

  const handleThawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thawProductID || !thawPacks) {
      setError("Semua field thaw wajib diisi");
      return;
    }
    setError("");
    setSuccess("");
    try {
      await api.post("/bakso/thaw", {
        product_id: thawProductID,
        qty_packs: parseFloat(thawPacks) || 0
      });
      setSuccess("Konversi Pack ke Pcs (Thawing) berhasil dilakukan!");
      setThawPacks("");
      fetchData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Gagal memproses thaw");
    }
  };

  const handleReceiveDist = async (id: string) => {
    setError("");
    setSuccess("");
    try {
      await api.post(`/distributions/${id}/receive`);
      setSuccess("Stok kiriman berhasil diterima!");
      fetchData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Gagal menerima stok");
    }
  };

  const handleQC = async (batchID: string, status: "pass" | "discard") => {
    setError("");
    setSuccess("");
    try {
      await api.post(`/bakso/batches/${batchID}/qc`, { status });
      setSuccess(`Quality Check diproses: ${status.toUpperCase()}`);
      fetchData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Gagal memproses Quality Check");
    }
  };

  const handleClosingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const inputs = Object.entries(closingQuantities)
        .filter(([_, val]) => val.sealed !== "" || val.opened !== "")
        .map(([prodID, val]) => ({
          product_id: prodID,
          actual_sealed: parseFloat(val.sealed) || 0,
          actual_opened: parseFloat(val.opened) || 0
        }));

      if (inputs.length === 0) {
        setError("Masukkan minimal satu nilai stok closing");
        return;
      }

      await api.post("/bakso/closing", { closing_inputs: inputs });
      setSuccess("Closing harian berhasil dilaporkan!");
      // Reset form
      const resetClosing: Record<string, { sealed: string; opened: string }> = {};
      products.forEach((p) => {
        resetClosing[p.id] = { sealed: "", opened: "" };
      });
      setClosingQuantities(resetClosing);
      fetchData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Gagal melaporkan closing");
    }
  };

  // Helper names
  const getProductName = (id: string) => {
    const p = products.find((p) => p.id === id);
    return p ? p.name : "Bakso Varian";
  };

  const getStaffName = (id: string) => {
    const s = staffList.find((s) => s.id === id);
    return s ? s.name : "Staff";
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header section with glass background */}
      <div className="border border-slate-200 dark:border-slate-800/40 rounded-3xl p-6 bg-white/75 dark:bg-[#202024]/75 backdrop-blur-md shadow-sm">
        <h2 className="text-xl font-bold dark:text-white">Modul Bakso Kang Gemoy</h2>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
          Sistem Produksi Mandiri, Distribusi Titik Jualan, dan Batch Thaw Tracking.
        </p>
      </div>

      {/* Tabs list */}
      <div className="flex space-x-1.5 p-1 bg-slate-100 dark:bg-slate-800/40 rounded-full border border-slate-250/20 dark:border-slate-800/30 max-w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setError("");
                setSuccess("");
              }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-[#E2FF66] text-[#2B2B2B] shadow-sm"
                  : "text-slate-650 hover:text-slate-900 dark:text-slate-350 dark:hover:text-white"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Message feedback */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-750 dark:text-red-400 rounded-2xl text-xs font-bold">
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-emerald-750 dark:text-emerald-400 rounded-2xl text-xs font-bold">
          ✅ {success}
        </div>
      )}

      {/* Tab Contents */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 font-medium text-sm animate-pulse">
          Memuat data modul Bakso...
        </div>
      ) : (
        <>
          {/* TAB 1: PRODUKSI */}
          {activeTab === "produksi" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Form Input */}
              <div className="md:col-span-1 border border-slate-200 dark:border-slate-800/40 rounded-3xl p-6 bg-white/95 dark:bg-[#202024]/95 shadow-sm space-y-4">
                <h3 className="font-bold text-sm dark:text-white">Log Produksi Baru</h3>
                <form onSubmit={handleProductionSubmit} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Varian Bakso</label>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-250 dark:border-slate-850 dark:text-white text-xs font-semibold bg-transparent text-left cursor-pointer">
                        {prodProductID ? getProductName(prodProductID) : "Pilih Varian Bakso"}
                        <span className="text-[10px] opacity-60">▼</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#3A3A3E] shadow-xl rounded-xl p-1 w-56">
                        {products.map((p) => (
                          <DropdownMenuItem
                            key={p.id}
                            onClick={() => setProdProductID(p.id)}
                            className="text-xs px-3 py-2 cursor-pointer dark:text-white hover:bg-slate-100 dark:hover:bg-[#2B2B2F]"
                          >
                            {p.name} (Stok: {p.current_stock} Packs)
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Jumlah Produksi (Pack)</label>
                    <input
                      type="number"
                      step="any"
                      value={prodQty}
                      onChange={(e) => setProdQty(e.target.value)}
                      placeholder="Contoh: 15"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-250 dark:border-slate-850 dark:text-white text-xs font-semibold bg-transparent focus:outline-none focus:border-slate-400"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#E2FF66] text-[#2B2B2B] font-bold text-xs py-3 rounded-full hover:shadow-md cursor-pointer transition-shadow"
                  >
                    Simpan Log Produksi
                  </button>
                </form>
              </div>

              {/* History Table */}
              <div className="md:col-span-2 border border-slate-200 dark:border-slate-800/40 rounded-3xl p-6 bg-white/95 dark:bg-[#202024]/95 shadow-sm overflow-hidden flex flex-col">
                <h3 className="font-bold text-sm dark:text-white mb-4">Riwayat Produksi (Gudang Pusat)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-separate border-spacing-0">
                    <thead>
                      <tr className="bg-[#E7E9ED] dark:bg-[#2E2E34]">
                        <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350 rounded-l-lg">Tanggal</th>
                        <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350">Varian</th>
                        <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350 rounded-r-lg">Qty (Packs)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productions.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-center py-8 text-xs text-slate-450">
                            Belum ada riwayat produksi dicatat.
                          </td>
                        </tr>
                      ) : (
                        productions.map((p) => (
                          <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800/20">
                            <td className="px-4 py-3.5 text-xs font-semibold dark:text-white border-b border-slate-100 dark:border-slate-800/20">
                              {new Date(p.produced_at).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </td>
                            <td className="px-4 py-3.5 text-xs font-bold dark:text-white border-b border-slate-100 dark:border-slate-800/20">
                              {getProductName(p.product_id)}
                            </td>
                            <td className="px-4 py-3.5 text-xs font-bold text-right dark:text-white border-b border-slate-100 dark:border-slate-800/20">
                              {p.qty_produced} Pack
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DISTRIBUSI */}
          {activeTab === "distribusi" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Form Input */}
              <div className="md:col-span-1 border border-slate-200 dark:border-slate-800/40 rounded-3xl p-6 bg-white/95 dark:bg-[#202024]/95 shadow-sm space-y-4">
                <h3 className="font-bold text-sm dark:text-white">Kirim Distribusi Baru</h3>
                <form onSubmit={handleDistributionSubmit} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Varian Bakso</label>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-250 dark:border-slate-850 dark:text-white text-xs font-semibold bg-transparent text-left cursor-pointer">
                        {distProductID ? getProductName(distProductID) : "Pilih Varian Bakso"}
                        <span className="text-[10px] opacity-60">▼</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#3A3A3E] shadow-xl rounded-xl p-1 w-56">
                        {products.map((p) => (
                          <DropdownMenuItem
                            key={p.id}
                            onClick={() => setDistProductID(p.id)}
                            className="text-xs px-3 py-2 cursor-pointer dark:text-white hover:bg-slate-100 dark:hover:bg-[#2B2B2F]"
                          >
                            {p.name} (Stok: {p.current_stock} Packs)
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Penerima (Staff Carts)</label>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-250 dark:border-slate-850 dark:text-white text-xs font-semibold bg-transparent text-left cursor-pointer">
                        {distStaffID ? getStaffName(distStaffID) : "Pilih Penerima"}
                        <span className="text-[10px] opacity-60">▼</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#3A3A3E] shadow-xl rounded-xl p-1 w-56">
                        {staffList.map((s) => (
                          <DropdownMenuItem
                            key={s.id}
                            onClick={() => setDistStaffID(s.id)}
                            className="text-xs px-3 py-2 cursor-pointer dark:text-white hover:bg-slate-100 dark:hover:bg-[#2B2B2F]"
                          >
                            {s.name} ({s.role})
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Jumlah Kirim (Pack)</label>
                    <input
                      type="number"
                      step="any"
                      value={distQty}
                      onChange={(e) => setDistQty(e.target.value)}
                      placeholder="Contoh: 5"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-250 dark:border-slate-850 dark:text-white text-xs font-semibold bg-transparent focus:outline-none focus:border-slate-400"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#E2FF66] text-[#2B2B2B] font-bold text-xs py-3 rounded-full hover:shadow-md cursor-pointer transition-shadow"
                  >
                    Kirim Stok
                  </button>
                </form>
              </div>

              {/* History Table */}
              <div className="md:col-span-2 border border-slate-200 dark:border-slate-800/40 rounded-3xl p-6 bg-white/95 dark:bg-[#202024]/95 shadow-sm overflow-hidden flex flex-col">
                <h3 className="font-bold text-sm dark:text-white mb-4">Riwayat Distribusi Kiriman</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-separate border-spacing-0">
                    <thead>
                      <tr className="bg-[#E7E9ED] dark:bg-[#2E2E34]">
                        <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350 rounded-l-lg">Tanggal</th>
                        <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350">Staff</th>
                        <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350">Barang / Qty</th>
                        <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350 rounded-r-lg">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {distributions.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-8 text-xs text-slate-450">
                            Belum ada pengiriman distribusi dibuat.
                          </td>
                        </tr>
                      ) : (
                        distributions.map((d) => (
                          <tr key={d.id} className="border-b border-slate-100 dark:border-slate-800/20">
                            <td className="px-4 py-3.5 text-xs font-semibold dark:text-white border-b border-slate-100 dark:border-slate-800/20">
                              {new Date(d.sent_at).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "short",
                                year: "numeric"
                              })}
                            </td>
                            <td className="px-4 py-3.5 text-xs font-bold dark:text-white border-b border-slate-100 dark:border-slate-800/20">
                              {getStaffName(d.sent_to_user_id)}
                            </td>
                            <td className="px-4 py-3.5 text-xs font-bold dark:text-white border-b border-slate-100 dark:border-slate-800/20">
                              {getProductName(d.product_id)} ({d.qty} Pack)
                            </td>
                            <td className="px-4 py-3.5 text-xs font-bold text-right border-b border-slate-100 dark:border-slate-800/20">
                              <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] uppercase font-bold ${
                                d.status === "received"
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                                  : "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 animate-pulse"
                              }`}>
                                {d.status === "received" ? "Diterima" : "Dikirim"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STOK ALERTS */}
          {activeTab === "alerts" && (
            <div className="border border-slate-200 dark:border-slate-800/40 rounded-3xl p-6 bg-white/95 dark:bg-[#202024]/95 shadow-sm space-y-4">
              <h3 className="font-bold text-sm dark:text-white">Alert Safety Stock Menipis (Gudang Pusat)</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-[#E7E9ED] dark:bg-[#2E2E34]">
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350 rounded-l-lg">Varian Bakso</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350">Stok Pusat</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350">Min Threshold</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350 rounded-r-lg">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockAlerts.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                          ✅ Semua varian bakso berada di atas threshold safety stock!
                        </td>
                      </tr>
                    ) : (
                      stockAlerts.map((p) => (
                        <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800/20">
                          <td className="px-4 py-3.5 text-xs font-bold dark:text-white border-b border-slate-100 dark:border-slate-800/20">
                            {p.name}
                          </td>
                          <td className="px-4 py-3.5 text-xs font-bold dark:text-white border-b border-slate-100 dark:border-slate-800/20">
                            {p.current_stock} Packs
                          </td>
                          <td className="px-4 py-3.5 text-xs font-semibold text-slate-450 border-b border-slate-100 dark:border-slate-800/20">
                            {p.min_stock_alert || 0} Packs
                          </td>
                          <td className="px-4 py-3.5 text-xs font-bold text-right border-b border-slate-100 dark:border-slate-800/20">
                            <span className="inline-block px-2.5 py-1 rounded-full text-[9px] uppercase font-bold bg-red-55/10 text-red-500 animate-pulse">
                              Stok Menipis
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: THAW (STAFF) */}
          {activeTab === "thaw" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Thaw Form */}
              <div className="md:col-span-1 border border-slate-200 dark:border-slate-800/40 rounded-3xl p-6 bg-white/95 dark:bg-[#202024]/95 shadow-sm space-y-4">
                <h3 className="font-bold text-sm dark:text-white">Cairkan Bakso (Buka Pack)</h3>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Konversikan 1 Pack (Sealed) bakso beku Anda menjadi 20 Pcs (Opened) bakso siap jual di POS.
                </p>
                <form onSubmit={handleThawSubmit} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Pilih Varian Bakso</label>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-250 dark:border-slate-850 dark:text-white text-xs font-semibold bg-transparent text-left cursor-pointer">
                        {thawProductID ? getProductName(thawProductID) : "Pilih Varian"}
                        <span className="text-[10px] opacity-60">▼</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#3A3A3E] shadow-xl rounded-xl p-1 w-56">
                        {products.map((p) => {
                          const sealedBatch = stockBatches.find(
                            (b) => b.product_id === p.id && b.batch_status === "sealed"
                          );
                          const sealedQty = sealedBatch ? sealedBatch.quantity : 0;
                          return (
                            <DropdownMenuItem
                              key={p.id}
                              onClick={() => setThawProductID(p.id)}
                              className="text-xs px-3 py-2 cursor-pointer dark:text-white hover:bg-slate-100 dark:hover:bg-[#2B2B2F]"
                            >
                              {p.name} ({sealedQty} Packs Tersedia)
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Jumlah Pack Dibuka</label>
                    <input
                      type="number"
                      step="1"
                      value={thawPacks}
                      onChange={(e) => setThawPacks(e.target.value)}
                      placeholder="Contoh: 1"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-250 dark:border-slate-850 dark:text-white text-xs font-semibold bg-transparent focus:outline-none focus:border-slate-400"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#E2FF66] text-[#2B2B2B] font-bold text-xs py-3 rounded-full hover:shadow-md cursor-pointer transition-shadow"
                  >
                    Buka Pack & Cairkan (Thaw)
                  </button>
                </form>
              </div>

              {/* Status Batches */}
              <div className="md:col-span-2 border border-slate-200 dark:border-slate-800/40 rounded-3xl p-6 bg-white/95 dark:bg-[#202024]/95 shadow-sm overflow-hidden flex flex-col">
                <h3 className="font-bold text-sm dark:text-white mb-4">Status Stok Varian Anda</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-separate border-spacing-0">
                    <thead>
                      <tr className="bg-[#E7E9ED] dark:bg-[#2E2E34]">
                        <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350 rounded-l-lg">Varian Bakso</th>
                        <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350">Sealed (Packs)</th>
                        <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350 rounded-r-lg">Opened (Pcs)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => {
                        const sealedBatch = stockBatches.find(
                          (b) => b.product_id === p.id && b.batch_status === "sealed"
                        );
                        const openedBatch = stockBatches.find(
                          (b) => b.product_id === p.id && b.batch_status === "opened"
                        );
                        return (
                          <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800/20">
                            <td className="px-4 py-3.5 text-xs font-bold dark:text-white border-b border-slate-100 dark:border-slate-800/20">
                              {p.name}
                            </td>
                            <td className="px-4 py-3.5 text-xs font-semibold text-right dark:text-white border-b border-slate-100 dark:border-slate-800/20">
                              {sealedBatch ? sealedBatch.quantity : 0} Pack
                            </td>
                            <td className="px-4 py-3.5 text-xs font-bold text-right dark:text-white border-b border-slate-100 dark:border-slate-800/20 text-indigo-650 dark:text-[#E2FF66]">
                              {openedBatch ? openedBatch.quantity : 0} Pcs
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PENERIMAAN DISTRIBUSI (STAFF) */}
          {activeTab === "penerimaan" && (
            <div className="border border-slate-200 dark:border-slate-800/40 rounded-3xl p-6 bg-white/95 dark:bg-[#202024]/95 shadow-sm space-y-4">
              <h3 className="font-bold text-sm dark:text-white">Penerimaan Kiriman Stok dari Gudang</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-[#E7E9ED] dark:bg-[#2E2E34]">
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350 rounded-l-lg">Tanggal Kirim</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350">Barang Varian</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350">Qty Kiriman</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350 rounded-r-lg">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {distributions.filter((d) => d.status === "sent").length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-xs text-slate-450">
                          Tidak ada kiriman stok pending untuk diterima saat ini.
                        </td>
                      </tr>
                    ) : (
                      distributions
                        .filter((d) => d.status === "sent")
                        .map((d) => (
                          <tr key={d.id} className="border-b border-slate-100 dark:border-slate-800/20">
                            <td className="px-4 py-3.5 text-xs font-semibold dark:text-white border-b border-slate-100 dark:border-slate-800/20">
                              {new Date(d.sent_at).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </td>
                            <td className="px-4 py-3.5 text-xs font-bold dark:text-white border-b border-slate-100 dark:border-slate-800/20">
                              {getProductName(d.product_id)}
                            </td>
                            <td className="px-4 py-3.5 text-xs font-bold text-right dark:text-white border-b border-slate-100 dark:border-slate-800/20">
                              {d.qty} Packs
                            </td>
                            <td className="px-4 py-3.5 text-xs font-bold text-right border-b border-slate-100 dark:border-slate-800/20">
                              <button
                                onClick={() => handleReceiveDist(d.id)}
                                className="bg-[#E2FF66] text-[#2B2B2B] px-3.5 py-1.5 rounded-full text-[10px] font-bold hover:shadow-sm cursor-pointer"
                              >
                                Terima Stok
                              </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: QUALITY CHECK (STAFF/MANAGER) */}
          {activeTab === "qc" && (
            <div className="border border-slate-200 dark:border-slate-800/40 rounded-3xl p-6 bg-white/95 dark:bg-[#202024]/95 shadow-sm space-y-4">
              <h3 className="font-bold text-sm dark:text-white">Quality Check Pagi Hari (Meatballs Quality Gate)</h3>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                Batch bakso berstatus <strong>Opened (pcs)</strong> wajib di-QC setiap pagi sebelum transaksi POS dimulai. Jika kualitas menurun (thawed lewat 2 hari), buang/discard dan laporkan.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-[#E7E9ED] dark:bg-[#2E2E34]">
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350 rounded-l-lg">Varian Bakso</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350">Sisa Stok (Pcs)</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350">Dibuka Pada</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350 rounded-r-lg">Verifikasi Kualitas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockBatches.filter((b) => b.batch_status === "opened" && b.quantity > 0).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-xs text-slate-450">
                          Tidak ada batch opened untuk di-QC saat ini.
                        </td>
                      </tr>
                    ) : (
                      stockBatches
                        .filter((b) => b.batch_status === "opened" && b.quantity > 0)
                        .map((b) => (
                          <tr key={b.id} className="border-b border-slate-100 dark:border-slate-800/20">
                            <td className="px-4 py-3.5 text-xs font-bold dark:text-white border-b border-slate-100 dark:border-slate-800/20">
                              {getProductName(b.product_id)}
                            </td>
                            <td className="px-4 py-3.5 text-xs font-bold text-right dark:text-white border-b border-slate-100 dark:border-slate-800/20">
                              {b.quantity} Pcs
                            </td>
                            <td className="px-4 py-3.5 text-xs font-semibold text-slate-450 border-b border-slate-100 dark:border-slate-800/20">
                              {b.opened_at ? new Date(b.opened_at).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit"
                              }) : "-"}
                            </td>
                            <td className="px-4 py-3.5 text-xs font-bold text-right border-b border-slate-100 dark:border-slate-800/20 space-x-1.5">
                              <button
                                onClick={() => handleQC(b.id, "pass")}
                                className="bg-emerald-500 text-white px-3 py-1 rounded-full text-[10px] font-bold hover:bg-emerald-600 cursor-pointer"
                              >
                                Lolos QC
                              </button>
                              <button
                                onClick={() => handleQC(b.id, "discard")}
                                className="bg-red-500 text-white px-3 py-1 rounded-full text-[10px] font-bold hover:bg-red-650 cursor-pointer"
                              >
                                Discard (Wastage)
                              </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: CLOSING STOCK (STAFF) */}
          {activeTab === "closing" && (
            <div className="border border-slate-200 dark:border-slate-800/40 rounded-3xl p-6 bg-white/95 dark:bg-[#202024]/95 shadow-sm space-y-4">
              <h3 className="font-bold text-sm dark:text-white">Laporan Closing Stok Harian</h3>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                Sebelum menutup hari, masukkan hitungan fisik sisa stok <strong>Sealed (Packs)</strong> dan <strong>Opened (Pcs)</strong> yang Anda pegang. Selisih dengan angka sistem otomatis tercatat sebagai discrepancy opname.
              </p>
              <form onSubmit={handleClosingSubmit} className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full border-separate border-spacing-0">
                    <thead>
                      <tr className="bg-[#E7E9ED] dark:bg-[#2E2E34]">
                        <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350 rounded-l-lg">Varian Bakso</th>
                        <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350">Sistem (Sealed / Opened)</th>
                        <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350 rounded-r-lg" style={{ width: "320px" }}>Fisik (Input Staff)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => {
                        const sealedBatch = stockBatches.find(
                          (b) => b.product_id === p.id && b.batch_status === "sealed"
                        );
                        const openedBatch = stockBatches.find(
                          (b) => b.product_id === p.id && b.batch_status === "opened"
                        );
                        const expectedSealed = sealedBatch ? sealedBatch.quantity : 0;
                        const expectedOpened = openedBatch ? openedBatch.quantity : 0;

                        return (
                          <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800/20">
                            <td className="px-4 py-3.5 text-xs font-bold dark:text-white border-b border-slate-100 dark:border-slate-800/20">
                              {p.name}
                            </td>
                            <td className="px-4 py-3.5 text-xs font-semibold text-right dark:text-white border-b border-slate-100 dark:border-slate-800/20 text-slate-500">
                              {expectedSealed} Packs / {expectedOpened} Pcs
                            </td>
                            <td className="px-4 py-3 text-xs font-bold border-b border-slate-100 dark:border-slate-800/20">
                              <div className="flex items-center space-x-2">
                                <input
                                  type="number"
                                  placeholder="Sealed Packs"
                                  value={closingQuantities[p.id]?.sealed || ""}
                                  onChange={(e) =>
                                    setClosingQuantities({
                                      ...closingQuantities,
                                      [p.id]: { ...closingQuantities[p.id], sealed: e.target.value }
                                    })
                                  }
                                  className="w-28 px-3 py-2.5 rounded-lg border border-slate-250 dark:border-slate-850 dark:text-white text-xs bg-transparent focus:outline-none"
                                />
                                <span className="opacity-50">/</span>
                                <input
                                  type="number"
                                  placeholder="Opened Pcs"
                                  value={closingQuantities[p.id]?.opened || ""}
                                  onChange={(e) =>
                                    setClosingQuantities({
                                      ...closingQuantities,
                                      [p.id]: { ...closingQuantities[p.id], opened: e.target.value }
                                    })
                                  }
                                  className="w-28 px-3 py-2.5 rounded-lg border border-slate-250 dark:border-slate-850 dark:text-white text-xs bg-transparent focus:outline-none"
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    className="bg-[#E2FF66] text-[#2B2B2B] font-bold text-xs px-8 py-3 rounded-full hover:shadow-md cursor-pointer transition-shadow"
                  >
                    Kirim Laporan Closing Stok
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 8: ALL BATCHES (STAFF) */}
          {activeTab === "batches" && (
            <div className="border border-slate-200 dark:border-slate-800/40 rounded-3xl p-6 bg-white/95 dark:bg-[#202024]/95 shadow-sm space-y-4">
              <h3 className="font-bold text-sm dark:text-white">Semua Batch Stok Terdaftar</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-[#E7E9ED] dark:bg-[#2E2E34]">
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350 rounded-l-lg">Varian Bakso</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350">Status Batch</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350">Jumlah Stok</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350 rounded-r-lg">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockBatches.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-xs text-slate-450">
                          Belum ada data batch stok.
                        </td>
                      </tr>
                    ) : (
                      stockBatches.map((b) => (
                        <tr key={b.id} className="border-b border-slate-100 dark:border-slate-800/20">
                          <td className="px-4 py-3.5 text-xs font-bold dark:text-white border-b border-slate-100 dark:border-slate-800/20">
                            {getProductName(b.product_id)}
                          </td>
                          <td className="px-4 py-3.5 text-xs font-semibold border-b border-slate-100 dark:border-slate-800/20">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] uppercase font-bold ${
                              b.batch_status === "opened"
                                ? "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
                                : "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400"
                            }`}>
                              {b.batch_status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-xs font-bold text-right dark:text-white border-b border-slate-100 dark:border-slate-800/20">
                            {b.quantity} {b.batch_status === "opened" ? "Pcs" : "Packs"}
                          </td>
                          <td className="px-4 py-3.5 text-xs font-semibold text-slate-450 border-b border-slate-100 dark:border-slate-800/20">
                            {b.batch_status === "opened" ? (
                              <span>
                                QC: {b.quality_check_status ? b.quality_check_status.toUpperCase() : "PENDING"}
                              </span>
                            ) : (
                              <span className="opacity-45">-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
