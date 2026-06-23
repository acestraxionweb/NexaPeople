import { useState } from "react";
import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { AppSidebar, tenantNav, adminNav } from "./app-sidebar";
import { AppHeader } from "./app-header";
import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Sparkles } from "lucide-react";

export function DashboardLayout({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { role, tenantName } = useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nav = role === "admin" ? adminNav : tenantNav;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader title={title} subtitle={subtitle} onMenuClick={() => setSheetOpen(true)} />
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {actions && (
            <div className="mb-5 flex items-center justify-end gap-2">{actions}</div>
          )}
          {children}
        </main>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-60 p-0">
          <div className="flex h-14 items-center gap-2 px-5 border-b border-sidebar-border">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Nexus AI</div>
              <div className="text-[11px] text-muted-foreground">
                {role === "admin" ? "Platform Admin" : tenantName}
              </div>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto p-2">
            <div className="px-3 pt-3 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {role === "admin" ? "Administration" : "Workspace"}
            </div>
            <ul className="space-y-0.5">
              {nav.map((item) => {
                const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={() => setSheetOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function StatCard({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: string;
  delta?: string;
  hint?: string;
}) {
  const positive = delta?.startsWith("+");
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        {delta && (
          <span
            className={
              "text-xs font-medium " +
              (positive ? "text-success" : "text-destructive")
            }
          >
            {delta}
          </span>
        )}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
