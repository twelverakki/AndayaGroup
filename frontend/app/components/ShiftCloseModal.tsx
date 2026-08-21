import { useState } from "react";
import { api } from "../lib/api";
import { useAuthStore } from "../lib/store";
import { toast } from "./ui/sonner";
import { AlertCircle } from "lucide-react";

interface ShiftCloseModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark?: boolean;
}

export default function ShiftCloseModal({ isOpen, onClose, isDark }: ShiftCloseModalProps) {
  const { activeShift, setActiveShift } = useAuthStore();
  const [closingCashActual, setClosingCashActual] = useState("");
  const [closingError, setClosingError] = useState("");
  const [closingLoading, setClosingLoading] = useState(false);

  if (!isOpen || !activeShift) return null;

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setClosingLoading(true);
    setClosingError("");
    try {
      await api.post("/shifts/close", {
        closing_cash_actual: parseInt(closingCashActual, 10) || 0,
      });
      setActiveShift(null);
      setClosingCashActual("");
      onClose();
      toast.success("Shift kasir berhasil ditutup!");
    } catch (err: any) {
      setClosingError(err.response?.data?.message || "Gagal menutup shift kasir");
    } finally {
      setClosingLoading(false);
    }
  };

  const handleCancel = () => {
    setClosingCashActual("");
    setClosingError("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-neutral-dark">
      <div className={`w-full max-w-md border rounded-3xl p-6 shadow-2xl transition-all ${
        isDark ? "bg-dark-card-lighter border-dark-border-lighter text-white" : "bg-white border-light-border"
      }`}>
        <h3 className="text-lg font-bold mb-1 dark:text-white">Tutup Shift Kasir</h3>
        <p className="opacity-70 text-xs font-semibold leading-relaxed mb-5 dark:text-slate-300">
          Masukkan nominal uang fisik yang ada di dalam laci kasir saat ini untuk proses rekonsiliasi.
        </p>

        {closingError && (
          <div className="mb-4 p-3 bg-red-500/10 text-red-500 text-xs font-bold rounded-xl border border-red-500/20 text-left flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{closingError}</span>
          </div>
        )}

        <form onSubmit={handleCloseShift} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold opacity-75 uppercase tracking-wider mb-2 ml-1 text-left dark:text-slate-350">
              Uang Fisik di Laci (Rupiah)
            </label>
            <input
              type="number"
              value={closingCashActual}
              onChange={(e) => setClosingCashActual(e.target.value)}
              placeholder="150000"
              className={`w-full text-center text-xl font-bold px-4 py-3 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-brand-purple/40 focus:border-brand-purple transition-all ${
                isDark ? "bg-[#1E1E1E] border-dark-border-lighter text-white" : "bg-slate-50 border-light-border"
              }`}
              style={{ minHeight: "56px" }}
              required
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 py-3 text-xs font-bold border border-light-border dark:border-dark-border-lighter hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all cursor-pointer dark:text-white"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={closingLoading}
              className="flex-1 py-3 text-xs font-bold bg-brand-purple text-white hover:bg-brand-purple-hover rounded-xl transition-all cursor-pointer shadow-md"
            >
              {closingLoading ? "Menutup..." : "Tutup Shift"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
