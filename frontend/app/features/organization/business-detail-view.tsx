import React, { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { useLanguageStore, translations } from "../../lib/i18n";
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
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../../components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "../../components/ui/input-otp";
import {
  ArrowLeft,
  Building2,
  Sliders,
  Store,
  Users,
  Plus,
  Save,
  Loader2,
  MapPin,
  KeyRound,
  MoreVertical,
  CheckCircle2,
  XCircle,
  ShoppingCart,
  Layers,
  Send,
  Flame,
  Utensils,
  CookingPot,
  FlameKindling,
  Mail,
} from "lucide-react";

export interface BusinessSummary {
  id: string;
  name: string;
  type: string;
  has_pos: boolean;
  has_manufacturing: boolean;
  has_logistics_hub: boolean;
  has_eod_usage: boolean;
  created_at: string;
}

interface OutletItem {
  id: string;
  business_id: string;
  name: string;
  address?: string;
  created_at: string;
}

interface StaffItem {
  id: string;
  user_id?: string;
  name: string;
  phone_or_email: string;
  role: string;
  outlet_id: string;
  outlet_name?: string;
  status: string;
  created_at: string;
}

interface BusinessDetailViewProps {
  businessId: string;
  onBack: () => void;
}

export default function BusinessDetailView({
  businessId,
  onBack,
}: BusinessDetailViewProps) {
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;

  const [activeTab, setActiveTab] = useState<"capabilities" | "outlets" | "staff">("capabilities");
  const [business, setBusiness] = useState<BusinessSummary | null>(null);
  const [outlets, setOutlets] = useState<OutletItem[]>([]);
  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Capability Flags State
  const [hasPos, setHasPos] = useState(false);
  const [hasMfg, setHasMfg] = useState(false);
  const [hasHub, setHasHub] = useState(false);
  const [hasEod, setHasEod] = useState(false);
  const [savingCapabilities, setSavingCapabilities] = useState(false);

  // Modal Add Outlet
  const [showAddOutletModal, setShowAddOutletModal] = useState(false);
  const [outletName, setOutletName] = useState("");
  const [outletAddress, setOutletAddress] = useState("");
  const [submittingOutlet, setSubmittingOutlet] = useState(false);

  // Modal Add Staff
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffPin, setStaffPin] = useState("");
  const [staffRole, setStaffRole] = useState("staff");
  const [staffOutletId, setStaffOutletId] = useState("");
  const [submittingStaff, setSubmittingStaff] = useState(false);

  // Modal Reset PIN
  const [resetPinStaff, setResetPinStaff] = useState<StaffItem | null>(null);
  const [newPin, setNewPin] = useState("");
  const [submittingPin, setSubmittingPin] = useState(false);

  const isGmail = (val: string) => val.trim().toLowerCase().endsWith("@gmail.com");

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [bizRes, outletsRes, staffRes] = await Promise.all([
        api.get(`/organization/business/profile?business_id=${businessId}`),
        api.get(`/organization/outlets?business_id=${businessId}`),
        api.get(`/organization/staff?business_id=${businessId}`),
      ]);

      const bizData = bizRes.data?.data || bizRes.data;
      if (bizData) {
        setBusiness(bizData);
        setHasPos(bizData.has_pos ?? true);
        setHasMfg(bizData.has_manufacturing ?? false);
        setHasHub(bizData.has_logistics_hub ?? false);
        setHasEod(bizData.has_eod_usage ?? false);
      }

      setOutlets(Array.isArray(outletsRes.data) ? outletsRes.data : outletsRes.data?.data || []);
      setStaffList(Array.isArray(staffRes.data) ? staffRes.data : staffRes.data?.data || []);
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          (language === "id" ? "Gagal memuat detail bisnis" : "Failed to load business details")
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [businessId]);

  const handleSaveCapabilities = async () => {
    setSavingCapabilities(true);
    try {
      await api.put(`/organization/business/capabilities?business_id=${businessId}`, {
        has_pos: hasPos,
        has_manufacturing: hasMfg,
        has_logistics_hub: hasHub,
        has_eod_usage: hasEod,
      });
      toast.success(
        language === "id"
          ? "Kapabilitas modular bisnis berhasil disimpan!"
          : "Business capability flags saved successfully!"
      );
      loadAllData();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          (language === "id" ? "Gagal memperbarui kapabilitas" : "Failed to update capabilities")
      );
    } finally {
      setSavingCapabilities(false);
    }
  };

  const handleCreateOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outletName.trim()) {
      toast.error(language === "id" ? "Nama cabang wajib diisi" : "Branch name is required");
      return;
    }
    setSubmittingOutlet(true);
    try {
      await api.post(`/organization/outlets?business_id=${businessId}`, {
        name: outletName.trim(),
        address: outletAddress.trim() || undefined,
      });
      toast.success(
        language === "id"
          ? `Cabang baru berhasil didaftarkan untuk ${business?.name}!`
          : `New branch registered for ${business?.name}!`
      );
      setShowAddOutletModal(false);
      setOutletName("");
      setOutletAddress("");
      loadAllData();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          (language === "id" ? "Gagal menambahkan cabang" : "Failed to add branch")
      );
    } finally {
      setSubmittingOutlet(false);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim() || !staffEmail.trim()) {
      toast.error(
        language === "id" ? "Nama dan Email Gmail wajib diisi" : "Name and Gmail address are required"
      );
      return;
    }
    if (!isGmail(staffEmail)) {
      toast.error(
        language === "id" ? "Email wajib menggunakan domain @gmail.com" : "Email must use @gmail.com domain"
      );
      return;
    }
    if (!staffPin || staffPin.length < 6) {
      toast.error(
        language === "id" ? "PIN Kasir wajib 6 digit angka" : "Cashier PIN must be 6 digits"
      );
      return;
    }
    if (!staffOutletId) {
      toast.error(
        language === "id" ? "Pilih cabang penempatan terlebih dahulu" : "Please select an assigned branch"
      );
      return;
    }

    setSubmittingStaff(true);
    try {
      await api.post(`/organization/staff?business_id=${businessId}`, {
        name: staffName.trim(),
        phone_or_email: staffEmail.trim(),
        password: staffPassword.trim() || staffPin,
        pin: staffPin,
        role: staffRole,
        outlet_id: staffOutletId,
        can_view_cost: staffRole === "manager",
      });

      toast.success(
        language === "id"
          ? `Pengguna ${staffName} berhasil ditambahkan ke ${business?.name}!`
          : `User ${staffName} added to ${business?.name} successfully!`
      );
      setShowAddStaffModal(false);
      setStaffName("");
      setStaffEmail("");
      setStaffPassword("");
      setStaffPin("");
      setStaffOutletId("");
      loadAllData();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          (language === "id" ? "Gagal menambahkan pengguna" : "Failed to add user")
      );
    } finally {
      setSubmittingStaff(false);
    }
  };

  const handleToggleStaffStatus = async (staff: StaffItem) => {
    const newStatus = staff.status === "active" ? "inactive" : "active";
    try {
      await api.put(`/organization/staff/${staff.id}?business_id=${businessId}`, {
        status: newStatus,
      });
      toast.success(
        language === "id"
          ? `Status ${staff.name} diubah menjadi ${newStatus}`
          : `Status of ${staff.name} changed to ${newStatus}`
      );
      loadAllData();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          (language === "id" ? "Gagal memperbarui status" : "Failed to update status")
      );
    }
  };

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPinStaff || newPin.length < 6) {
      toast.error(
        language === "id" ? "PIN baru harus 6 digit angka" : "New PIN must be 6 digits"
      );
      return;
    }
    setSubmittingPin(true);
    try {
      await api.put(`/organization/staff/${resetPinStaff.id}?business_id=${businessId}`, {
        pin: newPin,
      });
      toast.success(
        language === "id"
          ? `PIN 6-digit untuk ${resetPinStaff.name} berhasil diatur ulang!`
          : `PIN for ${resetPinStaff.name} reset successfully!`
      );
      setResetPinStaff(null);
      setNewPin("");
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          (language === "id" ? "Gagal mereset PIN" : "Failed to reset PIN")
      );
    } finally {
      setSubmittingPin(false);
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
    <div className="space-y-6 max-w-6xl">
      {/* Top Breadcrumb / Back Action */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{language === "id" ? "Kembali ke Daftar Organisasi" : "Back to Businesses List"}</span>
        </button>

        {activeTab === "capabilities" && (
          <Button
            onClick={handleSaveCapabilities}
            disabled={savingCapabilities || loading}
            className="rounded-full bg-[#E2FF66] hover:bg-[#D5F54E] text-slate-900 font-bold text-xs h-9 px-5 gap-1.5 shadow-sm cursor-pointer"
          >
            {savingCapabilities ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{savingCapabilities ? (language === "id" ? "Menyimpan..." : "Saving...") : (language === "id" ? "Simpan Perubahan" : "Save Changes")}</span>
          </Button>
        )}

        {activeTab === "outlets" && (
          <Button
            onClick={() => setShowAddOutletModal(true)}
            className="rounded-full bg-[#E2FF66] hover:bg-[#D5F54E] text-slate-900 font-bold text-xs h-9 px-5 gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{language === "id" ? "Tambah Cabang Bisnis Ini" : "Add Branch for this Business"}</span>
          </Button>
        )}

        {activeTab === "staff" && (
          <Button
            onClick={() => setShowAddStaffModal(true)}
            className="rounded-full bg-[#E2FF66] hover:bg-[#D5F54E] text-slate-900 font-bold text-xs h-9 px-5 gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{language === "id" ? "Tambah Pengguna Bisnis Ini" : "Add User for this Business"}</span>
          </Button>
        )}
      </div>

      {/* Business Header Summary Card */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            {getBusinessIcon(business?.type || "retail")}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-black text-slate-900 dark:text-white">
                {business?.name || "Unit Bisnis"}
              </h1>
              <Badge variant="outline" className="capitalize text-[10px] font-bold rounded-full">
                {business?.type || "Retail / F&B"}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              ID: {business?.id} • {outlets.length} {language === "id" ? "Cabang Terdaftar" : "Branches"} • {staffList.length} {language === "id" ? "Pengguna Aktif" : "Active Users"}
            </p>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-[#25252A] rounded-2xl border border-slate-200/80 dark:border-[#333338] self-stretch md:self-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("capabilities")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "capabilities"
                ? "bg-white dark:bg-[#2E2E34] text-slate-900 dark:text-white shadow-xs"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-emerald-500" />
            <span>{language === "id" ? "Saklar Kapabilitas" : "Capability Flags"}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("outlets")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "outlets"
                ? "bg-white dark:bg-[#2E2E34] text-slate-900 dark:text-white shadow-xs"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-blue-500" />
            <span>{language === "id" ? "Cabang & Gudang" : "Branches"} ({outlets.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("staff")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "staff"
                ? "bg-white dark:bg-[#2E2E34] text-slate-900 dark:text-white shadow-xs"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Users className="w-3.5 h-3.5 text-indigo-500" />
            <span>{language === "id" ? "Pengguna & Staf" : "Users & Staff"} ({staffList.length})</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Capability Flags */}
      {activeTab === "capabilities" && (
        <div className="space-y-4">
          <div className="space-y-1 px-1">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              {language === "id" ? "Pengaturan Saklar Modular Operasional" : "Modular Capability Flags"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {language === "id"
                ? "Aktifkan hanya fitur yang dibutuhkan oleh model bisnis ini sesuai prinsip The Lean Odoo Way."
                : "Enable only the features required by this operational model."}
            </p>
          </div>

          <div className="space-y-3">
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
      )}

      {/* Tab 2: Outlets List */}
      {activeTab === "outlets" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              {language === "id" ? `Daftar Cabang & Gudang (${outlets.length})` : `Branches Directory (${outlets.length})`}
            </h3>
          </div>

          {outlets.length === 0 ? (
            <div className="p-8 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] text-center space-y-3">
              <Building2 className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs text-slate-500">
                {language === "id" ? "Belum ada cabang terdaftar untuk unit bisnis ini." : "No branches registered yet for this business."}
              </p>
              <Button
                onClick={() => setShowAddOutletModal(true)}
                className="rounded-full bg-[#E2FF66] hover:bg-[#D5F54E] text-slate-900 font-bold text-xs h-8 px-4"
              >
                {language === "id" ? "Daftarkan Cabang Pertama" : "Register First Branch"}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {outlets.map((o) => (
                <div
                  key={o.id}
                  className="p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-xs flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">{o.name}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{o.address || (language === "id" ? "Alamat belum diatur" : "No address set")}</span>
                      </p>
                      <p className="text-[10px] text-slate-400 mt-2">ID: {o.id}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 rounded-full">
                    {language === "id" ? "Aktif" : "Active"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Staff List */}
      {activeTab === "staff" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              {language === "id" ? `Daftar Pengguna & Staf (${staffList.length})` : `Users & Staff Directory (${staffList.length})`}
            </h3>
          </div>

          {staffList.length === 0 ? (
            <div className="p-8 rounded-3xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] text-center space-y-3">
              <Users className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs text-slate-500">
                {language === "id" ? "Belum ada staf terdaftar pada unit bisnis ini." : "No staff registered for this business yet."}
              </p>
              <Button
                onClick={() => setShowAddStaffModal(true)}
                className="rounded-full bg-[#E2FF66] hover:bg-[#D5F54E] text-slate-900 font-bold text-xs h-8 px-4"
              >
                {language === "id" ? "Tambah Staf Pertama" : "Add First Staff"}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate" style={{ borderSpacing: 0 }}>
                <thead>
                  <tr className="bg-[#E7E9ED] dark:bg-[#2E2E34] text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    <th className="py-3.5 px-5 rounded-l-full">{language === "id" ? "Nama Pengguna" : "User Name"}</th>
                    <th className="py-3.5 px-5">Gmail</th>
                    <th className="py-3.5 px-5">{language === "id" ? "Cabang" : "Branch"}</th>
                    <th className="py-3.5 px-5">{language === "id" ? "Peran" : "Role"}</th>
                    <th className="py-3.5 px-5">Status</th>
                    <th className="py-3.5 px-5 text-right rounded-r-full">{language === "id" ? "Aksi" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3.5 border-b border-slate-200/80 dark:border-[#38383C] text-xs font-bold text-slate-900 dark:text-white">
                        {s.name}
                      </td>
                      <td className="px-5 py-3.5 border-b border-slate-200/80 dark:border-[#38383C] text-xs text-slate-500 dark:text-slate-400">
                        {s.phone_or_email}
                      </td>
                      <td className="px-5 py-3.5 border-b border-slate-200/80 dark:border-[#38383C] text-xs text-slate-600 dark:text-slate-300 font-medium">
                        {s.outlet_name || "-"}
                      </td>
                      <td className="px-5 py-3.5 border-b border-slate-200/80 dark:border-[#38383C]">
                        <Badge variant="outline" className="capitalize text-[10px] font-bold rounded-full">
                          {s.role}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 border-b border-slate-200/80 dark:border-[#38383C]">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${s.status === "active" ? "text-emerald-500" : "text-rose-500"}`}>
                          {s.status === "active" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          <span className="capitalize">{s.status}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 border-b border-slate-200/80 dark:border-[#38383C] text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="p-1 rounded-full hover:bg-slate-200/60 dark:hover:bg-white/10 cursor-pointer">
                            <MoreVertical className="w-4 h-4 text-slate-500" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-2xl p-1.5 min-w-36">
                            <DropdownMenuItem onClick={() => setResetPinStaff(s)} className="text-xs font-semibold rounded-xl cursor-pointer">
                              <KeyRound className="w-3.5 h-3.5 mr-2 text-amber-500" />
                              <span>{language === "id" ? "Reset PIN 6-Digit" : "Reset PIN"}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleStaffStatus(s)} className="text-xs font-semibold rounded-xl cursor-pointer">
                              {s.status === "active" ? (
                                <>
                                  <XCircle className="w-3.5 h-3.5 mr-2 text-rose-500" />
                                  <span>{language === "id" ? "Nonaktifkan Akun" : "Deactivate"}</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-emerald-500" />
                                  <span>{language === "id" ? "Aktifkan Akun" : "Activate"}</span>
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal 1: Add Outlet Scoped */}
      <Dialog open={showAddOutletModal} onOpenChange={setShowAddOutletModal}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black">
              {language === "id" ? `Tambah Cabang (${business?.name})` : `Add Branch (${business?.name})`}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {language === "id" ? "Cabang ini akan otomatis terikat pada unit bisnis yang sedang dibuka." : "This branch will be scoped to this business."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateOutlet} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">{language === "id" ? "Nama Cabang / Gudang" : "Branch / Warehouse Name"} *</Label>
              <Input
                value={outletName}
                onChange={(e) => setOutletName(e.target.value)}
                placeholder={language === "id" ? "Contoh: Cabang Kemang / Dapur Pusat" : "e.g. Kemang Branch"}
                className="h-10 rounded-xl text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">{language === "id" ? "Alamat Fisik (Opsional)" : "Address (Optional)"}</Label>
              <Input
                value={outletAddress}
                onChange={(e) => setOutletAddress(e.target.value)}
                placeholder="Jl. Raya No. 123..."
                className="h-10 rounded-xl text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowAddOutletModal(false)} className="rounded-full text-xs">
                {language === "id" ? "Batal" : "Cancel"}
              </Button>
              <Button type="submit" disabled={submittingOutlet} className="rounded-full bg-[#E2FF66] hover:bg-[#D5F54E] text-slate-900 font-bold text-xs">
                {submittingOutlet ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{language === "id" ? "Daftarkan Cabang" : "Register Branch"}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Add Staff Scoped */}
      <Dialog open={showAddStaffModal} onOpenChange={setShowAddStaffModal}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black">
              {language === "id" ? `Tambah Pengguna (${business?.name})` : `Add User (${business?.name})`}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {language === "id" ? "Buat akun staf/manager dan pasangkan langsung ke cabang di bisnis ini." : "Assign user to a branch in this business."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateStaff} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">{language === "id" ? "Nama Lengkap" : "Full Name"} *</Label>
              <Input
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="Budi Santoso"
                className="h-10 rounded-xl text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Email Gmail (@gmail.com) *</Label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <Input
                  type="email"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  placeholder="budi.andaya@gmail.com"
                  className="h-10 pl-9 rounded-xl text-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">{language === "id" ? "Cabang Penempatan" : "Branch"} *</Label>
                <Select value={staffOutletId} onValueChange={(val) => setStaffOutletId(val || "")}>
                  <SelectTrigger className="h-10 rounded-xl text-xs">
                    <SelectValue placeholder="Pilih Cabang..." />
                  </SelectTrigger>
                  <SelectContent>
                    {outlets.map((o) => (
                      <SelectItem key={o.id} value={o.id} className="text-xs">
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">{language === "id" ? "Peran / Posisi" : "Role"} *</Label>
                <Select value={staffRole} onValueChange={(val) => setStaffRole(val || "staff")}>
                  <SelectTrigger className="h-10 rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff" className="text-xs">{language === "id" ? "Kasir / Staff" : "Cashier / Staff"}</SelectItem>
                    <SelectItem value="manager" className="text-xs">{language === "id" ? "Manager Cabang" : "Branch Manager"}</SelectItem>
                    <SelectItem value="admin_gudang" className="text-xs">{language === "id" ? "Admin Gudang" : "Warehouse Admin"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">PIN Kasir / Otorisasi (6 Digit) *</Label>
              <div className="flex justify-center py-1">
                <InputOTP maxLength={6} value={staffPin} onChange={(val) => setStaffPin(val)}>
                  <InputOTPGroup className="gap-2">
                    <InputOTPSlot index={0} className="w-10 h-10 text-base font-bold rounded-xl border border-slate-300 dark:border-[#38383C]" />
                    <InputOTPSlot index={1} className="w-10 h-10 text-base font-bold rounded-xl border border-slate-300 dark:border-[#38383C]" />
                    <InputOTPSlot index={2} className="w-10 h-10 text-base font-bold rounded-xl border border-slate-300 dark:border-[#38383C]" />
                    <InputOTPSlot index={3} className="w-10 h-10 text-base font-bold rounded-xl border border-slate-300 dark:border-[#38383C]" />
                    <InputOTPSlot index={4} className="w-10 h-10 text-base font-bold rounded-xl border border-slate-300 dark:border-[#38383C]" />
                    <InputOTPSlot index={5} className="w-10 h-10 text-base font-bold rounded-xl border border-slate-300 dark:border-[#38383C]" />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowAddStaffModal(false)} className="rounded-full text-xs">
                {language === "id" ? "Batal" : "Cancel"}
              </Button>
              <Button type="submit" disabled={submittingStaff} className="rounded-full bg-[#E2FF66] hover:bg-[#D5F54E] text-slate-900 font-bold text-xs">
                {submittingStaff ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{language === "id" ? "Simpan Pengguna" : "Save User"}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 3: Reset PIN */}
      <Dialog open={!!resetPinStaff} onOpenChange={(open) => !open && setResetPinStaff(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black">
              {language === "id" ? "Reset PIN 6-Digit" : "Reset 6-Digit PIN"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {language === "id"
                ? `Masukkan PIN baru untuk ${resetPinStaff?.name}.`
                : `Set a new PIN for ${resetPinStaff?.name}.`}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleResetPin} className="space-y-4 py-3">
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={newPin} onChange={(val) => setNewPin(val)}>
                <InputOTPGroup className="gap-2">
                  <InputOTPSlot index={0} className="w-10 h-10 text-base font-bold rounded-xl border border-slate-300 dark:border-[#38383C]" />
                  <InputOTPSlot index={1} className="w-10 h-10 text-base font-bold rounded-xl border border-slate-300 dark:border-[#38383C]" />
                  <InputOTPSlot index={2} className="w-10 h-10 text-base font-bold rounded-xl border border-slate-300 dark:border-[#38383C]" />
                  <InputOTPSlot index={3} className="w-10 h-10 text-base font-bold rounded-xl border border-slate-300 dark:border-[#38383C]" />
                  <InputOTPSlot index={4} className="w-10 h-10 text-base font-bold rounded-xl border border-slate-300 dark:border-[#38383C]" />
                  <InputOTPSlot index={5} className="w-10 h-10 text-base font-bold rounded-xl border border-slate-300 dark:border-[#38383C]" />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setResetPinStaff(null)} className="rounded-full text-xs">
                {language === "id" ? "Batal" : "Cancel"}
              </Button>
              <Button type="submit" disabled={submittingPin || newPin.length < 6} className="rounded-full bg-[#E2FF66] hover:bg-[#D5F54E] text-slate-900 font-bold text-xs">
                {submittingPin ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                <span>{language === "id" ? "Simpan PIN Baru" : "Save New PIN"}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}