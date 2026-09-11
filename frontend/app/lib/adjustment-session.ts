import { useState, useEffect } from "react";

const STORAGE_KEY = "adjustment_session_expires_at";
const EVENT_NAME = "adjustment_session_changed";

export interface AdjustmentSessionState {
  active: boolean;
  expiresAt: Date | null;
  timeLeftSeconds: number;
  formattedTimeLeft: string;
}

export function getAdjustmentSession(): AdjustmentSessionState {
  if (typeof window === "undefined") {
    return { active: false, expiresAt: null, timeLeftSeconds: 0, formattedTimeLeft: "00:00:00" };
  }

  const expiryStr = localStorage.getItem(STORAGE_KEY);
  if (!expiryStr) {
    return { active: false, expiresAt: null, timeLeftSeconds: 0, formattedTimeLeft: "00:00:00" };
  }

  const expiresAt = new Date(expiryStr);
  const now = Date.now();
  const timeLeftMs = expiresAt.getTime() - now;

  if (timeLeftMs <= 0) {
    return { active: false, expiresAt: null, timeLeftSeconds: 0, formattedTimeLeft: "00:00:00" };
  }

  const totalSeconds = Math.floor(timeLeftMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const formattedTimeLeft = [
    hours.toString().padStart(2, "0"),
    minutes.toString().padStart(2, "0"),
    seconds.toString().padStart(2, "0"),
  ].join(":");

  return {
    active: true,
    expiresAt,
    timeLeftSeconds: totalSeconds,
    formattedTimeLeft,
  };
}

export function activateAdjustmentSession(hours = 24): void {
  if (typeof window === "undefined") return;
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  localStorage.setItem(STORAGE_KEY, expiresAt);
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function deactivateAdjustmentSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function useAdjustmentSession(): AdjustmentSessionState & {
  activateSession: (hours?: number) => void;
  deactivateSession: () => void;
} {
  const [session, setSession] = useState<AdjustmentSessionState>(getAdjustmentSession());

  useEffect(() => {
    const update = () => {
      setSession(getAdjustmentSession());
    };

    update();
    const interval = setInterval(update, 1000);
    window.addEventListener(EVENT_NAME, update);

    return () => {
      clearInterval(interval);
      window.removeEventListener(EVENT_NAME, update);
    };
  }, []);

  return {
    ...session,
    activateSession: activateAdjustmentSession,
    deactivateSession: deactivateAdjustmentSession,
  };
}
