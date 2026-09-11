import React, { useState, useEffect, useMemo } from "react";
import { api } from "../../lib/api";
import { useLanguageStore, translations } from "../../lib/i18n";
import { ErpDataTable, type ColumnDef } from "../../components/ErpDataTable";
import { ErpSearchBar } from "../../components/ErpSearchBar";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { toast } from "../../components/ui/sonner";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "../../components/ui/drawer";
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  UserCheck,
  Lock,
  Loader2,
  Sliders,
  AlertTriangle,
  RefreshCw,
  Copy,
  Terminal,
  Globe,
  User,
  Layers,
  ChevronRight,
  Fingerprint,
} from "lucide-react";

export interface SecurityAuditLog {
  id: string;
  actor_id?: string;
  actor_name?: string;
  actor_role?: string;
  action: string;
  target_type: string;
  target_id?: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export default function SecurityLogsView() {
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;

  const [logs, setLogs] = useState<SecurityAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | "auth" | "pin" | "user" | "capability" | "other">("all");
  const [selectedLog, setSelectedLog] = useState<SecurityAuditLog | null>(null);

  const loadLogs = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await api.get("/admin/security-logs");
      const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setLogs(list);
      if (isManualRefresh) {
        toast.success(language === "id" ? "Log keamanan berhasil diperbarui" : "Security logs refreshed");
      }
    } catch (err: any) {
      setLogs([]);
      if (isManualRefresh) {
        toast.error(err.response?.data?.message || (language === "id" ? "Gagal memuat log keamanan" : "Failed to refresh security logs"));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  // Action Capsule Badge Formatter
  const getActionBadge = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes("PASSWORD")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 shadow-2xs">
          <KeyRound className="w-3.5 h-3.5" />
          <span>{language === "id" ? "Ganti Password" : "Password Changed"}</span>
        </span>
      );
    }
    if (act.includes("USER_CREATED") || act.includes("CREATE")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 shadow-2xs">
          <UserCheck className="w-3.5 h-3.5" />
          <span>{language === "id" ? "User Dibuat" : "User Created"}</span>
        </span>
      );
    }
    if (act.includes("CAPABILITY")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40 shadow-2xs">
          <Sliders className="w-3.5 h-3.5" />
          <span>{language === "id" ? "Kapabilitas Diubah" : "Capability Updated"}</span>
        </span>
      );
    }
    if (act.includes("PIN")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40 shadow-2xs">
          <Lock className="w-3.5 h-3.5" />
          <span>{language === "id" ? "Reset PIN Kasir" : "Cashier PIN Reset"}</span>
        </span>
      );
    }
    if (act.includes("STATUS") || act.includes("DEACTIVATE") || act.includes("ACTIVATE")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/40 shadow-2xs">
          <Fingerprint className="w-3.5 h-3.5" />
          <span>{action}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-[#2A2A30] text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-[#38383C]">
        <ShieldCheck className="w-3.5 h-3.5 text-primary" />
        <span>{action}</span>
      </span>
    );
  };

  // KPI Statistics Calculation
  const stats = useMemo(() => {
    const total = logs.length;
    let authCount = 0;
    let capCount = 0;
    let userCount = 0;

    logs.forEach((l) => {
      const act = l.action.toUpperCase();
      if (act.includes("PASSWORD") || act.includes("PIN") || act.includes("AUTH") || act.includes("LOGIN")) {
        authCount++;
      }
      if (act.includes("CAPABILITY")) {
        capCount++;
      }
      if (act.includes("USER") || act.includes("STAFF") || act.includes("OWNER")) {
        userCount++;
      }
    });

    return { total, authCount, capCount, userCount };
  }, [logs]);

  // Filter & Search Logic
  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        l.action.toLowerCase().includes(q) ||
        (l.actor_name && l.actor_name.toLowerCase().includes(q)) ||
        (l.actor_role && l.actor_role.toLowerCase().includes(q)) ||
        (l.target_id && l.target_id.toLowerCase().includes(q)) ||
        (l.target_type && l.target_type.toLowerCase().includes(q)) ||
        (l.ip_address && l.ip_address.toLowerCase().includes(q));

      if (!matchSearch) return false;

      const act = l.action.toUpperCase();
      if (activeCategory === "auth") {
        return act.includes("PASSWORD") || act.includes("AUTH") || act.includes("LOGIN");
      }
      if (activeCategory === "pin") {
        return act.includes("PIN");
      }
      if (activeCategory === "user") {
        return act.includes("USER") || act.includes("STAFF") || act.includes("OWNER");
      }
      if (activeCategory === "capability") {
        return act.includes("CAPABILITY");
      }
      if (activeCategory === "other") {
        return !act.includes("PASSWORD") && !act.includes("PIN") && !act.includes("USER") && !act.includes("CAPABILITY");
      }
      return true;
    });
  }, [logs, searchQuery, activeCategory]);

  // Copy Payload JSON to Clipboard
  const handleCopyPayload = (details?: Record<string, any>) => {
    if (!details) return;
    navigator.clipboard.writeText(JSON.stringify(details, null, 2));
    toast.success(t.secCopyPayloadSuccess || "Payload JSON berhasil disalin ke clipboard!");
  };

  // ErpDataTable Column Definitions
  const columns: ColumnDef<SecurityAuditLog>[] = useMemo(() => [
    {
      key: "timestamp",
      label: t.secColTimestamp || "Waktu Kejadian",
      renderCell: (log) => (
        <div className="flex flex-col">
          <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
            {new Date(log.created_at).toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
          <span className="font-mono text-[10px] text-slate-400">
            {new Date(log.created_at).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>
      ),
    },
    {
      key: "event",
      label: t.secColEvent || "Aksi / Peristiwa",
      renderCell: (log) => getActionBadge(log.action),
    },
    {
      key: "actor",
      label: t.secColActor || "Pelaku (Actor)",
      renderCell: (log) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-600 dark:text-slate-300 font-black text-xs shrink-0">
            {(log.actor_name || "S").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
              {log.actor_name || "System Automated"}
            </div>
            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              {log.actor_role || "SYSTEM"}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "target",
      label: t.secColTarget || "Tipe & Target",
      renderCell: (log) => (
        <div>
          <Badge variant="outline" className="text-[10px] font-bold rounded-full capitalize">
            {log.target_type}
          </Badge>
          {log.target_id && (
            <span className="text-[10px] text-slate-400 font-mono block mt-0.5 truncate max-w-[140px]">
              ID: {log.target_id.slice(0, 8)}...
            </span>
          )}
        </div>
      ),
    },
    {
      key: "ip_address",
      label: t.secColIp || "Alamat IP / Klien",
      renderCell: (log) => (
        <div className="flex items-center gap-1.5 font-mono text-xs text-slate-600 dark:text-slate-300">
          <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{log.ip_address || "127.0.0.1"}</span>
        </div>
      ),
    },
    {
      key: "action",
      label: t.secColDetails || "Aksi",
      align: "right",
      renderCell: (log) => (
        <Button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedLog(log);
          }}
          variant="ghost"
          size="sm"
          className="h-8 rounded-full text-xs font-bold gap-1 text-primary hover:bg-primary/10 hover:text-primary cursor-pointer"
        >
          <span>{t.secInspect || "Inspeksi"}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      ),
    },
  ], [language, t]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── TOP HEADER BAR ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-[#2E2E34]">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-primary" />
            <span>{t.secTitle || "Log Keamanan & Otorisasi Sensitif"}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
            {t.secDesc || "Buku besar jejak keamanan platform: pembuatan admin/user, ubah password, reset PIN, dan modifikasi konfigurasi tenant."}
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs px-3.5 py-1 rounded-full font-bold flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>{t.secGuardActive || "Platform Guard Aktif"}</span>
          </Badge>

          <Button
            onClick={() => loadLogs(true)}
            disabled={refreshing}
            variant="outline"
            className="rounded-full font-bold text-xs h-9 px-3.5 gap-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5"
            title="Muat Ulang Log"
          >
            <RefreshCw className={"w-3.5 h-3.5 " + (refreshing ? "animate-spin text-primary" : "text-slate-500")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* ── KPI STAT SUMMARY COUNTERS (4 CARDS) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
              {t.secStatTotal || "Total Log"}
            </p>
            <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight mt-0.5">
              {stats.total}
            </h3>
          </div>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
              {t.secStatAuth || "Kredensial & PIN"}
            </p>
            <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight mt-0.5">
              {stats.authCount}
            </h3>
          </div>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
            <Sliders className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
              {t.secStatCapabilities || "Kapabilitas"}
            </p>
            <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight mt-0.5">
              {stats.capCount}
            </h3>
          </div>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
              {t.secStatUsers || "Manajemen User"}
            </p>
            <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight mt-0.5">
              {stats.userCount}
            </h3>
          </div>
        </div>
      </div>

      {/* ── SEARCH & CATEGORY FILTER TABS ── */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="w-full sm:w-80 md:w-96">
            <ErpSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={language === "id" ? "Cari aksi, pelaku, IP, atau target..." : "Search action, actor, IP, or target..."}
            />
          </div>

          {/* Segmented Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-[#1E1E22] rounded-2xl border border-slate-200/80 dark:border-[#2E2E34] overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={"px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap " + (
                activeCategory === "all"
                  ? "bg-white dark:bg-[#2A2A30] text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              {t.secTabAll || "Semua"}
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory("auth")}
              className={"px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap " + (
                activeCategory === "auth"
                  ? "bg-white dark:bg-[#2A2A30] text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              {t.secTabAuth || "Password"}
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory("pin")}
              className={"px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap " + (
                activeCategory === "pin"
                  ? "bg-white dark:bg-[#2A2A30] text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              {t.secTabPin || "PIN"}
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory("user")}
              className={"px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap " + (
                activeCategory === "user"
                  ? "bg-white dark:bg-[#2A2A30] text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              {t.secTabUsers || "User"}
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory("capability")}
              className={"px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap " + (
                activeCategory === "capability"
                  ? "bg-white dark:bg-[#2A2A30] text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              {t.secTabCapabilities || "Kapabilitas"}
            </button>
          </div>
        </div>
      </div>

      {/* ── MASTER SECURITY LOG TABLE (ERP DATA TABLE) ── */}
      <ErpDataTable<SecurityAuditLog>
        data={filteredLogs}
        columns={columns}
        keyExtractor={(log) => log.id}
        loading={loading}
        emptyText={t.secEmptyTitle || "Belum ada rekaman log keamanan sistem yang sesuai filter."}
        onRowClick={(log) => setSelectedLog(log)}
        renderMobileItem={(log) => (
          <div
            onClick={() => setSelectedLog(log)}
            className="p-4 bg-white dark:bg-[#1E1E22] rounded-2xl border border-slate-200/80 dark:border-[#2E2E34] space-y-3 shadow-xs cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-all"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {getActionBadge(log.action)}
              </div>
              <span className="font-mono text-[10px] text-slate-400">
                {new Date(log.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <div>
                <span className="font-extrabold text-slate-900 dark:text-white">{log.actor_name || "System"}</span>
                <span className="text-[10px] text-slate-400 block">{log.actor_role || "SYSTEM"}</span>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="text-[9px] font-bold rounded-full capitalize">
                  {log.target_type}
                </Badge>
                <span className="text-[10px] text-slate-400 font-mono block mt-0.5">{log.ip_address || "127.0.0.1"}</span>
              </div>
            </div>
          </div>
        )}
      />

      {/* ── RIGHT SLIDE DRAWER: LOG INSPECTION & PAYLOAD DETAIL ── */}
      <Drawer
        direction="right"
        open={!!selectedLog}
        onOpenChange={(open) => !open && setSelectedLog(null)}
      >
        <DrawerContent className="w-full sm:w-[500px] md:w-[540px]">
          {selectedLog && (
            <div className="flex flex-col h-full justify-between">
              <div className="overflow-y-auto">
                <DrawerHeader className="border-b border-slate-100 dark:border-[#2A2A30] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Terminal className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <DrawerTitle className="text-base font-black text-slate-900 dark:text-white">
                        {t.secDrawerTitle || "Rincian Log Keamanan"}
                      </DrawerTitle>
                      <DrawerDescription className="text-xs text-slate-400 mt-0.5">
                        {t.secDrawerDesc || "Informasi audit lengkap dan metadata payload teknis."}
                      </DrawerDescription>
                    </div>
                  </div>
                </DrawerHeader>

                <div className="p-6 space-y-6 text-xs">
                  {/* Event Overview */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-[#2E2E34] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">Peristiwa:</span>
                      {getActionBadge(selectedLog.action)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">Waktu Timestamp:</span>
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                        {new Date(selectedLog.created_at).toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">Log ID:</span>
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                        {selectedLog.id}
                      </span>
                    </div>
                  </div>

                  {/* Actor Breakdown */}
                  <div className="space-y-2">
                    <h5 className="font-black uppercase text-[11px] tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{t.secActorInfo || "Informasi Pelaku (Actor)"}</span>
                    </h5>
                    <div className="grid grid-cols-2 gap-2 p-3.5 rounded-2xl border border-slate-200/80 dark:border-[#2E2E34]">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Nama / Akun:</span>
                        <span className="font-extrabold text-slate-900 dark:text-white text-xs">{selectedLog.actor_name || "System"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">{t.secActorRole || "Peran Akses"}:</span>
                        <span className="font-mono uppercase text-primary font-bold text-xs">{selectedLog.actor_role || "SYSTEM"}</span>
                      </div>
                      {selectedLog.actor_id && (
                        <div className="col-span-2 pt-1 border-t border-slate-100 dark:border-white/5">
                          <span className="text-[10px] text-slate-400 block font-semibold">Actor ID:</span>
                          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{selectedLog.actor_id}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Target Breakdown */}
                  <div className="space-y-2">
                    <h5 className="font-black uppercase text-[11px] tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-blue-500" />
                      <span>{t.secTargetInfo || "Target Entitas"}</span>
                    </h5>
                    <div className="grid grid-cols-2 gap-2 p-3.5 rounded-2xl border border-slate-200/80 dark:border-[#2E2E34]">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">{t.secTargetType || "Tipe Target"}:</span>
                        <Badge variant="outline" className="text-[10px] font-bold rounded-full capitalize mt-0.5">
                          {selectedLog.target_type}
                        </Badge>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">{t.secTargetId || "ID Target"}:</span>
                        <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 truncate block mt-0.5">
                          {selectedLog.target_id || "-"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Network Information */}
                  <div className="space-y-2">
                    <h5 className="font-black uppercase text-[11px] tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{t.secNetworkInfo || "Informasi Jaringan & Klien"}</span>
                    </h5>
                    <div className="space-y-2 p-3.5 rounded-2xl border border-slate-200/80 dark:border-[#2E2E34]">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-semibold">{t.secIpAddress || "Alamat IP"}:</span>
                        <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                          {selectedLog.ip_address || "127.0.0.1"}
                        </span>
                      </div>
                      <div className="pt-1.5 border-t border-slate-100 dark:border-white/5">
                        <span className="text-[10px] text-slate-400 font-semibold block mb-0.5">{t.secUserAgent || "User Agent"}:</span>
                        <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 break-all leading-tight block">
                          {selectedLog.user_agent || "Mozilla/5.0 (Client Application)"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* JSON Payload Details */}
                  {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h5 className="font-black uppercase text-[11px] tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5 text-amber-500" />
                          <span>{t.secPayloadData || "Data Payload / Parameter"}</span>
                        </h5>
                        <Button
                          type="button"
                          onClick={() => handleCopyPayload(selectedLog.details)}
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2.5 text-[10px] font-bold rounded-full gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{t.secCopyPayload || "Salin JSON"}</span>
                        </Button>
                      </div>
                      <pre className="p-3.5 rounded-2xl bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto max-h-48 border border-slate-800">
                        {JSON.stringify(selectedLog.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              <DrawerFooter className="p-6 border-t border-slate-100 dark:border-[#2A2A30]">
                <Button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="w-full rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs h-10 cursor-pointer"
                >
                  {t.secClose || "Tutup"}
                </Button>
              </DrawerFooter>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
