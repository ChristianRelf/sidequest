"use client";
import { useState } from "react";
import Character from "./companion";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  Flag,
  Leaf,
  Pause,
  Play,
  Plus,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import { useApp } from "./context";
import { Button, Empty, Field, ProgressRing, Toggle } from "./ui";
import {
  addDays,
  dateIn,
  durationMinutes,
  prettyDate,
  weekOf,
  weekday,
} from "@/lib/time";
import { characterStates, type CharacterState } from "./character";
import { Brand } from "./sidequest";
const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];
export function Habits() {
  const { data, setEditor } = useApp(),
    [filter, setFilter] = useState("active");
  const visible = data.habits.filter((h) =>
    filter === "paused" ? h.archived : !h.archived,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="date-eyebrow">
            <Leaf size={15} />
            MAKE IT PART OF YOUR LIFE
          </div>
          <h1>
            Small things. <span>Lasting rhythms.</span>
          </h1>
          <p>Commitments that fit who you are, and who you’re becoming.</p>
        </div>
        <Button onClick={() => setEditor({ type: "habit" })}>
          <Plus size={17} />
          New habit
        </Button>
      </div>
      <div className="habits-intro">
        <div>
          <span className="eyebrow">CONSISTENCY, WITH KINDNESS</span>
          <h2>
            Keep the intention.
            <br />
            <span>Let the rhythm be human.</span>
          </h2>
          <p>
            A shorter version counts. Rest days belong. Your habits should make
            your life bigger.
          </p>
          <button
            className="text-link"
            onClick={() => setEditor({ type: "ai" })}
          >
            Start with an intention
            <Sparkles size={15} />
          </button>
        </div>
        {data.user.preferences.companions && (
          <div className="habits-character">
            <Character
              character="pip"
              state="idle"
              reduced={data.user.preferences.reducedMotion}
            />
            <span className="handwritten">A little goes a long way.</span>
          </div>
        )}
        <div className="habits-summary">
          <strong>
            {data.habits.filter((h) => !h.archived).length}
            <span>intentions in motion</span>
          </strong>
          <div />
          <strong>
            {
              data.occurrences.filter(
                (o) =>
                  o.status === "completed" &&
                  o.localDate >= addDays(data.today, -6) &&
                  o.localDate <= data.today,
              ).length
            }
            <span>small steps this week</span>
          </strong>
        </div>
      </div>
      <div className="list-toolbar">
        <div className="tabs">
          <button
            className={filter === "active" ? "active" : ""}
            onClick={() => setFilter("active")}
          >
            Active habits
            <span>{data.habits.filter((h) => !h.archived).length}</span>
          </button>
          <button
            className={filter === "paused" ? "active" : ""}
            onClick={() => setFilter("paused")}
          >
            Taking a pause
            <span>{data.habits.filter((h) => h.archived).length}</span>
          </button>
        </div>
        <span className="small muted">Your last 7 days</span>
      </div>
      <div className="habit-list">
        {visible.map((h) => {
          const rows = data.occurrences.filter((o) => o.habitId === h.id),
            streak = data.streaks[h.id] ?? 0;
          return (
            <button
              key={h.id}
              className="habit-row"
              onClick={() => setEditor({ type: "habit", id: h.id })}
            >
              <span className={`habit-emblem ${h.color}`}>
                <Leaf size={24} />
              </span>
              <span className="habit-row-title">
                <strong>{h.title}</strong>
                <small>
                  {h.duration} min ·{" "}
                  {h.recurrence.frequency === "daily"
                    ? h.recurrence.interval === 1
                      ? "Every day"
                      : `Every ${h.recurrence.interval} days`
                    : h.recurrence.frequency === "monthly"
                      ? `Day ${h.recurrence.monthDay} · Monthly`
                      : h.recurrence.days.length === 7
                        ? "Every day"
                        : h.recurrence.days
                            .map(
                              (d) =>
                                [
                                  "Mon",
                                  "Tue",
                                  "Wed",
                                  "Thu",
                                  "Fri",
                                  "Sat",
                                  "Sun",
                                ][d - 1],
                            )
                            .join(", ")}
                </small>
              </span>
              <span className="habit-window">
                <Clock3 size={14} />
                {h.preferredStart}–{h.preferredEnd}
                <small>Preferred window</small>
              </span>
              <span className="habit-week">
                {Array.from({ length: 7 }, (_, i) => {
                  const day = addDays(data.today, i - 6),
                    o = rows.find((o) => o.localDate === day);
                  return (
                    <span
                      key={day}
                      className={`habit-day ${o?.status ?? "rest"}`}
                      title={`${day}: ${o?.status ?? "rest day"}`}
                    >
                      <small>{dayLabels[weekday(day) - 1]}</small>
                      <span>
                        {o?.status === "completed" ? (
                          <Check size={13} />
                        ) : o?.status === "skipped" ? (
                          "—"
                        ) : o ? (
                          "·"
                        ) : (
                          ""
                        )}
                      </span>
                    </span>
                  );
                })}
              </span>
              {data.user.preferences.streaks &&
                data.user.preferences.gamification && (
                  <span className="streak-count">
                    <span>
                      <Zap size={14} />
                      {streak}
                    </span>
                    <small>in rhythm</small>
                  </span>
                )}
              <ChevronRight size={18} className="muted" />
            </button>
          );
        })}
        {!visible.length && (
          <Empty
            title={
              filter === "paused"
                ? "Nothing taking a pause."
                : "Start with one small thing."
            }
            description={
              filter === "paused"
                ? "Paused habits keep all their history."
                : "A walk, a few pages, a little practice. Give it a rhythm."
            }
            action={
              filter === "active" ? (
                <Button onClick={() => setEditor({ type: "habit" })}>
                  <Plus size={16} />
                  Create your first habit
                </Button>
              ) : undefined
            }
          />
        )}
      </div>
      <div className="metric-definition">
        <Leaf size={17} />
        <p>
          <strong>What counts as a streak?</strong> Completed eligible
          occurrences in sequence. Rest days and explicit skips are neutral. A
          past unresolved occurrence ends the streak. Today has until the end of
          its local day.
        </p>
      </div>
    </>
  );
}
export function Tasks() {
  const { data, setEditor, mutate, celebrate } = useApp(),
    [filter, setFilter] = useState("all"),
    [busy, setBusy] = useState("");
  const tasks = data.tasks.filter((t) =>
    filter === "done"
      ? t.status === "done"
      : t.status !== "done" &&
        (filter === "all" ||
          (filter === "inbox" && !t.projectId) ||
          t.projectId === filter),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="date-eyebrow">
            <Flag size={15} />
            LESS IN YOUR HEAD. MORE IN YOUR DAY.
          </div>
          <h1>
            One thing <span>at a time.</span>
          </h1>
          <p>A place for the things you want to move forward.</p>
        </div>
        <Button onClick={() => setEditor({ type: "task" })}>
          <Plus size={17} />
          New task
        </Button>
      </div>
      <div className="tasks-layout">
        <aside className="project-nav">
          <span className="eyebrow">YOUR TASKS</span>
          {[
            { id: "all", name: "All open tasks", icon: Flag },
            { id: "inbox", name: "Inbox", icon: Target },
            { id: "done", name: "Completed", icon: Check },
          ].map((n) => (
            <button
              key={n.id}
              className={filter === n.id ? "active" : ""}
              onClick={() => setFilter(n.id)}
            >
              <n.icon size={17} />
              {n.name}
              <span>
                {
                  data.tasks.filter((t) =>
                    n.id === "done"
                      ? t.status === "done"
                      : t.status !== "done" && (n.id === "all" || !t.projectId),
                  ).length
                }
              </span>
            </button>
          ))}
          <div className="project-nav-title">
            <span className="eyebrow">PROJECTS</span>
          </div>
          {data.projects.map((p) => (
            <button
              key={p.id}
              className={filter === p.id ? "active" : ""}
              onClick={() => setFilter(p.id)}
            >
              <span className={`legend-dot ${p.color}`} />
              {p.name}
              <span>
                {
                  data.tasks.filter(
                    (t) => t.projectId === p.id && t.status !== "done",
                  ).length
                }
              </span>
            </button>
          ))}
          <p className="small muted project-help">
            Create a project from any task’s details.
          </p>
          <div className="task-note">
            <span>↗</span>
            <p>
              “Done” is a decision.
              <br />
              Not a deadline passing.
            </p>
          </div>
        </aside>
        <section className="task-list">
          <div className="task-list-heading">
            <h2>
              {filter === "all"
                ? "Everything in motion"
                : filter === "inbox"
                  ? "The inbox"
                  : filter === "done"
                    ? "A few things behind you"
                    : data.projects.find((p) => p.id === filter)?.name}
              <span className="count-badge">{tasks.length}</span>
            </h2>
            <span className="small muted">Due date · Estimate</span>
          </div>
          {tasks
            .sort(
              (a, b) =>
                a.priority - b.priority ||
                (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"),
            )
            .map((task) => {
              const sessions = data.sessions.filter(
                  (s) => s.taskId === task.id,
                ),
                sub = data.subtasks.filter((s) => s.taskId === task.id),
                planned = sessions.reduce(
                  (n, s) => n + durationMinutes(s.start, s.end),
                  0,
                );
              return (
                <div
                  className={`task-row ${task.status === "done" ? "completed" : ""}`}
                  key={task.id}
                >
                  <button
                    className={`task-check ${task.status === "done" ? "checked" : ""}`}
                    aria-label={`Finish task ${task.title}`}
                    disabled={task.status === "done" || busy === task.id}
                    onClick={async () => {
                      setBusy(task.id);
                      try {
                        await mutate(
                          "complete",
                          "POST",
                          { kind: "task", id: task.id },
                          "Task completed. A little more space in your head.",
                        );
                        celebrate();
                      } catch {
                      } finally {
                        setBusy("");
                      }
                    }}
                  >
                    {task.status === "done" && <Check size={15} />}
                  </button>
                  <button
                    className="task-main"
                    onClick={() => setEditor({ type: "task", id: task.id })}
                  >
                    <strong>{task.title}</strong>
                    <span>
                      {task.projectId && (
                        <small className="project-tag">
                          {
                            data.projects.find((p) => p.id === task.projectId)
                              ?.name
                          }
                        </small>
                      )}
                      {sub.length > 0 && (
                        <small>
                          {sub.filter((s) => s.done).length}/{sub.length} steps
                        </small>
                      )}
                      <small>
                        {planned
                          ? `${planned} min across ${sessions.length} session${sessions.length === 1 ? "" : "s"}`
                          : "Looking for a time"}
                      </small>
                    </span>
                  </button>
                  <span className={`priority-tag priority-${task.priority}`}>
                    {task.priority === 1
                      ? "High"
                      : task.priority === 2
                        ? "Normal"
                        : "Low"}
                  </span>
                  <span
                    className={`task-due ${task.dueDate && task.dueDate < data.today && task.status !== "done" ? "coral-text" : ""}`}
                  >
                    {task.dueDate
                      ? prettyDate(task.dueDate, {
                          month: "short",
                          day: "numeric",
                        })
                      : "No due date"}
                    <small>{task.estimate} min estimate</small>
                  </span>
                  {task.status !== "done" && (
                    <button
                      className="schedule-task"
                      aria-label={`Schedule ${task.title}`}
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
                      <Plus size={17} />
                      <span>Schedule</span>
                    </button>
                  )}
                </div>
              );
            })}
          {!tasks.length && (
            <Empty
              title={
                filter === "done"
                  ? "Your small wins will live here."
                  : "A little space in your head."
              }
              description="Add something you’d like to move forward, then give it time on your calendar."
              action={
                <Button
                  variant="secondary"
                  onClick={() => setEditor({ type: "task" })}
                >
                  <Plus size={16} />
                  Add a task
                </Button>
              }
            />
          )}
          <button
            className="add-task-row"
            onClick={() => setEditor({ type: "task" })}
          >
            <Plus size={17} />
            Add a little something
          </button>
        </section>
      </div>
    </>
  );
}
export function Progress() {
  const { data } = useApp(),
    [offset, setOffset] = useState(0),
    start = addDays(
      weekOf(data.today, data.user.preferences.weekStart),
      offset * 7,
    ),
    days = Array.from({ length: 7 }, (_, i) => addDays(start, i)),
    prefs = data.user.preferences;
  const blocks = data.sessions.filter(
      (s) =>
        s.kind !== "fixed" &&
        days.includes(dateIn(s.start, data.user.timezone)),
    ),
    done = blocks.filter((s) => s.status === "done"),
    events = data.completions.filter((e) => days.includes(e.localDate));
  const plannedMinutes = blocks.reduce(
      (n, s) => n + durationMinutes(s.start, s.end),
      0,
    ),
    minutes = events.reduce((n, e) => n + e.minutes, 0),
    max = Math.max(
      60,
      ...days.map((day) =>
        blocks
          .filter((s) => dateIn(s.start, data.user.timezone) === day)
          .reduce((n, s) => n + durationMinutes(s.start, s.end), 0),
      ),
    );
  const counts = days.map((day) => ({
    day,
    planned: blocks
      .filter((s) => dateIn(s.start, data.user.timezone) === day)
      .reduce((n, s) => n + durationMinutes(s.start, s.end), 0),
    completed: blocks
      .filter(
        (s) =>
          dateIn(s.start, data.user.timezone) === day && s.status === "done",
      )
      .reduce((n, s) => n + durationMinutes(s.start, s.end), 0),
  }));
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="date-eyebrow">
            <Sparkles size={15} />
            LOOK HOW FAR THE LITTLE THINGS GO
          </div>
          <h1>
            Progress, <span>not perfection.</span>
          </h1>
          <p>A little perspective on where your time and energy went.</p>
        </div>
        <div className="recap-nav">
          <Button variant="secondary" onClick={() => setOffset(offset - 1)}>
            ←
          </Button>
          <span>
            {offset === 0
              ? "This week"
              : prettyDate(start, { month: "short", day: "numeric" })}
          </span>
          <Button
            variant="secondary"
            onClick={() => setOffset(Math.min(0, offset + 1))}
            disabled={offset === 0}
          >
            →
          </Button>
        </div>
      </div>
      <section className="recap-hero">
        <div>
          <span className="eyebrow">YOUR WEEKLY FIELD NOTES</span>
          <h2>
            {done.length
              ? "You made time for yourself."
              : "A fresh page is still progress."}
          </h2>
          <p>
            {done.length
              ? `${done.length} sessions completed. ${minutes} minutes of recorded effort. Every one was a choice to show up.`
              : "Your completed sessions will tell the story here. Begin with a plan that feels possible."}
          </p>
          {prefs.humour && (
            <span className="recap-aside">
              {done.length
                ? "The to-do list remains undefeated. You did make a dent, though."
                : "No dramatic montage required. A small start will do."}
            </span>
          )}
        </div>
        {prefs.companions && (
          <Character
            character="zip"
            state="idle"
            reduced={prefs.reducedMotion}
          />
        )}
      </section>
      <section className="weekly-chart-section">
        <div className="section-heading">
          <div>
            <h2>The shape of your week</h2>
            <p>Planned time and completed sessions, side by side.</p>
          </div>
          <div className="chart-legend">
            <span>
              <i className="planned" />
              Planned
            </span>
            <span>
              <i className="complete" />
              Completed
            </span>
          </div>
        </div>
        <div
          className="weekly-chart"
          role="img"
          aria-label={counts
            .map(
              (c) =>
                `${prettyDate(c.day, { weekday: "long" })}: ${c.planned} minutes planned, ${c.completed} completed`,
            )
            .join("; ")}
        >
          <div className="chart-y">
            <span>{Math.ceil(max / 60)}h</span>
            <span>{Math.ceil(max / 60) / 2}h</span>
            <span>0</span>
          </div>
          <div className="chart-plot">
            {counts.map((c) => (
              <div
                className={`chart-column ${c.day === data.today ? "today" : ""}`}
                key={c.day}
              >
                <div className="bar-pair">
                  <div
                    className="chart-bar planned"
                    style={{ height: `${(c.planned / max) * 100}%` }}
                    title={`${c.planned} minutes planned`}
                  />
                  <div
                    className="chart-bar complete"
                    style={{ height: `${(c.completed / max) * 100}%` }}
                    title={`${c.completed} minutes completed`}
                  />
                </div>
                <span>{prettyDate(c.day, { weekday: "short" })}</span>
                <small>{Number(c.day.slice(8))}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="chart-stats">
          <div>
            <strong>
              {done.length}
              <span> / {blocks.length}</span>
            </strong>
            <p>sessions completed</p>
          </div>
          <div>
            <strong>
              {Math.floor(minutes / 60)}
              <span>h</span> {minutes % 60}
              <span>m</span>
            </strong>
            <p>recorded effort</p>
          </div>
          <div>
            <strong>{events.filter((e) => e.kind === "task").length}</strong>
            <p>tasks put to bed</p>
          </div>
          <div>
            <strong>
              {blocks.length
                ? Math.round((done.length / blocks.length) * 100)
                : 0}
              <span>%</span>
            </strong>
            <p>of your plan completed</p>
          </div>
        </div>
      </section>
      <div className="progress-bottom">
        <section>
          <span className="eyebrow">A RHYTHM THAT FITS</span>
          <h2>Small commitments, kept.</h2>
          {data.habits
            .filter((h) => !h.archived)
            .slice(0, 5)
            .map((h) => {
              const eligible = data.occurrences.filter(
                  (o) => o.habitId === h.id && days.includes(o.localDate),
                ),
                completed = eligible.filter(
                  (o) => o.status === "completed",
                ).length;
              return (
                <div className="habit-progress-row" key={h.id}>
                  <span className={`queue-type ${h.color}`}>
                    <Leaf size={16} />
                  </span>
                  <span>{h.title}</span>
                  <div className="mini-track">
                    <i
                      style={{
                        width: `${eligible.length ? (completed / eligible.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <strong>
                    {completed}/{eligible.length}
                  </strong>
                </div>
              );
            })}
          <p className="metric-foot">
            Completion is recorded by you, never inferred from elapsed time.
            Explicit skips are excluded from streaks; they remain visible in
            planned counts.
          </p>
        </section>
        {prefs.gamification && (
          <section className="reward-panel">
            <span className="eyebrow">A SMALL NOD TO YOUR EFFORT</span>
            {prefs.xp && (
              <>
                <div className="reward-title">
                  <span>
                    <Zap size={24} />
                  </span>
                  <h2>
                    Level {Math.floor(data.xp / 200) + 1}
                    <small>{data.xp} lifetime XP</small>
                  </h2>
                </div>
                <div className="xp-track">
                  <span style={{ width: `${(data.xp % 200) / 2}%` }} />
                </div>
                <p>{200 - (data.xp % 200)} XP to your next little milestone.</p>
              </>
            )}
            {prefs.achievements && [{key:'first-step',title:'The first small step',description:'Complete your first habit occurrence or task.'},{key:'ten-intentions',title:'A little momentum',description:'Complete ten intentions, at your own pace.'},{key:'room-in-the-week',title:'Room in the week',description:'Complete an intention on five distinct days in a week.'}].map(achievement=><div className="achievement" key={achievement.key}><span className={data.earnedAchievements.includes(achievement.key)?'unlocked':''}><Trophy size={22}/></span><div><strong>{achievement.title}{data.earnedAchievements.includes(achievement.key)?' · Earned':''}</strong><p>{achievement.description}</p></div></div>)}
            <p className="metric-foot">
              {prefs.xpHabit} XP per completed habit occurrence, {prefs.xpTask}{" "}
              per completed task, for up to five tasks per local day. Sessions don’t earn extra XP. No lost points
              for rest.
            </p>
          </section>
        )}
      </div>
    </>
  );
}
export function Gallery() {
  const { data } = useApp(),
    [state, setState] = useState<CharacterState>("idle"),
    [event, setEvent] = useState(0),
    [paused, setPaused] = useState(false),
    [reduced, setReduced] = useState(data.user.preferences.reducedMotion);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="date-eyebrow">THE SMALL WORLD OF SIDEQUEST</div>
          <h1>
            A little company <span>along the way.</span>
          </h1>
          <p>Three companions. Their own rhythm. Always room for yours.</p>
        </div>
      </div>
      <div className="gallery-controls">
        <div className="state-buttons">
          {characterStates.map((s) => (
            <button
              key={s}
              className={state === s ? "active" : ""}
              onClick={() => {
                setState(s);
                setEvent((x) => x + 1);
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <Button variant="secondary" onClick={() => setPaused(!paused)}>
          {paused ? <Play size={16} /> : <Pause size={16} />}{" "}
          {paused ? "Resume" : "Pause"}
        </Button>
        <label className="inline-checkbox">
          <input
            type="checkbox"
            checked={reduced}
            onChange={(e) => setReduced(e.target.checked)}
          />
          Reduced motion
        </label>
      </div>
      <div className="character-gallery">
        {(
          [
            {
              name: "pip",
              title: "Pip",
              role: "The pathfinder",
              copy: "Quietly curious. Believes a little forward motion is enough.",
              className: "lavender",
            },
            {
              name: "zip",
              title: "Zip",
              role: "The momentum keeper",
              copy: "Enthusiastic about the next step. Also knows when to stop.",
              className: "mint",
            },
            {
              name: "moss",
              title: "Moss",
              role: "The recovery companion",
              copy: "Patient, practical, and exceptionally good at sitting.",
              className: "coral",
            },
          ] as const
        ).map((c) => (
          <section className={`character-card ${c.className}`} key={c.name}>
            <span className="eyebrow">{c.role}</span>
            <div className="gallery-stage">
              <Character
                character={c.name}
                state={state}
                event={event}
                reduced={reduced}
                paused={paused}
              />
              <div className="stage-line" />
            </div>
            <h2>
              {c.title}
              <span>↗</span>
            </h2>
            <p>{c.copy}</p>
            <span className="character-state-label">
              {paused ? "Paused" : reduced ? "Reduced motion" : state}
            </span>
          </section>
        ))}
      </div>
      <div className="gallery-notes">
        <h3>Small performances. A real purpose.</h3>
        <p>
          Body, face, limbs and props move independently. Every new cue
          interrupts the last one. Hidden scenes pause, and reduced motion keeps
          the meaning without the travel. You can hide all companions in
          Settings.
        </p>
        <p className="small muted">
          This gallery holds a pose for review. In the app, short performances
          settle back into idle.
        </p>
      </div>
    </>
  );
}
export function Onboarding({ onDone }: { onDone: () => void }) {
  const { data, mutate, setEditor } = useApp(),
    [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [intro, setIntro] = useState(true),
    [zone, setZone] = useState(data.user.timezone);
  const hasHabit = data.habits.length > 0,
    first = data.habits[0],
    occurrence = data.occurrences.find(
      (o) => o.habitId === first?.id && o.status === "pending",
    ),
    hasSession = data.sessions.some((s) => s.kind === "habit");
  const finish = async () => {
    await mutate(
      "settings",
      "PATCH",
      { preferences: { onboardingDone: true } },
      "Your little corner is ready.",
    );
    onDone();
  };
  return (
    <div className="onboarding">
      <header>
        <Brand />
        <button className="text-link" onClick={() => void finish()}>
          Set up later
          <ArrowRight size={16} />
        </button>
      </header>
      <div className="onboarding-layout">
        <section className="onboarding-copy">
          <div className="onboarding-steps">
            {["Your rhythm", "One intention", "A little time"].map((s, i) => (
              <span
                className={step === i ? "active" : step > i ? "done" : ""}
                key={s}
              >
                {step > i ? <Check size={13} /> : i + 1}
                <small>{s}</small>
              </span>
            ))}
          </div>
          <span className="eyebrow">
            WELCOME, {data.user.name.toUpperCase()}
          </span>
          <h1>
            {step === 0 ? (
              <>
                A plan that fits
                <br />
                <span>your real life.</span>
              </>
            ) : step === 1 ? (
              <>
                Start with
                <br />
                <span>one small thing.</span>
              </>
            ) : (
              <>
                Good intentions
                <br />
                <span>deserve a time.</span>
              </>
            )}
          </h1>
          <p>
            {step === 0
              ? "Tell us when your day has room. Everything here can change as life does."
              : step === 1
                ? "Choose something you’d like to make part of your life. Small and specific is a good place to start."
                : "Give your first habit a place on the calendar. The plan is always yours to adjust."}
          </p>
          {step === 0 ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                const f = Object.fromEntries(new FormData(e.currentTarget));
                try {
                  await mutate("settings", "PATCH", {
                    timezone: zone,
                    availability: [1, 2, 3, 4, 5, 6, 7].map((day) => ({
                      day,
                      start: f.start,
                      end: f.end,
                    })),
                  });
                  setStep(1);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field label="Your timezone">
                <input
                  list="timezones"
                  required
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                />
                <datalist id="timezones">
                  {Intl.supportedValuesOf("timeZone").map((z) => (
                    <option key={z} value={z} />
                  ))}
                </datalist>
              </Field>
              <div className="form-row">
                <Field label="Usually available from">
                  <input
                    type="time"
                    name="start"
                    defaultValue="08:00"
                    required
                  />
                </Field>
                <Field label="Until">
                  <input type="time" name="end" defaultValue="20:00" required />
                </Field>
              </div>
              <p className="small muted">
                Start with a daily window. Fine-tune individual days and
                repeating commitments in Settings.
              </p>
              <Button type="submit" busy={busy}>
                Find my rhythm
                <ArrowRight size={17} />
              </Button>
            </form>
          ) : step === 1 ? (
            <div className="onboarding-action">
              {hasHabit ? (
                <>
                  <div className="onboard-item">
                    <span className="queue-type mint">
                      <Check size={20} />
                    </span>
                    <span>
                      <strong>{first.title}</strong>
                      <small>{first.duration} minutes · Your first habit</small>
                    </span>
                  </div>
                  <Button onClick={() => setStep(2)}>
                    Give it a time
                    <ArrowRight size={17} />
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={() => setEditor({ type: "habit" })}>
                    <Plus size={17} />
                    Create my first habit
                  </Button>
                  <button
                    className="text-link"
                    onClick={() =>
                      setEditor({
                        type: "habit",
                        draft: { title: "Read a few pages", duration: 20 },
                      })
                    }
                  >
                    Try “Read a few pages”
                    <ArrowUpRight size={15} />
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="onboarding-action">
              {hasSession ? (
                <>
                  <div className="onboard-item">
                    <span className="queue-type mint">
                      <Check size={20} />
                    </span>
                    <span>
                      <strong>One intention, with a time.</strong>
                      <small>Your first session is on the calendar.</small>
                    </span>
                  </div>
                  <Button onClick={() => void finish()}>
                    Let’s begin
                    <ArrowRight size={17} />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    disabled={!occurrence}
                    onClick={() =>
                      setEditor({
                        type: "schedule",
                        target: {
                          occurrenceId: occurrence?.id,
                          title: first?.title ?? "",
                          duration: first?.duration ?? 20,
                          date: occurrence?.localDate,
                        },
                      })
                    }
                  >
                    <Clock3 size={17} />
                    Schedule my first session
                  </Button>
                  <button className="text-link" onClick={() => void finish()}>
                    I’ll find a time later
                  </button>
                </>
              )}
            </div>
          )}
        </section>
        <section className="onboarding-world">
          <span className="world-bubble">
            {step === 0
              ? "We’ll figure it out as we go."
              : step === 1
                ? "That sounds like a good start."
                : "Look at that. A little room."}
          </span>
          {intro && data.user.preferences.companions ? (
            <Character
              state={step === 2 ? "celebrate" : "travel"}
              event={step}
              reduced={data.user.preferences.reducedMotion}
            />
          ) : (
            <div className="onboard-symbol">↗</div>
          )}
          <svg viewBox="0 0 480 180" aria-hidden="true">
            <path
              d="M40 139c62 0 75-68 128-68s50 56 114 49 65-28 151-17"
              stroke="var(--world-line)"
              strokeDasharray="3 6"
              fill="none"
            />
            <path
              d="M88 135h287v20H88zm44-22h194v22H132zm41-20h111v20H173z"
              fill="var(--world-step)"
              stroke="var(--world-line)"
            />
            <path
              d="m72 155-8-28m8 18 12-12m302 24 6-26m-5 14-8-10"
              stroke="var(--world-line)"
              strokeWidth="2"
            />
          </svg>
          <div className="onboarding-character-note">
            <strong>Meet Pip.</strong>
            <p>
              A little companion for the little things.
              <br />
              Always optional. Never in your way.
            </p>
            {intro && (
              <button className="text-link" onClick={() => setIntro(false)}>
                Skip the introduction
              </button>
            )}
          </div>
        </section>
      </div>
      <footer>YOUR TIME. YOUR PACE. YOUR OWN ADVENTURE.</footer>
    </div>
  );
}
