import { create } from "zustand";

export interface User {
  id: string;
  name: string;
  phone_or_email?: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  business_id?: string;
  outlet_id?: string;
  business_name: string;
  outlet_name?: string;
  is_main_outlet?: boolean;
  role: "owner" | "manager" | "admin_gudang" | "staff" | "superadmin";
  business_type: "retail" | "fnb_production" | "fnb_franchise" | "fnb_branch";
  has_pos?: boolean;
  has_manufacturing?: boolean;
  has_logistics_hub?: boolean;
  has_eod_usage?: boolean;
  has_multi_outlets?: boolean;
  hide_central_stock_from_branches?: boolean;
  allow_cross_branch_stock_view?: boolean;
}

export interface ActiveContext {
  business_id?: string;
  outlet_id?: string;
  business_name?: string;
  outlet_name?: string;
  is_main_outlet?: boolean;
  role: string;
  name: string;
  type?: "retail" | "fnb_production" | "fnb_franchise" | "fnb_branch";
  has_pos?: boolean;
  has_manufacturing?: boolean;
  has_logistics_hub?: boolean;
  has_eod_usage?: boolean;
  has_multi_outlets?: boolean;
  hide_central_stock_from_branches?: boolean;
  allow_cross_branch_stock_view?: boolean;
}

export interface ActiveShift {
  id: string;
  outlet_id: string;
  staff_id: string;
  opening_cash: number;
  status: "open" | "closed";
  opened_at: string;
}

interface AuthState {
  user: User | null;
  workspaces: Workspace[];
  activeContext: ActiveContext | null;
  isAuthenticated: boolean;
  activeShift: ActiveShift | null;
  setSession: (user: User, workspaces: Workspace[], activeContext: ActiveContext) => void;
  updateActiveContext: (activeContext: ActiveContext) => void;
  clearSession: () => void;
  setActiveShift: (shift: ActiveShift | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  workspaces: [],
  activeContext: null,
  isAuthenticated: false,
  activeShift: null,

  setSession: (user, workspaces, activeContext) => set({
    user,
    workspaces,
    activeContext,
    isAuthenticated: true,
  }),

  updateActiveContext: (activeContext) => set({
    activeContext,
    activeShift: null, // clear active shift context on workspace context switch
  }),

  clearSession: () => set({
    user: null,
    workspaces: [],
    activeContext: null,
    isAuthenticated: false,
    activeShift: null,
  }),

  setActiveShift: (activeShift) => set({ activeShift }),
}));

interface ShellState {
  isDesktop: boolean;
  isWorkspaceLauncherOpen: boolean;
  setDesktop: (isDesktop: boolean) => void;
  setWorkspaceLauncherOpen: (isOpen: boolean) => void;
}

export const useShellStore = create<ShellState>((set) => ({
  isDesktop: false,
  isWorkspaceLauncherOpen: false,
  setDesktop: (isDesktop) => set({ isDesktop }),
  setWorkspaceLauncherOpen: (isWorkspaceLauncherOpen) => set({ isWorkspaceLauncherOpen }),
}));
