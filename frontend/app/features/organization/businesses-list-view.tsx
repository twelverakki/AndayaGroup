import React, { useState, useEffect, useMemo } from "react";
import { api } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { useLanguageStore, translations } from "../../lib/i18n";
import { toast } from "../../components/ui/sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { ErpDataTable, type ColumnDef } from "../../components/ErpDataTable";
import { ErpSearchBar } from "../../components/ErpSearchBar";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "../../components/ui/drawer";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "../../components/ui/input-otp";
import {
  Building2,
  ChevronRight,
  Loader2,
  Users,
  Plus,
  ArrowLeft,
  UserCheck,
  Building,
  Mail,
  Store,
  CookingPot,
  Utensils,
  FlameKindling,
  ShieldAlert,
  Search,
} from "lucide-react";
import { BusinessExpandableCard, type BusinessItemData } from "./business-expandable-card";

export interface OwnerHierarchyItem {
  id: string;
  name: string;
  phone_or_email?: string;
  status: string;
  created_at: string;
  businesses: BusinessItemData[];
}

export default function BusinessesListView() {
  const { activeContext } = useAuthStore();
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;

  const isSuperAdmin = activeContext?.role === "superadmin";

  const [owners, setOwners] = useState<OwnerHierarchyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Superadmin Selected Owner (Level 2)
  const [selectedOwner, setSelectedOwner] = useState<OwnerHierarchyItem | null>(null);

  // Active Selected Business Tab ID
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);

  // Drawer: Add Owner (Superadmin only)
  const [showAddOwnerDrawer, setShowAddOwnerDrawer] = useState(false);
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [newOwnerPassword, setNewOwnerPassword] = useState("");
  const [newOwnerPin, setNewOwnerPin] = useState("");
  const [newOwnerBizName, setNewOwnerBizName] = useState("");
  const [newOwnerBizType, setNewOwnerBizType] = useState("retail");
  const [submittingOwner, setSubmittingOwner] = useState(false);

  // Drawer: Add Business to Owner
  const [showAddBusinessDrawer, setShowAddBusinessDrawer] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [templateType, setTemplateType] = useState<string>("retail");
  const [hasPos, setHasPos] = useState(true);
  const [hasMfg, setHasMfg] = useState(false);
  const [hasHub, setHasHub] = useState(false);
  const [hasEod, setHasEod] = useState(false);
  const [initialOutletName, setInitialOutletName] = useState("");
  const [submittingBusiness, setSubmittingBusiness] = useState(false);

  const isGmail = (val: string) => val.trim().toLowerCase().endsWith("@gmail.com");

  const loadData = async () => {
    setLoading(true);
    try {
      if (isSuperAdmin) {
        const res = await api.get("/admin/owners");
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        setOwners(list);

        if (selectedOwner) {
          const found = list.find((o: OwnerHierarchyItem) => o.id === selectedOwner.id);
          if (found) {
            setSelectedOwner(found);
            if (!activeBusinessId && found.businesses.length > 0) {
              setActiveBusinessId(found.businesses[0].id);
            }
          }
        }
      } else {
        const res = await api.get("/organization/businesses");
        const bizList = Array.isArray(res.data) ? res.data : res.data?.data || [];
        const singleOwnerObj: OwnerHierarchyItem = {
          id: activeContext?.business_id || "owner-me",
          name: activeContext?.business_name || "Pemilik Bisnis",
          status: "active",
          created_at: new Date().toISOString(),
          businesses: bizList.map((b: any) => ({
            id: b.id,
            name: b.name,
            type: b.type,
            phone: b.phone,
            email: b.email,
            tax_id: b.tax_id,
            tax_rate_pct: b.tax_rate_pct,
            has_pos: b.has_pos ?? true,
            has_manufacturing: b.has_manufacturing ?? false,
            has_logistics_hub: b.has_logistics_hub ?? false,
            has_eod_usage: b.has_eod_usage ?? false,
            outlet_count: b.outlet_count || 1,
            staff_count: b.staff_count || 1,
            created_at: b.created_at,
          })),
        };
        setOwners([singleOwnerObj]);
        setSelectedOwner(singleOwnerObj);
        if (!activeBusinessId && singleOwnerObj.businesses.length > 0) {
          setActiveBusinessId(singleOwnerObj.businesses[0].id);
        }
      }
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          (language === "id" ? "Gagal memuat struktur organisasi" : "Failed to load organization hierarchy")
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isSuperAdmin, activeContext?.business_id]);

  // Keep activeBusinessId valid whenever current businesses change
  const currentOwner = selectedOwner || (owners.length > 0 ? owners[0] : null);
  const currentBusinesses = currentOwner ? currentOwner.businesses : [];

  useEffect(() => {
    if (currentBusinesses.length > 0) {
      const exists = currentBusinesses.some((b) => b.id === activeBusinessId);
      if (!exists || !activeBusinessId) {
        setActiveBusinessId(currentBusinesses[0].id);
      }
    } else {
      setActiveBusinessId(null);
    }
  }, [currentBusinesses, activeBusinessId]);

  // Keyboard shortcut '/' to search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault();
        const searchInput = document.getElementById("owner-search-input");
        if (searchInput) {
          searchInput.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleTemplateChange = (tmpl: string) => {
    setTemplateType(tmpl);
    switch (tmpl) {
      case "retail":
        setHasPos(true);
        setHasMfg(false);
        setHasHub(false);
        setHasEod(false);
        break;
      case "fnb_production":
        setHasPos(true);
        setHasMfg(true);
        setHasHub(true);
        setHasEod(false);
        break;
      case "fnb_franchise":
        setHasPos(true);
        setHasMfg(false);
        setHasHub(true);
        setHasEod(false);
        break;
      case "fnb_street_food":
        setHasPos(true);
        setHasMfg(false);
        setHasHub(false);
        setHasEod(true);
        break;
      case "custom":
      default:
        break;
    }
  };

  const handleCreateOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOwnerName.trim() || !newOwnerEmail.trim()) {
      toast.error(
        language === "id" ? "Nama dan Email Gmail wajib diisi" : "Name and Gmail address are required"
      );
      return;
    }
    if (!isGmail(newOwnerEmail)) {
      toast.error(
        language === "id" ? "Email wajib menggunakan domain @gmail.com" : "Email must use @gmail.com domain"
      );
      return;
    }
    if (!newOwnerPin || newOwnerPin.length < 6) {
      toast.error(
        language === "id" ? "PIN Kasir / Otorisasi wajib 6 digit angka" : "PIN must be 6 digits"
      );
      return;
    }

    setSubmittingOwner(true);
    setShowAddOwnerDrawer(false);

    const promise = (async () => {
      // 1. Create User in backend
      const userRes = await api.post("/admin/users", {
        name: newOwnerName.trim(),
        email: newOwnerEmail.trim(),
        password: newOwnerPassword.trim() || newOwnerPin,
        pin: newOwnerPin,
        status: "active",
      });

      const newUserId = userRes.data?.data?.id || userRes.data?.id;

      // 2. If initial business name was provided, create business immediately
      if (newUserId && newOwnerBizName.trim()) {
        const hasPosFlag = true;
        const hasMfgFlag = newOwnerBizType === "fnb_production";
        const hasHubFlag = newOwnerBizType === "fnb_production" || newOwnerBizType === "fnb_franchise";
        const hasEodFlag = newOwnerBizType === "fnb_street_food";

        await api.post("/admin/owners/" + newUserId + "/businesses", {
          name: newOwnerBizName.trim(),
          type: newOwnerBizType,
          has_pos: hasPosFlag,
          has_manufacturing: hasMfgFlag,
          has_logistics_hub: hasHubFlag,
          has_eod_usage: hasEodFlag,
          initial_outlet_name: "Cabang Utama",
        });
      }

      return userRes;
    })();

    toast.promise(promise, {
      loading: language === "id" ? "Mendaftarkan pemilik bisnis..." : "Registering business owner...",
      success: () => {
        setSubmittingOwner(false);
        setNewOwnerName("");
        setNewOwnerEmail("");
        setNewOwnerPassword("");
        setNewOwnerPin("");
        setNewOwnerBizName("");
        setNewOwnerBizType("retail");
        loadData();
        return t.orgOwnerCreateSuccess || "Pemilik bisnis berhasil didaftarkan!";
      },
      error: (err: any) => {
        setSubmittingOwner(false);
        return (
          err.response?.data?.message ||
          (language === "id" ? "Gagal mendaftarkan pemilik bisnis" : "Failed to register owner")
        );
      },
    });
  };

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    const ownerTargetId = selectedOwner ? selectedOwner.id : (owners[0]?.id || "");
    if (!ownerTargetId) return;

    if (!businessName.trim()) {
      toast.error(
        language === "id" ? "Nama unit bisnis wajib diisi" : "Business name is required"
      );
      return;
    }

    setSubmittingBusiness(true);
    setShowAddBusinessDrawer(false);

    const endpoint = isSuperAdmin
      ? "/admin/owners/" + ownerTargetId + "/businesses"
      : "/organization/businesses";

    const promise = api.post(endpoint, {
      name: businessName.trim(),
      type: templateType,
      has_pos: hasPos,
      has_manufacturing: hasMfg,
      has_logistics_hub: hasHub,
      has_eod_usage: hasEod,
      initial_outlet_name: initialOutletName.trim() || undefined,
    });

    toast.promise(promise, {
      loading: language === "id" ? "Mendaftarkan unit bisnis..." : "Registering business entity...",
      success: (res: any) => {
        const newBizId = res.data?.data?.id || res.data?.id;
        setSubmittingBusiness(false);
        setBusinessName("");
        setInitialOutletName("");
        setTemplateType("retail");
        setHasPos(true);
        setHasMfg(false);
        setHasHub(false);
        setHasEod(false);
        loadData();
        if (newBizId) {
          setActiveBusinessId(newBizId);
        }
        return t.orgCreateBusinessSuccess || "Unit bisnis baru berhasil didaftarkan!";
      },
      error: (err: any) => {
        setSubmittingBusiness(false);
        return (
          err.response?.data?.message ||
          (language === "id" ? "Gagal mendaftarkan unit bisnis" : "Failed to register business")
        );
      },
    });
  };

  const getBusinessIcon = (type: string) => {
    switch (type) {
      case "retail":
        return <Store className="w-4 h-4 text-emerald-500" />;
      case "fnb_production":
        return <CookingPot className="w-4 h-4 text-amber-500" />;
      case "fnb_franchise":
        return <Utensils className="w-4 h-4 text-blue-500" />;
      default:
        return <FlameKindling className="w-4 h-4 text-rose-500" />;
    }
  };

  // Filter owners for Level 1 Superadmin view
  const filteredOwners = useMemo(() => {
    return owners.filter((o) => {
      const q = searchQuery.toLowerCase();
      const matchName = o.name.toLowerCase().includes(q);
      const matchEmail = (o.phone_or_email || "").toLowerCase().includes(q);
      const matchBiz = o.businesses.some((b) => b.name.toLowerCase().includes(q));
      return matchName || matchEmail || matchBiz;
    });
  }, [owners, searchQuery]);

  // ════════════════════════════════════════════════════════════════
  // ERP DATA TABLE COLUMNS FOR LEVEL 1 OWNERS DIRECTORY
  // ════════════════════════════════════════════════════════════════
  const ownerColumns: ColumnDef<OwnerHierarchyItem>[] = useMemo(() => [
    {
      key: "owner_name",
      label: t.orgColOwnerName || "Nama Pemilik",
      renderCell: (owner) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0">
            {owner.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-extrabold text-xs text-slate-900 dark:text-white group-hover:text-primary transition-colors">
              {owner.name}
            </p>
            <p className="text-[10px] text-slate-400">ID: {owner.id.slice(0, 8)}...</p>
          </div>
        </div>
      ),
    },
    {
      key: "contact",
      label: t.orgColContact || "Kontak / Email",
      renderCell: (owner) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{owner.phone_or_email || "-"}</span>
        </div>
      ),
    },
    {
      key: "businesses_count",
      label: t.orgColBusinessesCount || "Unit Usaha",
      renderCell: (owner) => (
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] font-bold rounded-full">
            {owner.businesses.length} Bisnis
          </Badge>
          <span className="text-[11px] text-slate-400 truncate max-w-[200px]">
            ({owner.businesses.map((b) => b.name).join(", ") || "Belum ada unit"})
          </span>
        </div>
      ),
    },
    {
      key: "status",
      label: t.orgColStatus || "Status Akun",
      renderCell: (owner) => (
        <Badge
          variant="outline"
          className={"text-[10px] font-bold rounded-full " + (
            owner.status === "active"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40"
              : "bg-slate-100 dark:bg-slate-800 text-slate-400"
          )}
        >
          {owner.status.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: "action",
      label: t.orgColAction || "Aksi",
      align: "right",
      renderCell: () => (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-primary group-hover:translate-x-1 transition-transform">
          <span>{t.orgOpenBusiness || "Kelola Portofolio"}</span>
          <ChevronRight className="w-4 h-4" />
        </span>
      ),
    },
  ], [language, t]);

  // ════════════════════════════════════════════════════════════════
  // LEVEL 2 (SUPERADMIN SELECTED OWNER) OR SINGLE-LAYER (OWNER VIEW)
  // ════════════════════════════════════════════════════════════════
  if (selectedOwner || !isSuperAdmin) {
    const activeBusiness = currentBusinesses.find((b) => b.id === activeBusinessId) || currentBusinesses[0];

    return (
      <div className="space-y-6 w-full">
        {/* ── HIGHLIGHTED COMPACT HEADER (FRAMELESS, NO HEAVY CARD) ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-[#2E2E34]">
          <div className="flex items-center gap-3">
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => {
                  setSelectedOwner(null);
                  setActiveBusinessId(null);
                }}
                className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-primary hover:text-slate-900 transition-all shrink-0 cursor-pointer"
                title={t.orgBackToOwners || "Kembali ke Daftar Pemilik"}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  {currentOwner?.name || (t.orgOwnerPortfolio || "Portofolio Unit Usaha")}
                </h2>
                {currentOwner?.status && (
                  <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40 text-[10px] font-bold rounded-full">
                    {currentOwner.status.toUpperCase()}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                {currentOwner?.phone_or_email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{currentOwner.phone_or_email}</span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                  </span>
                )}
                <span>{currentBusinesses.length} Unit Bisnis Aktif</span>
              </p>
            </div>
          </div>


        </div>

        {/* ── BROWSER-LIKE FRAMELESS BUSINESS TABS (SEPARATED BY VR WITH INLINE PLUS) ── */}
        {loading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
            <p className="text-xs text-slate-400">{language === "id" ? "Memuat portofolio bisnis..." : "Loading portfolio..."}</p>
          </div>
        ) : currentBusinesses.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-slate-50/50 dark:bg-[#18181B] border border-dashed border-slate-200 dark:border-slate-800">
            <Building className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {language === "id" ? "Belum ada unit bisnis terdaftar" : "No businesses registered"}
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {language === "id"
                ? "Klik tombol di bawah untuk mendaftarkan toko retail atau outlet F&B baru."
                : "Click below to register a new retail store or F&B brand."}
            </p>
            <Button
              onClick={() => setShowAddBusinessDrawer(true)}
              className="mt-4 rounded-full bg-[#E2FF66] hover:bg-[#D5F54E] text-slate-900 font-bold text-xs h-9 px-4 cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              <span>{t.orgAddNewBusiness || "Tambah Unit Bisnis"}</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-6 w-full">
            {/* Horizontal Browser Tabs Row */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-slate-200/80 dark:border-[#2E2E34]">
              {currentBusinesses.map((biz, idx) => {
                const isActive = biz.id === (activeBusiness?.id || activeBusinessId);

                return (
                  <React.Fragment key={biz.id}>
                    {/* Vertical Divider between tabs */}
                    {idx > 0 && (
                      <div className="h-5 w-[1px] bg-slate-200 dark:bg-[#2E2E34] shrink-0 my-auto" />
                    )}

                    {/* Frameless Browser Tab */}
                    <button
                      type="button"
                      onClick={() => setActiveBusinessId(biz.id)}
                      className={"group relative flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer shrink-0 outline-none " + (
                        isActive
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
                      )}
                    >
                      <div className={"w-5 h-5 rounded-lg flex items-center justify-center shrink-0 " + (isActive ? "bg-white/10 dark:bg-slate-900/10" : "bg-slate-100 dark:bg-white/5")}>
                        {getBusinessIcon(biz.type)}
                      </div>
                      <span className="truncate max-w-[150px] sm:max-w-[200px]">{biz.name}</span>
                    </button>
                  </React.Fragment>
                );
              })}

              {/* Inline Plus Button to Add Another Business */}
              <div className="h-5 w-[1px] bg-slate-200 dark:bg-[#2E2E34] shrink-0 my-auto ml-0.5" />
              <button
                type="button"
                onClick={() => setShowAddBusinessDrawer(true)}
                title={t.orgAddNewBusiness || "Tambah Unit Bisnis"}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all shrink-0 cursor-pointer ml-1"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Active Business Content View (Frameless 3-Section Direct Display) */}
            {activeBusiness && (
              <div className="w-full pt-1">
                <BusinessExpandableCard
                  key={activeBusiness.id}
                  business={activeBusiness}
                  isFrameless={true}
                  onBusinessUpdated={(updatedFields) => {
                    if (updatedFields) {
                      setOwners((prevOwners) =>
                        prevOwners.map((o) => ({
                          ...o,
                          businesses: o.businesses.map((b) =>
                            b.id === activeBusiness.id ? { ...b, ...updatedFields } : b
                          ),
                        }))
                      );
                      setSelectedOwner((prevSelected) => {
                        if (!prevSelected) return prevSelected;
                        return {
                          ...prevSelected,
                          businesses: prevSelected.businesses.map((b) =>
                            b.id === activeBusiness.id ? { ...b, ...updatedFields } : b
                          ),
                        };
                      });
                    } else {
                      loadData();
                    }
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* ── DRAWER: ADD BUSINESS ENTITY ── */}
        <Drawer
          direction="right"
          open={showAddBusinessDrawer}
          onOpenChange={setShowAddBusinessDrawer}
        >
          <DrawerContent className="w-full sm:w-[500px] md:w-[540px]">
            <form onSubmit={handleCreateBusiness} className="flex flex-col h-full justify-between">
              <div className="overflow-y-auto">
                <DrawerHeader className="border-b border-slate-100 dark:border-[#2A2A30] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <DrawerTitle className="text-base font-black text-slate-900 dark:text-white">
                        {t.orgCreateBusinessTitle || "Daftarkan Unit Bisnis Baru"}
                      </DrawerTitle>
                      <DrawerDescription className="text-xs text-slate-400 mt-0.5">
                        {t.orgCreateBusinessDesc || "Pilih model bisnis atau sesuaikan kapabilitas modul ERP."}
                      </DrawerDescription>
                    </div>
                  </div>
                </DrawerHeader>

                <div className="p-6 space-y-5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {t.orgBusinessName || "Nama Unit Bisnis"} <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder={t.orgBusinessNamePlaceholder || "Contoh: JnA Mart Cabang Utama"}
                      required
                      className="h-10 rounded-xl text-xs"
                    />
                  </div>

                  {/* BUSINESS MODEL TEMPLATE SELECTION (RADIO CARDS) */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {t.orgTemplateLabel || "Template Model Bisnis"}
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleTemplateChange("retail")}
                        className={"p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer " + (
                          templateType === "retail"
                            ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary"
                            : "bg-white dark:bg-[#202024] border-slate-200/80 dark:border-[#2E2E34] hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <Store className={"w-4 h-4 " + (templateType === "retail" ? "text-emerald-500" : "text-slate-400")} />
                          <span className={"w-3 h-3 rounded-full border flex items-center justify-center " + (templateType === "retail" ? "border-primary bg-primary" : "border-slate-300")}>
                            {templateType === "retail" && <span className="w-1.5 h-1.5 rounded-full bg-slate-900"></span>}
                          </span>
                        </div>
                        <span className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                          Retail & Kelontong (JnA Mart)
                        </span>
                        <span className="text-[10px] text-slate-400 mt-1">Mode Barcode Scanner & POS Retail</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTemplateChange("fnb_production")}
                        className={"p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer " + (
                          templateType === "fnb_production"
                            ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary"
                            : "bg-white dark:bg-[#202024] border-slate-200/80 dark:border-[#2E2E34] hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <CookingPot className={"w-4 h-4 " + (templateType === "fnb_production" ? "text-amber-500" : "text-slate-400")} />
                          <span className={"w-3 h-3 rounded-full border flex items-center justify-center " + (templateType === "fnb_production" ? "border-primary bg-primary" : "border-slate-300")}>
                            {templateType === "fnb_production" && <span className="w-1.5 h-1.5 rounded-full bg-slate-900"></span>}
                          </span>
                        </div>
                        <span className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                          F&B Dapur & BOM (Bakso Gemoy)
                        </span>
                        <span className="text-[10px] text-slate-400 mt-1">Pabrikasi Batch BOM & Hub Distribusi</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTemplateChange("fnb_franchise")}
                        className={"p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer " + (
                          templateType === "fnb_franchise"
                            ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary"
                            : "bg-white dark:bg-[#202024] border-slate-200/80 dark:border-[#2E2E34] hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <Utensils className={"w-4 h-4 " + (templateType === "fnb_franchise" ? "text-blue-500" : "text-slate-400")} />
                          <span className={"w-3 h-3 rounded-full border flex items-center justify-center " + (templateType === "fnb_franchise" ? "border-primary bg-primary" : "border-slate-300")}>
                            {templateType === "fnb_franchise" && <span className="w-1.5 h-1.5 rounded-full bg-slate-900"></span>}
                          </span>
                        </div>
                        <span className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                          Franchise Multi-Outlet (Yasaka)
                        </span>
                        <span className="text-[10px] text-slate-400 mt-1">Fast Grid Touch POS & Logistics Hub</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTemplateChange("fnb_street_food")}
                        className={"p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer " + (
                          templateType === "fnb_street_food"
                            ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary"
                            : "bg-white dark:bg-[#202024] border-slate-200/80 dark:border-[#2E2E34] hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <FlameKindling className={"w-4 h-4 " + (templateType === "fnb_street_food" ? "text-rose-500" : "text-slate-400")} />
                          <span className={"w-3 h-3 rounded-full border flex items-center justify-center " + (templateType === "fnb_street_food" ? "border-primary bg-primary" : "border-slate-300")}>
                            {templateType === "fnb_street_food" && <span className="w-1.5 h-1.5 rounded-full bg-slate-900"></span>}
                          </span>
                        </div>
                        <span className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                          Street Food / Gerobak (Gorengan)
                        </span>
                        <span className="text-[10px] text-slate-400 mt-1">Fast Grid & Pemakaian Bahan EOD</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {t.orgInitialOutletLabel || "Nama Cabang / Outlet Perdana"}
                    </Label>
                    <Input
                      value={initialOutletName}
                      onChange={(e) => setInitialOutletName(e.target.value)}
                      placeholder={t.orgInitialOutletPlaceholder || "Contoh: Outlet Pusat / Gerobak 01"}
                      className="h-10 rounded-xl text-xs"
                    />
                    <p className="text-[11px] text-slate-400">
                      {t.orgInitialOutletHint || "Cabang perdana akan otomatis dibuat untuk transaksi kasir."}
                    </p>
                  </div>
                </div>
              </div>

              <DrawerFooter className="p-6 border-t border-slate-100 dark:border-[#2A2A30] flex flex-row gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddBusinessDrawer(false)}
                  className="flex-1 rounded-full text-xs h-10 cursor-pointer"
                >
                  {t.cancel || "Batal"}
                </Button>
                <Button
                  type="submit"
                  disabled={submittingBusiness}
                  className="flex-1 rounded-full bg-[#E2FF66] hover:bg-[#D5F54E] text-slate-900 font-bold text-xs h-10 gap-1.5 cursor-pointer"
                >
                  {submittingBusiness ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                  <span>{t.save || "Daftarkan Bisnis"}</span>
                </Button>
              </DrawerFooter>
            </form>
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // LEVEL 1: SUPERADMIN OWNERS DIRECTORY (ERP DATA TABLE)
  // ════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6 w-full">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-[#2E2E34]">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Users className="w-7 h-7 text-primary" />
            <span>{t.orgOwnersTitle || "Hierarki Organisasi & Kepemilikan Bisnis"}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t.orgOwnersDesc || "Kelola akun Pemilik Bisnis (Owner), portofolio unit usaha, dan kapabilitas modul ERP."}
          </p>
        </div>

        <Button
          onClick={() => setShowAddOwnerDrawer(true)}
          className="rounded-full bg-[#E2FF66] hover:bg-[#D5F54E] text-slate-900 font-bold text-xs h-9 px-5 gap-1.5 shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.orgAddOwner || "Tambah Pemilik Baru"}</span>
        </Button>
      </div>

      {/* Search Bar */}
      <div className="w-full max-w-md">
        <ErpSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t.orgSearchOwnerPlaceholder || "Cari nama pemilik, email Gmail..."}
        />
      </div>

      {/* Owners Master Table via ErpDataTable */}
      <ErpDataTable<OwnerHierarchyItem>
        data={filteredOwners}
        columns={ownerColumns}
        keyExtractor={(owner) => owner.id}
        loading={loading}
        emptyText={t.orgNoOwners || "Belum ada data pemilik bisnis terdaftar"}
        onRowClick={(owner) => {
          setSelectedOwner(owner);
          if (owner.businesses.length > 0) {
            setActiveBusinessId(owner.businesses[0].id);
          }
        }}
        renderMobileItem={(owner) => (
          <div
            onClick={() => {
              setSelectedOwner(owner);
              if (owner.businesses.length > 0) {
                setActiveBusinessId(owner.businesses[0].id);
              }
            }}
            className="p-4 bg-white dark:bg-[#1E1E22] rounded-2xl border border-slate-200/80 dark:border-[#2E2E34] space-y-3 shadow-xs cursor-pointer"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0">
                  {owner.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h5 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">{owner.name}</h5>
                  <p className="text-xs text-slate-400 mt-0.5">{owner.phone_or_email || "-"}</p>
                </div>
              </div>

              <Badge
                variant="outline"
                className={"text-[10px] font-bold rounded-full " + (
                  owner.status === "active"
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200"
                    : "bg-slate-100 text-slate-400"
                )}
              >
                {owner.status.toUpperCase()}
              </Badge>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-[#2E2E34] text-xs">
              <span className="text-slate-500 font-semibold">{owner.businesses.length} Unit Bisnis</span>
              <span className="inline-flex items-center gap-1 font-bold text-primary">
                <span>{t.orgOpenBusiness || "Kelola"}</span>
                <ChevronRight className="w-4 h-4" />
              </span>
            </div>
          </div>
        )}
      />

      {/* ── DRAWER: ADD OWNER (SUPERADMIN ONLY) ── */}
      <Drawer
        direction="right"
        open={showAddOwnerDrawer}
        onOpenChange={setShowAddOwnerDrawer}
      >
        <DrawerContent className="w-full sm:w-[460px]">
          <form onSubmit={handleCreateOwner} className="flex flex-col h-full justify-between">
            <div className="overflow-y-auto">
              <DrawerHeader className="border-b border-slate-100 dark:border-[#2A2A30] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <DrawerTitle className="text-base font-black text-slate-900 dark:text-white">
                      {t.orgCreateOwnerTitle || "Tambah Akun Pemilik Bisnis"}
                    </DrawerTitle>
                    <DrawerDescription className="text-xs text-slate-400 mt-0.5">
                      {t.orgCreateOwnerDesc || "Daftarkan akun Owner baru yang dapat memiliki satu atau lebih unit usaha."}
                    </DrawerDescription>
                  </div>
                </div>
              </DrawerHeader>

              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t.orgOwnerNameLabel || "Nama Lengkap Pemilik"} <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    value={newOwnerName}
                    onChange={(e) => setNewOwnerName(e.target.value)}
                    placeholder="Contoh: Kennan Wardana"
                    required
                    className="h-10 rounded-xl text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t.orgOwnerEmailLabel || "Email Gmail Terdaftar"} <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={newOwnerEmail}
                    onChange={(e) => setNewOwnerEmail(e.target.value)}
                    placeholder="kennan.owner@gmail.com"
                    required
                    className="h-10 rounded-xl text-xs"
                  />
                  {!isGmail(newOwnerEmail) && newOwnerEmail.length > 0 && (
                    <p className="text-[10px] text-rose-500 flex items-center gap-1 mt-1">
                      <ShieldAlert className="w-3 h-3" />
                      <span>{language === "id" ? "Wajib menggunakan akun @gmail.com" : "Must use @gmail.com account"}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t.orgOwnerPasswordLabel || "Password Akun"}
                  </Label>
                  <Input
                    type="password"
                    value={newOwnerPassword}
                    onChange={(e) => setNewOwnerPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="h-10 rounded-xl text-xs"
                  />
                </div>

                <div className="space-y-2 pt-1">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t.orgOwnerPinLabel || "PIN Kasir / Otorisasi 6-Digit"} <span className="text-rose-500">*</span>
                  </Label>
                  <div className="flex justify-center py-2 bg-slate-50 dark:bg-white/[0.02] rounded-2xl border border-slate-200/80 dark:border-[#2E2E34]">
                    <InputOTP
                      maxLength={6}
                      value={newOwnerPin}
                      onChange={(val) => setNewOwnerPin(val)}
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

                {/* Optional Initial Business Provisioning */}
                <div className="pt-3 border-t border-slate-100 dark:border-[#2A2A30] space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === "id" ? "Unit Bisnis Perdana (Opsional)" : "Initial Business Entity (Optional)"}
                    </Label>
                    <Badge variant="outline" className="text-[9px] font-semibold text-slate-400">
                      Opsional
                    </Badge>
                  </div>

                  <Input
                    value={newOwnerBizName}
                    onChange={(e) => setNewOwnerBizName(e.target.value)}
                    placeholder="Contoh: JnA Mart Cabang Kaliurang"
                    className="h-10 rounded-xl text-xs"
                  />

                  {newOwnerBizName.trim() && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setNewOwnerBizType("retail")}
                        className={"p-2.5 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer " + (
                          newOwnerBizType === "retail"
                            ? "bg-primary/10 border-primary text-slate-900 dark:text-white"
                            : "bg-white dark:bg-[#202024] border-slate-200/80 dark:border-[#2E2E34] text-slate-500"
                        )}
                      >
                        <Store className="w-3.5 h-3.5 mb-1 text-emerald-500" />
                        <span>Retail / Mart</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNewOwnerBizType("fnb_production")}
                        className={"p-2.5 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer " + (
                          newOwnerBizType === "fnb_production"
                            ? "bg-primary/10 border-primary text-slate-900 dark:text-white"
                            : "bg-white dark:bg-[#202024] border-slate-200/80 dark:border-[#2E2E34] text-slate-500"
                        )}
                      >
                        <CookingPot className="w-3.5 h-3.5 mb-1 text-amber-500" />
                        <span>F&B / Dapur BOM</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DrawerFooter className="p-6 border-t border-slate-100 dark:border-[#2A2A30] flex flex-row gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddOwnerDrawer(false)}
                className="flex-1 rounded-full text-xs h-10 cursor-pointer"
              >
                {t.cancel || "Batal"}
              </Button>
              <Button
                type="submit"
                disabled={submittingOwner}
                className="flex-1 rounded-full bg-[#E2FF66] hover:bg-[#D5F54E] text-slate-900 font-bold text-xs h-10 gap-1.5 cursor-pointer"
              >
                {submittingOwner ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                <span>{t.save || "Daftarkan Pemilik"}</span>
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
