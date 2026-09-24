"use client";
import { useEffect, useState } from "react";
import Character from "./companion";
import {
  ArrowRight,
  Check,
  Clock3,
  Leaf,
  Plus,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { useApp, ApiError, api, type ScheduleTarget } from "./context";
import { Button, Field, Modal } from "./ui";
import {
  addDays,
  dateIn,
  durationMinutes,
  formatTime,
  localToUtc,
  plusMinutes,
  prettyDate,
  timeIn,
  weekday,
} from "@/lib/time";
import type { PlanItem, Proposal, Recurrence } from "@/lib/types";
const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export function Editors() {
  const { editor, setEditor } = useApp();
  if (!editor) return null;
  const close = () => setEditor(null);
  return (
    <Modal
      title={
        editor.type === "habit"
          ? editor.id
            ? "A habit worth making room for."
            : "One small commitment."
          : editor.type === "task"
            ? editor.id
              ? "A little closer to done."
              : "Get it out of your head."
            : editor.type === "schedule"
              ? "Give it a little time."
              : editor.type === "recovery"
                ? "There’s always a next step."
                : editor.type === "plan"
                  ? "A plan you get to choose."
                  : editor.type === "notifications"
                    ? "A gentle heads-up."
                    : "Start with an intention."
      }
      onClose={close}
      wide={editor.type === "habit" || editor.type === "plan"}
    >
      {editor.type === "habit" ? (
        <HabitEditor />
      ) : editor.type === "task" ? (
        <TaskEditor />
      ) : editor.type === "schedule" ? (
        <ScheduleEditor target={editor.target!} />
      ) : editor.type === "recovery" ? (
        <RecoveryEditor id={editor.id!} />
      ) : editor.type === "plan" ? (
        <PlanEditor />
      ) : editor.type === "notifications" ? (
        <Notifications />
      ) : (
        <AiEditor />
      )}
    </Modal>
  );
}
function HabitEditor() {
  const { data, editor, setEditor, mutate } = useApp(),
    habit = data.habits.find((x) => x.id === editor?.id);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [frequency, setFrequency] = useState<Recurrence["frequency"]>(
      habit?.recurrence.frequency ?? "weekly",
    ),
    [days, setDays] = useState(habit?.recurrence.days ?? [1, 2, 3, 4, 5]),
    [color, setColor] = useState(habit?.color ?? "lavender");
  const history = data.occurrences
    .filter((x) => x.habitId === habit?.id && x.localDate <= data.today)
    .sort((a, b) => b.localDate.localeCompare(a.localDate));
  return (
    <div className="detail-grid">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = Object.fromEntries(new FormData(e.currentTarget));
          try {
            await mutate(
              habit ? "habits/" + habit.id : "habits",
              habit ? "PATCH" : "POST",
              {
                title: f.title,
                description: f.description,
                duration: Number(f.duration),
                fallback: f.fallback ? Number(f.fallback) : null,
                preferredStart: f.preferredStart,
                preferredEnd: f.preferredEnd,
                color,
                recurrence: {
                  frequency,
                  interval: Number(f.interval),
                  days,
                  monthDay: Number(f.monthDay ?? 1),
                  startDate: f.startDate,
                  endDate: f.endDate || undefined,
                },
              },
              habit
                ? "Habit updated. Existing history and scheduled occurrences stay intact."
                : "Habit created. A good intention with a little structure.",
            );
            setEditor(null);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Habit name">
          <input
            name="title"
            autoFocus
            defaultValue={habit?.title ?? editor?.draft?.title}
            placeholder="Read a few pages"
            required
            maxLength={160}
          />
        </Field>
        <Field label="A little context (optional)">
          <textarea
            name="description"
            defaultValue={habit?.description}
            placeholder="Why does this matter to you?"
            rows={2}
          />
        </Field>
        <div className="form-row">
          <Field label="Usual duration">
            <div className="input-suffix">
              <input
                name="duration"
                type="number"
                min={5}
                max={480}
                step={5}
                defaultValue={habit?.duration ?? editor?.draft?.duration ?? 30}
                required
              />
              <span>min</span>
            </div>
          </Field>
          <Field label="Shorter version" hint="For days that go sideways.">
            <div className="input-suffix">
              <input
                name="fallback"
                type="number"
                min={5}
                max={480}
                step={5}
                defaultValue={habit?.fallback ?? 10}
              />
              <span>min</span>
            </div>
          </Field>
        </div>
        <div className="form-rule" />
        <h3>The rhythm</h3>
        <div className="form-row">
          <Field label="Repeat">
            <select
              value={frequency}
              onChange={(e) =>
                setFrequency(e.target.value as Recurrence["frequency"])
              }
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </Field>
          <Field
            label={`Every ${frequency === "daily" ? "N days" : frequency === "weekly" ? "N weeks" : "N months"}`}
          >
            <input
              name="interval"
              type="number"
              min={1}
              max={52}
              defaultValue={habit?.recurrence.interval ?? 1}
            />
          </Field>
        </div>
        {frequency === "weekly" && (
          <div className="day-toggle-group" aria-label="Eligible weekdays">
            {weekDays.map((day, index) => (
              <button
                key={day}
                type="button"
                aria-pressed={days.includes(index + 1)}
                className={days.includes(index + 1) ? "active" : ""}
                onClick={() =>
                  setDays(
                    days.includes(index + 1)
                      ? days.filter((x) => x !== index + 1)
                      : [...days, index + 1],
                  )
                }
              >
                {day}
              </button>
            ))}
          </div>
        )}
        {frequency === "monthly" && (
          <Field
            label="Day of the month"
            hint="Missing dates (such as February 30) are rest periods."
          >
            <input
              name="monthDay"
              type="number"
              min={1}
              max={31}
              defaultValue={habit?.recurrence.monthDay ?? 1}
            />
          </Field>
        )}
        <div className="form-row">
          <Field label="Start date">
            <input
              name="startDate"
              type="date"
              defaultValue={habit?.recurrence.startDate ?? data.today}
              required
            />
          </Field>
          <Field label="End date (optional)">
            <input
              name="endDate"
              type="date"
              defaultValue={habit?.recurrence.endDate}
            />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Preferred window, from">
            <input
              name="preferredStart"
              type="time"
              defaultValue={habit?.preferredStart ?? "08:00"}
              required
            />
          </Field>
          <Field label="Until">
            <input
              name="preferredEnd"
              type="time"
              defaultValue={habit?.preferredEnd ?? "12:00"}
              required
            />
          </Field>
        </div>
        <div className="color-picker">
          <span>Colour</span>
          {["lavender", "mint", "coral", "amber", "blue"].map((c) => (
            <button
              type="button"
              key={c}
              aria-label={c}
              aria-pressed={color === c}
              className={`swatch ${c} ${color === c ? "selected" : ""}`}
              onClick={() => setColor(c)}
            >
              {color === c && <Check size={14} />}
            </button>
          ))}
        </div>
        {habit && (
          <p className="info-note">
            Changes affect future unscheduled occurrences. Earlier completions,
            today’s occurrence and existing time blocks keep their original
            details.
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          {habit && (
            <Button
              type="button"
              variant="ghost"
              onClick={async () => {
                await mutate(
                  "habits/" + habit.id,
                  "PATCH",
                  { ...habit, archived: !habit.archived },
                  habit.archived
                    ? "Habit resumed."
                    : "Habit paused. Existing history and time blocks are kept.",
                );
                setEditor(null);
              }}
            >
              {habit.archived ? "Resume habit" : "Pause habit"}
            </Button>
          )}
          <Button type="submit" busy={busy}>
            {habit ? "Save changes" : "Create habit"}
            <ArrowRight size={16} />
          </Button>
        </div>
      </form>
      <aside className="habit-detail-aside">
        {data.user.preferences.companions && (
          <Character
            character="pip"
            state="idle"
            reduced={data.user.preferences.reducedMotion}
          />
        )}
        <h3>
          {habit
            ? "The little things add up."
            : "Consistency has room for life."}
        </h3>
        <p>
          Rest days don’t break a streak. Skips pause it. An unresolved eligible
          occurrence does.
        </p>
        <h4>Recent occurrences</h4>
        {history.slice(0, 8).map((o) => (
          <div className="history-line" key={o.id}>
            <span>
              {prettyDate(o.localDate, { month: "short", day: "numeric" })}
            </span>
            <span
              className={
                o.status === "completed"
                  ? "mint-text"
                  : o.status === "skipped"
                    ? "muted"
                    : "coral-text"
              }
            >
              {o.status === "completed"
                ? "Completed"
                : o.status === "skipped"
                  ? "Skipped"
                  : "Unresolved"}
            </span>
          </div>
        ))}
        {!history.length && (
          <p className="muted">Your first small step will appear here.</p>
        )}
      </aside>
    </div>
  );
}
function TaskEditor() {
  const { data, editor, setEditor, mutate, celebrate } = useApp(),
    task = data.tasks.find((x) => x.id === editor?.id);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [subtask, setSubtask] = useState("");
  return (
    <>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = Object.fromEntries(new FormData(e.currentTarget));
          try {
            let projectId = f.projectId || null;
            if (f.newProject) {
              const project = await mutate<{ id: string }>("projects", "POST", {
                name: f.newProject,
              });
              projectId = project.id;
            }
            await mutate(
              task ? "tasks/" + task.id : "tasks",
              task ? "PATCH" : "POST",
              {
                title: f.title,
                description: f.description,
                estimate: Number(f.estimate),
                dueDate: f.dueDate || null,
                priority: Number(f.priority),
                projectId,
              },
              "Task saved. One less thing to keep in your head.",
            );
            setEditor(null);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Task name">
          <input
            name="title"
            autoFocus
            required
            maxLength={160}
            defaultValue={task?.title ?? editor?.draft?.title}
            placeholder="Send that email, finish that thing…"
          />
        </Field>
        <Field label="Notes">
          <textarea
            name="description"
            rows={3}
            defaultValue={task?.description}
            placeholder="A few useful details"
          />
        </Field>
        <div className="form-row">
          <Field label="Estimated effort">
            <div className="input-suffix">
              <input
                name="estimate"
                type="number"
                min={5}
                max={4800}
                step={5}
                defaultValue={task?.estimate ?? editor?.draft?.duration ?? 30}
              />
              <span>min</span>
            </div>
          </Field>
          <Field label="Due date (optional)">
            <input
              name="dueDate"
              type="date"
              defaultValue={task?.dueDate ?? ""}
            />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Priority">
            <select name="priority" defaultValue={task?.priority ?? 2}>
              <option value={1}>High</option>
              <option value={2}>Normal</option>
              <option value={3}>Low</option>
            </select>
          </Field>
          <Field label="Project">
            <select name="projectId" defaultValue={task?.projectId ?? ""}>
              <option value="">No project</option>
              {data.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <details className="form-details">
          <summary>Create a new project</summary>
          <Field label="New project name">
            <input
              name="newProject"
              placeholder="Something worth working on"
              maxLength={160}
            />
          </Field>
        </details>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button type="submit" busy={busy}>
            {task ? "Save changes" : "Add task"}
            <ArrowRight size={16} />
          </Button>
        </div>
      </form>
      {task && (
        <>
          <div className="form-rule" />
          <div className="section-heading">
            <h3>Small steps</h3>
            <span className="muted">Subtasks</span>
          </div>
          {data.subtasks
            .filter((s) => s.taskId === task.id)
            .map((s) => (
              <label className="subtask-row" key={s.id}>
                <input
                  type="checkbox"
                  checked={s.done}
                  onChange={() =>
                    void mutate("subtasks/" + s.id, "PATCH", {
                      done: !s.done,
                    }).catch(() => {})
                  }
                />
                <span className={s.done ? "struck" : ""}>{s.title}</span>
              </label>
            ))}
          <form
            className="inline-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (subtask.trim()) {
                await mutate("subtasks", "POST", {
                  taskId: task.id,
                  title: subtask,
                });
                setSubtask("");
              }
            }}
          >
            <input
              aria-label="New subtask"
              value={subtask}
              onChange={(e) => setSubtask(e.target.value)}
              placeholder="Add a small step"
            />
            <IconButtonSubmit />
          </form>
          <div className="form-rule" />
          <h3>Scheduled sessions</h3>
          <p className="muted small">
            Finishing a session logs the work. Only “Finish task” completes the
            task.
          </p>
          {data.sessions
            .filter((s) => s.taskId === task.id)
            .map((s) => (
              <div className="history-line" key={s.id}>
                <span>
                  {prettyDate(dateIn(s.start, data.user.timezone), {
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  · {formatTime(s.start, data.user.timezone)}
                </span>
                <span>
                  {durationMinutes(s.start, s.end)} min · {s.status}
                </span>
              </div>
            ))}
          {task.status !== "done" && (
            <div className="form-actions spread">
              <Button
                variant="secondary"
                onClick={() =>
                  setEditor({
                    type: "schedule",
                    target: {
                      taskId: task.id,
                      title: task.title,
                      duration: Math.min(task.estimate, 120),
                    },
                  })
                }
              >
                <Clock3 size={16} />
                Schedule a session
              </Button>
              <Button
                onClick={async () => {
                  await mutate(
                    "complete",
                    "POST",
                    { kind: "task", id: task.id },
                    "Task finished. Future unfinished sessions were released.",
                  );
                  celebrate();
                  setEditor(null);
                }}
              >
                <Check size={16} />
                Finish task
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
function IconButtonSubmit() {
  return (
    <Button variant="secondary" type="submit" aria-label="Add subtask">
      <Plus size={17} />
    </Button>
  );
}
function ScheduleEditor({ target }: { target: ScheduleTarget }) {
  const { data, mutate, setEditor } = useApp();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [conflicts, setConflicts] = useState<string[]>([]),
    [allow, setAllow] = useState(false);
  const existing = data.sessions.find((s) => s.id === target.sessionId);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const f = Object.fromEntries(new FormData(e.currentTarget));
        try {
          const start = localToUtc(
            String(f.date),
            String(f.time),
            data.user.timezone,
          );
          await mutate(
            target.sessionId ? "sessions/" + target.sessionId : "sessions",
            target.sessionId ? "PATCH" : "POST",
            {
              occurrenceId: target.occurrenceId,
              taskId: target.taskId,
              start,
              end: plusMinutes(start, Number(f.duration)),
              allowConflict: allow,
            },
            "Time set. A little intention, on the calendar.",
          );
          setEditor(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not schedule.");
          if (err instanceof ApiError && err.details?.conflicts)
            setConflicts(err.details.conflicts);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="schedule-target">
        <span className="queue-type lavender">
          <Clock3 size={21} />
        </span>
        <div>
          <strong>{target.title}</strong>
          <p>
            {target.occurrenceId
              ? "This specific habit occurrence"
              : "One session for this task"}
          </p>
        </div>
      </div>
      <div className="form-row">
        <Field label="Date">
          <input
            name="date"
            type="date"
            required
            defaultValue={target.date ?? data.today}
          />
        </Field>
        <Field label="Start time">
          <input
            name="time"
            type="time"
            required
            defaultValue={target.time ?? "10:00"}
          />
        </Field>
      </div>
      <Field label="Session length">
        <div className="input-suffix">
          <input
            name="duration"
            type="number"
            min={5}
            max={480}
            step={5}
            defaultValue={target.duration}
          />
          <span>minutes</span>
        </div>
      </Field>
      <p className="info-note">
        Times use {data.user.timezone}. Moving this block never changes a
        habit’s recurrence or its occurrence date. Passing the end time will not
        mark it complete.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {conflicts.length > 0 && (
        <div className="conflict-preview">
          <strong>Overlaps or protected breaks</strong>
          <ul>
            {conflicts.map((title, index) => (
              <li key={index}>{title}</li>
            ))}
          </ul>
          <label>
            <input
              type="checkbox"
              checked={allow}
              onChange={(e) => setAllow(e.target.checked)}
            />
            I want to keep this overlap. Show it on my calendar.
          </label>
        </div>
      )}
      <div className="form-actions spread">
        {existing && (
          <Button
            type="button"
            variant="ghost"
            onClick={async () => {
              await mutate(
                "sessions/" + existing.id,
                "DELETE",
                undefined,
                "Session removed. The habit or task stays unresolved.",
              );
              setEditor(null);
            }}
          >
            Remove time block
          </Button>
        )}
        <Button busy={busy} type="submit">
          {target.sessionId ? "Update session" : "Schedule session"}
          <ArrowRight size={16} />
        </Button>
      </div>
    </form>
  );
}
function RecoveryEditor({ id }: { id: string }) {
  const { data, mutate, setEditor } = useApp(),
    o = data.occurrences.find((x) => x.id === id);
  const [choice, setChoice] = useState<"reschedule" | "shorten" | "skip">(
      "reschedule",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!o) return <p>Occurrence not found.</p>;
  const recent = data.occurrences.filter(
    (x) =>
      x.habitId === o.habitId &&
      x.localDate < data.today &&
      x.status === "pending",
  );
  return (
    <>
      <div className="recovery-intro">
        {data.user.preferences.companions && (
          <Character
            character="moss"
            state="recover"
            reduced={data.user.preferences.reducedMotion}
          />
        )}
        <div>
          <h3>{o.title}</h3>
          <p>
            From {prettyDate(o.localDate, { month: "long", day: "numeric" })}. A
            missed plan is information, not a verdict.
          </p>
        </div>
      </div>
      <div className="recovery-choices">
        {(
          [
            {
              id: "reschedule",
              label: "Find another time",
              description: `Keep the ${o.duration}-minute version.`,
            },
            ...(o.fallback
              ? [
                  {
                    id: "shorten",
                    label: "Try the smaller version",
                    description: `${o.fallback} minutes is still something.`,
                  },
                ]
              : []),
            {
              id: "skip",
              label: "Make this a rest day",
              description: "No XP; your streak pauses here.",
            },
          ] as { id: typeof choice; label: string; description: string }[]
        ).map((c) => (
          <button
            key={c.id}
            className={choice === c.id ? "active" : ""}
            onClick={() => setChoice(c.id)}
          >
            <span className="radio-dot" />
            <span>
              <strong>{c.label}</strong>
              <small>{c.description}</small>
            </span>
          </button>
        ))}
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = Object.fromEntries(new FormData(e.currentTarget));
          try {
            await mutate(
              "recover",
              "POST",
              {
                id,
                action: choice,
                ...(choice === "skip"
                  ? { reason: f.reason }
                  : {
                      start: localToUtc(
                        String(f.date),
                        String(f.time),
                        data.user.timezone,
                      ),
                    }),
              },
              choice === "skip"
                ? "Rest day recorded. No guilt attached."
                : "A fresh time for the same intention.",
            );
            setEditor(null);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not update.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {choice === "skip" ? (
          <Field label="A reason, if you’d like">
            <input
              name="reason"
              placeholder="Needed some breathing room"
              maxLength={200}
            />
          </Field>
        ) : (
          <div className="form-row">
            <Field label="New date">
              <input
                name="date"
                type="date"
                defaultValue={data.today}
                required
              />
            </Field>
            <Field label="New time">
              <input name="time" type="time" defaultValue="17:00" required />
            </Field>
          </div>
        )}
        <p className="info-note">
          Preview: only this occurrence changes.{" "}
          {choice === "skip"
            ? "Its unfinished blocks will be removed."
            : `Its unfinished blocks will be replaced by one ${choice === "shorten" ? o.fallback : o.duration}-minute session.`}{" "}
          Your recurring plan stays the same.
        </p>
        {recent.length >= 3 && (
          <p className="soft-suggestion">
            This time has been missed {recent.length} times. A different
            preferred window might fit your life better. You can edit it in
            Habits.
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions spread">
          <Button type="button" variant="ghost" onClick={() => setEditor(null)}>
            Leave unresolved
          </Button>
          <Button busy={busy} type="submit">
            <RotateCcw size={16} />
            Accept this change
          </Button>
        </div>
      </form>
    </>
  );
}
function PlanEditor() {
  const { data, mutate, setEditor } = useApp();
  const [plan, setPlan] = useState<Proposal | null>(data.proposals[0] ?? null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const p = await mutate<Proposal>("plan", "POST", {
        from: data.today,
        to: addDays(data.today, 6),
      });
      setPlan(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not plan.");
    } finally {
      setBusy(false);
    }
  };
  const accept = async (keys: string[]) => {
    if (!plan) return;
    setBusy(true);
    try {
      await mutate(
        "proposals/" + plan.id + "/accept",
        "POST",
        { keys },
        "Your choices are on the calendar.",
      );
      setPlan({
        ...plan,
        items: plan.items.map((x) =>
          keys.includes(x.key) && x.start ? { ...x, accepted: true } : x,
        ),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not accept.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <p className="modal-lead">
        Openings that respect your availability, breaks and priorities. Nothing
        changes until you accept.
      </p>
      <div className="plan-constraints">
        <span>
          <Clock3 size={15} />
          {data.user.preferences.breakMinutes}-minute breaks
        </span>
        <span>
          <Leaf size={15} />
          {data.user.preferences.dailyLimit
            ? data.user.preferences.dailyLimit / 60 + "h daily limit"
            : "No daily limit"}
        </span>
        <span>Next 7 days</span>
      </div>
      {!plan ? (
        <div className="plan-empty">
          <Sparkles size={32} />
          <h3>Let’s find the openings.</h3>
          <p>
            A deterministic planner, with explanations. No model or API key
            needed.
          </p>
          <Button onClick={() => void generate()} busy={busy}>
            Suggest a plan
            <ArrowRight size={16} />
          </Button>
        </div>
      ) : (
        <>
          <div className="plan-items">
            {plan.items.map((item) => (
              <div
                key={item.key}
                className={`plan-item ${!item.start ? "no-slot" : ""}`}
              >
                <span
                  className={`queue-type ${item.accepted ? "mint" : item.start ? "amber" : "coral"}`}
                >
                  {item.accepted ? <Check size={17} /> : <Clock3 size={17} />}
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <p>
                    {item.start
                      ? `${prettyDate(dateIn(item.start, data.user.timezone), { weekday: "short", month: "short", day: "numeric" })} · ${formatTime(item.start, data.user.timezone)}–${formatTime(item.end!, data.user.timezone)}`
                      : "No suitable opening"}
                  </p>
                  <small>{item.explanation}</small>
                  {item.start && !item.accepted && (
                    <details className="proposal-edit">
                      <summary>Adjust proposal</summary>
                      <form
                        className="proposal-edit-form"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const f = Object.fromEntries(
                            new FormData(e.currentTarget),
                          );
                          try {
                            const start = localToUtc(
                              String(f.date),
                              String(f.time),
                              data.user.timezone,
                            );
                            const changed = await mutate<Proposal>(
                              `proposals/${plan.id}`,
                              "PATCH",
                              {
                                key: item.key,
                                start,
                                end: plusMinutes(start, item.duration),
                              },
                            );
                            setPlan(changed);
                          } catch (e) {
                            setError(
                              e instanceof Error
                                ? e.message
                                : "Could not update proposal.",
                            );
                          }
                        }}
                      >
                        <input
                          aria-label={`Date for ${item.title}`}
                          name="date"
                          type="date"
                          defaultValue={dateIn(item.start, data.user.timezone)}
                          required
                        />
                        <input
                          aria-label={`Time for ${item.title}`}
                          name="time"
                          type="time"
                          defaultValue={timeIn(item.start, data.user.timezone)}
                          required
                        />
                        <Button variant="secondary" type="submit">
                          Preview
                        </Button>
                      </form>
                    </details>
                  )}
                </div>
                {item.start && !item.accepted && (
                  <Button
                    variant="secondary"
                    busy={busy}
                    onClick={() => void accept([item.key])}
                  >
                    Accept
                  </Button>
                )}
                {item.accepted && (
                  <span className="mint-text small">Scheduled</span>
                )}
              </div>
            ))}
          </div>
          {plan.items.length === 0 && (
            <p className="small-empty">
              Everything is already planned, or there are no items to schedule
              yet.
            </p>
          )}
          <div className="form-actions spread">
            <Button variant="ghost" onClick={() => void generate()} busy={busy}>
              <RotateCcw size={16} />
              Find fresh openings
            </Button>
            <Button
              onClick={() =>
                void accept(
                  plan.items
                    .filter((x) => x.start && !x.accepted)
                    .map((x) => x.key),
                )
              }
              busy={busy}
              disabled={!plan.items.some((x) => x.start && !x.accepted)}
            >
              <Check size={16} />
              Accept available slots
            </Button>
          </div>
          <button
            className="text-link"
            onClick={async () => {
              await mutate(
                "proposals/" + plan.id,
                "DELETE",
                undefined,
                "Plan dismissed. Your calendar is unchanged.",
              );
              setEditor(null);
            }}
          >
            Dismiss this proposal
          </button>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
function Notifications() {
  const { data, mutate } = useApp();
  useEffect(() => {
    void mutate("notifications", "PATCH", {}).catch(() => {});
  }, []);
  return (
    <div>
      {data.notifications.length ? (
        data.notifications.map((n) => (
          <div key={n.id} className="notification-row">
            <span className="notification-icon">
              <Clock3 size={17} />
            </span>
            <div>
              <strong>{n.title}</strong>
              <p>{n.body}</p>
              <small>{new Date(n.createdAt).toLocaleString()}</small>
            </div>
          </div>
        ))
      ) : (
        <div className="empty">
          <h3>All quiet here.</h3>
          <p>Session reminders will appear here when they’re due.</p>
        </div>
      )}
    </div>
  );
}
function AiEditor() {
  const { mutate, setEditor, data } = useApp(),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<{
      available: boolean;
      draft: {
        kind: "habit" | "task";
        title: string;
        duration: number;
        explanation: string;
      };
    } | null>(null);
  return (
    <>
      <p className="modal-lead">
        Describe something you’d like to do. You’ll review every detail before
        it becomes a habit or task.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            setResult(
              await mutate("ai", "POST", {
                intention: new FormData(e.currentTarget).get("intention"),
              }),
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Your intention">
          <textarea
            name="intention"
            required
            minLength={3}
            maxLength={600}
            rows={3}
            placeholder="I’d like to spend a little time sketching each week"
          />
        </Field>
        <Button busy={busy} type="submit">
          <Sparkles size={16} />
          Make a draft
        </Button>
      </form>
      {result && (
        <div className="ai-draft">
          <span className="eyebrow">
            {result.available
              ? "MODEL-ASSISTED DRAFT"
              : "SIMPLE DRAFT · NO AI REQUIRED"}
          </span>
          <h3>{result.draft.title}</h3>
          <p>
            {result.draft.duration} minutes · {result.draft.kind}
          </p>
          <p>{result.draft.explanation}</p>
          <Button
            variant="secondary"
            onClick={() =>
              setEditor({ type: result.draft.kind, draft: result.draft })
            }
          >
            Review the details
            <ArrowRight size={16} />
          </Button>
        </div>
      )}
      <p className="small muted">
        {data.user.preferences.aiEnabled && data.aiAvailable
          ? "Only this intention text is sent to the model endpoint configured by your administrator."
          : "AI is off or unavailable. A simple editable draft always works."}{" "}
        No model can save or rearrange your plan.
      </p>
    </>
  );
}
