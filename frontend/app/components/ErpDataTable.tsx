import React, { useState } from "react";
import { SlidersHorizontal, Package } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "./ui/dropdown-menu";
import { Checkbox } from "./ui/checkbox";
import { useTheme } from "../hooks/use-theme";

export interface ColumnDef<T> {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  width?: string;
  defaultVisible?: boolean;
  renderCell: (item: T) => React.ReactNode;
}

export interface ErpDataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (item: T) => string;
  loading?: boolean;
  emptyText?: string;
  emptyIcon?: React.ReactNode;
  onRowClick?: (item: T) => void;
  onRowContextMenu?: (e: React.MouseEvent, item: T) => void;
  renderMobileItem?: (item: T) => React.ReactNode;
  enableColumnToggle?: boolean;
  className?: string;
}

export function ErpDataTable<T>({
  data,
  columns: initialColumns,
  keyExtractor,
  loading = false,
  emptyText = "Tidak ada data yang tersedia",
  emptyIcon,
  onRowClick,
  onRowContextMenu,
  renderMobileItem,
  enableColumnToggle = true,
  className = "",
}: ErpDataTableProps<T>) {
  const { isDark } = useTheme();

  // Column Visibility State
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};
    initialColumns.forEach((col) => {
      initialState[col.key] = col.defaultVisible !== false;
    });
    return initialState;
  });

  // Controlled Column Dropdown state (supports hover fade-in & right-click on thead)
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleHeaderContextMenu = (e: React.MouseEvent) => {
    if (!enableColumnToggle) return;
    e.preventDefault();
    setIsColumnDropdownOpen(true);
  };

  const activeColumns = initialColumns.filter((col) => visibleColumns[col.key]);

  return (
    <div className={`w-full space-y-4 ${className}`}>
      {/* ── MOBILE VIEW (< md) ── */}
      {renderMobileItem && (
        <div className="md:hidden w-full divide-y divide-slate-200/60 dark:divide-[#2C2C32] select-none text-left">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white/40 dark:bg-dark-card/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
              <div className="w-10 h-10 border-4 border-slate-700 dark:border-primary border-t-transparent rounded-full animate-spin mb-3" />
              <span className="text-slate-500 dark:text-slate-400 text-xs font-bold">
                Memuat data...
              </span>
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-16 px-4 space-y-2 bg-white/40 dark:bg-dark-card/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
              {emptyIcon || <Package className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />}
              <p className="text-slate-400 dark:text-slate-500 text-sm font-semibold">
                {emptyText}
              </p>
            </div>
          ) : (
            data.map((item) => (
              <React.Fragment key={keyExtractor(item)}>
                {renderMobileItem(item)}
              </React.Fragment>
            ))
          )}
        </div>
      )}

      {/* ── DESKTOP MASTER TABLE VIEW (>= md) ── */}
      <div
        className={`${
          renderMobileItem ? "hidden md:block" : "block"
        } bg-white dark:bg-dark-card border border-slate-200/80 dark:border-dark-border rounded-[28px] shadow-sm p-4 sm:p-6`}
        style={{
          boxShadow: isDark
            ? "0 4px 24px 0 rgba(0,0,0,0.35)"
            : "0 4px 20px 0 rgba(0,0,0,0.06)",
        }}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-10 h-10 border-4 border-slate-700 dark:border-primary border-t-transparent rounded-full animate-spin mb-3" />
            <span className="text-slate-500 dark:text-slate-400 text-xs font-bold">
              Memuat data...
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate" style={{ borderSpacing: 0 }}>
              {/* Header section with Hover Fade-In & Right-Click Context Menu Support */}
              <thead
                onContextMenu={handleHeaderContextMenu}
                className="group/thead text-slate-600 dark:text-slate-300 select-none"
              >
                <tr>
                  {activeColumns.map((col, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === activeColumns.length - 1;
                    const alignClass =
                      col.align === "center"
                        ? "text-center"
                        : col.align === "right"
                        ? "text-right"
                        : "text-left";

                    return (
                      <th
                        key={col.key}
                        className={`py-3.5 px-5 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap bg-[#E7E9ED] dark:bg-[#2E2E34] ${alignClass} ${
                          col.width || ""
                        } ${isFirst ? "rounded-l-full" : ""} ${
                          isLast ? "rounded-r-full relative" + (enableColumnToggle ? " pr-11" : "") : ""
                        }`}
                      >
                        {col.label}

                        {/* Floating Column Visibility Button inside the last <th> to satisfy HTML DOM nesting rules */}
                        {isLast && enableColumnToggle && (
                          <span
                            className={`absolute right-2.5 top-1/2 -translate-y-1/2 z-20 transition-all duration-200 ${
                              isColumnDropdownOpen
                                ? "opacity-100 pointer-events-auto scale-100"
                                : "opacity-0 pointer-events-none group-hover/thead:opacity-100 group-hover/thead:pointer-events-auto"
                            }`}
                          >
                            <DropdownMenu open={isColumnDropdownOpen} onOpenChange={setIsColumnDropdownOpen}>
                              <DropdownMenuTrigger
                                className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md hover:scale-105 transition-all cursor-pointer focus:outline-none"
                                title="Atur Visibilitas Kolom (Klik Kanan di Header)"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#3A3A3E] shadow-2xl rounded-2xl p-2 min-w-[200px] space-y-1"
                              >
                                <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between border-b border-slate-100 dark:border-[#333338] mb-1">
                                  <span>Visibilitas Kolom</span>
                                  <SlidersHorizontal className="w-3 h-3 text-slate-400" />
                                </div>
                                {initialColumns.map((c) => {
                                  const isChecked = Boolean(visibleColumns[c.key]);
                                  return (
                                    <div
                                      key={c.key}
                                      onClick={() => toggleColumn(c.key)}
                                      className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl cursor-pointer transition-colors"
                                    >
                                      <span>{c.label}</span>
                                      <Checkbox
                                        checked={isChecked}
                                        onCheckedChange={() => toggleColumn(c.key)}
                                      />
                                    </div>
                                  );
                                })}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td
                      colSpan={activeColumns.length}
                      className="text-center py-16 text-slate-400 dark:text-slate-500 font-bold border-b border-slate-200/80 dark:border-dark-border"
                    >
                      {emptyText}
                    </td>
                  </tr>
                ) : (
                  data.map((item) => {
                    const rowKey = keyExtractor(item);

                    return (
                      <tr
                        key={rowKey}
                        onClick={() => onRowClick && onRowClick(item)}
                        onContextMenu={(e) => {
                          if (onRowContextMenu) {
                            e.preventDefault();
                            onRowContextMenu(e, item);
                          }
                        }}
                        className={`group transition-colors duration-150 ${
                          onRowClick ? "cursor-pointer hover:bg-slate-50/70 dark:hover:bg-white/[0.03]" : ""
                        }`}
                      >
                        {activeColumns.map((col) => {
                          const alignClass =
                            col.align === "center"
                              ? "text-center"
                              : col.align === "right"
                              ? "text-right"
                              : "text-left";

                          return (
                            <td
                              key={col.key}
                              className={`px-5 py-3.5 border-b border-slate-200/80 dark:border-[#38383C] ${alignClass}`}
                            >
                              {col.renderCell(item)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
