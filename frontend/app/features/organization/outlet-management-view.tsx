import React, { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { useLanguageStore, translations } from "../../lib/i18n";
import { ErpSearchBar } from "../../components/ErpSearchBar";
import { toast } from "../../components/ui/sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import {
  Building,
  Plus,
  MapPin,
  Loader2,
  Store,
} from "lucide-react";

interface Outlet {
  id: string;
  business_id?: string;
  name: string;
  address?: string;
  created_at: string;
}

export default function OutletManagementView() {
  const { activeContext } = useAuthStore();
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal
  const [showAddOutletModal, setShowAddOutletModal] = useState(false);
  const [outletName, setOutletName] = useState("");
  const [outletAddress, setOutletAddress] = useState("");
  const [submittingOutlet, setSubmittingOutlet] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/organization/outlets");
      setOutlets(Array.isArray(res.data) ? res.data : res.data?.data || []);
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          (language === "id" ? "Gagal memuat data cabang" : "Failed to load branches")
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeContext?.business_id]);

  const handleCreateOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outletName.trim()) {
      toast.error(
        language === "id" ? "Nama Cabang wajib diisi" : "Branch name is required"
      );
      return;
    }
    setSubmittingOutlet(true);
    try {
      await api.post("/organization/outlets", {
        name: outletName.trim(),
        address: outletAddress.trim() || undefined,
      });
      toast.success(
        language === "id"
          ? "Cabang baru berhasil didaftarkan!"
          : "New branch registered successfully!"
      );
      setShowAddOutletModal(false);
      setOutletName("");
      setOutletAddress("");
      loadData();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          (language === "id" ? "Gagal menambahkan cabang" : "Failed to add branch")
      );
    } finally {
      setSubmittingOutlet(false);
    }
  };

  const filteredOutlets = outlets.filter((o) =>
    o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (o.address && o.address.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Building className="w-6 h-6 text-primary" />
            <span>{language === "id" ? "Manajemen Cabang & Outlet" : "Branches & Outlets"}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {language === "id"
              ? "Daftar toko retail fisik, gerobak stand, dapur pusat, dan gudang logistik hub."
              : "Directory of retail stores, street carts, central kitchens, and logistics hubs."}
          </p>
        </div>

        <Button
          onClick={() => setShowAddOutletModal(true)}
          className="rounded-full bg-[#E2FF66] hover:bg-[#D5F54E] text-slate-900 font-bold text-xs h-10 px-5 gap-1.5 shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{language === "id" ? "Tambah Cabang Baru" : "Add New Branch"}</span>
        </Button>
      </div>

      {/* Search Bar */}
      <div className="w-full md:w-80">
        <ErpSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={
            language === "id" ? "Cari nama cabang atau alamat..." : "Search branch name or address..."
          }
        />
      </div>

      {/* Grid of Outlets */}
      {loading ? (
        <div className="py-16 text-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
          <span className="text-xs font-semibold">Memuat data cabang...</span>
        </div>
      ) : filteredOutlets.length === 0 ? (
        <div className="py-16 text-center text-slate-400 bg-white dark:bg-[#1E1E22] rounded-3xl border border-slate-200/80 dark:border-[#2E2E34]">
          <Building className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
          <p className="text-xs font-semibold">Tidak ada cabang yang cocok dengan pencarian.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOutlets.map((outlet) => (
            <div
              key={outlet.id}
              className="p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-[#282830] flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3 group-hover:scale-105 transition-transform">
                    <Store className="w-5 h-5" />
                  </div>
                  <Badge variant="outline" className="text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                    Operasional
                  </Badge>
                </div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  {outlet.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                  <span>{outlet.address || (language === "id" ? "Belum ada alamat spesifik" : "No address specified")}</span>
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-[#2E2E34] flex items-center justify-between text-[11px] text-slate-400">
                <span>ID: {outlet.id.slice(0, 8)}...</span>
                <span className="font-semibold text-primary">Cabang Aktif</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ======================= MODAL: ADD OUTLET ======================= */}
      <Dialog open={showAddOutletModal} onOpenChange={setShowAddOutletModal}>
        <DialogContent className="sm:max-w-md rounded-3xl bg-white dark:bg-[#1A1C20] border-slate-200 dark:border-[#2E2E34]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Building className="w-5 h-5 text-primary" />
              <span>Daftarkan Cabang / Outlet Baru</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Tambahkan lokasi toko fisik, gerobak stand, atau hub logistik ke unit bisnis ini.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateOutlet} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nama Cabang / Gerobak</Label>
              <Input
                required
                value={outletName}
                onChange={(e) => setOutletName(e.target.value)}
                placeholder="Contoh: Toko Cabang Kaliurang KM 9"
                className="h-10 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Alamat Fisik (Opsional)</Label>
              <Input
                value={outletAddress}
                onChange={(e) => setOutletAddress(e.target.value)}
                placeholder="Jl. Kaliurang No. 45, Sleman"
                className="h-10 rounded-xl"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddOutletModal(false)}
                className="rounded-xl h-10 text-xs"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={submittingOutlet}
                className="rounded-xl h-10 text-xs font-bold bg-[#E2FF66] text-black hover:bg-[#D5F54E]"
              >
                {submittingOutlet ? "Mendaftarkan..." : "Daftarkan Cabang"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
