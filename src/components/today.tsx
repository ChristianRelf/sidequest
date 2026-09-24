"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Character from "./companion";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  Flag,
  Leaf,
  LockKeyhole,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Sparkles,
  Sun,
} from "lucide-react";
import { useApp } from "./context";
import { Button, Empty, IconButton, ProgressRing } from "./ui";
import { dateIn, durationMinutes, formatTime, prettyDate } from "@/lib/time";
import type { Session } from "@/lib/types";
import type { CharacterState } from "./character";
export function Today({ event }: { event: number }) {
  const { data, setEditor, mutate, celebrate } = useApp();
  const { today } = data,
    zone = data.user.timezone,
    prefs = data.user.preferences;
  const [pose, setPose] = useState<CharacterState>("idle"),
    [now, setNow] = useState(Date.now()),
    [busy, setBusy] = useState(""),
    [group, setGroup] = useState(false);
  useEffect(()=>{const key=`sidequest:entered:${data.user.id}:${today}`;try{if(!sessionStorage.getItem(key)){setPose('travel');sessionStorage.setItem(key,'1');}}catch{setPose('travel');}},[data.user.id,today]);
  useEffect(() => {
    if (event) {
      setPose("celebrate");
      setGroup(false);
    }
  }, [event]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const sessions = data.sessions
    .filter((s) => dateIn(s.start, zone) === today)
    .sort((a, b) => a.start.localeCompare(b.start));
  const flexible = sessions.filter((s) => s.kind !== "fixed"),
    done = flexible.filter((s) => s.status === "done").length;
  const next = flexible.find(
    (s) => s.status === "scheduled" && +new Date(s.end) >= now,
  );
  const unresolved = data.occurrences.filter(
    (o) =>
      o.status === "pending" &&
      o.localDate <= dateIn(new Date(now).toISOString(), o.timezone) &&
      !data.habits.find((h) => h.id === o.habitId)?.archived,
  );
  const missed = unresolved.filter(
    (o) =>
      o.localDate < dateIn(new Date(now).toISOString(), o.timezone) ||
      data.sessions.some(
        (s) =>
          s.occurrenceId === o.id &&
          s.status === "scheduled" &&
          +new Date(s.end) < now,
      ),
  );
  const unplanned = data.tasks.filter(
    (t) =>
      t.status !== "done" &&
      !data.sessions.some((s) => s.taskId === t.id && s.status === "scheduled"),
  );
  const unplannedHabits = unresolved.filter(
    (o) =>
      o.localDate === dateIn(new Date(now).toISOString(), o.timezone) &&
      !data.sessions.some((s) => s.occurrenceId === o.id),
  );
  const completeSession = async (s: Session) => {
    setBusy(s.id);
    try {
      await mutate(
        "complete",
        "POST",
        { kind: "session", id: s.id },
        s.kind === "task"
          ? "Session finished. Your task stays open until you finish it."
          : "A little progress, recorded.",
      );
      celebrate();
      if (done + 1 === flexible.length && flexible.length > 0) setGroup(true);
    } catch {
    } finally {
      setBusy("");
    }
  };
  const plannedMinutes = flexible.reduce(
    (sum, s) => sum + durationMinutes(s.start, s.end),
    0,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="date-eyebrow">
            <span className="live-dot" />
            {prettyDate(today)}
            <span className="timezone-tag">
              {zone.split("/").pop()?.replaceAll("_", " ")}
            </span>
          </div>
          <h1>
            A little progress, <span>every day.</span>
          </h1>
          <p>You don’t need to do it all. Just make room for what matters.</p>
        </div>
        <Button onClick={() => setEditor({ type: "task" })}>
          <Plus size={18} />
          Quick add<span className="button-key">N</span>
        </Button>
      </div>
      <div className="today-overview">
        <section className="next-session">
          <div className="next-copy">
            <span className="eyebrow">
              <span className="live-dot" />
              {next ? "UP NEXT" : "A LITTLE BREATHING ROOM"}
            </span>
            <div className="next-time">
              {next ? (
                <>
                  {formatTime(next.start, zone)}{" "}
                  <span>— {formatTime(next.end, zone)}</span>
                </>
              ) : (
                <>
                  Your time, <span>your call.</span>
                </>
              )}
            </div>
            <h2>
              {next?.title ??
                (done && done === flexible.length
                  ? "Look at you. A day well spent."
                  : "What will you make room for?")}
            </h2>
            <p>
              {next ? (
                <>
                  <span className={`inline-type ${next.color}`}>
                    {next.kind === "habit" ? (
                      <Leaf size={14} />
                    ) : (
                      <Flag size={14} />
                    )}{" "}
                    {next.kind === "habit" ? "Personal habit" : "One-off task"}
                  </span>
                  <span className="tiny-separator" />{" "}
                  {durationMinutes(next.start, next.end)} min · One small
                  commitment
                </>
              ) : (
                "Start with something small. A habit, a task, or a well-earned pause."
              )}
            </p>
            <div className="next-buttons">
              {next ? (
                <>
                  <Button
                    onClick={() => void completeSession(next)}
                    busy={busy === next.id}
                  >
                    <Check size={17} />
                    Complete session
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setEditor({
                        type: "schedule",
                        target: {
                          sessionId: next.id,
                          occurrenceId: next.occurrenceId ?? undefined,
                          taskId: next.taskId ?? undefined,
                          title: next.title,
                          duration: durationMinutes(next.start, next.end),
                          date: dateIn(next.start, zone),
                          time: formatTime(next.start, zone),
                        },
                      })
                    }
                  >
                    Adjust time
                    <ArrowUpRight size={16} />
                  </Button>
                </>
              ) : (
                <Button onClick={() => setEditor({ type: "plan" })}>
                  <Sparkles size={17} />
                  Find a little time
                </Button>
              )}
            </div>
          </div>
          {prefs.companions && (
            <div className="hero-world" aria-label="Pip’s quiet corner">
              <svg
                className="world-drawing"
                viewBox="0 0 300 240"
                aria-hidden="true"
              >
                <circle cx="205" cy="55" r="24" fill="var(--world-sun)" />
                <path d="M195 38h0" />
                <path
                  d="M31 160c40-30 43-25 81-15s45-49 86-38 59 24 99 3"
                  stroke="var(--world-line)"
                  strokeWidth="1.5"
                  strokeDasharray="3 6"
                  fill="none"
                />
                <path d="m53 139 4-8 4 8-4 8Z" fill="var(--world-sun)" />
                <path
                  d="m257 76 4-8 4 8-4 8Z"
                  fill="var(--accent)"
                  opacity=".5"
                />
                <path
                  d="M54 211H262M87 215v11m150-12v10"
                  stroke="var(--world-line)"
                  strokeWidth="1.5"
                />
                <path
                  d="M69 209v-19h151v19M94 190v-15h106v15"
                  fill="var(--world-step)"
                  stroke="var(--world-line)"
                  strokeWidth="1.5"
                />
                <path
                  d="m47 209-3-12m3 9 8-8m195 12 5-14m-4 9-7-7"
                  stroke="var(--world-line)"
                  strokeWidth="2"
                />
                <path d="M41 75h15m-8-7v15" stroke="var(--world-line)" />
                <path d="M167 30h10m-5-5v10" stroke="var(--world-line)" />
              </svg>
              <Character
                state={pose}
                event={event}
                reduced={prefs.reducedMotion}
                onSettled={() => setPose("idle")}
              />
              <span className="world-bubble">One thing at a time.</span>
            </div>
          )}
        </section>
        <section className="day-meter">
          <span className="eyebrow">TODAY, SO FAR</span>
          <div className="meter-main">
            <div className="ring-wrapper">
              <ProgressRing
                value={flexible.length ? (done / flexible.length) * 100 : 0}
                size={88}
              />
              <span>
                {done}
                <small>/{flexible.length}</small>
              </span>
            </div>
            <div>
              <strong>
                {done === 0
                  ? "A fresh start."
                  : done === flexible.length
                    ? "Nicely done."
                    : "You’re on your way."}
              </strong>
              <p>
                {done} of {flexible.length} sessions complete
              </p>
            </div>
          </div>
          <div className="meter-footer">
            <span>
              <Clock3 size={15} />
              {plannedMinutes >= 60
                ? `${Math.floor(plannedMinutes / 60)}h ${plannedMinutes % 60 ? (plannedMinutes % 60) + "m" : ""}`
                : `${plannedMinutes}m`}{" "}
              planned
            </span>
            <span className="mint-text">
              Room to breathe
              <Leaf size={14} />
            </span>
          </div>
        </section>
      </div>
      <div className="today-columns">
        <section className="agenda-section">
          <div className="section-heading">
            <div>
              <h2>
                Your day<span className="count-badge">{sessions.length}</span>
              </h2>
              <p>A plan, not a promise. Adjust as you go.</p>
            </div>
            <Link href="/week" className="text-link">
              Open week
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="agenda-list">
            {sessions.length === 0 ? (
              <Empty
                title="A little space to begin."
                description="Schedule your first habit or task. Your day will take shape here."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => setEditor({ type: "plan" })}
                  >
                    Plan my day
                    <ArrowRight size={16} />
                  </Button>
                }
              />
            ) : (
              sessions.map((session, index) => {
                const isNext = session.id === next?.id,
                  isMissed =
                    session.status === "scheduled" &&
                    session.kind !== "fixed" &&
                    +new Date(session.end) < now;
                const conflict = sessions.some(
                  (s) =>
                    s.id !== session.id &&
                    +new Date(s.start) < +new Date(session.end) &&
                    +new Date(s.end) > +new Date(session.start),
                );
                return (
                  <div
                    key={session.id}
                    className={`agenda-row ${session.status === "done" ? "completed" : ""} ${isNext ? "is-next" : ""}`}
                  >
                    <div className="agenda-time">
                      {formatTime(session.start, zone)}
                      <span>{formatTime(session.end, zone)}</span>
                    </div>
                    <div className="timeline-rail">
                      <span
                        className={session.status === "done" ? "filled" : ""}
                      >
                        {session.status === "done" ? <Check size={10} /> : null}
                      </span>
                      {index < sessions.length - 1 && <i />}
                    </div>
                    <div className={`agenda-block ${session.color}`}>
                      <span className="agenda-icon">
                        {session.kind === "fixed" ? (
                          <LockKeyhole size={18} />
                        ) : session.kind === "habit" ? (
                          <Leaf size={19} />
                        ) : (
                          <Flag size={18} />
                        )}
                      </span>
                      <button
                        className="agenda-title"
                        onClick={() =>
                          session.kind === "fixed"
                            ? undefined
                            : setEditor(
                                session.kind === "habit"
                                  ? {
                                      type: "habit",
                                      id: data.occurrences.find(
                                        (o) => o.id === session.occurrenceId,
                                      )?.habitId,
                                    }
                                  : { type: "task", id: session.taskId! },
                              )
                        }
                      >
                        <strong>{session.title}</strong>
                        <small>
                          {session.kind === "fixed"
                            ? "Fixed commitment"
                            : session.kind === "habit"
                              ? "Habit"
                              : "Task session"}
                          <span>·</span>
                          {durationMinutes(session.start, session.end)} min{" "}
                          {conflict && <b className="coral-text"> · Overlap</b>}
                        </small>
                      </button>
                      {isNext && <span className="up-next-label">UP NEXT</span>}
                      {session.status === "done" ? (
                        <span className="done-mark">
                          <Check size={17} />
                          <span>Done</span>
                        </span>
                      ) : session.kind === "fixed" ? (
                        <LockKeyhole size={14} className="muted" />
                      ) : isMissed ? (
                        <Button
                          variant="ghost"
                          onClick={() =>
                            session.occurrenceId
                              ? setEditor({
                                  type: "recovery",
                                  id: session.occurrenceId!,
                                })
                              : setEditor({
                                  type: "schedule",
                                  target: {
                                    sessionId: session.id,
                                    taskId: session.taskId!,
                                    title: session.title,
                                    duration: durationMinutes(
                                      session.start,
                                      session.end,
                                    ),
                                  },
                                })
                          }
                        >
                          <RotateCcw size={15} />
                          Revisit
                        </Button>
                      ) : (
                        <IconButton
                          label={`Complete ${session.title} session`}
                          disabled={busy === session.id}
                          onClick={() => void completeSession(session)}
                        >
                          <span className="completion-circle">
                            <Check size={14} />
                          </span>
                        </IconButton>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <button
            className="add-to-day"
            onClick={() => setEditor({ type: "task" })}
          >
            <Plus size={16} />
            Make room for something
          </button>
          {missed.length > 0 && (
            <div className="recovery-strip">
              <span className="recovery-icon">
                <RotateCcw size={19} />
              </span>
              <div>
                <strong>Life happens. There’s a next step.</strong>
                <p>
                  {missed.length}{" "}
                  {missed.length === 1 ? "habit is" : "habits are"} waiting for
                  a new plan.
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setPose("recover");
                  setEditor({ type: "recovery", id: missed[0].id });
                }}
              >
                Revisit
                <ChevronRight size={16} />
              </Button>
            </div>
          )}
        </section>
        <aside className="unplanned-section">
          <div className="section-heading">
            <div>
              <h2>
                Not on the calendar
                <span className="count-badge">
                  {unplanned.length + unplannedHabits.length}
                </span>
              </h2>
              <p>Good intentions. Looking for a time.</p>
            </div>
          </div>
          <div className="unplanned-list">
            {unplannedHabits.slice(0, 2).map((o) => (
              <button
                className="queue-item"
                key={o.id}
                onClick={() =>
                  setEditor({
                    type: "schedule",
                    target: {
                      occurrenceId: o.id,
                      title: o.title,
                      duration: o.duration,
                      date: today,
                    },
                  })
                }
              >
                <span className="queue-type lavender">
                  <Leaf size={16} />
                </span>
                <span>
                  <strong>{o.title}</strong>
                  <small>{o.duration} min · Habit</small>
                </span>
                <Plus size={17} />
              </button>
            ))}
            {unplanned.slice(0, 4).map((task) => (
              <button
                className="queue-item"
                key={task.id}
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
                <span className="queue-type neutral">
                  <Flag size={16} />
                </span>
                <span>
                  <strong>{task.title}</strong>
                  <small>
                    {task.estimate} min
                    {task.projectId
                      ? " · " +
                        data.projects.find((p) => p.id === task.projectId)?.name
                      : ""}
                  </small>
                </span>
                <Plus size={17} />
              </button>
            ))}
            {unplanned.length + unplannedHabits.length === 0 && (
              <p className="small-empty">
                Everything has a little room. Lovely.
              </p>
            )}
          </div>
          <button
            className="text-link inbox-link"
            onClick={() => setEditor({ type: "task" })}
          >
            <Plus size={15} />
            Add a task
          </button>
          <div className="planning-note">
            <span className="note-icon">
              <Sparkles size={19} />
            </span>
            <h3>A little help with the when?</h3>
            <p>Find openings that fit your day. You get the final say.</p>
            <Button
              variant="secondary"
              onClick={() => setEditor({ type: "plan" })}
            >
              Suggest a plan
              <ArrowRight size={16} />
            </Button>
            <span className="note-foot">
              Thoughtful scheduling. No AI needed.
            </span>
          </div>
        </aside>
      </div>
      <footer className="page-footer">
        <span>
          <span className="tiny-brand">↗</span>Small steps count. So do the days
          you rest.
        </span>
        <Link href="/habits">
          Tend to your habits
          <ArrowUpRight size={14} />
        </Link>
      </footer>
      {group && prefs.companions && (
        <div className="group-moment" role="status">
          <div>
            <Character
              character="pip"
              state="celebrate"
              reduced={prefs.reducedMotion}
            />
            <Character
              character="zip"
              state="celebrate"
              reduced={prefs.reducedMotion}
            />
            <Character
              character="moss"
              state="recover"
              reduced={prefs.reducedMotion}
            />
          </div>
          <strong>That’s today’s plan, done.</strong>
          <p>Time for the rest of your life.</p>
          <Button variant="ghost" onClick={() => setGroup(false)}>
            Back to my day
          </Button>
        </div>
      )}
    </>
  );
}
