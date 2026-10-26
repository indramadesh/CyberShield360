import { useCallback, useEffect, useState } from "react";

/** Per-browser preferences (localStorage), kept in sync across components and tabs. */
export const PREFS = {
  /** Save scans to the signed-in account's history. */
  saveHistory: "cs360-pref-save-history",
  /** Show the alert count on the bell. */
  alertBadge: "cs360-pref-alert-badge",
} as const;

const EVENT = "cs360-pref";

export function readPref(key: string, fallback = true): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch { return fallback; }
}

export function usePref(key: string, fallback = true) {
  const [value, setValue] = useState(() => readPref(key, fallback));
  useEffect(() => {
    const sync = () => setValue(readPref(key, fallback));
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, [key, fallback]);
  const set = useCallback((v: boolean) => {
    try { localStorage.setItem(key, v ? "1" : "0"); } catch { /* ignore */ }
    window.dispatchEvent(new Event(EVENT));
  }, [key]);
  return [value, set] as const;
}
