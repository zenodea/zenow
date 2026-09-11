import { describe, expect, it } from "vitest";
import { weekOf } from "./week.js";

const iso = (date: Date) => date.toISOString().slice(0, 10);

describe("weekOf", () => {
  it("runs Monday to Monday whichever day you ask on", () => {
    const monday = weekOf(new Date("2026-09-07T09:00:00Z"));
    const sunday = weekOf(new Date("2026-09-13T23:59:59Z"));

    expect(iso(monday.from)).toBe("2026-09-07");
    expect(iso(monday.to)).toBe("2026-09-14");
    expect(sunday.key).toBe(monday.key);
  });

  it("steps back whole weeks", () => {
    const last = weekOf(new Date("2026-09-09T12:00:00Z"), -1);
    expect(iso(last.from)).toBe("2026-08-31");
    expect(iso(last.to)).toBe("2026-09-07");
  });

  it("numbers weeks the way ISO does", () => {
    expect(weekOf(new Date("2026-01-01T00:00:00Z")).key).toBe("2026-W01");
    expect(weekOf(new Date("2026-09-09T00:00:00Z")).key).toBe("2026-W37");
    // 2027-01-01 is a Friday, so its week belongs to 2026.
    expect(weekOf(new Date("2027-01-01T00:00:00Z")).key).toBe("2026-W53");
    // 2025-12-29 is a Monday whose Thursday lands in 2026.
    expect(weekOf(new Date("2025-12-29T00:00:00Z")).key).toBe("2026-W01");
  });

  it("gives a week that contains the day it was asked about", () => {
    for (const day of ["2026-02-28", "2026-03-01", "2024-02-29", "2026-12-31"]) {
      const at = new Date(`${day}T12:00:00Z`);
      const week = weekOf(at);
      expect(week.from.getTime()).toBeLessThanOrEqual(at.getTime());
      expect(week.to.getTime()).toBeGreaterThan(at.getTime());
    }
  });
});
