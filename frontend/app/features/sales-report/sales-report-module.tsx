"use client";

import { useState, useEffect, useMemo } from "react";
import { api } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { useLanguageStore, translations } from "../../lib/i18n";
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
  ArrowUpRight,
  Sparkles,
  ChevronDown,
  Layers,
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

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) {
      alert("Tidak ada data transaksi untuk diekspor.");
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
  };

  // Max daily sales for relative chart bar heights
  const maxDailySales = useMemo(() => {
    if (!summary?.daily_trends || summary.daily_trends.length === 0) return 1;
    return Math.max(...summary.daily_trends.map((d) => d.gross_sales), 1);
  }, [summary?.daily_trends]);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto space-y-6 p-6 lg:p-8 scrollbar-thin">
      
      {/* ================= HEADER SECTION ================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-dark-border">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-brand-purple/10 dark:bg-primary/10 text-brand-purple dark:text-primary flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {language === "id" ? "Laporan & Rekap Penjualan" : "Sales Analytics & Reports"}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {language === "id"
                  ? "Analisis omset transaksi, metode pembayaran, tren penjualan, dan produk terlaris."
                  : "Analyze revenue trends, payment methods, cashier performance, and top-selling items."}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchReportData}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-[#26262A] hover:bg-slate-50 dark:hover:bg-[#2E2E34] text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-[#26262A] hover:bg-slate-50 dark:hover:bg-[#2E2E34] text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4 text-purple-600 dark:text-primary" />
            <span>Ekspor CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-purple hover:bg-brand-purple-hover text-white text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Laporan</span>
          </button>
        </div>
      </div>

      {/* ================= FILTER TOOLBAR ================= */}
      <div className="p-4 rounded-3xl bg-slate-50/80 dark:bg-[#26262A] border border-slate-200/80 dark:border-dark-border space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Quick Date Range Presets */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-dark-bg p-1 rounded-2xl border border-slate-200 dark:border-dark-border">
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
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  datePreset === p.id
                    ? "bg-brand-purple dark:bg-primary text-white dark:text-[#1a1a1a] shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date Picker Inputs */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border bg-white dark:bg-dark-bg border-slate-200 dark:border-dark-border text-xs font-semibold">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset("custom");
                }}
                className="bg-transparent focus:outline-none text-slate-700 dark:text-slate-200"
              />
            </div>
            <span className="text-xs text-slate-400 font-bold">s/d</span>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border bg-white dark:bg-dark-bg border-slate-200 dark:border-dark-border text-xs font-semibold">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset("custom");
                }}
                className="bg-transparent focus:outline-none text-slate-700 dark:text-slate-200"
              />
            </div>
          </div>

          {/* Payment Method & Type Filter Dropdowns */}
          <div className="flex items-center gap-2">
            <Select value={paymentFilter} onValueChange={(val) => setPaymentFilter(val || "all")}>
              <SelectTrigger className="w-[160px] text-xs font-bold h-9 rounded-xl border bg-white dark:bg-dark-bg border-slate-200 dark:border-dark-border text-slate-700 dark:text-slate-200">
                <SelectValue placeholder={language === "id" ? "Pilih Pembayaran" : "Select Payment"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === "id" ? "Semua Pembayaran" : "All Payments"}</SelectItem>
                <SelectItem value="cash">Tunai (Cash)</SelectItem>
                <SelectItem value="qris">QRIS</SelectItem>
                <SelectItem value="other">{language === "id" ? "Lainnya" : "Other"}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={(val) => setTypeFilter(val || "all")}>
              <SelectTrigger className="w-[150px] text-xs font-bold h-9 rounded-xl border bg-white dark:bg-dark-bg border-slate-200 dark:border-dark-border text-slate-700 dark:text-slate-200">
                <SelectValue placeholder={language === "id" ? "Pilih Tipe" : "Select Type"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === "id" ? "Semua Tipe" : "All Types"}</SelectItem>
                <SelectItem value="sale">{language === "id" ? "Penjualan (Sales)" : "Customer Sales"}</SelectItem>
                <SelectItem value="internal_take">{language === "id" ? "Konsumsi Internal" : "Internal Take"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ================= 4 HERO KPI METRICS ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* 1. Total Gross Revenue */}
        <div className="p-5 rounded-3xl bg-white dark:bg-[#26262A] border border-slate-200/80 dark:border-dark-border space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {language === "id" ? "Total Omset Bruto" : "Total Gross Sales"}
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-emerald-600 dark:text-primary">
              Rp {(summary?.total_gross_sales || 0).toLocaleString("id-ID")}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span>{summary?.total_transactions || 0} {language === "id" ? "nota selesai" : "completed orders"}</span>
            </p>
          </div>
        </div>

        {/* 2. Total Transactions & AOV */}
        <div className="p-5 rounded-3xl bg-white dark:bg-[#26262A] border border-slate-200/80 dark:border-dark-border space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {language === "id" ? "Rata-rata Nilai Nota (AOV)" : "Average Order Value"}
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-primary flex items-center justify-center font-bold">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-slate-800 dark:text-white">
              Rp {(summary?.average_order_value || 0).toLocaleString("id-ID")}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">
              {language === "id" ? "Rata-rata per transaksi kasir" : "Per transaction average"}
            </p>
          </div>
        </div>

        {/* 3. Total Items Sold */}
        <div className="p-5 rounded-3xl bg-white dark:bg-[#26262A] border border-slate-200/80 dark:border-dark-border space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {language === "id" ? "Total Produk Terjual" : "Total Items Sold"}
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-slate-800 dark:text-white">
              {(summary?.total_items_sold || 0).toLocaleString("id-ID")} <span className="text-sm font-semibold text-slate-400">unit</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">
              {language === "id" ? "Termasuk kuantiti timbangan & eceran" : "Including weighted items"}
            </p>
          </div>
        </div>

        {/* 4. Total Void Transactions */}
        <div className="p-5 rounded-3xl bg-white dark:bg-[#26262A] border border-slate-200/80 dark:border-dark-border space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {language === "id" ? "Transaksi Dibatalkan (Void)" : "Voided Losses"}
            </span>
            <div className="w-8 h-8 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center font-bold">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-red-500">
              Rp {(summary?.total_void_amount || 0).toLocaleString("id-ID")}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">
              {summary?.total_void_count || 0} {language === "id" ? "transaksi di-void" : "voided orders"}
            </p>
          </div>
        </div>

      </div>

      {/* ================= VISUAL SECTION: TRENDS & PAYMENT BREAKDOWN ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Daily Sales Bar Chart (Span 2) */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-[#26262A] border border-slate-200/80 dark:border-dark-border space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-600 dark:text-primary" />
                <span>{language === "id" ? "Tren Penjualan Harian" : "Daily Sales Revenue Trend"}</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                {language === "id" ? "Fluktuasi omset penjualan per hari pada periode aktif" : "Daily revenue fluctuations"}
              </p>
            </div>
          </div>

          {/* Chart Bars */}
          {!summary?.daily_trends || summary.daily_trends.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 text-xs font-bold">
              <Receipt className="w-8 h-8 mb-2 opacity-30" />
              <span>{language === "id" ? "Belum ada data penjualan pada periode ini" : "No sales data found"}</span>
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
                        <div className="px-2.5 py-1.5 rounded-xl bg-slate-900 text-white text-[10px] font-bold whitespace-nowrap shadow-xl">
                          <p>{day.date}</p>
                          <p className="text-emerald-400">Rp {day.gross_sales.toLocaleString("id-ID")}</p>
                          <p className="text-slate-300 font-normal">{day.tx_count} transaksi</p>
                        </div>
                      </div>

                      {/* Bar Fill */}
                      <div className="w-full h-full flex items-end">
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className="w-full rounded-xl bg-gradient-to-t from-purple-600 to-indigo-500 dark:from-brand-purple dark:to-primary transition-all group-hover:brightness-110 shadow-xs"
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
        <div className="p-6 rounded-3xl bg-white dark:bg-[#26262A] border border-slate-200/80 dark:border-dark-border space-y-4 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-purple-600 dark:text-primary" />
              <span>{language === "id" ? "Distribusi Pembayaran" : "Payment Methods"}</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              {language === "id" ? "Proporsi transaksi Cash vs QRIS" : "Cash vs QRIS proportion"}
            </p>
          </div>

          <div className="space-y-3 my-auto">
            {(!summary?.payment_breakdown || summary.payment_breakdown.length === 0) ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                {language === "id" ? "Belum ada transaksi" : "No transactions"}
              </div>
            ) : (
              summary.payment_breakdown.map((pm) => {
                const isCash = pm.method === "cash";
                const isQris = pm.method === "qris";
                return (
                  <div key={pm.method} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-dark-bg border border-slate-200/60 dark:border-dark-border space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                            isCash
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : isQris
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                              : "bg-purple-500/10 text-purple-600"
                          }`}
                        >
                          {isCash ? <Banknote className="w-3.5 h-3.5" /> : <QrCode className="w-3.5 h-3.5" />}
                        </div>
                        <span className="text-xs font-extrabold uppercase text-slate-800 dark:text-slate-200">
                          {pm.method}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-800 dark:text-white">
                          Rp {pm.total_sales.toLocaleString("id-ID")}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {pm.count} nota ({Math.round(pm.percentage)}%)
                        </span>
                      </div>
                    </div>

                    {/* Progress Percentage Bar */}
                    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-dark-border overflow-hidden">
                      <div
                        style={{ width: `${Math.min(100, Math.max(5, pm.percentage))}%` }}
                        className={`h-full rounded-full ${
                          isCash ? "bg-emerald-500" : isQris ? "bg-blue-500" : "bg-brand-purple"
                        }`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-2 text-[10px] text-slate-400 text-center border-t border-slate-200/60 dark:border-dark-border">
            Total Omset: Rp {(summary?.total_gross_sales || 0).toLocaleString("id-ID")}
          </div>
        </div>

      </div>

      {/* ================= TOP SELLING PRODUCTS LEADERBOARD ================= */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#26262A] border border-slate-200/80 dark:border-dark-border space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>{language === "id" ? "Produk Terlaris (Top Selling Items)" : "Top Selling Products"}</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              {language === "id" ? "Peringkat produk dengan kontribusi omset tertinggi" : "Highest revenue contributing products"}
            </p>
          </div>
        </div>

        {(!summary?.top_products || summary.top_products.length === 0) ? (
          <div className="py-12 text-center text-slate-400 text-xs font-bold">
            <ShoppingBag className="w-8 h-8 mb-2 opacity-30 mx-auto" />
            <span>{language === "id" ? "Belum ada produk terjual pada periode ini" : "No products sold"}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {summary.top_products.map((p, idx) => (
              <div
                key={p.product_id}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-bg border border-slate-200/80 dark:border-dark-border flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 ${
                      idx === 0
                        ? "bg-amber-500 text-white shadow-xs"
                        : idx === 1
                        ? "bg-slate-300 text-slate-800"
                        : idx === 2
                        ? "bg-amber-700/80 text-white"
                        : "bg-slate-200 dark:bg-dark-border text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    #{idx + 1}
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white truncate">
                      {p.product_name}
                    </h4>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      {p.category} • {p.qty_sold} terjual
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-extrabold text-emerald-600 dark:text-primary">
                    Rp {p.total_sales.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ================= DETAILED TRANSACTIONS TABLE ================= */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#26262A] border border-slate-200/80 dark:border-dark-border space-y-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-purple-600 dark:text-primary" />
              <span>{language === "id" ? "Rincian Riwayat Transaksi" : "Transaction Records"}</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              {filteredTransactions.length} {language === "id" ? "nota ditemukan" : "invoices found"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={language === "id" ? "Cari no nota, kasir, nominal..." : "Search invoice ID, staff..."}
                value={searchTxQuery}
                onChange={(e) => setSearchTxQuery(e.target.value)}
                className="w-56 pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-dark-border focus:outline-none"
              />
            </div>

            {/* Status filter tabs */}
            <div className="flex gap-1 bg-slate-100 dark:bg-dark-bg p-1 rounded-xl">
              {[
                { id: "all", label: language === "id" ? "Semua" : "All" },
                { id: "completed", label: language === "id" ? "Sukses" : "Completed" },
                { id: "voided", label: "Void" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    statusFilter === tab.id
                      ? "bg-white dark:bg-[#2C2C30] text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-dark-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-dark-bg text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-dark-border">
              <tr>
                <th className="px-4 py-3">No. Nota</th>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Kasir</th>
                <th className="px-4 py-3">Tipe</th>
                <th className="px-4 py-3">Metode Bayar</th>
                <th className="px-4 py-3 text-right">Total Nominal</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-border/60 font-medium">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Receipt className="w-8 h-8 mb-2 opacity-30 mx-auto" />
                    <span>{language === "id" ? "Tidak ada transaksi yang cocok" : "No matching transactions"}</span>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isVoid = tx.status === "voided";
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/60 dark:hover:bg-[#2D2D32]/50 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                        #{tx.id.substring(0, 8).toUpperCase()}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {new Date(tx.created_at).toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {tx.staff_name || "Kasir"}
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-400">
                        {tx.type === "sale" ? "Sales" : "Internal"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-dark-bg text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-border">
                          {tx.payment_method}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-extrabold ${isVoid ? "line-through text-slate-400" : "text-slate-900 dark:text-white"}`}>
                        Rp {tx.total_amount.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isVoid ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                            VOID
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Sukses
                          </span>
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

    </div>
  );
}
