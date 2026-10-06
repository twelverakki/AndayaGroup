import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Dialog, DialogContent } from "./dialog";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";
import { useLanguageStore } from "../../lib/i18n";

export interface WeekInfo {
  weekNumber: number; // 1, 2, 3, 4, 5, atau 6
  targetMonth: number; // 1..12 (Bulan yang ditargetkan)
  targetYear: number; // YYYY (Tahun yang ditargetkan)
  startDate: Date; // Monday (ISO start of week)
  endDate: Date; // Sunday (ISO end of week)
  startDateStr: string; // "YYYY-MM-DD"
  endDateStr: string; // "YYYY-MM-DD"
  rangeLabelId: string; // "05 Okt 2026 - 11 Okt 2026"
  rangeLabelEn: string; // "05 Oct 2026 - 11 Oct 2026"
  fullLabelId: string; // "Pekan 2 (05 Okt 2026 - 11 Okt 2026)"
  fullLabelEn: string; // "Week 2 (05 Oct 2026 - 11 Oct 2026)"
}

export interface WheelCarouselDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: Date;
  mode?: "date" | "week" | "time"; // "date" (default), "week", or "time" (Jam & Menit saja)
  showTime?: boolean; // If true, adds Hour (00-23) & Minute (00-59) - only in date mode
  locale?: "id" | "en";
  onApply: (selectedDate: Date, weekInfo?: WeekInfo) => void;
  onApplyWeek?: (weekInfo: WeekInfo) => void;
  onApplyTime?: (timeStr: string) => void;
}

const MONTHS_BILINGUAL = [
  { value: 1, idShort: "Jan", enShort: "Jan" },
  { value: 2, idShort: "Feb", enShort: "Feb" },
  { value: 3, idShort: "Mar", enShort: "Mar" },
  { value: 4, idShort: "Apr", enShort: "Apr" },
  { value: 5, idShort: "Mei", enShort: "May" },
  { value: 6, idShort: "Jun", enShort: "Jun" },
  { value: 7, idShort: "Jul", enShort: "Jul" },
  { value: 8, idShort: "Agu", enShort: "Aug" },
  { value: 9, idShort: "Sep", enShort: "Sep" },
  { value: 10, idShort: "Okt", enShort: "Oct" },
  { value: 11, idShort: "Nov", enShort: "Nov" },
  { value: 12, idShort: "Des", enShort: "Dec" },
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Menghitung daftar pekan standar ISO (Senin ke Minggu penuh)
 * yang menyentuh bulan dan tahun terpilih.
 * Jumlah pekan bisa bernilai 4, 5, atau 6 pekan secara dinamis.
 */
export function getWeeksInMonth(year: number, month: number): WeekInfo[] {
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const lastDay = new Date(year, month - 1, daysInMonth);

  // ISO Day of week: Monday = 0, Sunday = 6
  const dayOfWeek = (firstDay.getDay() + 6) % 7;
  const startOfFirstWeek = new Date(firstDay);
  startOfFirstWeek.setDate(firstDay.getDate() - dayOfWeek);

  const monthNamesId = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const monthNamesEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const formatShort = (d: Date, lang: "id" | "en") => {
    const day = pad2(d.getDate());
    const m = lang === "id" ? monthNamesId[d.getMonth()] : monthNamesEn[d.getMonth()];
    const y = d.getFullYear();
    return `${day} ${m} ${y}`;
  };

  const toYMD = (d: Date) => {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };

  const weeks: WeekInfo[] = [];
  let currentMonday = new Date(startOfFirstWeek);
  let weekIndex = 1;

  while (currentMonday <= lastDay) {
    const currentSunday = new Date(currentMonday);
    currentSunday.setDate(currentMonday.getDate() + 6);

    const rangeLabelId = `${formatShort(currentMonday, "id")} - ${formatShort(currentSunday, "id")}`;
    const rangeLabelEn = `${formatShort(currentMonday, "en")} - ${formatShort(currentSunday, "en")}`;

    weeks.push({
      weekNumber: weekIndex,
      targetMonth: month,
      targetYear: year,
      startDate: new Date(currentMonday),
      endDate: new Date(currentSunday),
      startDateStr: toYMD(currentMonday),
      endDateStr: toYMD(currentSunday),
      rangeLabelId,
      rangeLabelEn,
      fullLabelId: `Pekan ${weekIndex} (${rangeLabelId})`,
      fullLabelEn: `Week ${weekIndex} (${rangeLabelEn})`,
    });

    currentMonday.setDate(currentMonday.getDate() + 7);
    weekIndex++;
  }

  return weeks;
}

const ROW_HEIGHT = 44; // 44px physical height per row
const ANGLE_STEP = 25; // 25 degrees inclination per row step
const CYLINDER_RADIUS = 110; // 110px drum radius

// =========================================================================
// SAMSUNG TRUE 3D CYLINDRICAL DRUM WHEEL COLUMN
// =========================================================================
interface SamsungCylinderColumnProps {
  label: string;
  items: Array<{ value: number; label: string }>;
  selectedValue: number;
  onSelect: (value: number) => void;
  loop?: boolean;
  className?: string;
}

function SamsungCylinderColumn({
  label,
  items,
  selectedValue,
  onSelect,
  loop = true,
  className,
}: SamsungCylinderColumnProps) {
  const total = items.length;
  const selectedIndex = items.findIndex((it) => it.value === selectedValue);
  const currentIndex = selectedIndex >= 0 ? selectedIndex : 0;

  // Continuous floating scroll offset (e.g. 4.0 = index 4 at center)
  const [scrollOffset, setScrollOffset] = useState<number>(currentIndex);
  const scrollOffsetRef = useRef<number>(currentIndex);
  scrollOffsetRef.current = scrollOffset;

  const animFrameRef = useRef<number | null>(null);

  // Keep internal offset synchronized when external selectedValue changes (and not dragging)
  const isDraggingRef = useRef(false);
  useEffect(() => {
    if (!isDraggingRef.current) {
      setScrollOffset(currentIndex);
    }
  }, [currentIndex]);

  // Cancel any ongoing smooth animation
  const stopAnimation = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  // Smooth animation to a target offset with easeOutCubic curve
  const animateToOffset = useCallback(
    (targetOffset: number, durationMs = 240, onComplete?: () => void) => {
      stopAnimation();
      const start = scrollOffsetRef.current;
      const change = targetOffset - start;
      if (Math.abs(change) < 0.001) {
        setScrollOffset(targetOffset);
        if (onComplete) onComplete();
        return;
      }

      const startTime = performance.now();
      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        const eased = easeOutCubic(progress);
        const current = start + change * eased;
        setScrollOffset(current);

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(step);
        } else {
          setScrollOffset(targetOffset);
          animFrameRef.current = null;
          if (onComplete) onComplete();
        }
      };

      animFrameRef.current = requestAnimationFrame(step);
    },
    [stopAnimation]
  );

  // Rotate smoothly to a specific target index
  const rotateToIndex = useCallback(
    (targetIndex: number) => {
      let finalIndex = targetIndex;
      if (!loop) {
        finalIndex = Math.max(0, Math.min(total - 1, targetIndex));
        animateToOffset(finalIndex, 240, () => {
          onSelect(items[finalIndex].value);
        });
      } else {
        // Calculate shortest path around the circle for looping
        const currentWrapped = ((scrollOffsetRef.current % total) + total) % total;
        let delta = targetIndex - currentWrapped;
        if (delta > total / 2) delta -= total;
        if (delta < -total / 2) delta += total;
        const finalTarget = scrollOffsetRef.current + delta;
        animateToOffset(finalTarget, 240, () => {
          const normIdx = ((Math.round(finalTarget) % total) + total) % total;
          onSelect(items[normIdx].value);
        });
      }
    },
    [animateToOffset, items, loop, onSelect, total]
  );

  // Step relatively by -1 or +1
  const stepRelative = useCallback(
    (delta: number) => {
      const currentInt = Math.round(scrollOffsetRef.current);
      if (!loop) {
        const next = Math.max(0, Math.min(total - 1, currentInt + delta));
        rotateToIndex(next);
      } else {
        rotateToIndex(currentInt + delta);
      }
    },
    [loop, rotateToIndex, total]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  // Mouse wheel & trackpad continuous fluid scrolling with smooth snapping
  const wheelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      stopAnimation();

      // Normalize delta (deltaMode: 0=pixel, 1=line, 2=page)
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 24;
      else if (e.deltaMode === 2) dy *= 400;

      // Dampen wheel sensitivity to match row height
      const deltaRows = dy / (ROW_HEIGHT * 2.2);
      let newOffset = scrollOffsetRef.current + deltaRows;

      if (!loop) {
        if (newOffset < 0) {
          newOffset = newOffset * 0.25;
        } else if (newOffset > total - 1) {
          newOffset = total - 1 + (newOffset - (total - 1)) * 0.25;
        }
      }

      setScrollOffset(newOffset);

      // Debounce snapping to nearest item after scrolling pauses
      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current);
      }

      wheelTimeoutRef.current = setTimeout(() => {
        const cur = scrollOffsetRef.current;
        let snapIdx = Math.round(cur);
        if (!loop) {
          snapIdx = Math.max(0, Math.min(total - 1, snapIdx));
          animateToOffset(snapIdx, 220, () => {
            onSelect(items[snapIdx].value);
          });
        } else {
          animateToOffset(snapIdx, 220, () => {
            const normIdx = ((snapIdx % total) + total) % total;
            onSelect(items[normIdx].value);
          });
        }
      }, 130);
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
    };
  }, [animateToOffset, items, loop, onSelect, stopAnimation, total]);

  // Pointer drag handling: Window-based listeners guarantee 100% reliable tracking
  const [isGrabbing, setIsGrabbing] = useState(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Left click only
    e.preventDefault();
    stopAnimation();

    isDraggingRef.current = true;
    setIsGrabbing(true);

    const startY = e.clientY;
    const startOffset = scrollOffsetRef.current;
    let lastY = startY;
    let lastTime = performance.now();
    let velocity = 0;
    let movedTotal = 0;

    const handlePointerMove = (ev: PointerEvent) => {
      ev.preventDefault();
      const currentY = ev.clientY;
      const now = performance.now();
      const dt = Math.max(1, now - lastTime);
      const dy = currentY - lastY;

      velocity = -dy / dt; // velocity in px/ms
      lastY = currentY;
      lastTime = now;

      const deltaY = currentY - startY;
      movedTotal = Math.abs(deltaY);

      // Dragging UP (deltaY < 0) pulls lower items UP into view (increases offset)
      let newOffset = startOffset - deltaY / ROW_HEIGHT;

      // Non-infinite rubber-banding resistance outside boundaries
      if (!loop) {
        if (newOffset < 0) {
          newOffset = newOffset * 0.28;
        } else if (newOffset > total - 1) {
          newOffset = total - 1 + (newOffset - (total - 1)) * 0.28;
        }
      }

      setScrollOffset(newOffset);
    };

    const handlePointerUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);

      isDraggingRef.current = false;
      setIsGrabbing(false);

      // If user merely tapped without dragging (< 5px), let item click handle it
      if (movedTotal < 5) {
        const clickedOffset = scrollOffsetRef.current;
        const nearest = Math.round(clickedOffset);
        let finalIdx = nearest;
        if (!loop) {
          finalIdx = Math.max(0, Math.min(total - 1, nearest));
        } else {
          finalIdx = ((nearest % total) + total) % total;
        }
        animateToOffset(nearest, 180, () => {
          onSelect(items[finalIdx].value);
        });
        return;
      }

      // Add flick momentum based on velocity
      const momentumOffset = velocity * 45; // Pixels momentum
      const targetOffset = scrollOffsetRef.current + momentumOffset / ROW_HEIGHT;
      let snapIndex = Math.round(targetOffset);

      if (!loop) {
        snapIndex = Math.max(0, Math.min(total - 1, snapIndex));
        animateToOffset(snapIndex, 250, () => {
          onSelect(items[snapIndex].value);
        });
      } else {
        animateToOffset(snapIndex, 250, () => {
          const normIdx = ((snapIndex % total) + total) % total;
          onSelect(items[normIdx].value);
        });
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  };

  // Compute 7 visible slots around center (-3, -2, -1, 0, 1, 2, 3)
  const visibleSlots = useMemo(() => {
    const centerInt = Math.round(scrollOffset);
    const fraction = scrollOffset - centerInt; // Sub-pixel fractional offset (-0.5 to +0.5)

    const slots = [];
    for (let s = -3; s <= 3; s++) {
      const slotIndex = centerInt + s;
      const relPos = s - fraction; // True continuous relative distance to center row!

      // Check boundary for non-loop
      if (!loop) {
        if (slotIndex < 0 || slotIndex >= total) {
          continue; // Leave blank space outside boundaries (Jan-Dec, 5 years, Weeks)
        }
        slots.push({
          item: items[slotIndex],
          itemIndex: slotIndex,
          relPos,
        });
      } else {
        // Infinite circular loop (Day, Hour, Minute)
        const normIdx = ((slotIndex % total) + total) % total;
        slots.push({
          item: items[normIdx],
          itemIndex: normIdx,
          relPos,
        });
      }
    }
    return slots;
  }, [scrollOffset, loop, total, items]);

  return (
    <div
      className={cn(
        "flex flex-col items-center select-none group focus:outline-none flex-1 min-w-0 touch-none",
        className
      )}
      tabIndex={0}
      role="spinbutton"
      aria-label={label}
      aria-valuenow={selectedValue}
    >
      {/* Column Title */}
      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
        {label}
      </span>

      {/* Up Button */}
      <button
        type="button"
        onClick={() => stepRelative(-1)}
        disabled={!loop && currentIndex === 0}
        className="w-full py-1.5 mb-1 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-10 disabled:hover:bg-transparent flex items-center justify-center transition-all cursor-pointer focus:outline-none"
        title={`Sebelumnya (${label})`}
      >
        <ChevronUp className="w-5 h-5 stroke-[2.5]" />
      </button>

      {/* 3D Drum Chamber */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        style={{
          perspective: "1000px",
          transformStyle: "preserve-3d",
        }}
        className={cn(
          "relative w-full h-[220px] flex items-center justify-center overflow-hidden px-1 bg-transparent select-none touch-none",
          isGrabbing ? "cursor-grabbing" : "cursor-grab"
        )}
      >
        {/* Top Vignette Gradient */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white dark:from-[#1E1E22] via-white/80 dark:via-[#1E1E22]/80 to-transparent z-20" />

        {/* Bottom Vignette Gradient */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white dark:from-[#1E1E22] via-white/80 dark:via-[#1E1E22]/80 to-transparent z-20" />

        {/* 
          3D ROTATING DRUM SURFACE:
          Continuous geometric 3D placement based on real-time relPos!
        */}
        <div
          className="relative w-full h-[44px] pointer-events-none"
          style={{
            transformStyle: "preserve-3d",
          }}
        >
          {visibleSlots.map(({ item, itemIndex, relPos }) => {
            const dist = Math.abs(relPos);
            if (dist > 2.8) return null; // Outside viewport

            // 1. Angular tilt: item tilts backwards as it moves away from center
            const angleDeg = relPos * ANGLE_STEP;
            const angleRad = (angleDeg * Math.PI) / 180;

            // 2. Y vertical displacement on cylinder curve
            const yOffset = CYLINDER_RADIUS * Math.sin(angleRad);

            // 3. Z depth displacement: center is 0, curves deeper into screen (-Z) as it moves away
            const zOffset = CYLINDER_RADIUS * (Math.cos(angleRad) - 1);

            // 4. Smooth continuous scaling:
            // Closest to center (dist -> 0) is LARGEST (scale 1.25)!
            // Farther away shrinks smoothly down to 0.70.
            const scale = Math.max(0.7, 1.25 - 0.26 * dist);

            // 5. Opacity falloff: center is 1.0, fades smoothly to 0 towards edges
            const opacity = Math.max(0, 1 - Math.pow(dist / 2.4, 1.4));

            const isCenterFocus = dist < 0.45;

            return (
              <div
                key={`${item.value}-${itemIndex}-${Math.round(relPos)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  rotateToIndex(itemIndex);
                }}
                style={{
                  position: "absolute",
                  inset: 0,
                  transform: `translate3d(0, ${yOffset}px, ${zOffset}px) rotateX(${-angleDeg}deg) scale(${scale})`,
                  opacity: opacity,
                  backfaceVisibility: "hidden",
                  pointerEvents: "auto",
                }}
                className={cn(
                  "flex items-center justify-center px-1 rounded-xl cursor-pointer text-center select-none transition-[color] duration-150",
                  isCenterFocus
                    ? "font-black text-slate-900 dark:text-white text-2xl tracking-tight z-10"
                    : "font-semibold text-slate-400 dark:text-slate-500 text-base z-0"
                )}
              >
                <span className="whitespace-nowrap">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Down Button */}
      <button
        type="button"
        onClick={() => stepRelative(1)}
        disabled={!loop && currentIndex === total - 1}
        className="w-full py-1.5 mt-1 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-10 disabled:hover:bg-transparent flex items-center justify-center transition-all cursor-pointer focus:outline-none"
        title={`Berikutnya (${label})`}
      >
        <ChevronDown className="w-5 h-5 stroke-[2.5]" />
      </button>
    </div>
  );
}

// =========================================================================
// MAIN COMPONENT: WheelCarouselDialog (PURE 3D ROTATING CYLINDERS GRID)
// =========================================================================
export function WheelCarouselDialog({
  open,
  onOpenChange,
  initialDate,
  mode = "date",
  showTime = false,
  locale: customLocale,
  onApply,
  onApplyWeek,
  onApplyTime,
}: WheelCarouselDialogProps) {
  const currentStoreLang = useLanguageStore((s) => s.language);
  const lang = customLocale || currentStoreLang || "id";
  const isId = lang === "id";

  const baseDate = useMemo(() => initialDate || new Date(), [initialDate]);

  const [year, setYear] = useState(baseDate.getFullYear());
  const [month, setMonth] = useState(baseDate.getMonth() + 1);
  const [day, setDay] = useState(baseDate.getDate());
  const [hour, setHour] = useState(baseDate.getHours());
  const [minute, setMinute] = useState(baseDate.getMinutes());
  const [selectedWeek, setSelectedWeek] = useState(1);

  // Weeks list for the selected Year & Month
  const weekList = useMemo(() => {
    return getWeeksInMonth(year, month);
  }, [year, month]);

  const wasOpenRef = useRef(false);

  // Reset internal state ONLY when dialog transitions from closed to open
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const d = initialDate || new Date();
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      setYear(y);
      setMonth(m);
      setDay(d.getDate());
      setHour(d.getHours());
      setMinute(d.getMinutes());

      // Find matching ISO week for initialDate
      const weeks = getWeeksInMonth(y, m);
      const matched = weeks.find((w) => d >= w.startDate && d <= w.endDate);
      setSelectedWeek(matched ? matched.weekNumber : 1);
    }
    wasOpenRef.current = open;
  }, [open, initialDate]);

  // Clamp week if month changes and current week exceeds total weeks (e.g. from 6 to 4 or 5)
  useEffect(() => {
    if (selectedWeek > weekList.length) {
      setSelectedWeek(weekList.length);
    }
  }, [weekList.length, selectedWeek]);

  // Days in selected Month & Year
  const daysInCurrentMonth = useMemo(() => {
    return getDaysInMonth(year, month);
  }, [year, month]);

  // Clamp day if month changes
  useEffect(() => {
    if (day > daysInCurrentMonth) {
      setDay(daysInCurrentMonth);
    }
  }, [daysInCurrentMonth, day]);

  // AUTO-APPLY FOR DATE & TIME MODE
  const applyChange = useCallback(
    (newY: number, newM: number, newD: number, newH: number, newMin: number) => {
      const maxD = getDaysInMonth(newY, newM);
      const validD = Math.min(newD, maxD);
      const res = new Date(newY, newM - 1, validD, showTime || mode === "time" ? newH : 0, showTime || mode === "time" ? newMin : 0, 0);
      onApply(res);
      if (onApplyTime) onApplyTime(`${pad2(newH)}:${pad2(newMin)}`);
    },
    [showTime, mode, onApply, onApplyTime]
  );

  // Helper to compute target week when changing month or year:
  // - Jika pekan pertama (1): tetap di pekan pertama (1)
  // - Jika pekan terakhir: otomatis berpindah ke pekan terakhir di bulan baru (4, 5, atau 6)
  // - Jika di tengah: pertahankan nomor pekan (di-clamp ke range valid)
  const computeTargetWeek = useCallback(
    (newY: number, newM: number, currentW: number, oldTotalWeeks: number) => {
      const newWeeks = getWeeksInMonth(newY, newM);
      const newTotal = newWeeks.length;

      if (currentW === 1) {
        return 1;
      }
      if (currentW >= oldTotalWeeks) {
        return newTotal;
      }
      return Math.max(1, Math.min(newTotal, currentW));
    },
    []
  );

  // AUTO-APPLY FOR WEEK MODE
  const applyWeekChange = useCallback(
    (newY: number, newM: number, newW: number) => {
      const currentWeeks = getWeeksInMonth(newY, newM);
      const validW = Math.max(1, Math.min(currentWeeks.length, newW));
      const info = currentWeeks[validW - 1];
      if (info) {
        onApply(info.startDate, info);
        if (onApplyWeek) onApplyWeek(info);
      }
    },
    [onApply, onApplyWeek]
  );

  // Day items (1..daysInCurrentMonth) -> INFINITE
  const dayItems = useMemo(() => {
    const arr = [];
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      arr.push({ value: d, label: pad2(d) });
    }
    return arr;
  }, [daysInCurrentMonth]);

  // Month items (1..12) -> NON-INFINITE (Blank space outside bounds)
  const monthItems = useMemo(() => {
    return MONTHS_BILINGUAL.map((m) => ({
      value: m.value,
      label: isId ? m.idShort : m.enShort,
    }));
  }, [isId]);

  // Year items: EXACTLY 5 YEARS (2 years behind, current year, 2 years ahead) -> NON-INFINITE
  const yearItems = useMemo(() => {
    const curYear = new Date().getFullYear();
    const arr = [];
    for (let y = curYear - 2; y <= curYear + 2; y++) {
      arr.push({ value: y, label: String(y) });
    }
    return arr;
  }, []);

  // Week items (1..4/5/6) -> NON-INFINITE
  const weekItems = useMemo(() => {
    return weekList.map((w) => ({
      value: w.weekNumber,
      label: isId ? `Pekan ${w.weekNumber}` : `Week ${w.weekNumber}`,
    }));
  }, [weekList, isId]);

  // Hour items (00-23) -> INFINITE
  const hourItems = useMemo(() => {
    const arr = [];
    for (let h = 0; h < 24; h++) {
      arr.push({ value: h, label: pad2(h) });
    }
    return arr;
  }, []);

  // Minute items (00-59) -> INFINITE
  const minuteItems = useMemo(() => {
    const arr = [];
    for (let m = 0; m < 60; m++) {
      arr.push({ value: m, label: pad2(m) });
    }
    return arr;
  }, []);

  // Handlers for Date mode
  const handleSelectDay = (val: number) => {
    setDay(val);
    applyChange(year, month, val, hour, minute);
  };

  const handleSelectMonth = (val: number) => {
    setMonth(val);
    if (mode === "week") {
      const targetW = computeTargetWeek(year, val, selectedWeek, weekList.length);
      setSelectedWeek(targetW);
      applyWeekChange(year, val, targetW);
    } else {
      applyChange(year, val, day, hour, minute);
    }
  };

  const handleSelectYear = (val: number) => {
    setYear(val);
    if (mode === "week") {
      const targetW = computeTargetWeek(val, month, selectedWeek, weekList.length);
      setSelectedWeek(targetW);
      applyWeekChange(val, month, targetW);
    } else {
      applyChange(val, month, day, hour, minute);
    }
  };

  const handleSelectHour = (val: number) => {
    setHour(val);
    applyChange(year, month, day, val, minute);
  };

  const handleSelectMinute = (val: number) => {
    setMinute(val);
    applyChange(year, month, day, hour, val);
  };

  // Handler for Week mode
  const handleSelectWeek = (val: number) => {
    setSelectedWeek(val);
    applyWeekChange(year, month, val);
  };

  const currentWeekInfo = weekList[selectedWeek - 1] || weekList[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "p-6 rounded-3xl border border-slate-200/80 dark:border-[#333338] bg-white dark:bg-[#1E1E22] text-slate-900 dark:text-slate-100 shadow-2xl transition-all",
          mode === "time" ? "max-w-xs sm:max-w-xs" : mode === "date" && showTime ? "max-w-lg sm:max-w-xl" : "max-w-md"
        )}
      >
        {/* ONLY 3D CYLINDERS GRID - CONTINUOUS ROTATING WHEEL WITHOUT CENTER BG */}
        <div className="flex items-center gap-3 w-full py-2">
          {mode === "time" ? (
            /* ================= MODE JAM SAJA (TIME ONLY) ================= */
            <>
              {/* Hour (00-23) */}
              <SamsungCylinderColumn
                label={isId ? "Jam" : "Hour"}
                items={hourItems}
                selectedValue={hour}
                onSelect={handleSelectHour}
                loop={true}
              />

              {/* Colon Separator */}
              <span className="text-3xl font-black text-slate-400 self-center pb-2">
                :
              </span>

              {/* Minute (00-59) */}
              <SamsungCylinderColumn
                label={isId ? "Menit" : "Minute"}
                items={minuteItems}
                selectedValue={minute}
                onSelect={handleSelectMinute}
                loop={true}
              />
            </>
          ) : mode === "week" ? (
            /* ================= MODE PEKAN (WEEK) ================= */
            <>
              {/* Pekan -> NON-INFINITE (4, 5, or 6 weeks) */}
              <SamsungCylinderColumn
                label={isId ? "Pekan" : "Week"}
                items={weekItems}
                selectedValue={selectedWeek}
                onSelect={handleSelectWeek}
                loop={false}
              />

              {/* Bulan -> NON-INFINITE */}
              <SamsungCylinderColumn
                label={isId ? "Bulan" : "Month"}
                items={monthItems}
                selectedValue={month}
                onSelect={handleSelectMonth}
                loop={false}
              />

              {/* Tahun -> EXACTLY 5 YEARS, NON-INFINITE */}
              <SamsungCylinderColumn
                label={isId ? "Tahun" : "Year"}
                items={yearItems}
                selectedValue={year}
                onSelect={handleSelectYear}
                loop={false}
              />
            </>
          ) : (
            /* ================= MODE TANGGAL (DATE) ================= */
            <>
              {/* Day -> INFINITE */}
              <SamsungCylinderColumn
                label={isId ? "Tanggal" : "Day"}
                items={dayItems}
                selectedValue={day}
                onSelect={handleSelectDay}
                loop={true}
              />

              {/* Month -> NON-INFINITE */}
              <SamsungCylinderColumn
                label={isId ? "Bulan" : "Month"}
                items={monthItems}
                selectedValue={month}
                onSelect={handleSelectMonth}
                loop={false}
              />

              {/* Year -> EXACTLY 5 YEARS, NON-INFINITE */}
              <SamsungCylinderColumn
                label={isId ? "Tahun" : "Year"}
                items={yearItems}
                selectedValue={year}
                onSelect={handleSelectYear}
                loop={false}
              />

              {/* Hour & Minute if showTime enabled */}
              {showTime && (
                <>
                  {/* Divider */}
                  <div className="h-36 w-[1px] bg-slate-200 dark:bg-[#333338] mx-1 self-center" />

                  {/* Hour (00-23) */}
                  <SamsungCylinderColumn
                    label={isId ? "Jam" : "Hour"}
                    items={hourItems}
                    selectedValue={hour}
                    onSelect={handleSelectHour}
                    loop={true}
                  />

                  {/* Colon Separator */}
                  <span className="text-2xl font-black text-slate-400 self-center pb-2">
                    :
                  </span>

                  {/* Minute (00-59) */}
                  <SamsungCylinderColumn
                    label={isId ? "Menit" : "Minute"}
                    items={minuteItems}
                    selectedValue={minute}
                    onSelect={handleSelectMinute}
                    loop={true}
                  />
                </>
              )}
            </>
          )}
        </div>

        {/* Dynamic ISO Date Range Badge for Week Mode */}
        {mode === "week" && currentWeekInfo && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-[#2C2C32] flex items-center justify-between px-2">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
              {isId ? `Total ${weekList.length} pekan di bulan ini` : `Total ${weekList.length} weeks this month`}
            </span>
            <div className="text-xs font-black tracking-tight text-blue-600 dark:text-[#E2FF66] bg-blue-50 dark:bg-[#E2FF66]/10 px-3 py-1 rounded-full border border-blue-200/50 dark:border-[#E2FF66]/20">
              {isId ? currentWeekInfo.rangeLabelId : currentWeekInfo.rangeLabelEn}
            </div>
          </div>
        )}

        {/* Selected Time Badge for Time Mode */}
        {mode === "time" && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-[#2C2C32] flex items-center justify-center">
            <div className="text-sm font-mono font-black tracking-widest text-blue-600 dark:text-[#E2FF66] bg-blue-50 dark:bg-[#E2FF66]/10 px-4 py-1 rounded-full border border-blue-200/50 dark:border-[#E2FF66]/20">
              {pad2(hour)}:{pad2(minute)}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
