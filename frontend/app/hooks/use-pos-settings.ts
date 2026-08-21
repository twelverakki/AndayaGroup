import { create } from "zustand";

interface POSSettingsState {
  showNumpad: boolean;
  gridCols: number;
  enableTax: boolean;
  enableDiscount: boolean;
  setShowNumpad: (show: boolean) => void;
  setGridCols: (cols: number) => void;
  setEnableTax: (enable: boolean) => void;
  setEnableDiscount: (enable: boolean) => void;
}

export const usePOSSettings = create<POSSettingsState>((set) => ({
  showNumpad: (() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("pos_show_numpad");
    return saved === null ? true : saved === "true";
  })(),
  gridCols: (() => {
    if (typeof window === "undefined") return 4;
    const saved = localStorage.getItem("pos_grid_cols");
    return saved === null ? 4 : parseInt(saved, 10);
  })(),
  enableTax: (() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("pos_enable_tax") === "true";
  })(),
  enableDiscount: (() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("pos_enable_discount") === "true";
  })(),

  setShowNumpad: (show) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pos_show_numpad", String(show));
    }
    set({ showNumpad: show });
  },

  setGridCols: (cols) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pos_grid_cols", String(cols));
    }
    set({ gridCols: cols });
  },

  setEnableTax: (enable) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pos_enable_tax", String(enable));
    }
    set({ enableTax: enable });
  },

  setEnableDiscount: (enable) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pos_enable_discount", String(enable));
    }
    set({ enableDiscount: enable });
  },
}));
