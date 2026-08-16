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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-card border border-border shadow-2xl rounded-card p-6 transform transition-all duration-300 text-foreground">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Workspace Switcher</h2>
            <p className="text-xs text-muted-foreground">Pilih bisnis atau cabang aktif Anda</p>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            disabled={switching}
            className="w-10 h-10 flex items-center justify-center rounded-pill bg-muted hover:bg-muted/80 text-foreground transition-all cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 text-red-705 dark:text-red-400 text-sm font-medium rounded-button border border-red-100 dark:border-red-900/50">
            {error}
          </div>
        )}

        {/* Workspaces List (One UI reachability card-lists) */}
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
          {workspaces.map((ws, index) => {
            const isActive = 
              (ws.role === "superadmin" && activeContext?.role === "superadmin") ||
              (ws.business_id && activeContext?.business_id === ws.business_id && !ws.outlet_id && !activeContext.outlet_id && activeContext.role !== "superadmin") ||
              (ws.outlet_id && activeContext?.outlet_id === ws.outlet_id && activeContext.role !== "superadmin") ||
              (!ws.business_id && ws.outlet_id && activeContext?.outlet_id === ws.outlet_id && activeContext.role !== "superadmin");

            return (
              <button
                key={index}
                type="button"
                disabled={switching}
                onClick={() => handleSwitch(ws)}
                className={`w-full text-left p-4 rounded-button border transition-all duration-200 flex items-center justify-between cursor-pointer ${
                  isActive 
                    ? "bg-primary/10 border-primary text-foreground ring-2 ring-primary/40" 
                    : "bg-muted/30 hover:bg-muted/60 border-border text-foreground/80"
                }`}
                style={{ minHeight: "56px" }}
              >
                <div className="flex flex-col">
                  <span className="font-bold text-base">
                    {ws.role === "superadmin" ? ws.business_name : (ws.outlet_id ? ws.outlet_name : ws.business_name)}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {ws.role === "superadmin"
                      ? "Pusat Kontrol Akun Utama"
                      : `${ws.business_name} • ${ws.role === "owner" ? "Pemilik (Owner)" : `Staf (${ws.role})`}`}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Business Type Badge */}
                  <span className="text-[10px] bg-muted text-muted-foreground font-bold px-2 py-1 rounded-pill uppercase tracking-wider">
                    {ws.role === "superadmin" ? "Admin" : ws.business_type.replace("_", " ")}
                  </span>
                  
                  {isActive && (
                    <span className="w-6 h-6 flex items-center justify-center rounded-pill bg-primary text-primary-foreground font-bold text-xs">
                      ✓
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-border flex justify-end">
          <button
            type="button"
            disabled={switching}
            onClick={onClose}
            className="px-6 py-3 font-semibold text-sm rounded-button border border-border hover:bg-muted text-foreground transition-all cursor-pointer"
            style={{ minHeight: "48px" }}
          >
            Batal
          </button>
        </div>

      </div>
    </div>
  );
}
