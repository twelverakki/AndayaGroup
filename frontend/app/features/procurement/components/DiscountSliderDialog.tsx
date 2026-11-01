import React from "react";
import { QuickSliderDialog } from "../../../components/ui/quick-slider-dialog";

export interface DiscountSliderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName?: string;
  grossAmount: number;
  initialPercent?: number;
  initialAmount?: number;
  onApply: (percent: number, amount: number) => void;
}

function safe(val: any): number {
  if (typeof val === "number" && !isNaN(val) && isFinite(val)) {
    return val;
  }
  const parsed = parseFloat(val);
  return !isNaN(parsed) && isFinite(parsed) ? parsed : 0;
}

/**
 * Adapter pembungkus untuk QuickSliderDialog yang dikhususkan untuk potongan diskon.
 * Mengirimkan 2 value yang saling berkaitan (percent & amount) ke QuickSliderDialog.
 */
export function DiscountSliderDialog({
  open,
  onOpenChange,
  itemName,
  grossAmount = 0,
  initialPercent = 0,
  initialAmount = 0,
  onApply,
}: DiscountSliderDialogProps) {
  const safeGross = safe(grossAmount);
  const safePercent = safe(initialPercent);
  const safeAmount = safe(initialAmount);

  return (
    <QuickSliderDialog
      open={open}
      onOpenChange={onOpenChange}
      title={itemName}
      mode="percent"
      min={0}
      max={100}
      step={1}
      percent={safePercent}
      amount={safeAmount}
      baseAmount={safeGross}
      baseAmountLabel="Potongan Diskon"
      onApply={(val, calculatedAmount) => {
        const safeVal = safe(val);
        const nom =
          calculatedAmount !== undefined
            ? safe(calculatedAmount)
            : Math.round((safeGross * safeVal) / 100);
        onApply(safeVal, nom);
      }}
    />
  );
}
