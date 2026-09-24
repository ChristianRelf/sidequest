import { z } from "zod";
import { Temporal } from "@js-temporal/polyfill";
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((x) => {
    try {
      Temporal.PlainDate.from(x);
      return true;
    } catch {
      return false;
    }
  }, "Use a valid date");
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const zoneSchema = z
  .string()
  .max(100)
  .refine((x) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: x });
      return true;
    } catch {
      return false;
    }
  }, "Use an IANA timezone");
export const titleSchema = z.string().trim().min(1).max(160);
export const recurrenceSchema = z
  .object({
    frequency: z.enum(["daily", "weekly", "monthly"]),
    interval: z.number().int().min(1).max(52),
    days: z.array(z.number().int().min(1).max(7)).min(1).max(7),
    monthDay: z.number().int().min(1).max(31),
    startDate: dateSchema,
    endDate: dateSchema.optional(),
  })
  .refine(
    (r) => !r.endDate || r.endDate >= r.startDate,
    "End date must follow start date",
  );
export const habitSchema = z
  .object({
    title: titleSchema,
    description: z.string().max(2000).default(""),
    duration: z.number().int().min(5).max(480),
    fallback: z.number().int().min(5).max(480).nullable().default(null),
    preferredStart: timeSchema,
    preferredEnd: timeSchema,
    recurrence: recurrenceSchema,
    color: z
      .enum(["lavender", "mint", "coral", "amber", "blue"])
      .default("lavender"),
    archived: z.boolean().optional(),
  })
  .refine(
    (x) => x.preferredEnd > x.preferredStart,
    "Preferred window must end after it starts",
  )
  .refine(
    (x) => !x.fallback || x.fallback <= x.duration,
    "Shorter version cannot exceed usual duration",
  );
export const taskSchema = z.object({
  title: titleSchema,
  description: z.string().max(4000).default(""),
  estimate: z.number().int().min(5).max(4800).default(30),
  dueDate: dateSchema.nullable().default(null),
  priority: z.number().int().min(1).max(3).default(2),
  projectId: z.string().uuid().nullable().default(null),
  status: z.enum(["inbox", "active"]).optional(),
});
export const sessionSchema = z
  .object({
    occurrenceId: z.string().uuid().optional(),
    taskId: z.string().uuid().optional(),
    start: z.string().datetime({ offset: true }),
    end: z.string().datetime({ offset: true }),
    allowConflict: z.boolean().default(false),
  })
  .refine(
    (x) => !!x.taskId !== !!x.occurrenceId,
    "Choose one occurrence or task",
  )
  .refine(
    (x) =>
      new Date(x.end) > new Date(x.start) &&
      +new Date(x.end) - +new Date(x.start) <= 24 * 3600000,
    "Session must last between 1 minute and 24 hours",
  );
export const preferencesSchema = z
  .object({
    theme: z.enum(["light", "dark", "system"]),
    weekStart: z.union([z.literal(1), z.literal(7)]),
    companions: z.boolean(),
    reducedMotion: z.boolean(),
    gamification: z.boolean(),
    xp: z.boolean(),
    streaks: z.boolean(),
    humour: z.boolean(),
    achievements: z.boolean(),
    breakMinutes: z.number().int().min(0).max(120),
    dailyLimit: z.number().int().min(0).max(1440),
    reminderMinutes: z.number().int().min(0).max(120),
    reminders: z.boolean(),
    emailReminders: z.boolean(),
    aiEnabled: z.boolean(),
    onboardingDone: z.boolean(),
    xpHabit: z.number().int().min(0).max(100),
    xpTask: z.number().int().min(0).max(100),
  })
  .partial();
export const settingsSchema = z.object({
  name: titleSchema.optional(),
  timezone: zoneSchema.optional(),
  preferences: preferencesSchema.optional(),
  availability: z
    .array(
      z
        .object({
          day: z.number().int().min(1).max(7),
          start: timeSchema,
          end: timeSchema,
        })
        .refine(
          (x) => x.end > x.start,
          "Availability must end after it starts",
        ),
    )
    .max(28)
    .optional(),
});
