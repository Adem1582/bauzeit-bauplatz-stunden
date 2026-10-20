import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Palmtree, Stethoscope, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { absenceDays } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/abwesenheit")({
  head: () => ({
    meta: [
      { title: "Mungesat – ALB PROJEKT" },
      { name: "description", content: "Dërgo kërkesë për pushim ose sëmundje dhe ndiq statusin." },
      { property: "og:title", content: "Mungesat – ALB PROJEKT" },
      { property: "og:description", content: "Dërgo dhe menaxho mungesat." },
    ],
  }),
  component: AbwesenheitPage,
});

const TYPES = [
  { value: "urlaub", label: "Pushim", icon: Palmtree },
  { value: "krank", label: "Sëmundje", icon: Stethoscope },
  { value: "sonstiges", label: "Tjetër", icon: HelpCircle },
] as const;

const typeLabel: Record<string, string> = { urlaub: "Pushim", krank: "Sëmundje", sonstiges: "Tjetër" };

const fmtD = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("sq-AL", { day: "2-digit", month: "2-digit", year: "numeric" });

function AbwesenheitPage() {
  const qc = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const [type, setType] = useState<string>("urlaub");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: absences = [] } = useQuery({
    queryKey: ["my-absences", me?.id],
    enabled: !!me,
    queryFn: async () =>
      (
        await supabase
          .from("absences")
          .select("*")
          .eq("user_id", me!.id)
          .order("start_date", { ascending: false })
      ).data ?? [],
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    if (!start || !end) { toast.error("Zgjidh datën e fillimit dhe të mbarimit."); return; }
    if (end < start) { toast.error("Data e mbarimit është para datës së fillimit."); return; }
    setBusy(true);
    const { error } = await supabase.from("absences").insert({
      user_id: me.id,
      type: type as "urlaub" | "krank" | "sonstiges",
      start_date: start,
      end_date: end,
      note: note.trim() || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Kërkesa u dërgua");
    setStart(""); setEnd(""); setNote("");
    qc.invalidateQueries({ queryKey: ["my-absences"] });
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <AppHeader />
      <main className="mx-auto max-w-xl space-y-5 px-4 pt-5">
        <h1 className="text-3xl font-extrabold uppercase">Mungesat</h1>

        <form onSubmit={submit} className="space-y-4 rounded-3xl p-5 text-primary-foreground shadow-lg" style={{ background: "var(--gradient-hero)" }}>
          <h2 className="font-display text-xl font-bold">Kërkesë e re</h2>
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={
                  "flex flex-col items-center gap-1 rounded-2xl p-3 text-sm font-semibold transition " +
                  (type === t.value ? "bg-accent text-accent-foreground shadow" : "bg-card text-card-foreground")
                }
              >
                <t.icon className="h-6 w-6" />
                {t.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-primary-foreground/80">Nga</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} required className="h-12 bg-card text-base text-card-foreground" />
            </div>
            <div className="space-y-1">
              <Label className="text-primary-foreground/80">Deri</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} required className="h-12 bg-card text-base text-card-foreground" />
            </div>
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="Shënim (opsionale)"
            className="min-h-16 bg-card text-base text-card-foreground"
          />
          <Button disabled={busy} className="h-14 w-full rounded-2xl bg-accent text-lg font-extrabold uppercase text-accent-foreground hover:bg-accent/90">
            <CalendarPlus className="h-6 w-6" /> {busy ? "Duke dërguar…" : "Dërgo kërkesën"}
          </Button>
        </form>

        <section>
          <h2 className="mb-2 text-xl font-bold">Kërkesat e mia</h2>
          {absences.length === 0 && <p className="text-sm text-muted-foreground">Ende asnjë kërkesë e dërguar.</p>}
          <div className="space-y-2">
            {absences.map((a) => (
              <div key={a.id} className="rounded-2xl bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{typeLabel[a.type]}</span>
                  <StatusBadge status={a.status} />
                </div>
                <div className="text-sm">
                  {fmtD(a.start_date)} – {fmtD(a.end_date)} · <b>{absenceDays(a)} {absenceDays(a) === 1 ? "ditë" : "ditë"}</b>
                </div>
                {a.note && <div className="text-sm text-muted-foreground">{a.note}</div>}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
