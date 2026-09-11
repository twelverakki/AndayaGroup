import React, { useState, useEffect, useMemo } from "react";
import { api } from "../../lib/api";
import { useLanguageStore, translations } from "../../lib/i18n";
import { toast } from "../../components/ui/sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { ErpDataTable, type ColumnDef } from "../../components/ErpDataTable";
import { ErpSearchBar } from "../../components/ErpSearchBar";
import { Label } from "../../components/ui/label";
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
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "../../components/ui/popover";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "../../components/ui/input-otp";
import {
  Building2,
  Store,
  Utensils,
  CookingPot,
  FlameKindling,
  ShoppingCart,
  Layers,
  Send,
  Flame,
  Loader2,
  Users,
  Plus,
  Sliders,
  KeyRound,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Info,
  Save,
  MapPin,
  Phone,
  Mail,
  FileText,
  Receipt,
  Edit3,
  GripVertical,
  UserCheck,
  ShieldAlert,
  ArrowRightLeft,
  Store as BranchIcon,
  BookOpen,
  SlidersHorizontal,
} from "lucide-react";

export interface BusinessItemData {
  id: string;
  name: string;
  type: string;
  phone?: string;
  email?: string;
  tax_id?: string;
  tax_rate_pct?: number;
  has_pos: boolean;
  has_manufacturing: boolean;
  has_logistics_hub: boolean;
  has_eod_usage: boolean;
  outlet_count: number;
  staff_count: number;
  created_at?: string;
}

interface OutletItem {
  id: string;
  business_id: string;
  name: string;
  address?: string;
  phone?: string;
  receipt_footer?: string;
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

interface BusinessCardProps {
  business: BusinessItemData;
  isFrameless?: boolean;
  onBusinessUpdated: (updatedBiz?: Partial<BusinessItemData>) => void;
}

// Color palette generator for user avatar initial badges
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

export function BusinessExpandableCard({
  business,
  isFrameless = true,
  onBusinessUpdated,
}: BusinessCardProps) {
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;

  const [loadingDetails, setLoadingDetails] = useState(false);
  const [outlets, setOutlets] = useState<OutletItem[]>([]);
  const [staffList, setStaffList] = useState<StaffItem[]>([]);

  // Local Business Data State
  const [currentBiz, setCurrentBiz] = useState<BusinessItemData>(business);

  // Synchronize local business object whenever prop changes
  useEffect(() => {
    setCurrentBiz(business);
  }, [business]);

  // Capability Flags State
  const [hasPos, setHasPos] = useState(business.has_pos);
  const [hasMfg, setHasMfg] = useState(business.has_manufacturing);
  const [hasHub, setHasHub] = useState(business.has_logistics_hub);
  const [hasEod, setHasEod] = useState(business.has_eod_usage);

  const handleOpenEditProfile = () => {
    setBizProfileName(currentBiz.name);
    setBizProfilePhone(currentBiz.phone || "");
    setBizProfileEmail(currentBiz.email || "");
    setBizProfileTaxId(currentBiz.tax_id || "");
    setBizProfileTaxRate(currentBiz.tax_rate_pct || 0);
    setHasPos(currentBiz.has_pos);
    setHasMfg(currentBiz.has_manufacturing);
    setHasHub(currentBiz.has_logistics_hub);
    setHasEod(currentBiz.has_eod_usage);
    setActiveDrawer("edit_profile");
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizProfileName.trim()) {
      toast.error(language === "id" ? "Nama unit bisnis wajib diisi" : "Business name is required");
      return;
    }

    setSubmittingProfile(true);
    setActiveDrawer(null);

    const profilePayload = {
      name: bizProfileName.trim(),
      phone: bizProfilePhone.trim() || undefined,
      email: bizProfileEmail.trim() || undefined,
      tax_id: bizProfileTaxId.trim() || undefined,
      tax_rate_pct: Number(bizProfileTaxRate) || 0,
    };

    const capPayload = {
      has_pos: hasPos,
      has_manufacturing: hasMfg,
      has_logistics_hub: hasHub,
      has_eod_usage: hasEod,
    };

    const fullPayload = { ...profilePayload, ...capPayload };

    // Immediate reactive local update
    setCurrentBiz((prev) => ({ ...prev, ...fullPayload }));
    onBusinessUpdated(fullPayload);

    const savePromise = Promise.all([
      api.put("/organization/business/profile?business_id=" + business.id, profilePayload),
      api.put("/organization/business/capabilities?business_id=" + business.id, capPayload),
    ]);

    toast.promise(
      savePromise,
      {
        loading: language === "id" ? "Menyimpan pengaturan unit bisnis..." : "Saving business settings...",
        success: () => {
          setSubmittingProfile(false);
          loadSubDetails();
          return language === "id" ? "Pengaturan unit bisnis berhasil diperbarui!" : "Business settings updated successfully!";
        },
        error: (err: any) => {
          setSubmittingProfile(false);
          onBusinessUpdated();
          return err.response?.data?.message || (language === "id" ? "Gagal memperbarui pengaturan bisnis" : "Failed to update business settings");
        },
      }
    );
  };

  const handleOpenEditOutlet = (outlet: OutletItem) => {
    setEditingOutlet(outlet);
    setEditOutletName(outlet.name);
    setEditOutletAddress(outlet.address || "");
    setEditOutletPhone(outlet.phone || "");
    setEditOutletReceiptFooter(outlet.receipt_footer || "");
    setActiveDrawer("edit_outlet");
  };

  const handleSaveEditOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOutlet || !editOutletName.trim()) {
      toast.error(language === "id" ? "Nama cabang wajib diisi" : "Branch name is required");
      return;
    }

    setSubmittingEditOutlet(true);
    const targetOutletId = editingOutlet.id;
    setActiveDrawer(null);

    const payload = {
      name: editOutletName.trim(),
      address: editOutletAddress.trim() || undefined,
      phone: editOutletPhone.trim() || undefined,
      receipt_footer: editOutletReceiptFooter.trim() || undefined,
    };

    setOutlets((prev) =>
      prev.map((o) => (o.id === targetOutletId ? { ...o, ...payload } : o))
    );

    toast.promise(
      api.put("/organization/outlets/" + targetOutletId + "?business_id=" + business.id, payload),
      {
        loading: language === "id" ? "Menyimpan data cabang..." : "Saving branch details...",
        success: () => {
          setSubmittingEditOutlet(false);
          loadSubDetails(false);
          return language === "id" ? "Data cabang berhasil diperbarui!" : "Branch details updated successfully!";
        },
        error: (err: any) => {
          setSubmittingEditOutlet(false);
          loadSubDetails();
          return err.response?.data?.message || (language === "id" ? "Gagal memperbarui cabang" : "Failed to update branch");
        },
      }
    );
  };



  // Drawer States (Right Side Slide)
  const [activeDrawer, setActiveDrawer] = useState<"add_outlet" | "edit_outlet" | "edit_profile" | "add_staff" | "edit_staff" | "reset_pin" | null>(null);

  // Edit Business Profile Form State
  const [bizProfileName, setBizProfileName] = useState(business.name);
  const [bizProfilePhone, setBizProfilePhone] = useState(business.phone || "");
  const [bizProfileEmail, setBizProfileEmail] = useState(business.email || "");
  const [bizProfileTaxId, setBizProfileTaxId] = useState(business.tax_id || "");
  const [bizProfileTaxRate, setBizProfileTaxRate] = useState<number>(business.tax_rate_pct || 0);
  const [submittingProfile, setSubmittingProfile] = useState(false);

  // Edit Outlet Form State
  const [editingOutlet, setEditingOutlet] = useState<OutletItem | null>(null);
  const [editOutletName, setEditOutletName] = useState("");
  const [editOutletAddress, setEditOutletAddress] = useState("");
  const [editOutletPhone, setEditOutletPhone] = useState("");
  const [editOutletReceiptFooter, setEditOutletReceiptFooter] = useState("");
  const [submittingEditOutlet, setSubmittingEditOutlet] = useState(false);

  // Add Outlet Form
  const [outletName, setOutletName] = useState("");
  const [outletAddress, setOutletAddress] = useState("");
  const [submittingOutlet, setSubmittingOutlet] = useState(false);

  // Add / Edit Staff Form
  const [editingStaff, setEditingStaff] = useState<StaffItem | null>(null);
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffPin, setStaffPin] = useState("");
  const [staffRole, setStaffRole] = useState("staff");
  const [staffOutletId, setStaffOutletId] = useState("");
  const [submittingStaff, setSubmittingStaff] = useState(false);

  // Reset PIN Form
  const [resetPinStaff, setResetPinStaff] = useState<StaffItem | null>(null);
  const [newPin, setNewPin] = useState("");
  const [submittingPin, setSubmittingPin] = useState(false);

  // Drag and Drop Placement State
  const [draggedStaffId, setDraggedStaffId] = useState<string | null>(null);
  const [dragOverOutletId, setDragOverOutletId] = useState<string | null>(null);

  const isGmail = (val: string) => val.trim().toLowerCase().endsWith("@gmail.com");

  // Synchronize local flags when prop changes
  useEffect(() => {
    setHasPos(business.has_pos);
    setHasMfg(business.has_manufacturing);
    setHasHub(business.has_logistics_hub);
    setHasEod(business.has_eod_usage);
  }, [business.has_pos, business.has_manufacturing, business.has_logistics_hub, business.has_eod_usage]);

  // Load detailed sub-entities (with silent sync support to prevent jarring UI re-render)
  const loadSubDetails = async (isInitial = false) => {
    if (isInitial) setLoadingDetails(true);
    try {
      const [outletsRes, staffRes] = await Promise.all([
        api.get("/organization/outlets?business_id=" + business.id),
        api.get("/organization/staff?business_id=" + business.id),
      ]);
      setOutlets(Array.isArray(outletsRes.data) ? outletsRes.data : outletsRes.data?.data || []);
      setStaffList(Array.isArray(staffRes.data) ? staffRes.data : staffRes.data?.data || []);
    } catch (err: any) {
      console.error("Failed to load business details:", err);
    } finally {
      if (isInitial) setLoadingDetails(false);
    }
  };

  useEffect(() => {
    loadSubDetails(true);
  }, [business.id]);



  // ════════════════════════════════════════════════════════════════
  // OUTLET ACTIONS
  // ════════════════════════════════════════════════════════════════
  const handleCreateOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outletName.trim()) {
      toast.error(language === "id" ? "Nama cabang wajib diisi" : "Branch name is required");
      return;
    }

    setSubmittingOutlet(true);
    setActiveDrawer(null);

    const promise = api.post("/organization/outlets?business_id=" + business.id, {
      name: outletName.trim(),
      address: outletAddress.trim() || undefined,
    });

    toast.promise(promise, {
      loading: language === "id" ? "Mendaftarkan cabang baru..." : "Registering branch...",
      success: (res: any) => {
        setSubmittingOutlet(false);
        setOutletName("");
        setOutletAddress("");
        loadSubDetails(false);
        onBusinessUpdated({ outlet_count: (currentBiz.outlet_count || 0) + 1 });
        return t.orgCreateBranchSuccess || "Cabang baru berhasil didaftarkan!";
      },
      error: (err: any) => {
        setSubmittingOutlet(false);
        return (
          err.response?.data?.message ||
          (language === "id" ? "Gagal menambahkan cabang" : "Failed to add branch")
        );
      },
    });
  };

  // ════════════════════════════════════════════════════════════════
  // STAFF ACTIONS
  // ════════════════════════════════════════════════════════════════
  const handleOpenAddStaff = () => {
    setEditingStaff(null);
    setStaffName("");
    setStaffEmail("");
    setStaffPassword("");
    setStaffPin("");
    setStaffRole("staff");
    setStaffOutletId(outlets[0]?.id || "");
    setActiveDrawer("add_staff");
  };

  const handleOpenEditStaff = (staff: StaffItem) => {
    setEditingStaff(staff);
    setStaffName(staff.name);
    setStaffEmail(staff.phone_or_email);
    setStaffPassword("");
    setStaffPin("");
    setStaffRole(staff.role);
    setStaffOutletId(staff.outlet_id);
    setActiveDrawer("edit_staff");
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim() || !staffEmail.trim()) {
      toast.error(
        language === "id" ? "Nama dan Email Gmail wajib diisi" : "Name and Gmail address are required"
      );
      return;
    }
    if (!isGmail(staffEmail)) {
      toast.error(
        language === "id" ? "Email staf wajib berakhiran @gmail.com" : "Email must use @gmail.com domain"
      );
      return;
    }
    if (!staffOutletId) {
      toast.error(language === "id" ? "Pilih cabang penempatan staf" : "Please select assigned branch");
      return;
    }

    if (!editingStaff) {
      if (!staffPin || staffPin.length < 6) {
        toast.error(
          language === "id" ? "PIN Kasir / Otorisasi wajib 6 digit angka" : "PIN must be 6 digits"
        );
        return;
      }
    }

    setSubmittingStaff(true);
    setActiveDrawer(null);

    const isEditing = !!editingStaff;
    const targetStaffId = editingStaff?.id;

    if (isEditing && targetStaffId) {
      const targetOutlet = outlets.find((o) => o.id === staffOutletId);
      setStaffList((prev) =>
        prev.map((s) =>
          s.id === targetStaffId
            ? {
                ...s,
                name: staffName.trim(),
                phone_or_email: staffEmail.trim(),
                role: staffRole,
                outlet_id: staffOutletId,
                outlet_name: targetOutlet?.name || s.outlet_name,
              }
            : s
        )
      );
    }

    const promise: Promise<any> = isEditing
      ? api.put("/organization/staff/" + targetStaffId + "?business_id=" + business.id, {
          name: staffName.trim(),
          phone_or_email: staffEmail.trim(),
          role: staffRole,
          outlet_id: staffOutletId,
          pin: staffPin.length === 6 ? staffPin : undefined,
        })
      : api.post("/organization/staff?business_id=" + business.id, {
          name: staffName.trim(),
          phone_or_email: staffEmail.trim(),
          password: staffPassword.trim() || staffPin,
          pin: staffPin,
          role: staffRole,
          outlet_id: staffOutletId,
          can_view_cost: staffRole === "manager",
        });

    toast.promise(promise, {
      loading: language === "id" ? "Memproses data pengguna..." : "Processing user data...",
      success: () => {
        setSubmittingStaff(false);
        setEditingStaff(null);
        loadSubDetails(false);
        if (!isEditing) {
          onBusinessUpdated({ staff_count: (currentBiz.staff_count || 0) + 1 });
        }
        return isEditing
          ? t.orgEditUserSuccess || "Data pengguna berhasil diperbarui!"
          : t.orgCreateUserSuccess || "Pengguna baru berhasil didaftarkan!";
      },
      error: (err: any) => {
        setSubmittingStaff(false);
        loadSubDetails();
        return (
          err.response?.data?.message ||
          (language === "id" ? "Gagal memproses data pengguna" : "Failed to process user")
        );
      },
    });
  };

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPinStaff || !newPin || newPin.length < 6) {
      toast.error(
        language === "id" ? "PIN baru harus terdiri dari 6 digit angka" : "New PIN must be 6 digits"
      );
      return;
    }

    setSubmittingPin(true);
    setActiveDrawer(null);

    const staffNameSaved = resetPinStaff.name;
    const promise = api.put(
      "/organization/staff/" + resetPinStaff.id + "?business_id=" + business.id,
      { pin: newPin }
    );

    toast.promise(promise, {
      loading: language === "id" ? "Mereset PIN kasir..." : "Resetting cashier PIN...",
      success: () => {
        setSubmittingPin(false);
        setResetPinStaff(null);
        setNewPin("");
        return language === "id"
          ? "PIN untuk " + staffNameSaved + " berhasil direset!"
          : "PIN for " + staffNameSaved + " reset successfully!";
      },
      error: (err: any) => {
        setSubmittingPin(false);
        return (
          err.response?.data?.message ||
          (language === "id" ? "Gagal mereset PIN" : "Failed to reset PIN")
        );
      },
    });
  };

  const handleToggleStaffStatus = async (staff: StaffItem) => {
    const newStatus = staff.status === "active" ? "inactive" : "active";

    setStaffList((prev) =>
      prev.map((s) => (s.id === staff.id ? { ...s, status: newStatus } : s))
    );

    const promise = api.put(
      "/organization/staff/" + staff.id + "?business_id=" + business.id,
      { status: newStatus }
    );

    toast.promise(promise, {
      loading: language === "id" ? "Mengubah status..." : "Updating status...",
      success: () => {
        return (
          (language === "id" ? "Status " : "Status for ") +
          staff.name +
          (language === "id" ? " diubah menjadi " : " changed to ") +
          newStatus.toUpperCase()
        );
      },
      error: (err: any) => {
        setStaffList((prev) =>
          prev.map((s) => (s.id === staff.id ? { ...s, status: staff.status } : s))
        );
        return (
          err.response?.data?.message ||
          (language === "id" ? "Gagal memperbarui status pengguna" : "Failed to update user status")
        );
      },
    });
  };

  // ════════════════════════════════════════════════════════════════
  // DRAG AND DROP REASSIGNMENT LOGIC
  // ════════════════════════════════════════════════════════════════
  const handleDragStart = (e: React.DragEvent, staffId: string) => {
    e.dataTransfer.setData("text/plain", staffId);
    setDraggedStaffId(staffId);
  };

  const handleDragOver = (e: React.DragEvent, outletId: string) => {
    e.preventDefault();
    setDragOverOutletId(outletId);
  };

  const handleDragLeave = () => {
    setDragOverOutletId(null);
  };

  const handleDropStaffOnOutlet = async (e: React.DragEvent, targetOutlet: OutletItem) => {
    e.preventDefault();
    const staffId = e.dataTransfer.getData("text/plain") || draggedStaffId;
    setDraggedStaffId(null);
    setDragOverOutletId(null);

    if (!staffId) return;
    const staff = staffList.find((s) => s.id === staffId);
    if (!staff || staff.outlet_id === targetOutlet.id) return;

    const previousOutletId = staff.outlet_id;
    const previousOutletName = staff.outlet_name;

    setStaffList((prev) =>
      prev.map((s) =>
        s.id === staffId
          ? { ...s, outlet_id: targetOutlet.id, outlet_name: targetOutlet.name }
          : s
      )
    );

    const promise = api.put("/organization/staff/" + staff.id + "?business_id=" + business.id, {
      outlet_id: targetOutlet.id,
    });

    toast.promise(promise, {
      loading: language === "id" ? "Memindahkan penempatan staf..." : "Reassigning staff...",
      success: () => {
        return (
          (t.orgMoveStaffSuccess || "Staf berhasil dipindahkan ke cabang") + " " + targetOutlet.name
        );
      },
      error: (err: any) => {
        setStaffList((prev) =>
          prev.map((s) =>
            s.id === staffId
              ? { ...s, outlet_id: previousOutletId, outlet_name: previousOutletName }
              : s
          )
        );
        return (
          err.response?.data?.message ||
          (language === "id" ? "Gagal memindahkan penempatan staf" : "Failed to move staff")
        );
      },
    });
  };

  const [staffSearchQuery, setStaffSearchQuery] = useState("");

  const filteredStaffList = useMemo(() => {
    if (!staffSearchQuery.trim()) return staffList;
    const q = staffSearchQuery.toLowerCase();
    return staffList.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.phone_or_email.toLowerCase().includes(q) ||
        (s.outlet_name && s.outlet_name.toLowerCase().includes(q)) ||
        s.role.toLowerCase().includes(q)
    );
  }, [staffList, staffSearchQuery]);

  const staffColumns: ColumnDef<StaffItem>[] = useMemo(() => [
    {
      key: "drag",
      label: "",
      width: "w-10",
      renderCell: (s) => (
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, s.id)}
          title={language === "id" ? "Tarik ke kotak cabang di atas untuk memindahkan penempatan" : "Drag to branch card above to reassign"}
          className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
        >
          <GripVertical className="w-4 h-4" />
        </div>
      ),
    },
    {
      key: "user",
      label: language === "id" ? "Pengguna / Kasir" : "User / Cashier",
      renderCell: (s) => (
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, s.id)}
          className="flex items-center gap-3 cursor-grab active:cursor-grabbing"
        >
          <div className={"w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 shadow-xs " + getAvatarBg(s.name)}>
            {getInitials(s.name)}
          </div>
          <div>
            <p className="font-bold text-xs text-slate-900 dark:text-white leading-tight">{s.name}</p>
            <p className="text-[10px] text-slate-400">{s.phone_or_email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      label: language === "id" ? "Peran Akses" : "Role",
      renderCell: (s) => (
        <Badge variant="outline" className="capitalize text-[10px] font-bold rounded-full">
          {s.role === "admin_gudang" ? "Admin Gudang" : s.role === "staff" ? "Staff Kasir" : s.role}
        </Badge>
      ),
    },
    {
      key: "outlet",
      label: language === "id" ? "Cabang Penempatan" : "Assigned Branch",
      renderCell: (s) => (
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {s.outlet_name || "Outlet Pusat"}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      renderCell: (s) => (
        <Badge
          variant="outline"
          className={"text-[10px] font-bold rounded-full " + (
            s.status === "active"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40"
              : "bg-slate-100 dark:bg-slate-800 text-slate-400"
          )}
        >
          {s.status.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: "action",
      label: language === "id" ? "Aksi" : "Actions",
      align: "right",
      renderCell: (s) => (
        <DropdownMenu>
          <DropdownMenuTrigger className="h-7 w-7 p-0 rounded-full inline-flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer outline-none">
            <MoreVertical className="w-3.5 h-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-2xl w-48">
            <DropdownMenuItem
              onClick={() => handleOpenEditStaff(s)}
              className="text-xs font-bold gap-2 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-blue-500" />
              <span>{t.orgEditUser || "Edit Data Pengguna"}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setResetPinStaff(s);
                setNewPin("");
                setActiveDrawer("reset_pin");
              }}
              className="text-xs font-bold gap-2 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-primary" />
              <span>Reset PIN Kasir</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleToggleStaffStatus(s)}
              className={"text-xs font-bold gap-2 cursor-pointer " + (
                s.status === "active" ? "text-rose-500" : "text-emerald-500"
              )}
            >
              {s.status === "active" ? (
                <>
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Non-aktifkan Akun</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Aktifkan Akun</span>
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], [language, t, outlets]);

  return (
    <div className="w-full space-y-8">
      {/* ── SECTION 1: MODULAR CAPABILITY OVERVIEW & DOMAIN KNOWLEDGE HUB ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-500" />
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {language === "id" ? "1. Status Kapabilitas Modul" : "1. Active Capability Flags"}
            </h4>

            {/* Centralized Architecture Guide Hub */}
            <Popover>
              <PopoverTrigger className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer p-1 rounded-full outline-none flex items-center gap-1 text-[11px] font-bold bg-slate-100 dark:bg-white/5 px-2 py-0.5 ml-1">
                <BookOpen className="w-3 h-3 text-primary" />
                <span>{language === "id" ? "Panduan Arsitektur" : "Architecture Guide"}</span>
              </PopoverTrigger>
              <PopoverContent className="w-80 sm:w-96 p-4 text-xs space-y-3 rounded-2xl shadow-xl">
                <div className="flex items-start gap-2.5 border-b border-slate-100 dark:border-[#2A2A30] pb-2.5">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Info className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-extrabold text-slate-900 dark:text-white">
                      {t.orgDomainHubTitle || "Pusat Panduan & Arsitektur Modul"}
                    </h5>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {t.orgDomainHubDesc || "Dampak aktivasi kapabilitas terhadap double-entry inventory ledger & alur kasir."}
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5 text-[11px]">
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mb-0.5">
                      <ShoppingCart className="w-3 h-3" /> Point of Sale (POS)
                    </span>
                    <p className="text-slate-500 dark:text-slate-300 leading-snug">{t.orgPosHelp}</p>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 mb-0.5">
                      <Layers className="w-3 h-3" /> Pabrikasi BOM & Resep
                    </span>
                    <p className="text-slate-500 dark:text-slate-300 leading-snug">{t.orgMfgHelp}</p>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                    <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 mb-0.5">
                      <Send className="w-3 h-3" /> Logistics & Transfer Hub
                    </span>
                    <p className="text-slate-500 dark:text-slate-300 leading-snug">{t.orgHubHelp}</p>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                    <span className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mb-0.5">
                      <Flame className="w-3 h-3" /> Pemakaian Bahan (EOD)
                    </span>
                    <p className="text-slate-500 dark:text-slate-300 leading-snug">{t.orgEodHelp}</p>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleOpenEditProfile}
              variant="outline"
              className="rounded-full font-bold text-xs h-8 px-3.5 gap-1.5 shadow-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 border-slate-200/80 dark:border-[#2E2E34] text-slate-800 dark:text-slate-200"
            >
              <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
              <span>{language === "id" ? "Edit Bisnis" : "Edit Business"}</span>
            </Button>
          </div>
        </div>

        {/* Business Contact & Tax Information Quick Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50/80 dark:bg-white/5 border border-slate-200/60 dark:border-[#2A2A30] text-xs text-slate-600 dark:text-slate-300">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-1">
              {language === "id" ? "Info Resmi Bisnis:" : "Official Business Info:"}
            </span>

            {currentBiz.phone ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#38383C] text-[11px] font-semibold text-slate-800 dark:text-slate-200 shadow-2xs">
                <Phone className="w-3 h-3 text-emerald-500" />
                <span>{currentBiz.phone}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-dashed border-slate-300 dark:border-slate-700 text-[10px] text-slate-400 italic">
                <Phone className="w-2.5 h-2.5 text-slate-400" />
                <span>{language === "id" ? "No. Telepon belum diisi" : "No phone registered"}</span>
              </span>
            )}

            {currentBiz.email ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#38383C] text-[11px] font-semibold text-slate-800 dark:text-slate-200 shadow-2xs">
                <Mail className="w-3 h-3 text-blue-500" />
                <span>{currentBiz.email}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-dashed border-slate-300 dark:border-slate-700 text-[10px] text-slate-400 italic">
                <Mail className="w-2.5 h-2.5 text-slate-400" />
                <span>{language === "id" ? "Email belum diisi" : "No email registered"}</span>
              </span>
            )}

            {currentBiz.tax_id ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#38383C] text-[11px] font-semibold text-slate-800 dark:text-slate-200 shadow-2xs">
                <FileText className="w-3 h-3 text-amber-500" />
                <span>NPWP: {currentBiz.tax_id}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-dashed border-slate-300 dark:border-slate-700 text-[10px] text-slate-400 italic">
                <FileText className="w-2.5 h-2.5 text-slate-400" />
                <span>{language === "id" ? "NPWP non-PKP / Kosong" : "No Tax ID registered"}</span>
              </span>
            )}

            {currentBiz.tax_rate_pct !== undefined && currentBiz.tax_rate_pct > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#38383C] text-[11px] font-semibold text-slate-800 dark:text-slate-200 shadow-2xs">
                <span className="text-[10px] font-black text-rose-500">%</span>
                <span>Pajak: {currentBiz.tax_rate_pct}%</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-dashed border-slate-300 dark:border-slate-700 text-[10px] text-slate-400 italic">
                <span className="text-[10px] font-bold text-slate-400">%</span>
                <span>Pajak: 0%</span>
              </span>
            )}
          </div>


        </div>

        {/* Read-Only Status Badges Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className={"p-3.5 rounded-2xl border flex items-center justify-between transition-all " + (
            business.has_pos
              ? "bg-white dark:bg-[#1E1E22] border-emerald-200 dark:border-emerald-800/40 shadow-xs"
              : "bg-slate-100/60 dark:bg-[#18181B] border-dashed border-slate-200 dark:border-slate-800 opacity-60"
          )}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={"w-8 h-8 rounded-xl flex items-center justify-center shrink-0 " + (business.has_pos ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-200 dark:bg-slate-800 text-slate-400")}>
                <ShoppingCart className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">POS Kasir</span>
            </div>
            <Badge variant={business.has_pos ? "default" : "secondary"} className={"text-[9px] font-bold rounded-full " + (business.has_pos ? "bg-emerald-500 text-white" : "")}>
              {business.has_pos ? "Aktif" : "Mati"}
            </Badge>
          </div>

          <div className={"p-3.5 rounded-2xl border flex items-center justify-between transition-all " + (
            business.has_manufacturing
              ? "bg-white dark:bg-[#1E1E22] border-indigo-200 dark:border-indigo-800/40 shadow-xs"
              : "bg-slate-100/60 dark:bg-[#18181B] border-dashed border-slate-200 dark:border-slate-800 opacity-60"
          )}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={"w-8 h-8 rounded-xl flex items-center justify-center shrink-0 " + (business.has_manufacturing ? "bg-indigo-500/10 text-indigo-500" : "bg-slate-200 dark:bg-slate-800 text-slate-400")}>
                <Layers className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">Pabrikasi BOM</span>
            </div>
            <Badge variant={business.has_manufacturing ? "default" : "secondary"} className={"text-[9px] font-bold rounded-full " + (business.has_manufacturing ? "bg-indigo-500 text-white" : "")}>
              {business.has_manufacturing ? "Aktif" : "Mati"}
            </Badge>
          </div>

          <div className={"p-3.5 rounded-2xl border flex items-center justify-between transition-all " + (
            business.has_logistics_hub
              ? "bg-white dark:bg-[#1E1E22] border-blue-200 dark:border-blue-800/40 shadow-xs"
              : "bg-slate-100/60 dark:bg-[#18181B] border-dashed border-slate-200 dark:border-slate-800 opacity-60"
          )}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={"w-8 h-8 rounded-xl flex items-center justify-center shrink-0 " + (business.has_logistics_hub ? "bg-blue-500/10 text-blue-500" : "bg-slate-200 dark:bg-slate-800 text-slate-400")}>
                <Send className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">Logistik Hub</span>
            </div>
            <Badge variant={business.has_logistics_hub ? "default" : "secondary"} className={"text-[9px] font-bold rounded-full " + (business.has_logistics_hub ? "bg-blue-500 text-white" : "")}>
              {business.has_logistics_hub ? "Aktif" : "Mati"}
            </Badge>
          </div>

          <div className={"p-3.5 rounded-2xl border flex items-center justify-between transition-all " + (
            business.has_eod_usage
              ? "bg-white dark:bg-[#1E1E22] border-rose-200 dark:border-rose-800/40 shadow-xs"
              : "bg-slate-100/60 dark:bg-[#18181B] border-dashed border-slate-200 dark:border-slate-800 opacity-60"
          )}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={"w-8 h-8 rounded-xl flex items-center justify-center shrink-0 " + (business.has_eod_usage ? "bg-rose-500/10 text-rose-500" : "bg-slate-200 dark:bg-slate-800 text-slate-400")}>
                <Flame className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">Pemakaian EOD</span>
            </div>
            <Badge variant={business.has_eod_usage ? "default" : "secondary"} className={"text-[9px] font-bold rounded-full " + (business.has_eod_usage ? "bg-rose-500 text-white" : "")}>
              {business.has_eod_usage ? "Aktif" : "Mati"}
            </Badge>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: PHYSICAL BRANCHES & DROP ZONES ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-500" />
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {language === "id" ? "2. Cabang & Penempatan Staf" : "2. Branches & Assigned Staff"} ({outlets.length})
            </h4>
          </div>
          <Button
            onClick={() => {
              setOutletName("");
              setOutletAddress("");
              setActiveDrawer("add_outlet");
            }}
            className="rounded-full bg-[#E2FF66] hover:bg-[#D5F54E] text-slate-900 font-bold text-xs h-8 px-3.5 gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.orgAddBranch || "Tambah Cabang"}</span>
          </Button>
        </div>

        {loadingDetails ? (
          <div className="p-6 text-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto mb-1" />
            <p className="text-xs text-slate-400">Memuat cabang & profil staf...</p>
          </div>
        ) : outlets.length === 0 ? (
          <div className="p-5 text-center rounded-2xl bg-white dark:bg-[#1E1E22] border border-slate-200/80 dark:border-[#2E2E34]">
            <p className="text-xs text-slate-500">{t.orgNoBranches || "Belum ada cabang terdaftar."}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {outlets.map((o) => {
              const branchStaff = staffList.filter((s) => s.outlet_id === o.id);
              const isDropTarget = dragOverOutletId === o.id;

              return (
                <div
                  key={o.id}
                  onDragOver={(e) => handleDragOver(e, o.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDropStaffOnOutlet(e, o)}
                  className={"p-4 rounded-2xl border transition-all flex flex-col justify-between " + (
                    isDropTarget
                      ? "bg-primary/10 border-primary shadow-md scale-[1.02] ring-2 ring-primary/30"
                      : "bg-white dark:bg-[#1E1E22] border-slate-200/80 dark:border-[#2E2E34] hover:border-slate-300 dark:hover:border-slate-700 shadow-xs"
                  )}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                          <BranchIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h5 className="font-extrabold text-xs text-slate-900 dark:text-white leading-tight truncate">
                            {o.name}
                          </h5>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            {o.address || "Lokasi operasional"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="outline" className="text-[9px] font-mono px-2 py-0.5 rounded-full shrink-0">
                          {branchStaff.length} Staf
                        </Badge>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditOutlet(o);
                          }}
                          className="w-6 h-6 rounded-full inline-flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                          title={language === "id" ? "Edit Data Cabang" : "Edit Branch"}
                        >
                          <Edit3 className="w-3 h-3 text-slate-500" />
                        </button>
                      </div>
                    </div>

                    {/* Branch Phone & Receipt Footer Badges */}
                    {(o.phone || o.receipt_footer) && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-[#2A2A30]/60 space-y-1">
                        {o.phone && (
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                            <Phone className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                            <span className="truncate">{o.phone}</span>
                          </div>
                        )}
                        {o.receipt_footer && (
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 italic">
                            <Receipt className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
                            <span className="truncate">"{o.receipt_footer}"</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* OVERLAPPING AVATAR STACK */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#2A2A30]/80">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Tim Cabang:
                        </span>

                        {branchStaff.length > 0 ? (
                          <div className="flex items-center -space-x-2 overflow-hidden py-0.5">
                            {branchStaff.slice(0, 4).map((staffMember) => (
                              <div
                                key={staffMember.id}
                                title={staffMember.name + " (" + staffMember.role + ")"}
                                className={"inline-flex items-center justify-center w-6 h-6 rounded-full text-[9px] font-black ring-2 ring-white dark:ring-[#1E1E22] shadow-xs cursor-pointer " + getAvatarBg(staffMember.name)}
                              >
                                {getInitials(staffMember.name)}
                              </div>
                            ))}
                            {branchStaff.length > 4 && (
                              <div className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[9px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 ring-2 ring-white dark:ring-[#1E1E22]">
                                +{branchStaff.length - 4}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] italic text-slate-400">Kosong</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Drop Zone Visual Hint */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-[#2A2A30] flex items-center justify-between text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <ArrowRightLeft className={"w-3 h-3 " + (isDropTarget ? "text-primary animate-pulse" : "text-slate-400")} />
                      <span className={isDropTarget ? "font-bold text-primary" : ""}>
                        {isDropTarget ? "Lepas untuk pindahkan staf" : "Drop staf di sini"}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── SECTION 3: STAFF & USERS DIRECTORY ── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-500" />
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                {language === "id" ? "3. Manajemen Pengguna & Kasir" : "3. Users & Cashiers Directory"} ({staffList.length})
              </h4>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {t.orgDragUserHint || "Tarik (Drag) staf ke kotak cabang di atas untuk memindahkan penempatan kerja secara langsung."}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {staffList.length > 5 && (
              <div className="w-48 sm:w-60">
                <ErpSearchBar
                  value={staffSearchQuery}
                  onChange={setStaffSearchQuery}
                  placeholder={language === "id" ? "Cari staf..." : "Search staff..."}
                  size="sm"
                />
              </div>
            )}

            <Button
              onClick={handleOpenAddStaff}
              className="rounded-full bg-[#E2FF66] hover:bg-[#D5F54E] text-slate-900 font-bold text-xs h-8 px-3.5 gap-1.5 shadow-sm cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.orgAddUser || "Tambah Pengguna"}</span>
            </Button>
          </div>
        </div>

        <ErpDataTable<StaffItem>
          data={filteredStaffList}
          columns={staffColumns}
          keyExtractor={(s) => s.id}
          loading={loadingDetails}
          emptyText={t.orgNoStaff || "Belum ada staf terdaftar pada unit bisnis ini."}
          renderMobileItem={(s) => (
            <div
              draggable
              onDragStart={(e) => handleDragStart(e, s.id)}
              className="p-4 bg-white dark:bg-[#1E1E22] rounded-2xl border border-slate-200/80 dark:border-[#2E2E34] space-y-3 shadow-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className={"w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0 " + getAvatarBg(s.name)}>
                    {getInitials(s.name)}
                  </div>
                  <div>
                    <h5 className="font-extrabold text-xs text-slate-900 dark:text-white leading-tight">{s.name}</h5>
                    <p className="text-[10px] text-slate-400 mt-0.5">{s.phone_or_email}</p>
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className={"text-[9px] font-bold rounded-full " + (
                    s.status === "active"
                      ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                      : "bg-slate-100 text-slate-400"
                  )}
                >
                  {s.status.toUpperCase()}
                </Badge>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-[#2E2E34] text-xs">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <MapPin className="w-3 h-3 text-blue-500" />
                  <span className="text-[11px] font-semibold">{s.outlet_name || "Pusat"}</span>
                </div>

                <Badge variant="outline" className="text-[9px] font-bold rounded-full capitalize">
                  {s.role}
                </Badge>
              </div>
            </div>
          )}
        />
      </div>



      {/* ════════════════════════════════════════════════════════════════
          DRAWER 1: ADD OUTLET
      ════════════════════════════════════════════════════════════════ */}
      <Drawer
        direction="right"
        open={activeDrawer === "add_outlet"}
        onOpenChange={(open) => !open && setActiveDrawer(null)}
      >
        <DrawerContent className="w-full sm:w-[420px]">
          <form onSubmit={handleCreateOutlet} className="flex flex-col h-full justify-between">
            <div>
              <DrawerHeader className="border-b border-slate-100 dark:border-[#2A2A30] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                    <BranchIcon className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <DrawerTitle className="text-base font-black text-slate-900 dark:text-white">
                      {t.orgAddBranch || "Tambah Cabang Baru"}
                    </DrawerTitle>
                    <DrawerDescription className="text-xs text-slate-400 mt-0.5">
                      Daftarkan cabang fisik / titik kasir baru untuk {business.name}.
                    </DrawerDescription>
                  </div>
                </div>
              </DrawerHeader>

              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t.orgBranchName || "Nama Cabang"} <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    value={outletName}
                    onChange={(e) => setOutletName(e.target.value)}
                    placeholder="Contoh: Cabang Boulevard / Gerobak 02"
                    required
                    className="h-10 rounded-xl text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t.orgBranchAddress || "Alamat / Lokasi Operasional"}
                  </Label>
                  <Input
                    value={outletAddress}
                    onChange={(e) => setOutletAddress(e.target.value)}
                    placeholder="Contoh: Jl. Sudirman No. 12"
                    className="h-10 rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>

            <DrawerFooter className="p-6 border-t border-slate-100 dark:border-[#2A2A30] flex flex-row gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveDrawer(null)}
                className="flex-1 rounded-full text-xs h-10 cursor-pointer"
              >
                {t.cancel || "Batal"}
              </Button>
              <Button
                type="submit"
                disabled={submittingOutlet}
                className="flex-1 rounded-full bg-[#E2FF66] hover:bg-[#D5F54E] text-slate-900 font-bold text-xs h-10 gap-1.5 cursor-pointer"
              >
                {submittingOutlet ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>{t.save || "Simpan Cabang"}</span>
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>

      {/* ════════════════════════════════════════════════════════════════
          DRAWER 2: ADD / EDIT STAFF
      ════════════════════════════════════════════════════════════════ */}
      <Drawer
        direction="right"
        open={activeDrawer === "add_staff" || activeDrawer === "edit_staff"}
        onOpenChange={(open) => !open && setActiveDrawer(null)}
      >
        <DrawerContent className="w-full sm:w-[480px]">
          <form onSubmit={handleSaveStaff} className="flex flex-col h-full justify-between">
            <div className="overflow-y-auto">
              <DrawerHeader className="border-b border-slate-100 dark:border-[#2A2A30] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <DrawerTitle className="text-base font-black text-slate-900 dark:text-white">
                      {editingStaff ? (t.orgEditUser || "Edit Data Pengguna") : (t.orgAddUser || "Tambah Pengguna Baru")}
                    </DrawerTitle>
                    <DrawerDescription className="text-xs text-slate-400 mt-0.5">
                      {editingStaff
                        ? "Ubah data akun, hak akses, atau cabang penempatan."
                        : "Daftarkan akun staf atau kasir untuk unit usaha " + business.name}
                    </DrawerDescription>
                  </div>
                </div>
              </DrawerHeader>

              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {language === "id" ? "Nama Lengkap Staf" : "Full Name"} <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    placeholder="Contoh: Budi Santoso"
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
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    placeholder="budi.kasir@gmail.com"
                    required
                    className="h-10 rounded-xl text-xs"
                  />
                  {!isGmail(staffEmail) && staffEmail.length > 0 && (
                    <p className="text-[10px] text-rose-500 flex items-center gap-1 mt-1">
                      <ShieldAlert className="w-3 h-3" />
                      <span>{language === "id" ? "Wajib menggunakan akun @gmail.com" : "Must use @gmail.com account"}</span>
                    </p>
                  )}
                </div>

                {/* ROLE SELECTION VIA RADIO BUTTON CARDS */}
                <div className="space-y-2 pt-1">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t.orgRoleLabel || "Peran & Hak Akses"} <span className="text-rose-500">*</span>
                  </Label>
                  <div className="grid grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setStaffRole("staff")}
                      className={"p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer " + (
                        staffRole === "staff"
                          ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary"
                          : "bg-white dark:bg-[#202024] border-slate-200/80 dark:border-[#2E2E34] hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <ShoppingCart className={"w-4 h-4 " + (staffRole === "staff" ? "text-primary" : "text-slate-400")} />
                        <span className={"w-3 h-3 rounded-full border flex items-center justify-center " + (staffRole === "staff" ? "border-primary bg-primary" : "border-slate-300")}>
                          {staffRole === "staff" && <span className="w-1.5 h-1.5 rounded-full bg-slate-900"></span>}
                        </span>
                      </div>
                      <span className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                        {t.orgRoleStaff || "Staff Kasir"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStaffRole("manager")}
                      className={"p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer " + (
                        staffRole === "manager"
                          ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary"
                          : "bg-white dark:bg-[#202024] border-slate-200/80 dark:border-[#2E2E34] hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <UserCheck className={"w-4 h-4 " + (staffRole === "manager" ? "text-primary" : "text-slate-400")} />
                        <span className={"w-3 h-3 rounded-full border flex items-center justify-center " + (staffRole === "manager" ? "border-primary bg-primary" : "border-slate-300")}>
                          {staffRole === "manager" && <span className="w-1.5 h-1.5 rounded-full bg-slate-900"></span>}
                        </span>
                      </div>
                      <span className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                        {t.orgRoleManager || "Manager"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStaffRole("admin_gudang")}
                      className={"p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer " + (
                        staffRole === "admin_gudang"
                          ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary"
                          : "bg-white dark:bg-[#202024] border-slate-200/80 dark:border-[#2E2E34] hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Layers className={"w-4 h-4 " + (staffRole === "admin_gudang" ? "text-primary" : "text-slate-400")} />
                        <span className={"w-3 h-3 rounded-full border flex items-center justify-center " + (staffRole === "admin_gudang" ? "border-primary bg-primary" : "border-slate-300")}>
                          {staffRole === "admin_gudang" && <span className="w-1.5 h-1.5 rounded-full bg-slate-900"></span>}
                        </span>
                      </div>
                      <span className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                        {t.orgRoleAdminGudang || "Gudang"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* BRANCH PLACEMENT VIA RADIO BUTTON CARDS */}
                <div className="space-y-2 pt-1">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t.orgSelectOutlet || "Cabang Penempatan Kerja"} <span className="text-rose-500">*</span>
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                    {outlets.map((o) => {
                      const isSelected = staffOutletId === o.id;
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => setStaffOutletId(o.id)}
                          className={"p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer " + (
                            isSelected
                              ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary"
                              : "bg-white dark:bg-[#202024] border-slate-200/80 dark:border-[#2E2E34] hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <BranchIcon className={"w-4 h-4 shrink-0 " + (isSelected ? "text-primary" : "text-slate-400")} />
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-slate-900 dark:text-white truncate">{o.name}</p>
                              <p className="text-[10px] text-slate-400 truncate">{o.address || "Cabang aktif"}</p>
                            </div>
                          </div>
                          <span className={"w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ml-2 " + (isSelected ? "border-primary bg-primary" : "border-slate-300")}>
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-slate-900"></span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* PIN KASIR */}
                <div className="space-y-2 pt-1">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {editingStaff ? "Ganti PIN Kasir (Opsional 6-Digit)" : "PIN Kasir / Otorisasi 6-Digit *"}
                  </Label>
                  <div className="flex justify-center py-2 bg-slate-50 dark:bg-white/[0.02] rounded-2xl border border-slate-200/80 dark:border-[#2E2E34]">
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
              </div>
            </div>

            <DrawerFooter className="p-6 border-t border-slate-100 dark:border-[#2A2A30] flex flex-row gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveDrawer(null)}
                className="flex-1 rounded-full text-xs h-10 cursor-pointer"
              >
                {t.cancel || "Batal"}
              </Button>
              <Button
                type="submit"
                disabled={submittingStaff}
                className="flex-1 rounded-full bg-[#E2FF66] hover:bg-[#D5F54E] text-slate-900 font-bold text-xs h-10 gap-1.5 cursor-pointer"
              >
                {submittingStaff ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                <span>{editingStaff ? (t.save || "Simpan Perubahan") : (t.save || "Daftarkan Pengguna")}</span>
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>

      {/* ════════════════════════════════════════════════════════════════
          DRAWER 3: RESET PIN KASIR
      ════════════════════════════════════════════════════════════════ */}
      <Drawer
        direction="right"
        open={activeDrawer === "reset_pin"}
        onOpenChange={(open) => !open && setActiveDrawer(null)}
      >
        <DrawerContent className="w-full sm:w-[420px]">
          <form onSubmit={handleResetPin} className="flex flex-col h-full justify-between">
            <div>
              <DrawerHeader className="border-b border-slate-100 dark:border-[#2A2A30] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <DrawerTitle className="text-base font-black text-slate-900 dark:text-white">
                      Reset PIN Kasir 6-Digit
                    </DrawerTitle>
                    <DrawerDescription className="text-xs text-slate-400 mt-0.5">
                      Masukkan 6-digit PIN baru untuk akun <span className="font-bold text-slate-900 dark:text-white">{resetPinStaff?.name}</span>.
                    </DrawerDescription>
                  </div>
                </div>
              </DrawerHeader>

              <div className="p-6 space-y-4">
                <div className="flex justify-center py-4">
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
              </div>
            </div>

            <DrawerFooter className="p-6 border-t border-slate-100 dark:border-[#2A2A30] flex flex-row gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveDrawer(null)}
                className="flex-1 rounded-full text-xs h-10 cursor-pointer"
              >
                {t.cancel || "Batal"}
              </Button>
              <Button
                type="submit"
                disabled={submittingPin}
                className="flex-1 rounded-full bg-[#E2FF66] hover:bg-[#D5F54E] text-slate-900 font-bold text-xs h-10 gap-1.5 cursor-pointer"
              >
                {submittingPin ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Simpan PIN Baru</span>
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>

      {/* ════════════════════════════════════════════════════════════════
          DRAWER: UNIFIED BUSINESS SETTINGS (PROFILE + CAPABILITIES)
      ════════════════════════════════════════════════════════════════ */}
      <Drawer
        direction="right"
        open={activeDrawer === "edit_profile"}
        onOpenChange={(open) => !open && setActiveDrawer(null)}
      >
        <DrawerContent className="w-full sm:w-[500px] md:w-[540px]">
          <form onSubmit={handleSaveProfile} className="flex flex-col h-full justify-between">
            <div className="overflow-y-auto">
              <DrawerHeader className="border-b border-slate-100 dark:border-[#2A2A30] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
                    <SlidersHorizontal className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <DrawerTitle className="text-base font-black text-slate-900 dark:text-white">
                      {language === "id" ? "Pengaturan Unit Bisnis" : "Business Settings"}
                    </DrawerTitle>
                    <DrawerDescription className="text-xs text-slate-400 mt-0.5">
                      {language === "id" 
                        ? "Kelola identitas resmi, legalitas pajak, dan kapabilitas modul dalam satu panel." 
                        : "Manage official identity, tax details, and module capabilities in one place."}
                    </DrawerDescription>
                  </div>
                </div>
              </DrawerHeader>

              <div className="p-6 space-y-6">
                {/* ── SUBSECTION A: IDENTITAS & KONTAK RESMI ── */}
                <div className="space-y-3.5">
                  <div className="flex items-center gap-2 pb-1 border-b border-slate-100 dark:border-[#2A2A30]">
                    <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      {language === "id" ? "A. Identitas & Kontak Resmi" : "A. Identity & Contact"}
                    </h5>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === "id" ? "Nama Brand / Unit Bisnis" : "Brand Name"} <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      value={bizProfileName}
                      onChange={(e) => setBizProfileName(e.target.value)}
                      required
                      className="h-10 rounded-xl text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {language === "id" ? "Telepon / WA CS" : "Phone / WA"}
                      </Label>
                      <Input
                        value={bizProfilePhone}
                        onChange={(e) => setBizProfilePhone(e.target.value)}
                        placeholder="0812-3456-7890"
                        className="h-10 rounded-xl text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {language === "id" ? "Email Resmi" : "Official Email"}
                      </Label>
                      <Input
                        type="email"
                        value={bizProfileEmail}
                        onChange={(e) => setBizProfileEmail(e.target.value)}
                        placeholder="cs@brand.com"
                        className="h-10 rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {language === "id" ? "NPWP / Tax ID" : "Tax ID / NPWP"}
                      </Label>
                      <Input
                        value={bizProfileTaxId}
                        onChange={(e) => setBizProfileTaxId(e.target.value)}
                        placeholder="01.234.567.8-999.000"
                        className="h-10 rounded-xl text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {language === "id" ? "Tarif Pajak POS (%)" : "Tax Rate (%)"}
                      </Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={bizProfileTaxRate}
                        onChange={(e) => setBizProfileTaxRate(parseFloat(e.target.value) || 0)}
                        placeholder="0 atau 10"
                        className="h-10 rounded-xl text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* ── SUBSECTION B: KAPABILITAS MODUL (THE LEAN ODOO WAY) ── */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 pb-1 border-b border-slate-100 dark:border-[#2A2A30]">
                    <Sliders className="w-3.5 h-3.5 text-emerald-500" />
                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      {language === "id" ? "B. Kapabilitas Modul Bisnis" : "B. Module Capabilities"}
                    </h5>
                  </div>

                  <div className="space-y-2.5">
                    <div className="p-3 rounded-2xl border border-slate-200/80 dark:border-[#2E2E34] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                          <ShoppingCart className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <h6 className="text-xs font-bold text-slate-900 dark:text-white">Point of Sale (POS Kasir)</h6>
                          <p className="text-[10px] text-slate-400 leading-tight">Antarmuka kasir penjualan & shift kerja.</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={hasPos}
                        onChange={(e) => setHasPos(e.target.checked)}
                        className="w-4 h-4 rounded text-primary accent-[#E2FF66] cursor-pointer shrink-0"
                      />
                    </div>

                    <div className="p-3 rounded-2xl border border-slate-200/80 dark:border-[#2E2E34] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
                          <Layers className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <h6 className="text-xs font-bold text-slate-900 dark:text-white">Pabrikasi BOM & Resep</h6>
                          <p className="text-[10px] text-slate-400 leading-tight">Formula batch produksi & deduksi bahan.</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={hasMfg}
                        onChange={(e) => setHasMfg(e.target.checked)}
                        className="w-4 h-4 rounded text-primary accent-[#E2FF66] cursor-pointer shrink-0"
                      />
                    </div>

                    <div className="p-3 rounded-2xl border border-slate-200/80 dark:border-[#2E2E34] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                          <Send className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <h6 className="text-xs font-bold text-slate-900 dark:text-white">Logistics & Transfer Hub</h6>
                          <p className="text-[10px] text-slate-400 leading-tight">Surat jalan & transfer stok antar cabang.</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={hasHub}
                        onChange={(e) => setHasHub(e.target.checked)}
                        className="w-4 h-4 rounded text-primary accent-[#E2FF66] cursor-pointer shrink-0"
                      />
                    </div>

                    <div className="p-3 rounded-2xl border border-slate-200/80 dark:border-[#2E2E34] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
                          <Flame className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <h6 className="text-xs font-bold text-slate-900 dark:text-white">Pemakaian Bahan Harian (EOD)</h6>
                          <p className="text-[10px] text-slate-400 leading-tight">Konsumsi bahan curah akhir hari saat tutup shift.</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={hasEod}
                        onChange={(e) => setHasEod(e.target.checked)}
                        className="w-4 h-4 rounded text-primary accent-[#E2FF66] cursor-pointer shrink-0"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DrawerFooter className="p-6 border-t border-slate-100 dark:border-[#2A2A30] flex flex-row gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveDrawer(null)}
                className="flex-1 rounded-full text-xs h-10 cursor-pointer"
              >
                {t.cancel || "Batal"}
              </Button>
              <Button
                type="submit"
                disabled={submittingProfile}
                className="flex-1 rounded-full bg-[#E2FF66] hover:bg-[#D5F54E] text-slate-900 font-bold text-xs h-10 gap-1.5 cursor-pointer"
              >
                {submittingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{t.save || "Simpan Pengaturan"}</span>
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>

      {/* ════════════════════════════════════════════════════════════════
          DRAWER: EDIT OUTLET DETAILS & RECEIPT FOOTER
      ════════════════════════════════════════════════════════════════ */}
      <Drawer
        direction="right"
        open={activeDrawer === "edit_outlet"}
        onOpenChange={(open) => !open && setActiveDrawer(null)}
      >
        <DrawerContent className="w-full sm:w-[460px]">
          <form onSubmit={handleSaveEditOutlet} className="flex flex-col h-full justify-between">
            <div className="overflow-y-auto">
              <DrawerHeader className="border-b border-slate-100 dark:border-[#2A2A30] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                    <BranchIcon className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <DrawerTitle className="text-base font-black text-slate-900 dark:text-white">
                      {language === "id" ? "Edit Data Cabang & Struk" : "Edit Branch Details"}
                    </DrawerTitle>
                    <DrawerDescription className="text-xs text-slate-400 mt-0.5">
                      Perbarui lokasi operasional, nomor telepon cabang, dan catatan footer struk kasir.
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
                    value={editOutletName}
                    onChange={(e) => setEditOutletName(e.target.value)}
                    required
                    className="h-10 rounded-xl text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {language === "id" ? "Alamat Fisik / Lokasi" : "Address"}
                  </Label>
                  <Input
                    value={editOutletAddress}
                    onChange={(e) => setEditOutletAddress(e.target.value)}
                    placeholder="Contoh: Jl. Kaliurang KM 9.3"
                    className="h-10 rounded-xl text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {language === "id" ? "No. Telepon Kasir / Outlet" : "Outlet Contact"}
                  </Label>
                  <Input
                    value={editOutletPhone}
                    onChange={(e) => setEditOutletPhone(e.target.value)}
                    placeholder="Contoh: 0819-8765-4321"
                    className="h-10 rounded-xl text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {language === "id" ? "Catatan Kaki Struk Kasir (Receipt Footer)" : "Receipt Footer"}
                  </Label>
                  <Input
                    value={editOutletReceiptFooter}
                    onChange={(e) => setEditOutletReceiptFooter(e.target.value)}
                    placeholder="Contoh: Terima kasih! Follow IG @baksokanggemoy"
                    className="h-10 rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>

            <DrawerFooter className="p-6 border-t border-slate-100 dark:border-[#2A2A30] flex flex-row gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveDrawer(null)}
                className="flex-1 rounded-full text-xs h-10 cursor-pointer"
              >
                {t.cancel || "Batal"}
              </Button>
              <Button
                type="submit"
                disabled={submittingEditOutlet}
                className="flex-1 rounded-full bg-[#E2FF66] hover:bg-[#D5F54E] text-slate-900 font-bold text-xs h-10 gap-1.5 cursor-pointer"
              >
                {submittingEditOutlet ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{t.save || "Simpan Perubahan"}</span>
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>

    </div>
  );
}
