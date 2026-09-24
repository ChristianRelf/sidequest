import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
type DB = PostgresJsDatabase<typeof schema>;
const globalDb = globalThis as unknown as {
  sidequestDb?: DB;
  sidequestSql?: ReturnType<typeof postgres>;
};
export function getDb(): DB {
  if (!globalDb.sidequestDb) {
    const url = process.env.DATABASE_URL;
    if (!url)
      throw new Error(
        "DATABASE_URL is required. Follow README.md to start PostgreSQL.",
      );
    globalDb.sidequestSql = postgres(url, {
      max: 10,
      prepare: false,
      connect_timeout: 10,
    });
    globalDb.sidequestDb = drizzle(globalDb.sidequestSql, { schema });
  }
  return globalDb.sidequestDb;
}
export async function closeDb() {
  await globalDb.sidequestSql?.end();
  globalDb.sidequestDb = undefined;
  globalDb.sidequestSql = undefined;
}
export type Database = DB;
