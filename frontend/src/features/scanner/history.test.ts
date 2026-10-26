import { describe, expect, it } from "vitest";
import { dailyCounts, parseApiDate, type ScanSummary } from "./history";

const scan = (created_at: string): ScanSummary => ({
  scan_id: created_at, scan_type: "URL", risk_level: "LOW", risk_score: 5, category: null, target: "", created_at,
});

describe("scan history helpers", () => {
  it("treats naive API timestamps as UTC", () => {
    expect(parseApiDate("2026-10-26T10:00:00").toISOString()).toBe("2026-10-26T10:00:00.000Z");
    expect(parseApiDate("2026-10-26T10:00:00+05:30").toISOString()).toBe("2026-10-26T04:30:00.000Z");
    expect(parseApiDate("2026-10-26T10:00:00Z").toISOString()).toBe("2026-10-26T10:00:00.000Z");
  });

  it("counts scans per day for the last 7 days only", () => {
    const now = new Date();
    const iso = (d: Date) => d.toISOString().replace("Z", "");
    const old = new Date(now); old.setDate(old.getDate() - 30);
    const counts = dailyCounts([scan(iso(now)), scan(iso(now)), scan(iso(old))], 7, now);
    expect(counts).toHaveLength(7);
    expect(counts[6].value).toBe(2);
    expect(counts.reduce((a, c) => a + c.value, 0)).toBe(2);
  });
});
