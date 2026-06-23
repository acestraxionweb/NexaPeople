import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { auth } from "./api";

export type User = {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "tenant";
  tenant_id: string | null;
  tenant_name: string | null;
};

type Ctx = {
  user: User | null;
  loading: boolean;
  login: (token: string) => void;
  logout: () => void;
  isAdmin: boolean;
};

const AuthCtx = createContext<Ctx | null>(null);

export function setToken(t: string) {
  try { localStorage.setItem("jwt", t); } catch {}
}

export function clearToken() {
  try { localStorage.removeItem("jwt"); } catch {}
}

export function getToken(): string | null {
  try { return localStorage.getItem("jwt"); } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchUser = async () => {
    try {
      const u = await auth.me();
      setUser(u);
      return u;
    } catch {
      clearToken();
      setUser(null);
      return null;
    }
  };

  useEffect(() => {
    const token = getToken();
    if (token) {
      fetchUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token: string) => {
    setToken(token);
    fetchUser().then((u) => {
      if (u) {
        navigate({ to: "/" });
      }
    });
  };

  const logout = () => {
    clearToken();
    setUser(null);
    navigate({ to: "/login" });
  };

  return (
    <AuthCtx.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAdmin: user?.role === "admin",
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
