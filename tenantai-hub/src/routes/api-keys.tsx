import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { tenant } from "@/lib/api";
import { Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/api-keys")({
  head: () => ({ meta: [{ title: "API Keys · Nexus AI" }] }),
  component: ApiKeysPage,
});

function ApiKeysPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["tenant-keys"],
    queryFn: () => tenant.keys(),
  });

  return (
    <DashboardLayout
      title="API Keys"
      subtitle="Your LLM API key is managed by the platform administrator"
    >
      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-5 py-3">Name</th>
              <th className="text-left font-medium">Key</th>
              <th className="text-left font-medium hidden md:table-cell">Created</th>
              <th className="text-left font-medium hidden md:table-cell">Last used</th>
              <th className="text-left font-medium">Status</th>
              <th className="text-right font-medium px-5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-5 py-8 text-center text-muted-foreground" colSpan={6}>
                  Loading...
                </td>
              </tr>
            ) : !data?.keys?.length ? (
              <tr>
                <td className="px-5 py-8 text-center text-muted-foreground" colSpan={6}>
                  No keys found
                </td>
              </tr>
            ) : (
              data.keys.map((k: any) => (
                <tr key={k.id} className="border-t border-border">
                  <td className="px-5 py-3.5 font-medium">{k.name}</td>
                  <td>
                    <code className="font-mono text-xs bg-muted/60 px-2 py-1 rounded">{k.key}</code>
                  </td>
                  <td className="text-muted-foreground hidden md:table-cell">{k.created}</td>
                  <td className="text-muted-foreground hidden md:table-cell">{k.lastUsed}</td>
                  <td>
                    <span
                      className={
                        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium " +
                        (k.status === "active"
                          ? "bg-success/15 text-success"
                          : "bg-muted text-muted-foreground")
                      }
                    >
                      <span
                        className={
                          "h-1.5 w-1.5 rounded-full " +
                          (k.status === "active" ? "bg-success" : "bg-muted-foreground")
                        }
                      />
                      {k.status}
                    </span>
                  </td>
                  <td className="px-5 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(k.key);
                        toast("Copied");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-card p-4 md:p-5">
        <div className="text-sm font-semibold">Security tips</div>
        <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground list-disc pl-5">
          <li>Rotate production keys every 90 days.</li>
          <li>Never commit keys to source code — use environment variables.</li>
          <li>Use separate keys per environment and per integration.</li>
        </ul>
      </div>
    </DashboardLayout>
  );
}
