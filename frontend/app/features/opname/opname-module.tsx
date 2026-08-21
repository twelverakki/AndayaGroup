import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { AlertCircle, CheckCircle2 } from "lucide-react";

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
}

interface WastageLog {
  id: string;
  product_id?: string;
  expected_qty: number;
  actual_qty: number;
  discrepancy: number;
  status: "pending_approval" | "approved" | "rejected";
  created_at: string;
}

export default function OpnameModule() {
  const { activeContext } = useAuthStore();
  const isManagerOrOwner = activeContext?.role === "manager" || activeContext?.role === "owner";

  // Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [wastageLogs, setWastageLogs] = useState<WastageLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & Inputs
  const [showOpnameModal, setShowOpnameModal] = useState<Product | null>(null);
  const [actualQty, setActualQty] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Tab: "opname" vs "approvals"
  const [activeTab, setActiveTab] = useState<"opname" | "approvals">("opname");

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const prodRes = await api.get("/products?status=active");
      setProducts(prodRes.data || []);

      if (isManagerOrOwner || activeTab === "approvals") {
        const logRes = await api.get("/wastage-logs");
        setWastageLogs(logRes.data || []);
      }
    } catch (err) {
      console.error("Failed to load opname data:", err);
      setError("Gagal memuat data dari server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeContext, activeTab]);

  // Submit Opname (Blind Count)
  const handleOpnameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showOpnameModal || !actualQty) return;

    setFormLoading(true);
    setError("");
    setSuccess("");

    try {
      await api.post("/wastage-logs", {
        product_id: showOpnameModal.id,
        actual_qty: parseFloat(actualQty) || 0,
      });

      setSuccess(`Opname Blind Count untuk ${showOpnameModal.name} berhasil diajukan!`);
      setShowOpnameModal(null);
      setActualQty("");
      setTimeout(() => setSuccess(""), 3000);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || "Gagal mengajukan opname");
    } finally {
      setFormLoading(false);
    }
  };

  // Approve Opname
  const handleApproveOpname = async (logID: string) => {
    setError("");
    setSuccess("");
    try {
      await api.post(`/wastage-logs/${logID}/approve`);
      setSuccess("Opname disetujui! Stok sistem telah disesuaikan.");
      fetchData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Gagal menyetujui opname");
    }
  };

  // Reject Opname
  const handleRejectOpname = async (logID: string) => {
    setError("");
    setSuccess("");
    try {
      await api.post(`/wastage-logs/${logID}/reject`);
      setSuccess("Pengajuan opname ditolak.");
      fetchData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Gagal menolak opname");
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* Top Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Module Tab Switcher */}
        <div className="flex bg-slate-100 dark:bg-dark-bg p-1.5 rounded-pill w-full md:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab("opname")}
            className={`px-6 py-2.5 text-xs font-bold rounded-pill transition-all cursor-pointer ${
              activeTab === "opname" ? "bg-white dark:bg-dark-card-lighter text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Lakukan Opname Fisik
          </button>
          {isManagerOrOwner && (
            <button
              type="button"
              onClick={() => setActiveTab("approvals")}
              className={`px-6 py-2.5 text-xs font-bold rounded-pill transition-all cursor-pointer ${
                activeTab === "approvals" ? "bg-white dark:bg-dark-card-lighter text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Persetujuan Opname
              {wastageLogs.filter((l) => l.status === "pending_approval").length > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-pill">
                  {wastageLogs.filter((l) => l.status === "pending_approval").length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm font-semibold rounded-button border border-red-100 dark:border-red-900/50 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 shrink-0 stroke-[2.5]" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 text-sm font-semibold rounded-button border border-emerald-100 dark:border-emerald-900/50 flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 shrink-0 stroke-[2.5]" />
          <span>{success}</span>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-pill animate-spin mb-3" />
          <span className="text-slate-500 dark:text-slate-400 text-xs font-bold">Memuat data opname...</span>
        </div>
      ) : (
        <>
          {/* TAB 1: Opname / Blind Count Submit */}
          {activeTab === "opname" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.length === 0 ? (
                <div className="col-span-full text-center py-10 text-slate-400 dark:text-slate-500 font-bold bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-card">
                  Belum ada produk aktif untuk dilakukan opname
                </div>
              ) : (
                products.map((p) => (
                  <div key={p.id} className="bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border shadow-sm rounded-card p-6 flex flex-col justify-between h-40">
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white text-base mb-1">{p.name}</h4>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mb-4 font-medium capitalize">
                        Satuan: {p.unit_type} • Mode: {p.inventory_mode.replace("_", " ")}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowOpnameModal(p)}
                      className="w-full py-2.5 bg-slate-100 dark:bg-dark-card-lighter hover:bg-slate-200 dark:hover:bg-dark-card text-slate-700 dark:text-slate-300 font-bold text-xs rounded-button transition-all cursor-pointer text-center border border-transparent dark:border-dark-border"
                    >
                      Hitung Opname Fisik
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: Approvals (Manager/Owner Only) */}
          {activeTab === "approvals" && isManagerOrOwner && (
            <div
              className="bg-white dark:bg-dark-card border border-slate-200/80 dark:border-dark-border rounded-[28px] shadow-sm p-4 sm:p-6"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-separate" style={{ borderSpacing: 0 }}>
                  <thead>
                    <tr className="text-slate-600 dark:text-slate-300 select-none">
                      <th className="py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap bg-[#E7E9ED] dark:bg-[#2E2E34] rounded-l-full">
                        Produk
                      </th>
                      <th className="py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider text-center whitespace-nowrap bg-[#E7E9ED] dark:bg-[#2E2E34]">
                        Stok Sistem
                      </th>
                      <th className="py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider text-center whitespace-nowrap bg-[#E7E9ED] dark:bg-[#2E2E34]">
                        Stok Fisik
                      </th>
                      <th className="py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider text-center whitespace-nowrap bg-[#E7E9ED] dark:bg-[#2E2E34]">
                        Selisih
                      </th>
                      <th className="py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider text-center whitespace-nowrap bg-[#E7E9ED] dark:bg-[#2E2E34]">
                        Tanggal Input
                      </th>
                      <th className="py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider text-center whitespace-nowrap bg-[#E7E9ED] dark:bg-[#2E2E34]">
                        Status
                      </th>
                      <th className="py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider text-center whitespace-nowrap bg-[#E7E9ED] dark:bg-[#2E2E34] rounded-r-full">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 dark:text-slate-300 font-medium">
                    {wastageLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-400 dark:text-slate-500 font-bold border-b border-slate-200/80 dark:border-dark-border">
                          Tidak ada pengajuan opname yang masuk
                        </td>
                      </tr>
                    ) : (
                      wastageLogs.map((log) => {
                        const prod = products.find((p) => p.id === log.product_id);
                        const displayExpected = log.expected_qty === null || log.expected_qty === undefined ? "-" : log.expected_qty;
                        const displayDiscrepancy = log.discrepancy === null || log.discrepancy === undefined ? "-" : log.discrepancy;

                        return (
                          <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.03] transition-colors">
                            <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200/80 dark:border-dark-border">
                              {prod?.name || "Unknown Product"}
                            </td>
                            <td className="px-5 py-3.5 text-center font-mono border-b border-slate-200/80 dark:border-dark-border">{displayExpected}</td>
                            <td className="px-5 py-3.5 text-center font-mono text-slate-900 dark:text-slate-100 font-bold border-b border-slate-200/80 dark:border-dark-border">
                              {log.actual_qty}
                            </td>
                            <td className={`px-5 py-3.5 text-center font-bold font-mono border-b border-slate-200/80 dark:border-dark-border ${
                              typeof displayDiscrepancy === "number" && displayDiscrepancy < 0 
                                ? "text-red-500" 
                                : typeof displayDiscrepancy === "number" && displayDiscrepancy > 0 
                                ? "text-emerald-600 dark:text-emerald-400" 
                                : "text-slate-400 dark:text-slate-500"
                            }`}>
                              {typeof displayDiscrepancy === "number" && displayDiscrepancy > 0 
                                ? `+${displayDiscrepancy}` 
                                : displayDiscrepancy}
                            </td>
                            <td className="px-5 py-3.5 text-center text-xs text-slate-400 dark:text-slate-500 border-b border-slate-200/80 dark:border-dark-border">
                              {new Date(log.created_at).toLocaleString()}
                            </td>
                            <td className="px-5 py-3.5 text-center border-b border-slate-200/80 dark:border-dark-border">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                                log.status === "approved"
                                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400"
                                  : log.status === "rejected"
                                  ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                  : "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400"
                              }`}>
                                {log.status.replace("_", " ")}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-center border-b border-slate-200/80 dark:border-dark-border">
                              {log.status === "pending_approval" ? (
                                <div className="flex justify-center space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => handleApproveOpname(log.id)}
                                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-bold cursor-pointer"
                                  >
                                    Setujui
                                  </button>
                                  <span className="text-slate-200 dark:text-slate-700">|</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRejectOpname(log.id)}
                                    className="text-xs text-red-500 dark:text-red-400 hover:underline font-bold cursor-pointer"
                                  >
                                    Tolak
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Opname Modal (Blind Count Form) */}
      {showOpnameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-dark-card border border-slate-100 dark:border-dark-border shadow-2xl rounded-card p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Opname Blind Count</h3>
            <div className="bg-slate-50 dark:bg-dark-bg border border-slate-100 dark:border-dark-border rounded-button p-4 mb-6">
              <span className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block">Target Produk</span>
              <span className="font-semibold text-slate-900 dark:text-white text-base">{showOpnameModal.name}</span>
            </div>

            <form onSubmit={handleOpnameSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 ml-1 text-left">
                  Jumlah Stok Fisik Terhitung ({showOpnameModal.unit_type})
                </label>
                <input
                  type="number"
                  step="any"
                  value={actualQty}
                  onChange={(e) => setActualQty(e.target.value)}
                  placeholder="Masukkan jumlah yang dihitung secara fisik"
                  className="w-full text-center text-xl font-bold px-4 py-4 rounded-button border border-slate-200 dark:border-dark-border focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary bg-slate-50 dark:bg-dark-bg text-slate-900 dark:text-white"
                  style={{ minHeight: "56px" }}
                  required
                />
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium block mt-2 ml-1 text-center">
                  💡 *Blind Count*: Anda tidak dapat melihat perkiraan stok sistem saat ini demi pencegahan manipulasi data.
                </span>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowOpnameModal(null);
                    setActualQty("");
                  }}
                  className="flex-1 py-3 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-dark-border hover:bg-slate-50 dark:bg-dark-card-lighter dark:hover:bg-dark-card rounded-button cursor-pointer text-sm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-3 bg-primary hover:bg-primary/95 text-primary-foreground font-bold rounded-button cursor-pointer text-sm shadow-md"
                >
                  {formLoading ? "Mengajukan..." : "Kirim Laporan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
