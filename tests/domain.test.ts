import { describe, it, expect } from "vitest";
import { expandRecurrence, occurrenceStreak } from "../src/lib/recurrence";
import {
  dateIn,
  durationMinutes,
  localToUtc,
  overlaps,
  plusMinutes,
} from "../src/lib/time";
import { proposePlan } from "../src/lib/planner";
import type { Recurrence } from "../src/lib/types";
const rule: Recurrence = {
  frequency: "weekly",
  interval: 1,
  days: [1, 3, 5],
  monthDay: 1,
  startDate: "2024-01-01",
};
describe("eligible occurrences, not arbitrary dates", () => {
  it("expands across month boundaries", () =>
    expect(expandRecurrence(rule, "2024-01-29", "2024-02-04")).toEqual([
      "2024-01-29",
      "2024-01-31",
      "2024-02-02",
    ]));
  it("keeps leap day and skips impossible monthly dates", () => {
    expect(
      expandRecurrence(
        { ...rule, frequency: "monthly", monthDay: 29 },
        "2024-02-01",
        "2024-03-31",
      ),
    ).toEqual(["2024-02-29", "2024-03-29"]);
    expect(
      expandRecurrence(
        { ...rule, frequency: "monthly", monthDay: 31 },
        "2024-01-01",
        "2024-04-30",
      ),
    ).toEqual(["2024-01-31", "2024-03-31"]);
    expect(
      expandRecurrence(
        { ...rule, frequency: "monthly", monthDay: 29 },
        "2025-02-01",
        "2025-03-31",
      ),
    ).toEqual(["2025-03-29"]);
  });
  it("anchors weekly intervals and observes end dates", () =>
    expect(
      expandRecurrence(
        { ...rule, interval: 2, endDate: "2024-01-17" },
        "2024-01-01",
        "2024-02-01",
      ),
    ).toEqual([
      "2024-01-01",
      "2024-01-03",
      "2024-01-05",
      "2024-01-15",
      "2024-01-17",
    ]));
  it("neutral skips and rest days; past unresolved breaks streak", () => {
    const rows = [
      { localDate: "2024-01-05", status: "completed" as const },
      { localDate: "2024-01-08", status: "skipped" as const },
      { localDate: "2024-01-10", status: "completed" as const },
      { localDate: "2024-01-12", status: "pending" as const },
    ];
    expect(occurrenceStreak(rows, "2024-01-12")).toBe(2);
    expect(occurrenceStreak(rows, "2024-01-13")).toBe(0);
  });
});
describe("UTC storage and explicit DST disambiguation", () => {
  it("moves nonexistent spring wall times forward by the gap", () =>
    expect(localToUtc("2024-03-10", "02:30", "America/New_York")).toBe(
      "2024-03-10T07:30:00Z",
    ));
  it("uses earlier fall overlap", () =>
    expect(localToUtc("2024-11-03", "01:30", "America/New_York")).toBe(
      "2024-11-03T05:30:00Z",
    ));
  it("preserves local recurrence across 23 and 25 hour days", () => {
    const a = localToUtc("2024-03-30", "09:00", "Europe/London"),
      b = localToUtc("2024-03-31", "09:00", "Europe/London");
    expect(durationMinutes(a, b)).toBe(23 * 60);
    expect(dateIn(b, "Europe/London")).toBe("2024-03-31");
    expect(
      durationMinutes(
        localToUtc("2024-10-26", "09:00", "Europe/London"),
        localToUtc("2024-10-27", "09:00", "Europe/London"),
      ),
    ).toBe(25 * 60);
  });
  it("detects overlaps and protects adjacent breaks", () => {
    const a = { start: "2024-01-01T10:00:00Z", end: "2024-01-01T11:00:00Z" },
      b = { start: "2024-01-01T11:00:00Z", end: "2024-01-01T12:00:00Z" };
    expect(overlaps(a, b)).toBe(false);
    expect(overlaps(a, b, 10)).toBe(true);
  });
});
describe("deterministic planning", () => {
  const base = {
    availability: [{ day: 1, start: "09:00", end: "12:00" }],
    occupied: [],
    from: "2024-01-01",
    to: "2024-01-01",
    zone: "UTC",
    breakMinutes: 15,
    dailyLimit: 180,
    now: "2024-01-01T08:00:00Z",
  };
  it("uses priorities, preferences, breaks and deterministic tie breaking", () => {
    const candidates = [
      { key: "b", title: "B", duration: 30, priority: 2 },
      {
        key: "a",
        title: "A",
        duration: 30,
        priority: 1,
        preferredStart: "10:00",
        preferredEnd: "11:00",
      },
    ];
    const plan = proposePlan({ ...base, candidates });
    expect(plan[0].key).toBe("a");
    expect(plan[0].start).toBe("2024-01-01T10:00:00Z");
    expect(
      overlaps(
        { start: plan[0].start!, end: plan[0].end! },
        { start: plan[1].start!, end: plan[1].end! },
        15,
      ),
    ).toBe(false);
    expect(proposePlan({ ...base, candidates })).toEqual(plan);
  });
  it("explains impossible work without inventing a slot", () => {
    const plan = proposePlan({
      ...base,
      candidates: [{ key: "a", title: "Too big", duration: 240, priority: 1 }],
    });
    expect(plan[0].start).toBeUndefined();
    expect(plan[0].explanation).toContain("No opening fits");
  });
  it("respects fixed commitments, deadlines and workload caps", () => {
    const plan = proposePlan({
      ...base,
      dailyLimit: 30,
      occupied: [
        {
          title: "Fixed",
          kind: "fixed",
          start: "2024-01-01T09:00:00Z",
          end: "2024-01-01T10:00:00Z",
        },
      ],
      candidates: [
        { key: "a", title: "A", duration: 30, priority: 1 },
        { key: "b", title: "B", duration: 30, priority: 2 },
        {
          key: "c",
          title: "Expired",
          duration: 15,
          priority: 1,
          deadline: "2023-12-31",
        },
      ],
    });
    expect(plan.find((p) => p.key === "a")?.start).toBe("2024-01-01T10:15:00Z");
    expect(plan.find((p) => p.key === "b")?.start).toBeUndefined();
    expect(plan.find((p) => p.key === "c")?.start).toBeUndefined();
  });
});
