import { chromium } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
async function main() {
  await mkdir("artifacts", { recursive: true });
  const credentials = JSON.parse(
    await readFile(".local/demo-credentials.json", "utf8"),
  );
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:3000");
  await page.getByLabel("Email address").fill(credentials.email);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/today");
  await page
    .getByRole("heading", { name: "A little progress, every day." })
    .waitFor();
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: "artifacts/slice-today-desktop.png",
    fullPage: true,
  });
  await page.goto("http://localhost:3000/week");
  await page
    .getByRole("heading", { name: "Your week, with room to live." })
    .waitFor();
  await page.screenshot({
    path: "artifacts/slice-week-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3000/today");
  await page
    .getByRole("heading", { name: "A little progress, every day." })
    .waitFor();
  await page.screenshot({
    path: "artifacts/slice-today-mobile.png",
    fullPage: true,
  });
  await page.goto("http://localhost:3000/week");
  await page
    .getByRole("heading", { name: "Your week, with room to live." })
    .waitFor();
  await page.screenshot({
    path: "artifacts/slice-week-mobile.png",
    fullPage: true,
  });
  await writeFile(
    "artifacts/slice-review.json",
    JSON.stringify({ errors }, null, 2),
  );
  console.log(
    JSON.stringify({
      errors,
      files: [
        "slice-today-desktop.png",
        "slice-week-desktop.png",
        "slice-today-mobile.png",
        "slice-week-mobile.png",
      ],
    }),
  );
  await browser.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
