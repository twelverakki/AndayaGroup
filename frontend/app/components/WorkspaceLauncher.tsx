import React, { useState } from "react";
import { useAuthStore, useShellStore, type Workspace } from "../lib/store";
import { useLanguageStore, translations } from "../lib/i18n";
import { api } from "../lib/api";
import { toast } from "../components/ui/sonner";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Building2,
  Store,
  Utensils,
  CookingPot,
  FlameKindling,
  ShoppingCart,
  Layers,
  Send,
  Flame,
  Shield,
  ArrowRight,
  CheckCircle2,
  MapPin,
  X,
  Sparkles,
  GitBranch,
  Building,
  Loader2,
  UserCheck,
  Crown,
} from "lucide-react";

interface WorkspaceLauncherProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WorkspaceLauncher({ isOpen, onClose }: WorkspaceLauncherProps) {
  const { user, workspaces, activeContext, updateActiveContext } = useAuthStore();
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;

  const [switching, setSwitching] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLaunch = async (ws: Workspace) => {
    const key = `${ws.business_id || "global"}-${ws.outlet_id || "all"}-${ws.role}`;
    setSwitching(key);

    try {
      const payload = {
        business_id: ws.business_id || "",
        outlet_id: ws.outlet_id || "",
        role: ws.role || "",
      };

      const response = await api.post("/auth/switch-business", payload);
      const { active_context } = response.data;

      updateActiveContext(active_context);
      toast.success(
        language === "id"
          ? `Workspace aktif: ${ws.role === "superadmin" ? "Pusat Kontrol Superadmin" : ws.outlet_name || ws.business_name}`
          : `Switched to workspace: ${ws.role === "superadmin" ? "Superadmin Control Center" : ws.outlet_name || ws.business_name}`
      );
      onClose();
    } catch (err: any) {
      console.error("Workspace switch failed:", err);
      toast.error(
        err.response?.data?.message ||
          (language === "id" ? "Gagal membuka workspace bisnis" : "Failed to open business workspace")
      );
    } finally {
      setSwitching(null);
    }
  };

  const getBusinessIcon = (type?: string, name?: string) => {
    const lowerName = (name || "").toLowerCase();
    if (lowerName.includes("bakso")) return <Utensils className="w-5 h-5 text-amber-500" />;
    if (lowerName.includes("yasaka") || lowerName.includes("chicken")) return <CookingPot className="w-5 h-5 text-rose-500" />;
    if (lowerName.includes("gorengan")) return <FlameKindling className="w-5 h-5 text-orange-500" />;
    if (type === "retail" || lowerName.includes("mart") || lowerName.includes("kelontong"))
      return <Store className="w-5 h-5 text-emerald-500" />;
    return <Building2 className="w-5 h-5 text-indigo-500" />;
  };

  // Group workspaces by business
  const superadminWs = workspaces.find((w) => w.role === "superadmin");
  const businessWorkspaces = workspaces.filter((w) => w.role !== "superadmin");

  // Group by business_id
  const groupedByBiz = businessWorkspaces.reduce<Record<string, { name: string; type: any; hasPos?: boolean; hasMfg?: boolean; hasHub?: boolean; hasEod?: boolean; hasMultiOutlets?: boolean; items: Workspace[] }>>((acc, ws) => {
    const bizKey = ws.business_id || "unknown";
    if (!acc[bizKey]) {
      acc[bizKey] = {
        name: ws.business_name || "Bisnis Tanpa Nama",
        type: ws.business_type,
        hasPos: ws.has_pos,
        hasMfg: ws.has_manufacturing,
        hasHub: ws.has_logistics_hub,
        hasEod: ws.has_eod_usage,
        hasMultiOutlets: ws.has_multi_outlets,
        items: [],
      };
    }
    acc[bizKey].items.push(ws);
    return acc;
  }, {});

  const bizEntries = Object.entries(groupedByBiz);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Strip */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-[#2A2A30] bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E2FF66]/20 flex items-center justify-center text-slate-900 dark:text-[#E2FF66] shrink-0 font-black">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                {language === "id" ? "Peluncur Workspace Bisnis" : "Business Workspace Launcher"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === "id"
                  ? `Halo ${user?.name || "Owner"}, pilih lingkungan bisnis yang ingin Anda operasikan saat ini.`
                  : `Hello ${user?.name || "Owner"}, select the business environment you want to operate.`}
              </p>
            </div>
          </div>

          {activeContext && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full w-9 h-9 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Superadmin Quick Access */}
          {superadminWs && (
            <div
              onClick={() => handleLaunch(superadminWs)}
              className="group p-4 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/20 hover:border-indigo-400 dark:hover:border-indigo-700 transition-all cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 group-hover:scale-105 transition-transform">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                      Superadmin Control Center
                    </h3>
                    <Badge className="bg-indigo-500 text-white font-bold text-[9px] rounded-full">
                      Root Admin
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {language === "id"
                      ? "Pusat konfigurasi multi-tenant, manajemen akun pemilik, dan rekam jejak audit keamanan."
                      : "Multi-tenant configuration center, owner account management, and security audit logs."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {activeContext?.role === "superadmin" ? (
                  <Badge className="bg-emerald-500 text-white font-bold text-xs gap-1 py-1 px-3 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Aktif</span>
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full font-bold text-xs gap-1 group-hover:bg-indigo-600 group-hover:text-white transition-all cursor-pointer"
                  >
                    <span>Masuk</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Business Grid */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {language === "id" ? "Unit Bisnis Anda" : "Your Businesses"} ({bizEntries.length})
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bizEntries.map(([bizId, group]) => {
                const isSingleOutlet = group.hasMultiOutlets === false;
                const isCurrentBizActive = activeContext?.business_id === bizId;

                return (
                  <div
                    key={bizId}
                    className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                      isCurrentBizActive
                        ? "bg-slate-50/80 dark:bg-white/[0.04] border-slate-300 dark:border-slate-700 shadow-sm"
                        : "bg-white dark:bg-[#1E1E22] border-slate-200/80 dark:border-[#2E2E34] hover:border-slate-300 dark:hover:border-slate-600 shadow-xs"
                    }`}
                  >
                    <div>
                      {/* Business Card Top Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center shrink-0">
                            {getBusinessIcon(group.type, group.name)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                              {group.name}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-bold px-2 py-0.2 rounded-md ${
                                  isSingleOutlet
                                    ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40"
                                    : "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/40"
                                }`}
                              >
                                {isSingleOutlet ? (
                                  <span className="flex items-center gap-1">
                                    <Building className="w-2.5 h-2.5" /> Single Outlet
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    <GitBranch className="w-2.5 h-2.5" /> Multi-Cabang ({group.items.length})
                                  </span>
                                )}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {isCurrentBizActive && (
                          <Badge className="bg-[#E2FF66] text-slate-900 font-extrabold text-[10px] rounded-full px-2.5 py-0.5 shrink-0 shadow-2xs">
                            Sedang Digunakan
                          </Badge>
                        )}
                      </div>

                      {/* Capabilities Strip */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-4">
                        {group.hasPos && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                            <ShoppingCart className="w-2.5 h-2.5 text-emerald-500" /> POS Kasir
                          </span>
                        )}
                        {group.hasMfg && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                            <Layers className="w-2.5 h-2.5 text-indigo-500" /> Pabrikasi BOM
                          </span>
                        )}
                        {group.hasHub && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                            <Send className="w-2.5 h-2.5 text-blue-500" /> Logistik Hub
                          </span>
                        )}
                        {group.hasEod && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                            <Flame className="w-2.5 h-2.5 text-rose-500" /> Konsumsi EOD
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Workspaces list / Launch action */}
                    <div className="pt-3 border-t border-slate-100 dark:border-[#2A2A30] space-y-2">
                      {isSingleOutlet || group.items.length === 1 ? (
                        // 1-Tap Launch for Single Outlet
                        (() => {
                          const primaryWs = group.items[0];
                          const key = `${primaryWs.business_id}-${primaryWs.outlet_id || "all"}-${primaryWs.role}`;
                          const isThisActive =
                            activeContext?.business_id === primaryWs.business_id &&
                            (activeContext?.outlet_id || "") === (primaryWs.outlet_id || "");

                          return (
                            <Button
                              onClick={() => handleLaunch(primaryWs)}
                              disabled={switching !== null}
                              className={`w-full rounded-full font-bold text-xs h-9 justify-between cursor-pointer ${
                                isThisActive
                                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                                  : "bg-[#E2FF66] hover:bg-[#D5F54E] text-slate-900"
                              }`}
                            >
                              <span className="truncate">
                                {isThisActive
                                  ? language === "id"
                                    ? "Sedang Aktif (Masuk Dashboard)"
                                    : "Currently Active (Enter)"
                                  : language === "id"
                                  ? "Buka Workspace Bisnis"
                                  : "Launch Business Workspace"}
                              </span>
                              {switching === key ? (
                                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                              ) : (
                                <ArrowRight className="w-4 h-4 shrink-0" />
                              )}
                            </Button>
                          );
                        })()
                      ) : (
                        // Multi-branch selection sub-list
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block px-1">
                            {language === "id" ? "Pilih Cabang Operasional:" : "Select Operating Branch:"}
                          </span>
                          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                            {group.items.map((ws, i) => {
                              const key = `${ws.business_id}-${ws.outlet_id || "all"}-${ws.role}`;
                              const isThisActive =
                                activeContext?.business_id === ws.business_id &&
                                (activeContext?.outlet_id || "") === (ws.outlet_id || "");

                              return (
                                <button
                                  key={i}
                                  type="button"
                                  disabled={switching !== null}
                                  onClick={() => handleLaunch(ws)}
                                  className={`w-full p-2 rounded-xl text-left text-xs transition-all flex items-center justify-between cursor-pointer ${
                                    isThisActive
                                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold"
                                      : "bg-slate-100 dark:bg-white/5 hover:bg-slate-200/80 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200"
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    {ws.is_main_outlet ? (
                                      <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                    ) : (
                                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                    )}
                                    <span className="truncate text-xs font-semibold">
                                      {ws.outlet_name || ws.business_name}
                                    </span>
                                    {ws.is_main_outlet && (
                                      <span className="text-[8px] font-black px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shrink-0">
                                        Utama
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[9px] uppercase font-mono opacity-70">
                                      {ws.role}
                                    </span>
                                    {switching === key ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <ArrowRight className="w-3 h-3" />
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-[#2A2A30] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <UserCheck className="w-3.5 h-3.5" />
            <span>
              {language === "id"
                ? "Sistem ERP multi-tenant mengisolasi data transaksi & buku besar stok secara otomatis."
                : "Multi-tenant ERP isolates transaction data and stock ledgers automatically."}
            </span>
          </div>

          {activeContext && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="rounded-full font-bold text-xs h-8 px-4 cursor-pointer"
            >
              {language === "id" ? "Tutup" : "Close"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
