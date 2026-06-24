import { useRef, useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { tenant, uploadDocument } from "@/lib/api";
import { FileText, Loader2, Trash2, Upload, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/chatbot")({
  head: () => ({ meta: [{ title: "Chatbot Config · Nexus AI" }] }),
  component: ChatbotPage,
});

function ChatbotPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [temp, setTemp] = useState([0.7]);
  const [maxTok, setMaxTok] = useState([1024]);
  const [sysPrompt, setSysPrompt] = useState("");
  const [preset, setPreset] = useState("");

  const { data: config } = useQuery({
    queryKey: ["chatbot-config"],
    queryFn: () => tenant.chatbot(),
  });

  useEffect(() => {
    if (config) {
      setTemp([config.temperature ?? 0.7]);
      setMaxTok([config.maxTokens ?? 1024]);
      setSysPrompt(config.systemPrompt ?? "");
      setPreset(config.preset ?? "");
    }
  }, [config]);

  const handleSelectPreset = (key: string) => {
    const p = config?.presets?.[key];
    if (p) {
      setPreset(key);
      setSysPrompt(p.template);
    }
  };

  const { data: docs, isLoading: docsLoading } = useQuery({
    queryKey: ["chatbot-knowledge"],
    queryFn: () => tenant.knowledge(),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files are supported");
      return;
    }
    setUploading(true);
    try {
      const result = await uploadDocument(file);
      toast.success(`${result.chunks_uploaded} chunks uploaded from ${result.filename}`);
      queryClient.invalidateQueries({ queryKey: ["chatbot-knowledge"] });
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await tenant.updateChatbot({
        temperature: temp[0],
        maxTokens: maxTok[0],
        systemPrompt: sysPrompt,
        preset,
      });
      toast.success("Configuration saved");
      queryClient.invalidateQueries({ queryKey: ["chatbot-config"] });
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout
      title="Chatbot Configuration"
      subtitle="Tune your assistant, manage knowledge, and connect channels"
      actions={
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </Button>
      }
    >
      <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleUpload} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <section className="rounded-lg border border-border bg-card p-4 md:p-6">
            <h2 className="text-sm font-semibold">Model & behavior</h2>
            <p className="text-xs text-muted-foreground">Define how your bot responds.</p>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Display name</Label>
                <Input defaultValue="Concierge Assistant" />
              </div>
              <div className="space-y-2">
                <Label className="flex justify-between">
                  Temperature{" "}
                  <span className="text-muted-foreground tabular-nums">{temp[0].toFixed(2)}</span>
                </Label>
                <Slider value={temp} onValueChange={setTemp} min={0} max={2} step={0.05} />
              </div>
              <div className="space-y-2">
                <Label className="flex justify-between">
                  Max tokens <span className="text-muted-foreground tabular-nums">{maxTok[0]}</span>
                </Label>
                <Slider value={maxTok} onValueChange={setMaxTok} min={256} max={4096} step={64} />
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div>
                <Label>System prompt preset</Label>
                <p className="text-xs text-muted-foreground">
                  Choose a tone preset or write your own.
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {config?.presets &&
                  Object.entries(config.presets).map(([key, p]: [string, any]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleSelectPreset(key)}
                      className={`relative text-left rounded-lg border p-3 transition-colors ${
                        preset === key
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {preset === key && (
                        <Check className="absolute top-1.5 right-1.5 h-3.5 w-3.5 text-primary" />
                      )}
                      <div className="text-sm font-medium">{p.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                        {p.description}
                      </div>
                    </button>
                  ))}
                <button
                  type="button"
                  onClick={() => {
                    setPreset("custom");
                  }}
                  className={`relative text-left rounded-lg border p-3 transition-colors ${
                    preset === "custom" || !preset
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {(preset === "custom" || !preset) && (
                    <Check className="absolute top-1.5 right-1.5 h-3.5 w-3.5 text-primary" />
                  )}
                  <div className="text-sm font-medium">Custom</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                    Write your own system prompt
                  </div>
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <Label>System prompt</Label>
              <Textarea
                rows={6}
                value={sysPrompt}
                onChange={(e) => {
                  setSysPrompt(e.target.value);
                  if (preset !== "custom") setPreset("custom");
                }}
                className="font-mono text-xs"
              />
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4 md:p-6">
            <h2 className="text-sm font-semibold">Telegram webhook</h2>
            <p className="text-xs text-muted-foreground">
              Forward Telegram updates to your bot endpoint.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Bot token</Label>
                <Input type="password" defaultValue={config?.botToken ?? ""} />
              </div>
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <Input defaultValue={config?.telegramWebhook ?? ""} />
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-lg border border-border bg-card p-4 md:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Knowledge base</h2>
              <Button
                size="sm"
                variant="outline"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5 mr-1" />
                )}
                {uploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
            <ul className="mt-4 space-y-2">
              {docsLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : !docs?.documents?.length ? (
                <p className="text-sm text-muted-foreground">No documents uploaded</p>
              ) : (
                docs.documents.map((d: any) => (
                  <li
                    key={d.id}
                    className="flex items-center gap-3 rounded-md border border-border p-2.5"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{d.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {d.chunks} vectors{/* · {d.uploaded} */}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => toast.error("Removed")}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))
              )}
            </ul>
          </section>
        </aside>
      </div>
    </DashboardLayout>
  );
}
