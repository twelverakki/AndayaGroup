import { useState, useEffect } from "react";
import { Toaster as Sonner, toast } from "sonner";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, Loader2 } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");

    const observer = new MutationObserver(() => {
      const darkNow = document.documentElement.classList.contains("dark");
      setTheme(darkNow ? "dark" : "light");
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      position="bottom-right"
      richColors={false}
      closeButton
      visibleToasts={5}
      icons={{
        success: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 stroke-[2.5]" />,
        info: <Info className="w-4 h-4 text-blue-500 dark:text-[#E2FF66] shrink-0 stroke-[2.5]" />,
        warning: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 stroke-[2.5]" />,
        error: <AlertCircle className="w-4 h-4 text-red-500 shrink-0 stroke-[2.5]" />,
        loading: <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0 stroke-[2.5]" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white dark:group-[.toaster]:bg-[#202024] group-[.toaster]:text-slate-900 dark:group-[.toaster]:text-slate-100 group-[.toaster]:border-slate-200/80 dark:group-[.toaster]:border-[#38383C] group-[.toaster]:shadow-2xl group-[.toaster]:rounded-2xl group-[.toaster]:p-4 font-sans text-xs font-semibold flex items-center gap-3",
          description: "group-[.toast]:text-slate-500 dark:group-[.toast]:text-slate-400 text-[11px] font-normal",
          actionButton:
            "group-[.toast]:bg-slate-900 group-[.toast]:text-white dark:group-[.toast]:bg-[#E2FF66] dark:group-[.toast]:text-slate-900 font-bold rounded-full text-xs px-3 py-1.5",
          cancelButton:
            "group-[.toast]:bg-slate-100 group-[.toast]:text-slate-600 dark:group-[.toast]:bg-white/10 dark:group-[.toast]:text-slate-300 font-bold rounded-full text-xs px-3 py-1.5",
          closeButton:
            "group-[.toast]:bg-slate-100 dark:group-[.toast]:bg-[#2A2A2E] group-[.toast]:text-slate-500 dark:group-[.toast]:text-slate-300 group-[.toast]:border-slate-200 dark:group-[.toast]:border-[#38383C]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
