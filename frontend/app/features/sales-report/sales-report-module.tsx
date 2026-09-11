"use client";

import { useState, useEffect, useMemo } from "react";
import { api } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { useLanguageStore, translations } from "../../lib/i18n";
import { ErpSearchBar } from "../../components/ErpSearchBar";
import { ErpDataTable } from "../../components/ErpDataTable";
import { DatePicker } from "../../components/ui/date-picker";
import { toast } from "../../components/ui/sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  TrendingUp,
  Calendar,
  DollarSign,
  Receipt,
  RotateCcw,
  ShoppingBag,
  CreditCard,
  Banknote,
  QrCode,
  Download,
  Printer,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  ChevronDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
} from "lucide-react";

interface TopProductSummary {
  product_id: string;
  product_name: string;
  category: string;
  qty_sold: number;
  total_sales: number;
}

interface DailySalesTrend {
  date: string;
  gross_sales: number;
  tx_count: number;
}

interface PaymentMethodBreakdown {
  method: string;
  total_sales: number;
  count: number;
  percentage: number;
}

interface SalesReportSummary {
  total_gross_sales: number;
  total_net_sales: number;
  total_transactions: number;
  total_items_sold: number;
  average_order_value: number;
  total_tax: number;
  total_discount: number;
  total_void_count: number;
  total_void_amount: number;
  payment_breakdown: PaymentMethodBreakdown[];
  top_products: TopProductSummary[];
  daily_trends: DailySalesTrend[];
}

interface TransactionDetail {
  id: string;
  business_id: string;
  outlet_id: string;
  shift_id?: string;
  staff_id: string;
  type: "sale" | "internal_take" | "void";
  total_amount: number;
  payment_method: "cash" | "qris" | "other";
  status: "completed" | "voided";
  client_uuid: string;
  synced_at?: string;
  created_at: string;
  staff_name?: string;
}

export default function SalesReportModule() {
  const { activeContext } = useAuthStore();
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;

  // Filter States
  const [datePreset, setDatePreset] = useState<"today" | "7days" | "month" | "custom">("today");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTxQuery, setSearchTxQuery] = useState("");

  // Data States
  const [summary, setSummary] = useState<SalesReportSummary | null>(null);
  const [transactions, setTransactions] = useState<TransactionDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Quick Preset Helper
  const applyDatePreset = (preset: "today" | "7days" | "month" | "custom") => {
    setDatePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    if (preset === "today") {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "7days") {
      const past = new Date();
      past.setDate(now.getDate() - 7);
      setStartDate(past.toISOString().split("T")[0]);
      setEndDate(todayStr);
    } else if (preset === "month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(firstDay.toISOString().split("T")[0]);
      setEndDate(todayStr);
    }
  };

  // Fetch Report Data
  const fetchReportData = async () => {
    setLoading(true);
    setError("");
    try {
      // 1. Fetch Aggregated Summary
      const summaryRes = await api.get("/reports/sales", {
        params: {
          start_date: startDate,
          end_date: endDate,
          payment_method: paymentFilter !== "all" ? paymentFilter : undefined,
          type: typeFilter !== "all" ? typeFilter : undefined,
        },
      });
      setSummary(summaryRes.data);

      // 2. Fetch Detailed Transactions List
      const txRes = await api.get("/transactions", {
        params: {
          start_date: startDate,
          end_date: endDate,
        },
      });
      setTransactions(txRes.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || "Gagal memuat data laporan penjualan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [startDate, endDate, paymentFilter, typeFilter]);

  // Filtered Transactions in Table
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (statusFilter !== "all" && tx.status !== statusFilter) return false;
      if (paymentFilter !== "all" && tx.payment_method !== paymentFilter) return false;
      if (typeFilter !== "all" && tx.type !== typeFilter) return false;
      if (searchTxQuery.trim()) {
        const query = searchTxQuery.toLowerCase();
        const matchId = tx.id.toLowerCase().includes(query);
        const matchStaff = (tx.staff_name || "").toLowerCase().includes(query);
        const matchAmount = tx.total_amount.toString().includes(query);
        return matchId || matchStaff || matchAmount;
      }
      return true;
    });
  }, [transactions, statusFilter, paymentFilter, typeFilter, searchTxQuery]);

  // Export to CSV using Toast Sonner instead of native alert
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) {
      toast.info(t.noData || "Tidak ada data transaksi untuk diekspor.");
      return;
    }

    const headers = ["ID Transaksi", "Waktu", "Kasir", "Tipe", "Metode Pembayaran", "Total Nominal (Rp)", "Status"];
    const rows = filteredTransactions.map((tx) => [
      tx.id,
      new Date(tx.created_at).toLocaleString("id-ID"),
      tx.staff_name || "Staff",
      tx.type,
      tx.payment_method,
      tx.total_amount,
      tx.status,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_Penjualan_${startDate}_sd_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Laporan penjualan berhasil diekspor!");
  };

  // Max daily sales for relative chart bar heights
  const maxDailySales = useMemo(() => {
    if (!summary?.daily_trends || summary.daily_trends.length === 0) return 1;
    return Math.max(...summary.daily_trends.map((d) => d.gross_sales), 1);
  }, [summary?.daily_trends]);

  return (
    <div className="space-y-6 text-left relative">
      
      {/* ── PAGE HEADER (STANDARDIZED MATCHING INVENTORY & PROCUREMENT) ── */}
      <div className="border-b border-slate-200/80 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t.salesReportTitle || "Laporan & Rekap Penjualan"}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
            {t.salesReportDesc || "Analisis omset transaksi, metode pembayaran, tren harian, dan produk terlaris."}
          </p>
        </div>

        {/* Header Action Pills */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={fetchReportData}
            disabled={loading}
            className="p-2.5 rounded-full border border-slate-200/80 dark:border-[#38383C] bg-white dark:bg-[#202024] hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 transition-all cursor-pointer shadow-xs"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-slate-200/80 dark:border-[#38383C] bg-white dark:bg-[#202024] hover:bg-slate-100 dark:hover:bg-white/5 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>{t.exportCsv || "Ekspor CSV"}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 text-xs font-semibold transition-all shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{t.printReport || "Cetak Laporan"}</span>
          </button>
        </div>
      </div>

      {/* ── FILTER TOOLBAR (CLEAN DATE PRESETS & SHADCN SELECTS) ── */}
      <div className="p-4 rounded-3xl bg-slate-50/80 dark:bg-[#1C1C20] border border-slate-200/70 dark:border-[#2F2F34] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Quick Date Range Presets */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-[#25252A] p-1 rounded-2xl border border-slate-200/80 dark:border-[#333338]">
            {[
              { id: "today", label: language === "id" ? "Hari Ini" : "Today" },
              { id: "7days", label: language === "id" ? "7 Hari" : "7 Days" },
              { id: "month", label: language === "id" ? "Bulan Ini" : "This Month" },
              { id: "custom", label: language === "id" ? "Kustom" : "Custom" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyDatePreset(p.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  datePreset === p.id
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date Picker Inputs */}
          <div className="flex items-center gap-2">
            <DatePicker
              value={startDate}
              onChange={(val) => {
                setStartDate(val);
                setDatePreset("custom");
              }}
            />
            <span className="text-xs text-slate-400 font-medium">s/d</span>
            <DatePicker
              value={endDate}
              onChange={(val) => {
                setEndDate(val);
                setDatePreset("custom");
              }}
            />
          </div>

          {/* Payment Method & Type Filter Dropdowns (Shadcn UI Select) */}
          <div className="flex items-center gap-2">
            <Select value={paymentFilter} onValueChange={(val) => setPaymentFilter(val || "all")}>
              <SelectTrigger className="w-[150px] text-xs font-semibold h-9 rounded-2xl border bg-white dark:bg-[#25252A] border-slate-200/80 dark:border-[#333338] text-slate-700 dark:text-slate-200">
                <SelectValue placeholder="Metode Bayar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Pembayaran</SelectItem>
                <SelectItem value="cash">Tunai</SelectItem>
                <SelectItem value="qris">QRIS</SelectItem>
                <SelectItem value="other">Lainnya</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={(val) => setTypeFilter(val || "all")}>
              <SelectTrigger className="w-[140px] text-xs font-semibold h-9 rounded-2xl border bg-white dark:bg-[#25252A] border-slate-200/80 dark:border-[#333338] text-slate-700 dark:text-slate-200">
                <SelectValue placeholder="Tipe Nota" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tipe</SelectItem>
                <SelectItem value="sale">Penjualan</SelectItem>
                <SelectItem value="internal_take">Konsumsi Internal</SelectItem>
              </SelectContent>
            </Select>
          </div>

        </div>
      </div>

      {/* Error Feedback */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── 4 HERO KPI METRICS CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* 1. Total Gross Revenue */}
        <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/70 dark:border-[#333338] space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {t.totalGrossSales || "Total Omset Bruto"}
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-semibold">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
              Rp {(summary?.total_gross_sales || 0).toLocaleString("id-ID")}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span>{summary?.total_transactions || 0} nota selesai</span>
            </p>
          </div>
        </div>

        {/* 2. Total Transactions & AOV */}
        <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/70 dark:border-[#333338] space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {t.averageOrderValue || "Rata-rata Nilai Nota (AOV)"}
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-semibold">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-semibold text-slate-800 dark:text-white font-mono">
              Rp {(summary?.average_order_value || 0).toLocaleString("id-ID")}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">
              Rata-rata per transaksi kasir
            </p>
          </div>
        </div>

        {/* 3. Total Items Sold */}
        <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/70 dark:border-[#333338] space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {t.totalItemsSold || "Total Produk Terjual"}
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-semibold">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-semibold text-slate-800 dark:text-white font-mono">
              {(summary?.total_items_sold || 0).toLocaleString("id-ID")} <span className="text-xs font-normal text-slate-400">unit</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">
              Termasuk kuantiti timbangan & eceran
            </p>
          </div>
        </div>

        {/* 4. Total Void Transactions */}
        <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/70 dark:border-[#333338] space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {t.voidedLosses || "Transaksi Dibatalkan"}
            </span>
            <div className="w-8 h-8 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center font-semibold">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-semibold text-red-600 dark:text-red-400 font-mono">
              Rp {(summary?.total_void_amount || 0).toLocaleString("id-ID")}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">
              {summary?.total_void_count || 0} nota di-void
            </p>
          </div>
        </div>

      </div>

      {/* ── VISUAL SECTION: TRENDS & PAYMENT BREAKDOWN ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Daily Sales Bar Chart (Span 2) */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/70 dark:border-[#333338] space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span>{t.dailySalesTrend || "Tren Penjualan Harian"}</span>
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                {t.dailySalesTrendDesc || "Fluktuasi omset penjualan per hari pada periode aktif"}
              </p>
            </div>
          </div>

          {/* Chart Bars */}
          {!summary?.daily_trends || summary.daily_trends.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 text-xs font-semibold">
              <Receipt className="w-8 h-8 mb-2 opacity-30" />
              <span>Belum ada data penjualan pada periode ini</span>
            </div>
          ) : (
            <div className="pt-6 space-y-2">
              <div className="h-44 flex items-end gap-2 sm:gap-3 overflow-x-auto pb-2 scrollbar-thin">
                {summary.daily_trends.map((day) => {
                  const heightPercent = Math.max(8, Math.round((day.gross_sales / maxDailySales) * 100));
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1.5 min-w-[36px] group relative">
                      {/* Tooltip Hover */}
                      <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                        <div className="px-2.5 py-1.5 rounded-xl bg-slate-900 text-white text-[10px] font-medium whitespace-nowrap shadow-xl">
                          <p>{day.date}</p>
                          <p className="text-emerald-400 font-mono font-semibold">Rp {day.gross_sales.toLocaleString("id-ID")}</p>
                          <p className="text-slate-300 font-normal">{day.tx_count} transaksi</p>
                        </div>
                      </div>

                      {/* Bar Fill */}
                      <div className="w-full h-full flex items-end">
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className="w-full rounded-xl bg-slate-900 dark:bg-white transition-all group-hover:brightness-110 shadow-xs"
                        />
                      </div>

                      {/* Date label */}
                      <span className="text-[9px] font-mono text-slate-400 truncate max-w-full">
                        {day.date.substring(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Payment Method Distribution (Span 1) */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/70 dark:border-[#333338] space-y-4 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-500" />
              <span>{t.paymentDistribution || "Distribusi Pembayaran"}</span>
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">
              {t.paymentDistributionDesc || "Proporsi transaksi Tunai vs QRIS"}
            </p>
          </div>

          <div className="space-y-3 my-auto">
            {(!summary?.payment_breakdown || summary.payment_breakdown.length === 0) ? (
              <div className="py-10 text-center text-slate-400 text-xs font-medium">
                Belum ada transaksi
              </div>
            ) : (
              summary.payment_breakdown.map((pm) => {
                const isCash = pm.method === "cash";
                const isQris = pm.method === "qris";
                return (
                  <div key={pm.method} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#25252A] border border-slate-200/60 dark:border-[#333338] space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-semibold text-xs ${
                            isCash
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : isQris
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                              : "bg-purple-500/10 text-purple-600"
                          }`}
                        >
                          {isCash ? <Banknote className="w-3.5 h-3.5" /> : <QrCode className="w-3.5 h-3.5" />}
                        </div>
                        <span className="text-xs font-semibold uppercase text-slate-800 dark:text-slate-200">
                          {pm.method}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-semibold text-slate-800 dark:text-white font-mono">
                          Rp {pm.total_sales.toLocaleString("id-ID")}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {pm.count} nota ({Math.round(pm.percentage)}%)
                        </span>
                      </div>
                    </div>

                    {/* Progress Percentage Bar */}
                    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-[#303035] overflow-hidden">
                      <div
                        style={{ width: `${Math.min(100, Math.max(5, pm.percentage))}%` }}
                        className={`h-full rounded-full ${
                          isCash ? "bg-emerald-500" : isQris ? "bg-blue-500" : "bg-purple-500"
                        }`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-2 text-[10px] text-slate-400 text-center border-t border-slate-200/60 dark:border-[#333338] font-mono">
            Total Omset: Rp {(summary?.total_gross_sales || 0).toLocaleString("id-ID")}
          </div>
        </div>

      </div>

      {/* ── TOP SELLING PRODUCTS LEADERBOARD ── */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/70 dark:border-[#333338] space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>{t.topProducts || "Produk Terlaris"}</span>
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">
              {t.topProductsDesc || "Peringkat produk dengan kontribusi omset tertinggi"}
            </p>
          </div>
        </div>

        {(!summary?.top_products || summary.top_products.length === 0) ? (
          <div className="py-12 text-center text-slate-400 text-xs font-medium">
            <ShoppingBag className="w-8 h-8 mb-2 opacity-30 mx-auto" />
            <span>Belum ada produk terjual pada periode ini</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {summary.top_products.map((p, idx) => (
              <div
                key={p.product_id}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-[#25252A] border border-slate-200/80 dark:border-[#333338] flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-semibold text-xs shrink-0 ${
                      idx === 0
                        ? "bg-amber-500 text-white shadow-xs"
                        : idx === 1
                        ? "bg-slate-300 text-slate-800"
                        : idx === 2
                        ? "bg-amber-700/80 text-white"
                        : "bg-slate-200 dark:bg-[#303035] text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    #{idx + 1}
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                      {p.product_name}
                    </h4>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5 font-medium">
                      {p.category} • {p.qty_sold} terjual
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                    Rp {p.total_sales.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── REUSABLE UNIFIED ERP DATA TABLE FOR DETAILED TRANSACTIONS ── */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-500" />
              <span>{t.transactionRecords || "Rincian Riwayat Transaksi"}</span>
            </h3>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              {filteredTransactions.length} nota ditemukan pada periode ini
            </p>
          </div>

          <div className="flex items-center gap-2">
            <ErpSearchBar
              value={searchTxQuery}
              onChange={setSearchTxQuery}
              placeholder="Cari ID nota, kasir, nominal..."
              size="sm"
              className="w-full sm:w-64"
            />
          </div>
        </div>

        {/* ErpDataTable Component with Floating Capsule Header */}
        <ErpDataTable<TransactionDetail>
          data={filteredTransactions}
          keyExtractor={(tx) => tx.id}
          loading={loading}
          emptyText="Tidak ada data transaksi yang cocok"
          renderMobileItem={(tx) => {
            const isVoid = tx.status === "voided";
            return (
              <div className="p-3.5 bg-white dark:bg-[#202024] rounded-2xl border border-slate-200/80 dark:border-[#2F2F34] space-y-2 mb-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-xs text-slate-900 dark:text-white">
                    #{tx.id.substring(0, 8).toUpperCase()}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                    isVoid
                      ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                  }`}>
                    {isVoid ? "VOID" : "SUKSES"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span>{tx.staff_name || "Kasir"} • {tx.payment_method.toUpperCase()}</span>
                  <span className={`font-mono font-semibold ${isVoid ? "line-through text-slate-400" : "text-slate-900 dark:text-white"}`}>
                    Rp {tx.total_amount.toLocaleString("id-ID")}
                  </span>
                </div>

                <div className="text-[10px] text-slate-400 font-mono">
                  {new Date(tx.created_at).toLocaleString("id-ID")}
                </div>
              </div>
            );
          }}
          columns={[
            {
              key: "id",
              label: "No. Nota",
              renderCell: (tx) => (
                <span className="font-mono font-semibold text-slate-900 dark:text-white">
                  #{tx.id.substring(0, 8).toUpperCase()}
                </span>
              ),
            },
            {
              key: "date",
              label: "Waktu",
              renderCell: (tx) => (
                <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                  {new Date(tx.created_at).toLocaleString("id-ID", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              ),
            },
            {
              key: "staff",
              label: "Kasir",
              renderCell: (tx) => (
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  {tx.staff_name || "Kasir"}
                </span>
              ),
            },
            {
              key: "type",
              label: "Tipe Nota",
              renderCell: (tx) => (
                <span className="capitalize text-slate-600 dark:text-slate-400 font-medium">
                  {tx.type === "sale" ? "Penjualan" : "Konsumsi Internal"}
                </span>
              ),
            },
            {
              key: "payment",
              label: "Metode Bayar",
              renderCell: (tx) => (
                <span className="uppercase text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#25252A] text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-[#333338]">
                  {tx.payment_method}
                </span>
              ),
            },
            {
              key: "amount",
              label: "Total Nominal",
              align: "right",
              renderCell: (tx) => (
                <span className={`font-mono font-semibold ${tx.status === "voided" ? "line-through text-slate-400" : "text-slate-900 dark:text-white"}`}>
                  Rp {tx.total_amount.toLocaleString("id-ID")}
                </span>
              ),
            },
            {
              key: "status",
              label: "Status",
              align: "center",
              renderCell: (tx) => (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                  tx.status === "voided"
                    ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${tx.status === "voided" ? "bg-red-500" : "bg-emerald-500"}`} />
                  <span>{tx.status === "voided" ? "VOID" : "SUKSES"}</span>
                </span>
              ),
            },
          ]}
        />
      </div>

    </div>
  );
}
