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
  },
  {
    id: "pos",
    translationKey: "menuPos",
    defaultLabel: "Point of Sale",
    icon: ShoppingCart,
    excludeTypes: ["fnb_production"],
  },
  {
    id: "inventory",
    translationKey: "menuInventory",
    defaultLabel: "Inventory",
    icon: Package,
    excludeTypes: ["fnb_production"],
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
    excludeTypes: ["fnb_production"],
  },
  {
    id: "produksi",
    translationKey: "menuProduksi",
    defaultLabel: "Produksi F&B",
    icon: Layers,
    iconClassName: "text-amber-500",
    onlyTypes: ["fnb_production"],
  },
  {
    id: "distribusi",
    translationKey: "menuDistribusi",
    defaultLabel: "Distribusi F&B",
    icon: Send,
    iconClassName: "text-blue-500",
    onlyTypes: ["fnb_production"],
  },
  {
    id: "superadmin",
    translationKey: "menuSuperadmin",
    defaultLabel: "Pusat Kontrol Akun",
    icon: Shield,
    iconClassName: "text-indigo-500",
    requiredRoles: ["superadmin"],
  },
  {
    id: "procurement",
    translationKey: "menuProcurement",
    defaultLabel: "Procurement",
    icon: FileSpreadsheet,
    excludeTypes: ["fnb_production"],
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
    excludeTypes: ["fnb_production"],
  },
  {
    id: "analytics",
    translationKey: "menuAnalytics",
    defaultLabel: "Analisis Bisnis",
    icon: BarChart3,
    excludeTypes: ["fnb_production"],
  },
];
