import { useCallback, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

/**
 * One shared theme for the whole app. Light is the default; the choice is kept in
 * localStorage ("cs360-theme") and applied as the `dark` class on <html>.
 * Every consumer (toggles, artwork) stays in sync through the class itself.
 */
const current = (): Theme => (document.documentElement.classList.contains("dark") ? "dark" : "light");

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => obs.disconnect();
}

export function setTheme(t: Theme) {
  document.documentElement.classList.toggle("dark", t === "dark");
  try { localStorage.setItem("cs360-theme", t); } catch { /* private mode etc. */ }
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, current, () => "light" as Theme);
  const toggle = useCallback(() => setTheme(current() === "dark" ? "light" : "dark"), []);
  return { theme, toggle, setTheme };
}
