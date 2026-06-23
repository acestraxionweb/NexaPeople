import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { tenant } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

export const Route = createFileRoute("/logs")({
  head: () => ({ meta: [{ title: "Logs · Nexus AI" }] }),
  component: LogsPage,
});

const statusTone: Record<string, string> = {
  "200": "bg-success/15 text-success",
  "401": "bg-warning/15 text-warning",
  "429": "bg-warning/15 text-warning",
  "500": "bg-destructive/15 text-destructive",
};

const LIMIT_OPTIONS = [50, 100, 200];

function LogsPage() {
  const queryClient = useQueryClient();
  const [limit, setLimit] = useState(50);

  const { data, isLoading } = useQuery({
    queryKey: ["tenant-logs", limit],
    queryFn: () => tenant.logs(limit),
  });

  return (
    <DashboardLayout title="Activity logs" subtitle="API calls, auth events, and bot activity">
      <div className="flex items-center justify-end mb-3 gap-2">
        <span className="text-xs text-muted-foreground">Show</span>
        <Select
          value={String(limit)}
          onValueChange={(v) => { setLimit(Number(v)); queryClient.invalidateQueries({ queryKey: ["tenant-logs"] }); }}
        >
          <SelectTrigger className="w-20 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LIMIT_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-5 py-3">Timestamp</th>
              <th className="text-left font-medium">Actor</th>
              <th className="text-left font-medium">Action</th>
              <th className="text-left font-medium">Resource</th>
              <th className="text-left font-medium">Status</th>
              <th className="text-right font-medium px-5">Latency</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td className="px-5 py-8 text-center text-muted-foreground" colSpan={6}>Loading...</td></tr>
            ) : !data?.logs?.length ? (
              <tr><td className="px-5 py-8 text-center text-muted-foreground" colSpan={6}>No logs found</td></tr>
            ) : (
              data.logs.map((l: any, i: number) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-5 py-2.5 text-muted-foreground tabular-nums text-xs">
                    {new Date(l.timestamp).toLocaleString()}
                  </td>
                  <td className="font-medium">{l.actor}</td>
                  <td className="text-muted-foreground">{l.action}</td>
                  <td><code className="font-mono text-xs">{l.resource}</code></td>
                  <td>
                    <span className={"inline-flex rounded px-2 py-0.5 text-[11px] font-medium " + (statusTone[l.status] ?? "bg-muted text-muted-foreground")}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-5 text-right tabular-nums">{l.latency}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
