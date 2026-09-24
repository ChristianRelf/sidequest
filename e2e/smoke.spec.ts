import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { addDays, todayIn } from "../src/lib/time";
test("signup → habit → schedule → complete, with persistent history", async ({
  page,
}) => {
  const email = `smoke-${randomUUID()}@test.invalid`,
    password = "Sidequest test password " + randomUUID();
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Your name", { exact: true }).fill("Smoke Test");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create your account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A plan that fits your real life." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Find my rhythm" }).click();
  await page.getByRole("button", { name: "Create my first habit" }).click();
  await page.getByLabel("Habit name").fill("Read ten pages");
  await page.getByLabel("Repeat", { exact: true }).selectOption("daily");
  await page.getByRole("button", { name: "Create habit", exact: true }).click();
  await page.getByRole("button", { name: "Give it a time" }).click();
  await page.getByRole("button", { name: "Schedule my first session" }).click();
  await page.getByLabel("Start time", { exact: true }).fill("18:00");
  await page
    .getByRole("button", { name: "Schedule session", exact: true })
    .click();
  await page.getByRole("button", { name: "Let’s begin" }).click();
  await page.waitForURL("**/today");
  await expect(
    page.getByRole("heading", { name: "A little progress, every day." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Complete session", exact: true })
    .click();
  await expect(
    page.getByText("A little progress, recorded.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator(".agenda-row.completed").filter({ hasText: "Read ten pages" }),
  ).toBeVisible();
  const data = await page.request.get("/api/state").then((r) => r.json());
  expect(
    data.occurrences.find(
      (o: { title: string; status: string }) =>
        o.title === "Read ten pages" && o.status === "completed",
    ),
  ).toBeTruthy();
  expect(data.xp).toBe(20);
  await page.request.post("/api/account", {
    headers: { origin: "http://localhost:3000", "x-sidequest-csrf": "1" },
    data: { password, confirmation: "DELETE" },
  });
});
test("server enforces isolation, CSRF, recurrence history, task sessions and export", async ({
  playwright,
}) => {
  const headers = { origin: "http://localhost:3000", "x-sidequest-csrf": "1" },
    password = "Integration password " + randomUUID();
  const a = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
      extraHTTPHeaders: headers,
    }),
    b = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
      extraHTTPHeaders: headers,
    });
  for (const [ctx, name] of [
    [a, "A"],
    [b, "B"],
  ] as const) {
    const r = await ctx.post("/api/auth/signup", {
      data: {
        email: `api-${name}-${randomUUID()}@test.invalid`,
        name,
        password,
        timezone: "Europe/London",
      },
    });
    expect(r.ok()).toBe(true);
  }
  const today = todayIn("Europe/London");
  const data = {
    title: "Stable history",
    duration: 30,
    fallback: 10,
    preferredStart: "09:00",
    preferredEnd: "12:00",
    recurrence: {
      frequency: "daily",
      interval: 1,
      days: [1, 2, 3, 4, 5, 6, 7],
      monthDay: 1,
      startDate: today,
    },
  };
  const habit = await a.post("/api/habits", { data }).then((r) => r.json());
  let state = await a.get("/api/state").then((r) => r.json());
  const occurrence = state.occurrences.find(
    (o: { habitId: string; localDate: string }) =>
      o.habitId === habit.id && o.localDate === today,
  );
  expect(
    (
      await b.post("/api/complete", {
        data: { kind: "occurrence", id: occurrence.id },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await a.post("/api/tasks", {
        headers: { origin: "http://evil.invalid" },
        data: { title: "CSRF" },
      })
    ).status(),
  ).toBe(403);
  await Promise.all([
    a.post("/api/complete", {
      data: { kind: "occurrence", id: occurrence.id },
    }),
    a.post("/api/complete", {
      data: { kind: "occurrence", id: occurrence.id },
    }),
  ]);
  await a.patch("/api/habits/" + habit.id, {
    data: {
      ...data,
      title: "New rhythm",
      duration: 45,
      recurrence: { ...data.recurrence, frequency: "weekly", days: [1] },
    },
  });
  state = await a.get("/api/state").then((r) => r.json());
  const previous = state.occurrences.find(
    (o: { id: string }) => o.id === occurrence.id,
  );
  expect(previous.title).toBe("Stable history");
  expect(previous.status).toBe("completed");
  expect(state.xp).toBe(20);
  const task = await a
    .post("/api/tasks", {
      data: { title: "Two sessions, one task", estimate: 60 },
    })
    .then((r) => r.json());
  const date = addDays(today, 1);
  const session = await a
    .post("/api/sessions", {
      data: {
        taskId: task.id,
        start: `${date}T13:00:00Z`,
        end: `${date}T13:30:00Z`,
      },
    })
    .then((r) => r.json());
  await a.post("/api/sessions", {
    data: {
      taskId: task.id,
      start: `${date}T14:00:00Z`,
      end: `${date}T14:30:00Z`,
    },
  });
  await a.post("/api/complete", { data: { kind: "session", id: session.id } });
  state = await a.get("/api/state").then((r) => r.json());
  expect(
    state.tasks.find((t: { id: string }) => t.id === task.id).status,
  ).not.toBe("done");
  expect(state.xp).toBe(20);
  expect(
    (
      await b.patch("/api/tasks/" + task.id, { data: { title: "Intrusion" } })
    ).status(),
  ).toBe(404);
  expect(
    (await a.get("/api/export?format=csv")).headers()["content-type"],
  ).toContain("text/csv");
  const backup = await a.get("/api/export").then((r) => r.json());
  expect(JSON.stringify(backup)).not.toContain("passwordHash");
  expect((await b.post("/api/import", { data: backup })).ok()).toBe(true);
  for (const ctx of [a, b]) {
    expect(
      (
        await ctx.post("/api/account", {
          data: { password, confirmation: "DELETE" },
        })
      ).ok(),
    ).toBe(true);
    expect((await ctx.get("/api/state")).status()).toBe(401);
    await ctx.dispose();
  }
});
