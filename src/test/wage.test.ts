import { describe, it, expect } from "vitest";
import { approvedAbsenceDaysInMonth, absenceDays, calcWage, distanceMeters, entryHours } from "@/lib/time";

describe("Lohnberechnung", () => {
  it("Stunden werden aus Ein-/Ausstempeln berechnet", () => {
    expect(entryHours({ clock_in: "2026-10-01T07:00:00Z", clock_out: "2026-10-01T15:30:00Z" })).toBe(8.5);
  });
  it("Lohn = Gesamtstunden × Stundenlohn, abgelehnte zählen nicht", () => {
    const r = calcWage(
      [
        { clock_in: "2026-10-01T07:00:00Z", clock_out: "2026-10-01T15:00:00Z", status: "freigegeben" },
        { clock_in: "2026-10-02T07:00:00Z", clock_out: "2026-10-02T09:00:00Z", status: "offen" },
        { clock_in: "2026-10-03T07:00:00Z", clock_out: "2026-10-03T17:00:00Z", status: "abgelehnt" },
      ],
      20,
    );
    expect(r.hours).toBe(10);
    expect(r.wage).toBe(200);
  });
});

describe("Abwesenheiten", () => {
  it("Tage werden inklusive Start- und Enddatum gezählt", () => {
    expect(absenceDays({ start_date: "2026-10-05", end_date: "2026-10-09", type: "urlaub" })).toBe(5);
    expect(absenceDays({ start_date: "2026-10-05", end_date: "2026-10-05", type: "krank" })).toBe(1);
  });
  it("nur genehmigte Urlaubs-/Kranktage im Monat zählen, Monatsgrenzen werden beschnitten", () => {
    const from = new Date(2026, 9, 1), to = new Date(2026, 10, 1);
    const r = approvedAbsenceDaysInMonth(
      [
        { start_date: "2026-09-28", end_date: "2026-10-02", type: "urlaub", status: "genehmigt" },
        { start_date: "2026-10-10", end_date: "2026-10-11", type: "krank", status: "genehmigt" },
        { start_date: "2026-10-12", end_date: "2026-10-14", type: "urlaub", status: "offen" },
        { start_date: "2026-10-15", end_date: "2026-10-16", type: "urlaub", status: "abgelehnt" },
        { start_date: "2026-10-20", end_date: "2026-10-21", type: "sonstiges", status: "genehmigt" },
      ],
      from, to,
    );
    expect(r.urlaub).toBe(2);
    expect(r.krank).toBe(2);
  });
});

describe("GPS-Distanz", () => {
  it("gleicher Punkt = 0 m", () => {
    expect(distanceMeters(52.52, 13.405, 52.52, 13.405)).toBe(0);
  });
  it("bekannte Distanz Berlin–München ca. 504 km", () => {
    const d = distanceMeters(52.52, 13.405, 48.137, 11.575);
    expect(d).toBeGreaterThan(490_000);
    expect(d).toBeLessThan(520_000);
  });
});
