import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../lib/api";
import { useAuthStore, useShellStore } from "../lib/store";
import DesktopShell from "../components/DesktopShell";
import MobileShell from "../components/MobileShell";

export default function Home() {
  const navigate = useNavigate();
  const { user, isAuthenticated, activeContext, setSession } = useAuthStore();
  const isDesktop = useShellStore((state) => state.isDesktop);
  const [checkingAuth, setCheckingAuth] = useState(!isAuthenticated);

  useEffect(() => {
    const verifyAuth = async () => {
      if (isAuthenticated) {
        setCheckingAuth(false);
        return;
      }

      try {
        const response = await api.get("/auth/me");
        const { user, workspaces, active_context } = response.data;
        
        // Save to Zustand
        setSession(user, workspaces, active_context);
      } catch (err) {
        console.error("Auth verification failed:", err);
        navigate("/login");
      } finally {
        setCheckingAuth(false);
      }
    };

    verifyAuth();
  }, [isAuthenticated, setSession, navigate]);

  if (checkingAuth) {
    // Premium loading splash screen (One UI smooth design)
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-foreground">
        <div className="w-16 h-16 rounded-pill bg-primary animate-pulse flex items-center justify-center mb-4 shadow-md text-primary-foreground">
          <span className="font-semibold text-xl">A</span>
        </div>
        <p className="text-sm font-semibold text-muted-foreground tracking-wide animate-pulse">
          Memuat Workspace Anda...
        </p>
      </div>
    );
  }

  // Render Shell conditionally based on screen size breakpoint (D-20)
  if (isDesktop) {
    return <DesktopShell />;
  }

  return <MobileShell />;
}
