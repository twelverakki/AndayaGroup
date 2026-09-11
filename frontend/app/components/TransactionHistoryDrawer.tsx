import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useAuthStore } from "../lib/store";
import { useLanguageStore, translations } from "../lib/i18n";
import { ErpSearchBar } from "./ErpSearchBar";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "./ui/drawer";
import {
  Receipt,
  RotateCcw,
  Printer,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  AlertCircle,
  CreditCard,
  Banknote,
  QrCode,
  ShieldCheck,
  ChevronRight,
  Filter,
  RefreshCw,
} from "lucide-react";

export interface TransactionItemData {
  id: string;
  product_id: string;
  qty: number;
  unit_price: number;
  subtotal: number;
  product_name?: string;
  unit_type?: string;
}

export interface TransactionRecord {
  id: string;
  business_id: string;
  outlet_id: string;
  shift_id?: string;
  staff_id: string;
  staff_name?: string;
  type: "sale" | "internal_take" | "void";
  total_amount: number;
  payment_method: "cash" | "qris" | "other";
  status: "completed" | "voided";
  client_uuid: string;
  synced_at?: string;
  created_at: string;
  items?: TransactionItemData[];
}

interface TransactionHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReprintReceipt?: (tx: TransactionRecord) => void;
  isNested?: boolean;
}

export default function TransactionHistoryDrawer({
  open,
  onOpenChange,
  onReprintReceipt,
}: TransactionHistoryDrawerProps) {
  const { activeContext } = useAuthStore();
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;

  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "voided">("all");
  
  // Selected detail
  const [selectedTx, setSelectedTx] = useState<TransactionRecord | null>(null);

  // Void modal state
  const [voidingTxId, setVoidingTxId] = useState<string | null>(null);
  const [managerPin, setManagerPin] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [voidLoading, setVoidLoading] = useState(false);
  const [voidError, setVoidError] = useState("");

  const fetchTransactions = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/transactions", {
        params: { active_shift: "true" },
      });
      setTransactions(res.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || "Gagal memuat riwayat transaksi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchTransactions();
      setSelectedTx(null);
    }
  }, [open]);

  const handleVoidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidingTxId) return;

    setVoidLoading(true);
    setVoidError("");

    try {
      await api.post(`/transactions/${voidingTxId}/void`, {
        manager_pin: managerPin,
        reason: voidReason || t.posDefaultVoidReason,
      });

      // Update local transaction state
      setTransactions((prev) =>
        prev.map((tx) =>
          tx.id === voidingTxId ? { ...tx, status: "voided" as const } : tx
        )
      );

      if (selectedTx?.id === voidingTxId) {
        setSelectedTx((prev) => (prev ? { ...prev, status: "voided" as const } : null));
      }

      setVoidingTxId(null);
      setManagerPin("");
      setVoidReason("");
      alert(t.posVoidSuccess);
    } catch (err: any) {
      setVoidError(err.response?.data?.message || t.posVoidFailed);
    } finally {
      setVoidLoading(false);
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (statusFilter !== "all" && tx.status !== statusFilter) return false;
    if (searchFilter.trim()) {
      const query = searchFilter.toLowerCase();
      const matchId = tx.id.toLowerCase().includes(query);
      const matchTotal = tx.total_amount.toString().includes(query);
      const matchMethod = tx.payment_method.toLowerCase().includes(query);
      return matchId || matchTotal || matchMethod;
    }
    return true;
  });

  const totalCompletedAmount = transactions
    .filter((tx) => tx.status === "completed")
    .reduce((sum, tx) => sum + tx.total_amount, 0);

  const totalVoidedCount = transactions.filter((tx) => tx.status === "voided").length;

  return (
    <Drawer direction="right" open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="w-[500px] sm:w-[540px] md:w-[560px] max-w-[95vw] border-l bg-white dark:bg-[#202024] text-neutral-dark dark:text-white">
        <div className="flex flex-col h-full w-full p-5 sm:p-6 overflow-hidden">
          
          {/* Header */}
          <DrawerHeader className="p-0 pb-4 border-b border-slate-200 dark:border-dark-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 dark:bg-primary/10 text-purple-600 dark:text-primary flex items-center justify-center shrink-0 font-bold">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <DrawerTitle className="text-base font-extrabold text-slate-800 dark:text-slate-100">
                    {t.posHistoryTitle}
                  </DrawerTitle>
                  <DrawerDescription className="text-xs text-slate-500 dark:text-slate-400">
                    {t.posShiftActive} • {activeContext?.name || "Outlet"}
                  </DrawerDescription>
                </div>
              </div>

              <button
                type="button"
                onClick={fetchTransactions}
                disabled={loading}
                className="p-2 rounded-xl bg-slate-100 dark:bg-[#2C2C30] hover:bg-slate-200 dark:hover:bg-dark-border text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* Quick Shift Summary Stats */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#26262A] border border-slate-200/80 dark:border-dark-border">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{t.posShiftRevenue}</p>
                <p className="text-xs sm:text-sm font-extrabold text-emerald-600 dark:text-primary truncate mt-0.5">
                  Rp {totalCompletedAmount.toLocaleString("id-ID")}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#26262A] border border-slate-200/80 dark:border-dark-border">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{t.posTotalInvoices}</p>
                <p className="text-xs sm:text-sm font-extrabold text-slate-700 dark:text-slate-200 mt-0.5">
                  {transactions.length} {t.posTransactions}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#26262A] border border-slate-200/80 dark:border-dark-border">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{t.posTotalVoided}</p>
                <p className="text-xs sm:text-sm font-extrabold text-red-500 mt-0.5">
                  {totalVoidedCount} {t.posCanceled}
                </p>
              </div>
            </div>
          </DrawerHeader>

          {/* Filter & Search Bar */}
          <div className="py-3 space-y-2 border-b border-slate-200/60 dark:border-dark-border shrink-0">
            <ErpSearchBar
              value={searchFilter}
              onChange={setSearchFilter}
              placeholder={t.posSearchTxPlaceholder}
              size="sm"
            />

            <div className="flex gap-1.5">
              {[
                { id: "all", label: `${t.posTabAll} (${transactions.length})` },
                { id: "completed", label: `${t.posTabSuccess} (${transactions.filter((t) => t.status === "completed").length})` },
                { id: "voided", label: `${t.posTabVoid} (${totalVoidedCount})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id as any)}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                    statusFilter === tab.id
                      ? "bg-brand-purple dark:bg-primary text-white dark:text-[#1a1a1a] shadow-xs"
                      : "bg-slate-100 dark:bg-[#28282D] text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Body Content / Transactions List */}
          <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1 scrollbar-thin">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center text-center text-slate-400">
                <RefreshCw className="w-7 h-7 animate-spin mb-2 opacity-60" />
                <p className="text-xs font-bold">Memuat...</p>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center text-slate-400">
                <Receipt className="w-10 h-10 mb-2 opacity-40" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{t.posNoTxFound}</p>
                <p className="text-[11px] opacity-60 max-w-[220px] mt-0.5">
                  {t.posNoTxFoundDesc}
                </p>
              </div>
            ) : (
              filteredTransactions.map((tx) => {
                const isVoided = tx.status === "voided";
                const isSelected = selectedTx?.id === tx.id;

                return (
                  <div
                    key={tx.id}
                    onClick={() => setSelectedTx(isSelected ? null : tx)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? "border-brand-purple dark:border-primary bg-purple-500/5 dark:bg-primary/5"
                        : "border-slate-200/80 dark:border-dark-border bg-white dark:bg-[#26262A] hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                            isVoided
                              ? "bg-red-500/10 text-red-500"
                              : tx.payment_method === "qris"
                              ? "bg-blue-500/10 text-blue-500"
                              : "bg-emerald-500/10 text-emerald-500"
                          }`}
                        >
                          {tx.payment_method === "qris" ? (
                            <QrCode className="w-4 h-4" />
                          ) : (
                            <Banknote className="w-4 h-4" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-100">
                              #{tx.id.substring(0, 8).toUpperCase()}
                            </span>
                            {isVoided ? (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                                {t.posTabVoid}
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                {t.posCompleted}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>
                              {new Date(tx.created_at).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </span>
                            <span>•</span>
                            <span className="capitalize">{tx.payment_method}</span>
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p
                          className={`text-sm font-extrabold ${
                            isVoided ? "line-through opacity-50 text-slate-400" : "text-slate-900 dark:text-white"
                          }`}
                        >
                          Rp {tx.total_amount.toLocaleString("id-ID")}
                        </p>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {tx.synced_at ? "✓ Synced" : "⚡ Local"}
                        </span>
                      </div>
                    </div>

                    {/* Collapsible Action Drawer Box if selected */}
                    {isSelected && (
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-dark-border flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onReprintReceipt) {
                              onReprintReceipt(tx);
                            }
                          }}
                          className="flex-1 py-2 px-3 rounded-xl bg-slate-100 dark:bg-dark-bg hover:bg-slate-200 dark:hover:bg-[#2E2E34] text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Printer className="w-3.5 h-3.5 text-purple-600 dark:text-primary" />
                          <span>{t.posPrintReceipt}</span>
                        </button>

                        {!isVoided && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setVoidingTxId(tx.id);
                              setVoidError("");
                              setManagerPin("");
                              setVoidReason("");
                            }}
                            className="py-2 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-bold border border-red-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>{t.posVoidAction}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer info */}
          <div className="pt-3 border-t border-slate-200 dark:border-dark-border text-[10px] text-slate-400 text-center shrink-0">
            Andaya Group POS • Real-time Offline Ledger Synchronized
          </div>
        </div>

        {/* ================= VOID MODAL OVERLAY ================= */}
        {voidingTxId && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 text-neutral-dark">
            <div className="w-full max-w-sm border rounded-3xl p-6 bg-white dark:bg-dark-card-lighter border-slate-200 dark:border-dark-border-lighter text-slate-800 dark:text-white shadow-2xl space-y-4">
              <div className="flex items-center gap-2.5 text-red-500">
                <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{t.posVoidModalTitle}</h4>
                  <p className="text-[10px] opacity-70 text-slate-500 dark:text-slate-300">
                    {t.posManagerPinRequired}
                  </p>
                </div>
              </div>

              {voidError && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{voidError}</span>
                </div>
              )}

              <form onSubmit={handleVoidSubmit} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    {t.posVoidManagerPin}
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    value={managerPin}
                    onChange={(e) => setManagerPin(e.target.value)}
                    placeholder="••••••"
                    className="w-full text-center tracking-widest text-lg font-bold px-3 py-2 rounded-xl border bg-slate-50 dark:bg-dark-bg border-slate-200 dark:border-dark-border-lighter focus:outline-none focus:ring-2 focus:ring-red-500/40"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    {t.posVoidReason}
                  </label>
                  <input
                    type="text"
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                    placeholder={t.posVoidPlaceholder}
                    className="w-full px-3 py-2 text-xs rounded-xl border bg-slate-50 dark:bg-dark-bg border-slate-200 dark:border-dark-border-lighter focus:outline-none focus:ring-1 focus:ring-red-500/40"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVoidingTxId(null);
                      setManagerPin("");
                      setVoidReason("");
                      setVoidError("");
                    }}
                    className="flex-1 py-2.5 text-xs font-bold border border-slate-200 dark:border-dark-border-lighter rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={voidLoading || !managerPin}
                    className="flex-1 py-2.5 text-xs font-bold bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    {voidLoading ? t.saving : t.posVoidConfirm}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </DrawerContent>
    </Drawer>
  );
}
