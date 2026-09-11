import React, { useState, useEffect } from "react";
import { useLanguageStore, translations } from "../../lib/i18n";
import StaffManagementView from "./staff-management-view";
import BusinessCapabilitiesView from "./business-capabilities-view";
import OutletManagementView from "./outlet-management-view";
import AuditLogsView from "./audit-logs-view";
import { Users, Building, Sliders, ShieldAlert, Building2 } from "lucide-react";

export interface OrganizationModuleProps {
  defaultTab?: "staff" | "businesses" | "outlets" | "audit-logs" | "profile";
}

export default function OrganizationModule({
  defaultTab = "staff",
}: OrganizationModuleProps) {
  const { language } = useLanguageStore();
  const t = translations[language] || translations.id;

  // Normalize initial tab
  const normalizeTab = (tab: string): "staff" | "businesses" | "outlets" | "audit-logs" => {
    if (tab === "profile" || tab === "businesses") return "businesses";
    if (tab === "outlets") return "outlets";
    if (tab === "audit-logs") return "audit-logs";
    return "staff";
  };

  const [activeTab, setActiveTab] = useState<"staff" | "businesses" | "outlets" | "audit-logs">(
    normalizeTab(defaultTab)
  );

  useEffect(() => {
    setActiveTab(normalizeTab(defaultTab));
  }, [defaultTab]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Module Title */}
      <div className="border-b border-slate-200/60 dark:border-[#2E2E34] pb-4">
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
          <Building2 className="w-7 h-7 text-primary" />
          <span>{language === "id" ? "Organisasi & Manajemen Tim" : "Organization & User Control"}</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {language === "id"
            ? "Pusat tata kelola akun staf, hak akses, master cabang fisik, kapabilitas modul, dan jejak audit otorisasi."
            : "Central governance for staff accounts, access control, physical branches, capability flags, and audit logs."}
        </p>
      </div>

      {/* Segmented Top Nav Tabs for Fast Switching */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-[#1E1E22] rounded-2xl w-fit border border-slate-200/80 dark:border-[#2E2E34] overflow-x-auto max-w-full">
        <button
          type="button"
          onClick={() => setActiveTab("staff")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "staff"
              ? "bg-white dark:bg-[#2A2A30] text-slate-900 dark:text-white shadow-xs"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <Users className="w-4 h-4 text-indigo-500" />
          <span>{language === "id" ? "Pengguna & Staff" : "Users & Staff"}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("businesses")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "businesses"
              ? "bg-white dark:bg-[#2A2A30] text-slate-900 dark:text-white shadow-xs"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <Sliders className="w-4 h-4 text-emerald-500" />
          <span>{language === "id" ? "Unit Bisnis & Modul" : "Businesses & Modules"}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("outlets")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "outlets"
              ? "bg-white dark:bg-[#2A2A30] text-slate-900 dark:text-white shadow-xs"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <Building className="w-4 h-4 text-blue-500" />
          <span>{language === "id" ? "Cabang & Outlet" : "Branches & Outlets"}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("audit-logs")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "audit-logs"
              ? "bg-white dark:bg-[#2A2A30] text-slate-900 dark:text-white shadow-xs"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          <span>{language === "id" ? "Jejak Audit Otorisasi" : "Audit Trail"}</span>
        </button>
      </div>

      {/* Subview Contents */}
      <div className="pt-2">
        {activeTab === "staff" && <StaffManagementView />}
        {activeTab === "businesses" && <BusinessCapabilitiesView />}
        {activeTab === "outlets" && <OutletManagementView />}
        {activeTab === "audit-logs" && <AuditLogsView />}
      </div>
    </div>
  );
}
