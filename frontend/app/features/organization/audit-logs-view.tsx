import React, { useState, useEffect, useMemo } from "react";
import { api } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { useLanguageStore, translations } from "../../lib/i18n";
import { ErpDataTable, type ColumnDef } from "../../components/ErpDataTable";
import { ErpSearchBar } from "../../components/ErpSearchBar";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  ShieldAlert,
  Shield,
  Loader2,
  UserCheck,
  RefreshCw,
  Building,
  KeyRound,
  FileText,
} from "lucide-react";

export interface AuditLog {
  id: string;
  action: string;
  staff_name: string;
  manager_name: string;
  outlet_name?: string;
  reason?: string;
  created_at: string;
}

export default function AuditLogsView() {
  const { activeContext } = useAuthStore();
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await api.get("/organization/audit-logs");
      setLogs(Array.isArray(res.data) ? res.data : res.data?.data || []);
    } catch (err: any) {
      setLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeContext?.business_id]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return logs.filter(
      (l) =>
        (l.staff_name && l.staff_name.toLowerCase().includes(q)) ||
        (l.manager_name && l.manager_name.toLowerCase().includes(q)) ||
        (l.reason && l.reason.toLowerCase().includes(q)) ||
        (l.outlet_name && l.outlet_name.toLowerCase().includes(q)) ||
        l.action.toLowerCase().includes(q)
    );
  }, [logs, searchQuery]);

  const columns: ColumnDef<AuditLog>[] = useMemo(() => [
    {
      key: "timestamp",
      label: language === "id" ? "Waktu Kejadian" : "Timestamp",
      renderCell: (log) => (
        <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
          {new Date(log.created_at).toLocaleString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
    },
    {
      key: "action",
      label: language === "id" ? "Jenis Aksi / Otorisasi" : "Action Type",
      renderCell: (log) => (
        <Badge
          variant="outline"
          className={"text-[10px] font-bold rounded-full " + (
            log.action === "void"
              ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-800"
              : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800"
          )}
        >
          {log.action === "void" ? "Void Transaksi" : log.action}
        </Badge>
      ),
    },
    {
      key: "staff_name",
      label: language === "id" ? "Kasir Pemohon" : "Requested By",
      renderCell: (log) => (
        <span className="font-bold text-xs text-slate-900 dark:text-white">
          {log.staff_name}
        </span>
      ),
    },
    {
      key: "manager_name",
      label: language === "id" ? "Manager Pengesah (PIN)" : "Approved By (PIN)",
      renderCell: (log) => (
        <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-600 dark:text-indigo-400">
          <UserCheck className="w-3.5 h-3.5 shrink-0" />
          <span>{log.manager_name}</span>
        </div>
      ),
    },
    {
      key: "outlet_name",
      label: language === "id" ? "Cabang Outlet" : "Branch",
      renderCell: (log) => (
        <span className="text-xs text-slate-600 dark:text-slate-300">
          {log.outlet_name || "Semua Cabang"}
        </span>
      ),
    },
    {
      key: "reason",
      label: language === "id" ? "Alasan / Catatan" : "Reason / Note",
      align: "right",
      renderCell: (log) => (
        <span className="text-xs text-slate-500 dark:text-slate-400 italic">
          {log.reason || "Otorisasi Supervisor Kasir"}
        </span>
      ),
    },
  ], [language]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-[#2E2E34]">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-primary" />
            <span>{language === "id" ? "Jejak Audit & Otorisasi Keamanan" : "Audit Trail & Security Overrides"}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            {language === "id"
              ? "Buku besar jejak otorisasi Manager PIN Override (Void transaksi kasir, approval opname, & diskon khusus)."
              : "Audit trail ledger of Manager PIN Overrides (Cashier void requests, opname approvals, & special discounts)."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs px-3 py-1 rounded-full font-bold">
            Anti-Fraud Protection
          </Badge>

          <Button
            onClick={() => loadData(true)}
            disabled={refreshing}
            variant="outline"
            className="rounded-full font-bold text-xs h-9 px-3.5 gap-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5"
            title="Muat Ulang Data"
          >
            <RefreshCw className={"w-3.5 h-3.5 " + (refreshing ? "animate-spin text-primary" : "text-slate-500")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="w-full md:w-80">
        <ErpSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={
            language === "id" ? "Cari nama kasir, manager, alasan..." : "Search staff, manager, reason..."
          }
        />
      </div>

      {/* Master Audit Table via ErpDataTable */}
      <ErpDataTable<AuditLog>
        data={filteredLogs}
        columns={columns}
        keyExtractor={(log) => log.id}
        loading={loading}
        emptyText={language === "id" ? "Belum ada rekaman otorisasi khusus atau void transaksi." : "No override or void audit records found."}
        emptyIcon={<Shield className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />}
        renderMobileItem={(log) => (
          <div className="p-4 bg-white dark:bg-[#1E1E22] rounded-2xl border border-slate-200/80 dark:border-[#2E2E34] space-y-3 shadow-xs">
            <div className="flex items-start justify-between gap-2">
              <Badge
                variant="outline"
                className={"text-[9px] font-bold rounded-full " + (
                  log.action === "void"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                )}
              >
                {log.action === "void" ? "Void Transaksi" : log.action}
              </Badge>
              <span className="font-mono text-[10px] text-slate-400">
                {new Date(log.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Pemohon:</span>
                <span className="font-bold text-slate-900 dark:text-white">{log.staff_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Pengesah:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{log.manager_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Alasan:</span>
                <span className="italic text-slate-500 truncate max-w-[180px]">{log.reason || "-"}</span>
              </div>
            </div>
          </div>
        )}
      />
    </div>
  );
}
