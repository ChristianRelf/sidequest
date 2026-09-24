import { and, eq, gte, lte, sql, lt } from "drizzle-orm";
import nodemailer from "nodemailer";
import { getDb } from "../db";
import * as s from "../db/schema";
import { materialize } from "./service";
import { addDays, formatTime, todayIn } from "../lib/time";
export async function workerTick(now = new Date()) {
  const db = getDb();
  const users = await db.select().from(s.users);
  for (const user of users) {
    const today = todayIn(user.timezone, now);
    await materialize(user, today, addDays(today, 35));
    if (!user.preferences.reminders) continue;
    const due = await db
      .select()
      .from(s.sessions)
      .where(
        and(
          eq(s.sessions.userId, user.id),
          eq(s.sessions.status, "scheduled"),
          gte(s.sessions.start, new Date(+now - 60000).toISOString()),
          lte(
            s.sessions.start,
            new Date(
              +now + user.preferences.reminderMinutes * 60000,
            ).toISOString(),
          ),
        ),
      );
    for (const session of due) {
      const [notification] = await db
        .insert(s.notifications)
        .values({
          userId: user.id,
          dedupeKey: `reminder:${session.id}:${new Date(session.start).toISOString()}`,
          title: `A little time for ${session.title}`,
          body: `Your ${session.kind === "fixed" ? "commitment" : "session"} starts at ${formatTime(session.start, user.timezone)}.`,
        })
        .onConflictDoNothing()
        .returning();
      if (
        notification &&
        user.preferences.emailReminders &&
        process.env.SMTP_HOST
      ) {
        // Claim before sending: at most once. A crash may drop email, but the durable in-app reminder remains.
        await db
          .update(s.notifications)
          .set({ emailSent: true })
          .where(eq(s.notifications.id, notification.id));
        const transport = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT ?? 587),
          secure: process.env.SMTP_PORT === "465",
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
            : undefined,
          connectionTimeout: 5000,
          socketTimeout: 8000,
        });
        try {
          await transport.sendMail({
            from: process.env.SMTP_FROM ?? "Sidequest <sidequest@localhost>",
            to: user.email,
            subject: notification.title,
            text: notification.body,
          });
        } catch {
          console.error(
            "Optional email reminder could not be delivered; in-app reminder retained.",
          );
        }
      }
    }
  }
  await db
    .delete(s.authSessions)
    .where(lt(s.authSessions.expiresAt, now.toISOString()));
  await db
    .delete(s.rateLimits)
    .where(lt(s.rateLimits.resetAt, new Date(+now - 86400000).toISOString()));
}
