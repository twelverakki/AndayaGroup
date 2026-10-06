import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ShoppingCart,
  Plus,
  Building2,
  CreditCard,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { useLanguageStore, translations } from "../../lib/i18n";
import { PurchaseOrderTable } from "./components/PurchaseOrderTable";
import { AccountsPayableTable } from "./components/AccountsPayableTable";
import { SupplierManagement } from "./components/SupplierManagement";
import { PurchaseOrderDetail } from "./components/PurchaseOrderDetail";
import { PurchaseOrderForm } from "./components/PurchaseOrderForm";
import { PaymentModal } from "./components/PaymentModal";
import type {
  Purchase,
  Supplier,
  ItemOption,
  OutletOption,
  PurchasePayment,
  ProcurementModuleProps,
} from "./types";

export default function ProcurementModule({
  view = "history",
  onSuccess,
  onCancel,
  onNavigate,
}: ProcurementModuleProps) {
  const { activeContext } = useAuthStore();
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;

  // View state: 'list' | 'create' | 'detail'
  const [currentView, setCurrentView] = useState<"list" | "create" | "detail">(
    view === "new" ? "create" : "list"
  );

  // Tabs on List View: 'purchases' | 'payables' | 'suppliers'
  const [activeTab, setActiveTab] = useState<"purchases" | "payables" | "suppliers">("purchases");

  // Global Data State
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchasableItems, setPurchasableItems] = useState<ItemOption[]>([]);
  const [outlets, setOutlets] = useState<OutletOption[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [isDirectPurchaseBlocked, setIsDirectPurchaseBlocked] = useState(false);

  // Detail & Payment Modal States
  const [detailPurchase, setDetailPurchase] = useState<Purchase | null>(null);
  const [detailPayments, setDetailPayments] = useState<PurchasePayment[]>([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentTargetPurchase, setPaymentTargetPurchase] = useState<Purchase | null>(null);

  // Fetch all procurement data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const currentOutlet = activeContext?.outlet_id;
      const purchasableUrl = currentOutlet
        ? `/purchases/purchasable-items?outlet_id=${currentOutlet}`
        : "/purchases/purchasable-items";

      const [purchasesRes, suppliersRes, itemsRes, outletsRes, categoriesRes] = await Promise.allSettled([
        api.get("/purchases"),
        api.get("/suppliers"),
        api.get(purchasableUrl),
        api.get("/organization/outlets"),
        api.get("/categories"),
      ]);

      if (purchasesRes.status === "fulfilled") {
        setPurchases(purchasesRes.value.data.data || []);
      }
      if (suppliersRes.status === "fulfilled") {
        setSuppliers(suppliersRes.value.data.data || []);
      }
      if (categoriesRes.status === "fulfilled") {
        setCategories(categoriesRes.value.data.data || []);
      }
      if (outletsRes.status === "fulfilled") {
        setOutlets(outletsRes.value.data.data || []);
      }
      if (itemsRes.status === "fulfilled") {
        setPurchasableItems(itemsRes.value.data.data || []);
        setIsDirectPurchaseBlocked(false);
      } else {
        const err = itemsRes.reason;
        if (err?.response?.data?.error?.includes("tidak diizinkan")) {
          setIsDirectPurchaseBlocked(true);
        }
      }
    } catch (err: any) {
      console.error("Failed to load procurement data", err);
      toast.error("Gagal memuat data pengadaan");
    } finally {
      setLoading(false);
    }
  }, [activeContext?.outlet_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open Full-Page Detail
  const handleOpenDetail = async (purchase: Purchase) => {
    try {
      const [detailRes, payRes] = await Promise.allSettled([
        api.get(`/purchases/${purchase.id}`),
        api.get(`/purchases/${purchase.id}/payments`),
      ]);

      if (detailRes.status === "fulfilled") {
        setDetailPurchase(detailRes.value.data.data);
      } else {
        setDetailPurchase(purchase);
      }

      if (payRes.status === "fulfilled") {
        setDetailPayments(payRes.value.data.data || []);
      } else {
        setDetailPayments([]);
      }
      setCurrentView("detail");
    } catch {
      setDetailPurchase(purchase);
      setCurrentView("detail");
    }
  };

  // Open Add Payment Modal
  const handleOpenPayment = (purchase: Purchase) => {
    setPaymentTargetPurchase(purchase);
    setIsPaymentModalOpen(true);
  };

  // Confirm Physical Receipt
  const handleConfirmReceive = async (purchase: Purchase) => {
    try {
      await api.post(`/purchases/${purchase.id}/receive`, {});
      toast.success("Barang berhasil diterima dan saldo stok bertambah!");
      fetchData();
      if (detailPurchase?.id === purchase.id) {
        handleOpenDetail(purchase);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Gagal mengonfirmasi penerimaan barang");
    }
  };

  // KPI Metrics Summary
  const payablesSummary = useMemo(() => {
    const totalOwed = purchases.reduce((acc, p) => acc + (p.amount_owed || 0), 0);
    const unpaidCount = purchases.filter((p) => p.amount_owed > 0).length;
    const totalSpend = purchases.reduce((acc, p) => acc + (p.total_amount || 0), 0);
    return { totalOwed, unpaidCount, totalSpend };
  }, [purchases]);

  return (
    <div className="w-full space-y-6">
      {currentView === "create" ? (
        <PurchaseOrderForm
          outlets={outlets}
          suppliers={suppliers}
          purchasableItems={purchasableItems}
          categories={categories}
          defaultOutletId={activeContext?.outlet_id || outlets[0]?.id || ""}
          isDirectPurchaseBlocked={isDirectPurchaseBlocked}
          onBack={() => setCurrentView("list")}
          onSuccess={() => {
            setCurrentView("list");
            fetchData();
            if (onSuccess) onSuccess();
          }}
          onRefreshSuppliers={async () => {
            const res = await api.get("/suppliers");
            setSuppliers(res.data.data || []);
          }}
          onAddPurchasableItem={(newItem) => {
            setPurchasableItems((prev) => [newItem, ...prev]);
          }}
        />
      ) : currentView === "detail" && detailPurchase ? (
        <PurchaseOrderDetail
          purchase={detailPurchase}
          payments={detailPayments}
          onBack={() => setCurrentView("list")}
          onConfirmReceive={handleConfirmReceive}
          onOpenPayment={handleOpenPayment}
        />
      ) : (
        /* ========================================================================= */
        /* 📋 VIEW: LIST TAB VIEW (PURCHASES, PAYABLES, SUPPLIERS) */
        /* ========================================================================= */
        <div className="space-y-6 w-full animate-in fade-in-50 duration-200">
          {/* 🚀 RULE 17: FRAMELESS PAGE HEADER */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200/80 dark:border-[#2E2E34] gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#E2FF66]/20 border border-[#E2FF66]/40 flex items-center justify-center text-slate-900 dark:text-[#E2FF66]">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {t.procurementHistoryTitle || "Pembelian & Hutang Dagang (Procurement)"}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  {t.procurementHistoryDesc ||
                    "Faktur pembelian barang/bahan dari supplier, penerimaan stok fisik, dan tata kelola hutang dagang (AP)."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isDirectPurchaseBlocked && (
                <button
                  onClick={() => setCurrentView("create")}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#E2FF66] text-slate-900 font-bold text-sm hover:brightness-95 active:scale-95 transition shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Buat Faktur / PO</span>
                </button>
              )}
            </div>
          </div>

          {/* 🛡️ BANNER RESTRICTION IF BRANCH IS BLOCKED FROM DIRECT PURCHASE */}
          {isDirectPurchaseBlocked && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  Pengadaan Mandiri Dinonaktifkan untuk Cabang Ini
                </h4>
                <p className="text-xs text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
                  Outlet ini tidak diizinkan melakukan pembelian mandiri dari vendor luar. Seluruh kebutuhan pasokan barang dan bahan dipasok terpusat dari Gudang Pusat melalui menu <strong>Permintaan Pasokan Cabang (Distribusi)</strong>.
                </p>
              </div>
            </div>
          )}

          {/* 📊 SUMMARY METRICS CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Total Hutang Terutang</span>
                <CreditCard className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 mt-2">
                Rp {payablesSummary.totalOwed.toLocaleString("id-ID")}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {payablesSummary.unpaidCount} faktur belum lunas
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Total Pengadaan Selesai</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-2">
                Rp {payablesSummary.totalSpend.toLocaleString("id-ID")}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {purchases.length} total transaksi faktur
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Master Supplier Terdaftar</span>
                <Building2 className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-2">
                {suppliers.length} Vendor
              </div>
              <button
                onClick={() => setActiveTab("suppliers")}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mt-1 flex items-center gap-1 hover:underline cursor-pointer"
              >
                Kelola Master Supplier <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* 🧭 NAVIGATION TABS */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#2E2E34] pb-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab("purchases")}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === "purchases"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#2A2A30]"
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Faktur Pembelian & PO</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white">
                {purchases.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("payables")}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === "payables"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#2A2A30]"
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Hutang Dagang (AP)</span>
              {payablesSummary.unpaidCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-bold">
                  {payablesSummary.unpaidCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("suppliers")}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === "suppliers"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#2A2A30]"
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Master Supplier</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white">
                {suppliers.length}
              </span>
            </button>
          </div>

          {/* TAB CONTENTS */}
          {activeTab === "purchases" && (
            <PurchaseOrderTable
              purchases={purchases}
              onOpenDetail={handleOpenDetail}
              onOpenPayment={handleOpenPayment}
              onRefresh={fetchData}
            />
          )}

          {activeTab === "payables" && (
            <AccountsPayableTable
              purchases={purchases}
              onOpenDetail={handleOpenDetail}
              onOpenPayment={handleOpenPayment}
            />
          )}

          {activeTab === "suppliers" && (
            <SupplierManagement
              suppliers={suppliers}
              onRefresh={async () => {
                const res = await api.get("/suppliers");
                setSuppliers(res.data.data || []);
              }}
            />
          )}
        </div>
      )}

      {/* 💳 GLOBAL PAYMENT RECORD MODAL */}
      <PaymentModal
        open={isPaymentModalOpen}
        onOpenChange={setIsPaymentModalOpen}
        purchase={paymentTargetPurchase}
        onPaymentSuccess={() => {
          fetchData();
          if (detailPurchase && paymentTargetPurchase?.id === detailPurchase.id) {
            handleOpenDetail(paymentTargetPurchase);
          }
        }}
      />
    </div>
  );
}
