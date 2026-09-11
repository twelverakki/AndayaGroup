import React, { useState, useEffect, useMemo } from "react";
import { api } from "../../lib/api";
import { useLanguageStore, translations } from "../../lib/i18n";
import { toast } from "../../components/ui/sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { ErpDataTable, type ColumnDef } from "../../components/ErpDataTable";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "../../components/ui/drawer";
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
  Users,
  UserPlus,
  Shield,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Loader2,
  Mail,
  ArrowUpRight,
  ShieldAlert,
  Search,
  Building,
  Store,
  Edit3,
  Calendar,
  Layers,
  Crown,
  UserCheck,
  ShoppingCart,
} from "lucide-react";

interface UserAssignment {
  type: string;
  business_id?: string;
  business_name?: string;
  outlet_id?: string;
  outlet_name?: string;
  role?: string;
  status?: string;
}

interface GlobalUser {
  id: string;
  name: string;
  phone_or_email: string;
  status: string;
  created_at: string;
  assignments: UserAssignment[];
}

interface UsersManagementViewProps {
  onNavigateToBusinesses?: () => void;
}

// Generate consistent avatar color based on user name
const getAvatarBg = (name: string) => {
  const colors = [
    "bg-emerald-500 text-white",
    "bg-indigo-500 text-white",
    "bg-blue-500 text-white",
    "bg-amber-500 text-white",
    "bg-rose-500 text-white",
    "bg-teal-500 text-white",
    "bg-purple-500 text-white",
    "bg-cyan-600 text-white",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const getInitials = (name: string) => {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (name.slice(0, 2) || "U").toUpperCase();
};

export default function UsersManagementView({
  onNavigateToBusinesses,
}: UsersManagementViewProps) {
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;

  const [users, setUsers] = useState<GlobalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeRoleFilter, setActiveRoleFilter] = useState<"all" | "superadmin" | "owner" | "manager" | "staff" | "admin_gudang">("all");

  // Drawer: Add Platform Admin
  const [showAddAdminDrawer, setShowAddAdminDrawer] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [submittingAdmin, setSubmittingAdmin] = useState(false);

  // Drawer: Edit User Basic Info
  const [editingUser, setEditingUser] = useState<GlobalUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editStatus, setEditStatus] = useState("active");
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const isGmail = (val: string) => val.trim().toLowerCase().endsWith("@gmail.com");

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/users");
      const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setUsers(list);
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          (language === "id" ? "Gagal memuat daftar pengguna" : "Failed to load users")
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Keyboard shortcut '/' to search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault();
        const searchInput = document.getElementById("global-users-search-input");
        if (searchInput) {
          searchInput.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Determine Primary Role of user
  const getUserPrimaryRole = (user: GlobalUser): { roleKey: string; label: string; badgeClass: string; icon: React.ReactNode } => {
    const email = (user.phone_or_email || "").toLowerCase();
    const isPlatformSuperadmin = email === "superadmin@andaya.com" || email === "admin@andaya.com";

    if (isPlatformSuperadmin) {
      return {
        roleKey: "superadmin",
        label: "Admin Platform",
        badgeClass: "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/40",
        icon: <Shield className="w-3 h-3" />,
      };
    }

    const hasOwner = user.assignments.some((a) => a.type === "owner");
    if (hasOwner) {
      return {
        roleKey: "owner",
        label: "Owner Bisnis",
        badgeClass: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/40",
        icon: <Crown className="w-3 h-3" />,
      };
    }

    const hasManager = user.assignments.some((a) => a.role === "manager");
    if (hasManager) {
      return {
        roleKey: "manager",
        label: "Manager Outlet",
        badgeClass: "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/40",
        icon: <UserCheck className="w-3 h-3" />,
      };
    }

    const hasGudang = user.assignments.some((a) => a.role === "admin_gudang" || a.role === "gudang");
    if (hasGudang) {
      return {
        roleKey: "admin_gudang",
        label: "Admin Gudang",
        badgeClass: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40",
        icon: <Layers className="w-3 h-3" />,
      };
    }

    const hasStaff = user.assignments.some((a) => a.type === "staff" || a.role === "staff");
    if (hasStaff) {
      return {
        roleKey: "staff",
        label: "Staff / Kasir",
        badgeClass: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40",
        icon: <ShoppingCart className="w-3 h-3" />,
      };
    }

    // Unassigned account (newly created Owner before initial business setup)
    return {
      roleKey: "owner",
      label: "Owner (Belum Setup Bisnis)",
      badgeClass: "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-500 dark:text-indigo-400 border-dashed border-indigo-300 dark:border-indigo-800",
      icon: <Crown className="w-3 h-3" />,
    };
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminName.trim() || !adminEmail.trim()) {
      toast.error(language === "id" ? "Nama dan Email wajib diisi" : "Name and Email are required");
      return;
    }
    if (!isGmail(adminEmail)) {
      toast.error(language === "id" ? "Email wajib domain @gmail.com" : "Email must use @gmail.com domain");
      return;
    }
    if (!adminPassword || adminPassword.length < 6) {
      toast.error(language === "id" ? "Password minimal 6 karakter" : "Password min 6 chars");
      return;
    }

    setSubmittingAdmin(true);
    setShowAddAdminDrawer(false);

    const promise = api.post("/admin/users", {
      name: adminName.trim(),
      email: adminEmail.trim(),
      password: adminPassword.trim(),
      pin: adminPin.trim() || "888888",
      status: "active",
    });

    toast.promise(promise, {
      loading: language === "id" ? "Mendaftarkan admin platform..." : "Registering platform admin...",
      success: () => {
        setSubmittingAdmin(false);
        setAdminName("");
        setAdminEmail("");
        setAdminPassword("");
        setAdminPin("");
        loadUsers();
        return language === "id"
          ? "Akun Admin Platform " + adminName + " berhasil didaftarkan!"
          : "Platform Admin " + adminName + " created successfully!";
      },
      error: (err: any) => {
        setSubmittingAdmin(false);
        return (
          err.response?.data?.message ||
          (language === "id" ? "Gagal membuat admin" : "Failed to create admin")
        );
      },
    });
  };

  const handleOpenEditUser = (user: GlobalUser) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.phone_or_email);
    setEditStatus(user.status);
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editName.trim() || !editEmail.trim()) {
      toast.error(language === "id" ? "Nama dan Email wajib diisi" : "Name and Email are required");
      return;
    }
    if (!isGmail(editEmail)) {
      toast.error(language === "id" ? "Email wajib domain @gmail.com" : "Email must use @gmail.com domain");
      return;
    }

    setSubmittingEdit(true);
    const targetUserId = editingUser.id;
    setEditingUser(null);

    // Optimistic state update
    setUsers((prev) =>
      prev.map((u) =>
        u.id === targetUserId
          ? { ...u, name: editName.trim(), phone_or_email: editEmail.trim(), status: editStatus }
          : u
      )
    );

    const promise = api.put("/admin/users/" + targetUserId, {
      name: editName.trim(),
      email: editEmail.trim(),
      status: editStatus,
    });

    toast.promise(promise, {
      loading: language === "id" ? "Menyimpan profil pengguna..." : "Updating user profile...",
      success: () => {
        setSubmittingEdit(false);
        loadUsers();
        return t.usersEditUserSuccess || "Data pengguna berhasil diperbarui!";
      },
      error: (err: any) => {
        setSubmittingEdit(false);
        loadUsers();
        return (
          err.response?.data?.message ||
          (language === "id" ? "Gagal memperbarui pengguna" : "Failed to update user")
        );
      },
    });
  };

  const handleToggleUserStatus = async (user: GlobalUser) => {
    const newStatus = user.status === "active" ? "inactive" : "active";

    // Optimistic local update
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u))
    );

    const promise = api.put("/admin/users/" + user.id, {
      name: user.name,
      email: user.phone_or_email,
      status: newStatus,
    });

    toast.promise(promise, {
      loading: language === "id" ? "Mengubah status pengguna..." : "Updating user status...",
      success: () => {
        return (
          (language === "id" ? "Status " : "Status for ") +
          user.name +
          (language === "id" ? " diubah menjadi " : " changed to ") +
          newStatus.toUpperCase()
        );
      },
      error: (err: any) => {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, status: user.status } : u))
        );
        return (
          err.response?.data?.message ||
          (language === "id" ? "Gagal memperbarui status" : "Failed to update status")
        );
      },
    });
  };

  // Filter calculation
  const totalCount = users.length;
  const ownerCount = users.filter((u) => u.assignments.some((a) => a.type === "owner")).length;
  const staffCount = users.filter((u) => u.assignments.some((a) => a.type === "staff" && a.role === "staff")).length;
  const managerCount = users.filter((u) => u.assignments.some((a) => a.role === "manager")).length;
  const adminCount = users.filter((u) => u.assignments.length === 0).length;

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        u.name.toLowerCase().includes(q) ||
        u.phone_or_email.toLowerCase().includes(q) ||
        u.assignments.some(
          (a) =>
            a.business_name?.toLowerCase().includes(q) ||
            a.outlet_name?.toLowerCase().includes(q) ||
            a.role?.toLowerCase().includes(q)
        );

      if (!matchesSearch) return false;

      if (activeRoleFilter === "all") return true;
      const roleInfo = getUserPrimaryRole(u);
      return roleInfo.roleKey === activeRoleFilter;
    });
  }, [users, searchQuery, activeRoleFilter]);

  // ════════════════════════════════════════════════════════════════
  // ERP DATA TABLE COLUMN DEFINITION
  // ════════════════════════════════════════════════════════════════
  const columns: ColumnDef<GlobalUser>[] = useMemo(() => [
    {
      key: "user",
      label: t.usersColUser || "Pengguna / Akun",
      renderCell: (u) => (
        <div className="flex items-center gap-3">
          <div className={"w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0 shadow-xs " + getAvatarBg(u.name)}>
            {getInitials(u.name)}
          </div>
          <div className="min-w-0">
            <p className="font-extrabold text-xs text-slate-900 dark:text-white leading-tight truncate">
              {u.name}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">{u.phone_or_email}</span>
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      label: t.usersColRole || "Tipe Akun Primer",
      renderCell: (u) => {
        const primaryRole = getUserPrimaryRole(u);
        return (
          <Badge
            variant="outline"
            className={"text-[10px] font-bold rounded-full gap-1.5 px-2.5 py-0.5 " + primaryRole.badgeClass}
          >
            {primaryRole.icon}
            <span>{primaryRole.label}</span>
          </Badge>
        );
      },
    },
    {
      key: "assignment",
      label: t.usersColAssignment || "Penugasan Unit Bisnis & Cabang",
      renderCell: (u) => {
        const isOwner = u.assignments.some((a) => a.type === "owner");

        if (u.assignments.length === 0) {
          return (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Shield className="w-3.5 h-3.5 text-purple-500 shrink-0" />
              <span className="text-[11px] font-semibold">{t.usersHoldingAccess || "Akses Penuh Platform"}</span>
            </div>
          );
        }

        if (isOwner) {
          return (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
                <Building className="w-3 h-3" />
              </div>
              <div>
                <p className="font-bold text-xs text-slate-800 dark:text-slate-200">
                  {u.assignments[0]?.business_name || "Unit Usaha"}
                </p>
                {u.assignments.length > 1 && (
                  <p className="text-[10px] text-indigo-500 font-semibold">
                    +{u.assignments.length - 1} {t.usersMultiBiz || "Unit Bisnis Lainnya"}
                  </p>
                )}
              </div>
            </div>
          );
        }

        return (
          <div className="flex flex-col gap-1 max-w-sm">
            {u.assignments.slice(0, 2).map((a, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-[11px]">
                <Store className="w-3 h-3 text-blue-500 shrink-0" />
                <span className="font-bold text-slate-800 dark:text-slate-200">{a.business_name}</span>
                {a.outlet_name && (
                  <span className="text-slate-500 dark:text-slate-400 text-[10px]">
                    • {a.outlet_name}
                  </span>
                )}
              </div>
            ))}
            {u.assignments.length > 2 && (
              <span className="text-[10px] text-slate-400 italic">
                +{u.assignments.length - 2} penugasan cabang lainnya
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "joined",
      label: t.usersColJoined || "Terdaftar Sejak",
      renderCell: (u) => (
        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
          <span>
            {u.created_at
              ? new Date(u.created_at).toLocaleDateString(language === "id" ? "id-ID" : "en-US", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "-"}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      label: t.usersColStatus || "Status",
      renderCell: (u) => (
        <Badge
          variant="outline"
          className={"text-[10px] font-bold rounded-full " + (
            u.status === "active"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40"
              : "bg-slate-100 dark:bg-slate-800 text-slate-400"
          )}
        >
          {u.status.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: t.usersColActions || "Aksi",
      align: "right",
      renderCell: (u) => (
        <DropdownMenu>
          <DropdownMenuTrigger className="h-7 w-7 p-0 rounded-full inline-flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer outline-none">
            <MoreVertical className="w-3.5 h-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-2xl w-44">
            <DropdownMenuItem
              onClick={() => handleOpenEditUser(u)}
              className="text-xs font-bold gap-2 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-blue-500" />
              <span>{t.usersEditUser || "Edit Profil"}</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => handleToggleUserStatus(u)}
              className={"text-xs font-bold gap-2 cursor-pointer " + (
                u.status === "active" ? "text-rose-500" : "text-emerald-500"
              )}
            >
              {u.status === "active" ? (
                <>
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{t.usersDeactivateAccount || "Nonaktifkan Akun"}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t.usersActivateAccount || "Aktifkan Akun"}</span>
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], [language, t]);

  return (
    <div className="space-y-6 w-full">
      {/* ── TOP HEADER BAR (CLEAN & HIGHLIGHTED) ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-[#2E2E34]">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Users className="w-7 h-7 text-primary" />
            <span>{t.usersDirTitle || "Direktori Pengguna Global"}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t.usersDirDesc || "Pusat tata kelola seluruh akun pengguna Andaya ERP (Superadmin, Owner, Manager, Kasir, & Admin Gudang)."}
          </p>
        </div>

        <div className="flex items-center gap-3 self-stretch sm:self-auto">
          <Button
            onClick={() => setShowAddAdminDrawer(true)}
            className="rounded-full bg-[#E2FF66] hover:bg-[#D5F54E] text-slate-900 font-bold text-xs h-9 px-4 gap-1.5 shadow-sm cursor-pointer"
          >
            <Shield className="w-4 h-4" />
            <span>{t.usersAddAdmin || "Tambah Admin Platform"}</span>
          </Button>
        </div>
      </div>

      {/* ── STATS SUMMARY CARDS ROW ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {t.usersStatTotal || "Total Pengguna"}
            </p>
            <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{totalCount}</p>
          </div>
          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-600 dark:text-slate-300">
            <Users className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E1E22] border border-indigo-200/60 dark:border-indigo-900/40 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
              {t.usersStatOwners || "Pemilik Bisnis"}
            </p>
            <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-0.5">{ownerCount}</p>
          </div>
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
            <Crown className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E1E22] border border-blue-200/60 dark:border-blue-900/40 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500">
              Outlet Manager
            </p>
            <p className="text-lg font-black text-blue-600 dark:text-blue-400 mt-0.5">{managerCount}</p>
          </div>
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
            <UserCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E1E22] border border-emerald-200/60 dark:border-emerald-900/40 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
              {t.usersStatStaff || "Staf & Kasir"}
            </p>
            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{staffCount}</p>
          </div>
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <ShoppingCart className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* ── ANCHOR BANNER TO BUSINESSES ── */}
      <div className="p-4 rounded-3xl bg-slate-50 dark:bg-[#18181B] border border-slate-200/80 dark:border-[#2E2E34] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <UserPlus className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              {language === "id" ? "Ingin Menambah Pengguna Bisnis atau Kasir Cabang?" : "Need to Add Cashiers or Branch Staff?"}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {language === "id"
                ? "Penambahan staf cabang & kasir dilakukan langsung di dalam halaman Organisasi unit bisnis terkait."
                : "Staff & cashier assignments are managed directly inside the respective business portfolio."}
            </p>
          </div>
        </div>

        {onNavigateToBusinesses && (
          <Button
            variant="outline"
            onClick={onNavigateToBusinesses}
            className="rounded-full text-xs font-bold h-8 px-4 gap-1.5 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer self-end sm:self-auto"
          >
            <span>{language === "id" ? "Buka Kelola Bisnis" : "Go to Businesses"}</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-primary" />
          </Button>
        )}
      </div>

      {/* ── FILTER TABS & SEARCH ROW (BROWSER-LIKE CLEAN DESIGN) ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pt-1">
        {/* Quick Role Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar w-full md:w-auto">
          <button
            type="button"
            onClick={() => setActiveRoleFilter("all")}
            className={"px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 " + (
              activeRoleFilter === "all"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
            )}
          >
            {t.usersTabAll || "Semua"} ({totalCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveRoleFilter("owner")}
            className={"px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 " + (
              activeRoleFilter === "owner"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
            )}
          >
            {t.usersTabOwner || "Owner"} ({ownerCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveRoleFilter("manager")}
            className={"px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 " + (
              activeRoleFilter === "manager"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
            )}
          >
            {t.usersTabManager || "Manager"} ({managerCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveRoleFilter("staff")}
            className={"px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 " + (
              activeRoleFilter === "staff"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
            )}
          >
            {t.usersTabCashier || "Kasir"} ({staffCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveRoleFilter("superadmin")}
            className={"px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 " + (
              activeRoleFilter === "superadmin"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
            )}
          >
            {t.usersTabSuperadmin || "Admin"} ({adminCount})
          </button>
        </div>

        {/* Search Input with Keyboard Shortcut '/' */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            id="global-users-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === "id" ? "Cari nama, Gmail, bisnis..." : "Search user, Gmail..."}
            className="pl-9 pr-8 h-9 rounded-full text-xs bg-white dark:bg-[#1E1E22] border-slate-200/80 dark:border-[#2E2E34]"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[10px] text-slate-400 font-mono">
            /
          </kbd>
        </div>
      </div>

      {/* ── ERP DATA TABLE REUSABLE COMPONENT (WITH COLUMN VISIBILITY TOGGLE & MOBILE VIEW) ── */}
      <ErpDataTable<GlobalUser>
        data={filteredUsers}
        columns={columns}
        keyExtractor={(u) => u.id}
        loading={loading}
        emptyText={t.usersNoUsersFound || "Tidak ada data pengguna yang cocok"}
        enableColumnToggle={true}
        renderMobileItem={(u) => {
          const primaryRole = getUserPrimaryRole(u);
          const isOwner = u.assignments.some((a) => a.type === "owner");

          return (
            <div className="p-4 bg-white dark:bg-[#1E1E22] rounded-2xl border border-slate-200/80 dark:border-[#2E2E34] space-y-3 shadow-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className={"w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shrink-0 " + getAvatarBg(u.name)}>
                    {getInitials(u.name)}
                  </div>
                  <div>
                    <h5 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">{u.name}</h5>
                    <p className="text-xs text-slate-400 mt-0.5">{u.phone_or_email}</p>
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className={"text-[10px] font-bold rounded-full " + (
                    u.status === "active"
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200"
                      : "bg-slate-100 text-slate-400"
                  )}
                >
                  {u.status.toUpperCase()}
                </Badge>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-[#2E2E34] text-xs">
                <Badge variant="outline" className={"text-[10px] font-bold rounded-full gap-1 " + primaryRole.badgeClass}>
                  {primaryRole.icon}
                  <span>{primaryRole.label}</span>
                </Badge>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenEditUser(u)}
                  className="rounded-full text-xs h-7 px-3 cursor-pointer"
                >
                  Edit
                </Button>
              </div>
            </div>
          );
        }}
      />

      {/* ── DRAWER 1: ADD PLATFORM ADMIN (RIGHT SLIDING DRAWER) ── */}
      <Drawer
        direction="right"
        open={showAddAdminDrawer}
        onOpenChange={setShowAddAdminDrawer}
      >
        <DrawerContent className="w-full sm:w-[460px]">
          <form onSubmit={handleCreateAdmin} className="flex flex-col h-full justify-between">
            <div className="overflow-y-auto">
              <DrawerHeader className="border-b border-slate-100 dark:border-[#2A2A30] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-600 shrink-0">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <DrawerTitle className="text-base font-black text-slate-900 dark:text-white">
                      {t.usersAddAdmin || "Tambah Admin Platform"}
                    </DrawerTitle>
                    <DrawerDescription className="text-xs text-slate-400 mt-0.5">
                      {language === "id"
                        ? "Akun ini akan memiliki otoritas penuh ke seluruh modul & tenant Andaya ERP."
                        : "Account with unrestricted access across all holding entities."}
                    </DrawerDescription>
                  </div>
                </div>
              </DrawerHeader>

              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {language === "id" ? "Nama Lengkap" : "Full Name"} <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Contoh: Kennan Superadmin"
                    required
                    className="h-10 rounded-xl text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {language === "id" ? "Email Gmail Terdaftar" : "Registered Gmail"} <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin.super@gmail.com"
                    required
                    className="h-10 rounded-xl text-xs"
                  />
                  {!isGmail(adminEmail) && adminEmail.length > 0 && (
                    <p className="text-[10px] text-rose-500 flex items-center gap-1 mt-1">
                      <ShieldAlert className="w-3 h-3" />
                      <span>{language === "id" ? "Wajib menggunakan domain @gmail.com" : "Must use @gmail.com domain"}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {language === "id" ? "Password Akun" : "Account Password"} <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    required
                    className="h-10 rounded-xl text-xs"
                  />
                </div>

                <div className="space-y-2 pt-1">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {language === "id" ? "PIN Kasir / Otorisasi 6-Digit" : "6-Digit PIN"}
                  </Label>
                  <div className="flex justify-center py-2 bg-slate-50 dark:bg-white/[0.02] rounded-2xl border border-slate-200/80 dark:border-[#2E2E34]">
                    <InputOTP
                      maxLength={6}
                      value={adminPin}
                      onChange={(val) => setAdminPin(val)}
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
              </div>
            </div>

            <DrawerFooter className="p-6 border-t border-slate-100 dark:border-[#2A2A30] flex flex-row gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddAdminDrawer(false)}
                className="flex-1 rounded-full text-xs h-10 cursor-pointer"
              >
                {t.cancel || "Batal"}
              </Button>
              <Button
                type="submit"
                disabled={submittingAdmin}
                className="flex-1 rounded-full bg-[#E2FF66] hover:bg-[#D5F54E] text-slate-900 font-bold text-xs h-10 gap-1.5 cursor-pointer"
              >
                {submittingAdmin ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                <span>{t.save || "Daftarkan Admin"}</span>
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>

      {/* ── DRAWER 2: EDIT USER PROFILE (RIGHT SLIDING DRAWER) ── */}
      <Drawer
        direction="right"
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
      >
        <DrawerContent className="w-full sm:w-[440px]">
          <form onSubmit={handleSaveEditUser} className="flex flex-col h-full justify-between">
            <div>
              <DrawerHeader className="border-b border-slate-100 dark:border-[#2A2A30] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <DrawerTitle className="text-base font-black text-slate-900 dark:text-white">
                      {t.usersEditUser || "Edit Profil Pengguna"}
                    </DrawerTitle>
                    <DrawerDescription className="text-xs text-slate-400 mt-0.5">
                      Perbarui nama akun, email Gmail, atau status operasional.
                    </DrawerDescription>
                  </div>
                </div>
              </DrawerHeader>

              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {language === "id" ? "Nama Lengkap" : "Full Name"} <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Nama Pengguna"
                    required
                    className="h-10 rounded-xl text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {language === "id" ? "Email Gmail Terdaftar" : "Registered Gmail"} <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="user@gmail.com"
                    required
                    className="h-10 rounded-xl text-xs"
                  />
                  {!isGmail(editEmail) && editEmail.length > 0 && (
                    <p className="text-[10px] text-rose-500 flex items-center gap-1 mt-1">
                      <ShieldAlert className="w-3 h-3" />
                      <span>{language === "id" ? "Wajib domain @gmail.com" : "Must be @gmail.com"}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1.5 pt-1">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {language === "id" ? "Status Akun" : "Account Status"}
                  </Label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setEditStatus("active")}
                      className={"p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer " + (
                        editStatus === "active"
                          ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary"
                          : "bg-white dark:bg-[#202024] border-slate-200/80 dark:border-[#2E2E34]"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span className="font-bold text-xs text-slate-900 dark:text-white">Aktif</span>
                      </div>
                      <span className={"w-3.5 h-3.5 rounded-full border flex items-center justify-center " + (editStatus === "active" ? "border-primary bg-primary" : "border-slate-300")}>
                        {editStatus === "active" && <span className="w-1.5 h-1.5 rounded-full bg-slate-900"></span>}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditStatus("inactive")}
                      className={"p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer " + (
                        editStatus === "inactive"
                          ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary"
                          : "bg-white dark:bg-[#202024] border-slate-200/80 dark:border-[#2E2E34]"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-rose-500" />
                        <span className="font-bold text-xs text-slate-900 dark:text-white">Non-aktif</span>
                      </div>
                      <span className={"w-3.5 h-3.5 rounded-full border flex items-center justify-center " + (editStatus === "inactive" ? "border-primary bg-primary" : "border-slate-300")}>
                        {editStatus === "inactive" && <span className="w-1.5 h-1.5 rounded-full bg-slate-900"></span>}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <DrawerFooter className="p-6 border-t border-slate-100 dark:border-[#2A2A30] flex flex-row gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingUser(null)}
                className="flex-1 rounded-full text-xs h-10 cursor-pointer"
              >
                {t.cancel || "Batal"}
              </Button>
              <Button
                type="submit"
                disabled={submittingEdit}
                className="flex-1 rounded-full bg-[#E2FF66] hover:bg-[#D5F54E] text-slate-900 font-bold text-xs h-10 gap-1.5 cursor-pointer"
              >
                {submittingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit3 className="w-4 h-4" />}
                <span>{t.save || "Simpan Perubahan"}</span>
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
