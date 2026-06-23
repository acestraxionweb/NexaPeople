import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout, StatCard } from "@/components/dashboard-layout";
import { useApp } from "@/lib/app-context";
import { tenant } from "@/lib/api";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/usage")({
  head: () => ({ meta: [{ title: "Usage · Nexus AI" }] }),
  component: UsagePage,
});

function UsagePage() {
  const { apiKey } = useApp();
  const { data, isLoading } = useQuery({
    queryKey: ["tenant-usage"],
    queryFn: () => tenant.usage(apiKey),
    enabled: !!apiKey,
    select: (d) => d.series.map((s: any, i: number) => ({
      day: `D${i + 1}`,
      requests: s.requests,
      tokens: s.tokens,
      cost: s.cost,
    })),
  });

  const totalReq = data?.reduce((a: number, b: any) => a + b.requests, 0) ?? 0;
  const totalTok = data?.reduce((a: number, b: any) => a + b.tokens, 0) ?? 0;
  const totalCost = data?.reduce((a: number, b: any) => a + b.cost, 0) ?? 0;

  return (
    <DashboardLayout title="Usage" subtitle="Requests, tokens, and estimated cost">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Requests (30d)" value={totalReq ? totalReq.toLocaleString() : "—"} />
        <StatCard label="Tokens (30d)" value={totalTok ? (totalTok / 1_000_000).toFixed(2) + "M" : "—"} />
        <StatCard label="Estimated cost" value={totalCost ? "$" + totalCost.toFixed(2) : "—"} />
      </div>

      {isLoading ? (
        <div className="mt-6 text-center text-muted-foreground text-sm">Loading usage data...</div>
      ) : !data?.length ? (
        <div className="mt-6 text-center text-muted-foreground text-sm">No usage data available</div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="text-sm font-semibold">Requests / day</div>
            <div className="mt-3 h-64">
              <ResponsiveContainer>
                <BarChart data={data} margin={{ left: -10, right: 8 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" fontSize={11} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="requests" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <div className="text-sm font-semibold">Cost trend</div>
            <div className="mt-3 h-64">
              <ResponsiveContainer>
                <LineChart data={data} margin={{ left: -10, right: 8 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" fontSize={11} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="cost" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
