import type { Availability, PlanItem } from "./types";
import {
  clockTime,
  dateIn,
  durationMinutes,
  localToUtc,
  minutesOf,
  overlaps,
  plusMinutes,
  rangeDates,
  weekday,
} from "./time";
export type PlanningCandidate = {
  key: string;
  title: string;
  duration: number;
  occurrenceId?: string;
  taskId?: string;
  date?: string;
  deadline?: string | null;
  priority: number;
  preferredStart?: string;
  preferredEnd?: string;
};
export function proposePlan(input: {
  candidates: PlanningCandidate[];
  availability: Availability[];
  occupied: {
    id?: string;
    title: string;
    start: string;
    end: string;
    kind?: string;
  }[];
  from: string;
  to: string;
  zone: string;
  breakMinutes: number;
  dailyLimit: number;
  now: string;
}): PlanItem[] {
  const busy = [...input.occupied];
  const results: PlanItem[] = [];
  const candidates = [...input.candidates].sort(
    (a, b) =>
      (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999") ||
      a.priority - b.priority ||
      a.key.localeCompare(b.key),
  );
  for (const item of candidates) {
    const slots: {
      start: string;
      end: string;
      score: number;
      preferred: boolean;
    }[] = [];
    for (const day of rangeDates(input.from, input.to)) {
      if (
        (item.date && day !== item.date) ||
        (item.deadline && day > item.deadline)
      )
        continue;
      const load = busy
        .filter(
          (x) => x.kind !== "fixed" && dateIn(x.start, input.zone) === day,
        )
        .reduce((n, x) => n + durationMinutes(x.start, x.end), 0);
      if (input.dailyLimit && load + item.duration > input.dailyLimit) continue;
      for (const window of input.availability.filter(
        (x) => x.day === weekday(day),
      )) {
        for (
          let minute = Math.ceil(minutesOf(window.start) / 15) * 15;
          minute + item.duration <= minutesOf(window.end);
          minute += 15
        ) {
          const start = localToUtc(day, clockTime(minute), input.zone),
            end = plusMinutes(start, item.duration);
          if (
            +new Date(start) < +new Date(input.now) ||
            +new Date(end) > +new Date(localToUtc(day, window.end, input.zone))
          )
            continue;
          if (busy.some((b) => overlaps({ start, end }, b, input.breakMinutes)))
            continue;
          const preferred =
            !!item.preferredStart &&
            minute >= minutesOf(item.preferredStart) &&
            minute + item.duration <= minutesOf(item.preferredEnd ?? "23:59");
          slots.push({
            start,
            end,
            preferred,
            score:
              +new Date(start) + (preferred ? -86400000 : 0) + load * 60000,
          });
        }
      }
    }
    slots.sort((a, b) => a.score - b.score);
    const chosen = slots[0];
    const result: PlanItem = {
      key: item.key,
      title: item.title,
      occurrenceId: item.occurrenceId,
      taskId: item.taskId,
      duration: item.duration,
      conflicts: [],
      explanation: "",
    };
    if (chosen) {
      Object.assign(result, {
        start: chosen.start,
        end: chosen.end,
        explanation: `${chosen.preferred ? "Inside your preferred window." : "Earliest balanced opening in your availability."} ${item.duration} minutes, with ${input.breakMinutes}-minute breaks protected.${item.deadline ? " Before the due date." : ""}`,
      });
      busy.push({
        title: item.title,
        start: chosen.start,
        end: chosen.end,
        kind: "flexible",
      });
    } else
      result.explanation =
        "No opening fits the duration, availability, deadline, daily limit and breaks. Try a shorter version or widen availability; nothing has been moved.";
    results.push(result);
  }
  return results;
}
