import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { HardHat, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/session";

export function AppHeader() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: me } = useQuery(meQuery);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-20 bg-primary text-primary-foreground shadow-md">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <div className="rounded-xl bg-accent p-2 text-accent-foreground">
          <HardHat className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-xl font-bold uppercase leading-none">ALB PROJEKT</div>
          <div className="truncate text-xs opacity-80">{me?.name}</div>
        </div>
        <nav className="flex gap-1 text-sm font-semibold">
          <Link to="/zeit" className="rounded-lg px-3 py-2" activeProps={{ className: "bg-sidebar-accent" }}>Stempeln</Link>
          <Link to="/abwesenheit" className="rounded-lg px-3 py-2" activeProps={{ className: "bg-sidebar-accent" }}>Abwesenheit</Link>
          {me?.isAdmin && (
            <Link to="/chef" className="rounded-lg px-3 py-2" activeProps={{ className: "bg-sidebar-accent" }}>Chef</Link>
          )}
        </nav>
        <button onClick={signOut} aria-label="Abmelden" className="rounded-lg p-2 hover:bg-sidebar-accent">
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
