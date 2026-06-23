import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { admin } from "@/lib/api";
import { Check, Copy, MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/tenants")({
  head: () => ({ meta: [{ title: "Tenants · Admin · Nexus AI" }] }),
  component: TenantsPage,
});

const statusTone: Record<string, string> = {
  active: "bg-success/15 text-success",
  suspended: "bg-warning/15 text-warning",
  disabled: "bg-muted text-muted-foreground",
};

function TenantsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [company, setCompany] = useState("");
  const [token, setToken] = useState("");
  const [plan, setPlan] = useState("starter");
  const [adminEmail, setAdminEmail] = useState("");
  const [result, setResult] = useState<Record<string, string> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-tenants"],
    queryFn: () => admin.tenants(),
  });

  const provision = useMutation({
    mutationFn: () => admin.provision({ companyName: company, telegramBotToken: token, plan, adminEmail }),
    onSuccess: (d) => {
      setResult(d);
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
      toast.success("Tenant provisioned");
    },
    onError: (e: any) => toast.error(e.message || "Provision failed"),
  });

  const reset = () => {
    setCompany("");
    setToken("");
    setAdminEmail("");
    setPlan("starter");
    setResult(null);
  };

  return (
    <DashboardLayout
      title="Tenants"
      subtitle="All companies on the platform"
      actions={
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> New tenant
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{result ? "Tenant provisioned" : "Provision new tenant"}</DialogTitle>
              <DialogDescription>
                {result
                  ? "Share these credentials with your client."
                  : "Enter the company name and Telegram bot token."}
              </DialogDescription>
            </DialogHeader>

            {result ? (
              <div className="space-y-3">
                {Object.entries(result).map(([k, v]) => (
                  <div key={k} className="text-sm">
                    <div className="font-medium text-muted-foreground text-xs mb-0.5">{k}</div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-muted px-2 py-1 rounded break-all">{v}</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { navigator.clipboard.writeText(v); toast("Copied"); }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button size="sm" className="w-full" onClick={() => { setOpen(false); reset(); }}>
                  <Check className="h-4 w-4 mr-1" /> Done
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Company name</Label>
                  <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Corp" />
                </div>
                <div className="space-y-2">
                  <Label>Telegram bot token</Label>
                  <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456:ABC-DEF..." />
                </div>
                <div className="space-y-2">
                  <Label>Admin email</Label>
                  <Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@company.com" />
                </div>
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <Select value={plan} onValueChange={setPlan}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="growth">Growth</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  disabled={!company || !token || provision.isPending}
                  onClick={() => provision.mutate()}
                >
                  {provision.isPending ? "Provisioning..." : "Provision"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      }
    >
      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-5 py-3">Tenant</th>
              <th className="text-left font-medium">Plan</th>
              <th className="text-left font-medium">Status</th>
              <th className="text-right font-medium">Users</th>
              <th className="text-right font-medium">Requests</th>
              <th className="text-right font-medium">Cost</th>
              <th className="text-left font-medium pl-6">Created</th>
              <th className="px-5"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td className="px-5 py-8 text-center text-muted-foreground" colSpan={8}>Loading...</td></tr>
            ) : !data?.tenants?.length ? (
              <tr><td className="px-5 py-8 text-center text-muted-foreground" colSpan={8}>No tenants found</td></tr>
            ) : (
              data.tenants.map((t: any) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-5 py-3">
                    <div className="font-medium">{t.companyName}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{t.id}</div>
                  </td>
                  <td className="text-muted-foreground capitalize">{t.plan}</td>
                  <td>
                    <span className={"inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium " + (statusTone[t.status] ?? "bg-muted text-muted-foreground")}>
                      {t.status}
                    </span>
                  </td>
                  <td className="text-right tabular-nums">{t.users}</td>
                  <td className="text-right tabular-nums">{t.requests.toLocaleString()}</td>
                  <td className="text-right tabular-nums">${t.cost.toFixed(2)}</td>
                  <td className="text-muted-foreground pl-6">{t.created}</td>
                  <td className="px-5 text-right">
                    <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
