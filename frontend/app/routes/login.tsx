import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { api } from "../lib/api";
import { useAuthStore } from "../lib/store";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isExpired = searchParams.get("expired") === "true";

  const setSession = useAuthStore((state) => state.setSession);

  // Tab state: "password" vs "pin"
  const [loginMethod, setLoginMethod] = useState<"password" | "pin">("password");

  // Inputs
  const [phoneOrEmail, setPhoneOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload: any = {};
      if (loginMethod === "password") {
        if (!phoneOrEmail || !password) {
          throw new Error("Mohon isi email/telepon dan password");
        }
        payload.phone_or_email = phoneOrEmail;
        payload.password = password;
      } else {
        if (!pin) {
          throw new Error("Mohon masukkan kode PIN");
        }
        if (phoneOrEmail) {
          payload.phone_or_email = phoneOrEmail;
        }
        payload.pin = pin;
      }

      const response = await api.post("/auth/login", payload);
      const { user, workspaces, active_context } = response.data;

      // Save to Zustand
      setSession(user, workspaces, active_context);

      // Redirect to home
      navigate("/");
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.response?.data?.message || err.message || "Gagal masuk ke akun");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-100 shadow-xl rounded-card p-8 transition-all duration-300">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">
            Andaya ERP
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            Multi-Tenant Business Workspace
          </p>
        </div>

        {isExpired && (
          <div className="mb-6 p-4 bg-amber-50 text-amber-700 text-sm font-medium rounded-button border border-amber-100">
            Sesi Anda telah berakhir. Silakan masuk kembali.
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm font-medium rounded-button border border-red-100">
            {error}
          </div>
        )}

        {/* Segmented Control / Tab Switcher (One UI Pill Design System) */}
        <div className="flex bg-slate-100 p-1.5 rounded-pill mb-8">
          <button
            type="button"
            onClick={() => { setLoginMethod("password"); setError(""); }}
            className={`flex-1 py-3 text-sm font-semibold rounded-pill transition-all duration-250 cursor-pointer ${
              loginMethod === "password"
                ? "bg-white text-slate-900 shadow-md"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Password (Owner/Manager)
          </button>
          <button
            type="button"
            onClick={() => { setLoginMethod("pin"); setError(""); }}
            className={`flex-1 py-3 text-sm font-semibold rounded-pill transition-all duration-250 cursor-pointer ${
              loginMethod === "pin"
                ? "bg-white text-slate-900 shadow-md"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            PIN (Staff Kasir)
          </button>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {loginMethod === "password" ? (
            <>
              <div>
                <label className="block text-slate-700 text-sm font-bold mb-2 ml-1" htmlFor="email">
                  Email atau Telepon
                </label>
                <input
                  id="email"
                  type="text"
                  value={phoneOrEmail}
                  onChange={(e) => setPhoneOrEmail(e.target.value)}
                  placeholder="name@andaya.com"
                  className="w-full px-4 py-4 rounded-button border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all bg-slate-50 text-slate-900"
                  style={{ minHeight: "56px" }}
                />
              </div>

              <div>
                <label className="block text-slate-700 text-sm font-bold mb-2 ml-1" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-4 rounded-button border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all bg-slate-50 text-slate-900"
                  style={{ minHeight: "56px" }}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-slate-700 text-sm font-bold mb-2 ml-1" htmlFor="staff-email">
                  Email atau Telepon (Opsional)
                </label>
                <input
                  id="staff-email"
                  type="text"
                  value={phoneOrEmail}
                  onChange={(e) => setPhoneOrEmail(e.target.value)}
                  placeholder="Kosongkan jika hanya menggunakan PIN global"
                  className="w-full px-4 py-4 rounded-button border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all bg-slate-50 text-slate-900"
                  style={{ minHeight: "56px" }}
                />
              </div>

              <div>
                <label className="block text-slate-700 text-sm font-bold mb-2 ml-1" htmlFor="pin">
                  Kode PIN Kasir
                </label>
                <input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Masukkan 4-6 digit PIN"
                  className="w-full text-center tracking-widest text-2xl px-4 py-4 rounded-button border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all bg-slate-50 text-slate-900"
                  style={{ minHeight: "56px" }}
                />
              </div>
            </>
          )}

          {/* Submit Button (Touch target min 56px) */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center font-bold text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/40 rounded-button shadow-md transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-250 cursor-pointer"
            style={{ minHeight: "56px" }}
          >
            {loading ? "Menghubungkan..." : "Masuk ke Dashboard"}
          </button>
        </form>

      </div>
    </div>
  );
}
