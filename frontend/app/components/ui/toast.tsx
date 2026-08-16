import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "../../lib/utils";

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-3 overflow-hidden rounded-2xl border p-4 shadow-xl transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full text-xs font-semibold",
  {
    variants: {
      variant: {
        default:
          "bg-white dark:bg-[#202024] text-slate-900 dark:text-slate-100 border-slate-200/80 dark:border-[#38383C]",
        destructive:
          "bg-white dark:bg-[#202024] text-slate-900 dark:text-slate-100 border-red-200 dark:border-red-900/40",
        success:
          "bg-white dark:bg-[#202024] text-slate-900 dark:text-slate-100 border-emerald-200 dark:border-emerald-900/40",
        info:
          "bg-white dark:bg-[#202024] text-slate-900 dark:text-slate-100 border-blue-200 dark:border-blue-900/40",
        warning:
          "bg-white dark:bg-[#202024] text-slate-900 dark:text-slate-100 border-amber-200 dark:border-amber-900/40",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface ToastItemProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof toastVariants> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  onClose?: () => void;
}

const ToastIcon = ({ variant }: { variant?: VariantProps<typeof toastVariants>["variant"] }) => {
  switch (variant) {
    case "success":
      return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 stroke-[2.5]" />;
    case "destructive":
      return <AlertCircle className="w-4 h-4 text-red-500 shrink-0 stroke-[2.5]" />;
    case "warning":
      return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 stroke-[2.5]" />;
    case "info":
      return <Info className="w-4 h-4 text-blue-500 dark:text-[#E2FF66] shrink-0 stroke-[2.5]" />;
    default:
      return <Info className="w-4 h-4 text-slate-400 shrink-0 stroke-[2.5]" />;
  }
};

const Toast = React.forwardRef<HTMLDivElement, ToastItemProps>(
  ({ className, variant = "default", title, description, action, onClose, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(toastVariants({ variant }), className)}
        {...props}
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <ToastIcon variant={variant} />
          <div className="grid gap-0.5 flex-1 min-w-0 text-left">
            {title && (
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {title}
              </div>
            )}
            {description && (
              <div className="text-[11px] font-normal text-slate-600 dark:text-slate-400 leading-snug">
                {description}
              </div>
            )}
            {children}
          </div>
        </div>
        {action}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
            title="Tutup"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }
);
Toast.displayName = "Toast";

export { Toast, toastVariants, ToastIcon };
