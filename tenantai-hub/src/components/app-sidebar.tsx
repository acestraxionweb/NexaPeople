import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  KeyRound,
  Activity,
  Bot,
  ScrollText,
  Settings,
  Building2,
  ShieldCheck,
  HeartPulse,
  Sparkles,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

const tenantNav: NavItem[] = [
  { to: "/", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/api-keys", label: "API Keys", icon: KeyRound },
  { to: "/usage", label: "Usage", icon: Activity },
  { to: "/chatbot", label: "Chatbot Config", icon: Bot },
  { to: "/logs", label: "Logs", icon: ScrollText },
  { to: "/settings", label: "Settings", icon: Settings },
];

const adminNav: NavItem[] = [
  { to: "/", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/tenants", label: "Tenants", icon: Building2 },
  { to: "/usage", label: "Global Usage", icon: Activity },
  { to: "/admin/health", label: "System Health", icon: HeartPulse },
  { to: "/admin/audit", label: "Audit Logs", icon: ShieldCheck },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const { role, tenantName } = useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nav = role === "admin" ? adminNav : tenantNav;

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
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
                  to={item.to as never}
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

      <div className="border-t border-sidebar-border p-3 text-[11px] text-muted-foreground">
        v1.0.0 · all systems normal
      </div>
    </aside>
  );
}
