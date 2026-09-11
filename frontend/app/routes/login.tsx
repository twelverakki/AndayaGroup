import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { api } from "../lib/api";
import { useAuthStore } from "../lib/store";
import { useLanguageStore, translations } from "../lib/i18n";
import { toast } from "../components/ui/sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
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
  CheckCircle2,
  AlertCircle,
  Globe,
  Sun,
  Moon,
  Eye,
  EyeOff,
} from "lucide-react";
import { useTheme } from "../hooks/use-theme";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isExpired = searchParams.get("expired") === "true";

  const { language, toggleLanguage } = useLanguageStore();
  const { isDark, toggleTheme } = useTheme();
  const t = translations[language] || translations.id;
  const setSession = useAuthStore((state) => state.setSession);

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

      // Save session in Zustand store
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

      <div className="w-full max-w-md">
        {/* Main Card Container */}
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
            {/* Session Expired Alert */}
            {isExpired && (
              <div className="flex items-center gap-2.5 p-3.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-medium rounded-xl border border-amber-500/20">
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
                        ? "Masuk ke Workspace"
                        : "Enter Workspace"}
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
