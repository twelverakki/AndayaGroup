import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./dialog";
import { Slider } from "./slider";
import { Minus, Plus, Check, X } from "lucide-react";

export type QuickSliderMode = "percent" | "numeric" | "currency";

export interface QuickSliderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  /** Judul atau konteks nilai yang diatur (misal: "Indomie Goreng 85g", "Diskon Faktur", "Markup Margin") */
  title?: string;
  /** Sub-keterangan tambahan di atas (opsional) */
  subtitle?: string;

  /**
   * Nilai utama yang diatur lewat slider/input (untuk single mode atau default percent).
   */
  value?: number;

  /**
   * Dukungan 2 value saling berkaitan:
   * percent: nilai persentase (0 - 100)
   * amount: nilai nominal rupiah
   */
  percent?: number;
  amount?: number;

  /** Mode input: 'percent' (default, %), 'numeric' (angka murni/qty), atau 'currency' (Rp) */
  mode?: QuickSliderMode;

  /** Satuan unit jika mode 'numeric', misal: 'Pcs', 'Kg', 'Dus', 'Box'. Jika 'percent', otomatis '%' */
  unitLabel?: string;

  /** Batas minimum (default: 0) */
  min?: number;
  /** Batas maksimum (default: 100 untuk percent) */
  max?: number;
  /** Nilai kenaikan per klik stepper / slider (default: 1) */
  step?: number;

  /** Nilai acuan / bruto dasar (misal total harga item) untuk menghubungkan percent & amount */
  baseAmount?: number;
  /** Label keterangan untuk kalkulasi di Row 1 (default: "Hasil Kalkulasi" / "Potongan") */
  baseAmountLabel?: string;

  /** Callback saat tombol 'Terapkan' ditekan, mengembalikan kedua nilai (primary & linked amount) */
  onApply: (primaryValue: number, linkedAmount?: number) => void;
}

function sanitizeNumber(val: any, fallback = 0): number {
  if (typeof val === "number" && !isNaN(val) && isFinite(val)) {
    return val;
  }
  const parsed = parseFloat(val);
  return !isNaN(parsed) && isFinite(parsed) ? parsed : fallback;
}

export function QuickSliderDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  value: propValue,
  percent: propPercent,
  amount: propAmount,
  mode = "percent",
  unitLabel,
  min: propMin = 0,
  max: propMax = mode === "percent" ? 100 : 1000,
  step: propStep = 1,
  baseAmount: propBaseAmount,
  baseAmountLabel,
  onApply,
}: QuickSliderDialogProps) {
  const min = sanitizeNumber(propMin, 0);
  const max = sanitizeNumber(propMax, mode === "percent" ? 100 : 1000);
  const step = Math.max(0.01, sanitizeNumber(propStep, 1));
  const baseAmount = typeof propBaseAmount === "number" ? sanitizeNumber(propBaseAmount, 0) : undefined;

  // Resolusi nilai awal: prioritaskan propPercent jika diberikan, lalu propValue, lalu hitung dari propAmount
  const resolveInitialPercent = (): number => {
    if (typeof propPercent === "number" && !isNaN(propPercent)) {
      return sanitizeNumber(propPercent, 0);
    }
    if (typeof propValue === "number" && !isNaN(propValue)) {
      return sanitizeNumber(propValue, 0);
    }
    if (typeof propAmount === "number" && propAmount > 0 && baseAmount && baseAmount > 0) {
      return Math.min(100, Math.round((propAmount / baseAmount) * 100));
    }
    return 0;
  };

  // State nilai utama slider (misal Persentase atau Qty)
  const [currentValue, setCurrentValue] = useState<number>(() => {
    const init = resolveInitialPercent();
    return Math.min(max, Math.max(min, init));
  });

  // Sinkronisasi saat dialog dibuka
  useEffect(() => {
    if (open) {
      const init = resolveInitialPercent();
      setCurrentValue(Math.min(max, Math.max(min, init)));
    }
  }, [open, propValue, propPercent, propAmount, baseAmount, min, max]);

  // Kalkulasi nilai terhubung (Linked Amount, misal Rupiah)
  const calculatedNominal =
    baseAmount !== undefined
      ? mode === "percent"
        ? Math.round((baseAmount * currentValue) / 100)
        : Math.round(baseAmount * currentValue)
      : propAmount !== undefined
      ? sanitizeNumber(propAmount, 0)
      : undefined;

  const handleMinus = () => {
    setCurrentValue((prev) => {
      const safePrev = sanitizeNumber(prev, min);
      return Math.max(min, Number((safePrev - step).toFixed(2)));
    });
  };

  const handlePlus = () => {
    setCurrentValue((prev) => {
      const safePrev = sanitizeNumber(prev, min);
      return Math.min(max, Number((safePrev + step).toFixed(2)));
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === "") {
      setCurrentValue(min);
      return;
    }
    const parsed = parseFloat(raw);
    if (isNaN(parsed) || !isFinite(parsed)) {
      setCurrentValue(min);
    } else {
      setCurrentValue(Math.min(max, Math.max(min, parsed)));
    }
  };

  const handleConfirm = () => {
    const safeFinalVal = sanitizeNumber(currentValue, min);
    const safeFinalNominal =
      calculatedNominal !== undefined ? sanitizeNumber(calculatedNominal, 0) : undefined;
    onApply(safeFinalVal, safeFinalNominal);
    onOpenChange(false);
  };

  const displayUnit = mode === "percent" ? "%" : mode === "currency" ? "" : unitLabel || "";
  const displayVal = sanitizeNumber(currentValue, min);
  const displayNominal = calculatedNominal !== undefined ? sanitizeNumber(calculatedNominal, 0) : 0;
  const displayBase = baseAmount !== undefined ? sanitizeNumber(baseAmount, 0) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-md w-[92vw] p-0 border-0 bg-transparent shadow-none"
      >
        {/* Accessible hidden dialog header */}
        <div className="sr-only">
          <DialogTitle>{title || "Atur Nilai"}</DialogTitle>
          <DialogDescription>Sesuaikan nilai cepat menggunakan slider</DialogDescription>
        </div>

        {/* Frameless floating surface with surrounding gradient opacity */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-white/95 dark:bg-black/95 backdrop-blur-2xl p-7 sm:p-9 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.25)] dark:shadow-[0_25px_60px_-15px_rgba(255,255,255,0.06)] ring-1 ring-black/5 dark:ring-white/10">
          {/* Ambient soft glow backdrop inside container */}
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-indigo-500/10 dark:bg-[#E2FF66]/10 blur-3xl" />

          <div className="relative space-y-6">
            {/* Header info (context title / subtitle) */}
            {(title || subtitle) && (
              <div className="text-center space-y-0.5">
                {title && (
                  <div className="text-xs font-semibold text-slate-700 dark:text-neutral-300 line-clamp-1">
                    {title}
                  </div>
                )}
                {subtitle && (
                  <div className="text-[11px] text-slate-400 dark:text-neutral-500 line-clamp-1">
                    {subtitle}
                  </div>
                )}
              </div>
            )}

            {/* ─── ROW 1: DISPLAY NILAI TERKAIT (LINKED NOMINAL RUPIAH) ─── */}
            {calculatedNominal !== undefined ? (
              <div className="text-center space-y-1">
                {baseAmountLabel && (
                  <span className="text-[11px] font-bold tracking-wider text-slate-400 dark:text-neutral-500 uppercase">
                    {baseAmountLabel}
                  </span>
                )}
                <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                  Rp {displayNominal.toLocaleString("id-ID")}
                </div>
                {baseAmount !== undefined && baseAmount > 0 && (
                  <div className="text-[11px] text-slate-400 dark:text-neutral-500 font-medium">
                    dari total Rp {displayBase.toLocaleString("id-ID")}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center">
                <span className="text-[11px] font-medium text-slate-400 dark:text-neutral-500">
                  Rentang: {min.toLocaleString("id-ID")} — {max.toLocaleString("id-ID")}{" "}
                  {displayUnit}
                </span>
              </div>
            )}

            {/* ─── ROW 2: FIELD FRAMELESS, MINUS & PLUS, FONT SIZE SUPER BESAR ─── */}
            <div className="flex items-center justify-center gap-3 sm:gap-4 py-2">
              <button
                type="button"
                onClick={handleMinus}
                disabled={displayVal <= min}
                className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-slate-800 dark:text-neutral-200 flex items-center justify-center transition active:scale-90 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                title={`Kurangi ${step}`}
              >
                <Minus className="w-5 h-5 sm:w-6 sm:h-6 stroke-[3]" />
              </button>

              <div className="flex items-baseline justify-center">
                {mode === "currency" && (
                  <span className="text-2xl sm:text-3xl font-black text-slate-400 dark:text-neutral-600 select-none mr-1">
                    Rp
                  </span>
                )}
                <input
                  type="number"
                  min={min}
                  max={max}
                  step={step}
                  value={displayVal === 0 && min < 0 ? 0 : displayVal === 0 ? "" : displayVal}
                  onChange={handleInputChange}
                  placeholder="0"
                  className="w-28 sm:w-36 text-center text-5xl sm:text-6xl font-black text-slate-900 dark:text-white bg-transparent border-0 outline-none p-0 tracking-tighter placeholder:text-slate-300 dark:placeholder:text-neutral-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  autoFocus
                />
                {displayUnit && (
                  <span className="text-3xl sm:text-4xl font-black text-slate-400 dark:text-neutral-600 select-none ml-1">
                    {displayUnit}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handlePlus}
                disabled={displayVal >= max}
                className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-slate-800 dark:text-neutral-200 flex items-center justify-center transition active:scale-90 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                title={`Tambah ${step}`}
              >
                <Plus className="w-5 h-5 sm:w-6 sm:h-6 stroke-[3]" />
              </button>
            </div>

            {/* ─── ROW 3: SLIDER TRACK (REAKTIF & AMAN: HANDLE NUMBER ATAU ARRAY) ─── */}
            <div className="pt-2">
              <Slider
                value={[displayVal]}
                min={min}
                max={max}
                step={step}
                onValueChange={(val: any) => {
                  // Ekstrak angka murni baik val berupa number maupun array [number]
                  const rawNum = Array.isArray(val) ? val[0] : typeof val === "number" ? val : undefined;
                  if (rawNum !== undefined) {
                    setCurrentValue(sanitizeNumber(rawNum, min));
                  }
                }}
                className="w-full"
              />
            </div>

            {/* Action Buttons: Large full rounded icon-only (X and Check) */}
            <div className="pt-4 flex items-center justify-center gap-5 sm:gap-6">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white flex items-center justify-center transition active:scale-90 cursor-pointer shadow-xs"
                title="Batalkan"
                aria-label="Batalkan"
              >
                <X className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.5]" />
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-slate-900 hover:bg-slate-800 text-white dark:bg-[#E2FF66] dark:text-slate-900 dark:hover:bg-[#d4f54e] flex items-center justify-center transition active:scale-90 cursor-pointer shadow-md"
                title="Terapkan"
                aria-label="Terapkan"
              >
                <Check className="w-6 h-6 sm:w-7 sm:h-7 stroke-[3]" />
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
