import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./auth-context";

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
  theme: Theme;
  toggleTheme: () => void;
  tenantName: string;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => getInit("theme", "dark"));

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <AppCtx.Provider
      value={{
        theme, toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
        // These will be overridden by AuthAware wrapper; defaults here for SSR
        role: "tenant",
        tenantName: "",
      }}
    >
      {children}
    </AppCtx.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  const { user } = useAuth();
  return {
    ...ctx,
    role: (user?.role || "tenant") as Role,
    tenantName: user?.tenant_name || user?.name || "",
  };
}
