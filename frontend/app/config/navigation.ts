import {
	LayoutDashboard,
	ShoppingCart,
	Package,
	Boxes,
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
	Tag,
} from "lucide-react";
import React from "react";

export type CapabilityFlag =
	| "has_pos"
	| "has_manufacturing"
	| "has_logistics_hub"
	| "has_eod_usage"
	| "has_multi_outlets"
	| "allow_cross_branch_stock_view";

export interface SubMenuItem {
	id: string;
	translationKey: string;
	defaultLabel: string;
	allowedRoles?: string[];
	excludeRoles?: string[];
	requireCapability?: CapabilityFlag;
	requireCrossBranchStock?: boolean;
}

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
	requireCapability?: CapabilityFlag;
	subItems?: SubMenuItem[];
}

export const sidebarMenuConfig: MenuItem[] = [
	{
		id: "dashboard",
		translationKey: "menuDashboard",
		defaultLabel: "Dashboard",
		icon: LayoutDashboard,
		iconClassName: "text-slate-600 dark:text-slate-300",
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
		defaultLabel: "Kasir (POS)",
		icon: ShoppingCart,
		iconClassName: "text-emerald-500",
		requireCapability: "has_pos",
		allowedRoles: ["owner", "manager", "staff"],
		excludeRoles: ["superadmin", "admin_gudang"],
	},
	{
		id: "promotions",
		translationKey: "promotionsTitle",
		defaultLabel: "Diskon & Promo",
		icon: Tag,
		iconClassName: "text-rose-500",
		allowedRoles: ["owner", "manager"],
		excludeRoles: ["superadmin", "admin_gudang"],
	},
	{
		id: "items",
		translationKey: "menuItems",
		defaultLabel: "Master Item",
		icon: Package,
		iconClassName: "text-blue-500",
		allowedRoles: ["owner", "manager", "admin_gudang"],
		excludeRoles: ["superadmin"],
	},
	{
		id: "inventory",
		translationKey: "menuInventory",
		defaultLabel: "Inventori",
		icon: Boxes,
		iconClassName: "text-cyan-500",
		allowedRoles: ["owner", "manager", "admin_gudang"],
		excludeRoles: ["superadmin"],
		subItems: [
			{
				id: "inventory-master",
				translationKey: "menuInventoryMaster",
				defaultLabel: "Master Inventori",
			},
			{
				id: "inventory-matrix",
				translationKey: "menuInventoryMatrix",
				defaultLabel: "Matrik Stok",
				requireCrossBranchStock: true,
			},
		],
	},
	{
		id: "opname",
		translationKey: "menuOpname",
		defaultLabel: "Opname Fisik",
		icon: ClipboardCheck,
		iconClassName: "text-purple-500",
		allowedRoles: ["owner", "manager", "staff", "admin_gudang"],
		excludeRoles: ["superadmin"],
	},
	{
		id: "produksi",
		translationKey: "menuProduksi",
		defaultLabel: "Produksi Dapur",
		icon: Layers,
		iconClassName: "text-amber-500",
		requireCapability: "has_manufacturing",
		allowedRoles: ["owner", "admin_gudang", "manager"],
		excludeRoles: ["superadmin"],
	},
	{
		id: "settlements",
		translationKey: "menuSettlements",
		defaultLabel: "Setoran & Kas",
		icon: Coins,
		iconClassName: "text-teal-500",
		requireCapability: "has_eod_usage",
		allowedRoles: ["owner", "admin_gudang", "staff", "manager"],
		excludeRoles: ["superadmin"],
		subItems: [
			{
				id: "settlements-history",
				translationKey: "menuSalesSettlements",
				defaultLabel: "Setoran Closing",
			},
			{
				id: "settlements-direct",
				translationKey: "menuSalesDirect",
				defaultLabel: "Penjualan Direct",
			},
		],
	},
	{
		id: "distribusi",
		translationKey: "menuTransfers",
		defaultLabel: "Distribusi Kirim",
		icon: Send,
		iconClassName: "text-sky-500",
		requireCapability: "has_logistics_hub",
		allowedRoles: ["owner", "admin_gudang", "staff", "manager"],
		excludeRoles: ["superadmin"],
	},
	{
		id: "procurement",
		translationKey: "menuProcurement",
		defaultLabel: "Procurement",
		icon: FileSpreadsheet,
		iconClassName: "text-orange-500",
		allowedRoles: ["owner", "manager", "admin_gudang"],
		excludeRoles: ["superadmin"],
		subItems: [
			{
				id: "procurement-history",
				translationKey: "menuProcurementHistory",
				defaultLabel: "Riwayat Order",
			},
			{
				id: "procurement-new",
				translationKey: "menuProcurementNew",
				defaultLabel: "Order Baru",
			},
		],
	},
	{
		id: "organization",
		translationKey: "menuOrganization",
		defaultLabel: "Unit Bisnis",
		icon: Building2,
		iconClassName: "text-indigo-500",
		allowedRoles: ["superadmin", "owner"],
	},
	{
		id: "users",
		translationKey: "menuUsers",
		defaultLabel: "Kelola User",
		icon: Users,
		iconClassName: "text-violet-500",
		allowedRoles: ["superadmin"],
		requiredRoles: ["superadmin"],
	},
	{
		id: "security-logs",
		translationKey: "menuSecurityLogs",
		defaultLabel: "Log Keamanan",
		icon: ShieldCheck,
		iconClassName: "text-red-500",
		allowedRoles: ["superadmin"],
		requiredRoles: ["superadmin"],
	},
	{
		id: "sales-report",
		translationKey: "menuSalesReport",
		defaultLabel: "Laporan Omset",
		icon: TrendingUp,
		iconClassName: "text-green-500",
		allowedRoles: ["owner", "manager"],
		excludeRoles: ["superadmin", "admin_gudang"],
	},
	{
		id: "analytics",
		translationKey: "menuAnalytics",
		defaultLabel: "Analisis Bisnis",
		icon: BarChart3,
		iconClassName: "text-fuchsia-500",
		allowedRoles: ["owner"],
		excludeRoles: ["superadmin", "admin_gudang"],
	},
];

export function isMenuItemAllowed(
	menu: MenuItem,
	activeContext: {
		role?: string;
		type?: string;
		has_pos?: boolean;
		has_manufacturing?: boolean;
		has_logistics_hub?: boolean;
		has_eod_usage?: boolean;
		has_multi_outlets?: boolean;
		allow_cross_branch_stock_view?: boolean;
	} | null,
): boolean {
	if (!activeContext) return false;
	const userRole = activeContext.role || "";
	const businessType = activeContext.type || "";

	// 1. Required Roles Check (e.g. Superadmin-only menu)
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

	// 4. Superadmin default filter: Superadmin in control center only gets superadmin tools & organization
	if (userRole === "superadmin" && !menu.requiredRoles?.includes("superadmin") && menu.id !== "organization" && menu.id !== "dashboard") {
		return false;
	}

	// 5. Capability Flag Check (The Lean Odoo Way)
	if (menu.requireCapability) {
		// If capability is required, it must be explicitly active for this business context
		if (!activeContext[menu.requireCapability]) {
			return false;
		}
	}

	// 6. Only Business Types Check
	if (menu.onlyTypes && !menu.onlyTypes.includes(businessType)) {
		return false;
	}

	// 7. Excluded Business Types Check
	if (menu.excludeTypes && menu.excludeTypes.includes(businessType)) {
		return false;
	}

	return true;
}

export function isSubMenuItemAllowed(
	subItem: SubMenuItem,
	activeContext: {
		role?: string;
		type?: string;
		has_pos?: boolean;
		has_manufacturing?: boolean;
		has_logistics_hub?: boolean;
		has_eod_usage?: boolean;
		has_multi_outlets?: boolean;
		allow_cross_branch_stock_view?: boolean;
	} | null,
): boolean {
	if (!activeContext) return false;
	const userRole = activeContext.role || "";

	if (subItem.allowedRoles && !subItem.allowedRoles.includes(userRole)) {
		return false;
	}
	if (subItem.excludeRoles && subItem.excludeRoles.includes(userRole)) {
		return false;
	}
	if (subItem.requireCapability && !activeContext[subItem.requireCapability]) {
		return false;
	}
	if (subItem.requireCrossBranchStock) {
		const isGlobalAdmin = userRole === "owner" || userRole === "superadmin" || userRole === "admin_gudang";
		if (!isGlobalAdmin && !activeContext.allow_cross_branch_stock_view) {
			return false;
		}
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
