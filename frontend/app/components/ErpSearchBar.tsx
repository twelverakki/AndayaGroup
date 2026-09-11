import React, { useRef, useEffect } from "react";
import { Search, X } from "lucide-react";

export interface ErpSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
  onSubmit?: (e: React.FormEvent) => void;
  enableShortcut?: boolean;
  autoFocus?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  rightAction?: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function ErpSearchBar({
  value,
  onChange,
  placeholder = "Cari...",
  onClear,
  onSubmit,
  enableShortcut = true,
  autoFocus = false,
  inputRef: externalInputRef,
  rightAction,
  className = "",
  size = "md",
}: ErpSearchBarProps) {
  const internalInputRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef || internalInputRef;

  // Global '/' keyboard shortcut focus listener
  useEffect(() => {
    if (!enableShortcut) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is currently typing in an input, textarea, or contenteditable element
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isEditable = document.activeElement?.getAttribute("contenteditable") === "true";

      if (activeTag === "input" || activeTag === "textarea" || activeTag === "select" || isEditable) {
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enableShortcut, inputRef]);

  // Global mobile search focus event listener
  useEffect(() => {
    const handleFocusSearch = () => {
      inputRef.current?.focus();
    };
    window.addEventListener("focus_mobile_search", handleFocusSearch);
    return () => window.removeEventListener("focus_mobile_search", handleFocusSearch);
  }, [inputRef]);

  const handleClear = () => {
    onChange("");
    if (onClear) onClear();
    inputRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit) onSubmit(e);
  };

  // Dynamic padding & sizing tokens
  const sizeClasses = {
    sm: "py-1.5 pl-8 pr-8 text-xs min-h-[38px]",
    md: "py-2.5 pl-10 pr-9 text-xs sm:text-sm min-h-[44px]",
    lg: "py-3 pl-11 pr-10 text-sm sm:text-base min-h-[48px]",
  }[size];

  const iconClasses = {
    sm: "left-2.5 w-3.5 h-3.5",
    md: "left-3.5 w-4 h-4",
    lg: "left-4 w-4.5 h-4.5",
  }[size];

  return (
    <form onSubmit={handleSubmit} className={`w-full flex items-center gap-2 ${className}`}>
      <div className="relative flex-1 group">
        {/* Search Icon (100% Perfectly Centered Vertically) */}
        <Search
          className={`absolute top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none stroke-[2.2] transition-colors group-focus-within:text-slate-900 dark:group-focus-within:text-white ${iconClasses}`}
        />

        {/* Search Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={`w-full ${sizeClasses} rounded-full border border-slate-200/90 dark:border-[#38383C] bg-white dark:bg-[#202024] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/15 dark:focus:ring-white/20 focus:border-slate-900 dark:focus:border-slate-100 transition-all duration-150 shadow-xs`}
        />

        {/* Right side controls inside input (Clear button or Keyboard shortcut badge) */}
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-auto">
          {value.length > 0 ? (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title="Reset pencarian"
              aria-label="Clear Search"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          ) : (
            enableShortcut && (
              <kbd className="inline-flex items-center justify-center px-1.5 py-0.5 rounded border border-slate-300/80 dark:border-[#38383C] bg-slate-100/90 dark:bg-[#2A2A2E] text-[10px] font-extrabold text-slate-400 dark:text-slate-400 shadow-2xs select-none pointer-events-none">
                /
              </kbd>
            )
          )}
        </div>
      </div>

      {/* Optional Right Action Slot (e.g. Inline Mobile Menu button or Filter toggle) */}
      {rightAction && <div className="shrink-0">{rightAction}</div>}
    </form>
  );
}
