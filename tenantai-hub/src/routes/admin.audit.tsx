import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { admin } from "@/lib/api";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({ meta: [{ title: "Audit Logs · Admin · Nexus AI" }] }),
  component: AuditPage,
});

function AuditPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit"],
    queryFn: () => admin.audit(),
  });

  return (
    <DashboardLayout title="Audit logs" subtitle="Sensitive events across the platform">
      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-5 py-3">Timestamp</th>
              <th className="text-left font-medium">Tenant</th>
              <th className="text-left font-medium hidden md:table-cell">Actor</th>
              <th className="text-left font-medium">Event</th>
              <th className="text-left font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td className="px-5 py-8 text-center text-muted-foreground" colSpan={5}>Loading...</td></tr>
            ) : !data?.logs?.length ? (
              <tr><td className="px-5 py-8 text-center text-muted-foreground" colSpan={5}>No audit logs found</td></tr>
            ) : (
              data.logs.map((a: any, i: number) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-5 py-2.5 text-muted-foreground text-xs tabular-nums">
                    {new Date(a.timestamp).toLocaleString()}
                  </td>
                  <td className="font-medium">{a.tenant}</td>
                  <td className="text-muted-foreground hidden md:table-cell">{a.actor}</td>
                  <td>
                    <code className="font-mono text-xs bg-muted/60 px-2 py-0.5 rounded">{a.event}</code>
                  </td>
                  <td className="text-muted-foreground font-mono text-xs">{a.ip}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
