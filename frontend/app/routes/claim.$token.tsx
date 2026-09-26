import React, { useState, useEffect } from "react";
import { useParams } from "react-router";
import axios from "axios";
import { CurrencyInput } from "../components/CurrencyInput";
import { toast, Toaster } from "sonner";
import {
  Truck,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Receipt,
  Camera,
  Send,
  Building2,
  MapPin,
  Car,
  AlertTriangle,
  RotateCcw,
  Loader2,
  ShieldCheck,
} from "lucide-react";

interface PublicClaimInfo {
  transfer_id: string;
  transfer_no: string;
  business_name: string;
  from_outlet_name: string;
  to_outlet_name: string;
  driver_name: string;
  vehicle_plate: string;
  max_claim_budget: number;
  claim_status: "none" | "pending" | "approved" | "rejected" | string;
  claimed_amount: number;
  claimed_notes?: string;
  claimed_attachment_url?: string;
  claimed_at?: string;
  claim_rejection_reason?: string;
  sent_at: string;
}

export default function DriverClaimPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicClaimInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [claimedAmount, setClaimedAmount] = useState<number>(0);
  const [claimedNotes, setClaimedNotes] = useState<string>("");
  const [attachmentBase64, setAttachmentBase64] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isReSubmitting, setIsReSubmitting] = useState<boolean>(false);

  const fetchClaimData = async () => {
    if (!token) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await axios.get(`/api/v1/claim/${token}`);
      const claimInfo: PublicClaimInfo = res.data?.data;
      setData(claimInfo);
      if (claimInfo?.claimed_amount) {
        setClaimedAmount(claimInfo.claimed_amount);
      }
      if (claimInfo?.claimed_notes) {
        setClaimedNotes(claimInfo.claimed_notes);
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Surat jalan atau token klaim tidak valid");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaimData();
  }, [token]);

  // Handle Photo / Receipt file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran foto maksimal 5 MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachmentBase64(reader.result as string);
      toast.success("Foto struk berhasil dipilih");
    };
    reader.readAsDataURL(file);
  };

  // Submit Claim
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (claimedAmount <= 0) {
      toast.error("Masukkan nominal biaya operasional yang diajukan");
      return;
    }
    if (!claimedNotes.trim()) {
      toast.error("Tulis rincian pengeluaran (misal: Bensin Rp 30.000 + Tol Rp 15.000)");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await axios.post(`/api/v1/claim/${token}`, {
        claimed_amount: claimedAmount,
        claimed_notes: claimedNotes,
        claimed_attachment_url: attachmentBase64 || undefined,
      });

      toast.success(res.data?.message || "Pengajuan klaim biaya berhasil dikirim!");
      setData(res.data?.data);
      setIsReSubmitting(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal mengirim pengajuan klaim");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#E2FF66] mb-4" />
        <p className="font-extrabold text-sm tracking-wide">Memuat Data Surat Jalan...</p>
        <p className="text-xs text-slate-400 mt-1">Verifikasi token klaim pengiriman</p>
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="font-extrabold text-lg">Tautan Klaim Tidak Ditemukan</h1>
        <p className="text-xs text-slate-400 mt-2 max-w-sm">
          {errorMsg || "Tautan atau QR code ini sudah tidak aktif atau salah. Silakan periksa kembali Surat Jalan fisik Anda."}
        </p>
      </div>
    );
  }

  const isPending = data.claim_status === "pending" && !isReSubmitting;
  const isApproved = data.claim_status === "approved";
  const isRejected = data.claim_status === "rejected" && !isReSubmitting;
  const isExceedingBudget = data.max_claim_budget > 0 && claimedAmount > data.max_claim_budget;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-4 sm:p-6 antialiased font-sans">
      <Toaster position="top-center" richColors />

      {/* Main Container Card */}
      <div className="w-full max-w-lg space-y-4 my-auto py-6">
        {/* Brand Header */}
        <div className="text-center space-y-1 pb-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono font-bold text-[#E2FF66]">
            <Truck className="w-3.5 h-3.5" />
            <span>PORTAL KLAIM BIAYA KURIR</span>
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">{data.business_name}</h1>
          <p className="text-xs text-slate-400">Bukti Pengeluaran Riil Operasional Pengiriman</p>
        </div>

        {/* Transfer Header Card */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">No. Surat Jalan</span>
              <span className="font-mono font-black text-sm text-[#E2FF66]">{data.transfer_no}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Waktu Dispatch</span>
              <span className="text-xs text-slate-300">
                {new Date(data.sent_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>

          {/* Route Display */}
          <div className="flex items-center justify-between text-xs py-1">
            <div className="space-y-0.5 max-w-[45%]">
              <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                <Building2 className="w-3 h-3 text-slate-400" />
                Gudang Asal
              </span>
              <p className="font-extrabold text-slate-100 truncate">{data.from_outlet_name}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-[#E2FF66] shrink-0" />
            <div className="space-y-0.5 max-w-[45%] text-right">
              <span className="text-[10px] font-semibold text-slate-400 flex items-center justify-end gap-1">
                <MapPin className="w-3 h-3 text-emerald-400" />
                Cabang Tujuan
              </span>
              <p className="font-extrabold text-emerald-400 truncate">{data.to_outlet_name}</p>
            </div>
          </div>

          {/* Driver Info & Plafon */}
          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5 text-slate-400" />
              <span>{data.driver_name || "Driver"} {data.vehicle_plate ? `(${data.vehicle_plate})` : ""}</span>
            </div>
            {data.max_claim_budget > 0 && (
              <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                <span>Plafon: Rp {data.max_claim_budget.toLocaleString("id-ID")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Status Banners */}
        {isPending && (
          <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 animate-pulse text-amber-400" />
              <h2 className="text-sm font-black">Pengajuan Klaim Sedang Ditinjau</h2>
            </div>
            <p className="text-xs text-amber-200/80 leading-relaxed">
              Klaim biaya sebesar <strong className="text-white font-mono">Rp {data.claimed_amount.toLocaleString("id-ID")}</strong> telah diterima dan menunggu konfirmasi persetujuan dari Manager / Owner.
            </p>
            {data.claimed_notes && (
              <div className="p-3 rounded-2xl bg-black/20 text-xs font-mono text-slate-200 mt-2">
                "{data.claimed_notes}"
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsReSubmitting(true)}
              className="mt-2 text-xs font-bold text-amber-400 underline hover:text-amber-300 cursor-pointer"
            >
              Ubah / Kirim Ulang Pengajuan Klaim
            </button>
          </div>
        )}

        {isApproved && (
          <div className="p-5 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-2 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-1">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-base font-black text-white">Klaim Biaya Disetujui</h2>
            <p className="text-2xl font-black text-[#E2FF66] font-mono">
              Rp {data.claimed_amount.toLocaleString("id-ID")}
            </p>
            <p className="text-xs text-emerald-200/80">
              Nominal ini telah disahkan oleh Manager dan dicatat resmi ke pembukuan pengeluaran toko.
            </p>
          </div>
        )}

        {isRejected && (
          <div className="p-5 rounded-3xl bg-red-500/10 border border-red-500/30 text-red-300 space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <h2 className="text-sm font-black">Pengajuan Klaim Ditolak</h2>
            </div>
            <p className="text-xs text-red-200/80">
              Alasan Penolakan: <strong className="text-white font-medium">"{data.claim_rejection_reason || "Tidak memenuhi SOP pengeluaran operasional"}"</strong>
            </p>
            <button
              type="button"
              onClick={() => setIsReSubmitting(true)}
              className="w-full py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Ajukan Ulang dengan Penyesuaian</span>
            </button>
          </div>
        )}

        {/* Claim Submission Form (Shown when 'none' or re-submitting) */}
        {(!isPending && !isApproved && !isRejected) && (
          <form onSubmit={handleSubmit} className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-white/5">
              <Receipt className="w-4 h-4 text-[#E2FF66]" />
              <h2 className="text-sm font-extrabold text-white">Form Klaim Biaya Operasional</h2>
            </div>

            {/* Claimed Amount */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Total Pengeluaran Riil (Rp) *</span>
                {data.max_claim_budget > 0 && (
                  <span className="text-[10px] text-amber-400 font-semibold">
                    Maks: Rp {data.max_claim_budget.toLocaleString("id-ID")}
                  </span>
                )}
              </label>
              <CurrencyInput
                value={claimedAmount}
                onChange={setClaimedAmount}
                placeholder="0"
                className="bg-slate-950 border-slate-800 text-white text-lg font-mono font-black h-12"
              />
              {isExceedingBudget && (
                <p className="text-[11px] text-amber-400 flex items-center gap-1 pt-0.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Nominal melebihi plafon (Rp {data.max_claim_budget.toLocaleString("id-ID")}), butuh approval khusus Owner.</span>
                </p>
              )}
            </div>

            {/* Expense Breakdown Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">
                Rincian Biaya Pengeluaran *
              </label>
              <textarea
                value={claimedNotes}
                onChange={(e) => setClaimedNotes(e.target.value)}
                rows={3}
                placeholder="Contoh: Bensin Rp 25.000 + Tol Rp 12.000 + Parkir Rp 5.000"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-800 bg-slate-950 text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#E2FF66]"
                required
              />
            </div>

            {/* Photo / Receipt Upload */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Foto Struk / Nota Fisik</span>
                <span className="text-[10px] text-slate-500 font-normal">Opsional</span>
              </label>

              {attachmentBase64 ? (
                <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-slate-950 p-2 space-y-2">
                  <img src={attachmentBase64} alt="Struk" className="max-h-48 w-full object-contain rounded-xl" />
                  <button
                    type="button"
                    onClick={() => setAttachmentBase64("")}
                    className="w-full py-1.5 rounded-xl bg-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/30 transition-all cursor-pointer"
                  >
                    Hapus / Ganti Foto
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-slate-800 bg-slate-950/50 hover:bg-slate-950 hover:border-slate-700 transition-all cursor-pointer text-center space-y-1.5">
                  <Camera className="w-6 h-6 text-slate-400" />
                  <span className="text-xs font-bold text-slate-300">Ambil Foto / Upload Struk</span>
                  <span className="text-[10px] text-slate-500">Kamera HP atau Galeri (JPG, PNG)</span>
                  <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
                </label>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || claimedAmount <= 0}
              className="w-full py-3.5 rounded-2xl bg-[#E2FF66] hover:bg-[#d4f552] text-slate-950 font-black text-sm shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mengirim Pengajuan...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Kirim Pengajuan Klaim</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
