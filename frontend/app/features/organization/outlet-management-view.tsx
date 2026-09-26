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
import { Switch } from "../../components/ui/switch";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "../../components/ui/drawer";
import {
  Building,
  Plus,
  MapPin,
  Loader2,
  Store,
  Crown,
  CheckCircle2,
  Phone,
  Receipt,
  Edit2,
  HelpCircle,
  Save,
} from "lucide-react";

interface Outlet {
  id: string;
  business_id?: string;
  name: string;
  is_main?: boolean;
  address?: string;
  phone?: string;
  receipt_footer?: string;
  created_at: string;
}

export default function OutletManagementView() {
  const { activeContext } = useAuthStore();
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Create Modal
  const [showAddOutletModal, setShowAddOutletModal] = useState(false);
  const [outletName, setOutletName] = useState("");
  const [outletAddress, setOutletAddress] = useState("");
  const [outletPhone, setOutletPhone] = useState("");
  const [outletReceiptFooter, setOutletReceiptFooter] = useState("");
  const [isMainOutlet, setIsMainOutlet] = useState(false);
  const [submittingOutlet, setSubmittingOutlet] = useState(false);

  // Edit Modal
  const [editingOutlet, setEditingOutlet] = useState<Outlet | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editReceiptFooter, setEditReceiptFooter] = useState("");
  const [editIsMain, setEditIsMain] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

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
        phone: outletPhone.trim() || undefined,
        receipt_footer: outletReceiptFooter.trim() || undefined,
        is_main: isMainOutlet,
      });
      toast.success(
        language === "id"
          ? "Cabang baru berhasil didaftarkan!"
          : "New branch registered successfully!"
      );
      setShowAddOutletModal(false);
      setOutletName("");
      setOutletAddress("");
      setOutletPhone("");
      setOutletReceiptFooter("");
      setIsMainOutlet(false);
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

  const handleOpenEdit = (o: Outlet) => {
    setEditingOutlet(o);
    setEditName(o.name);
    setEditAddress(o.address || "");
    setEditPhone(o.phone || "");
    setEditReceiptFooter(o.receipt_footer || "");
    setEditIsMain(!!o.is_main);
  };

  const handleUpdateOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOutlet || !editName.trim()) return;

    setSavingEdit(true);
    try {
      await api.put(`/organization/outlets/${editingOutlet.id}`, {
        name: editName.trim(),
        address: editAddress.trim() || undefined,
        phone: editPhone.trim() || undefined,
        receipt_footer: editReceiptFooter.trim() || undefined,
        is_main: editIsMain,
      });
      toast.success(
        language === "id" ? "Data cabang berhasil diperbarui!" : "Branch updated successfully!"
      );
      setEditingOutlet(null);
      loadData();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          (language === "id" ? "Gagal memperbarui data cabang" : "Failed to update branch")
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSetMainDirect = async (o: Outlet) => {
    if (o.is_main) return;
    try {
      await api.put(`/organization/outlets/${o.id}`, {
        name: o.name,
        address: o.address,
        phone: o.phone,
        receipt_footer: o.receipt_footer,
        is_main: true,
      });
      toast.success(
        language === "id"
          ? `${o.name} berhasil ditetapkan sebagai Cabang Utama (Central Hub)!`
          : `${o.name} set as Main Branch / Central Hub!`
      );
      loadData();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          (language === "id" ? "Gagal menetapkan cabang utama" : "Failed to set main branch")
      );
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
              ? "Kelola toko fisik, gerobak stand, dapur pusat, dan tetapkan Cabang Utama (Central Hub)."
              : "Manage retail stores, food carts, central kitchens, and set the Main Hub."}
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
              className={`p-5 rounded-3xl bg-white dark:bg-[#1E1E22] border shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 group relative ${
                outlet.is_main
                  ? "border-[#E2FF66] dark:border-[#E2FF66]/50 ring-2 ring-[#E2FF66]/20"
                  : "border-slate-200/80 dark:border-[#2E2E34]"
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform ${
                      outlet.is_main
                        ? "bg-[#E2FF66]/20 text-slate-900 dark:text-[#E2FF66]"
                        : "bg-indigo-50 dark:bg-[#282830] text-indigo-600 dark:text-indigo-400"
                    }`}
                  >
                    {outlet.is_main ? <Crown className="w-5 h-5 text-amber-500" /> : <Store className="w-5 h-5" />}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {outlet.is_main ? (
                      <Badge className="text-[10px] font-extrabold rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-300 dark:border-amber-700">
                        Cabang Utama
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] font-bold rounded-full bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700">
                        Cabang Satelit
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    {outlet.name}
                  </h3>
                  <button
                    onClick={() => handleOpenEdit(outlet)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#2A2A30] transition-colors cursor-pointer"
                    title="Edit Cabang"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                  <span>{outlet.address || (language === "id" ? "Belum ada alamat spesifik" : "No address specified")}</span>
                </p>

                {outlet.phone && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span>{outlet.phone}</span>
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-[#2E2E34] flex items-center justify-between text-[11px] text-slate-400">
                <span>ID: {outlet.id.slice(0, 8)}...</span>
                {!outlet.is_main ? (
                  <button
                    onClick={() => handleSetMainDirect(outlet)}
                    className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Crown className="w-3 h-3 text-amber-500" />
                    <span>Jadikan Cabang Utama</span>
                  </button>
                ) : (
                  <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Pusat Distribusi</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ======================= DRAWER: ADD OUTLET ======================= */}
      <Drawer
        direction="right"
        open={showAddOutletModal}
        onOpenChange={setShowAddOutletModal}
      >
        <DrawerContent className="w-full sm:w-[460px]">
          <form onSubmit={handleCreateOutlet} className="flex flex-col h-full justify-between">
            <div className="overflow-y-auto">
              <DrawerHeader className="border-b border-slate-100 dark:border-[#2A2A30] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Building className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <DrawerTitle className="text-base font-black text-slate-900 dark:text-white">
                      {language === "id" ? "Tambah Cabang Baru" : "Add New Branch"}
                    </DrawerTitle>
                    <DrawerDescription className="text-xs text-slate-400 mt-0.5">
                      {language === "id"
                        ? "Daftarkan toko fisik, gerobak stand, atau hub logistik baru."
                        : "Register physical store, food cart, or logistics hub."}
                    </DrawerDescription>
                  </div>
                </div>
              </DrawerHeader>

              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {language === "id" ? "Nama Cabang / Gerobak" : "Branch Name"} <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    required
                    value={outletName}
                    onChange={(e) => setOutletName(e.target.value)}
                    placeholder="Contoh: Cabang Boulevard / Gerobak 02"
                    className="h-10 rounded-xl text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {language === "id" ? "Alamat Fisik / Lokasi" : "Address"}
                  </Label>
                  <Input
                    value={outletAddress}
                    onChange={(e) => setOutletAddress(e.target.value)}
                    placeholder="Contoh: Jl. Kaliurang KM 9.3"
                    className="h-10 rounded-xl text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {language === "id" ? "Nomor Telepon Kasir / Outlet" : "Outlet Contact"}
                  </Label>
                  <Input
                    value={outletPhone}
                    onChange={(e) => setOutletPhone(e.target.value)}
                    placeholder="Contoh: 0819-8765-4321"
                    className="h-10 rounded-xl text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {language === "id" ? "Catatan Kaki Struk Kasir (Receipt Footer)" : "Receipt Footer"}
                  </Label>
                  <Input
                    value={outletReceiptFooter}
                    onChange={(e) => setOutletReceiptFooter(e.target.value)}
                    placeholder="Contoh: Terima kasih! Follow IG @baksokanggemoy"
                    className="h-10 rounded-xl text-xs"
                  />
                </div>

                {/* Saklar Cabang Utama */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-[#24242A] border border-slate-200/80 dark:border-[#2E2E34]">
                  <div className="space-y-0.5 pr-2">
                    <Label className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>{language === "id" ? "Jadikan Cabang Utama (Central Hub)" : "Set as Main Branch / Hub"}</span>
                    </Label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {language === "id"
                        ? "Menjadikan cabang ini pusat logistik & monitoring stok cabang."
                        : "Designate as main central logistics hub."}
                    </p>
                  </div>
                  <Switch checked={isMainOutlet} onCheckedChange={setIsMainOutlet} />
                </div>
              </div>
            </div>

            <DrawerFooter className="p-6 border-t border-slate-100 dark:border-[#2A2A30] flex flex-row gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddOutletModal(false)}
                className="flex-1 rounded-full text-xs h-10 cursor-pointer"
              >
                {language === "id" ? "Batal" : "Cancel"}
              </Button>
              <Button
                type="submit"
                disabled={submittingOutlet}
                className="flex-1 rounded-full bg-[#E2FF66] hover:bg-[#D5F54E] text-slate-900 font-bold text-xs h-10 gap-1.5 cursor-pointer"
              >
                {submittingOutlet ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>{language === "id" ? "Daftarkan Cabang" : "Add Branch"}</span>
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>

      {/* ======================= DRAWER: EDIT OUTLET ======================= */}
      <Drawer
        direction="right"
        open={!!editingOutlet}
        onOpenChange={(open) => !open && setEditingOutlet(null)}
      >
        <DrawerContent className="w-full sm:w-[460px]">
          {editingOutlet && (
            <form onSubmit={handleUpdateOutlet} className="flex flex-col h-full justify-between">
              <div className="overflow-y-auto">
                <DrawerHeader className="border-b border-slate-100 dark:border-[#2A2A30] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
                      <Edit2 className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <DrawerTitle className="text-base font-black text-slate-900 dark:text-white">
                        {language === "id" ? "Edit Data Cabang" : "Edit Branch"}
                      </DrawerTitle>
                      <DrawerDescription className="text-xs text-slate-400 mt-0.5">
                        {language === "id"
                          ? "Perbarui identitas fisik, kontak, atau status Cabang Utama."
                          : "Update branch details or designated main hub status."}
                      </DrawerDescription>
                    </div>
                  </div>
                </DrawerHeader>

                <div className="p-6 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === "id" ? "Nama Cabang / Gerobak" : "Branch Name"} <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-10 rounded-xl text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === "id" ? "Alamat Fisik / Lokasi" : "Address"}
                    </Label>
                    <Input
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      placeholder="Contoh: Jl. Kaliurang KM 9.3"
                      className="h-10 rounded-xl text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === "id" ? "Nomor Telepon Kasir / Outlet" : "Outlet Contact"}
                    </Label>
                    <Input
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="Contoh: 0819-8765-4321"
                      className="h-10 rounded-xl text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === "id" ? "Catatan Kaki Struk Kasir (Receipt Footer)" : "Receipt Footer"}
                    </Label>
                    <Input
                      value={editReceiptFooter}
                      onChange={(e) => setEditReceiptFooter(e.target.value)}
                      placeholder="Contoh: Terima kasih! Follow IG @baksokanggemoy"
                      className="h-10 rounded-xl text-xs"
                    />
                  </div>

                  {/* Saklar Cabang Utama */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-[#24242A] border border-slate-200/80 dark:border-[#2E2E34]">
                    <div className="space-y-0.5 pr-2">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>{language === "id" ? "Jadikan Cabang Utama (Central Hub)" : "Set as Main Branch / Hub"}</span>
                      </Label>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {language === "id"
                          ? "Menjadikan cabang ini pusat koordinasi logistik holding."
                          : "Designate as main central logistics hub."}
                      </p>
                    </div>
                    <Switch checked={editIsMain} onCheckedChange={setEditIsMain} />
                  </div>
                </div>
              </div>

              <DrawerFooter className="p-6 border-t border-slate-100 dark:border-[#2A2A30] flex flex-row gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingOutlet(null)}
                  className="flex-1 rounded-full text-xs h-10 cursor-pointer"
                >
                  {language === "id" ? "Batal" : "Cancel"}
                </Button>
                <Button
                  type="submit"
                  disabled={savingEdit}
                  className="flex-1 rounded-full bg-[#E2FF66] hover:bg-[#D5F54E] text-slate-900 font-bold text-xs h-10 gap-1.5 cursor-pointer"
                >
                  {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>{language === "id" ? "Simpan Perubahan" : "Save Changes"}</span>
                </Button>
              </DrawerFooter>
            </form>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
