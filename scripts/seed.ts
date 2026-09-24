import "dotenv/config";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { and, eq } from "drizzle-orm";
import { getDb, closeDb } from "../src/db";
import * as s from "../src/db/schema";
import { hashPassword } from "../src/server/auth";
import { materialize, complete } from "../src/server/service";
import {
  addDays,
  localToUtc,
  plusMinutes,
  todayIn,
  weekOf,
  weekday,
} from "../src/lib/time";
import { defaultPreferences } from "../src/lib/types";
async function main() {
  if (
    process.env.NODE_ENV === "production" &&
    (!process.env.DEMO_EMAIL || !process.env.DEMO_PASSWORD)
  )
    throw new Error(
      "Production seeding requires explicit DEMO_EMAIL and DEMO_PASSWORD.",
    );
  const email = process.env.DEMO_EMAIL ?? "alex@sidequest.local",
    password =
      process.env.DEMO_PASSWORD ?? randomBytes(18).toString("base64url");
  const db = getDb();
  const [exists] = await db
    .select()
    .from(s.users)
    .where(eq(s.users.email, email));
  if (exists) {
    console.log("Demo account already exists; no records changed.");
    await closeDb();
    return;
  }
  const timezone = "Europe/London",
    today = todayIn(timezone),
    monday = weekOf(today),
    past = addDays(today, -21);
  const [user] = await db
    .insert(s.users)
    .values({
      email,
      name: "Alex",
      passwordHash: await hashPassword(password),
      timezone,
      preferences: { ...defaultPreferences, onboardingDone: true },
    })
    .returning();
  await db
    .insert(s.availability)
    .values(
      [1, 2, 3, 4, 5, 6, 7].map((day) => ({
        userId: user.id,
        day,
        start: "07:00",
        end: "21:00",
      })),
    );
  const projects = await db
    .insert(s.projects)
    .values([
      { userId: user.id, name: "Personal", color: "lavender" },
      { userId: user.id, name: "Little studio", color: "blue" },
    ])
    .returning();
  const definitions = [
    {
      title: "A little morning movement",
      duration: 30,
      fallback: 10,
      color: "mint",
      preferredStart: "07:00",
      preferredEnd: "09:00",
      description: "A walk, a stretch, a chance to wake up.",
    },
    {
      title: "Read a few pages",
      duration: 30,
      fallback: 10,
      color: "lavender",
      preferredStart: "10:00",
      preferredEnd: "12:00",
      description: "A good book and a little space to think.",
    },
    {
      title: "Make something, just for fun",
      duration: 60,
      fallback: 15,
      color: "amber",
      preferredStart: "15:00",
      preferredEnd: "18:00",
      description: "Sketch, tinker, follow a little curiosity.",
    },
    {
      title: "An evening reset",
      duration: 30,
      fallback: 5,
      color: "coral",
      preferredStart: "19:00",
      preferredEnd: "21:00",
      description: "Tidy the day away. Make tomorrow a little easier.",
    },
  ];
  const habits = await db
    .insert(s.habits)
    .values(
      definitions.map((h) => ({
        ...h,
        userId: user.id,
        recurrence: {
          frequency: "weekly" as const,
          interval: 1,
          days: [1, 2, 3, 4, 5, 6, 7],
          monthDay: 1,
          startDate: past,
        },
      })),
    )
    .returning();
  const tasks = await db
    .insert(s.tasks)
    .values([
      {
        userId: user.id,
        title: "Give the portfolio a little love",
        estimate: 90,
        dueDate: addDays(today, 3),
        priority: 1,
        projectId: projects[1].id,
        description: "Update the about page and pick three favourite projects.",
      },
      {
        userId: user.id,
        title: "Book that dentist appointment",
        estimate: 15,
        projectId: projects[0].id,
      },
      {
        userId: user.id,
        title: "Plan the weekend wander",
        estimate: 30,
        projectId: projects[0].id,
      },
      {
        userId: user.id,
        title: "Send the project proposal",
        estimate: 45,
        dueDate: addDays(today, 2),
        projectId: projects[1].id,
      },
      {
        userId: user.id,
        title: "Sort out the photo folder",
        estimate: 45,
        projectId: projects[0].id,
      },
    ])
    .returning();
  await db.insert(s.subtasks).values([
    {
      userId: user.id,
      taskId: tasks[0].id,
      title: "Choose three projects",
      done: true,
    },
    { userId: user.id, taskId: tasks[0].id, title: "Refresh the about page" },
    { userId: user.id, taskId: tasks[0].id, title: "Check mobile layouts" },
  ]);
  await db
    .insert(s.commitments)
    .values({
      userId: user.id,
      title: "Lunch & a proper break",
      days: [1, 2, 3, 4, 5],
      startTime: "12:30",
      endTime: "13:30",
    });
  await materialize(user, past, addDays(today, 35));
  const occurrences = await db
    .select()
    .from(s.occurrences)
    .where(eq(s.occurrences.userId, user.id));
  for (let offset = -7; offset <= 6; offset++) {
    const day = addDays(today, offset);
    for (let i = 0; i < habits.length; i++) {
      if ((offset + i) % 4 === 0 && offset !== 0) continue;
      const habit = habits[i],
        o = occurrences.find(
          (x) => x.habitId === habit.id && x.localDate === day,
        )!;
      const time = ["08:00", "10:00", "16:00", "19:30"][i];
      const start = localToUtc(day, time, timezone);
      const completed =
        (offset < 0 && !(offset === -1 && i === 3)) ||
        (offset === 0 && i === 0);
      await db
        .insert(s.sessions)
        .values({
          userId: user.id,
          occurrenceId: o.id,
          title: habit.title,
          start,
          end: plusMinutes(start, habit.duration),
          kind: "habit",
          color: habit.color,
          status: completed ? "done" : "scheduled",
          completedAt: completed ? plusMinutes(start, habit.duration) : null,
        });
      if (completed) {
        await db
          .update(s.occurrences)
          .set({
            status: "completed",
            completedAt: plusMinutes(start, habit.duration),
          })
          .where(eq(s.occurrences.id, o.id));
        const [event] = await db
          .insert(s.completions)
          .values({
            userId: user.id,
            sourceKey: "occurrence:" + o.id,
            kind: "occurrence",
            minutes: habit.duration,
            localDate: day,
            timezone,
            createdAt: plusMinutes(start, habit.duration),
          })
          .returning();
        await db
          .insert(s.xpLedger)
          .values({
            userId: user.id,
            completionId: event.id,
            amount: 20,
            createdAt: plusMinutes(start, habit.duration),
          });
      }
    }
  }
  for (const [i, offset, time, length] of [
    [0, 0, "14:00", 60],
    [0, 2, "11:00", 30],
    [3, 1, "09:30", 45],
  ] as const) {
    const start = localToUtc(addDays(today, offset), time, timezone);
    await db
      .insert(s.sessions)
      .values({
        userId: user.id,
        taskId: tasks[i].id,
        title: tasks[i].title,
        start,
        end: plusMinutes(start, length),
        kind: "task",
        color: "blue",
      });
  }
  // Older demo occurrences were explicit rest days; no synthetic broken streak wall.
  for (const o of occurrences.filter((o) => o.localDate < addDays(today, -7)))
    await db
      .update(s.occurrences)
      .set({ status: "skipped", skipReason: "Demo rest day" })
      .where(eq(s.occurrences.id, o.id));
  await db
    .insert(s.achievements)
    .values({ userId: user.id, key: "first-step" }).onConflictDoNothing();
  await mkdir(".local", { recursive: true });
  await writeFile(
    ".local/demo-credentials.json",
    JSON.stringify({ email, password }, null, 2),
  );
  console.log(
    "Demo account created. Credentials saved to .local/demo-credentials.json (gitignored).",
  );
  await closeDb();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
