import "dotenv/config";
import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb, closeDb } from "../src/db";
import * as s from "../src/db/schema";
import {
  complete,
  createSession,
  materialize,
  generatePlan,
  acceptProposal,
  recover,
  getState,
} from "../src/server/service";
import { hashPassword, verifyPassword, rateLimit } from "../src/server/auth";
import { defaultPreferences } from "../src/lib/types";
import { addDays, localToUtc, plusMinutes, todayIn } from "../src/lib/time";
import { workerTick } from "../src/server/reminders";
import { aiDraft } from "../src/server/ai";
import { exportData, importData } from "../src/server/portable";
let owner: typeof s.users.$inferSelect,
  other: typeof s.users.$inferSelect,
  habit: typeof s.habits.$inferSelect,
  occurrence: typeof s.occurrences.$inferSelect,
  task: typeof s.tasks.$inferSelect;
const db = getDb(),
  today = todayIn("Europe/London"),
  future = addDays(today, 2),
  stamp = randomUUID();
beforeAll(async () => {
  [owner, other] = await db
    .insert(s.users)
    .values(
      ["owner", "other"].map((name) => ({
        email: `${name}-${stamp}@test.invalid`,
        name,
        passwordHash: "not-login-capable",
        timezone: "Europe/London",
        preferences: { ...defaultPreferences, onboardingDone: true },
      })),
    )
    .returning();
  await db
    .insert(s.availability)
    .values(
      [1, 2, 3, 4, 5, 6, 7].map((day) => ({
        userId: owner.id,
        day,
        start: "08:00",
        end: "20:00",
      })),
    );
  [habit] = await db
    .insert(s.habits)
    .values({
      userId: owner.id,
      title: "Persistence test habit",
      duration: 30,
      fallback: 10,
      preferredStart: "09:00",
      preferredEnd: "12:00",
      recurrence: {
        frequency: "daily",
        interval: 1,
        days: [1, 2, 3, 4, 5, 6, 7],
        monthDay: 1,
        startDate: today,
      },
    })
    .returning();
  [task] = await db
    .insert(s.tasks)
    .values({ userId: owner.id, title: "Multi-session task", estimate: 90 })
    .returning();
});
afterAll(async () => {
  if (owner) await db.delete(s.users).where(eq(s.users.id, owner.id));
  if (other) await db.delete(s.users).where(eq(s.users.id, other.id));
  await closeDb();
});
describe("real PostgreSQL transactions", () => {
  it("materialization is safe to retry concurrently", async () => {
    await Promise.all([
      materialize(owner, today, future),
      materialize(owner, today, future),
    ]);
    const rows = await db
      .select()
      .from(s.occurrences)
      .where(eq(s.occurrences.habitId, habit.id));
    expect(rows).toHaveLength(3);
    occurrence = rows.find((o) => o.localDate === today)!;
  });
  it("completion and XP are atomic and retry safe", async () => {
    await Promise.all(
      Array.from({ length: 5 }, () =>
        complete(owner, "occurrence", occurrence.id),
      ),
    );
    expect(
      await db
        .select()
        .from(s.completions)
        .where(
          and(
            eq(s.completions.userId, owner.id),
            eq(s.completions.sourceKey, "occurrence:" + occurrence.id),
          ),
        ),
    ).toHaveLength(1);
    expect(
      await db.select().from(s.xpLedger).where(eq(s.xpLedger.userId, owner.id)),
    ).toHaveLength(1);
    const [saved] = await db
      .select()
      .from(s.occurrences)
      .where(eq(s.occurrences.id, occurrence.id));
    expect(saved.status).toBe("completed");
  });
  it("a changed recurrence never overwrites historical snapshots", async () => {
    await db
      .update(s.habits)
      .set({
        title: "Changed title",
        duration: 60,
        revision: 2,
        recurrence: { ...habit.recurrence, frequency: "weekly", days: [1] },
      })
      .where(eq(s.habits.id, habit.id));
    await materialize(owner, today, future);
    const [saved] = await db
      .select()
      .from(s.occurrences)
      .where(eq(s.occurrences.id, occurrence.id));
    expect(saved.title).toBe("Persistence test habit");
    expect(saved.duration).toBe(30);
    expect(saved.status).toBe("completed");
    expect(saved.ruleRevision).toBe(1);
  });
  it("per-user checks reject foreign completions and session targets", async () => {
    await expect(
      complete(other, "occurrence", occurrence.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      createSession(other, {
        taskId: task.id,
        start: localToUtc(future, "10:00", owner.timezone),
        end: localToUtc(future, "10:30", owner.timezone),
      }),
    ).rejects.toMatchObject({ status: 400 });
    const state = await getState(other);
    expect(state.tasks).toHaveLength(0);
    expect(state.occurrences).toHaveLength(0);
  });
  it("a completed task session does not complete the task or earn duplicate XP", async () => {
    const first = await createSession(owner, {
      taskId: task.id,
      start: localToUtc(future, "10:00", owner.timezone),
      end: localToUtc(future, "10:30", owner.timezone),
    });
    await createSession(owner, {
      taskId: task.id,
      start: localToUtc(future, "11:00", owner.timezone),
      end: localToUtc(future, "12:00", owner.timezone),
    });
    await complete(owner, "session", first.id);
    await complete(owner, "session", first.id);
    const [saved] = await db
      .select()
      .from(s.tasks)
      .where(eq(s.tasks.id, task.id));
    expect(saved.status).not.toBe("done");
    expect(
      await db.select().from(s.xpLedger).where(eq(s.xpLedger.userId, owner.id)),
    ).toHaveLength(1);
  });
  it("overlaps and breaks are rejected until explicitly acknowledged", async () => {
    const values = {
      taskId: task.id,
      start: localToUtc(future, "10:25", owner.timezone),
      end: localToUtc(future, "10:50", owner.timezone),
    };
    await expect(createSession(owner, values)).rejects.toMatchObject({
      status: 409,
    });
    const saved = await createSession(owner, {
      ...values,
      allowConflict: true,
    });
    expect(saved.id).toBeTruthy();
  });
  it("timezone edits leave occurrence eligibility and UTC instants intact", async () => {
    const before = await db
      .select()
      .from(s.sessions)
      .where(eq(s.sessions.userId, owner.id));
    await db
      .update(s.users)
      .set({ timezone: "Pacific/Auckland" })
      .where(eq(s.users.id, owner.id));
    await materialize(
      { ...owner, timezone: "Pacific/Auckland" },
      today,
      future,
    );
    const [saved] = await db
      .select()
      .from(s.occurrences)
      .where(eq(s.occurrences.id, occurrence.id));
    expect(saved.timezone).toBe("Europe/London");
    expect(saved.localDate).toBe(today);
    const after = await db
      .select()
      .from(s.sessions)
      .where(eq(s.sessions.userId, owner.id));
    expect(after.map((s) => s.start)).toEqual(before.map((s) => s.start));
    await db
      .update(s.users)
      .set({ timezone: owner.timezone })
      .where(eq(s.users.id, owner.id));
  });
  it("recovery is explicit and only changes the chosen occurrence", async () => {
    const [o] = await db
      .select()
      .from(s.occurrences)
      .where(
        and(
          eq(s.occurrences.habitId, habit.id),
          eq(s.occurrences.localDate, addDays(today, 1)),
        ),
      );
    const [hBefore] = await db
      .select()
      .from(s.habits)
      .where(eq(s.habits.id, habit.id));
    await recover(
      owner,
      o.id,
      "shorten",
      undefined,
      localToUtc(addDays(today, 1), "18:00", owner.timezone),
    );
    const [changed] = await db
      .select()
      .from(s.occurrences)
      .where(eq(s.occurrences.id, o.id));
    expect(changed.duration).toBe(10);
    expect(changed.status).toBe("pending");
    await recover(owner, o.id, "skip", "Rest");
    const [hAfter] = await db
      .select()
      .from(s.habits)
      .where(eq(s.habits.id, habit.id));
    expect(hAfter).toEqual(hBefore);
    const sessions = await db
      .select()
      .from(s.sessions)
      .where(eq(s.sessions.occurrenceId, o.id));
    expect(sessions.every((s) => s.status === "cancelled")).toBe(true);
  });
  it("stale proposals cannot silently overlap a changed calendar", async () => {
    await db
      .insert(s.tasks)
      .values({ userId: owner.id, title: "Plan me", estimate: 20 });
    const plan = await generatePlan(
      owner,
      addDays(today, 3),
      addDays(today, 4),
    );
    const item = plan.items.find((x) => x.start)!;
    await createSession(owner, {
      taskId: task.id,
      start: item.start!,
      end: item.end!,
      allowConflict: true,
    });
    await expect(
      acceptProposal(owner, plan.id, [item.key]),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("worker reminders are idempotent and do not complete elapsed blocks", async () => {
    const start = plusMinutes(new Date().toISOString(), 5);
    const session = await createSession(owner, {
      taskId: task.id,
      start,
      end: plusMinutes(start, 15),
      allowConflict: true,
    });
    await workerTick();
    await workerTick();
    const notifications = await db
      .select()
      .from(s.notifications)
      .where(eq(s.notifications.userId, owner.id));
    expect(
      notifications.filter((n) => n.dedupeKey.includes(session.id)),
    ).toHaveLength(1);
    const [saved] = await db
      .select()
      .from(s.sessions)
      .where(eq(s.sessions.id, session.id));
    expect(saved.status).toBe("scheduled");
  });
  it("portable JSON restores history and is safe to import twice", async () => {
    const response = await exportData(owner, "json");
    const backup = await response.json();
    const result = await importData(other, backup);
    expect(result.imported).toBe(true);
    expect((await importData(other, backup)).imported).toBe(false);
    const state = await getState(other);
    expect(state.tasks.length).toBeGreaterThan(0);
    expect(state.xp).toBe(20);
    expect(state.completions.some((c) => c.kind === "occurrence")).toBe(true);
    expect(state.user.id).toBe(other.id);
  });
});
describe("secure primitives and AI fallback", () => {
  it("hashes unique salted passwords and verifies safely", async () => {
    const a = await hashPassword("a long test password"),
      b = await hashPassword("a long test password");
    expect(a).not.toBe(b);
    expect(await verifyPassword("a long test password", a)).toBe(true);
    expect(await verifyPassword("wrong", a)).toBe(false);
  });
  it("limits authentication retries in PostgreSQL", async () => {
    const key = "test:" + stamp;
    await rateLimit(key, 1);
    await expect(rateLimit(key, 1)).rejects.toMatchObject({ status: 429 });
  });
  it("works with AI off, unavailable, or malformed", async () => {
    const body = { intention: "Practise piano" };
    expect((await aiDraft(owner, body)).available).toBe(false);
    const before = { ...process.env };
    process.env.AI_PROVIDER = "ollama";
    process.env.AI_BASE_URL = "http://127.0.0.1:9";
    expect(
      (
        await aiDraft(
          { ...owner, preferences: { ...owner.preferences, aiEnabled: true } },
          body,
        )
      ).available,
    ).toBe(false);
    process.env.AI_PROVIDER = before.AI_PROVIDER;
    process.env.AI_BASE_URL = before.AI_BASE_URL;
  });
});
