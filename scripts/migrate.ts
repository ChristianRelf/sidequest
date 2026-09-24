import "dotenv/config";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { getDb, closeDb } from "../src/db";
async function main() {
  await migrate(getDb(), { migrationsFolder: "migrations" });
  console.log("Database migrations applied.");
  await closeDb();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
