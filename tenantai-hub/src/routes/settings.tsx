import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tenant } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · Nexus AI" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();

  const { data: ws } = useQuery({
    queryKey: ["workspace"],
    queryFn: () => tenant.workspace(),
  });

  const [company, setCompany] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  useEffect(() => {
    if (ws) {
      setCompany(ws.companyName ?? "");
      setSlug(ws.slug ?? "");
      setEmail(ws.email ?? "");
    }
  }, [ws]);

  const saveMutation = useMutation({
    mutationFn: () => tenant.updateWorkspace({ companyName: company }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
      toast.success("Settings saved");
    },
    onError: () => toast.error("Failed to save"),
  });

  return (
    <DashboardLayout
      title="Settings"
      subtitle="Workspace, billing, and security preferences"
      actions={
        <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving..." : "Save"}
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-4 md:p-6">
          <h2 className="text-sm font-semibold">Workspace</h2>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Company name</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Workspace slug</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} disabled />
            </div>
            <div className="space-y-2">
              <Label>Contact email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-4 md:p-6">
          <h2 className="text-sm font-semibold">Plan</h2>
          <div className="mt-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{ws?.plan ?? "Starter"}</div>
              <div className="text-xs text-muted-foreground">
                {ws?.plan === "starter" ? "Pay-as-you-go · $0.001/1K tokens" : "Custom pricing"}
              </div>
            </div>
            <Button variant="outline" size="sm">Manage billing</Button>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
