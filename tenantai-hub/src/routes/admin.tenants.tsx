import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Check, Copy, Edit2, Plus, X, Eye, EyeOff } from "lucide-react";
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCompany, setEditCompany] = useState("");
  const [editToken, setEditToken] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editLlKey, setEditLlKey] = useState("");
  const [editBlockOldKey, setEditBlockOldKey] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showLlKey, setShowLlKey] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-tenants"],
    queryFn: () => admin.tenants(),
  });

  const provision = useMutation({
    mutationFn: () =>
      admin.provision({ companyName: company, telegramBotToken: token, plan, adminEmail }),
    onSuccess: (d) => {
      setResult(d);
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
      toast.success("Tenant provisioned");
    },
    onError: (e: any) => toast.error(e.message || "Provision failed"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof admin.updateTenant>[1] }) =>
      admin.updateTenant(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
      setEditingId(null);
      toast.success("Tenant updated");
    },
    onError: (e: any) => toast.error(e.message || "Update failed"),
  });

  const startEditing = (t: any) => {
    setEditingId(t.id);
    setEditCompany(t.companyName);
    setEditToken(t.telegramBotToken);
    setEditEmail(t.adminEmail);
    setEditLlKey("");
    setEditBlockOldKey(false);
    setShowToken(false);
    setShowLlKey(false);
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const saveEdit = (id: string) => {
    const payload: any = {};
    const orig = data?.tenants?.find((t: any) => t.id === id);
    if (!orig) return;
    if (editCompany !== orig.companyName) payload.companyName = editCompany;
    if (editToken !== orig.telegramBotToken) payload.botToken = editToken;
    if (editEmail !== orig.adminEmail) payload.adminEmail = editEmail;
    if (editLlKey) {
      payload.litellmVirtualKey = editLlKey;
      payload.blockOldKey = editBlockOldKey;
    }
    if (Object.keys(payload).length === 0) {
      setEditingId(null);
      return;
    }
    updateMutation.mutate({ id, data: payload });
  };

  const reset = () => {
    setCompany("");
    setToken("");
    setAdminEmail("");
    setPlan("starter");
    setResult(null);
  };

  const isSaving = updateMutation.isPending;

  return (
    <DashboardLayout
      title="Tenants"
      subtitle="All companies on the platform"
      actions={
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) reset();
          }}
        >
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
                      <code className="flex-1 text-xs bg-muted px-2 py-1 rounded break-all">
                        {v}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          navigator.clipboard.writeText(v);
                          toast("Copied");
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setOpen(false);
                    reset();
                  }}
                >
                  <Check className="h-4 w-4 mr-1" /> Done
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Company name</Label>
                  <Input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Acme Corp"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telegram bot token</Label>
                  <Input
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="123456:ABC-DEF..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Admin email</Label>
                  <Input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <Select value={plan} onValueChange={setPlan}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
              <th className="text-left font-medium hidden md:table-cell">Bot Token</th>
              <th className="text-left font-medium hidden lg:table-cell">Admin Email</th>
              <th className="text-left font-medium hidden md:table-cell">LLM Key</th>
              <th className="text-left font-medium hidden md:table-cell">Plan</th>
              <th className="text-left font-medium hidden md:table-cell">Status</th>
              <th className="text-right font-medium">Users</th>
              <th className="text-right font-medium">Requests</th>
              <th className="text-right font-medium">Cost</th>
              <th className="px-5"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-5 py-8 text-center text-muted-foreground" colSpan={10}>
                  Loading...
                </td>
              </tr>
            ) : !data?.tenants?.length ? (
              <tr>
                <td className="px-5 py-8 text-center text-muted-foreground" colSpan={10}>
                  No tenants found
                </td>
              </tr>
            ) : (
              data.tenants.map((t: any) => (
                <tr key={t.id} className="border-t border-border">
                  {editingId === t.id ? (
                    <>
                      <td className="px-5 py-3">
                        <Input
                          value={editCompany}
                          onChange={(e) => setEditCompany(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        <div className="flex items-center gap-1">
                          <Input
                            value={editToken}
                            onChange={(e) => setEditToken(e.target.value)}
                            type={showToken ? "text" : "password"}
                            className="h-8 text-sm font-mono flex-1 min-w-[120px]"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => setShowToken(!showToken)}
                          >
                            {showToken ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </td>
                      <td className="px-5 py-3 hidden lg:table-cell">
                        <Input
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          type="email"
                          className="h-8 text-sm"
                        />
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <Input
                              value={editLlKey}
                              onChange={(e) => setEditLlKey(e.target.value)}
                              type={showLlKey ? "text" : "password"}
                              placeholder="New key (leave blank to keep)"
                              className="h-8 text-sm font-mono flex-1 min-w-[120px]"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={() => setShowLlKey(!showLlKey)}
                            >
                              {showLlKey ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                          {editLlKey && (
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id="block-old"
                                checked={editBlockOldKey}
                                onCheckedChange={(v) => setEditBlockOldKey(v === true)}
                              />
                              <Label
                                htmlFor="block-old"
                                className="text-xs text-muted-foreground cursor-pointer"
                              >
                                Block old key
                              </Label>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell capitalize">
                        <Select value={t.plan} onValueChange={() => {}} disabled>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                        </Select>
                      </td>
                      <td className="hidden md:table-cell">
                        <span
                          className={
                            "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium " +
                            (statusTone[t.status] ?? "bg-muted text-muted-foreground")
                          }
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="text-right tabular-nums">{t.users}</td>
                      <td className="text-right tabular-nums">{t.requests.toLocaleString()}</td>
                      <td className="text-right tabular-nums">${t.cost.toFixed(2)}</td>
                      <td className="px-5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8"
                            onClick={() => saveEdit(t.id)}
                            disabled={isSaving}
                          >
                            {isSaving ? "..." : <Check className="h-3.5 w-3.5" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8"
                            onClick={cancelEditing}
                            disabled={isSaving}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-5 py-3">
                        <div className="font-medium">{t.companyName}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{t.id}</div>
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                          {t.telegramBotToken?.slice(0, 12)}...
                        </code>
                      </td>
                      <td className="px-5 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                        {t.adminEmail || "—"}
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        <span
                          className={
                            "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium " +
                            (t.litellmKeyStatus === "active"
                              ? "bg-success/15 text-success"
                              : "bg-warning/15 text-warning")
                          }
                        >
                          {t.litellmKeyStatus}
                        </span>
                      </td>
                      <td className="text-muted-foreground capitalize hidden md:table-cell">
                        {t.plan}
                      </td>
                      <td className="hidden md:table-cell">
                        <span
                          className={
                            "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium " +
                            (statusTone[t.status] ?? "bg-muted text-muted-foreground")
                          }
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="text-right tabular-nums">{t.users}</td>
                      <td className="text-right tabular-nums">{t.requests.toLocaleString()}</td>
                      <td className="text-right tabular-nums">${t.cost.toFixed(2)}</td>
                      <td className="px-5 text-right">
                        <Button variant="ghost" size="icon" onClick={() => startEditing(t)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
