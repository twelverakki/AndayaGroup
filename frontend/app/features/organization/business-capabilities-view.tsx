import React, { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { useLanguageStore, translations } from "../../lib/i18n";
import { toast } from "../../components/ui/sonner";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../../components/ui/select";
import {
  Sliders,
  ShoppingCart,
  Layers,
  Send,
  Flame,
  Save,
  Loader2,
  Store,
  Utensils,
  CookingPot,
  FlameKindling,
  Building2,
} from "lucide-react";

interface BusinessProfile {
  id: string;
  name: string;
  type: string;
  has_pos: boolean;
  has_manufacturing: boolean;
  has_logistics_hub: boolean;
  has_eod_usage: boolean;
}

export default function BusinessCapabilitiesView() {
  const { activeContext } = useAuthStore();
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;

  const [businesses, setBusinesses] = useState<BusinessProfile[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Capability Flags State
  const [hasPos, setHasPos] = useState(false);
  const [hasMfg, setHasMfg] = useState(false);
  const [hasHub, setHasHub] = useState(false);
  const [hasEod, setHasEod] = useState(false);
  const [saving, setSaving] = useState(false);

  // 1. Fetch businesses list (Holding list for Superadmin/Owner)
  const loadBusinesses = async () => {
    try {
      const res = await api.get("/organization/businesses");
      const list: BusinessProfile[] = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setBusinesses(list);

      if (list.length > 0) {
        // Find if activeContext matches one, otherwise pick the first
        const match = list.find((b) => b.id === activeContext?.business_id) || list[0];
        setSelectedBusinessId(match.id);
        applyBusinessProfile(match);
      }
    } catch (err: any) {
      // Fallback to single profile
      loadSingleProfile(activeContext?.business_id);
    } finally {
      setLoading(false);
    }
  };

  const applyBusinessProfile = (profile: BusinessProfile) => {
    setSelectedBusiness(profile);
    setHasPos(profile.has_pos ?? true);
    setHasMfg(profile.has_manufacturing ?? false);
    setHasHub(profile.has_logistics_hub ?? false);
    setHasEod(profile.has_eod_usage ?? false);
  };

  const loadSingleProfile = async (bizId?: string) => {
    setLoading(true);
    try {
      const url = bizId ? `/organization/business/profile?business_id=${bizId}` : "/organization/business/profile";
      const res = await api.get(url);
      const currentProfile = res.data?.data || res.data;
      if (currentProfile) {
        applyBusinessProfile(currentProfile);
      }
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          (language === "id"
            ? "Gagal memuat profil bisnis & kapabilitas"
            : "Failed to load business profile & capabilities")
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBusinesses();
  }, [activeContext?.business_id]);

  const handleSelectBusiness = (bId: string | null) => {
    if (!bId) return;
    setSelectedBusinessId(bId);
    const found = businesses.find((b) => b.id === bId);
    if (found) {
      applyBusinessProfile(found);
    } else {
      loadSingleProfile(bId);
    }
  };

  const handleSaveCapabilities = async () => {
    if (!selectedBusinessId && !selectedBusiness?.id) {
      toast.error(language === "id" ? "Pilih unit bisnis terlebih dahulu" : "Please select a business first");
      return;
    }
    setSaving(true);
    try {
      const targetBizId = selectedBusinessId || selectedBusiness?.id;
      const url = targetBizId
        ? `/organization/business/capabilities?business_id=${targetBizId}`
        : "/organization/business/capabilities";

      await api.put(url, {
        has_pos: hasPos,
        has_manufacturing: hasMfg,
        has_logistics_hub: hasHub,
        has_eod_usage: hasEod,
      });

      // Update local state list
      setBusinesses((prev) =>
        prev.map((b) =>
          b.id === targetBizId
            ? {
                ...b,
                has_pos: hasPos,
                has_manufacturing: hasMfg,
                has_logistics_hub: hasHub,
                has_eod_usage: hasEod,
              }
            : b
        )
      );

      toast.success(
        language === "id"
          ? "Kapabilitas modular bisnis berhasil diperbarui!"
          : "Business capability flags updated successfully!"
      );
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          (language === "id"
            ? "Gagal memperbarui kapabilitas bisnis"
            : "Failed to update capabilities")
      );
    } finally {
      setSaving(false);
    }
  };

  const getBusinessIcon = (type: string) => {
    switch (type) {
      case "retail":
        return <Store className="w-5 h-5 text-emerald-500" />;
      case "fnb_production":
        return <CookingPot className="w-5 h-5 text-amber-500" />;
      case "fnb_franchise":
        return <Utensils className="w-5 h-5 text-blue-500" />;
      default:
        return <FlameKindling className="w-5 h-5 text-rose-500" />;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Sliders className="w-6 h-6 text-primary" />
            <span>{language === "id" ? "Unit Bisnis & Saklar Kapabilitas" : "Business & Capability Flags"}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {language === "id"
              ? "Prinsip Lean Odoo: 1 engine terpadu yang dapat mengaktifkan/menonaktifkan modul operasional secara dinamis."
              : "The Lean Odoo Way: Unified engine with dynamic operational capability switches."}
          </p>
        </div>

        <Button
          onClick={handleSaveCapabilities}
          disabled={saving || loading}
          className="rounded-full bg-[#E2FF66] hover:bg-[#D5F54E] text-slate-900 font-bold text-xs h-10 px-6 gap-1.5 shadow-sm cursor-pointer"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? (language === "id" ? "Menyimpan..." : "Saving...") : (language === "id" ? "Simpan Perubahan" : "Save Changes")}</span>
        </Button>
      </div>

      {/* Business Selector Card for Holding Overview */}
      {businesses.length > 0 && (
        <div className="p-4 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                {language === "id" ? "Pilih Unit Bisnis Holding" : "Select Holding Business Unit"}
              </p>
              <p className="text-[11px] text-slate-400">
                {language === "id"
                  ? "Atur dan aktifkan capability flags sesuai model bisnis unit ini."
                  : "Configure capability flags according to this unit's operational model."}
              </p>
            </div>
          </div>

          <div className="w-full sm:w-64">
            <Select
              value={selectedBusinessId}
              onValueChange={handleSelectBusiness}
            >
              <SelectTrigger className="w-full h-9 rounded-xl text-xs bg-slate-50 dark:bg-[#25252A] border-slate-200/80 dark:border-[#333338]">
                <SelectValue placeholder="Pilih Bisnis..." />
              </SelectTrigger>
              <SelectContent>
                {businesses.map((b) => (
                  <SelectItem key={b.id} value={b.id} className="text-xs">
                    {b.name} ({b.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Active Business Banner Card */}
      <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            {getBusinessIcon(selectedBusiness?.type || "retail")}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                {selectedBusiness?.name || activeContext?.business_name || "Unit Bisnis Aktif"}
              </h3>
              <Badge variant="outline" className="capitalize text-[10px] font-bold rounded-full">
                {selectedBusiness?.type || "Retail / F&B"}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              ID: {selectedBusiness?.id || activeContext?.business_id}
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Engine Aktif</span>
          </span>
        </div>
      </div>

      {/* Capability Flags Interactive Grid */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
          {language === "id" ? "Daftar Saklar Modul Aktif" : "Active Capability Switches"}
        </h4>

        {/* Flag 1: POS */}
        <label className="flex items-start gap-4 p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] cursor-pointer hover:border-primary transition-all shadow-xs">
          <input
            type="checkbox"
            checked={hasPos}
            onChange={(e) => setHasPos(e.target.checked)}
            className="mt-1 w-5 h-5 rounded text-primary accent-[#E2FF66]"
          />
          <div className="space-y-1">
            <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-emerald-500" />
              <span>Point of Sale & Kasir Register (`has_pos`)</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {language === "id"
                ? "Mengaktifkan modul register kasir (Mode Barcode Scanner untuk JnA Mart & Mode Fast Grid 1-Tap untuk Bakso/Yasaka/Gorengan)."
                : "Enables cashier register module (Barcode Scanner mode for Retail & Fast Grid 1-Tap touch for F&B)."}
            </p>
          </div>
        </label>

        {/* Flag 2: Manufacturing */}
        <label className="flex items-start gap-4 p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] cursor-pointer hover:border-primary transition-all shadow-xs">
          <input
            type="checkbox"
            checked={hasMfg}
            onChange={(e) => setHasMfg(e.target.checked)}
            className="mt-1 w-5 h-5 rounded text-primary accent-[#E2FF66]"
          />
          <div className="space-y-1">
            <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-500" />
              <span>Pabrikasi Dapur & Resep BOM (`has_manufacturing`)</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {language === "id"
                ? "Mengaktifkan formula Bill of Materials (BOM), kalkulasi pemakaian bahan mentah dapur pusat, dan pencatatan batch produksi."
                : "Enables Bill of Materials (BOM) formulas, central kitchen raw ingredient deduction, and production batch logs."}
            </p>
          </div>
        </label>

        {/* Flag 3: Logistics Hub */}
        <label className="flex items-start gap-4 p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] cursor-pointer hover:border-primary transition-all shadow-xs">
          <input
            type="checkbox"
            checked={hasHub}
            onChange={(e) => setHasHub(e.target.checked)}
            className="mt-1 w-5 h-5 rounded text-primary accent-[#E2FF66]"
          />
          <div className="space-y-1">
            <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-500" />
              <span>Hub Logistik & Handshake Pengiriman (`has_logistics_hub`)</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {language === "id"
                ? "Mengaktifkan surat jalan transfer antar-gudang cabang, serah terima 2 pihak (handshake), dan transit pencairan beku (thawing)."
                : "Enables outbound transfer manifests, 2-party handshake receipts, and cold transit thawing."}
            </p>
          </div>
        </label>

        {/* Flag 4: EOD Usage */}
        <label className="flex items-start gap-4 p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] cursor-pointer hover:border-primary transition-all shadow-xs">
          <input
            type="checkbox"
            checked={hasEod}
            onChange={(e) => setHasEod(e.target.checked)}
            className="mt-1 w-5 h-5 rounded text-primary accent-[#E2FF66]"
          />
          <div className="space-y-1">
            <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-500" />
              <span>Lembar Konsumsi Bahan Akhir Shift EOD (`has_eod_usage`)</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {language === "id"
                ? "Mengaktifkan pencatatan sisa bahan curah (minyak goreng, tepung, gas) langsung saat penutupan kasir shift harian."
                : "Enables End-of-Day bulk ingredient consumption calculation directly during shift closing."}
            </p>
          </div>
        </label>
      </div>
    </div>
  );
}
