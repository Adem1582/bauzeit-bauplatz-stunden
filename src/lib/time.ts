export type EntryLike = {
  clock_in: string;
  clock_out: string | null;
  status?: string;
};

/** Dauer eines Eintrags in Stunden (laufende Einträge bis `now`). */
export function entryHours(e: EntryLike, now: Date = new Date()): number {
  const start = new Date(e.clock_in).getTime();
  const end = e.clock_out ? new Date(e.clock_out).getTime() : now.getTime();
  return Math.max(0, (end - start) / 3_600_000);
}

export function sumHours(entries: EntryLike[], now: Date = new Date()): number {
  return entries.reduce((s, e) => s + entryHours(e, now), 0);
}

/** Lohn = Gesamtstunden (abgeschlossen, nicht abgelehnt) × Stundenlohn, auf Cent gerundet. */
export function calcWage(entries: EntryLike[], hourlyWage: number): { hours: number; wage: number } {
  const valid = entries.filter((e) => e.clock_out && e.status !== "abgelehnt");
  const hours = sumHours(valid);
  return { hours, wage: Math.round(hours * hourlyWage * 100) / 100 };
}

export function fmtHours(h: number): string {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${hh}:${String(mm).padStart(2, "0")} h`;
}

export const eur = (n: number) =>
  n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

export function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Montag = 0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

export function monthRange(ym: string): { from: Date; to: Date } {
  const [y = 2026, m = 1] = ym.split("-").map(Number);
  return { from: new Date(y, m - 1, 1), to: new Date(y, m, 1) };
}

export function currentYm(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function fmtTime(s: string | null) {
  return s ? new Date(s).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "läuft";
}
export function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
}

export type AbsenceLike = { start_date: string; end_date: string; type: string; status?: string };

/** Anzahl Tage einer Abwesenheit (beide Enden inklusive). */
export function absenceDays(a: AbsenceLike): number {
  const s = new Date(a.start_date + "T00:00:00").getTime();
  const e = new Date(a.end_date + "T00:00:00").getTime();
  return Math.max(0, Math.round((e - s) / 86_400_000) + 1);
}

/** Genehmigte Urlaubs-/Kranktage, die in den Monat [from, to) fallen. */
export function approvedAbsenceDaysInMonth(absences: AbsenceLike[], from: Date, to: Date): { urlaub: number; krank: number } {
  let urlaub = 0, krank = 0;
  for (const a of absences) {
    if (a.status !== "genehmigt" || a.type === "sonstiges") continue;
    const s = new Date(a.start_date + "T00:00:00"), e = new Date(a.end_date + "T00:00:00");
    for (let d = new Date(Math.max(s.getTime(), from.getTime())); d < to && d <= e; d.setDate(d.getDate() + 1)) {
      if (a.type === "urlaub") urlaub++; else krank++;
    }
  }
  return { urlaub, krank };
}

/** Distanz zwischen zwei GPS-Punkten in Metern (Haversine). */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function fmtDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

/** OpenStreetMap-Link zu einem GPS-Punkt. */
export function osmLink(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
}

export function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = typeof c === "number" ? c.toFixed(2).replace(".", ",") : c;
          return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(";"),
    )
    .join("\n");
}

export function downloadCsv(name: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
