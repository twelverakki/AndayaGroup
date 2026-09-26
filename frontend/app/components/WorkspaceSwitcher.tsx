import React, { useState } from "react";
import { useAuthStore } from "../lib/store";
import type { Workspace } from "../lib/store";
import { api } from "../lib/api";
import { useLanguageStore, translations } from "../lib/i18n";
import { toast } from "./ui/sonner";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  X,
  Building2,
  Store,
  MapPin,
  CheckCircle2,
  ArrowRight,
  Shield,
  Loader2,
  Crown,
} from "lucide-react";

interface WorkspaceSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WorkspaceSwitcher({ isOpen, onClose }: WorkspaceSwitcherProps) {
  const { workspaces, activeContext, updateActiveContext } = useAuthStore();
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSwitch = async (ws: Workspace) => {
    const key = `${ws.business_id || "global"}-${ws.outlet_id || "all"}-${ws.role}`;
    setSwitching(key);
    setError("");
    try {
      const payload = {
        business_id: ws.business_id || "",
        outlet_id: ws.outlet_id || "",
        role: ws.role || "",
      };

      const response = await api.post("/auth/switch-business", payload);
      const { active_context } = response.data;

      // Update Zustand context
      updateActiveContext(active_context);
      toast.success(
        language === "id"
          ? `Berhasil berpindah ke ${ws.role === "superadmin" ? "Pusat Kontrol Superadmin" : ws.outlet_name || ws.business_name}`
          : "Workspace switched successfully"
      );
      onClose();
    } catch (err: any) {
      console.error("Workspace switch failed:", err);
      const msg = err.response?.data?.message || (language === "id" ? "Gagal berpindah workspace" : "Failed to switch workspace");
      setError(msg);
      toast.error(msg);
    } finally {
      setSwitching(null);
    }
  };

  const user = useAuthStore((s) => s.user);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-2xl rounded-3xl p-6 transform transition-all duration-300 text-slate-900 dark:text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-[#2A2A30]">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              {language === "id" ? "Pilih Workspace" : "Workspace Switcher"}
            </h2>
            <p className="text-xs text-slate-400">
              {language === "id"
                ? "Pilih lokasi & peran akses aktif yang ingin Anda jalankan"
                : "Select the active location & role to operate"}
            </p>
          </div>
          <Button 
            type="button" 
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={switching !== null}
            className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Current Login User Banner */}
        <div className="mb-4 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-[#2A2A30] flex items-center justify-between text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              {language === "id" ? "Akun Login Aktif" : "Active Login Account"}
            </span>
            <span className="font-extrabold text-slate-900 dark:text-white">{user?.name || "User"}</span>
            {user?.phone_or_email && <span className="text-slate-400 ml-1.5 font-mono">({user.phone_or_email})</span>}
          </div>
          <Badge variant="outline" className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
            {workspaces.length} Workspace
          </Badge>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-xs font-medium rounded-xl border border-red-100 dark:border-red-900/50">
            {error}
          </div>
        )}

        {/* Workspaces List */}
        <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1 scrollbar-thin">
          {workspaces.map((ws, index) => {
            const isActive = 
              (ws.role === "superadmin" && activeContext?.role === "superadmin") ||
              (ws.business_id === activeContext?.business_id && (ws.outlet_id || "") === (activeContext?.outlet_id || "") && ws.role === activeContext?.role);

            const roleBadgeClass =
              ws.role === "superadmin"
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                : ws.role === "owner"
                ? "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
                : ws.role === "manager"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                : ws.role === "admin_gudang"
                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";

            const roleLabel =
              ws.role === "superadmin"
                ? "Superadmin"
                : ws.role === "owner"
                ? "Owner"
                : ws.role === "manager"
                ? "Manager"
                : ws.role === "admin_gudang"
                ? "Admin Gudang"
                : "Staff Kasir";

            const key = `${ws.business_id || "global"}-${ws.outlet_id || "all"}-${ws.role}`;

            return (
              <button
                key={index}
                type="button"
                disabled={switching !== null}
                onClick={() => handleSwitch(ws)}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-200 flex items-start justify-between cursor-pointer ${
                  isActive 
                    ? "bg-slate-50 dark:bg-white/10 border-slate-300 dark:border-slate-600 ring-2 ring-primary/40 shadow-xs" 
                    : "bg-white dark:bg-[#1E1E22] hover:bg-slate-50 dark:hover:bg-white/5 border-slate-200/80 dark:border-[#2E2E34]"
                }`}
              >
                <div className="flex flex-col space-y-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                      {ws.role === "superadmin" ? "Pusat Kontrol Superadmin" : ws.business_name}
                    </span>
                    {ws.outlet_name && (
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-md font-semibold truncate flex items-center gap-1 ${
                          ws.is_main_outlet
                            ? "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                            : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {ws.is_main_outlet ? (
                          <Crown className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                        ) : (
                          <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                        )}
                        <span>{ws.outlet_name}</span>
                        {ws.is_main_outlet && (
                          <span className="text-[8px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                            (Utama)
                          </span>
                        )}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-0.5 text-xs text-slate-400">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${roleBadgeClass}`}>
                      {roleLabel}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase font-mono font-medium">
                      • {ws.role === "superadmin" ? "System Control" : ws.business_type.replace("_", " ")}
                    </span>
                  </div>
                </div>

                <div className="flex items-center shrink-0 self-center">
                  {switching === key ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  ) : isActive ? (
                    <span className="px-2.5 py-1 rounded-full bg-[#E2FF66] text-slate-900 font-bold text-xs flex items-center gap-1 shadow-2xs">
                      <CheckCircle2 className="w-3 h-3" /> Aktif
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                      <span>Pilih</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-slate-100 dark:border-[#2A2A30] flex justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={switching !== null}
            onClick={onClose}
            className="rounded-full font-bold text-xs h-9 px-5 cursor-pointer"
          >
            {language === "id" ? "Tutup" : "Close"}
          </Button>
        </div>

      </div>
    </div>
  );
}
