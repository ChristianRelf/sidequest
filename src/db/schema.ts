import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  date,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { Preferences, Recurrence, PlanItem } from "../lib/types";
const id = () => uuid("id").primaryKey().defaultRandom();
const created = () =>
  timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow();
export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  timezone: text("timezone").notNull().default("UTC"),
  preferences: jsonb("preferences").$type<Preferences>().notNull(),
  createdAt: created(),
});
const owner = () =>
  uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });
export const authSessions = pgTable(
  "auth_sessions",
  {
    id: id(),
    userId: owner(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    createdAt: created(),
  },
  (t) => [index("auth_user_idx").on(t.userId)],
);
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: timestamp("reset_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
});
export const availability = pgTable(
  "availability",
  {
    id: id(),
    userId: owner(),
    day: integer("day").notNull(),
    start: text("start_time").notNull(),
    end: text("end_time").notNull(),
  },
  (t) => [
    index("availability_user_idx").on(t.userId),
    check("availability_day_check", sql`${t.day} between 1 and 7`),
  ],
);
export const commitments = pgTable("commitments", {
  id: id(),
  userId: owner(),
  title: text("title").notNull(),
  days: jsonb("days").$type<number[]>().notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
});
export const projects = pgTable("projects", {
  id: id(),
  userId: owner(),
  name: text("name").notNull(),
  color: text("color").notNull().default("lavender"),
});
export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    userId: owner(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    estimate: integer("estimate").notNull().default(30),
    dueDate: date("due_date"),
    priority: integer("priority").notNull().default(2),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    status: text("status")
      .$type<"inbox" | "active" | "done">()
      .notNull()
      .default("inbox"),
    createdAt: created(),
  },
  (t) => [
    index("tasks_user_status_idx").on(t.userId, t.status),
    check("task_duration_check", sql`${t.estimate} > 0`),
  ],
);
export const subtasks = pgTable("subtasks", {
  id: id(),
  userId: owner(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  done: boolean("done").notNull().default(false),
});
export const habits = pgTable(
  "habits",
  {
    id: id(),
    userId: owner(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    duration: integer("duration").notNull(),
    fallback: integer("fallback"),
    preferredStart: text("preferred_start").notNull(),
    preferredEnd: text("preferred_end").notNull(),
    recurrence: jsonb("recurrence").$type<Recurrence>().notNull(),
    color: text("color").notNull().default("lavender"),
    archived: boolean("archived").notNull().default(false),
    revision: integer("revision").notNull().default(1),
    createdAt: created(),
  },
  (t) => [
    index("habits_user_idx").on(t.userId),
    check("habit_duration_check", sql`${t.duration} > 0`),
  ],
);
export const occurrences = pgTable(
  "occurrences",
  {
    id: id(),
    userId: owner(),
    habitId: uuid("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    localDate: date("local_date").notNull(),
    timezone: text("timezone").notNull(),
    title: text("title").notNull(),
    duration: integer("duration").notNull(),
    fallback: integer("fallback"),
    ruleRevision: integer("rule_revision").notNull(),
    status: text("status")
      .$type<"pending" | "completed" | "skipped">()
      .notNull()
      .default("pending"),
    skipReason: text("skip_reason"),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (t) => [
    uniqueIndex("occurrence_habit_date_unique").on(t.habitId, t.localDate),
    index("occurrence_user_date_idx").on(t.userId, t.localDate),
  ],
);
export const sessions = pgTable(
  "scheduled_sessions",
  {
    id: id(),
    userId: owner(),
    occurrenceId: uuid("occurrence_id").references(() => occurrences.id, {
      onDelete: "cascade",
    }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    commitmentId: uuid("commitment_id").references(() => commitments.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    start: timestamp("start_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    end: timestamp("end_at", { withTimezone: true, mode: "string" }).notNull(),
    status: text("status")
      .$type<"scheduled" | "done" | "cancelled">()
      .notNull()
      .default("scheduled"),
    kind: text("kind").$type<"habit" | "task" | "fixed">().notNull(),
    color: text("color").notNull().default("lavender"),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (t) => [
    index("session_user_start_idx").on(t.userId, t.start),
    uniqueIndex("session_commitment_start_unique").on(t.commitmentId, t.start),
    check("session_positive_range", sql`${t.end} > ${t.start}`),
    check(
      "session_target_check",
      sql`(${t.kind} = 'habit' and ${t.occurrenceId} is not null and ${t.taskId} is null and ${t.commitmentId} is null) or (${t.kind} = 'task' and ${t.taskId} is not null and ${t.occurrenceId} is null and ${t.commitmentId} is null) or (${t.kind} = 'fixed' and ${t.commitmentId} is not null and ${t.occurrenceId} is null and ${t.taskId} is null)`,
    ),
  ],
);
export const completions = pgTable(
  "completion_events",
  {
    id: id(),
    userId: owner(),
    sourceKey: text("source_key").notNull(),
    kind: text("kind").notNull(),
    minutes: integer("minutes").notNull(),
    localDate: date("local_date").notNull(),
    timezone: text("timezone").notNull(),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("completion_source_unique").on(t.userId, t.sourceKey),
    index("completion_user_date_idx").on(t.userId, t.localDate),
  ],
);
export const xpLedger = pgTable("xp_ledger", {
  id: id(),
  userId: owner(),
  completionId: uuid("completion_id")
    .notNull()
    .references(() => completions.id, { onDelete: "cascade" })
    .unique(),
  amount: integer("amount").notNull(),
  createdAt: created(),
});
export const achievements = pgTable(
  "achievements",
  {
    id: id(),
    userId: owner(),
    key: text("key").notNull(),
    createdAt: created(),
  },
  (t) => [uniqueIndex("achievement_user_key_unique").on(t.userId, t.key)],
);
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: owner(),
    dedupeKey: text("dedupe_key").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    read: boolean("read").notNull().default(false),
    emailSent: boolean("email_sent").notNull().default(false),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("notification_user_key_unique").on(t.userId, t.dedupeKey),
    index("notification_user_created_idx").on(t.userId, t.createdAt),
  ],
);
export const proposals = pgTable("planning_proposals", {
  id: id(),
  userId: owner(),
  items: jsonb("items").$type<PlanItem[]>().notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: created(),
});
