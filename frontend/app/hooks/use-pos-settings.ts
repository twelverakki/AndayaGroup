import { create } from "zustand";

interface POSSettingsState {
  showNumpad: boolean;
  gridCols: number;
  enableTax: boolean;
  enableDiscount: boolean;
  pinnedItemIds: string[];
  setShowNumpad: (show: boolean) => void;
  setGridCols: (cols: number) => void;
  setEnableTax: (enable: boolean) => void;
  setEnableDiscount: (enable: boolean) => void;
  togglePinItem: (productId: string) => boolean;
  isItemPinned: (productId: string) => boolean;
}

export const usePOSSettings = create<POSSettingsState>((set, get) => ({
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
  pinnedItemIds: (() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("pos_pinned_item_ids");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
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

  togglePinItem: (productId: string) => {
    const current = get().pinnedItemIds;
    const exists = current.includes(productId);
    const updated = exists ? current.filter((id) => id !== productId) : [productId, ...current];
    
    if (typeof window !== "undefined") {
      localStorage.setItem("pos_pinned_item_ids", JSON.stringify(updated));
      window.dispatchEvent(new Event("pos_settings_changed"));
    }
    set({ pinnedItemIds: updated });
    return !exists;
  },

  isItemPinned: (productId: string) => {
    return get().pinnedItemIds.includes(productId);
  },
}));
