import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, gt, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import {
  AppError,
  checkOrigin,
  currentUser,
  hashPassword,
  issueSession,
  logout,
  rateLimit,
  verifyPassword,
} from "@/server/auth";
import {
  acceptProposal,
  assertOwned,
  complete,
  createSession,
  generatePlan,
  getState,
  materialize,
  recover,
} from "@/server/service";
import {
  dateSchema,
  habitSchema,
  sessionSchema,
  settingsSchema,
  taskSchema,
  titleSchema,
  zoneSchema,
} from "@/lib/validation";
import { defaultPreferences } from "@/lib/types";
import { todayIn } from "@/lib/time";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const path = (await params).path.join("/"),
      method = req.method,
      db = getDb();
    if (path === "health") {
      await db.execute(sql`select 1`);
      return NextResponse.json({ status: "ok" });
    }
    if (method !== "GET") checkOrigin(req);
    let body: unknown = {};
    if (method !== "GET" && method !== "DELETE") {
      const raw = await req.text();
      if (Buffer.byteLength(raw) > 2_000_000)
        throw new AppError(413, "This request is too large.");
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        throw new AppError(400, "Invalid JSON.");
      }
    }
    if (path === "auth/signup" && method === "POST") {
      if (process.env.ALLOW_SIGNUP !== "true")
        throw new AppError(403, "Registration is disabled on this server.");
      const data = z
        .object({
          email: z
            .string()
            .email()
            .max(254)
            .transform((x) => x.toLowerCase()),
          name: titleSchema,
          password: z.string().min(12, "Use at least 12 characters.").max(200),
          timezone: zoneSchema,
        })
        .parse(body);
      await rateLimit("signup:global", 30);
      await rateLimit(`signup:${data.email}`, 5);
      const passwordHash = await hashPassword(data.password);
      const user = await db.transaction(async (tx) => {
        const [u] = await tx
          .insert(s.users)
          .values({
            email: data.email,
            name: data.name,
            passwordHash,
            timezone: data.timezone,
            preferences: defaultPreferences,
          })
          .onConflictDoNothing()
          .returning();
        if (!u)
          throw new AppError(
            409,
            "Unable to create an account with those details. Try signing in.",
          );
        await tx
          .insert(s.availability)
          .values(
            [1, 2, 3, 4, 5, 6, 7].map((day) => ({
              userId: u.id,
              day,
              start: "08:00",
              end: "20:00",
            })),
          );
        return u;
      });
      await issueSession(user.id);
      return NextResponse.json({ ok: true });
    }
    if (path === "auth/login" && method === "POST") {
      const data = z
        .object({
          email: z
            .string()
            .email()
            .transform((x) => x.toLowerCase()),
          password: z.string().min(1).max(200),
        })
        .parse(body);
      await rateLimit("login:global", 150);
      await rateLimit(`login:${data.email}`, 12);
      const [user] = await db
        .select()
        .from(s.users)
        .where(eq(s.users.email, data.email));
      const dummy =
        "scrypt-v2:00000000000000000000000000000000:" + "00".repeat(64);
      const valid = await verifyPassword(
        data.password,
        user?.passwordHash ?? dummy,
      );
      if (!user || !valid)
        throw new AppError(401, "Email or password is incorrect.");
      await issueSession(user.id);
      return NextResponse.json({ ok: true });
    }
    const user = await currentUser();
    if (path === "auth/logout" && method === "POST") {
      await logout();
      return NextResponse.json({ ok: true });
    }
    if (path === "state" && method === "GET") {
      const day = req.nextUrl.searchParams.get("date");
      return NextResponse.json(
        await getState(user, day ? dateSchema.parse(day) : undefined),
      );
    }
    if (path === "habits" && method === "POST") {
      const data = habitSchema.parse(body);
      const [habit] = await db
        .insert(s.habits)
        .values({ ...data, userId: user.id })
        .returning();
      await materialize(user);
      return NextResponse.json(habit);
    }
    const [resource, id, action] = path.split("/");
    if (id && resource !== "auth") z.string().uuid().parse(id);
    if (resource === "habits" && id && method === "PATCH") {
      await assertOwned("habit", id, user.id);
      const data = habitSchema.parse(body);
      await db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${user.id}))`,
        );
        await tx
          .update(s.habits)
          .set({ ...data, revision: sql`${s.habits.revision}+1` })
          .where(and(eq(s.habits.id, id), eq(s.habits.userId, user.id)));
        // Remove only unscheduled, future, unresolved snapshots. Past and scheduled history is stable.
        await tx
          .delete(s.occurrences)
          .where(
            and(
              eq(s.occurrences.habitId, id),
              eq(s.occurrences.userId, user.id),
              eq(s.occurrences.status, "pending"),
              gt(s.occurrences.localDate, todayIn(user.timezone)),
              sql`not exists (select 1 from scheduled_sessions where occurrence_id = ${s.occurrences.id})`,
            ),
          );
      });
      await materialize(user);
      return NextResponse.json({ ok: true });
    }
    if (path === "tasks" && method === "POST") {
      const data = taskSchema.parse(body);
      if (data.projectId) await assertOwned("project", data.projectId, user.id);
      const [task] = await db
        .insert(s.tasks)
        .values({ ...data, userId: user.id })
        .returning();
      return NextResponse.json(task);
    }
    if (resource === "tasks" && id && method === "PATCH") {
      await assertOwned("task", id, user.id);
      const data = taskSchema.parse(body);
      if (data.projectId) await assertOwned("project", data.projectId, user.id);
      await db
        .update(s.tasks)
        .set(data)
        .where(and(eq(s.tasks.id, id), eq(s.tasks.userId, user.id)));
      return NextResponse.json({ ok: true });
    }
    if (path === "projects" && method === "POST") {
      const data = z
        .object({
          name: titleSchema,
          color: z
            .enum(["lavender", "mint", "coral", "amber", "blue"])
            .default("lavender"),
        })
        .parse(body);
      return NextResponse.json(
        (
          await db
            .insert(s.projects)
            .values({ ...data, userId: user.id })
            .returning()
        )[0],
      );
    }
    if (path === "subtasks" && method === "POST") {
      const data = z
        .object({ taskId: z.string().uuid(), title: titleSchema })
        .parse(body);
      await assertOwned("task", data.taskId, user.id);
      return NextResponse.json(
        (
          await db
            .insert(s.subtasks)
            .values({ ...data, userId: user.id })
            .returning()
        )[0],
      );
    }
    if (resource === "subtasks" && id && method === "PATCH") {
      const data = z.object({ done: z.boolean() }).parse(body);
      await assertOwned("subtask", id, user.id);
      await db
        .update(s.subtasks)
        .set(data)
        .where(and(eq(s.subtasks.id, id), eq(s.subtasks.userId, user.id)));
      return NextResponse.json({ ok: true });
    }
    if (path === "sessions" && method === "POST")
      return NextResponse.json(
        await createSession(user, sessionSchema.parse(body)),
      );
    if (resource === "sessions" && id && method === "PATCH")
      return NextResponse.json(
        await createSession(user, sessionSchema.parse(body), id),
      );
    if (resource === "sessions" && id && method === "DELETE") {
      await assertOwned("session", id, user.id);
      await db
        .update(s.sessions)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(s.sessions.id, id),
            eq(s.sessions.userId, user.id),
            eq(s.sessions.status, "scheduled"),
          ),
        );
      return NextResponse.json({ ok: true });
    }
    if (path === "complete" && method === "POST") {
      const data = z
        .object({
          kind: z.enum(["occurrence", "task", "session"]),
          id: z.string().uuid(),
        })
        .parse(body);
      return NextResponse.json(await complete(user, data.kind, data.id));
    }
    if (path === "recover" && method === "POST") {
      const data = z
        .object({
          id: z.string().uuid(),
          action: z.enum(["skip", "shorten", "reschedule"]),
          reason: z.string().max(200).optional(),
          start: z.string().datetime({ offset: true }).optional(),
        })
        .parse(body);
      return NextResponse.json(
        await recover(user, data.id, data.action, data.reason, data.start),
      );
    }
    if (path === "plan" && method === "POST") {
      const data = z.object({ from: dateSchema, to: dateSchema }).parse(body);
      return NextResponse.json(await generatePlan(user, data.from, data.to));
    }
    if (
      resource === "proposals" &&
      id &&
      action === "accept" &&
      method === "POST"
    ) {
      const data = z
        .object({ keys: z.array(z.string().uuid()).max(100) })
        .parse(body);
      return NextResponse.json(await acceptProposal(user, id, data.keys));
    }
    if (resource === "proposals" && id && method === "PATCH") {
      const change = z
        .object({
          key: z.string().uuid(),
          start: z.string().datetime({ offset: true }),
          end: z.string().datetime({ offset: true }),
        })
        .refine(
          (x) => new Date(x.end) > new Date(x.start),
          "End must follow start",
        )
        .parse(body);
      const result = await db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${user.id}))`,
        );
        const [p] = await tx
          .select()
          .from(s.proposals)
          .where(
            and(
              eq(s.proposals.id, id),
              eq(s.proposals.userId, user.id),
              eq(s.proposals.status, "pending"),
            ),
          );
        if (!p) throw new AppError(404, "Pending proposal not found.");
        const items = p.items.map((item) =>
          item.key === change.key && !item.accepted
            ? {
                ...item,
                start: change.start,
                end: change.end,
                explanation:
                  "Time adjusted by you. Conflicts and protected breaks are checked again when you accept.",
              }
            : item,
        );
        return (
          await tx
            .update(s.proposals)
            .set({ items })
            .where(eq(s.proposals.id, id))
            .returning()
        )[0];
      });
      return NextResponse.json(result);
    }
    if (resource === "proposals" && id && method === "DELETE") {
      await db
        .update(s.proposals)
        .set({ status: "dismissed" })
        .where(and(eq(s.proposals.id, id), eq(s.proposals.userId, user.id)));
      return NextResponse.json({ ok: true });
    }
    if (path === "settings" && method === "PATCH") {
      const data = settingsSchema.parse(body);
      await db.transaction(async (tx) => {
        await tx
          .update(s.users)
          .set({
            name: data.name,
            timezone: data.timezone,
            preferences: sql`${s.users.preferences} || ${JSON.stringify(data.preferences??{})}::jsonb`,
          })
          .where(eq(s.users.id, user.id));
        if (data.availability) {
          await tx
            .delete(s.availability)
            .where(eq(s.availability.userId, user.id));
          if (data.availability.length)
            await tx
              .insert(s.availability)
              .values(
                data.availability.map((x) => ({ ...x, userId: user.id })),
              );
        }
      });
      return NextResponse.json({ ok: true });
    }
    if (path === "commitments" && method === "POST") {
      const data = z
        .object({
          title: titleSchema,
          days: z.array(z.number().int().min(1).max(7)).min(1),
          startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        })
        .refine((x) => x.endTime > x.startTime, "End must follow start")
        .parse(body);
      const [c] = await db
        .insert(s.commitments)
        .values({ ...data, userId: user.id })
        .returning();
      await materialize(user);
      return NextResponse.json(c);
    }
    if (resource === "commitments" && id && method === "DELETE") {
      await assertOwned("commitment", id, user.id);
      await db
        .delete(s.commitments)
        .where(
          and(eq(s.commitments.id, id), eq(s.commitments.userId, user.id)),
        );
      return NextResponse.json({ ok: true });
    }
    if (path === "notifications" && method === "PATCH") {
      await db
        .update(s.notifications)
        .set({ read: true })
        .where(eq(s.notifications.userId, user.id));
      return NextResponse.json({ ok: true });
    }
    if (path === "account/password" && method === "POST") {
      const data = z
        .object({
          current: z.string().max(200),
          password: z.string().min(12).max(200),
        })
        .parse(body);
      await rateLimit(`password:${user.id}`, 5);
      if (!(await verifyPassword(data.current, user.passwordHash)))
        throw new AppError(400, "Current password is incorrect.");
      await db
        .update(s.users)
        .set({ passwordHash: await hashPassword(data.password) })
        .where(eq(s.users.id, user.id));
      await db.delete(s.authSessions).where(eq(s.authSessions.userId, user.id));
      await issueSession(user.id);
      return NextResponse.json({ ok: true });
    }
    if (path === "account" && method === "POST") {
      const data = z
        .object({
          password: z.string().max(200),
          confirmation: z.literal("DELETE"),
        })
        .parse(body);
      await rateLimit(`delete:${user.id}`, 5);
      if (!(await verifyPassword(data.password, user.passwordHash)))
        throw new AppError(400, "Password is incorrect.");
      await db.delete(s.users).where(eq(s.users.id, user.id));
      await logout();
      return NextResponse.json({ ok: true });
    }
    if (path === "export" && method === "GET") {
      const { exportData } = await import("@/server/portable");
      return exportData(user, req.nextUrl.searchParams.get("format") ?? "json");
    }
    if (path === "import" && method === "POST") {
      const { importData } = await import("@/server/portable");
      return NextResponse.json(await importData(user, body));
    }
    if (path === "ai" && method === "POST") {
      const { aiDraft } = await import("@/server/ai");
      return NextResponse.json(await aiDraft(user, body));
    }
    throw new AppError(404, "Endpoint not found.");
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Check your entries." },
        { status: 400 },
      );
    if (error instanceof AppError)
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.status },
      );
    console.error(
      "Sidequest request failed",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      {
        error:
          "Something went wrong. Your changes may not have been saved. Please retry.",
      },
      { status: 500 },
    );
  }
}
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
