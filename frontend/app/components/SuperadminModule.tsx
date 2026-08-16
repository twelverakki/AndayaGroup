import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useAuthStore } from "../lib/store";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "./ui/dropdown-menu";
import { 
  Users, 
  UserPlus, 
  Shield, 
  Building, 
  MapPin, 
  Edit, 
  Trash2, 
  Plus, 
  Save, 
  Search, 
  X 
} from "lucide-react";

interface Business {
  id: string;
  name: string;
  type: string;
}

interface Outlet {
  id: string;
  business_id: string;
  name: string;
  address?: string;
}

interface UserAssignmentInfo {
  type: "owner" | "staff";
  business_id?: string;
  business_name?: string;
  outlet_id?: string;
  outlet_name?: string;
  role?: string;
  status?: string;
}

interface UserDetail {
  id: string;
  name: string;
  phone_or_email?: string;
  status: string;
  created_at: string;
  assignments: UserAssignmentInfo[];
}

interface AssignmentInput {
  type: "owner" | "staff";
  business_id?: string;
  outlet_id?: string;
  role?: string;
}

export default function SuperadminModule() {
  const { activeContext } = useAuthStore();

  // Data States
  const [users, setUsers] = useState<UserDetail[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<UserDetail | null>(null);
  const [showAssignmentsModal, setShowAssignmentsModal] = useState<UserDetail | null>(null);

  // Form Inputs - Create User
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createPin, setCreatePin] = useState("");
  const [createStatus, setCreateStatus] = useState("active");
  const [formLoading, setFormLoading] = useState(false);

  // Form Inputs - Edit User
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editStatus, setEditStatus] = useState("");

  // Form Inputs - Manage Assignments
  const [assignmentRows, setAssignmentRows] = useState<AssignmentInput[]>([]);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const usersRes = await api.get("/admin/users");
      setUsers(usersRes.data || []);

      const busRes = await api.get("/admin/businesses");
      setBusinesses(busRes.data || []);

      const outRes = await api.get("/admin/outlets");
      setOutlets(outRes.data || []);
    } catch (err: any) {
      console.error("Failed to fetch superadmin control center data:", err);
      setError("Gagal memuat data kontrol akun superadmin");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeContext]);

  // Create User submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName) {
      setError("Nama user wajib diisi");
      return;
    }
    setFormLoading(true);
    setError("");
    setSuccess("");
    try {
      await api.post("/admin/users", {
        name: createName,
        email: createEmail || undefined,
        password: createPassword || undefined,
        pin: createPin || undefined,
        status: createStatus
      });
      setSuccess("User berhasil dibuat!");
      setShowCreateModal(false);
      // Reset inputs
      setCreateName("");
      setCreateEmail("");
      setCreatePassword("");
      setCreatePin("");
      setCreateStatus("active");
      fetchData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Gagal membuat user baru");
    } finally {
      setFormLoading(false);
    }
  };

  // Edit User submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal || !editName) return;
    setFormLoading(true);
    setError("");
    setSuccess("");
    try {
      await api.put(`/admin/users/${showEditModal.id}`, {
        name: editName,
        email: editEmail || undefined,
        status: editStatus
      });
      setSuccess("Info user berhasil diperbarui!");
      setShowEditModal(null);
      fetchData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Gagal memperbarui user");
    } finally {
      setFormLoading(false);
    }
  };

  // Manage Assignments submit
  const handleAssignmentsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAssignmentsModal) return;
    setFormLoading(true);
    setError("");
    setSuccess("");
    try {
      // Validate assignments
      for (const row of assignmentRows) {
        if (row.type === "staff" && !row.outlet_id) {
          setError("Outlet wajib diisi untuk staff/manager!");
          setFormLoading(false);
          return;
        }
      }

      await api.put(`/admin/users/${showAssignmentsModal.id}/assignments`, {
        assignments: assignmentRows
      });
      setSuccess("Penugasan user berhasil disimpan!");
      setShowAssignmentsModal(null);
      fetchData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Gagal menyimpan penugasan");
    } finally {
      setFormLoading(false);
    }
  };

  // Filtered users list
  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (u.phone_or_email && u.phone_or_email.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === "all" || u.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getBusinessName = (id?: string) => {
    if (!id) return "-";
    const b = businesses.find((b) => b.id === id);
    return b ? b.name : "Varian Bisnis";
  };

  const getOutletName = (id?: string) => {
    if (!id) return "-";
    const o = outlets.find((o) => o.id === id);
    return o ? o.name : "Outlet";
  };

  // Add Assignment row
  const addAssignmentRow = () => {
    setAssignmentRows([
      ...assignmentRows,
      { type: "staff", role: "staff" }
    ]);
  };

  // Remove Assignment row
  const removeAssignmentRow = (index: number) => {
    setAssignmentRows(assignmentRows.filter((_, i) => i !== index));
  };

  // Edit Assignment row
  const updateAssignmentRow = (index: number, updated: Partial<AssignmentInput>) => {
    const updatedRows = [...assignmentRows];
    updatedRows[index] = { ...updatedRows[index], ...updated };
    setAssignmentRows(updatedRows);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Panel */}
      <div className="border border-slate-200 dark:border-slate-800/40 rounded-3xl p-6 bg-white/75 dark:bg-[#202024]/75 backdrop-blur-md shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-500" />
            Pusat Kontrol Akun Superadmin
          </h2>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
            Manajemen user terpusat, pengeditan status status keanggotaan, penugasan role Owner, Manager, dan Staff per outlet.
          </p>
        </div>
        <button
          onClick={() => {
            setError("");
            setShowCreateModal(true);
          }}
          className="bg-[#E2FF66] text-[#2B2B2B] px-5 py-2.5 rounded-full text-xs font-bold hover:shadow-md cursor-pointer flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Tambah User Baru
        </button>
      </div>

      {/* Message feedback */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-750 dark:text-red-400 rounded-2xl text-xs font-bold">
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-emerald-750 dark:text-emerald-400 rounded-2xl text-xs font-bold">
          ✅ {success}
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 bg-slate-100/50 dark:bg-slate-800/25 rounded-2xl border border-slate-200/50 dark:border-slate-800/30">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-450 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari user (nama, email)..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-250 dark:border-slate-850 dark:text-white text-xs bg-white dark:bg-[#202024] focus:outline-none"
          />
        </div>

        <div className="flex gap-2">
          {["all", "active", "inactive", "discontinued"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all cursor-pointer ${
                statusFilter === st
                  ? "bg-[#2B2B2B] text-white dark:bg-[#E2FF66] dark:text-[#2B2B2B]"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-[#202024] dark:border-slate-800 dark:text-slate-350"
              }`}
            >
              {st === "all" ? "Semua Status" : st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Users Table */}
      {loading ? (
        <div className="text-center py-16 text-slate-450 font-bold animate-pulse text-sm">
          Memproses data pusat kontrol akun...
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-800/40 rounded-3xl p-6 bg-white dark:bg-[#202024] shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-[#E7E9ED] dark:bg-[#2E2E34]">
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350 rounded-l-lg">User</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350">Status</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350">Penugasan & Hak Akses</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-350 rounded-r-lg" style={{ width: "240px" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-xs text-slate-450">
                      Tidak ada data user terdaftar.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800/20">
                      <td className="px-4 py-4.5 border-b border-slate-100 dark:border-slate-800/20">
                        <div className="font-bold text-xs dark:text-white leading-tight">{u.name}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">{u.phone_or_email || "No Email/Phone"}</div>
                      </td>
                      <td className="px-4 py-4.5 border-b border-slate-100 dark:border-slate-800/20">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] uppercase font-bold ${
                          u.status === "active"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                            : u.status === "inactive"
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
                              : "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400"
                        }`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-4 py-4.5 border-b border-slate-100 dark:border-slate-800/20 space-y-1">
                        {u.assignments.length === 0 ? (
                          <span className="text-[10px] text-muted-foreground font-semibold">Tunggal (Belum ditugaskan)</span>
                        ) : (
                          u.assignments.map((a, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-[10px] font-semibold dark:text-slate-300">
                              <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase font-bold ${
                                a.type === "owner" ? "bg-purple-100 text-purple-700 dark:bg-purple-950/25 dark:text-purple-400" : "bg-blue-100 text-blue-700 dark:bg-blue-950/25 dark:text-blue-400"
                              }`}>
                                {a.type === "owner" ? "Owner" : a.role}
                              </span>
                              <span>
                                {a.type === "owner" 
                                  ? (a.business_id ? getBusinessName(a.business_id) : getOutletName(a.outlet_id))
                                  : `${getBusinessName(a.business_id)} ➔ ${getOutletName(a.outlet_id)}`}
                              </span>
                            </div>
                          ))
                        )}
                      </td>
                      <td className="px-4 py-4.5 border-b border-slate-100 dark:border-slate-800/20 text-right space-x-1.5">
                        <button
                          onClick={() => {
                            setError("");
                            setEditName(u.name);
                            setEditEmail(u.phone_or_email || "");
                            setEditStatus(u.status);
                            setShowEditModal(u);
                          }}
                          className="bg-slate-100 dark:bg-[#2F2F33] hover:bg-slate-200 dark:hover:bg-[#3F3F45] p-2 rounded-full cursor-pointer transition-colors inline-flex items-center"
                          title="Edit Info User"
                        >
                          <Edit className="w-3.5 h-3.5 text-slate-600 dark:text-slate-350" />
                        </button>
                        <button
                          onClick={() => {
                            setError("");
                            // Map existing assignments to input form
                            const mapped = u.assignments.map((a) => ({
                              type: a.type,
                              business_id: a.business_id,
                              outlet_id: a.outlet_id,
                              role: a.role
                            }));
                            setAssignmentRows(mapped);
                            setShowAssignmentsModal(u);
                          }}
                          className="bg-indigo-50 dark:bg-indigo-950/20 hover:bg-indigo-100 dark:hover:bg-indigo-950/30 text-indigo-650 dark:text-indigo-400 px-3.5 py-1.5 rounded-full text-[10px] font-bold cursor-pointer inline-flex items-center gap-1"
                        >
                          <Building className="w-3 h-3" />
                          Atur Akses
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="border border-slate-200 dark:border-slate-800/40 rounded-3xl p-6 bg-white dark:bg-[#202024] shadow-2xl w-full max-w-md relative animate-in fade-in zoom-in-95 duration-200 space-y-4">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
            <h3 className="font-bold text-sm dark:text-white flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-indigo-500" />
              Buat Akun User Baru
            </h3>
            
            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Contoh: Kennan Owner A"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-250 dark:border-slate-850 dark:text-white text-xs font-semibold bg-transparent focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Phone atau Email (Optional)</label>
                <input
                  type="text"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="Contoh: superadmin@andaya.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-250 dark:border-slate-850 dark:text-white text-xs font-semibold bg-transparent focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Password (Optional - untuk login Email)</label>
                <input
                  type="password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="Password123"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-250 dark:border-slate-850 dark:text-white text-xs font-semibold bg-transparent focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">PIN Override (Optional - untuk staff kasir)</label>
                <input
                  type="password"
                  maxLength={6}
                  value={createPin}
                  onChange={(e) => setCreatePin(e.target.value)}
                  placeholder="6 Digit PIN"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-250 dark:border-slate-850 dark:text-white text-xs font-semibold bg-transparent focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Status Awal</label>
                <DropdownMenu>
                  <DropdownMenuTrigger className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-250 dark:border-slate-850 dark:text-white text-xs font-semibold bg-transparent text-left cursor-pointer">
                    {createStatus.toUpperCase()}
                    <span className="text-[10px] opacity-60">▼</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#3A3A3E] shadow-xl rounded-xl p-1 w-56">
                    {["active", "inactive", "discontinued"].map((st) => (
                      <DropdownMenuItem
                        key={st}
                        onClick={() => setCreateStatus(st)}
                        className="text-xs px-3 py-2 cursor-pointer dark:text-white hover:bg-slate-100 dark:hover:bg-[#2B2B2F]"
                      >
                        {st.toUpperCase()}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 border border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-350 text-xs font-bold py-2.5 rounded-full hover:bg-slate-50 dark:hover:bg-[#2B2B2F] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 bg-[#E2FF66] text-[#2B2B2B] font-bold text-xs py-2.5 rounded-full hover:shadow-md cursor-pointer disabled:opacity-50"
                >
                  {formLoading ? "Memproses..." : "Buat User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER INFO MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="border border-slate-200 dark:border-slate-800/40 rounded-3xl p-6 bg-white dark:bg-[#202024] shadow-2xl w-full max-w-md relative animate-in fade-in zoom-in-95 duration-200 space-y-4">
            <button
              onClick={() => setShowEditModal(null)}
              className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
            <h3 className="font-bold text-sm dark:text-white flex items-center gap-2">
              <Edit className="w-4 h-4 text-indigo-500" />
              Edit Info User
            </h3>
            
            <form onSubmit={handleEditSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-250 dark:border-slate-850 dark:text-white text-xs font-semibold bg-transparent focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Phone atau Email</label>
                <input
                  type="text"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-250 dark:border-slate-850 dark:text-white text-xs font-semibold bg-transparent focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Status Keanggotaan</label>
                <DropdownMenu>
                  <DropdownMenuTrigger className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-250 dark:border-slate-850 dark:text-white text-xs font-semibold bg-transparent text-left cursor-pointer">
                    {editStatus.toUpperCase()}
                    <span className="text-[10px] opacity-60">▼</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#3A3A3E] shadow-xl rounded-xl p-1 w-56">
                    {["active", "inactive", "discontinued"].map((st) => (
                      <DropdownMenuItem
                        key={st}
                        onClick={() => setEditStatus(st)}
                        className="text-xs px-3 py-2 cursor-pointer dark:text-white hover:bg-slate-100 dark:hover:bg-[#2B2B2F]"
                      >
                        {st.toUpperCase()}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(null)}
                  className="flex-1 border border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-350 text-xs font-bold py-2.5 rounded-full hover:bg-slate-50 dark:hover:bg-[#2B2B2F] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 bg-[#E2FF66] text-[#2B2B2B] font-bold text-xs py-2.5 rounded-full hover:shadow-md cursor-pointer disabled:opacity-50"
                >
                  {formLoading ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANAGE ASSIGNMENTS (ACCESS CONTROL) MODAL */}
      {showAssignmentsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="border border-slate-200 dark:border-slate-800/40 rounded-3xl p-6 bg-white dark:bg-[#202024] shadow-2xl w-full max-w-2xl relative animate-in fade-in zoom-in-95 duration-200 space-y-4 flex flex-col max-h-[85vh]">
            <button
              onClick={() => setShowAssignmentsModal(null)}
              className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
            <h3 className="font-bold text-sm dark:text-white flex items-center gap-2">
              <Building className="w-4 h-4 text-indigo-500" />
              Atur Akses & Penugasan: {showAssignmentsModal.name}
            </h3>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 min-h-[150px]">
              {assignmentRows.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-450 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  Belum ada penugasan terdaftar untuk user ini. Klik "Tambah Akses" di bawah.
                </div>
              ) : (
                assignmentRows.map((row, index) => (
                  <div 
                    key={index}
                    className="flex flex-col sm:flex-row gap-3 items-start sm:items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-150 dark:border-slate-850 relative group"
                  >
                    {/* Assignment Type Select */}
                    <div className="space-y-1 w-full sm:w-28">
                      <label className="text-[8px] font-bold text-muted-foreground uppercase">Jenis</label>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg border border-slate-250 dark:border-slate-850 dark:text-white text-xs font-semibold bg-transparent text-left cursor-pointer">
                          {row.type === "owner" ? "Owner" : "Staff"}
                          <span className="text-[9px] opacity-60">▼</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#3A3A3E] shadow-xl rounded-xl p-1 w-28">
                          <DropdownMenuItem
                            onClick={() => updateAssignmentRow(index, { type: "owner", outlet_id: undefined })}
                            className="text-xs px-3 py-1.5 cursor-pointer dark:text-white hover:bg-slate-100"
                          >
                            Owner
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateAssignmentRow(index, { type: "staff", role: "staff", business_id: undefined })}
                            className="text-xs px-3 py-1.5 cursor-pointer dark:text-white hover:bg-slate-100"
                          >
                            Staff
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Conditional Target Selects */}
                    {row.type === "owner" ? (
                      // OWNER assignment targets
                      <>
                        <div className="space-y-1 w-full sm:flex-1">
                          <label className="text-[8px] font-bold text-muted-foreground uppercase">Milik Bisnis</label>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg border border-slate-250 dark:border-slate-850 dark:text-white text-xs font-semibold bg-transparent text-left cursor-pointer">
                              {row.business_id ? getBusinessName(row.business_id) : "Pilih Bisnis (Atau Kosong)"}
                              <span className="text-[9px] opacity-60">▼</span>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#3A3A3E] shadow-xl rounded-xl p-1 w-56">
                              <DropdownMenuItem
                                onClick={() => updateAssignmentRow(index, { business_id: undefined })}
                                className="text-xs px-3 py-1.5 cursor-pointer text-red-500 font-bold hover:bg-slate-100"
                              >
                                Kosongkan Bisnis
                              </DropdownMenuItem>
                              {businesses.map((b) => (
                                <DropdownMenuItem
                                  key={b.id}
                                  onClick={() => updateAssignmentRow(index, { business_id: b.id })}
                                  className="text-xs px-3 py-1.5 cursor-pointer dark:text-white hover:bg-slate-100"
                                >
                                  {b.name} ({b.type})
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="space-y-1 w-full sm:flex-1">
                          <label className="text-[8px] font-bold text-muted-foreground uppercase">Milik Outlet (Optional)</label>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg border border-slate-250 dark:border-slate-850 dark:text-white text-xs font-semibold bg-transparent text-left cursor-pointer">
                              {row.outlet_id ? getOutletName(row.outlet_id) : "Pilih Outlet (Atau Kosong)"}
                              <span className="text-[9px] opacity-60">▼</span>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#3A3A3E] shadow-xl rounded-xl p-1 w-56">
                              <DropdownMenuItem
                                onClick={() => updateAssignmentRow(index, { outlet_id: undefined })}
                                className="text-xs px-3 py-1.5 cursor-pointer text-red-500 font-bold hover:bg-slate-100"
                              >
                                Kosongkan Outlet
                              </DropdownMenuItem>
                              {outlets.map((o) => (
                                <DropdownMenuItem
                                  key={o.id}
                                  onClick={() => updateAssignmentRow(index, { outlet_id: o.id })}
                                  className="text-xs px-3 py-1.5 cursor-pointer dark:text-white hover:bg-slate-100"
                                >
                                  {o.name} ({getBusinessName(o.business_id)})
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </>
                    ) : (
                      // STAFF assignment targets
                      <>
                        <div className="space-y-1 w-full sm:flex-1">
                          <label className="text-[8px] font-bold text-muted-foreground uppercase">Penugasan Outlet (Wajib)</label>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg border border-slate-250 dark:border-slate-850 dark:text-white text-xs font-semibold bg-transparent text-left cursor-pointer">
                              {row.outlet_id ? getOutletName(row.outlet_id) : "Pilih Target Outlet"}
                              <span className="text-[9px] opacity-60">▼</span>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#3A3A3E] shadow-xl rounded-xl p-1 w-56 max-h-60 overflow-y-auto">
                              {outlets.map((o) => (
                                <DropdownMenuItem
                                  key={o.id}
                                  onClick={() => updateAssignmentRow(index, { outlet_id: o.id })}
                                  className="text-xs px-3 py-1.5 cursor-pointer dark:text-white hover:bg-slate-100"
                                >
                                  {o.name} ({getBusinessName(o.business_id)})
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="space-y-1 w-full sm:w-36">
                          <label className="text-[8px] font-bold text-muted-foreground uppercase">Role/Hak Akses</label>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg border border-slate-250 dark:border-slate-850 dark:text-white text-xs font-semibold bg-transparent text-left cursor-pointer">
                              {row.role ? row.role.toUpperCase() : "STAFF"}
                              <span className="text-[9px] opacity-60">▼</span>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#3A3A3E] shadow-xl rounded-xl p-1 w-36">
                              {["manager", "admin_gudang", "staff"].map((role) => (
                                <DropdownMenuItem
                                  key={role}
                                  onClick={() => updateAssignmentRow(index, { role })}
                                  className="text-xs px-3 py-1.5 cursor-pointer dark:text-white hover:bg-slate-100"
                                >
                                  {role.toUpperCase()}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </>
                    )}

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => removeAssignmentRow(index)}
                      className="absolute right-3 top-3 sm:relative sm:right-0 sm:top-0 sm:mt-4.5 p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg cursor-pointer flex items-center justify-center shrink-0 transition-colors"
                      title="Hapus Hak Akses"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={addAssignmentRow}
                className="border border-indigo-200 text-indigo-650 dark:border-indigo-900/40 dark:text-indigo-400 font-bold text-xs py-2.5 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-950/20 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Tambah Akses Baru
              </button>

              <div className="flex-1 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAssignmentsModal(null)}
                  className="flex-1 border border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-350 text-xs font-bold py-2.5 rounded-full hover:bg-slate-50 dark:hover:bg-[#2B2B2F] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={handleAssignmentsSubmit}
                  disabled={formLoading}
                  className="flex-1 bg-[#E2FF66] text-[#2B2B2B] font-bold text-xs py-2.5 rounded-full hover:shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {formLoading ? "Menyimpan..." : "Simpan Akses"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
