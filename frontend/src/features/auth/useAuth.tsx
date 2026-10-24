import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { apiFetch } from "@/services/api";

interface User {
  id: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  /** True when the visitor explicitly chose "continue as guest" (no account). */
  isGuest: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  continueAsGuest: () => void;
}

const Ctx = createContext<AuthState | null>(null);
const ACCESS = "cs360-access";
const REFRESH = "cs360-refresh";
const GUEST = "cs360-guest";

function readGuest(): boolean {
  try { return localStorage.getItem(GUEST) === "1"; } catch { return false; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [guest, setGuest] = useState<boolean>(readGuest);

  const loadMe = useCallback(async () => {
    if (!localStorage.getItem(ACCESS)) return;
    try {
      setUser(await apiFetch<User>("/auth/me"));
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => { void loadMe(); }, [loadMe]);

  const clearGuest = useCallback(() => {
    try { localStorage.removeItem(GUEST); } catch { /* ignore */ }
    setGuest(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const t = await apiFetch<{ access_token: string; refresh_token: string }>("/auth/login", {
      method: "POST", body: JSON.stringify({ email, password }),
    });
    localStorage.setItem(ACCESS, t.access_token);
    localStorage.setItem(REFRESH, t.refresh_token);
    clearGuest();
    await loadMe();
  }, [loadMe, clearGuest]);

  const register = useCallback(async (email: string, password: string) => {
    await apiFetch("/auth/register", { method: "POST", body: JSON.stringify({ email, password }) });
    await login(email, password);
  }, [login]);

  const logout = useCallback(() => {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
    clearGuest();
    setUser(null);
  }, [clearGuest]);

  const continueAsGuest = useCallback(() => {
    try { localStorage.setItem(GUEST, "1"); } catch { /* ignore */ }
    setGuest(true);
  }, []);

  const value = useMemo(
    () => ({ user, isGuest: guest && !user, login, register, logout, continueAsGuest }),
    [user, guest, login, register, logout, continueAsGuest],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
