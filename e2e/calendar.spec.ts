import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { addDays, todayIn, localToUtc, durationMinutes } from "../src/lib/time";
test("calendar drag, resize, keyboard editing and proposal acceptance persist", async ({
  page,
}) => {
  const headers = { origin: "http://localhost:3000", "x-sidequest-csrf": "1" },
    password = "Calendar test " + randomUUID(),
    email = `calendar-${randomUUID()}@test.invalid`,
    today = todayIn("Europe/London");
  await page.request.post("/api/auth/signup", {
    headers,
    data: { email, password, name: "Calendar Test", timezone: "Europe/London" },
  });
  await page.request.patch("/api/settings", {
    headers,
    data: {
      preferences: { onboardingDone: true, companions: false, breakMinutes: 0 },
    },
  });
  const task = await page.request
    .post("/api/tasks", {
      headers,
      data: { title: "Move this block", estimate: 90 },
    })
    .then((r) => r.json());
  const session = await page.request
    .post("/api/sessions", {
      headers,
      data: {
        taskId: task.id,
        start: localToUtc(today, "09:00", "Europe/London"),
        end: localToUtc(today, "10:00", "Europe/London"),
      },
    })
    .then((r) => r.json());
  await page.goto("/week");
  await page
    .getByRole("heading", { name: "Your week, with room to live." })
    .waitFor();
  const block = page.locator(`[data-session-id="${session.id}"]`);
  await expect(block).toBeVisible();
  const bounds = (await block.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 15);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 91, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(page.getByText("Session moved.", { exact: true })).toBeVisible();
  let state = await page.request.get("/api/state").then((r) => r.json());
  let moved = state.sessions.find((s: { id: string }) => s.id === session.id);
  expect(new Date(moved.start).toISOString()).toBe(
    new Date(localToUtc(today, "10:00", "Europe/London")).toISOString(),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const resize = (await block.locator(".resize-handle").boundingBox())!;
  await page.mouse.move(
    resize.x + resize.width / 2,
    resize.y + resize.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    resize.x + resize.width / 2,
    resize.y + resize.height / 2 + 38,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(
    page.getByText("Session duration updated.", { exact: true }),
  ).toBeVisible();
  state = await page.request.get("/api/state").then((r) => r.json());
  moved = state.sessions.find((s: { id: string }) => s.id === session.id);
  expect(durationMinutes(moved.start, moved.end)).toBe(90);
  await block.locator("button").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Start time", { exact: true }).fill("11:00");
  await page
    .getByRole("button", { name: "Update session", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const proposedTask = await page.request
    .post("/api/tasks", {
      headers,
      data: { title: "A proposed small step", estimate: 25 },
    })
    .then((r) => r.json());
  await page.reload();
  await page
    .getByRole("button", { name: "Suggest a plan", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Suggest a plan", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByText("A proposed small step", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Accept available slots", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText("Scheduled", { exact: true }),
  ).toBeVisible();
  state = await page.request.get("/api/state").then((r) => r.json());
  expect(
    state.sessions.some(
      (s: { taskId: string }) => s.taskId === proposedTask.id,
    ),
  ).toBe(true);
  await page.request.post("/api/account", {
    headers,
    data: { password, confirmation: "DELETE" },
  });
});
test("recovery options, settings and AI-off draft are usable through the interface", async ({
  page,
}) => {
  const headers = { origin: "http://localhost:3000", "x-sidequest-csrf": "1" },
    password = "Recovery test " + randomUUID(),
    today = todayIn("Europe/London");
  await page.request.post("/api/auth/signup", {
    headers,
    data: {
      email: `recovery-${randomUUID()}@test.invalid`,
      password,
      name: "Recovery Test",
      timezone: "Europe/London",
    },
  });
  await page.request.patch("/api/settings", {
    headers,
    data: { preferences: { onboardingDone: true, breakMinutes: 0 } },
  });
  const habit = await page.request
    .post("/api/habits", {
      headers,
      data: {
        title: "A forgiving habit",
        duration: 30,
        fallback: 10,
        preferredStart: "09:00",
        preferredEnd: "18:00",
        recurrence: {
          frequency: "daily",
          interval: 1,
          days: [1, 2, 3, 4, 5, 6, 7],
          monthDay: 1,
          startDate: today,
        },
      },
    })
    .then((r) => r.json());
  const before = await page.request.get("/api/state").then((r) => r.json()),
    occurrence = before.occurrences.find(
      (o: { habitId: string; localDate: string }) =>
        o.habitId === habit.id && o.localDate === today,
    );
  await page.request.post("/api/sessions", {
    headers,
    data: {
      occurrenceId: occurrence.id,
      start: localToUtc(today, "00:00", "Europe/London"),
      end: localToUtc(today, "00:30", "Europe/London"),
    },
  });
  await page.goto("/today");
  await page
    .locator(".recovery-strip")
    .getByRole("button", { name: "Revisit" })
    .click();
  await page.getByRole("button", { name: /Try the smaller version/ }).click();
  await page.getByLabel("New date").fill(addDays(today, 1));
  await page.getByRole("button", { name: "Accept this change" }).click();
  let state = await page.request.get("/api/state").then((r) => r.json());
  expect(
    state.occurrences.find((o: { id: string }) => o.id === occurrence.id)
      .duration,
  ).toBe(10);
  expect(
    state.habits.find((h: { id: string }) => h.id === habit.id).duration,
  ).toBe(30);
  await page.goto("/settings");
  await page
    .getByRole("button", { name: "Make it yours", exact: true })
    .click();
  await page.getByRole("switch", { name: "A little company" }).uncheck();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/today");
  await expect(page.locator(".hero-world")).toHaveCount(0);
  await page.goto("/habits");
  await page.getByRole("button", { name: "Start with an intention" }).click();
  await page.getByLabel("Your intention").fill("Learn a little drawing");
  await page.getByRole("button", { name: "Make a draft" }).click();
  await expect(page.getByText("SIMPLE DRAFT · NO AI REQUIRED")).toBeVisible();
  await page.getByRole("button", { name: "Review the details" }).click();
  await expect(page.getByLabel("Task name")).toHaveValue(
    "Learn a little drawing",
  );
  await page.request.post("/api/account", {
    headers,
    data: { password, confirmation: "DELETE" },
  });
});
