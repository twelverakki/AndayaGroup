import { useState } from "react";
import { useAuthStore } from "../lib/store";
import type { Workspace } from "../lib/store";
import { api } from "../lib/api";

interface WorkspaceSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WorkspaceSwitcher({ isOpen, onClose }: WorkspaceSwitcherProps) {
  const { workspaces, activeContext, updateActiveContext } = useAuthStore();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSwitch = async (ws: Workspace) => {
    setSwitching(true);
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
      onClose();
    } catch (err: any) {
      console.error("Workspace switch failed:", err);
      setError(err.response?.data?.message || "Gagal berpindah workspace");
    } finally {
      setSwitching(false);
    }
  };

  const user = useAuthStore((s) => s.user);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-card border border-border shadow-2xl rounded-2xl p-6 transform transition-all duration-300 text-foreground">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-foreground">Workspace Switcher</h2>
            <p className="text-xs text-muted-foreground">Pilih lokasi & peran akses aktif yang ingin Anda jalankan</p>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            disabled={switching}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 text-foreground transition-all cursor-pointer font-bold text-sm"
          >
            ✕
          </button>
        </div>

        {/* Current Login User Banner */}
        <div className="mb-4 p-3 rounded-xl bg-slate-100 dark:bg-[#25252A] border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">Akun Login Aktif</span>
            <span className="font-semibold text-foreground">{user?.name || "User"}</span>
            {user?.phone_or_email && <span className="text-muted-foreground ml-1.5">({user.phone_or_email})</span>}
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-primary/10 text-primary">
            {workspaces.length} Workspace
          </span>
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
                ? "Pemilik (Owner)"
                : ws.role === "manager"
                ? "Manajer (Manager)"
                : ws.role === "admin_gudang"
                ? "Admin Gudang"
                : "Staf Kasir";

            return (
              <button
                key={index}
                type="button"
                disabled={switching}
                onClick={() => handleSwitch(ws)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 flex items-start justify-between cursor-pointer ${
                  isActive 
                    ? "bg-primary/10 border-primary text-foreground ring-2 ring-primary/40 shadow-xs" 
                    : "bg-muted/30 hover:bg-muted/60 border-border text-foreground/80"
                }`}
              >
                <div className="flex flex-col space-y-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-foreground truncate">
                      {ws.role === "superadmin" ? "Pusat Kontrol Superadmin" : ws.business_name}
                    </span>
                    {ws.outlet_name && (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-semibold truncate">
                        📍 {ws.outlet_name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-0.5 text-xs text-muted-foreground">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${roleBadgeClass}`}>
                      {roleLabel}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase font-mono font-medium">
                      • {ws.role === "superadmin" ? "Sistem Control" : ws.business_type.replace("_", " ")}
                    </span>
                  </div>
                </div>

                <div className="flex items-center shrink-0 self-center">
                  {isActive ? (
                    <span className="px-2.5 py-1 rounded-full bg-primary text-primary-foreground font-bold text-xs flex items-center gap-1 shadow-xs">
                      ✓ Aktif
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-primary hover:underline">
                      Pilih ➔
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-border flex justify-end">
          <button
            type="button"
            disabled={switching}
            onClick={onClose}
            className="px-5 py-2.5 font-semibold text-xs rounded-xl border border-border hover:bg-muted text-foreground transition-all cursor-pointer"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
