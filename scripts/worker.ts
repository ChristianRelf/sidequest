import "dotenv/config";
import { workerTick } from "../src/server/reminders";
import { closeDb } from "../src/db";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
let stopped = false;
let wake: (() => void) | undefined;
process.on("SIGINT", () => {
  stopped = true;
  wake?.();
});
process.on("SIGTERM", () => {
  stopped = true;
  wake?.();
});
async function main() {
  console.log("Sidequest worker started.");
  while (!stopped) {
    try {
      await workerTick();
      await writeFile(join(tmpdir(), "sidequest-worker-heartbeat"), String(Date.now()));
    } catch (e) {
      console.error(
        "Worker tick failed; retrying next minute.",
        e instanceof Error ? e.message : "unknown",
      );
    }
    if (process.argv.includes("--once")) break;
    if (!stopped) await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 60000);
      wake = () => { clearTimeout(timer); resolve(); };
    });
  }
  await closeDb();
}
main().catch(() => process.exit(1));
