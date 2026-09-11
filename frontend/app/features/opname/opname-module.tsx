import { useState, useEffect, useMemo } from "react";
import { api } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { useLanguageStore } from "../../lib/i18n";
import { useAdjustmentSession } from "../../lib/adjustment-session";
import { ErpSearchBar } from "../../components/ErpSearchBar";
import { ErpDataTable, type ColumnDef } from "../../components/ErpDataTable";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { toast } from "../../components/ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../../components/ui/select";
import {
  SlidersHorizontal,
  Lock,
  Unlock,
  Package,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  UserCheck,
  Plus,
  Layers,
  Tag,
  ClipboardList,
  Check,
  AlertCircle,
  Eye,
} from "lucide-react";

interface WastageLog {
  id: string;
  product_id?: string;
  product_name?: string;
  product_sku?: string;
  unit_type?: string;
  expected_qty: number;
  actual_qty: number;
  discrepancy: number;
  reason?: string;
  input_by?: string;
  input_by_name?: string;
  status: "pending_approval" | "approved" | "rejected";
  created_at: string;
}

interface OpnameItem {
  id: string;
  opname_session_id: string;
  product_id?: string;
  product_name?: string;
  product_sku?: string;
  ingredient_id?: string;
  ingredient_name?: string;
  unit_type: string;
  expected_qty?: number;
  actual_qty: number;
  discrepancy: number;
  unit_cost: number;
  notes?: string;
  created_at: string;
}

interface OpnameSessionData {
  id: string;
  business_id: string;
  outlet_id?: string;
  session_name: string;
  target_category: "all" | "products" | "raw_materials" | "tool_supplies";
  status: "open" | "pending_approval" | "completed" | "rejected";
  notes?: string;
  created_by: string;
  created_by_name?: string;
  audited_by?: string;
  audited_by_name?: string;
  approved_by?: string;
  approved_by_name?: string;
  created_at: string;
  completed_at?: string;
  items?: OpnameItem[];
}

export default function OpnameModule() {
  const { activeContext } = useAuthStore();
  const { language } = useLanguageStore();
  const session = useAdjustmentSession();

  const isManagerOrOwner = activeContext?.role === "manager" || activeContext?.role === "owner";
  const isSuperAdmin = activeContext?.role === "superadmin";
  const isStaff = activeContext?.role === "staff" || activeContext?.role === "kasir";

  // Tab State
  const [opnameTab, setOpnameTab] = useState<"sessions" | "blind_count" | "audit_trail">("sessions");

  // Data & Filter States
  const [sessions, setSessions] = useState<OpnameSessionData[]>([]);
  const [sessionSearchQuery, setSessionSearchQuery] = useState("");
  const [sessionStatusFilter, setSessionStatusFilter] = useState<"all" | "open" | "pending_approval" | "completed">("all");
  const [logs, setLogs] = useState<WastageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "reduction" | "addition">("all");

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (sessionStatusFilter !== "all" && s.status !== sessionStatusFilter) return false;
      if (!sessionSearchQuery.trim()) return true;
      const q = sessionSearchQuery.toLowerCase();
      const nameMatch = (s.session_name || "").toLowerCase().includes(q);
      const categoryMatch = (s.target_category || "").toLowerCase().includes(q);
      const userMatch = (s.audited_by_name || s.created_by_name || "").toLowerCase().includes(q);
      return nameMatch || categoryMatch || userMatch;
    });
  }, [sessions, sessionSearchQuery, sessionStatusFilter]);

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");
  const [newTargetCategory, setNewTargetCategory] = useState<"all" | "products" | "raw_materials" | "tool_supplies">("all");
  const [newSessionNotes, setNewSessionNotes] = useState("");
  const [submittingSession, setSubmittingSession] = useState(false);

  // Active Session for Staff Blind Count or Manager Approval
  const [activeSession, setActiveSession] = useState<OpnameSessionData | null>(null);
  const [blindItems, setBlindItems] = useState<OpnameItem[]>([]);
  const [showBlindCountModal, setShowBlindCountModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [submittingCount, setSubmittingCount] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resSessions, resLogs] = await Promise.all([
        api.get("/opname-sessions").catch(() => ({ data: [] })),
        api.get("/wastage-logs").catch(() => ({ data: [] })),
      ]);
      setSessions(resSessions.data || []);
      setLogs(resLogs.data || []);
    } catch (err: any) {
      console.error("Failed to load opname data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeContext]);

  // Create Opname Session Handler
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingSession(true);
    try {
      await api.post("/opname-sessions", {
        session_name: newSessionName,
        target_category: newTargetCategory,
        notes: newSessionNotes || undefined,
      });
      toast.success(language === "en" ? "Opname session created successfully!" : "Sesi opname baru berhasil dibuat!");
      setShowCreateModal(false);
      setNewSessionName("");
      setNewSessionNotes("");
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || (language === "en" ? "Failed to create session" : "Gagal membuat sesi opname"));
    } finally {
      setSubmittingSession(false);
    }
  };

  // Open Blind Count Modal for Staff
  const handleOpenBlindCount = async (s: OpnameSessionData) => {
    try {
      const res = await api.get(`/opname-sessions/${s.id}`);
      setActiveSession(res.data);
      setBlindItems(res.data.items || []);
      setShowBlindCountModal(true);
    } catch (err: any) {
      toast.error(language === "en" ? "Failed to load session details" : "Gagal memuat detail sesi opname");
    }
  };

  // Submit Staff Blind Count
  const handleSubmitBlindCount = async () => {
    if (!activeSession) return;
    setSubmittingCount(true);
    try {
      await api.post(`/opname-sessions/${activeSession.id}/submit`, {
        items: blindItems,
      });
      toast.success(language === "en" ? "Physical count submitted for Manager approval!" : "Hasil hitungan fisik berhasil dikirim ke Manager!");
      setShowBlindCountModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || (language === "en" ? "Failed to submit counts" : "Gagal mengirim hitungan fisik"));
    } finally {
      setSubmittingCount(false);
    }
  };

  // Open Approval Modal for Manager/Owner
  const handleOpenApproval = async (s: OpnameSessionData) => {
    try {
      const res = await api.get(`/opname-sessions/${s.id}`);
      setActiveSession(res.data);
      setShowApprovalModal(true);
    } catch (err: any) {
      toast.error(language === "en" ? "Failed to load session details" : "Gagal memuat detail sesi");
    }
  };

  // Approve Opname Session Manager
  const handleApproveSession = async () => {
    if (!activeSession) return;
    try {
      await api.post(`/opname-sessions/${activeSession.id}/approve`);
      toast.success(language === "en" ? "Opname session approved and stock reconciled!" : "Sesi opname disetujui & stok berhasil direkonsiliasi!");
      setShowApprovalModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || (language === "en" ? "Failed to approve session" : "Gagal menyetujui sesi opname"));
    }
  };

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterType === "reduction" && log.discrepancy >= 0) return false;
      if (filterType === "addition" && log.discrepancy <= 0) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const nameMatch = (log.product_name || "").toLowerCase().includes(q);
      const skuMatch = (log.product_sku || "").toLowerCase().includes(q);
      const reasonMatch = (log.reason || "").toLowerCase().includes(q);
      const userMatch = (log.input_by_name || "").toLowerCase().includes(q);

      return nameMatch || skuMatch || reasonMatch || userMatch;
    });
  }, [logs, searchQuery, filterType]);

  // Metrics
  const metrics = useMemo(() => {
    const openSessions = sessions.filter((s) => s.status === "open").length;
    const pendingApproval = sessions.filter((s) => s.status === "pending_approval").length;
    let totalReduction = 0;
    logs.forEach((l) => {
      if (l.discrepancy < 0) totalReduction += Math.abs(l.discrepancy);
    });

    return {
      openSessions,
      pendingApproval,
      totalReduction,
      totalSessions: sessions.length,
    };
  }, [sessions, logs]);

  // Table Columns Definition
  const sessionColumns: ColumnDef<OpnameSessionData>[] = [
    {
      key: "session_name",
      label: language === "en" ? "SESSION NAME" : "NAMA SESI OPNAME",
      renderCell: (s: OpnameSessionData) => (
        <div>
          <span className="font-semibold text-slate-900 dark:text-white block">{s.session_name}</span>
          <span className="text-[10px] text-slate-400 font-mono">
            {new Date(s.created_at).toLocaleDateString(language === "en" ? "en-US" : "id-ID", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      ),
    },
    {
      key: "target_category",
      label: language === "en" ? "TARGET CATEGORY" : "KATEGORI TARGET",
      renderCell: (s: OpnameSessionData) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-[#2A2A30] text-slate-700 dark:text-slate-300 text-xs font-medium">
          {s.target_category === "products" ? (
            <>
              <Package className="w-3.5 h-3.5 text-blue-500" />
              <span>{language === "en" ? "Finished Products" : "Produk Jadi"}</span>
            </>
          ) : s.target_category === "raw_materials" ? (
            <>
              <Layers className="w-3.5 h-3.5 text-amber-500" />
              <span>{language === "en" ? "Raw Materials" : "Bahan Baku"}</span>
            </>
          ) : s.target_category === "tool_supplies" ? (
            <>
              <Tag className="w-3.5 h-3.5 text-purple-500" />
              <span>{language === "en" ? "Tools & Supplies" : "Alat & Kemasan"}</span>
            </>
          ) : (
            <span>{language === "en" ? "All Items" : "Semua Barang"}</span>
          )}
        </span>
      ),
    },
    {
      key: "audited_by",
      label: language === "en" ? "AUDITOR / STAFF" : "STAF AUDITOR",
      renderCell: (s: OpnameSessionData) => (
        <div className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
          <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{s.audited_by_name || s.created_by_name || "Staf Toko"}</span>
        </div>
      ),
    },
    {
      key: "status",
      label: "STATUS",
      renderCell: (s: OpnameSessionData) => (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
            s.status === "completed"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              : s.status === "pending_approval"
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
              : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
          }`}
        >
          {s.status === "completed" && <CheckCircle2 className="w-3.5 h-3.5" />}
          {s.status === "pending_approval" && <AlertCircle className="w-3.5 h-3.5" />}
          <span>
            {s.status === "completed"
              ? (language === "en" ? "Completed" : "Selesai")
              : s.status === "pending_approval"
              ? (language === "en" ? "Pending Approval" : "Menunggu Approval")
              : (language === "en" ? "Open (Staff Count)" : "Open (Hitung Fisik)")}
          </span>
        </span>
      ),
    },
    {
      key: "actions",
      label: language === "en" ? "ACTION" : "AKSI AUDIT",
      renderCell: (s: OpnameSessionData) => (
        <div className="flex items-center gap-2">
          {s.status === "open" && (
            <button
              type="button"
              onClick={() => handleOpenBlindCount(s)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 text-white dark:bg-[#E2FF66] dark:text-slate-950 text-xs font-semibold hover:opacity-90 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>{language === "en" ? "Count Stock" : "Input Hitungan"}</span>
            </button>
          )}

          {s.status === "pending_approval" && isManagerOrOwner && (
            <button
              type="button"
              onClick={() => handleOpenApproval(s)}
              className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-semibold text-xs hover:brightness-105 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{language === "en" ? "Review Discrepancy" : "Review Selisih"}</span>
            </button>
          )}

          {s.status === "completed" && (
            <button
              type="button"
              onClick={() => handleOpenApproval(s)}
              className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-[#2E2E34] text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-slate-200 transition-all cursor-pointer flex items-center gap-1"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{language === "en" ? "View Detail" : "Lihat Log"}</span>
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-20 text-left">
      {/* ── PAGE HEADER (UNBORDERED CLEAN LAYOUT) ── */}
      <div className="border-b border-slate-200/80 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-medium tracking-tight text-slate-900 dark:text-slate-100">
            {language === "id" ? "Audit & Stock Opname" : "Stock Opname Audit Trail"}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-1 max-w-2xl">
            {language === "id"
              ? "Sistem audit stok buta (Blind Count). Staf menginput hitungan fisik tanpa melihat stok sistem untuk integritas anti-fraud."
              : "Blind count audit trail. Staff inputs physical count without expected numbers for strict anti-fraud protection."}
          </p>
        </div>

        {/* Primary Action Button: Tambah Sesi Opname Baru */}
        {isManagerOrOwner && (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-xl bg-[#E2FF66] text-slate-950 font-semibold text-xs hover:brightness-105 transition-all cursor-pointer shadow-xs flex items-center gap-2 shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{language === "en" ? "New Opname Session" : "Tambah Sesi Opname"}</span>
          </button>
        )}
      </div>

      {/* ── TOP KPI QUICK CARDS STRIP WITH SESSION SWITCH ACTION CARD ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Card 1: Switch Sesi Audit Action Card */}
        <button
          type="button"
          onClick={() => {
            if (!isManagerOrOwner) {
              toast.error(language === "id" ? "Hanya Manager atau Owner yang dapat mengontrol sesi audit" : "Only Manager or Owner can toggle audit session");
              return;
            }
            if (session.active) {
              session.deactivateSession();
              toast.info(language === "id" ? "Sesi Adjustment telah dikunci" : "Adjustment Session locked");
            } else {
              session.activateSession(24);
              toast.success(language === "id" ? "Sesi Adjustment 24 Jam diaktifkan!" : "24h Session activated!");
            }
          }}
          className={`p-3.5 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex items-center justify-between text-left group active:scale-[0.98] shadow-xs ${
            session.active
              ? "border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20"
              : "border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20"
          }`}
        >
          <div className="text-left flex-1 min-w-0 pr-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 block mb-0.5 text-left">
              {language === "en" ? "AUDIT SESSION" : "SESI ADJUSTMENT"}
            </span>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white group-hover:translate-x-0.5 transition-transform text-left truncate">
              {session.active ? (
                <>
                  <Unlock className="w-3.5 h-3.5 text-emerald-600 dark:text-[#E2FF66] shrink-0" />
                  <span className="truncate">{session.formattedTimeLeft} {language === "id" ? "(Aktif)" : "(Active)"}</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="truncate">{language === "id" ? "Sesi Terkunci" : "Session Locked"}</span>
                </>
              )}
            </div>
          </div>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shadow-sm transition-transform shrink-0 ${
            session.active
              ? "bg-emerald-500 text-slate-950 group-hover:scale-105"
              : "bg-amber-500 text-slate-950 group-hover:scale-105"
          }`}>
            {session.active ? <Unlock className="w-4.5 h-4.5 stroke-[2.5]" /> : <Lock className="w-4.5 h-4.5 stroke-[2.5]" />}
          </div>
        </button>

        {/* Card 2: Open Sessions */}
        <div className="p-3.5 rounded-2xl border bg-white dark:bg-dark-card border-slate-200/80 dark:border-dark-border text-slate-700 dark:text-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
              {language === "en" ? "Open Sessions" : "Sesi Terbuka"}
            </span>
            <span className="text-lg font-semibold font-mono text-slate-900 dark:text-slate-100">
              {metrics.openSessions}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <ClipboardList className="w-4 h-4" />
          </div>
        </div>

        {/* Card 3: Pending Approval */}
        <div className="p-3.5 rounded-2xl border bg-white dark:bg-dark-card border-slate-200/80 dark:border-dark-border text-slate-700 dark:text-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-500 block mb-0.5">
              {language === "en" ? "Pending Approval" : "Menunggu Approval"}
            </span>
            <span className="text-lg font-semibold font-mono text-amber-600 dark:text-amber-400">
              {metrics.pendingApproval}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <AlertCircle className="w-4 h-4" />
          </div>
        </div>

        {/* Card 4: Wastage Reductions */}
        <div className="p-3.5 rounded-2xl border bg-white dark:bg-dark-card border-slate-200/80 dark:border-dark-border text-slate-700 dark:text-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-red-500 block mb-0.5">
              {language === "en" ? "Wastage Items" : "Total Item Selisih (-)"}
            </span>
            <span className="text-lg font-semibold font-mono text-red-600 dark:text-red-400">
              {metrics.totalReduction.toLocaleString("id-ID")}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center text-red-600 dark:text-red-400">
            <TrendingDown className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* ── DOMAIN CAPABILITY SEGMENTED TAB SWITCHER ── */}
      <div className="w-full overflow-x-auto no-scrollbar pb-1">
        <div className="inline-flex items-center gap-1.5 p-1.5 bg-slate-200/60 dark:bg-[#1E1E22] rounded-2xl border border-slate-300/70 dark:border-[#2E2E34] shadow-inner min-w-max">
          {/* Tab 1: Sesi Opname & Audit */}
          <button
            type="button"
            onClick={() => setOpnameTab("sessions")}
            className={`px-4 py-2 rounded-xl text-xs transition-all duration-200 cursor-pointer flex items-center gap-2.5 relative select-none ${
              opnameTab === "sessions"
                ? "bg-[#18181B] text-white dark:bg-[#E2FF66] dark:text-slate-950 font-semibold shadow-md shadow-slate-900/10 scale-[1.01] ring-1 ring-slate-900/20 dark:ring-[#E2FF66]/50"
                : "text-slate-600 dark:text-slate-400 font-normal hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-300/40 dark:hover:bg-[#2A2A30]"
            }`}
          >
            <ClipboardList className={`w-4 h-4 transition-transform ${opnameTab === "sessions" ? "scale-105 text-[#E2FF66] dark:text-slate-950" : "text-slate-500 dark:text-slate-400"}`} />
            <span className="tracking-tight">{language === "en" ? "Opname Audit Sessions" : "Sesi Audit Opname"}</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-medium transition-colors ${
              opnameTab === "sessions"
                ? "bg-[#E2FF66] text-slate-950 dark:bg-slate-900 dark:text-[#E2FF66]"
                : "bg-slate-300/70 dark:bg-[#2E2E34] text-slate-700 dark:text-slate-300"
            }`}>
              {sessions.length}
            </span>
          </button>

          {/* Tab 2: Audit Trail & Discrepancies */}
          <button
            type="button"
            onClick={() => setOpnameTab("audit_trail")}
            className={`px-4 py-2 rounded-xl text-xs transition-all duration-200 cursor-pointer flex items-center gap-2.5 relative select-none ${
              opnameTab === "audit_trail"
                ? "bg-[#18181B] text-white dark:bg-[#E2FF66] dark:text-slate-950 font-semibold shadow-md shadow-slate-900/10 scale-[1.01] ring-1 ring-slate-900/20 dark:ring-[#E2FF66]/50"
                : "text-slate-600 dark:text-slate-400 font-normal hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-300/40 dark:hover:bg-[#2A2A30]"
            }`}
          >
            <SlidersHorizontal className={`w-4 h-4 transition-transform ${opnameTab === "audit_trail" ? "scale-105 text-[#E2FF66] dark:text-slate-950" : "text-slate-500 dark:text-slate-400"}`} />
            <span className="tracking-tight">{language === "en" ? "Wastage Discrepancy Trail" : "Riwayat Log Selisih (Wastage)"}</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-medium transition-colors ${
              opnameTab === "audit_trail"
                ? "bg-[#E2FF66] text-slate-950 dark:bg-slate-900 dark:text-[#E2FF66]"
                : "bg-slate-300/70 dark:bg-[#2E2E34] text-slate-700 dark:text-slate-300"
            }`}>
              {logs.length}
            </span>
          </button>
        </div>
      </div>

      {/* ── TAB 1: OPNAME AUDIT SESSIONS TABLE ── */}
      {opnameTab === "sessions" && (
        <div className="space-y-4">
          <ErpSearchBar
            value={sessionSearchQuery}
            onChange={setSessionSearchQuery}
            placeholder={language === "id" ? "Cari nama sesi opname, auditor, kategori..." : "Search session name, auditor..."}
            className="w-full"
          />

          <ErpDataTable<OpnameSessionData>
            data={filteredSessions}
            columns={sessionColumns}
            keyExtractor={(item) => item.id}
            loading={loading}
          />
        </div>
      )}

      {/* ── TAB 2: AUDIT TRAIL & WASTAGE LOGS ── */}
      {opnameTab === "audit_trail" && (
        <div className="space-y-4">
          <ErpSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={language === "id" ? "Cari nama produk, SKU, alasan, staf..." : "Search product, SKU, reason..."}
            className="w-full"
          />

          <div className="space-y-2.5">
            {filteredLogs.map((item) => {
              const date = new Date(item.created_at || Date.now());
              const isNegative = item.discrepancy < 0;
              const isPositive = item.discrepancy > 0;

              return (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/80 dark:border-dark-border transition-all shadow-xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-[#2A2A30]">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#2A2A2E] flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-dark-border">
                        <Package className="w-4.5 h-4.5 text-slate-500 dark:text-slate-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                          {item.product_name || "Produk Disertakan"}
                        </h4>
                        <div className="text-[10px] font-mono text-slate-400">
                          SKU: {item.product_sku || "-"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          isNegative
                            ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                            : isPositive
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {isNegative && <TrendingDown className="w-3.5 h-3.5 stroke-[2]" />}
                        {isPositive && <TrendingUp className="w-3.5 h-3.5 stroke-[2]" />}
                        <span>
                          {item.discrepancy >= 0 ? "+" : ""}
                          {item.discrepancy} {(item.unit_type || "PCS").toUpperCase()}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
                        {language === "id" ? "Perubahan Stok" : "Stock Shift"}
                      </span>
                      <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">
                        {item.expected_qty} → <span className="text-slate-900 dark:text-white font-semibold">{item.actual_qty} {(item.unit_type || "PCS").toUpperCase()}</span>
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
                        {language === "id" ? "Alasan" : "Reason"}
                      </span>
                      <span className="text-slate-800 dark:text-slate-200 font-medium truncate block">
                        {item.reason || "Koreksi Stok Opname"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
                        {language === "id" ? "Pemroses" : "Processed By"}
                      </span>
                      <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{item.input_by_name || "Staf Toko"}</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
                        {language === "id" ? "Waktu & Tanggal" : "Date & Time"}
                      </span>
                      <div className="text-slate-700 dark:text-slate-300 font-medium">
                        {date.toLocaleDateString(language === "id" ? "id-ID" : "en-US", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        • <span className="font-mono text-[11px] text-slate-400">{date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MODAL 1: CREATE NEW OPNAME SESSION ── */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-white dark:bg-[#202024] text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-[#38383C] p-6 shadow-xl">
          <DialogHeader className="pb-3 border-b border-slate-100 dark:border-[#2E2E34]">
            <DialogTitle className="flex items-center gap-2 text-lg font-medium">
              <ClipboardList className="w-5 h-5 text-emerald-500" />
              <span>{language === "en" ? "Create New Opname Session" : "Buat Sesi Opname Baru"}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateSession} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {language === "en" ? "Session Name *" : "Nama Sesi Audit *"}
              </label>
              <input
                type="text"
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                placeholder={language === "en" ? "e.g. End of Shift Stock Audit" : "cth: Opname Penutupan Shift 29 Agt"}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#18181C] border border-slate-200 dark:border-[#38383C] text-slate-900 dark:text-slate-100 text-sm font-medium"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {language === "en" ? "Target Category" : "Kategori Target Audit"}
              </label>
              <Select value={newTargetCategory} onValueChange={(v: any) => setNewTargetCategory(v)}>
                <SelectTrigger className="w-full rounded-xl bg-slate-50 dark:bg-[#18181C] border-slate-200 dark:border-[#38383C] text-slate-900 dark:text-slate-100 text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-[#202024] text-slate-900 dark:text-slate-100 border-slate-200 dark:border-[#38383C]">
                  <SelectItem value="all">{language === "en" ? "All Items (Semua Barang)" : "Semua Barang"}</SelectItem>
                  <SelectItem value="products">{language === "en" ? "Finished Products" : "Produk Jadi & Pack"}</SelectItem>
                  <SelectItem value="raw_materials">{language === "en" ? "Raw Materials" : "Bahan Baku Mentah"}</SelectItem>
                  <SelectItem value="tool_supplies">{language === "en" ? "Tools & Supplies" : "Alat & Kemasan"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {language === "en" ? "Instructions / Notes" : "Instruksi Audit / Catatan"}
              </label>
              <textarea
                value={newSessionNotes}
                onChange={(e) => setNewSessionNotes(e.target.value)}
                placeholder={language === "en" ? "Audit instructions for staff..." : "Instruksi khusus untuk staf auditor..."}
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#18181C] border border-slate-200 dark:border-[#38383C] text-slate-900 dark:text-slate-100 text-xs font-normal"
              />
            </div>

            <DialogFooter className="pt-3 border-t border-slate-100 dark:border-[#2E2E34]">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-[#38383C] text-slate-700 dark:text-slate-300 font-medium text-xs hover:bg-slate-100 cursor-pointer"
              >
                {language === "en" ? "Cancel" : "Batal"}
              </button>
              <button
                type="submit"
                disabled={submittingSession}
                className="px-5 py-2 rounded-xl bg-[#E2FF66] text-slate-950 font-semibold text-xs hover:brightness-105 cursor-pointer shadow-sm"
              >
                {submittingSession
                  ? (language === "en" ? "Creating..." : "Membuat...")
                  : (language === "en" ? "Create Session" : "Buat Sesi Opname")}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── MODAL 2: STAFF BLIND COUNT INPUT FORM ── */}
      <Dialog open={showBlindCountModal} onOpenChange={setShowBlindCountModal}>
        <DialogContent className="sm:max-w-3xl rounded-2xl bg-white dark:bg-[#202024] text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-[#38383C] p-6 shadow-xl">
          <DialogHeader className="pb-3 border-b border-slate-100 dark:border-[#2E2E34]">
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-blue-500" />
                <span className="font-medium text-lg">{activeSession?.session_name}</span>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold border border-amber-500/20">
                🔒 Blind Count Mode
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-3 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
              {language === "en"
                ? "Input actual physical count found in warehouse/store shelves. System stock quantity is protected for anti-fraud audit integrity."
                : "Input jumlah fisik riil yang ada di rak/gudang. Stok angka sistem disembunyikan untuk menjaga integritas anti-fraud."}
            </p>

            <div className="space-y-2.5">
              {blindItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#18181C] border border-slate-200 dark:border-[#2E2E34] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 block truncate">
                      {item.product_name || item.ingredient_name || "Item Audit"}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      SKU: {item.product_sku || "-"} • Satuan: {(item.unit_type || "pcs").toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="space-y-1">
                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block">
                        {language === "en" ? "Actual Physical Count *" : "Hitungan Fisik Riil *"}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={item.actual_qty}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const newItems = [...blindItems];
                          newItems[idx].actual_qty = val;
                          setBlindItems(newItems);
                        }}
                        className="w-32 px-3 py-1.5 rounded-xl bg-white dark:bg-[#202024] border border-slate-300 dark:border-[#38383C] text-slate-900 dark:text-white font-semibold font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-slate-100 dark:border-[#2E2E34]">
            <button
              type="button"
              onClick={() => setShowBlindCountModal(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#38383C] text-slate-700 dark:text-slate-300 font-medium text-xs hover:bg-slate-100 cursor-pointer"
            >
              {language === "en" ? "Cancel" : "Batal"}
            </button>
            <button
              type="button"
              onClick={handleSubmitBlindCount}
              disabled={submittingCount}
              className="px-5 py-2.5 rounded-xl bg-[#E2FF66] text-slate-950 font-semibold text-xs hover:brightness-105 cursor-pointer shadow-sm"
            >
              {submittingCount
                ? (language === "en" ? "Submitting..." : "Mengirim...")
                : (language === "en" ? "Submit Count for Approval" : "Kirim Hitungan ke Manager")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL 3: MANAGER/OWNER OPNAME APPROVAL MODAL ── */}
      <Dialog open={showApprovalModal} onOpenChange={setShowApprovalModal}>
        <DialogContent className="sm:max-w-3xl rounded-2xl bg-white dark:bg-[#202024] text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-[#38383C] p-6 shadow-xl">
          <DialogHeader className="pb-3 border-b border-slate-100 dark:border-[#2E2E34]">
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-500" />
                <span className="font-medium text-lg">Review Selisih Opname - {activeSession?.session_name}</span>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-3 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-300 text-xs font-normal">
              {language === "en"
                ? "Review expected system stock vs physical count submitted by staff. Approving will reconcile database stock immediately."
                : "Review perbandingan stok sistem vs hasil hitung staf. Menyetujui akan memperbarui stok database secara otomatis."}
            </div>

            <div className="space-y-2">
              {activeSession?.items?.map((item) => {
                const isDiff = item.discrepancy !== 0;
                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                      isDiff
                        ? "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40"
                        : "bg-slate-50 dark:bg-[#18181C] border-slate-200 dark:border-[#2E2E34]"
                    }`}
                  >
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                        {item.product_name || item.ingredient_name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        SKU: {item.product_sku || "-"}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Sistem vs Fisik</span>
                        <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                          {item.expected_qty ?? "?"} → <span className="font-semibold text-slate-900 dark:text-white">{item.actual_qty} {(item.unit_type || "pcs").toUpperCase()}</span>
                        </span>
                      </div>

                      <div className="min-w-[80px]">
                        <span className="text-[10px] text-slate-400 block uppercase">Selisih</span>
                        <span
                          className={`font-mono font-semibold ${
                            item.discrepancy < 0
                              ? "text-red-600 dark:text-red-400"
                              : item.discrepancy > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-slate-500"
                          }`}
                        >
                          {item.discrepancy >= 0 ? "+" : ""}
                          {item.discrepancy}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-slate-100 dark:border-[#2E2E34]">
            <button
              type="button"
              onClick={() => setShowApprovalModal(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#38383C] text-slate-700 dark:text-slate-300 font-medium text-xs hover:bg-slate-100 cursor-pointer"
            >
              {language === "en" ? "Close" : "Tutup"}
            </button>
            {activeSession?.status === "pending_approval" && isManagerOrOwner && (
              <button
                type="button"
                onClick={handleApproveSession}
                className="px-5 py-2.5 rounded-xl bg-[#E2FF66] text-slate-950 font-semibold text-xs hover:brightness-105 cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{language === "en" ? "Approve & Reconcile Stock" : "Setujui & Update Stok Database"}</span>
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
