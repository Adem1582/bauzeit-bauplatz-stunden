import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HardHat } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Hyrje – ALB PROJEKT" },
      { name: "description", content: "Hyr në ALB PROJEKT me email dhe fjalëkalim." },
      { property: "og:title", content: "Hyrje – ALB PROJEKT" },
      { property: "og:description", content: "Hyrje në regjistrimin e orëve." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [adminExists, setAdminExists] = useState(true);
  const [mode, setMode] = useState<"login" | "setup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => data.user && navigate({ to: "/" }));
    supabase.rpc("admin_exists").then(({ data }) => setAdminExists(data !== false));
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) { toast.error("Hyrja dështoi. Email-i ose fjalëkalimi është gabim."); return; }
      navigate({ to: "/" });
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
      });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      if (data.session) navigate({ to: "/" });
      else toast.success("Konfirmo email-in tënd përmes linkut që të erdhi në postë.");
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--gradient-hero)" }}>
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10">
        <div className="flex items-center gap-3 mb-8 text-primary-foreground">
          <div className="rounded-2xl bg-accent p-3 text-accent-foreground">
            <HardHat className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-extrabold uppercase">ALB PROJEKT</h1>
        </div>
        <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-card p-6 shadow-2xl">
          <h2 className="text-2xl font-bold">{mode === "login" ? "Hyrje" : "Krijo llogarinë e shefit"}</h2>
          {mode === "setup" && (
            <div className="space-y-2">
              <Label htmlFor="name">Emri</Label>
              <Input id="name" className="h-12 text-base" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" className="h-12 text-base" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw">Fjalëkalimi</Label>
            <Input id="pw" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} className="h-12 text-base" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" disabled={busy} className="w-full h-14 text-lg font-bold bg-accent text-accent-foreground hover:bg-accent/90">
            {busy ? "Prisni…" : mode === "login" ? "Hyr" : "Krijo llogarinë"}
          </Button>
          {!adminExists && (
            <button type="button" onClick={() => setMode(mode === "login" ? "setup" : "login")} className="w-full text-sm text-muted-foreground underline">
              {mode === "login" ? "Konfigurimi i parë: krijo llogarinë e shefit" : "Kthehu te hyrja"}
            </button>
          )}
          {adminExists && <p className="text-center text-xs text-muted-foreground">Të dhënat e hyrjes i merr nga shefi.</p>}
        </form>
      </div>
    </div>
  );
}
