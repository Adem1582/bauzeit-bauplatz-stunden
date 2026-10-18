import { describe, it, expect } from "vitest";
import { calcWage, entryHours } from "@/lib/time";

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
