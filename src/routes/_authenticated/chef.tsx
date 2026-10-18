import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Download, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createEmployee } from "@/lib/admin.functions";
import { calcWage, currentYm, downloadCsv, eur, fmtDate, fmtHours, fmtTime, entryHours, monthRange, toCsv } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/chef")({
  head: () => ({
    meta: [
      { title: "Chef-Bereich – Bau-Stempeluhr" },
      { name: "description", content: "Mitarbeiter, Baustellen, Freigaben und Monatslohn verwalten." },
      { property: "og:title", content: "Chef-Bereich – Bau-Stempeluhr" },
      { property: "og:description", content: "Verwaltung der Zeiterfassung." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user!.id);
    if (!roles?.some((r) => r.role === "admin")) throw redirect({ to: "/zeit" });
  },
  component: ChefPage,
});

function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => (await supabase.from("profiles").select("*").order("full_name")).data ?? [],
  });
}
function useSites() {
  return useQuery({
    queryKey: ["sites", "all"],
    queryFn: async () => (await supabase.from("sites").select("*").order("name")).data ?? [],
  });
}

function ChefPage() {
  return (
    <div className="min-h-screen bg-background pb-12">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 pt-5">
        <h1 className="mb-4 text-3xl font-extrabold uppercase">Chef-Bereich</h1>
        <Tabs defaultValue="eintraege">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
            <TabsTrigger value="eintraege" className="py-2.5">Einträge</TabsTrigger>
            <TabsTrigger value="monat" className="py-2.5">Monat & Lohn</TabsTrigger>
            <TabsTrigger value="mitarbeiter" className="py-2.5">Mitarbeiter</TabsTrigger>
            <TabsTrigger value="baustellen" className="py-2.5">Baustellen</TabsTrigger>
          </TabsList>
          <TabsContent value="eintraege"><EntriesTab /></TabsContent>
          <TabsContent value="monat"><MonthTab /></TabsContent>
          <TabsContent value="mitarbeiter"><EmployeesTab /></TabsContent>
          <TabsContent value="baustellen"><SitesTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function useMonthEntries(ym: string) {
  return useQuery({
    queryKey: ["entries", ym],
    queryFn: async () => {
      const { from, to } = monthRange(ym);
      return (
        (
          await supabase
            .from("time_entries")
            .select("*, sites(name), profiles(full_name, hourly_wage)")
            .gte("clock_in", from.toISOString())
            .lt("clock_in", to.toISOString())
            .order("clock_in", { ascending: false })
        ).data ?? []
      );
    },
  });
}

function MonthInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>Monat</Label>
      <Input type="month" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} className="h-11" />
    </div>
  );
}

function EntriesTab() {
  const qc = useQueryClient();
  const [ym, setYm] = useState(currentYm());
  const [emp, setEmp] = useState("alle");
  const [site, setSite] = useState("alle");
  const [status, setStatus] = useState("alle");
  const { data: profiles = [] } = useProfiles();
  const { data: sites = [] } = useSites();
  const { data: entries = [] } = useMonthEntries(ym);

  const filtered = entries.filter(
    (e) =>
      (emp === "alle" || e.user_id === emp) &&
      (site === "alle" || e.site_id === site) &&
      (status === "alle" || e.status === status),
  );

  async function setEntryStatus(id: string, s: "freigegeben" | "abgelehnt" | "offen") {
    const { error } = await supabase.from("time_entries").update({ status: s }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["entries"] });
  }

  async function approveAll() {
    const ids = filtered.filter((e) => e.status === "offen" && e.clock_out).map((e) => e.id);
    if (!ids.length) return;
    const { error } = await supabase.from("time_entries").update({ status: "freigegeben" }).in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} Einträge freigegeben`);
    qc.invalidateQueries({ queryKey: ["entries"] });
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-3 rounded-2xl bg-card p-4 shadow-sm md:grid-cols-4">
        <MonthInput value={ym} onChange={setYm} />
        <FilterSelect label="Mitarbeiter" value={emp} onChange={setEmp} options={profiles.map((p) => [p.id, p.full_name])} />
        <FilterSelect label="Baustelle" value={site} onChange={setSite} options={sites.map((s) => [s.id, s.name])} />
        <FilterSelect label="Status" value={status} onChange={setStatus} options={[["offen", "Offen"], ["freigegeben", "Freigegeben"], ["abgelehnt", "Abgelehnt"]]} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{filtered.length} Einträge</span>
        <Button onClick={approveAll} variant="outline" className="h-11">
          <Check /> Alle offenen freigeben
        </Button>
      </div>
      <div className="space-y-2">
        {filtered.map((e) => (
          <div key={e.id} className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-semibold">
                {e.profiles?.full_name} <StatusBadge status={e.status} />
              </div>
              <div className="text-sm">
                {fmtDate(e.clock_in)} · {fmtTime(e.clock_in)}–{fmtTime(e.clock_out)} · <b>{fmtHours(entryHours(e))}</b> · {e.sites?.name ?? "—"}
              </div>
              {e.description && <div className="text-sm text-muted-foreground">{e.description}</div>}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setEntryStatus(e.id, "freigegeben")} disabled={e.status === "freigegeben"} className="h-12 flex-1 bg-success text-success-foreground hover:bg-success/90 sm:flex-none">
                <Check /> Freigeben
              </Button>
              <Button onClick={() => setEntryStatus(e.id, "abgelehnt")} disabled={e.status === "abgelehnt"} variant="destructive" className="h-12 flex-1 sm:flex-none">
                <X /> Ablehnen
              </Button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="py-8 text-center text-muted-foreground">Keine Einträge gefunden.</p>}
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[][] }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="alle">Alle</SelectItem>
          {options.map(([v = "", l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function MonthTab() {
  const [ym, setYm] = useState(currentYm());
  const { data: profiles = [] } = useProfiles();
  const { data: entries = [] } = useMonthEntries(ym);

  const rows = useMemo(
    () =>
      profiles.map((p) => {
        const mine = entries.filter((e) => e.user_id === p.id);
        const { hours, wage } = calcWage(mine, Number(p.hourly_wage));
        const approved = calcWage(mine.filter((e) => e.status === "freigegeben"), Number(p.hourly_wage)).hours;
        return { p, hours, approved, open: mine.filter((e) => e.status === "offen").length, wage };
      }),
    [profiles, entries],
  );
  const total = rows.reduce((s, r) => s + r.wage, 0);

  function exportCsv() {
    const csv = toCsv([
      ["Mitarbeiter", "E-Mail", "Monat", "Stunden gesamt", "davon freigegeben", "Stundenlohn (EUR)", "Lohn (EUR)"],
      ...rows.map((r) => [r.p.full_name, r.p.email ?? "", ym, r.hours, r.approved, Number(r.p.hourly_wage), r.wage]),
      ["Summe", "", ym, rows.reduce((s, r) => s + r.hours, 0), rows.reduce((s, r) => s + r.approved, 0), "", total],
    ]);
    downloadCsv(`lohn-${ym}.csv`, csv);
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-card p-4 shadow-sm">
        <MonthInput value={ym} onChange={setYm} />
        <Button onClick={exportCsv} className="h-11 bg-accent text-accent-foreground hover:bg-accent/90">
          <Download /> CSV exportieren
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Lohn = Gesamtstunden (ohne abgelehnte Einträge) × Stundenlohn.</p>
      <div className="overflow-x-auto rounded-2xl bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-primary text-left text-primary-foreground">
            <tr>
              <th className="p-3">Mitarbeiter</th>
              <th className="p-3 text-right">Stunden</th>
              <th className="p-3 text-right">Freigegeben</th>
              <th className="p-3 text-right">Offen</th>
              <th className="p-3 text-right">€/h</th>
              <th className="p-3 text-right">Lohn</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.p.id} className="border-t">
                <td className="p-3 font-semibold">{r.p.full_name}</td>
                <td className="p-3 text-right">{fmtHours(r.hours)}</td>
                <td className="p-3 text-right">{fmtHours(r.approved)}</td>
                <td className="p-3 text-right">{r.open}</td>
                <td className="p-3 text-right">{eur(Number(r.p.hourly_wage))}</td>
                <td className="p-3 text-right font-bold">{eur(r.wage)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 font-bold">
              <td className="p-3" colSpan={5}>Summe</td>
              <td className="p-3 text-right text-accent-foreground"><span className="rounded bg-accent px-2 py-1">{eur(total)}</span></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function EmployeesTab() {
  const qc = useQueryClient();
  const { data: profiles = [] } = useProfiles();
  const [f, setF] = useState({ full_name: "", email: "", password: "", hourly_wage: "" });
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createEmployee({ data: { ...f, hourly_wage: Number(f.hourly_wage.replace(",", ".")) || 0 } });
      toast.success(`${f.full_name} angelegt. Zugangsdaten weitergeben.`);
      setF({ full_name: "", email: "", password: "", hourly_wage: "" });
      qc.invalidateQueries({ queryKey: ["profiles"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Anlegen");
    } finally {
      setBusy(false);
    }
  }

  async function updateWage(id: string, v: string) {
    const n = Number(v.replace(",", "."));
    if (Number.isNaN(n)) return;
    const { error } = await supabase.from("profiles").update({ hourly_wage: n }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Stundenlohn gespeichert");
    qc.invalidateQueries({ queryKey: ["profiles"] });
  }

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.4fr]">
      <form onSubmit={add} className="space-y-3 rounded-2xl bg-card p-4 shadow-sm">
        <h2 className="text-xl font-bold">Mitarbeiter anlegen</h2>
        <Field label="Name" value={f.full_name} onChange={(v) => setF({ ...f, full_name: v })} />
        <Field label="E-Mail" type="email" value={f.email} onChange={(v) => setF({ ...f, email: v })} />
        <Field label="Startpasswort (min. 8 Zeichen)" value={f.password} onChange={(v) => setF({ ...f, password: v })} />
        <Field label="Stundenlohn (€)" inputMode="decimal" value={f.hourly_wage} onChange={(v) => setF({ ...f, hourly_wage: v })} />
        <Button disabled={busy} className="h-12 w-full bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus /> {busy ? "Wird angelegt…" : "Anlegen"}
        </Button>
      </form>
      <div className="space-y-2">
        {profiles.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-sm">
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{p.full_name}</div>
              <div className="truncate text-xs text-muted-foreground">{p.email}</div>
            </div>
            <div className="flex items-center gap-1">
              <Input
                defaultValue={String(p.hourly_wage).replace(".", ",")}
                inputMode="decimal"
                className="h-11 w-24 text-right"
                onBlur={(e) => e.target.value !== String(p.hourly_wage).replace(".", ",") && updateWage(p.id, e.target.value)}
              />
              <span className="text-sm text-muted-foreground">€/h</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", inputMode }: { label: string; value: string; onChange: (v: string) => void; type?: string; inputMode?: "decimal" }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type={type} inputMode={inputMode} value={value} onChange={(e) => onChange(e.target.value)} className="h-12 text-base" required />
    </div>
  );
}

function SitesTab() {
  const qc = useQueryClient();
  const { data: sites = [] } = useSites();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("sites").insert({ name: name.trim(), address: address.trim() || null });
    if (error) { toast.error(error.message); return; }
    setName("");
    setAddress("");
    toast.success("Baustelle angelegt");
    qc.invalidateQueries({ queryKey: ["sites"] });
  }

  async function toggle(id: string, active: boolean) {
    const { error } = await supabase.from("sites").update({ active }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["sites"] });
  }

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.4fr]">
      <form onSubmit={add} className="space-y-3 rounded-2xl bg-card p-4 shadow-sm">
        <h2 className="text-xl font-bold">Baustelle anlegen</h2>
        <Field label="Name" value={name} onChange={setName} />
        <div className="space-y-1">
          <Label>Adresse (optional)</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} className="h-12 text-base" />
        </div>
        <Button className="h-12 w-full bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus /> Anlegen
        </Button>
      </form>
      <div className="space-y-2">
        {sites.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-sm">
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{s.name}</div>
              {s.address && <div className="text-xs text-muted-foreground">{s.address}</div>}
            </div>
            <Button variant={s.active ? "outline" : "default"} className="h-11" onClick={() => toggle(s.id, !s.active)}>
              {s.active ? "Abschließen" : "Reaktivieren"}
            </Button>
          </div>
        ))}
        {sites.length === 0 && <p className="py-8 text-center text-muted-foreground">Noch keine Baustellen.</p>}
      </div>
    </div>
  );
}
