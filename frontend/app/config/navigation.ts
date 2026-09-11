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
	Coins,
	Receipt,
	Users,
	Building2,
	ShieldCheck,
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
		allowedRoles: [
			"owner",
			"manager",
			"staff",
			"admin_gudang",
			"superadmin",
		],
	},
	{
		id: "pos",
		translationKey: "menuPos",
		defaultLabel: "Point of Sale",
		icon: ShoppingCart,
		allowedRoles: ["owner", "manager", "staff"],
		excludeRoles: ["superadmin", "admin_gudang"],
	},
	{
		id: "inventory",
		translationKey: "menuInventory",
		defaultLabel: "Inventory",
		icon: Package,
		allowedRoles: ["owner", "manager", "admin_gudang"],
		excludeRoles: ["superadmin"],
		subItems: [
			{
				id: "inventory-master",
				translationKey: "menuMasterProduct",
				defaultLabel: "Master Produk",
			},
			{
				id: "inventory-add",
				translationKey: "menuAddNewProduct",
				defaultLabel: "Tambah Produk",
			},
		],
	},
	{
		id: "opname",
		translationKey: "menuOpname",
		defaultLabel: "Opname Fisik",
		icon: ClipboardCheck,
		allowedRoles: ["owner", "manager", "staff", "admin_gudang"],
		excludeRoles: ["superadmin"],
	},
	{
		id: "produksi",
		translationKey: "menuProduksi",
		defaultLabel: "Produksi F&B",
		icon: Layers,
		iconClassName: "text-amber-500",
		allowedRoles: ["owner", "admin_gudang"],
		excludeRoles: ["superadmin"],
	},
	{
		id: "settlements",
		translationKey: "menuSettlements",
		defaultLabel: "Pendapatan & Setoran",
		icon: Coins,
		iconClassName: "text-emerald-500",
		allowedRoles: ["owner", "admin_gudang", "staff"],
		excludeRoles: ["superadmin"],
		subItems: [
			{
				id: "settlements-history",
				translationKey: "menuSalesSettlements",
				defaultLabel: "Riwayat Setoran Closing",
			},
			{
				id: "settlements-direct",
				translationKey: "menuSalesDirect",
				defaultLabel: "Riwayat Penjualan Direct",
			},
		],
	},
	{
		id: "distribusi",
		translationKey: "menuTransfers",
		defaultLabel: "Transfer & Distribusi",
		icon: Send,
		iconClassName: "text-blue-500",
		allowedRoles: ["owner", "admin_gudang", "staff"],
		excludeRoles: ["superadmin"],
		subItems: [
			{
				id: "distribusi-flow",
				translationKey: "menuDistribusiFlow",
				defaultLabel: "Riwayat / Alur Kirim",
			},
			{
				id: "distribusi-mitra",
				translationKey: "menuDistribusiMitra",
				defaultLabel: "Stok & Handshake",
			},
		],
	},
	{
		id: "procurement",
		translationKey: "menuProcurement",
		defaultLabel: "Procurement",
		icon: FileSpreadsheet,
		allowedRoles: ["owner", "manager"],
		excludeRoles: ["superadmin", "admin_gudang"],
		subItems: [
			{
				id: "procurement-history",
				translationKey: "menuProcurementHistory",
				defaultLabel: "Riwayat Pembelian",
			},
			{
				id: "procurement-new",
				translationKey: "menuProcurementNew",
				defaultLabel: "Pembelian Baru",
			},
		],
	},
	{
		id: "organization",
		translationKey: "menuOrganization",
		defaultLabel: "Organisasi & Bisnis",
		icon: Building2,
		iconClassName: "text-indigo-500",
		allowedRoles: ["superadmin"],
		requiredRoles: ["superadmin"],
	},
	{
		id: "users",
		translationKey: "menuUsers",
		defaultLabel: "Manajemen Pengguna",
		icon: Users,
		iconClassName: "text-blue-500",
		allowedRoles: ["superadmin"],
		requiredRoles: ["superadmin"],
	},
	{
		id: "security-logs",
		translationKey: "menuSecurityLogs",
		defaultLabel: "Log Keamanan Sistem",
		icon: ShieldCheck,
		iconClassName: "text-amber-500",
		allowedRoles: ["superadmin"],
		requiredRoles: ["superadmin"],
	},
	{
		id: "sales-report",
		translationKey: "menuSalesReport",
		defaultLabel: "Laporan Penjualan",
		icon: TrendingUp,
		allowedRoles: ["owner", "manager"],
		excludeRoles: ["superadmin", "admin_gudang"],
	},
	{
		id: "analytics",
		translationKey: "menuAnalytics",
		defaultLabel: "Analisis Bisnis",
		icon: BarChart3,
		allowedRoles: ["owner"],
		excludeRoles: ["superadmin", "admin_gudang"],
	},
];

export function isMenuItemAllowed(
	menu: MenuItem,
	activeContext: { role?: string; type?: string } | null,
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

export function getDefaultMenuId(menuId: string): string {
	const target = sidebarMenuConfig.find((m) => m.id === menuId);
	if (target && target.subItems && target.subItems.length > 0) {
		return target.subItems[0].id;
	}
	return menuId;
}
