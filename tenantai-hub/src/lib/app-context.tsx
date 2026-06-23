import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Role = "admin" | "tenant";
type Theme = "light" | "dark";

function getInit<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const v = localStorage.getItem(key);
  if (v === null) return fallback;
  try { return JSON.parse(v) as T; } catch { return v as unknown as T; }
}

type Ctx = {
  role: Role;
  setRole: (r: Role) => void;
  theme: Theme;
  toggleTheme: () => void;
  tenantName: string;
  setTenantName: (n: string) => void;
  apiKey: string;
  setApiKey: (k: string) => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(() => getInit("role", "tenant"));
  const [theme, setTheme] = useState<Theme>(() => getInit("theme", "dark"));
  const [tenantName, setTenantName] = useState(() => getInit("tenantName", "Acme Corp"));
  const [apiKey, setApiKeyState] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        const ls = localStorage.getItem("apiKey");
        if (ls) return ls;
      }
    } catch {}
    return import.meta.env.VITE_API_KEY || "";
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("role", role);
  }, [role]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (tenantName) localStorage.setItem("tenantName", tenantName);
  }, [tenantName]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (apiKey) localStorage.setItem("apiKey", apiKey);
  }, [apiKey]);

  return (
    <AppCtx.Provider
      value={{
        role, setRole: (r) => setRoleState(r),
        theme, toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
        tenantName, setTenantName,
        apiKey, setApiKey: (k) => setApiKeyState(k),
      }}
    >
      {children}
    </AppCtx.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
