import React, { useState, useEffect, useMemo } from "react";
import { api } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { useLanguageStore, translations } from "../../lib/i18n";
import { ErpSearchBar } from "../../components/ErpSearchBar";
import { ErpDataTable, type ColumnDef } from "../../components/ErpDataTable";
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
  DropdownMenuSeparator,
} from "../../components/ui/dropdown-menu";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "../../components/ui/input-otp";
import {
  Users,
  UserPlus,
  KeyRound,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Loader2,
  Mail,
  Eye,
  EyeOff,
} from "lucide-react";

interface StaffMember {
  id: string;
  user_id?: string;
  name: string;
  phone_or_email: string;
  role: string;
  outlet_id?: string;
  outlet_name?: string;
  status: string;
  created_at: string;
}

interface Outlet {
  id: string;
  name: string;
  address?: string;
}

export default function StaffManagementView() {
  const { activeContext } = useAuthStore();
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Modals
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [resetPinStaff, setResetPinStaff] = useState<StaffMember | null>(null);

  // Form states - Add Staff
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [staffPin, setStaffPin] = useState("");
  const [staffRole, setStaffRole] = useState("staff");
  const [staffOutletId, setStaffOutletId] = useState("");
  const [submittingStaff, setSubmittingStaff] = useState(false);

  // Form states - Reset PIN
  const [newPin, setNewPin] = useState("");
  const [submittingPin, setSubmittingPin] = useState(false);

  // Validate Gmail
  const isGmail = (val: string) => {
    return val.trim().toLowerCase().endsWith("@gmail.com");
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [staffRes, outletsRes] = await Promise.all([
        api.get("/organization/staff"),
        api.get("/organization/outlets"),
      ]);

      setStaffList(
        Array.isArray(staffRes.data)
          ? staffRes.data
          : staffRes.data?.data || []
      );
      setOutlets(
        Array.isArray(outletsRes.data)
          ? outletsRes.data
          : outletsRes.data?.data || []
      );
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          (language === "id"
            ? "Gagal memuat data pengguna & staff"
            : "Failed to load users & staff data")
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeContext?.business_id]);

  // Handle Add Staff
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim() || !staffEmail.trim()) {
      toast.error(
        language === "id"
          ? "Nama dan Email Gmail wajib diisi"
          : "Name and Gmail address are required"
      );
      return;
    }
    if (!isGmail(staffEmail) && !staffEmail.includes("@andaya.com")) {
      toast.error(
        language === "id"
          ? "Alamat email wajib menggunakan domain @gmail.com"
          : "Email address must use @gmail.com domain"
      );
      return;
    }
    if (!staffPin || staffPin.length < 6) {
      toast.error(
        language === "id"
          ? "PIN Kasir harus 6 digit angka"
          : "Cashier PIN must be 6 digits"
      );
      return;
    }
    if (!staffOutletId) {
      toast.error(
        language === "id"
          ? "Pilih cabang penempatan staf"
          : "Please select an assigned branch"
      );
      return;
    }

    setSubmittingStaff(true);
    try {
      await api.post("/organization/staff", {
        name: staffName.trim(),
        phone_or_email: staffEmail.trim().toLowerCase(),
        password: staffPassword || "password123",
        pin: staffPin,
        role: staffRole,
        outlet_id: staffOutletId,
      });
      toast.success(
        language === "id"
          ? "Pengguna / Kasir baru berhasil ditambahkan!"
          : "New user / cashier added successfully!"
      );
      setShowAddStaffModal(false);
      setStaffName("");
      setStaffEmail("");
      setStaffPassword("");
      setStaffPin("");
      setStaffOutletId("");
      loadData();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          (language === "id" ? "Gagal menambahkan staf" : "Failed to add staff")
      );
    } finally {
      setSubmittingStaff(false);
    }
  };

  // Handle Reset PIN
  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPinStaff || !newPin || newPin.length < 6) {
      toast.error(
        language === "id"
          ? "PIN harus tepat 6 angka numerik"
          : "PIN must be 6 numeric digits"
      );
      return;
    }
    setSubmittingPin(true);
    try {
      await api.put(`/organization/staff/${resetPinStaff.id}`, {
        pin: newPin,
      });
      toast.success(
        language === "id"
          ? `PIN kasir untuk ${resetPinStaff.name} berhasil diperbarui!`
          : `PIN for ${resetPinStaff.name} updated successfully!`
      );
      setResetPinStaff(null);
      setNewPin("");
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          (language === "id" ? "Gagal memperbarui PIN" : "Failed to update PIN")
      );
    } finally {
      setSubmittingPin(false);
    }
  };

  // Handle Toggle Staff Status
  const handleToggleStaffStatus = async (staff: StaffMember) => {
    const newStatus = staff.status === "active" ? "inactive" : "active";
    try {
      await api.put(`/organization/staff/${staff.id}`, {
        status: newStatus,
      });
      toast.success(
        language === "id"
          ? `Status ${staff.name} diubah menjadi ${newStatus}`
          : `Status of ${staff.name} changed to ${newStatus}`
      );
      loadData();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          (language === "id"
            ? "Gagal mengubah status staff"
            : "Failed to update staff status")
      );
    }
  };

  // Filter Staff List
  const filteredStaff = staffList.filter((s) => {
    const matchQuery =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone_or_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.outlet_name &&
        s.outlet_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchRole = roleFilter === "all" || s.role === roleFilter;
    return matchQuery && matchRole;
  });

  const columns: ColumnDef<StaffMember>[] = useMemo(() => [
    {
      key: "name",
      label: language === "id" ? "Nama Pengguna" : "User Name",
      renderCell: (staff) => (
        <div className="font-bold text-slate-900 dark:text-white text-xs">
          {staff.name}
        </div>
      ),
    },
    {
      key: "email",
      label: language === "id" ? "Email Gmail / Login" : "Gmail / Login",
      renderCell: (staff) => (
        <span className="text-slate-600 dark:text-slate-300 font-mono text-[11px]">
          {staff.phone_or_email}
        </span>
      ),
    },
    {
      key: "role",
      label: language === "id" ? "Role Akses" : "Role",
      renderCell: (staff) => (
        <Badge
          variant="outline"
          className="capitalize text-[10px] font-bold rounded-full px-2.5 py-0.5"
        >
          {staff.role === "admin_gudang" ? "Admin Gudang" : staff.role === "staff" ? "Staff Kasir" : staff.role}
        </Badge>
      ),
    },
    {
      key: "outlet",
      label: language === "id" ? "Penugasan Cabang" : "Branch",
      renderCell: (staff) => (
        <span className="text-slate-600 dark:text-slate-300 text-xs">
          {staff.outlet_name || "Semua Cabang / Mobile"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      renderCell: (staff) => (
        staff.status === "active" ? (
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Aktif</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-slate-400 font-semibold text-[11px]">
            <XCircle className="w-3.5 h-3.5" />
            <span>Non-aktif</span>
          </span>
        )
      ),
    },
    {
      key: "action",
      label: language === "id" ? "Aksi" : "Action",
      align: "right",
      renderCell: (staff) => (
        <DropdownMenu>
          <DropdownMenuTrigger className="h-8 w-8 p-0 rounded-full cursor-pointer flex items-center justify-center hover:bg-slate-200 dark:hover:bg-[#2E2E34] inline-flex">
            <MoreVertical className="w-4 h-4 text-slate-500" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-2xl p-1.5 w-48">
            <DropdownMenuItem
              onClick={() => setResetPinStaff(staff)}
              className="gap-2 text-xs font-semibold cursor-pointer rounded-xl"
            >
              <KeyRound className="w-3.5 h-3.5 text-primary" />
              <span>Reset PIN Kasir</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleToggleStaffStatus(staff)}
              className="gap-2 text-xs font-semibold cursor-pointer rounded-xl"
            >
              {staff.status === "active" ? (
                <>
                  <XCircle className="w-3.5 h-3.5 text-rose-500" />
                  <span className="text-rose-600">Nonaktifkan Akun</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-600">Aktifkan Kembali</span>
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], [language]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            <span>{language === "id" ? "Pengguna & Staff Kasir" : "Users & Staff Management"}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {language === "id"
              ? "Kelola hak akses akun, penugasan cabang, kata sandi, dan PIN otorisasi 6-digit."
              : "Manage user access, branch assignments, passwords, and 6-digit cashier PINs."}
          </p>
        </div>

        <Button
          onClick={() => setShowAddStaffModal(true)}
          className="rounded-full bg-[#E2FF66] hover:bg-[#D5F54E] text-slate-900 font-bold text-xs h-10 px-5 gap-1.5 shadow-sm cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>{language === "id" ? "Tambah Pengguna Baru" : "Add New User"}</span>
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="w-full md:w-80">
          <ErpSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={
              language === "id"
                ? "Cari nama, email Gmail, atau cabang..."
                : "Search name, Gmail, or branch..."
            }
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Select
            value={roleFilter}
            onValueChange={(val) => {
              if (val) setRoleFilter(val);
            }}
          >
            <SelectTrigger className="w-44 h-10 rounded-xl bg-white dark:bg-[#1E1E22] border-slate-200 dark:border-[#2E2E34] text-xs font-semibold">
              <SelectValue placeholder="Filter Role" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Semua Role</SelectItem>
              <SelectItem value="staff">Staff / Kasir</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="admin_gudang">Admin Gudang</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Master Table with ErpDataTable */}
      <ErpDataTable<StaffMember>
        data={filteredStaff}
        columns={columns}
        keyExtractor={(staff) => staff.id}
        loading={loading}
        emptyText={language === "id" ? "Tidak ada data pengguna yang cocok dengan filter." : "No users match the current filter."}
        renderMobileItem={(staff) => (
          <div className="p-4 bg-white dark:bg-[#1E1E22] rounded-2xl border border-slate-200/80 dark:border-[#2E2E34] space-y-3 shadow-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h5 className="font-extrabold text-xs text-slate-900 dark:text-white leading-tight">{staff.name}</h5>
                <p className="text-[10px] text-slate-400 mt-0.5">{staff.phone_or_email}</p>
              </div>
              <Badge
                variant="outline"
                className={"text-[9px] font-bold rounded-full " + (
                  staff.status === "active"
                    ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                    : "bg-slate-100 text-slate-400"
                )}
              >
                {staff.status.toUpperCase()}
              </Badge>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-[#2E2E34] text-xs">
              <span className="text-slate-500 text-[11px]">{staff.outlet_name || "Semua Cabang"}</span>
              <Badge variant="outline" className="text-[9px] font-bold rounded-full capitalize">
                {staff.role}
              </Badge>
            </div>
          </div>
        )}
      />

      {/* ======================= MODAL: ADD USER / STAFF ======================= */}
      <Dialog open={showAddStaffModal} onOpenChange={setShowAddStaffModal}>
        <DialogContent className="sm:max-w-md rounded-3xl bg-white dark:bg-[#1A1C20] border-slate-200 dark:border-[#2E2E34]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              <span>Daftarkan Pengguna / Kasir Baru</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Buat akun login staf baru dengan email Gmail terdaftar dan PIN kasir 6-digit.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateStaff} className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nama Lengkap</Label>
              <Input
                required
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="Contoh: Siti Rahmawati"
                className="h-10 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Email Gmail (Wajib @gmail.com)</Label>
              <div className="relative">
                <Input
                  required
                  type="email"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  placeholder="siti.rahmawati@gmail.com"
                  className="h-10 rounded-xl pl-9"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Role Akses</Label>
                <Select value={staffRole} onValueChange={(val) => val && setStaffRole(val)}>
                  <SelectTrigger className="h-10 rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="staff">Staff / Kasir</SelectItem>
                    <SelectItem value="manager">Manager Outlet</SelectItem>
                    <SelectItem value="admin_gudang">Admin Gudang</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Penempatan Cabang</Label>
                <Select value={staffOutletId} onValueChange={(val) => val && setStaffOutletId(val)}>
                  <SelectTrigger className="h-10 rounded-xl text-xs">
                    <SelectValue placeholder="Pilih Cabang" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {outlets.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Kata Sandi Default</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="h-10 rounded-xl pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span>PIN Kasir (6 Digit Numerik)</span>
                <span className="text-[10px] text-muted-foreground">Dipakai saat login kasir</span>
              </Label>
              <div className="flex justify-center pt-1">
                <InputOTP
                  maxLength={6}
                  value={staffPin}
                  onChange={(val) => setStaffPin(val)}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddStaffModal(false)}
                className="rounded-xl h-10 text-xs"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={submittingStaff}
                className="rounded-xl h-10 text-xs font-bold bg-[#E2FF66] text-black hover:bg-[#D5F54E]"
              >
                {submittingStaff ? "Menyimpan..." : "Daftarkan Pengguna"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ======================= MODAL: RESET PIN ======================= */}
      <Dialog
        open={!!resetPinStaff}
        onOpenChange={(open) => !open && setResetPinStaff(null)}
      >
        <DialogContent className="sm:max-w-sm rounded-3xl bg-white dark:bg-[#1A1C20] border-slate-200 dark:border-[#2E2E34]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              <span>Reset PIN Kasir</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Masukkan 6 digit PIN kasir baru untuk{" "}
              <strong className="text-slate-900 dark:text-white">
                {resetPinStaff?.name}
              </strong>
              .
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleResetPin} className="space-y-4 py-2">
            <div className="space-y-2 flex flex-col items-center">
              <InputOTP
                maxLength={6}
                value={newPin}
                onChange={(val) => setNewPin(val)}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetPinStaff(null)}
                className="rounded-xl h-10 text-xs"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={submittingPin || newPin.length < 6}
                className="rounded-xl h-10 text-xs font-bold bg-[#E2FF66] text-black hover:bg-[#D5F54E]"
              >
                {submittingPin ? "Memproses..." : "Update PIN"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
