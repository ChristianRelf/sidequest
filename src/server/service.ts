import { and, eq, gte, lte, ne, sql, desc, inArray } from "drizzle-orm";
import { getDb } from "../db";
import * as s from "../db/schema";
import { AppError } from "./auth";
import {
  addDays,
  dateIn,
  durationMinutes,
  localToUtc,
  overlaps,
  plusMinutes,
  rangeDates,
  todayIn,
  weekday,
} from "../lib/time";
import { expandRecurrence, occurrenceStreak } from "../lib/recurrence";
import { proposePlan, type PlanningCandidate } from "../lib/planner";
import type { PlanItem } from "../lib/types";
type User = typeof s.users.$inferSelect;
const own = (table: { userId: typeof s.habits.userId }, id: string) =>
  eq(table.userId, id);
export async function materialize(
  user: User,
  from = todayIn(user.timezone),
  to = addDays(from, 35),
) {
  return getDb().transaction(async (db) => {
    await db.execute(sql`select pg_advisory_xact_lock(hashtext(${user.id}))`);
    const habits = await db
      .select()
      .from(s.habits)
      .where(and(eq(s.habits.userId, user.id), eq(s.habits.archived, false)));
    for (const habit of habits) {
      const values = expandRecurrence(habit.recurrence, from, to).map(
        (localDate) => ({
          userId: user.id,
          habitId: habit.id,
          localDate,
          timezone: user.timezone,
          title: habit.title,
          duration: habit.duration,
          fallback: habit.fallback,
          ruleRevision: habit.revision,
        }),
      );
      if (values.length)
        await db.insert(s.occurrences).values(values).onConflictDoNothing();
    }
    const commitments = await db
      .select()
      .from(s.commitments)
      .where(eq(s.commitments.userId, user.id));
    for (const c of commitments) {
      const values = rangeDates(from, to)
        .filter((d) => c.days.includes(weekday(d)))
        .map((d) => ({
          userId: user.id,
          commitmentId: c.id,
          title: c.title,
          start: localToUtc(d, c.startTime, user.timezone),
          end: localToUtc(d, c.endTime, user.timezone),
          kind: "fixed" as const,
          color: "neutral",
        }));
      if (values.length)
        await db.insert(s.sessions).values(values).onConflictDoNothing();
    }
  });
}
export async function getState(user: User, requestedDate?: string) {
  const db = getDb(),
    today = todayIn(user.timezone),
    viewDate = requestedDate ?? today;
  if (Math.abs(+new Date(viewDate) - +new Date(today)) > 366 * 86400000)
    throw new AppError(400, "Choose a date within one year of today.");
  await materialize(
    user,
    today,
    addDays(viewDate > today ? viewDate : today, 35),
  );
  const from = addDays(viewDate < today ? viewDate : today, -90),
    to = addDays(viewDate > today ? viewDate : today, 42);
  const [
    habits,
    tasks,
    occurrences,
    sessions,
    projects,
    subtasks,
    availability,
    commitments,
    notifications,
    proposals,
    completions,
    xp,
  ] = await Promise.all([
    db.select().from(s.habits).where(eq(s.habits.userId, user.id)),
    db
      .select()
      .from(s.tasks)
      .where(eq(s.tasks.userId, user.id))
      .orderBy(s.tasks.createdAt),
    db
      .select()
      .from(s.occurrences)
      .where(
        and(
          eq(s.occurrences.userId, user.id),
          gte(s.occurrences.localDate, from),
          lte(s.occurrences.localDate, to),
        ),
      ),
    db
      .select()
      .from(s.sessions)
      .where(
        and(
          eq(s.sessions.userId, user.id),
          gte(s.sessions.start, localToUtc(from, "00:00", user.timezone)),
          lte(s.sessions.start, localToUtc(to, "23:59", user.timezone)),
          ne(s.sessions.status, "cancelled"),
        ),
      ),
    db.select().from(s.projects).where(eq(s.projects.userId, user.id)),
    db.select().from(s.subtasks).where(eq(s.subtasks.userId, user.id)),
    db.select().from(s.availability).where(eq(s.availability.userId, user.id)),
    db.select().from(s.commitments).where(eq(s.commitments.userId, user.id)),
    db
      .select()
      .from(s.notifications)
      .where(eq(s.notifications.userId, user.id))
      .orderBy(desc(s.notifications.createdAt))
      .limit(40),
    db
      .select()
      .from(s.proposals)
      .where(
        and(eq(s.proposals.userId, user.id), eq(s.proposals.status, "pending")),
      )
      .orderBy(desc(s.proposals.createdAt))
      .limit(5),
    db
      .select()
      .from(s.completions)
      .where(
        and(
          eq(s.completions.userId, user.id),
          gte(s.completions.localDate, from),
        ),
      ),
    db
      .select({
        total: sql<number>`coalesce(sum(${s.xpLedger.amount}),0)::int`,
      })
      .from(s.xpLedger)
      .where(eq(s.xpLedger.userId, user.id)),
  ]);
  const [streakRows, earned] = await Promise.all([
    db
      .select({
        habitId: s.occurrences.habitId,
        localDate: s.occurrences.localDate,
        status: s.occurrences.status,
        timezone: s.occurrences.timezone,
      })
      .from(s.occurrences)
      .where(eq(s.occurrences.userId, user.id)),
    db
      .select({ key: s.achievements.key })
      .from(s.achievements)
      .where(eq(s.achievements.userId, user.id)),
  ]);
  const streaks = Object.fromEntries(
    habits.map((h) => [
      h.id,
      occurrenceStreak(
        streakRows.filter((o) => o.habitId === h.id),
        today,
      ),
    ]),
  );
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      timezone: user.timezone,
      preferences: user.preferences,
    },
    today,
    habits,
    tasks,
    occurrences,
    sessions: sessions.map((block) => ({
      ...block,
      start: new Date(block.start).toISOString(),
      end: new Date(block.end).toISOString(),
      completedAt: block.completedAt
        ? new Date(block.completedAt).toISOString()
        : null,
    })),
    projects,
    subtasks,
    availability,
    commitments,
    notifications,
    proposals,
    completions,
    xp: xp[0].total,
    streaks,
    earnedAchievements: earned.map((a) => a.key),
    aiAvailable: !!process.env.AI_PROVIDER && process.env.AI_PROVIDER !== "off",
    emailAvailable: !!process.env.SMTP_HOST,
  };
}
export async function assertOwned(
  kind:
    | "habit"
    | "occurrence"
    | "task"
    | "session"
    | "project"
    | "subtask"
    | "commitment",
  id: string,
  userId: string,
) {
  const table = {
    habit: s.habits,
    occurrence: s.occurrences,
    task: s.tasks,
    session: s.sessions,
    project: s.projects,
    subtask: s.subtasks,
    commitment: s.commitments,
  }[kind];
  const [row] = await getDb()
    .select()
    .from(table)
    .where(and(eq(table.id, id), eq(table.userId, userId)))
    .limit(1);
  if (!row) throw new AppError(404, "That item could not be found.");
  return row;
}
export async function createSession(
  user: User,
  data: {
    occurrenceId?: string;
    taskId?: string;
    start: string;
    end: string;
    allowConflict?: boolean;
  },
  sessionId?: string,
) {
  const db = getDb();
  if(dateIn(data.start,user.timezone)!==dateIn(new Date(+new Date(data.end)-1).toISOString(),user.timezone))throw new AppError(400,'Keep each session within one local date. Split overnight work into two sessions.');
  return db.transaction(async (tx) => {
    // Serialize changes per account so concurrent moves and proposal acceptances cannot hide a conflict.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${user.id}))`);
    let title = "",
      color = "lavender";
    if (sessionId) {
      const [current] = await tx
        .select()
        .from(s.sessions)
        .where(
          and(eq(s.sessions.id, sessionId), eq(s.sessions.userId, user.id)),
        );
      if (!current) throw new AppError(404, "Session not found.");
      if (current.kind === "fixed" || current.status !== "scheduled")
        throw new AppError(
          400,
          "Only scheduled flexible sessions can be moved.",
        );
    }
    if (data.occurrenceId) {
      const [o] = await tx
        .select()
        .from(s.occurrences)
        .where(
          and(
            eq(s.occurrences.id, data.occurrenceId),
            eq(s.occurrences.userId, user.id),
          ),
        );
      if (!o || o.status !== "pending")
        throw new AppError(400, "Choose an unresolved habit occurrence.");
      title = o.title;
      const [h] = await tx
        .select()
        .from(s.habits)
        .where(eq(s.habits.id, o.habitId));
      color = h.color;
    } else {
      const [task] = await tx
        .select()
        .from(s.tasks)
        .where(and(eq(s.tasks.id, data.taskId!), eq(s.tasks.userId, user.id)));
      if (!task || task.status === "done")
        throw new AppError(400, "Choose an unfinished task.");
      title = task.title;
      color = "blue";
    }
    const existing = await tx
      .select()
      .from(s.sessions)
      .where(
        and(
          eq(s.sessions.userId, user.id),
          ne(s.sessions.status, "cancelled"),
          gte(
            s.sessions.end,
            plusMinutes(data.start, -user.preferences.breakMinutes),
          ),
          lte(
            s.sessions.start,
            plusMinutes(data.end, user.preferences.breakMinutes),
          ),
        ),
      );
    const conflicts = existing.filter(
      (x) =>
        x.id !== sessionId && overlaps(data, x, user.preferences.breakMinutes),
    );
    if (conflicts.length && !data.allowConflict)
      throw new AppError(
        409,
        "This time overlaps another block or its protected break.",
        { conflicts: conflicts.map((x) => x.title) },
      );
    const values = {
      userId: user.id,
      occurrenceId: data.occurrenceId ?? null,
      taskId: data.taskId ?? null,
      title,
      start: data.start,
      end: data.end,
      color,
      kind: data.occurrenceId ? ("habit" as const) : ("task" as const),
    };
    const [result] = sessionId
      ? await tx
          .update(s.sessions)
          .set(values)
          .where(
            and(eq(s.sessions.id, sessionId), eq(s.sessions.userId, user.id)),
          )
          .returning()
      : await tx.insert(s.sessions).values(values).returning();
    return result;
  });
}
export async function complete(
  user: User,
  kind: "occurrence" | "task" | "session",
  id: string,
) {
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${user.id}))`);
    const now = new Date().toISOString();
    let minutes = 0,
      sourceKey = `${kind}:${id}`,
      eventKind: string = kind,
      amount = 0,
      sessionMinutes: number | undefined;
    if (kind === "session") {
      const [session] = await tx
        .select()
        .from(s.sessions)
        .where(and(eq(s.sessions.id, id), eq(s.sessions.userId, user.id)));
      if (
        !session ||
        session.kind === "fixed" ||
        session.status === "cancelled"
      )
        throw new AppError(404, "Session not found.");
      if (session.status === "done") return { alreadyCompleted: true };
      if (session.occurrenceId) {
        kind = "occurrence";
        id = session.occurrenceId;
        sourceKey = `occurrence:${id}`;
        eventKind = "occurrence";
        sessionMinutes = durationMinutes(session.start, session.end);
      } else {
        minutes = durationMinutes(session.start, session.end);
        await tx
          .update(s.sessions)
          .set({ status: "done", completedAt: now })
          .where(eq(s.sessions.id, id));
      }
    }
    if (kind === "occurrence") {
      const [row] = await tx
        .update(s.occurrences)
        .set({ status: "completed", completedAt: now, skipReason: null })
        .where(
          and(
            eq(s.occurrences.id, id),
            eq(s.occurrences.userId, user.id),
            ne(s.occurrences.status, "completed"),
          ),
        )
        .returning();
      if (!row) {
        const [exists] = await tx
          .select()
          .from(s.occurrences)
          .where(
            and(eq(s.occurrences.id, id), eq(s.occurrences.userId, user.id)),
          );
        if (!exists) throw new AppError(404, "Occurrence not found.");
        return { alreadyCompleted: true };
      }
      minutes = sessionMinutes ?? row.duration;
      amount = user.preferences.xpHabit;
      // All blocks reference one completed occurrence; only this event earns XP.
      await tx
        .update(s.sessions)
        .set({ status: "done", completedAt: now })
        .where(
          and(
            eq(s.sessions.occurrenceId, id),
            eq(s.sessions.userId, user.id),
            eq(s.sessions.status, "scheduled"),
          ),
        );
    }
    if (kind === "task") {
      const [task] = await tx
        .update(s.tasks)
        .set({ status: "done" })
        .where(
          and(
            eq(s.tasks.id, id),
            eq(s.tasks.userId, user.id),
            ne(s.tasks.status, "done"),
          ),
        )
        .returning();
      if (!task) {
        const [exists] = await tx
          .select()
          .from(s.tasks)
          .where(and(eq(s.tasks.id, id), eq(s.tasks.userId, user.id)));
        if (!exists) throw new AppError(404, "Task not found.");
        return { alreadyCompleted: true };
      }
      // Task sessions log effort separately; completing the task does not double-count minutes.
      minutes = 0;
      const [daily] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(s.completions)
        .where(
          and(
            eq(s.completions.userId, user.id),
            eq(s.completions.kind, "task"),
            eq(s.completions.localDate, todayIn(user.timezone)),
          ),
        );
      amount = daily.count < 5 ? user.preferences.xpTask : 0;
      await tx
        .update(s.sessions)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(s.sessions.taskId, id),
            eq(s.sessions.userId, user.id),
            eq(s.sessions.status, "scheduled"),
            gte(s.sessions.start, now),
          ),
        );
    }
    const [event] = await tx
      .insert(s.completions)
      .values({
        userId: user.id,
        sourceKey,
        kind: eventKind,
        minutes,
        timezone: user.timezone,
        localDate: todayIn(user.timezone),
      })
      .onConflictDoNothing()
      .returning();
    if (event && amount && user.preferences.xp && user.preferences.gamification)
      await tx
        .insert(s.xpLedger)
        .values({ userId: user.id, completionId: event.id, amount })
        .onConflictDoNothing();
    if (
      event &&
      kind !== "session" &&
      user.preferences.achievements &&
      user.preferences.gamification
    ) {
      const history = await tx
        .select({ localDate: s.completions.localDate })
        .from(s.completions)
        .where(
          and(
            eq(s.completions.userId, user.id),
            ne(s.completions.kind, "session"),
          ),
        );
      const keys = [
        "first-step",
        ...(history.length >= 10 ? ["ten-intentions"] : []),
        ...(new Set(
          history
            .filter((c) => c.localDate >= addDays(todayIn(user.timezone), -6))
            .map((c) => c.localDate),
        ).size >= 5
          ? ["room-in-the-week"]
          : []),
      ];
      await tx
        .insert(s.achievements)
        .values(keys.map((key) => ({ userId: user.id, key })))
        .onConflictDoNothing();
    }
    return {
      completed: true,
      xp:
        event && user.preferences.gamification && user.preferences.xp
          ? amount
          : 0,
    };
  });
}
export async function generatePlan(user: User, from: string, to: string) {
  if (to < from || +new Date(to) - +new Date(from) > 7 * 86400000)
    throw new AppError(400, "Plan up to seven days at a time.");
  await materialize(user, from, to);
  const state = await getState(user, from);
  const occupied = state.sessions.filter((x) => x.status !== "cancelled");
  const candidates: PlanningCandidate[] = [];
  for (const o of state.occurrences.filter(
    (x) =>
      x.localDate >= from &&
      x.localDate <= to &&
      x.status === "pending" &&
      !occupied.some((b) => b.occurrenceId === x.id),
  )) {
    const h = state.habits.find((x) => x.id === o.habitId)!;
    if (h.archived) continue;
    candidates.push({
      key: o.id,
      title: o.title,
      occurrenceId: o.id,
      duration: o.duration,
      date: o.localDate,
      priority: 2,
      preferredStart: h.preferredStart,
      preferredEnd: h.preferredEnd,
    });
  }
  for (const task of state.tasks.filter((x) => x.status !== "done")) {
    const planned = occupied
      .filter((x) => x.taskId === task.id)
      .reduce((n, x) => n + durationMinutes(x.start, x.end), 0);
    const remaining = task.estimate - planned;
    if (remaining > 0)
      candidates.push({
        key: task.id,
        title: task.title,
        taskId: task.id,
        duration: Math.min(remaining, 120),
        priority: task.priority,
        deadline: task.dueDate,
      });
  }
  const items = proposePlan({
    candidates,
    availability: state.availability,
    occupied,
    from,
    to,
    zone: user.timezone,
    breakMinutes: user.preferences.breakMinutes,
    dailyLimit: user.preferences.dailyLimit,
    now: new Date().toISOString(),
  });
  const [result] = await getDb()
    .insert(s.proposals)
    .values({ userId: user.id, items })
    .returning();
  return result;
}
export async function acceptProposal(user: User, id: string, keys: string[]) {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${user.id}))`);
    const [proposal] = await tx
      .select()
      .from(s.proposals)
      .where(and(eq(s.proposals.id, id), eq(s.proposals.userId, user.id)));
    if (!proposal || proposal.status === "dismissed")
      throw new AppError(404, "Plan not found.");
    const existing = await tx
      .select()
      .from(s.sessions)
      .where(
        and(eq(s.sessions.userId, user.id), ne(s.sessions.status, "cancelled")),
      );
    const items: PlanItem[] = structuredClone(proposal.items);
    const availability=await tx.select().from(s.availability).where(eq(s.availability.userId,user.id));
    for (const item of items.filter(
      (x) => keys.includes(x.key) && !x.accepted,
    )) {
      if (!item.start || !item.end) continue;
      if (+new Date(item.start) < Date.now())
        throw new AppError(
          409,
          "A proposed time has passed. Generate a fresh plan.",
        );
      const day=dateIn(item.start,user.timezone),minutes=durationMinutes(item.start,item.end);
      if(!availability.some(window=>window.day===weekday(day)&&+new Date(item.start!)>=+new Date(localToUtc(day,window.start,user.timezone))&&+new Date(item.end!)<=+new Date(localToUtc(day,window.end,user.timezone))))throw new AppError(409,'This proposal is outside your current availability. Adjust it or change your availability first.');
      const dailyLoad=existing.filter(block=>block.kind!=='fixed'&&dateIn(block.start,user.timezone)===day).reduce((total,block)=>total+durationMinutes(block.start,block.end),0);
      if(user.preferences.dailyLimit&&dailyLoad+minutes>user.preferences.dailyLimit)throw new AppError(409,'This proposal exceeds your current daily workload limit. Adjust it before accepting.');
      if (
        existing.some((x) =>
          overlaps(
            { start: item.start!, end: item.end! },
            x,
            user.preferences.breakMinutes,
          ),
        )
      )
        throw new AppError(
          409,
          "Your calendar changed. Generate a fresh plan before accepting.",
        );
      let color = "blue";
      if (item.occurrenceId) {
        const [o] = await tx
          .select()
          .from(s.occurrences)
          .where(
            and(
              eq(s.occurrences.id, item.occurrenceId),
              eq(s.occurrences.userId, user.id),
              eq(s.occurrences.status, "pending"),
            ),
          );
        if (!o)
          throw new AppError(
            409,
            "An occurrence changed. Generate a fresh plan.",
          );
        const [habit] = await tx
          .select()
          .from(s.habits)
          .where(eq(s.habits.id, o.habitId));
        color = habit.color;
      }
      if (item.taskId) {
        const [task] = await tx
          .select()
          .from(s.tasks)
          .where(
            and(
              eq(s.tasks.id, item.taskId),
              eq(s.tasks.userId, user.id),
              ne(s.tasks.status, "done"),
            ),
          );
        if (!task)
          throw new AppError(409, "A task changed. Generate a fresh plan.");
        if(task.dueDate&&day>task.dueDate)throw new AppError(409,'This proposal falls after the task’s due date. Adjust it before accepting.');
      }
      const [block] = await tx
        .insert(s.sessions)
        .values({
          userId: user.id,
          occurrenceId: item.occurrenceId ?? null,
          taskId: item.taskId ?? null,
          title: item.title,
          start: item.start,
          end: item.end,
          kind: item.occurrenceId ? "habit" : "task",
          color,
        })
        .returning();
      existing.push(block);
      item.accepted = true;
    }
    await tx
      .update(s.proposals)
      .set({
        items,
        status: items.every((x) => x.accepted || !x.start)
          ? "accepted"
          : "pending",
      })
      .where(eq(s.proposals.id, id));
    return { accepted: true };
  });
}
export async function recover(
  user: User,
  id: string,
  action: "skip" | "shorten" | "reschedule",
  reason?: string,
  start?: string,
) {
  const [o] = await getDb()
    .select()
    .from(s.occurrences)
    .where(and(eq(s.occurrences.id, id), eq(s.occurrences.userId, user.id)));
  if (!o || o.status !== "pending")
    throw new AppError(404, "Unresolved occurrence not found.");
  if (action === "skip")
    return getDb().transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${user.id}))`);
      const [changed] = await tx
        .update(s.occurrences)
        .set({ status: "skipped", skipReason: reason ?? "Rest day" })
        .where(
          and(eq(s.occurrences.id, id), eq(s.occurrences.status, "pending")),
        ).returning();
      if (!changed) throw new AppError(409, "This occurrence changed.");
      await tx
        .update(s.sessions)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(s.sessions.occurrenceId, id),
            eq(s.sessions.status, "scheduled"),
          ),
        );
      return { skipped: true };
    });
  if (!start) throw new AppError(400, "Choose a new start time.");
  const duration = action === "shorten" ? o.fallback : o.duration;
  if (!duration) throw new AppError(400, "This habit has no shorter version.");
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${user.id}))`);
    const [current] = await tx
      .select()
      .from(s.occurrences)
      .where(eq(s.occurrences.id, id));
    if (current.status !== "pending")
      throw new AppError(409, "This occurrence changed.");
    const end = plusMinutes(start, duration);
    if (dateIn(start, user.timezone) !== dateIn(new Date(+new Date(end) - 1).toISOString(), user.timezone))
      throw new AppError(400, "Keep a session within one local day. Split overnight work into two sessions.");
    const blocks = await tx
      .select()
      .from(s.sessions)
      .where(
        and(eq(s.sessions.userId, user.id), ne(s.sessions.status, "cancelled")),
      );
    if (
      blocks.some(
        (b) =>
          b.occurrenceId !== id &&
          overlaps({ start, end }, b, user.preferences.breakMinutes),
      )
    )
      throw new AppError(
        409,
        "This recovery time conflicts with another block. Choose a different time.",
      );
    await tx
      .update(s.sessions)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(s.sessions.occurrenceId, id),
          eq(s.sessions.status, "scheduled"),
        ),
      );
    if (action === "shorten")
      await tx
        .update(s.occurrences)
        .set({ duration })
        .where(eq(s.occurrences.id, id));
    const [h] = await tx
      .select()
      .from(s.habits)
      .where(eq(s.habits.id, o.habitId));
    const [session] = await tx
      .insert(s.sessions)
      .values({
        userId: user.id,
        occurrenceId: id,
        title: o.title,
        start,
        end,
        kind: "habit",
        color: h.color,
      })
      .returning();
    return session;
  });
}
