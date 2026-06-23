import { Moon, Sun, Search } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { theme, toggleTheme, role, setRole, tenantName } = useApp();
  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-background/80 backdrop-blur px-4 md:px-6 sticky top-0 z-10">
      <div className="min-w-0 flex-1">
        <h1 className="text-sm font-semibold truncate">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
      </div>

      <div className="hidden lg:flex items-center gap-2 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-muted-foreground w-72">
        <Search className="h-3.5 w-3.5" />
        <span>Search keys, tenants, logs…</span>
        <kbd className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px]">⌘K</kbd>
      </div>

      <Select value={role} onValueChange={(v) => setRole(v as "admin" | "tenant")}>
        <SelectTrigger className="h-9 w-[140px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="tenant">Tenant view</SelectItem>
          <SelectItem value="admin">Admin view</SelectItem>
        </SelectContent>
      </Select>

      <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>

      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-chart-4 grid place-items-center text-xs font-semibold text-primary-foreground">
        {role === "admin" ? "AD" : (tenantName.match(/\b\w/g)?.slice(0, 2).join("") || "AC")}
      </div>
    </header>
  );
}
