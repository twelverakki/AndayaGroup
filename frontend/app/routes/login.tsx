import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { api } from "../lib/api";
import { useAuthStore, type User, type Workspace, type ActiveContext } from "../lib/store";
import { useLanguageStore, translations } from "../lib/i18n";
import { toast } from "../components/ui/sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "../components/ui/input-otp";
import {
  Lock,
  Mail,
  KeyRound,
  Sparkles,
  ArrowRight,
  RotateCcw,
  AlertCircle,
  Globe,
  Sun,
  Moon,
  Eye,
  EyeOff,
  Building2,
  Store,
  Utensils,
  CookingPot,
  FlameKindling,
  ShoppingCart,
  Layers,
  Send,
  Flame,
  Shield,
  ShieldAlert,
  Building,
  GitBranch,
  MapPin,
  Loader2,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { useTheme } from "../hooks/use-theme";

interface TempLoginData {
  user: User;
  workspaces: Workspace[];
  activeContext: ActiveContext;
}

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isExpired = searchParams.get("expired") === "true";
  const isSuspended = searchParams.get("reason") === "suspended";

  const { language, toggleLanguage } = useLanguageStore();
  const { isDark, toggleTheme } = useTheme();
  const t = translations[language] || translations.id;
  const setSession = useAuthStore((state) => state.setSession);

  // Screen Flow: "credentials" vs "select_workspace"
  const [viewStep, setViewStep] = useState<"credentials" | "select_workspace">("credentials");
  const [tempLoginData, setTempLoginData] = useState<TempLoginData | null>(null);
  const [launchingKey, setLaunchingKey] = useState<string | null>(null);

  // Mode: "password" (Owner/Manager/Superadmin) vs "pin" (Cashier/Staff)
  const [loginMethod, setLoginMethod] = useState<"password" | "pin">("password");

  // Inputs
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Forgot Password Modal State
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStep, setForgotStep] = useState<"request" | "reset">("request");
  const [resetOTP, setResetOTP] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  // Validate Gmail
  const isGmail = (val: string) => {
    return val.trim().toLowerCase().endsWith("@gmail.com");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload: { phone_or_email?: string; password?: string; pin?: string } = {};

      if (loginMethod === "password") {
        if (!email.trim() || !password.trim()) {
          throw new Error(
            language === "id"
              ? "Mohon isi email Gmail dan kata sandi"
              : "Please enter Gmail address and password"
          );
        }
        if (!isGmail(email) && !email.includes("@andaya.com")) {
          throw new Error(
            language === "id"
              ? "Alamat email wajib menggunakan domain @gmail.com"
              : "Email address must use @gmail.com domain"
          );
        }
        payload.phone_or_email = email.trim();
        payload.password = password;
      } else {
        if (!pin || pin.length < 4) {
          throw new Error(
            language === "id"
              ? "Mohon masukkan kode PIN kasir minimal 4-6 digit"
              : "Please enter 4-6 digit cashier PIN"
          );
        }
        if (email.trim()) {
          payload.phone_or_email = email.trim();
        }
        payload.pin = pin;
      }

      const response = await api.post("/auth/login", payload);
      const { user, workspaces, active_context } = response.data;

      // Check if user has multiple workspaces (e.g. Owner with 4 businesses or Manager with multiple branches)
      if (workspaces && workspaces.length > 1) {
        setTempLoginData({ user, workspaces, activeContext: active_context });
        setViewStep("select_workspace");
        toast.info(
          language === "id"
            ? `Autentikasi berhasil! Silakan pilih lingkungan bisnis Anda.`
            : `Authentication successful! Please select your business workspace.`
        );
        return;
      }

      // Single workspace: instant session launch
      setSession(user, workspaces, active_context);
      toast.success(
        language === "id"
          ? `Selamat datang kembali, ${user.name}!`
          : `Welcome back, ${user.name}!`
      );
      navigate("/");
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        (language === "id" ? "Gagal masuk ke akun" : "Failed to log in");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Handle Workspace Launch from Selector Screen
  const handleLaunchWorkspace = async (ws: Workspace) => {
    if (!tempLoginData) return;
    const key = `${ws.business_id || "global"}-${ws.outlet_id || "all"}-${ws.role}`;
    setLaunchingKey(key);

    try {
      let targetContext: ActiveContext = {
        business_id: ws.business_id,
        outlet_id: ws.outlet_id,
        role: ws.role,
        name: (ws.outlet_id && ws.outlet_name ? ws.outlet_name : ws.business_name) || "Workspace",
        type: ws.business_type,
        has_pos: ws.has_pos,
        has_manufacturing: ws.has_manufacturing,
        has_logistics_hub: ws.has_logistics_hub,
        has_eod_usage: ws.has_eod_usage,
        has_multi_outlets: ws.has_multi_outlets,
        hide_central_stock_from_branches: ws.hide_central_stock_from_branches,
      };

      // If chosen workspace differs from the initial default activeContext, switch backend context token
      const isInitialContext =
        tempLoginData.activeContext.business_id === ws.business_id &&
        (tempLoginData.activeContext.outlet_id || "") === (ws.outlet_id || "") &&
        tempLoginData.activeContext.role === ws.role;

      if (!isInitialContext) {
        const switchRes = await api.post("/auth/switch-business", {
          business_id: ws.business_id || "",
          outlet_id: ws.outlet_id || "",
          role: ws.role || "",
        });
        if (switchRes.data?.active_context) {
          targetContext = switchRes.data.active_context;
        }
      }

      setSession(tempLoginData.user, tempLoginData.workspaces, targetContext);
      toast.success(
        language === "id"
          ? `Membuka workspace: ${ws.role === "superadmin" ? "Superadmin Control Center" : targetContext.name}`
          : `Launching workspace: ${ws.role === "superadmin" ? "Superadmin Control Center" : targetContext.name}`
      );

      navigate("/");
    } catch (err: any) {
      console.error("Workspace launch failed:", err);
      toast.error(
        err.response?.data?.message ||
          (language === "id" ? "Gagal membuka workspace bisnis" : "Failed to launch business workspace")
      );
    } finally {
      setLaunchingKey(null);
    }
  };

  const handleBackToLogin = () => {
    setViewStep("credentials");
    setTempLoginData(null);
    setLaunchingKey(null);
    api.post("/auth/logout").catch(() => {});
  };

  // Handle Forgot Password Request
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast.error(language === "id" ? "Email wajib diisi" : "Email is required");
      return;
    }
    if (!isGmail(forgotEmail) && !forgotEmail.includes("@andaya.com")) {
      toast.error(
        language === "id"
          ? "Format email wajib menggunakan @gmail.com"
          : "Email must be a @gmail.com address"
      );
      return;
    }

    setForgotLoading(true);
    try {
      const res = await api.post("/auth/forgot-password", { email: forgotEmail.trim() });
      toast.success(
        res.data?.message ||
          (language === "id"
            ? "Kode OTP pemulihan telah dikirim"
            : "Recovery OTP has been sent")
      );
      if (res.data?.dev_otp) {
        setResetOTP(res.data.dev_otp);
      }
      setForgotStep("reset");
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          (language === "id" ? "Akun tidak ditemukan" : "Account not found")
      );
    } finally {
      setForgotLoading(false);
    }
  };

  // Handle Reset Password Submit
  const handlePerformReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetOTP || resetOTP.length < 6) {
      toast.error(
        language === "id"
          ? "Masukkan 6 digit kode OTP"
          : "Please enter 6-digit OTP code"
      );
      return;
    }
    if (newPassword.length < 6) {
      toast.error(
        language === "id"
          ? "Password minimal 6 karakter"
          : "Password must be at least 6 characters"
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(
        language === "id"
          ? "Konfirmasi kata sandi tidak cocok"
          : "Passwords do not match"
      );
      return;
    }

    setForgotLoading(true);
    try {
      const res = await api.post("/auth/reset-password", {
        email: forgotEmail.trim(),
        otp: resetOTP,
        new_password: newPassword,
      });
      toast.success(
        res.data?.message ||
          (language === "id"
            ? "Kata sandi berhasil diubah!"
            : "Password successfully updated!")
      );
      setIsForgotModalOpen(false);
      setForgotStep("request");
      setPassword("");
      setEmail(forgotEmail);
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          (language === "id" ? "Gagal mereset kata sandi" : "Failed to reset password")
      );
    } finally {
      setForgotLoading(false);
    }
  };

  const getBusinessIcon = (type?: string, name?: string) => {
    const lowerName = (name || "").toLowerCase();
    if (lowerName.includes("bakso")) return <Utensils className="w-5 h-5 text-amber-500" />;
    if (lowerName.includes("yasaka") || lowerName.includes("chicken")) return <CookingPot className="w-5 h-5 text-rose-500" />;
    if (lowerName.includes("gorengan")) return <FlameKindling className="w-5 h-5 text-orange-500" />;
    if (type === "retail" || lowerName.includes("mart") || lowerName.includes("kelontong"))
      return <Store className="w-5 h-5 text-emerald-500" />;
    return <Building2 className="w-5 h-5 text-indigo-500" />;
  };

  // Group workspaces for select_workspace screen
  const workspacesList = tempLoginData?.workspaces || [];
  const superadminWs = workspacesList.find((w) => w.role === "superadmin");
  const businessWorkspaces = workspacesList.filter((w) => w.role !== "superadmin");

  const groupedByBiz = businessWorkspaces.reduce<
    Record<
      string,
      {
        name: string;
        type: any;
        hasPos?: boolean;
        hasMfg?: boolean;
        hasHub?: boolean;
        hasEod?: boolean;
        hasMultiOutlets?: boolean;
        items: Workspace[];
      }
    >
  >((acc, ws) => {
    const bizKey = ws.business_id || "unknown";
    if (!acc[bizKey]) {
      acc[bizKey] = {
        name: ws.business_name || "Bisnis Tanpa Nama",
        type: ws.business_type,
        hasPos: ws.has_pos,
        hasMfg: ws.has_manufacturing,
        hasHub: ws.has_logistics_hub,
        hasEod: ws.has_eod_usage,
        hasMultiOutlets: ws.has_multi_outlets,
        items: [],
      };
    }
    acc[bizKey].items.push(ws);
    return acc;
  }, {});

  const bizEntries = Object.entries(groupedByBiz);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#121316] flex flex-col items-center justify-center p-4 selection:bg-[#E2FF66] selection:text-black">
      {/* Top Navbar language and theme switches */}
      <div className="absolute top-5 right-5 flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleTheme}
          className="rounded-full bg-white/80 backdrop-blur-xs border-slate-200 dark:border-[#2E2E34] dark:bg-[#1A1C20] text-xs font-semibold gap-1.5 hover:border-slate-300 shadow-2xs cursor-pointer"
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDark ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>Light</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-slate-600" />
              <span>Dark</span>
            </>
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleLanguage}
          className="rounded-full bg-white/80 backdrop-blur-xs border-slate-200 dark:border-[#2E2E34] dark:bg-[#1A1C20] text-xs font-semibold gap-1.5 hover:border-slate-300 shadow-2xs cursor-pointer"
        >
          <Globe className="w-3.5 h-3.5 text-slate-500" />
          <span>{language === "id" ? "ID" : "EN"}</span>
        </Button>
      </div>

      {viewStep === "credentials" ? (
        /* ================= STEP 1: CREDENTIALS LOGIN ================= */
        <div className="w-full max-w-md animate-in fade-in duration-200">
          <Card className="border-slate-200/90 dark:border-[#2E2E34] shadow-xl dark:bg-[#1A1C20] rounded-3xl overflow-hidden backdrop-blur-md">
            <CardHeader className="text-center pb-4 pt-8">
              <div className="mx-auto flex items-center justify-center mb-3">
                <img
                  src={isDark ? "/logo-darkmode.png" : "/logo.png"}
                  alt="Andaya Group"
                  key={isDark ? "dark-logo" : "light-logo"}
                  className="h-20 w-auto max-w-[240px] object-contain transition-all duration-200 drop-shadow-sm"
                />
              </div>
              <CardTitle className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Andaya Group
              </CardTitle>
              <CardDescription className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {language === "id"
                  ? "Multi-Tenant Lean ERP System"
                  : "Multi-Tenant Lean ERP System"}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Account Suspended / Deactivated Alert */}
              {isSuspended && (
                <div className="flex items-start gap-3 p-3.5 bg-rose-500/10 text-rose-700 dark:text-rose-400 text-xs font-medium rounded-2xl border border-rose-500/20 shadow-xs">
                  <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                  <div className="space-y-0.5 text-left">
                    <span className="font-bold text-slate-900 dark:text-white block">
                      {language === "id" ? "Akses Akun Dinonaktifkan" : "Account Suspended"}
                    </span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed block">
                      {language === "id"
                        ? "Akun Anda telah dinonaktifkan oleh Administrator. Seluruh sesi login telah dihentikan secara otomatis."
                        : "Your account has been deactivated by the Administrator. All active login sessions have been terminated."}
                    </span>
                  </div>
                </div>
              )}

              {/* Session Expired Alert */}
              {isExpired && !isSuspended && (
                <div className="flex items-center gap-2.5 p-3.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-medium rounded-2xl border border-amber-500/20">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    {language === "id"
                      ? "Sesi Anda telah berakhir. Silakan masuk kembali."
                      : "Session expired. Please log in again."}
                  </span>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2.5 p-3.5 bg-rose-500/10 text-rose-700 dark:text-rose-400 text-xs font-medium rounded-xl border border-rose-500/20">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Segmented Tab Switcher */}
              <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-[#23252A] rounded-2xl border border-slate-200/70 dark:border-[#2E2E34]">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod("password");
                    setError("");
                  }}
                  className={`py-2.5 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                    loginMethod === "password"
                      ? "bg-white dark:bg-[#1A1C20] text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{language === "id" ? "Password (Owner)" : "Password (Owner)"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod("pin");
                    setError("");
                  }}
                  className={`py-2.5 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                    loginMethod === "pin"
                      ? "bg-white dark:bg-[#1A1C20] text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{language === "id" ? "PIN Kasir (Staff)" : "Cashier PIN"}</span>
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleLogin} className="space-y-4">
                {loginMethod === "password" ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs font-semibold">
                        {language === "id" ? "Email Akun (Gmail)" : "Gmail Address"}
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="contoh@gmail.com"
                          className="pl-10 h-11 rounded-xl bg-slate-50/50 dark:bg-[#23252A] border-slate-200 dark:border-[#38383C] text-sm"
                          autoComplete="email"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-xs font-semibold">
                          {language === "id" ? "Kata Sandi" : "Password"}
                        </Label>
                        <button
                          type="button"
                          onClick={() => {
                            setForgotEmail(email);
                            setForgotStep("request");
                            setIsForgotModalOpen(true);
                          }}
                          className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                        >
                          {language === "id" ? "Lupa Kata Sandi?" : "Forgot Password?"}
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="pl-10 pr-10 h-11 rounded-xl bg-slate-50/50 dark:bg-[#23252A] border-slate-200 dark:border-[#38383C] text-sm"
                          autoComplete="current-password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5"
                          tabIndex={-1}
                          title={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="staff-email" className="text-xs font-semibold">
                        {language === "id"
                          ? "Email Kasir / Gmail (Opsional)"
                          : "Staff Email / Gmail (Optional)"}
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          id="staff-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="adi@gmail.com (Opsional)"
                          className="pl-10 h-11 rounded-xl bg-slate-50/50 dark:bg-[#23252A] border-slate-200 dark:border-[#38383C] text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-1 flex flex-col items-center">
                      <Label className="text-xs font-semibold self-start">
                        {language === "id"
                          ? "Kode PIN Kasir (6 Digit)"
                          : "Cashier PIN (6 Digits)"}
                      </Label>
                      <div className="py-2">
                        <InputOTP
                          maxLength={6}
                          value={pin}
                          onChange={(value) => setPin(value)}
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
                  </>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 mt-2 rounded-xl font-bold bg-[#E2FF66] hover:bg-[#D5F54E] text-[#121316] shadow-md transition-all gap-2 cursor-pointer dark:text-black"
                >
                  {loading ? (
                    <span>
                      {language === "id" ? "Memverifikasi..." : "Authenticating..."}
                    </span>
                  ) : (
                    <>
                      <span>
                        {language === "id"
                          ? "Masuk ke Akun"
                          : "Sign In"}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>

            <CardFooter className="flex flex-col items-center justify-center border-t border-slate-100 dark:border-[#2E2E34] py-4 bg-slate-50/50 dark:bg-[#17181C]">
              <p className="text-[11px] text-slate-400">
                The Lean Odoo Way • Multi-Tenant Architecture
              </p>
            </CardFooter>
          </Card>
        </div>
      ) : (
        /* ================= STEP 2: POST-LOGIN WORKSPACE LAUNCHER ================= */
        <div className="w-full max-w-4xl animate-in fade-in zoom-in-95 duration-200">
          <Card className="border-slate-200/90 dark:border-[#2E2E34] shadow-2xl dark:bg-[#1A1C20] rounded-3xl overflow-hidden backdrop-blur-md">
            {/* Header Strip */}
            <CardHeader className="px-6 sm:px-8 pt-7 pb-5 border-b border-slate-100 dark:border-[#2A2A30] bg-slate-50/50 dark:bg-white/[0.02]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#E2FF66]/20 flex items-center justify-center text-slate-900 dark:text-[#E2FF66] shrink-0 font-black">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <CardTitle className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                      {t.loginSelectWorkspaceTitle || (language === "id" ? "Pilih Lingkungan Bisnis / Workspace" : "Select Business Workspace")}
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {language === "id"
                        ? `Halo ${tempLoginData?.user.name || "Owner"}, pilih unit bisnis yang ingin Anda operasikan hari ini.`
                        : `Hello ${tempLoginData?.user.name || "Owner"}, select the business environment you want to operate today.`}
                    </CardDescription>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleBackToLogin}
                  className="rounded-full text-xs font-semibold gap-1.5 border-slate-200 dark:border-[#2E2E34] hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 cursor-pointer self-start sm:self-auto"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t.loginSwitchAccount || (language === "id" ? "Ganti Akun" : "Switch Account")}</span>
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-6 sm:p-8 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Superadmin Quick Access */}
              {superadminWs && (
                <div
                  onClick={() => handleLaunchWorkspace(superadminWs)}
                  className="group p-4 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/20 hover:border-indigo-400 dark:hover:border-indigo-700 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 group-hover:scale-105 transition-transform">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                          Superadmin Control Center
                        </h3>
                        <Badge className="bg-indigo-500 text-white font-bold text-[9px] rounded-full">
                          Root Admin
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {language === "id"
                          ? "Pusat konfigurasi multi-tenant, manajemen akun pemilik, dan audit keamanan sistem."
                          : "Multi-tenant configuration center, owner account management, and security audit logs."}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      disabled={launchingKey !== null}
                      className="rounded-full font-bold text-xs gap-1 bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer"
                    >
                      {launchingKey === `${superadminWs.business_id || "global"}-${superadminWs.outlet_id || "all"}-${superadminWs.role}` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <span>Masuk</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Businesses Workspace Grid */}
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {language === "id" ? "Portofolio Unit Usaha Anda" : "Your Business Portfolio"} ({bizEntries.length})
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {language === "id" ? "Pilih untuk memuat data" : "Select to load workspace"}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {bizEntries.map(([bizId, group]) => {
                    const isSingleOutlet = group.hasMultiOutlets === false;

                    return (
                      <div
                        key={bizId}
                        className="p-5 rounded-2xl border bg-white dark:bg-[#1E1E22] border-slate-200/80 dark:border-[#2E2E34] hover:border-slate-300 dark:hover:border-slate-600 shadow-xs transition-all flex flex-col justify-between"
                      >
                        <div>
                          {/* Business Header */}
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center shrink-0">
                                {getBusinessIcon(group.type, group.name)}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                                  {group.name}
                                </h4>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] font-bold px-2 py-0.2 rounded-md ${
                                      isSingleOutlet
                                        ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40"
                                        : "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/40"
                                    }`}
                                  >
                                    {isSingleOutlet ? (
                                      <span className="flex items-center gap-1">
                                        <Building className="w-2.5 h-2.5" /> Single Outlet
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-1">
                                        <GitBranch className="w-2.5 h-2.5" /> Multi-Cabang ({group.items.length})
                                      </span>
                                    )}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Capabilities Strip */}
                          <div className="flex flex-wrap items-center gap-1.5 mb-4">
                            {group.hasPos && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                                <ShoppingCart className="w-2.5 h-2.5 text-emerald-500" /> POS Kasir
                              </span>
                            )}
                            {group.hasMfg && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                                <Layers className="w-2.5 h-2.5 text-indigo-500" /> Pabrikasi BOM
                              </span>
                            )}
                            {group.hasHub && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                                <Send className="w-2.5 h-2.5 text-blue-500" /> Logistik Hub
                              </span>
                            )}
                            {group.hasEod && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                                <Flame className="w-2.5 h-2.5 text-rose-500" /> Konsumsi EOD
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action / Launch Button */}
                        <div className="pt-3 border-t border-slate-100 dark:border-[#2A2A30] space-y-2">
                          {isSingleOutlet || group.items.length === 1 ? (
                            // 1-Tap Launch for Single Outlet
                            (() => {
                              const primaryWs = group.items[0];
                              const key = `${primaryWs.business_id}-${primaryWs.outlet_id || "all"}-${primaryWs.role}`;
                              const isLaunching = launchingKey === key;

                              return (
                                <Button
                                  onClick={() => handleLaunchWorkspace(primaryWs)}
                                  disabled={launchingKey !== null}
                                  className="w-full rounded-full font-bold text-xs h-9 justify-between bg-[#E2FF66] hover:bg-[#D5F54E] text-slate-900 cursor-pointer shadow-xs"
                                >
                                  <span>{t.loginLaunchBusiness || (language === "id" ? "Buka Workspace" : "Launch Workspace")}</span>
                                  {isLaunching ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  )}
                                </Button>
                              );
                            })()
                          ) : (
                            // Branch / Outlet Selector for Multi-Outlet
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block px-1">
                                {language === "id" ? "Pilih Cabang Operasional:" : "Select Branch:"}
                              </span>
                              <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                                {group.items.map((ws) => {
                                  const key = `${ws.business_id}-${ws.outlet_id || "all"}-${ws.role}`;
                                  const isLaunching = launchingKey === key;

                                  return (
                                    <button
                                      key={key}
                                      type="button"
                                      onClick={() => handleLaunchWorkspace(ws)}
                                      disabled={launchingKey !== null}
                                      className="w-full flex items-center justify-between p-2 rounded-xl text-left bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors border border-slate-200/60 dark:border-[#2E2E34] text-xs font-semibold cursor-pointer group"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <MapPin className="w-3 h-3 text-slate-400 group-hover:text-blue-500 shrink-0" />
                                        <span className="truncate text-slate-800 dark:text-slate-200">
                                          {ws.outlet_name || "Semua Cabang (Owner)"}
                                        </span>
                                      </div>
                                      {isLaunching ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                                      ) : (
                                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white shrink-0" />
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex items-center justify-between border-t border-slate-100 dark:border-[#2E2E34] py-4 px-8 bg-slate-50/50 dark:bg-[#17181C]">
              <p className="text-[11px] text-slate-400">
                The Lean Odoo Way • Isolated Context Initialization
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToLogin}
                className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                {language === "id" ? "Bukan Anda? Keluar" : "Not you? Sign Out"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Forgot Password Modal Dialog */}
      <Dialog open={isForgotModalOpen} onOpenChange={setIsForgotModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-white dark:bg-[#1A1C20] border-slate-200 dark:border-[#2E2E34]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-primary" />
              <span>
                {language === "id"
                  ? "Pemulihan Kata Sandi"
                  : "Password Recovery"}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {forgotStep === "request"
                ? language === "id"
                  ? "Masukkan alamat Gmail terdaftar Anda untuk menerima kode OTP verifikasi pemulihan."
                  : "Enter your registered Gmail address to receive recovery OTP code."
                : language === "id"
                ? "Masukkan kode OTP 6-digit dan buat kata sandi baru untuk akun Anda."
                : "Enter the 6-digit OTP code and set a new password."}
            </DialogDescription>
          </DialogHeader>

          {forgotStep === "request" ? (
            <form onSubmit={handleRequestReset} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="forgot-email" className="text-xs font-semibold">
                  {language === "id" ? "Email Akun Gmail" : "Registered Gmail"}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="nama@gmail.com"
                    className="pl-10 h-10 rounded-xl"
                    required
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="rounded-xl h-10 text-xs"
                >
                  {language === "id" ? "Batal" : "Cancel"}
                </Button>
                <Button
                  type="submit"
                  disabled={forgotLoading}
                  className="rounded-xl h-10 text-xs font-bold bg-[#E2FF66] text-black hover:bg-[#D5F54E]"
                >
                  {forgotLoading
                    ? language === "id"
                      ? "Mengirim..."
                      : "Sending..."
                    : language === "id"
                    ? "Kirim Kode OTP"
                    : "Send OTP Code"}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <form onSubmit={handlePerformReset} className="space-y-4 py-2">
              <div className="space-y-2 flex flex-col items-center">
                <Label className="text-xs font-semibold self-start">
                  {language === "id"
                    ? "Kode OTP 6 Digit"
                    : "6-Digit OTP Code"}
                </Label>
                <InputOTP
                  maxLength={6}
                  value={resetOTP}
                  onChange={(val) => setResetOTP(val)}
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

              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-xs font-semibold">
                  {language === "id" ? "Kata Sandi Baru" : "New Password"}
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="pr-10 h-10 rounded-xl"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5"
                    tabIndex={-1}
                    title={showNewPassword ? "Sembunyikan" : "Tampilkan"}
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-xs font-semibold">
                  {language === "id"
                    ? "Konfirmasi Kata Sandi Baru"
                    : "Confirm New Password"}
                </Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi kata sandi baru"
                    className="pr-10 h-10 rounded-xl"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5"
                    tabIndex={-1}
                    title={showConfirmPassword ? "Sembunyikan" : "Tampilkan"}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForgotStep("request")}
                  className="rounded-xl h-10 text-xs"
                >
                  {language === "id" ? "Kembali" : "Back"}
                </Button>
                <Button
                  type="submit"
                  disabled={forgotLoading}
                  className="rounded-xl h-10 text-xs font-bold bg-[#E2FF66] text-black hover:bg-[#D5F54E]"
                >
                  {forgotLoading
                    ? language === "id"
                      ? "Menyimpan..."
                      : "Saving..."
                    : language === "id"
                    ? "Simpan Kata Sandi Baru"
                    : "Update Password"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
