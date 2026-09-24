import { Temporal } from "@js-temporal/polyfill";
import type { Recurrence, Occurrence } from "./types";
import { rangeDates, weekOf, todayIn } from "./time";
export function isEligible(rule: Recurrence, day: string): boolean {
  if (day < rule.startDate || (rule.endDate && day > rule.endDate))
    return false;
  const date = Temporal.PlainDate.from(day),
    anchor = Temporal.PlainDate.from(rule.startDate);
  if (rule.frequency === "daily")
    return (
      anchor.until(date, { largestUnit: "days" }).days % rule.interval === 0
    );
  if (rule.frequency === "weekly") {
    const weeks =
      Temporal.PlainDate.from(weekOf(rule.startDate)).until(
        Temporal.PlainDate.from(weekOf(day)),
        { largestUnit: "days" },
      ).days / 7;
    return weeks % rule.interval === 0 && rule.days.includes(date.dayOfWeek);
  }
  const months = (date.year - anchor.year) * 12 + date.month - anchor.month;
  // A 29th/30th/31st that does not exist is a rest period, not a shifted occurrence.
  return months % rule.interval === 0 && date.day === rule.monthDay;
}
export function expandRecurrence(rule: Recurrence, from: string, to: string) {
  return rangeDates(from, to).filter((d) => isEligible(rule, d));
}
export function occurrenceStreak(
  rows: (Pick<Occurrence, "localDate" | "status"> & { timezone?: string })[],
  today: string,
  now = new Date(),
) {
  const localToday = (row: { timezone?: string }) =>
    row.timezone ? todayIn(row.timezone, now) : today;
  const past = rows
    .filter((x) => x.localDate <= localToday(x))
    .sort((a, b) => b.localDate.localeCompare(a.localDate));
  let count = 0;
  for (const row of past) {
    if (row.status === "skipped") continue;
    if (row.status === "completed") {
      count++;
      continue;
    }
    if (row.localDate === localToday(row)) continue;
    break;
  }
  return count;
}
