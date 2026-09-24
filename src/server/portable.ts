import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import * as s from "../db/schema";
import { getDb } from "../db";
import { AppError, hashToken } from "./auth";
import { habitSchema, taskSchema, settingsSchema,dateSchema,timeSchema,zoneSchema } from "../lib/validation";
type User = typeof s.users.$inferSelect;
const tables = {
  habits: s.habits,
  occurrences: s.occurrences,
  tasks: s.tasks,
  subtasks: s.subtasks,
  projects: s.projects,
  sessions: s.sessions,
  completions: s.completions,
  xpLedger: s.xpLedger,
  achievements: s.achievements,
  availability: s.availability,
  commitments: s.commitments,
  notifications: s.notifications,
  proposals:s.proposals,
};
export async function exportData(user: User, format: string) {
  const entries = await getDb().transaction(async tx=>Promise.all(
    Object.entries(tables).map(async ([name, table]) => [
      name,
      await tx.select().from(table).where(eq(table.userId, user.id)),
    ]),
  ),{isolationLevel:'repeatable read'});
  const data = Object.fromEntries(entries);
  if (format === "csv") {
    const escape = (value: unknown) => {
      let text = String(value ?? "");
      if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
      return '"' + text.replaceAll('"', '""') + '"';
    };
    const rows = [
      [
        "record_type",
        "id",
        "title_or_source",
        "date_or_start",
        "end",
        "status",
        "minutes_or_xp",
        "details_json",
      ],
    ];
    for (const [name, records] of entries)
      for (const row of records as Record<string, unknown>[])
        rows.push(
          [
            name,
            row.id,
            row.title ?? row.name ?? row.sourceKey ?? "",
            row.localDate ?? row.start ?? row.createdAt ?? "",
            row.end ?? "",
            row.status ?? "",
            row.duration ?? row.minutes ?? row.amount ?? "",
            JSON.stringify(row),
          ].map(String),
        );
    return new NextResponse(
      rows.map((r) => r.map(escape).join(",")).join("\r\n"),
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="sidequest.csv"',
        },
      },
    );
  }
  return new NextResponse(
    JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        profile: {
          name: user.name,
          timezone: user.timezone,
          preferences: user.preferences,
        },
        data,
      },
      null,
      2,
    ),
    {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="sidequest-backup.json"',
      },
    },
  );
}
const record = z.record(z.string(), z.unknown());
const backupSchema = z.object({
  version: z.literal(1),
  profile: settingsSchema,
  data: z.object(
    Object.fromEntries(
      Object.keys(tables).map((k) => [
        k,
        z.array(record).max(5000).default([]),
      ]),
    ) as Record<keyof typeof tables, z.ZodDefault<z.ZodArray<typeof record>>>,
  ),
});
export async function importData(user: User, body: unknown) {
  const backup = backupSchema.parse(body);
  const fingerprint = hashToken(JSON.stringify(backup));
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${user.id}))`);
    const [already] = await tx
      .select()
      .from(s.notifications)
      .where(
        and(
          eq(s.notifications.userId, user.id),
          eq(s.notifications.dedupeKey, `import:${fingerprint}`),
        ),
      );
    if (already)
      return { imported: false, message: "This backup was already imported." };
    const ids = new Map<string, string>();
    for (const records of Object.values(backup.data))
      for (const r of records) {
        const id = z.string().uuid().parse(r.id);
        if (ids.has(id))
          throw new AppError(400, "Backup contains duplicate IDs.");
        ids.set(id, randomUUID());
      }
    const ref = (id: unknown, nullable = false) => {
      if (id == null && nullable) return null;
      const result = ids.get(String(id));
      if (!result)
        throw new AppError(400, "Backup contains a missing reference.");
      return result;
    };
    const timestamp = z.string().refine((x) => !Number.isNaN(+new Date(x)));
    const day = dateSchema;
    const short = z.string().max(4000);
    for (const r of backup.data.projects)
      await tx
        .insert(s.projects)
        .values({
          id: ref(r.id)!,
          userId: user.id,
          name: z.string().min(1).max(160).parse(r.name),
          color: z
            .enum(["mint", "lavender", "blue", "amber", "coral"])
            .parse(r.color),
        });
    for (const r of backup.data.habits)
      await tx
        .insert(s.habits)
        .values({
          ...habitSchema.parse(r),
          id: ref(r.id)!,
          userId: user.id,
          revision: z.number().int().min(1).parse(r.revision),
        });
    for (const r of backup.data.tasks) {
      const data = taskSchema.parse({
        ...r,
        status: r.status === "done" ? "active" : r.status,
      });
      await tx
        .insert(s.tasks)
        .values({
          ...data,
          id: ref(r.id)!,
          userId: user.id,
          projectId: ref(r.projectId, true),
          status: z.enum(["inbox", "active", "done"]).parse(r.status),
        });
    }
    for (const r of backup.data.occurrences) {
      const data = z
        .object({
          localDate: day,
          timezone: zoneSchema,
          title: short,
          duration: z.number().int().min(5).max(480),
          fallback: z.number().int().nullable(),
          ruleRevision: z.number().int().positive(),
          status: z.enum(["pending", "completed", "skipped"]),
          skipReason: short.nullable(),
          completedAt: timestamp.nullable(),
        })
        .parse(r);
      await tx
        .insert(s.occurrences)
        .values({
          ...data,
          id: ref(r.id)!,
          userId: user.id,
          habitId: ref(r.habitId)!,
        });
    }
    for (const r of backup.data.commitments) {
      const data = z
        .object({
          title: short,
          days: z.array(z.number().int().min(1).max(7)),
          startTime: timeSchema,
          endTime: timeSchema,
        })
        .parse(r);
      await tx
        .insert(s.commitments)
        .values({ ...data, id: ref(r.id)!, userId: user.id });
    }
    for (const r of backup.data.sessions) {
      const data = z
        .object({
          title: short,
          start: timestamp,
          end: timestamp,
          status: z.enum(["scheduled", "done", "cancelled"]),
          kind: z.enum(["habit", "task", "fixed"]),
          color: short,
          completedAt: timestamp.nullable(),
        })
        .parse(r);
      await tx
        .insert(s.sessions)
        .values({
          ...data,
          id: ref(r.id)!,
          userId: user.id,
          occurrenceId: ref(r.occurrenceId, true),
          taskId: ref(r.taskId, true),
          commitmentId: ref(r.commitmentId, true),
        });
    }
    for (const r of backup.data.subtasks)
      await tx
        .insert(s.subtasks)
        .values({
          id: ref(r.id)!,
          userId: user.id,
          taskId: ref(r.taskId)!,
          title: short.parse(r.title),
          done: z.boolean().parse(r.done),
        });
    for (const r of backup.data.completions) {
      const data = z
        .object({
          kind: z.enum(["occurrence", "task", "session"]),
          minutes: z.number().int().min(0).max(4800),
          localDate: day,
          timezone: zoneSchema,
          createdAt: timestamp,
        })
        .parse(r);
      const oldSource = z.string().parse(r.sourceKey).split(":");
      await tx
        .insert(s.completions)
        .values({
          ...data,
          id: ref(r.id)!,
          userId: user.id,
          sourceKey: `${oldSource[0]}:${ref(oldSource[1])}`,
        });
    }
    for (const r of backup.data.xpLedger)
      await tx
        .insert(s.xpLedger)
        .values({
          id: ref(r.id)!,
          userId: user.id,
          completionId: ref(r.completionId)!,
          amount: z.number().int().min(0).max(100).parse(r.amount),
          createdAt: timestamp.parse(r.createdAt),
        });
    for (const r of backup.data.achievements)
      await tx
        .insert(s.achievements)
        .values({
          userId: user.id,
          key: short.parse(r.key),
          createdAt: timestamp.parse(r.createdAt),
        })
        .onConflictDoNothing();
    for(const r of backup.data.notifications){const notification=z.object({title:short,body:short,read:z.boolean(),createdAt:timestamp}).parse(r);await tx.insert(s.notifications).values({...notification,id:ref(r.id)!,userId:user.id,dedupeKey:`restored:${ref(r.id)}`,emailSent:true});}
    for(const r of backup.data.proposals){const proposal=z.object({status:z.enum(['pending','accepted','dismissed']),createdAt:timestamp,items:z.array(z.object({key:z.string(),title:short,duration:z.number().int().min(1).max(4800),occurrenceId:z.string().optional(),taskId:z.string().optional(),start:timestamp.optional(),end:timestamp.optional(),explanation:short,conflicts:z.array(short),accepted:z.boolean().optional()}))}).parse(r);await tx.insert(s.proposals).values({...proposal,id:ref(r.id)!,userId:user.id,items:proposal.items.map(item=>({...item,key:ref(item.key)!,occurrenceId:item.occurrenceId?ref(item.occurrenceId)!:undefined,taskId:item.taskId?ref(item.taskId)!:undefined}))});}
    // Imported preferences are explicit; no credentials, auth sessions or endpoint secrets are portable.
    const prefs = {
      ...user.preferences,
      ...backup.profile.preferences,
      aiEnabled: user.preferences.aiEnabled,
    };
    await tx
      .update(s.users)
      .set({ preferences: prefs })
      .where(eq(s.users.id, user.id));
    if (backup.data.availability.length) {
      await tx.delete(s.availability).where(eq(s.availability.userId, user.id));
      for (const r of backup.data.availability) {
        const data = settingsSchema.shape.availability
          .unwrap()
          .element.parse(r);
        await tx.insert(s.availability).values({ ...data, userId: user.id });
      }
    }
    await tx
      .insert(s.notifications)
      .values({
        userId: user.id,
        dedupeKey: `import:${fingerprint}`,
        title: "Backup imported",
        body: "Your items and completion history were merged. Existing records were kept.",
        read: true,
      });
    return { imported: true, message: "Backup merged successfully." };
  });
}
