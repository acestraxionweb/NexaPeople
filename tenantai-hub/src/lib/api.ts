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

async function request(
  path: string,
  options?: { method?: string; body?: unknown; apiKey?: string },
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options?.apiKey) {
    headers["x-api-key"] = options.apiKey;
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

/* ── Tenant-scoped (use bot token as apiKey) ── */

export const tenant = {
  summary: (key: string) => request("/api/tenant/summary", { apiKey: key }),
  usage: (key: string) => request("/api/tenant/usage", { apiKey: key }),
  workspace: (key: string) => request("/api/tenant/workspace", { apiKey: key }),
  updateWorkspace: (key: string, data: Record<string, unknown>) =>
    request("/api/tenant/workspace", { method: "PUT", body: data, apiKey: key }),
  chatbot: (key: string) => request("/api/tenant/chatbot", { apiKey: key }),
  updateChatbot: (key: string, data: Record<string, unknown>) =>
    request("/api/tenant/chatbot", { method: "PUT", body: data, apiKey: key }),
  keys: (key: string) => request("/api/tenant/keys", { apiKey: key }),
  logs: (key: string) => request("/api/tenant/logs", { apiKey: key }),
  knowledge: (key: string) => request("/api/tenant/knowledge", { apiKey: key }),
  conversations: (key: string) => request("/api/tenant/conversations", { apiKey: key }),
};

export async function uploadDocument(
  apiKey: string,
  file: File,
): Promise<{ filename: string; chunks_uploaded: number; company: string }> {
  const base = typeof window === "undefined"
    ? (import.meta.env.VITE_API_URL || "http://localhost:8000")
    : "http://localhost:8000";
  const form = new FormData();
  form.append("file", file);
  form.append("bot_token", apiKey);
  const res = await fetch(`${base}/documents/upload`, { method: "POST", body: form });
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
  provision: (data: { companyName: string; telegramBotToken: string; plan?: string }) =>
    request("/api/admin/provision", { method: "POST", body: data }),
};
