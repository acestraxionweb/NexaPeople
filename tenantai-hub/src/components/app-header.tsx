import { Moon, Sun, LogOut } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { theme, toggleTheme, role, tenantName } = useApp();
  const { user, logout } = useAuth();
  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-background/80 backdrop-blur px-4 md:px-6 sticky top-0 z-10">
      <div className="min-w-0 flex-1">
        <h1 className="text-sm font-semibold truncate">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
      </div>

      <div className="hidden lg:flex items-center text-xs text-muted-foreground">
        {user?.email}
      </div>

      <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>

      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-chart-4 grid place-items-center text-xs font-semibold text-primary-foreground">
        {user?.name?.slice(0, 2).toUpperCase() || (role === "admin" ? "AD" : "??")}
      </div>

      <Button variant="ghost" size="icon" onClick={logout} aria-label="Sign out">
        <LogOut className="h-4 w-4" />
      </Button>
    </header>
  );
}
