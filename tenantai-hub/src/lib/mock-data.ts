export type Tenant = {
  id: string;
  name: string;
  plan: "Free" | "Starter" | "Growth" | "Enterprise";
  status: "active" | "suspended" | "disabled";
  users: number;
  requests: number;
  tokens: number;
  cost: number;
  createdAt: string;
};

export const tenants: Tenant[] = [
  { id: "t_01", name: "Acme Corp", plan: "Enterprise", status: "active", users: 42, requests: 1_284_512, tokens: 18_452_900, cost: 1284.5, createdAt: "2025-01-12" },
  { id: "t_02", name: "Northwind Labs", plan: "Growth", status: "active", users: 12, requests: 312_004, tokens: 4_120_004, cost: 286.2, createdAt: "2025-03-04" },
  { id: "t_03", name: "Globex AI", plan: "Starter", status: "active", users: 5, requests: 81_220, tokens: 1_020_410, cost: 72.4, createdAt: "2025-04-21" },
  { id: "t_04", name: "Initech", plan: "Growth", status: "suspended", users: 9, requests: 142_004, tokens: 2_044_002, cost: 142.9, createdAt: "2025-02-18" },
  { id: "t_05", name: "Hooli", plan: "Enterprise", status: "active", users: 88, requests: 2_104_902, tokens: 31_204_902, cost: 2104.9, createdAt: "2024-11-02" },
  { id: "t_06", name: "Stark Industries", plan: "Free", status: "disabled", users: 2, requests: 4_120, tokens: 41_200, cost: 2.8, createdAt: "2025-05-14" },
];

export type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsed: string;
  status: "active" | "revoked";
};

export const apiKeys: ApiKey[] = [
  { id: "k_01", name: "Production", prefix: "sk_live_8f2k...92a1", createdAt: "2025-02-10", lastUsed: "2 min ago", status: "active" },
  { id: "k_02", name: "Staging", prefix: "sk_test_3j2l...77b9", createdAt: "2025-03-22", lastUsed: "1 hour ago", status: "active" },
  { id: "k_03", name: "Telegram Bot", prefix: "sk_live_9p1q...44e2", createdAt: "2025-04-01", lastUsed: "12 min ago", status: "active" },
  { id: "k_04", name: "Legacy Pipeline", prefix: "sk_live_2a8c...10ff", createdAt: "2024-10-09", lastUsed: "30 days ago", status: "revoked" },
];

export const usageSeries = Array.from({ length: 30 }, (_, i) => {
  const day = i + 1;
  const base = 12000 + Math.sin(i / 3) * 3500 + i * 180;
  return {
    day: `D${day}`,
    requests: Math.round(base + Math.random() * 2000),
    tokens: Math.round((base + Math.random() * 2000) * 14),
    cost: +(base * 0.00012 + Math.random() * 1.2).toFixed(2),
  };
});

export const modelMix = [
  { name: "gpt-4o", value: 48 },
  { name: "gpt-4o-mini", value: 32 },
  { name: "claude-3.5", value: 14 },
  { name: "llama-3.1", value: 6 },
];

export type LogEntry = {
  id: string;
  ts: string;
  actor: string;
  action: string;
  resource: string;
  status: "200" | "401" | "429" | "500";
  latencyMs: number;
};

export const logs: LogEntry[] = Array.from({ length: 24 }, (_, i) => {
  const statuses: LogEntry["status"][] = ["200", "200", "200", "200", "429", "401", "500"];
  const actions = ["chat.completion", "embeddings.create", "key.rotate", "auth.login", "webhook.deliver", "config.update"];
  return {
    id: `l_${1000 + i}`,
    ts: new Date(Date.now() - i * 1000 * 60 * 7).toISOString(),
    actor: i % 3 === 0 ? "admin@acme.com" : "bot@acme.com",
    action: actions[i % actions.length],
    resource: `/v1/${actions[i % actions.length].replace(".", "/")}`,
    status: statuses[i % statuses.length],
    latencyMs: Math.round(80 + Math.random() * 540),
  };
});

export type Conversation = {
  id: string;
  user: string;
  channel: "Web" | "Telegram" | "API";
  messages: number;
  lastMessage: string;
  updatedAt: string;
};

export const conversations: Conversation[] = [
  { id: "c_01", user: "user_8821", channel: "Telegram", messages: 24, lastMessage: "Thanks, that solved it!", updatedAt: "3 min ago" },
  { id: "c_02", user: "user_4410", channel: "Web", messages: 8, lastMessage: "Can you summarize the doc?", updatedAt: "12 min ago" },
  { id: "c_03", user: "user_2207", channel: "API", messages: 102, lastMessage: "{\"tool\":\"search\",...}", updatedAt: "1 hour ago" },
  { id: "c_04", user: "user_9912", channel: "Telegram", messages: 5, lastMessage: "Hi 👋", updatedAt: "2 hours ago" },
  { id: "c_05", user: "user_3320", channel: "Web", messages: 41, lastMessage: "Send invoice please", updatedAt: "5 hours ago" },
];

export const knowledgeDocs = [
  { id: "d_01", name: "Product Handbook.pdf", size: "2.4 MB", chunks: 184, updatedAt: "2025-05-11" },
  { id: "d_02", name: "Refund Policy.pdf", size: "412 KB", chunks: 28, updatedAt: "2025-05-03" },
  { id: "d_03", name: "API Reference.pdf", size: "5.1 MB", chunks: 402, updatedAt: "2025-04-22" },
  { id: "d_04", name: "Onboarding FAQ.pdf", size: "184 KB", chunks: 14, updatedAt: "2025-04-09" },
];

export const auditLogs = Array.from({ length: 18 }, (_, i) => ({
  id: `a_${100 + i}`,
  ts: new Date(Date.now() - i * 1000 * 60 * 23).toISOString(),
  tenant: tenants[i % tenants.length].name,
  actor: i % 2 ? "admin@platform.io" : "system",
  event: ["tenant.created", "key.generated", "key.revoked", "tenant.suspended", "user.login", "plan.upgraded"][i % 6],
  ip: `10.0.${i % 12}.${(i * 7) % 250}`,
}));

export const systemHealth = {
  uptime: "99.982%",
  p95Latency: 312,
  errorRate: 0.42,
  activeBots: 318,
  regions: [
    { name: "us-east", latency: 92, status: "healthy" },
    { name: "us-west", latency: 118, status: "healthy" },
    { name: "eu-west", latency: 142, status: "healthy" },
    { name: "ap-southeast", latency: 204, status: "degraded" },
  ],
};
