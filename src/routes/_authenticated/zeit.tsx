import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, MapPin, Play, Square, Users, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { distanceMeters, entryHours, fmtDate, fmtDistance, fmtHours, fmtTime, startOfWeek, sumHours } from "@/lib/time";
import { enqueue, initOfflineSync, queueCount, syncQueue } from "@/lib/offline";
import { useTeamToday } from "@/lib/team";

type Gps = { lat: number; lng: number } | null;

/** Versucht den GPS-Standort zu ermitteln; blockiert das Stempeln nie. */
function getPosition(): Promise<Gps> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      toast.info("Ky pajisje nuk mbështet vendndodhjen – regjistrimi funksionon gjithsesi.");
      return resolve(null);
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          toast.warning("Qasja në vendndodhje është e çaktivizuar. Lejoje në shfletues – regjistrimi funksionon edhe pa GPS.");
        } else {
          toast.info("Vendndodhja nuk u gjet – regjistrimi funksionon gjithsesi.");
        }
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  });
}

export const Route = createFileRoute("/_authenticated/zeit")({
  head: () => ({
    meta: [
      { title: "Regjistrimi – ALB PROJEKT" },
      { name: "description", content: "Regjistro hyrjen/daljen, zgjidh kantierin dhe shkruaj punën e bërë." },
      { property: "og:title", content: "Regjistrimi – ALB PROJEKT" },
      { property: "og:description", content: "Regjistrimi i orëve të punës në kantier." },
    ],
  }),
  component: ZeitPage,
});

function ZeitPage() {
  const qc = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const [now, setNow] = useState(new Date());
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(queueCount());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const cleanupSync = initOfflineSync(() => {
      setPending(queueCount());
      qc.invalidateQueries({ queryKey: ["my-entries"] });
    });
    return () => {
      clearInterval(t);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      cleanupSync();
    };
  }, [qc]);

  const { data: sites = [] } = useQuery({
    queryKey: ["sites", "active"],
    queryFn: async () => (await supabase.from("sites").select("*").eq("active", true).order("name")).data ?? [],
  });

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = startOfWeek(now);
  const from = weekStart < monthStart ? weekStart : monthStart;

  const { data: team = [] } = useTeamToday();
  const { data: entries = [] } = useQuery({
    queryKey: ["my-entries", me?.id, from.toISOString()],
    enabled: !!me,
    queryFn: async () =>
      (
        await supabase
          .from("time_entries")
          .select("*, sites(name)")
          .eq("user_id", me!.id)
          .gte("clock_in", from.toISOString())
          .order("clock_in", { ascending: false })
      ).data ?? [],
  });

  const open = entries.find((e) => !e.clock_out);
  const [siteId, setSiteId] = useState<string>("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setSiteId(open.site_id ?? "");
      setDesc(open.description ?? "");
    }
  }, [open?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => qc.invalidateQueries({ queryKey: ["my-entries"] });

  function geofenceWarn(gps: Gps) {
    const site = sites.find((s) => s.id === siteId);
    if (!gps || !site || site.lat == null || site.lng == null) return;
    const d = distanceMeters(gps.lat, gps.lng, site.lat, site.lng);
    if (d > 200) {
      toast.warning(`Kujdes: je ${fmtDistance(d)} larg kantierit "${site.name}".`);
    }
  }

  async function clockIn() {
    if (!me) return;
    if (!siteId) { toast.error("Zgjidh së pari një kantier."); return; }
    setBusy(true);
    const gps = online ? await getPosition() : null;
    if (!online) {
      enqueue({ kind: "clock_in", user_id: me.id, site_id: siteId, description: desc || null, clock_in: new Date().toISOString(), lat: gps?.lat ?? null, lng: gps?.lng ?? null });
      setPending(queueCount());
      setBusy(false);
      toast.success("Pa internet – hyrja u ruajt në telefon dhe dërgohet automatikisht kur të kthehet lidhja.");
      return;
    }
    const { error } = await supabase.from("time_entries").insert({
      user_id: me.id,
      site_id: siteId,
      description: desc || null,
      clock_in_lat: gps?.lat ?? null,
      clock_in_lng: gps?.lng ?? null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("U regjistrua hyrja – punë të mbarë!");
    geofenceWarn(gps);
    refresh();
  }

  async function clockOut() {
    if (!open) return;
    setBusy(true);
    const gps = online ? await getPosition() : null;
    if (!online) {
      enqueue({ kind: "clock_out", entry_id: open.id, clock_out: new Date().toISOString(), site_id: siteId || null, description: desc || null, lat: gps?.lat ?? null, lng: gps?.lng ?? null });
      setPending(queueCount());
      setBusy(false);
      toast.success("Pa internet – dalja u ruajt në telefon dhe dërgohet automatikisht kur të kthehet lidhja.");
      return;
    }
    const { error } = await supabase
      .from("time_entries")
      .update({
        clock_out: new Date().toISOString(),
        site_id: siteId || null,
        description: desc || null,
        clock_out_lat: gps?.lat ?? null,
        clock_out_lng: gps?.lng ?? null,
      })
      .eq("id", open.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("U regjistrua dalja. Urofshë!");
    geofenceWarn(gps);
    refresh();
  }

  async function saveDetails() {
    if (!open) return;
    const { error } = await supabase.from("time_entries").update({ site_id: siteId || null, description: desc || null }).eq("id", open.id);
    if (error) { toast.error(error.message); return; }
    toast.success("U ruajt");
    refresh();
  }

  const weekHours = sumHours(entries.filter((e) => new Date(e.clock_in) >= weekStart), now);
  const monthHours = sumHours(entries.filter((e) => new Date(e.clock_in) >= monthStart), now);

  const days = useMemo(() => {
    const map = new Map<string, typeof entries>();
    for (const e of entries.filter((x) => new Date(x.clock_in) >= weekStart)) {
      const k = new Date(e.clock_in).toDateString();
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return [...map.entries()];
  }, [entries, weekStart.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-background pb-12">
      <AppHeader />
      <main className="mx-auto max-w-xl space-y-5 px-4 pt-5">
        {(!online || pending > 0) && (
          <div className="flex items-center gap-2 rounded-2xl bg-accent/15 px-4 py-3 text-sm font-semibold text-accent">
            <WifiOff className="h-4 w-4 shrink-0" />
            {!online
              ? "Nuk ke internet – regjistrimet ruhen në telefon dhe dërgohen automatikisht."
              : `${pending} regjistrime në pritje – dërgohen sapo të jetë e mundur.`}
          </div>
        )}
        <section className="rounded-3xl p-5 text-primary-foreground shadow-lg" style={{ background: "var(--gradient-hero)" }}>
          <div className="text-sm opacity-80">
            {now.toLocaleDateString("sq-AL", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <div className="mt-1 font-display text-5xl font-extrabold">
            {open ? fmtHours(entryHours(open, now)) : now.toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" })}
          </div>
          <div className="text-sm opacity-80">{open ? `Në punë që nga ${fmtTime(open.clock_in)}` : "Nuk je në punë"}</div>

          <div className="mt-5 space-y-3">
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger className="h-14 bg-card text-base text-card-foreground">
                <MapPin className="h-5 w-5 text-accent" />
                <SelectValue placeholder="Zgjidh kantierin" />
              </SelectTrigger>
              <SelectContent>
                {sites.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="py-3 text-base">
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              maxLength={500}
              placeholder="Çfarë u bë? (p.sh. kofrazh bodrumi, suvatim kati)"
              className="min-h-20 bg-card text-base text-card-foreground"
            />
            {open && (
              <button onClick={saveDetails} className="text-sm font-semibold text-accent underline">
                Ruaj kantierin & punën
              </button>
            )}
          </div>

          <Button
            onClick={open ? clockOut : clockIn}
            disabled={busy}
            className={
              "mt-5 h-24 w-full rounded-2xl text-2xl font-extrabold uppercase shadow-xl " +
              (open
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-accent text-accent-foreground hover:bg-accent/90")
            }
          >
            {open ? <Square className="h-8! w-8!" /> : <Play className="h-8! w-8!" />}
            {open ? "Mbaro punën" : "Fillo punën"}
          </Button>
        </section>

        {open && me && <EntryPhotos entryId={open.id} userId={me.id} />}

        {team.length > 0 && (
          <section className="rounded-2xl bg-card p-4 shadow-sm">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground">
              <Users className="h-4 w-4 text-accent" /> Sot në punë ({team.length})
            </h2>
            <div className="flex flex-wrap gap-2">
              {team.map((t) => (
                <span key={t.id} className="rounded-full bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground">
                  {t.profiles?.full_name} · {t.sites?.name ?? "—"} · nga {fmtTime(t.clock_in)}
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-card p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Kjo javë</div>
            <div className="font-display text-3xl font-bold">{fmtHours(weekHours)}</div>
          </div>
          <div className="rounded-2xl bg-card p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              {now.toLocaleDateString("sq-AL", { month: "long" })}
            </div>
            <div className="font-display text-3xl font-bold">{fmtHours(monthHours)}</div>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-bold">Kjo javë</h2>
          {days.length === 0 && <p className="text-sm text-muted-foreground">Ende asnjë regjistrim.</p>}
          <div className="space-y-3">
            {days.map(([k, list]) => (
              <div key={k} className="rounded-2xl bg-card p-4 shadow-sm">
                <div className="mb-2 flex justify-between font-semibold">
                  <span>{fmtDate(list[0]!.clock_in)}</span>
                  <span>{fmtHours(sumHours(list, now))}</span>
                </div>
                {list.map((e) => (
                  <div key={e.id} className="border-t py-2 text-sm first:border-t-0">
                    <div className="flex items-center justify-between gap-2">
                      <span>
                        {fmtTime(e.clock_in)} – {fmtTime(e.clock_out)} · {e.sites?.name ?? "—"}
                      </span>
                      <StatusBadge status={e.status} />
                    </div>
                    {e.description && <div className="text-muted-foreground">{e.description}</div>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

/** Fotot e kantierit për regjistrimin e hapur (para/pas punës). */
function EntryPhotos({ entryId, userId }: { entryId: string; userId: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const { data: photos = [] } = useQuery({
    queryKey: ["entry-photos", entryId],
    queryFn: async () => {
      const { data } = await supabase.from("entry_photos").select("*").eq("entry_id", entryId).order("created_at");
      return await Promise.all(
        (data ?? []).map(async (p) => {
          const { data: signed } = await supabase.storage.from("entry-photos").createSignedUrl(p.storage_path, 3600);
          return { ...p, url: signed?.signedUrl ?? "" };
        }),
      );
    },
  });

  async function upload(file: File) {
    setBusy(true);
    const path = `${userId}/${entryId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("entry-photos").upload(path, file, { contentType: file.type });
    if (upErr) { setBusy(false); toast.error(upErr.message); return; }
    const { error } = await supabase.from("entry_photos").insert({ entry_id: entryId, user_id: userId, storage_path: path });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Foto u ruajt");
    qc.invalidateQueries({ queryKey: ["entry-photos", entryId] });
  }

  return (
    <section className="rounded-2xl bg-card p-4 shadow-sm">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground">
        <Camera className="h-4 w-4 text-accent" /> Fotot e kantierit
      </h2>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
      <Button variant="outline" disabled={busy} className="h-12 w-full" onClick={() => fileRef.current?.click()}>
        <Camera /> {busy ? "Po ngarkohet…" : "Shto foto (para / pas punës)"}
      </Button>
      {photos.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer">
              <img src={p.url} alt="Foto e kantierit" className="aspect-square w-full rounded-xl object-cover" />
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
