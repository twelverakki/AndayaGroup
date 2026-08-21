import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ClipboardCheck,
  Layers,
  Send,
  Shield,
  FileSpreadsheet,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import React from "react";

export interface MenuItem {
  id: string;
  translationKey: string;
  defaultLabel: string;
  icon: React.ComponentType<any>;
  iconClassName?: string;
  allowedRoles?: string[];
  excludeRoles?: string[];
  allowedTypes?: string[];
  excludeTypes?: string[];
  onlyTypes?: string[];
  requiredRoles?: string[];
  subItems?: { id: string; translationKey: string; defaultLabel: string }[];
}

export const sidebarMenuConfig: MenuItem[] = [
  {
    id: "dashboard",
    translationKey: "menuDashboard",
    defaultLabel: "Dashboard",
    icon: LayoutDashboard,
    allowedRoles: ["owner", "manager", "staff", "admin_gudang", "superadmin"],
  },
  {
    id: "pos",
    translationKey: "menuPos",
    defaultLabel: "Point of Sale",
    icon: ShoppingCart,
    allowedRoles: ["owner", "manager", "staff"],
    excludeTypes: ["fnb_production"],
    excludeRoles: ["superadmin", "admin_gudang"],
  },
  {
    id: "inventory",
    translationKey: "menuInventory",
    defaultLabel: "Inventory",
    icon: Package,
    allowedRoles: ["owner", "manager"],
    excludeTypes: ["fnb_production"],
    excludeRoles: ["superadmin", "admin_gudang"],
    subItems: [
      { id: "inventory-master", translationKey: "menuMasterProduct", defaultLabel: "Master Produk" },
      { id: "inventory-add", translationKey: "menuAddNewProduct", defaultLabel: "Tambah Produk" },
    ],
  },
  {
    id: "opname",
    translationKey: "menuOpname",
    defaultLabel: "Opname Fisik",
    icon: ClipboardCheck,
    allowedRoles: ["owner", "manager", "staff"],
    excludeTypes: ["fnb_production"],
    excludeRoles: ["superadmin", "admin_gudang"],
  },
  {
    id: "produksi",
    translationKey: "menuProduksi",
    defaultLabel: "Produksi F&B",
    icon: Layers,
    iconClassName: "text-amber-500",
    allowedRoles: ["owner", "admin_gudang"],
    onlyTypes: ["fnb_production"],
    excludeRoles: ["superadmin"],
  },
  {
    id: "distribusi",
    translationKey: "menuDistribusi",
    defaultLabel: "Distribusi F&B",
    icon: Send,
    iconClassName: "text-blue-500",
    allowedRoles: ["owner", "admin_gudang"],
    onlyTypes: ["fnb_production"],
    excludeRoles: ["superadmin"],
  },
  {
    id: "procurement",
    translationKey: "menuProcurement",
    defaultLabel: "Procurement",
    icon: FileSpreadsheet,
    allowedRoles: ["owner", "manager"],
    excludeTypes: ["fnb_production"],
    excludeRoles: ["superadmin", "admin_gudang"],
    subItems: [
      { id: "procurement-history", translationKey: "menuProcurementHistory", defaultLabel: "Riwayat Pembelian" },
      { id: "procurement-new", translationKey: "menuProcurementNew", defaultLabel: "Pembelian Baru" },
    ],
  },
  {
    id: "sales-report",
    translationKey: "menuSalesReport",
    defaultLabel: "Laporan Penjualan",
    icon: TrendingUp,
    allowedRoles: ["owner", "manager"],
    excludeTypes: ["fnb_production"],
    excludeRoles: ["superadmin", "admin_gudang"],
  },
  {
    id: "analytics",
    translationKey: "menuAnalytics",
    defaultLabel: "Analisis Bisnis",
    icon: BarChart3,
    allowedRoles: ["owner"],
    excludeTypes: ["fnb_production"],
    excludeRoles: ["superadmin", "admin_gudang"],
  },
  {
    id: "superadmin",
    translationKey: "menuSuperadmin",
    defaultLabel: "Pusat Kontrol Akun",
    icon: Shield,
    iconClassName: "text-indigo-500",
    allowedRoles: ["superadmin"],
    requiredRoles: ["superadmin"],
  },
];

export function isMenuItemAllowed(
  menu: MenuItem,
  activeContext: { role?: string; type?: string } | null
): boolean {
  if (!activeContext) return false;
  const userRole = activeContext.role || "";
  const businessType = activeContext.type || "";

  // 1. Required Roles Check (e.g. Superadmin menu)
  if (menu.requiredRoles && !menu.requiredRoles.includes(userRole)) {
    return false;
  }

  // 2. Allowed Roles Check
  if (menu.allowedRoles && !menu.allowedRoles.includes(userRole)) {
    return false;
  }

  // 3. Excluded Roles Check
  if (menu.excludeRoles && menu.excludeRoles.includes(userRole)) {
    return false;
  }

  // 4. Only Business Types Check
  if (menu.onlyTypes && !menu.onlyTypes.includes(businessType)) {
    return false;
  }

  // 5. Excluded Business Types Check
  if (menu.excludeTypes && menu.excludeTypes.includes(businessType)) {
    return false;
  }

  return true;
}
