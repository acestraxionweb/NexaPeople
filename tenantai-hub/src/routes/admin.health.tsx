import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout, StatCard } from "@/components/dashboard-layout";
import { admin } from "@/lib/api";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/admin/health")({
  head: () => ({ meta: [{ title: "System Health · Admin · Nexus AI" }] }),
  component: HealthPage,
});

function HealthPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-health"],
    queryFn: () => admin.health(),
  });

  const latencyData = data?.latencyHistory?.map((s: any, i: number) => ({
    day: `D${i + 1}`,
    latency: s.latency,
  }));

  return (
    <DashboardLayout title="System health" subtitle="Live infrastructure & API performance">
      {isLoading ? (
        <div className="text-center text-muted-foreground text-sm py-8">Loading...</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Uptime" value={data?.uptime ?? "—"} hint="Last 30 days" />
            <StatCard label="P95 latency" value={data?.p95Latency ?? "—"} />
            <StatCard label="Error rate" value={data?.errorRate ?? "—"} />
            <StatCard label="Active bots" value={data?.activeBots?.toString() ?? "—"} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
              <div className="text-sm font-semibold">API latency (p95)</div>
              <div className="mt-3 h-64">
                <ResponsiveContainer>
                  <AreaChart data={latencyData ?? []} margin={{ left: -10, right: 8 }}>
                    <defs>
                      <linearGradient id="lh" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="day" fontSize={11} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="latency" stroke="var(--chart-2)" fill="url(#lh)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-5">
              <div className="text-sm font-semibold">Regions</div>
              <ul className="mt-4 space-y-3">
                {data?.regions?.map((r: any) => (
                  <li key={r.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className={"h-2 w-2 rounded-full " + (r.status === "healthy" ? "bg-success" : "bg-warning")} />
                      {r.name}
                    </span>
                    <span className="text-muted-foreground tabular-nums">{r.latency}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
