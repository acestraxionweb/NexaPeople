import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout, StatCard } from "@/components/dashboard-layout";
import { useApp } from "@/lib/app-context";
import { admin, tenant } from "@/lib/api";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview · Nexus AI" },
      { name: "description", content: "Multi-tenant AI chatbot platform dashboard." },
    ],
  }),
  component: Overview,
});

const chartColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

function Overview() {
  const { role } = useApp();
  const isAdmin = role === "admin";

  const { data: tData } = useQuery({
    queryKey: ["tenant-summary"],
    queryFn: () => tenant.summary(),
    enabled: !isAdmin,
  });

  const { data: usageData } = useQuery({
    queryKey: ["tenant-usage"],
    queryFn: () => tenant.usage(),
    enabled: !isAdmin,
    select: (d) => d.series.map((s: { date: string; requests: number; tokens: number; cost: number }, i: number) => ({
      day: `D${i + 1}`,
      requests: s.requests,
      tokens: s.tokens,
      cost: s.cost,
    })),
  });

  const { data: adminTenants } = useQuery({
    queryKey: ["admin-tenants"],
    queryFn: () => admin.tenants(),
    enabled: isAdmin,
  });

  const { data: healthData } = useQuery({
    queryKey: ["admin-health"],
    queryFn: () => admin.health(),
    enabled: isAdmin,
  });

  const { data: adminUsageData } = useQuery({
    queryKey: ["admin-usage"],
    queryFn: () => admin.usage(),
    enabled: isAdmin,
  });

  return (
    <DashboardLayout
      title={isAdmin ? "Platform overview" : "Workspace overview"}
      subtitle={
        isAdmin
          ? "Real-time view across all tenants"
          : `Last 30 days of activity`
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isAdmin ? (
          <>
            <StatCard label="Active tenants" value={adminTenants?.tenants?.filter((t: any) => t.status === "active").length.toString() ?? "—"} />
            <StatCard label="Uptime" value={healthData?.uptime ?? "—"} />
            <StatCard label="P95 latency" value={healthData?.p95Latency ?? "—"} />
            <StatCard label="Error rate" value={healthData?.errorRate ?? "—"} />
          </>
        ) : tData ? (
          <>
            <StatCard label="Requests (30d)" value={tData.totalRequests.toLocaleString()} />
            <StatCard label="Tokens" value={tData.totalTokens.toLocaleString()} />
            <StatCard label="Estimated cost" value={`$${tData.totalCost.toFixed(2)}`} />
            <StatCard label="Active keys" value={tData.activeKeys.toString()} />
          </>
        ) : (
          <>
            <StatCard label="Requests (30d)" value="—" />
            <StatCard label="Tokens" value="—" />
            <StatCard label="Estimated cost" value="—" />
            <StatCard label="Active keys" value="—" />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4 md:p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Requests over time</div>
              <div className="text-xs text-muted-foreground">Last 30 days</div>
            </div>
            <span className="text-xs text-success inline-flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" />
            </span>
          </div>
          <div className="mt-4 h-48 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={isAdmin ? (adminUsageData?.series ?? []) : (usageData ?? [])} margin={{ left: -10, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="requests" stroke="var(--chart-1)" fill="url(#g1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 md:p-5">
          <div className="text-sm font-semibold">Company</div>
          <div className="text-xs text-muted-foreground mt-1">{tData?.company ?? "—"}</div>
          {!isAdmin && (
            <ul className="mt-4 space-y-3">
              <li className="flex items-center justify-between text-sm">
                <span>Namespace</span>
                <span className="text-muted-foreground tabular-nums">{tData?.namespace ?? "—"}</span>
              </li>
              <li className="flex items-center justify-between text-sm">
                <span>Total requests</span>
                <span className="text-muted-foreground tabular-nums">{tData?.totalRequests.toLocaleString() ?? "—"}</span>
              </li>
            </ul>
          )}
          {isAdmin && healthData && (
            <ul className="mt-4 space-y-3">
              {healthData.regions.map((r: any) => (
                <li key={r.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className={"h-2 w-2 rounded-full " + (r.status === "healthy" ? "bg-success" : "bg-warning")} />
                    {r.name}
                  </span>
                  <span className="text-muted-foreground tabular-nums">{r.latency}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {isAdmin && adminTenants && (
        <div className="mt-6 rounded-lg border border-border bg-card p-4 md:p-5">
          <div className="text-sm font-semibold mb-3">Tenants</div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left font-medium py-2">Tenant</th>
                <th className="text-left font-medium hidden md:table-cell">Plan</th>
                <th className="text-right font-medium">Requests</th>
                <th className="text-right font-medium">Tokens</th>
                <th className="text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {adminTenants.tenants.map((t: any) => (
                <tr key={t.id} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5">{t.companyName}</td>
                  <td className="text-muted-foreground hidden md:table-cell">{t.plan}</td>
                  <td className="text-right tabular-nums">{t.requests.toLocaleString()}</td>
                  <td className="text-right tabular-nums">{(t.tokens ?? 0).toLocaleString()}</td>
                  <td className="text-right tabular-nums">${t.cost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
