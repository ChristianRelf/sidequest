import { Temporal } from "@js-temporal/polyfill";
export const todayIn = (zone: string, now = new Date()) =>
  Temporal.Instant.from(now.toISOString())
    .toZonedDateTimeISO(zone)
    .toPlainDate()
    .toString();
export const addDays = (day: string, days: number) =>
  Temporal.PlainDate.from(day).add({ days }).toString();
export const weekday = (day: string) => Temporal.PlainDate.from(day).dayOfWeek;
export function weekOf(day: string, start: 1 | 7 = 1) {
  return addDays(day, -((weekday(day) - start + 7) % 7));
}
// Compatible: missing wall time moves forward by the DST gap; ambiguous wall time chooses earlier offset.
export function localToUtc(day: string, time: string, zone: string) {
  return Temporal.PlainDateTime.from(`${day}T${time}`)
    .toZonedDateTime(zone, { disambiguation: "compatible" })
    .toInstant()
    .toString();
}
export const instantToLocal = (iso: string, zone: string) =>
  Temporal.Instant.from(new Date(iso).toISOString()).toZonedDateTimeISO(zone);
export const dateIn = (iso: string, zone: string) =>
  instantToLocal(iso, zone).toPlainDate().toString();
export const timeIn = (iso: string, zone: string) =>
  instantToLocal(iso, zone).toPlainTime().toString({ smallestUnit: "minute" });
export const minutesOf = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
export const clockTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
export const plusMinutes = (iso: string, n: number) =>
  new Date(new Date(iso).getTime() + n * 60000).toISOString();
export const durationMinutes = (start: string, end: string) =>
  Math.round((+new Date(end) - +new Date(start)) / 60000);
export const overlaps = (
  a: { start: string; end: string },
  b: { start: string; end: string },
  gap = 0,
) =>
  +new Date(a.start) < +new Date(b.end) + gap * 60000 &&
  +new Date(a.end) + gap * 60000 > +new Date(b.start);
export function rangeDates(from: string, to: string) {
  const dates: string[] = [];
  for (let d = from; d <= to && dates.length < 370; d = addDays(d, 1))
    dates.push(d);
  return dates;
}
export function prettyDate(
  day: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
  },
) {
  return new Intl.DateTimeFormat("en-GB", {
    ...options,
    timeZone: "UTC",
  }).format(new Date(day + "T12:00:00Z"));
}
export function formatTime(iso: string, zone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: zone,
  }).format(new Date(iso));
}
