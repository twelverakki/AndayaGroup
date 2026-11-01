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
  const [detailLoading, setDetailLoading] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentTargetPurchase, setPaymentTargetPurchase] = useState<Purchase | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);

  const handleEditPurchase = async (purchase: Purchase) => {
    // If purchase items are not yet loaded (e.g. from the list view), fetch full details
    if (!purchase.items || purchase.items.length === 0) {
      try {
        const res = await api.get(`/purchases/${purchase.id}`);
        if (res.data?.data) {
          setEditingPurchase(res.data.data);
          setCurrentView("create");
          return;
        }
      } catch (err) {
        console.error("Failed to fetch full draft purchase details", err);
      }
    }
    setEditingPurchase(purchase);
    setCurrentView("create");
  };

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
    setDetailPurchase(purchase);
    setCurrentView("detail");
    setDetailLoading(true);
    try {
      const [detailRes, payRes] = await Promise.allSettled([
        api.get(`/purchases/${purchase.id}`),
        api.get(`/purchases/${purchase.id}/payments`),
      ]);

      if (detailRes.status === "fulfilled" && detailRes.value.data.data) {
        setDetailPurchase(detailRes.value.data.data);
      }

      if (payRes.status === "fulfilled") {
        setDetailPayments(payRes.value.data.data || []);
      } else {
        setDetailPayments([]);
      }
    } catch {
      // keep existing detailPurchase
    } finally {
      setDetailLoading(false);
    }
  };

  // Open Add Payment Modal
  const handleOpenPayment = (purchase: Purchase) => {
    setPaymentTargetPurchase(purchase);
    setIsPaymentModalOpen(true);
  };

  // Confirm Physical Receipt
  const handleConfirmReceive = async (
    purchase: Purchase,
    payload?: { received_at?: string; notes?: string; items?: { item_id: string; qty_received: number }[] }
  ) => {
    try {
      await api.post(`/purchases/${purchase.id}/receive`, payload || {});
      toast.success("Barang berhasil diverifikasi & saldo stok fisik telah masuk!");
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
          editPurchase={editingPurchase}
          onBack={() => {
            setEditingPurchase(null);
            setCurrentView("list");
          }}
          onSuccess={() => {
            setEditingPurchase(null);
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
          loading={detailLoading}
          onBack={() => setCurrentView("list")}
          onConfirmReceive={handleConfirmReceive}
          onOpenPayment={handleOpenPayment}
          onEditDraft={handleEditPurchase}
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
                  {t.procurementHistoryTitle}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  {t.procurementHistoryDesc}
                </p>
              </div>
            </div>
          </div>

          {/* 🛡️ BANNER RESTRICTION IF BRANCH IS BLOCKED FROM DIRECT PURCHASE */}
          {isDirectPurchaseBlocked && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  {t.procurementDirectBlockedTitle}
                </h4>
                <p className="text-xs text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
                  {t.procurementDirectBlockedDesc}
                </p>
              </div>
            </div>
          )}

          {/* 📊 4-COLUMN SUMMARY & ACTION CARDS (Menggantikan tabulasi horizontal) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Card 1: Action Add PO Card (Ala Master Item) */}
            {!isDirectPurchaseBlocked ? (
              <button
                type="button"
                onClick={() => {
                  setEditingPurchase(null);
                  setCurrentView("create");
                }}
                className="p-4 rounded-2xl border-2 border-dashed border-[#b8e635] bg-[#E2FF66]/15 dark:bg-[#E2FF66]/10 hover:bg-[#E2FF66]/25 dark:hover:bg-[#E2FF66]/20 transition-all cursor-pointer flex items-center justify-between text-left group active:scale-[0.98] shadow-xs"
              >
                <div className="text-left flex-1 min-w-0 pr-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-[#E2FF66] block mb-0.5 text-left">
                    {language === "id" ? "TAMBAH PENGADAAN" : "NEW PROCUREMENT"}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white group-hover:translate-x-0.5 transition-transform text-left truncate">
                    <ShoppingCart className="w-3.5 h-3.5 text-slate-700 dark:text-[#E2FF66] shrink-0" />
                    <span className="truncate">{language === "id" ? "Buat PO & Belanja" : "Create PO & Purchase"}</span>
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-[#E2FF66] text-slate-950 flex items-center justify-center font-bold shadow-sm group-hover:rotate-90 transition-transform shrink-0">
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                </div>
              </button>
            ) : (
              <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-[#2E2E34] bg-slate-50/60 dark:bg-[#1E1E22] text-slate-500 flex items-center justify-between">
                <div className="text-left flex-1 min-w-0 pr-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    {t.itemsReadOnlyBadge || "MODE BACA"}
                  </span>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                    {t.procurementDirectBlockedTitle || "Pasokan Pusat"}
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-slate-200/70 dark:bg-white/10 text-slate-500 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4" />
                </div>
              </div>
            )}

            {/* Card 2: Total Belanja (Riwayat PO) */}
            <div
              onClick={() => setActiveTab("purchases")}
              className={`p-4 rounded-2xl bg-white dark:bg-[#1E1E22] border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
                activeTab === "purchases"
                  ? "ring-2 ring-slate-900 dark:ring-white border-transparent bg-slate-50/70 dark:bg-[#25252A]"
                  : "border-slate-200/80 dark:border-[#2E2E34] hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span>{t.procurementMetricTotalSpend}</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-xl font-black text-slate-900 dark:text-white mt-1.5 truncate">
                  Rp {payablesSummary.totalSpend.toLocaleString("id-ID")}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {purchases.length} {t.procurementMetricTotalCount}
                </p>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className={`text-[11px] font-bold flex items-center gap-1 ${
                  activeTab === "purchases"
                    ? "text-slate-900 dark:text-[#E2FF66]"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}>
                  {activeTab === "purchases" ? (language === "id" ? "• Sedang Ditampilkan" : "• Currently Active") : (language === "id" ? "Lihat Riwayat PO" : "View Purchases")}
                  {activeTab !== "purchases" && <ArrowRight className="w-3 h-3" />}
                </span>
              </div>
            </div>

            {/* Card 3: Utang Tagihan / Jatuh Tempo */}
            <div
              onClick={() => setActiveTab("payables")}
              className={`p-4 rounded-2xl bg-white dark:bg-[#1E1E22] border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
                activeTab === "payables"
                  ? "ring-2 ring-rose-500 border-transparent bg-rose-50/20 dark:bg-rose-950/20"
                  : "border-slate-200/80 dark:border-[#2E2E34] hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span>{t.procurementMetricTotalOwed}</span>
                  <CreditCard className="w-4 h-4 text-rose-500" />
                </div>
                <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1.5 truncate">
                  Rp {payablesSummary.totalOwed.toLocaleString("id-ID")}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {payablesSummary.unpaidCount} {t.procurementMetricUnpaidCount}
                </p>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className={`text-[11px] font-bold flex items-center gap-1 ${
                  activeTab === "payables"
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-slate-500 hover:text-rose-600 dark:hover:text-rose-400"
                }`}>
                  {activeTab === "payables" ? (language === "id" ? "• Sedang Ditampilkan" : "• Currently Active") : (language === "id" ? "Lihat Utang Usaha" : "View Payables")}
                  {activeTab !== "payables" && <ArrowRight className="w-3 h-3" />}
                </span>
              </div>
            </div>

            {/* Card 4: Mitra Supplier */}
            <div
              onClick={() => setActiveTab("suppliers")}
              className={`p-4 rounded-2xl bg-white dark:bg-[#1E1E22] border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
                activeTab === "suppliers"
                  ? "ring-2 ring-indigo-500 border-transparent bg-indigo-50/20 dark:bg-indigo-950/20"
                  : "border-slate-200/80 dark:border-[#2E2E34] hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span>{t.procurementMetricSuppliers}</span>
                  <Building2 className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="text-xl font-black text-slate-900 dark:text-white mt-1.5 truncate">
                  {suppliers.length} {t.procurementMetricSupplierCount}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {suppliers.filter((s) => s.status === "active").length} {language === "id" ? "Mitra Aktif" : "Active Partners"}
                </p>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className={`text-[11px] font-bold flex items-center gap-1 ${
                  activeTab === "suppliers"
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"
                }`}>
                  {activeTab === "suppliers" ? (language === "id" ? "• Sedang Ditampilkan" : "• Currently Active") : (language === "id" ? "Kelola Supplier" : "Manage Suppliers")}
                  {activeTab !== "suppliers" && <ArrowRight className="w-3 h-3" />}
                </span>
              </div>
            </div>
          </div>

          {/* TAB CONTENTS */}
          {activeTab === "purchases" && (
            <PurchaseOrderTable
              purchases={purchases}
              onOpenDetail={handleOpenDetail}
              onOpenPayment={handleOpenPayment}
              onEditDraft={handleEditPurchase}
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
