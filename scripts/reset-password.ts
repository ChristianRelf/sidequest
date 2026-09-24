import "dotenv/config";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, closeDb } from "../src/db";
import { users, authSessions } from "../src/db/schema";
import { hashPassword } from "../src/server/auth";
async function main() {
  const email = process.argv[2]?.toLowerCase();
  if (!email)
    throw new Error("Usage: npm run account:reset -- email@example.com");
  const password = randomBytes(18).toString("base64url");
  const db = getDb();
  await db.transaction(async (tx) => {
    const [user] = await tx
      .update(users)
      .set({ passwordHash: await hashPassword(password) })
      .where(eq(users.email, email))
      .returning();
    if (!user) throw new Error("Account not found.");
    await tx.delete(authSessions).where(eq(authSessions.userId, user.id));
  });
  console.log(
    "Temporary password (share securely; change it in Settings): " + password,
  );
  await closeDb();
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
