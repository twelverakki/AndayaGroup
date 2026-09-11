import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { AlertTriangle, Trash2, CheckCircle2 } from "lucide-react";
import { useLanguageStore } from "../lib/i18n";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "warning" | "default";
  loading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  cancelText,
  variant = "destructive",
  loading = false,
}: ConfirmDialogProps) {
  const { language } = useLanguageStore();

  const defaultTitle =
    variant === "destructive"
      ? language === "en"
        ? "Delete Item?"
        : "Konfirmasi Hapus Data?"
      : language === "en"
      ? "Confirm Action?"
      : "Konfirmasi Aksi?";

  const defaultDesc =
    variant === "destructive"
      ? language === "en"
        ? "This action cannot be undone. Are you sure you want to proceed?"
        : "Tindakan ini tidak dapat dibatalkan. Apakah Anda yakin ingin menghapus data ini?"
      : language === "en"
      ? "Are you sure you want to proceed?"
      : "Apakah Anda yakin ingin melanjutkan?";

  const defaultConfirmText =
    variant === "destructive"
      ? language === "en"
        ? "Delete"
        : "Hapus Data"
      : language === "en"
      ? "Confirm"
      : "Konfirmasi";

  const defaultCancelText = language === "en" ? "Cancel" : "Batal";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-card bg-card text-card-foreground border-border p-6 space-y-4">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                variant === "destructive"
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : variant === "warning"
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {variant === "destructive" ? (
                <Trash2 className="w-5 h-5" />
              ) : variant === "warning" ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                {title || defaultTitle}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {description || defaultDesc}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogFooter className="pt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-button border border-border text-foreground font-semibold text-xs hover:bg-muted transition-all cursor-pointer"
          >
            {cancelText || defaultCancelText}
          </button>
          <button
            type="button"
            onClick={async () => {
              await onConfirm();
              onClose();
            }}
            disabled={loading}
            className={`px-4 py-2 rounded-button font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
              variant === "destructive"
                ? "bg-rose-600 text-white hover:bg-rose-700 shadow-xs"
                : variant === "warning"
                ? "bg-amber-600 text-white hover:bg-amber-700 shadow-xs"
                : "bg-primary text-primary-foreground hover:opacity-90 shadow-xs"
            }`}
          >
            {loading && <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
            {confirmText || defaultConfirmText}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
