const SSR_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const CLIENT_BASE = "http://localhost:8000";
const BASE = typeof window === "undefined" ? SSR_BASE : CLIENT_BASE;

class ApiError extends Error {
  status: number;
  constructor(status: number, msg: string) {
    super(msg);
    this.status = status;
  }
}

function getJwt(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("jwt");
  } catch {
    return null;
  }
}

async function request(
  path: string,
  options?: { method?: string; body?: unknown },
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const t = getJwt();
  if (t) {
    headers["Authorization"] = `Bearer ${t}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    method: options?.method || "GET",
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, text || res.statusText);
  }
  return res.json();
}

/* ── Auth ── */

export const auth = {
  me: () => request("/auth/me"),
};

/* ── Tenant-scoped ── */

export const tenant = {
  summary: () => request("/api/tenant/summary"),
  usage: () => request("/api/tenant/usage"),
  workspace: () => request("/api/tenant/workspace"),
  updateWorkspace: (data: Record<string, unknown>) =>
    request("/api/tenant/workspace", { method: "PUT", body: data }),
  chatbot: () => request("/api/tenant/chatbot"),
  updateChatbot: (data: Record<string, unknown>) =>
    request("/api/tenant/chatbot", { method: "PUT", body: data }),
  keys: () => request("/api/tenant/keys"),
  logs: () => request("/api/tenant/logs"),
  knowledge: () => request("/api/tenant/knowledge"),
  conversations: () => request("/api/tenant/conversations"),
};

export async function uploadDocument(
  file: File,
): Promise<{ filename: string; chunks_uploaded: number; company: string }> {
  const base = CLIENT_BASE;
  const form = new FormData();
  form.append("file", file);
  const t = getJwt();
  const headers: Record<string, string> = {};
  if (t) {
    headers["Authorization"] = `Bearer ${t}`;
  }
  const res = await fetch(`${base}/documents/upload`, { method: "POST", body: form, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, text || res.statusText);
  }
  return res.json();
}

/* ── Admin-scoped ── */

export const admin = {
  tenants: () => request("/api/admin/tenants"),
  health: () => request("/api/admin/health"),
  audit: () => request("/api/admin/audit"),
  usage: () => request("/api/admin/usage"),
  provision: (data: { companyName: string; telegramBotToken: string; plan?: string; adminEmail?: string }) =>
    request("/api/admin/provision", { method: "POST", body: data }),
};
