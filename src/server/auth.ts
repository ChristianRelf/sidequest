import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt, sql } from "drizzle-orm";
import { getDb } from "../db";
import { authSessions, rateLimits, users } from "../db/schema";
const derive = (password: string, salt: string, strong = true) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCallback(
      password,
      salt,
      64,
      { N: strong ? 131072 : 16384, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = await derive(password, salt);
  return `scrypt-v2:${salt}:${hash.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [version, salt, hex] = stored.split(":");
  if (!salt || !hex) return false;
  const hash = await derive(password, salt, version === "scrypt-v2");
  const expected = Buffer.from(hex, "hex");
  return expected.length === hash.length && timingSafeEqual(hash, expected);
}
export async function issueSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + 30 * 86400000);
  await getDb()
    .insert(authSessions)
    .values({
      userId,
      tokenHash: hashToken(token),
      expiresAt: expires.toISOString(),
    });
  (await cookies()).set("sq_session", token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
    expires,
  });
}
export async function currentUser() {
  const token = (await cookies()).get("sq_session")?.value;
  if (!token) throw new AppError(401, "Please sign in to continue.");
  const [row] = await getDb()
    .select({ user: users })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(
      and(
        eq(authSessions.tokenHash, hashToken(token)),
        gt(authSessions.expiresAt, new Date().toISOString()),
      ),
    )
    .limit(1);
  if (!row)
    throw new AppError(401, "Your session expired. Please sign in again.");
  return row.user;
}
export async function logout() {
  const jar = await cookies(),
    token = jar.get("sq_session")?.value;
  if (token)
    await getDb()
      .delete(authSessions)
      .where(eq(authSessions.tokenHash, hashToken(token)));
  jar.delete("sq_session");
}
export function checkOrigin(request: Request) {
  const expected = new URL(process.env.APP_URL ?? request.url).origin;
  if (
    request.headers.get("origin") !== expected ||
    request.headers.get("x-sidequest-csrf") !== "1"
  )
    throw new AppError(
      403,
      "This request did not come from Sidequest. Refresh and try again.",
    );
}
export async function rateLimit(key: string, limit = 10, seconds = 900) {
  const reset = new Date(Date.now() + seconds * 1000).toISOString();
  const [row] = await getDb()
    .insert(rateLimits)
    .values({ key: hashToken(key), count: 1, resetAt: reset })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.resetAt} < now() then 1 else ${rateLimits.count} + 1 end`,
        resetAt: sql`case when ${rateLimits.resetAt} < now() then ${reset}::timestamptz else ${rateLimits.resetAt} end`,
      },
    })
    .returning();
  if (row.count > limit)
    throw new AppError(
      429,
      "Too many attempts. Please wait 15 minutes and try again.",
    );
}
