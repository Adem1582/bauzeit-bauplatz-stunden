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
      { title: "Abwesenheiten – Bau-Stempeluhr" },
      { name: "description", content: "Urlaub und Krankmeldung einreichen und Status verfolgen." },
      { property: "og:title", content: "Abwesenheiten – Bau-Stempeluhr" },
      { property: "og:description", content: "Abwesenheiten einreichen und verwalten." },
    ],
  }),
  component: AbwesenheitPage,
});

const TYPES = [
  { value: "urlaub", label: "Urlaub", icon: Palmtree },
  { value: "krank", label: "Krankmeldung", icon: Stethoscope },
  { value: "sonstiges", label: "Sonstiges", icon: HelpCircle },
] as const;

const typeLabel: Record<string, string> = { urlaub: "Urlaub", krank: "Krankmeldung", sonstiges: "Sonstiges" };

const fmtD = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

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
    if (!start || !end) { toast.error("Bitte Start- und Enddatum wählen."); return; }
    if (end < start) { toast.error("Enddatum liegt vor dem Startdatum."); return; }
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
    toast.success("Abwesenheit eingereicht");
    setStart(""); setEnd(""); setNote("");
    qc.invalidateQueries({ queryKey: ["my-absences"] });
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <AppHeader />
      <main className="mx-auto max-w-xl space-y-5 px-4 pt-5">
        <h1 className="text-3xl font-extrabold uppercase">Abwesenheiten</h1>

        <form onSubmit={submit} className="space-y-4 rounded-3xl p-5 text-primary-foreground shadow-lg" style={{ background: "var(--gradient-hero)" }}>
          <h2 className="font-display text-xl font-bold">Neue Abwesenheit</h2>
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
              <Label className="text-primary-foreground/80">Von</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} required className="h-12 bg-card text-base text-card-foreground" />
            </div>
            <div className="space-y-1">
              <Label className="text-primary-foreground/80">Bis</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} required className="h-12 bg-card text-base text-card-foreground" />
            </div>
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="Bemerkung (optional)"
            className="min-h-16 bg-card text-base text-card-foreground"
          />
          <Button disabled={busy} className="h-14 w-full rounded-2xl bg-accent text-lg font-extrabold uppercase text-accent-foreground hover:bg-accent/90">
            <CalendarPlus className="h-6 w-6" /> {busy ? "Wird gesendet…" : "Einreichen"}
          </Button>
        </form>

        <section>
          <h2 className="mb-2 text-xl font-bold">Meine Anträge</h2>
          {absences.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Abwesenheiten eingereicht.</p>}
          <div className="space-y-2">
            {absences.map((a) => (
              <div key={a.id} className="rounded-2xl bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{typeLabel[a.type]}</span>
                  <StatusBadge status={a.status} />
                </div>
                <div className="text-sm">
                  {fmtD(a.start_date)} – {fmtD(a.end_date)} · <b>{absenceDays(a)} {absenceDays(a) === 1 ? "Tag" : "Tage"}</b>
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
