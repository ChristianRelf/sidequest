"use client";
import { useRef, useState, useEffect } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flag,
  GripVertical,
  Leaf,
  LockKeyhole,
  Plus,
  Sparkles,
} from "lucide-react";
import { useApp, type ScheduleTarget } from "./context";
import { Button, Empty, IconButton } from "./ui";
import {
  addDays,
  dateIn,
  durationMinutes,
  formatTime,
  localToUtc,
  minutesOf,
  overlaps,
  plusMinutes,
  prettyDate,
  timeIn,
  weekOf,
} from "@/lib/time";
import type { Session } from "@/lib/types";
const HOUR = 76;
type Drag = {
  id: string;
  mode: "move" | "resize";
  originX: number;
  originY: number;
  dx: number;
  dy: number;
  width: number;
};
export function layoutDay(blocks: Session[]) {
  const result = new Map<string, { lane: number; lanes: number }>();
  const sorted = [...blocks].sort(
    (a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end),
  );
  let group: Session[] = [],
    end = 0;
  function flush() {
    if (!group.length) return;
    const lanes: number[] = [];
    const assigned = new Map<string, number>();
    for (const b of group) {
      let lane = lanes.findIndex((e) => e <= +new Date(b.start));
      if (lane === -1) lane = lanes.length;
      lanes[lane] = +new Date(b.end);
      assigned.set(b.id, lane);
    }
    for (const b of group)
      result.set(b.id, { lane: assigned.get(b.id)!, lanes: lanes.length });
    group = [];
  }
  for (const b of sorted) {
    if (+new Date(b.start) >= end) flush();
    group.push(b);
    end = Math.max(end, +new Date(b.end));
  }
  flush();
  return result;
}
export function Week() {
  const { data, viewDate, setViewDate, setEditor, mutate, toast } = useApp(),
    zone = data.user.timezone;
  const start = weekOf(viewDate, data.user.preferences.weekStart),
    days = Array.from({ length: 7 }, (_, i) => addDays(start, i)),
    grid = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null),
    [selectedDay, setSelectedDay] = useState(data.today),
    [now, setNow] = useState(Date.now()),
    [queueTab, setQueueTab] = useState<"all" | "habits" | "tasks">("all");
  const suppressClickUntil = useRef(0);
  const [pendingPositions,setPendingPositions]=useState<Record<string,{start:string;end:string}>>({});
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  const sessions = data.sessions.map(s=>pendingPositions[s.id]?{...s,...pendingPositions[s.id]}:s).filter((s) =>
      days.includes(dateIn(s.start, zone)),
    ),
    total = sessions
      .filter((s) => s.kind !== "fixed")
      .reduce((n, s) => n + durationMinutes(s.start, s.end), 0);
  const START = Math.min(
      7,
      ...sessions.map((s) => Math.floor(minutesOf(timeIn(s.start, zone)) / 60)),
    ),
    END = Math.min(
      24,
      Math.max(
        22,
        ...sessions.map((s) =>
          Math.ceil(
            (minutesOf(timeIn(s.start, zone)) +
              durationMinutes(s.start, s.end)) /
              60,
          ),
        ),
      ),
    );
  const occurrences = data.occurrences.filter(
    (o) =>
      days.includes(o.localDate) &&
      o.status === "pending" &&
      !data.habits.find((h) => h.id === o.habitId)?.archived &&
      !data.sessions.some((s) => s.occurrenceId === o.id),
  );
  const tasks = data.tasks.filter(
    (t) =>
      t.status !== "done" &&
      !data.sessions.some((s) => s.taskId === t.id && s.status === "scheduled"),
  );
  const targets: ScheduleTarget[] = [
    ...(queueTab === "tasks"
      ? []
      : occurrences.map((o) => ({
          occurrenceId: o.id,
          title: o.title,
          duration: o.duration,
          date: o.localDate,
        }))),
    ...(queueTab === "habits"
      ? []
      : tasks.map((t) => ({
          taskId: t.id,
          title: t.title,
          duration: Math.min(120, t.estimate),
        }))),
  ];
  const edit = (s: Session) => {
    if (s.kind === "fixed") {
      toast("Fixed commitment. Edit repeating commitments in Settings.");
      return;
    }
    setEditor({
      type: "schedule",
      target: {
        sessionId: s.id,
        occurrenceId: s.occurrenceId ?? undefined,
        taskId: s.taskId ?? undefined,
        title: s.title,
        duration: durationMinutes(s.start, s.end),
        date: dateIn(s.start, zone),
        time: timeIn(s.start, zone),
      },
    });
  };
  const finishDrag = async () => {
    if (!drag) return;
    const current = drag;
    setDrag(null);
    if (Math.abs(current.dx) + Math.abs(current.dy) < 5) return;
    suppressClickUntil.current = performance.now() + 250;
    const s = sessions.find((s) => s.id === current.id)!;
    const offset = Math.round(((current.dy / HOUR) * 60) / 15) * 15;
    const dayOffset =
      current.mode === "move" ? Math.round(current.dx / current.width) : 0;
    let startTime = new Date(s.start).toISOString(),
      endTime = new Date(s.end).toISOString();
    if (current.mode === "move") {
      const day = addDays(dateIn(s.start, zone), dayOffset);
      startTime = plusMinutes(
        localToUtc(day, timeIn(s.start, zone), zone),
        offset,
      );
      endTime = plusMinutes(startTime, durationMinutes(s.start, s.end));
    } else endTime = plusMinutes(s.end, offset);
    if (durationMinutes(startTime, endTime) < 15) {
      toast("Sessions must be at least 15 minutes when resizing.");
      return;
    }
    setPendingPositions(prev=>({...prev,[s.id]:{start:startTime,end:endTime}}));
    try {
      await mutate(
        `sessions/${s.id}`,
        "PATCH",
        {
          occurrenceId: s.occurrenceId ?? undefined,
          taskId: s.taskId ?? undefined,
          start: startTime,
          end: endTime,
        },
        current.mode === "resize"
          ? "Session duration updated."
          : "Session moved.",
      );
    } catch {} finally {setPendingPositions(prev=>{const next={...prev};delete next[s.id];return next;});}
  };
  const activeDay = days.includes(selectedDay) ? selectedDay : days[0];
  return (
    <>
      <div className="page-heading week-heading">
        <div>
          <div className="date-eyebrow">
            <CalendarDays size={15} />A LITTLE STRUCTURE. A LOT OF POSSIBILITY.
          </div>
          <h1>
            Your week, <span>with room to live.</span>
          </h1>
          <p>Give your good intentions a place on the calendar.</p>
        </div>
        <Button onClick={() => setEditor({ type: "plan" })}>
          <Sparkles size={17} />
          Suggest a plan
        </Button>
      </div>
      <div className="week-toolbar">
        <div className="week-navigation">
          <IconButton
            label="Previous week"
            onClick={() => {
              setViewDate(addDays(start, -7));
            }}
          >
            <ChevronLeft size={19} />
          </IconButton>
          <IconButton
            label="Next week"
            onClick={() => {
              setViewDate(addDays(start, 7));
            }}
          >
            <ChevronRight size={19} />
          </IconButton>
          <h2>
            {prettyDate(start, { month: "long", day: "numeric" })} –{" "}
            {prettyDate(days[6], { month: "short", day: "numeric" })}
            <span>{start.slice(0, 4)}</span>
          </h2>
          <Button
            variant="secondary"
            onClick={() => {
              setViewDate(data.today);
              setSelectedDay(data.today);
            }}
          >
            Today
          </Button>
        </div>
        <div className="week-meta">
          <span>
            <span className="legend-dot lavender" />
            Habit
          </span>
          <span>
            <span className="legend-dot blue" />
            Task
          </span>
          <span>
            <LockKeyhole size={12} />
            Fixed
          </span>
          <span className="timezone-tag">
            {zone.split("/").pop()?.replaceAll("_", " ")}
          </span>
        </div>
      </div>
      <div className="week-layout">
        <section className="calendar-wrap" aria-label="Weekly calendar">
          <div className="calendar-head">
            <div className="time-zone-label">
              {zone === "UTC" ? "UTC" : "LOCAL"}
            </div>
            {days.map((day) => (
              <button
                key={day}
                className={`calendar-day-heading ${day === data.today ? "is-today" : ""}`}
                onClick={() => setSelectedDay(day)}
              >
                <span>{prettyDate(day, { weekday: "short" })}</span>
                <strong>{day.slice(8).replace(/^0/, "")}</strong>
                {day === data.today && <i />}
              </button>
            ))}
          </div>
          <div className="calendar-scroll">
            <div
              className="calendar-grid"
              ref={grid}
              style={{ height: (END - START) * HOUR }}
            >
              <div className="time-gutter">
                {Array.from({ length: END - START }, (_, i) => (
                  <span key={i} style={{ top: i * HOUR }}>
                    {String(START + i).padStart(2, "0")}:00
                  </span>
                ))}
              </div>
              {days.map((day) => {
                const blocks = sessions.filter(
                    (s) => dateIn(s.start, zone) === day,
                  ),
                  layout = layoutDay(blocks);
                const currentMinute = minutesOf(
                  timeIn(new Date(now).toISOString(), zone),
                );
                return (
                  <div
                    className={`calendar-day ${day === data.today ? "is-today" : ""}`}
                    key={day}
                    style={{ backgroundSize: `100% ${HOUR}px` }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      try {
                        const target = JSON.parse(
                          e.dataTransfer.getData("application/sidequest"),
                        ) as ScheduleTarget;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const minute = Math.max(
                          START * 60,
                          Math.min(
                            END * 60 - 15,
                            Math.round(
                              (((e.clientY - rect.top) / HOUR) * 60) / 15,
                            ) *
                              15 +
                              START * 60,
                          ),
                        );
                        setEditor({
                          type: "schedule",
                          target: {
                            ...target,
                            date: day,
                            time: `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`,
                          },
                        });
                      } catch {}
                    }}
                    onDoubleClick={(e) => {
                      if (e.target === e.currentTarget)
                        setEditor({ type: "task" });
                    }}
                  >
                    {blocks.map((s) => {
                      const minute = minutesOf(timeIn(s.start, zone)),
                        duration = durationMinutes(s.start, s.end),
                        position = layout.get(s.id)!,
                        isDrag = drag?.id === s.id,
                        conflict = blocks.some(
                          (b) => b.id !== s.id && overlaps(s, b),
                        );
                      if (minute + duration < START * 60 || minute >= END * 60)
                        return null;
                      return (
                        <div
                          key={s.id}
                          data-session-id={s.id}
                          data-drag-mode={isDrag?drag.mode:undefined}
                          className={`calendar-block ${s.color} ${s.kind === "fixed" ? "fixed" : ""} ${s.status === "done" ? "done" : ""} ${isDrag ? "dragging" : ""} ${duration < 40 ? "compact" : ""} ${conflict ? "has-conflict" : ""}`}
                          style={{
                            top: Math.max(
                              0,
                              ((minute - START * 60) / 60) * HOUR,
                            ),
                            height:
                              Math.max(26, (duration / 60) * HOUR - 4) +
                              (isDrag && drag.mode === "resize" ? drag.dy : 0),
                            left: `calc(${(position.lane / position.lanes) * 100}% + 4px)`,
                            width: `calc(${100 / position.lanes}% - 8px)`,
                            transform:
                              isDrag && drag.mode === "move"
                                ? `translate(${drag.dx}px,${drag.dy}px)`
                                : undefined,
                            zIndex: isDrag ? 20 : 2,
                          }}
                          onPointerDown={(e) => {
                            if (
                              s.kind === "fixed" ||
                              s.status === "done" ||
                              e.button !== 0
                            )
                              return;
                            e.preventDefault();
                            const rect =
                              e.currentTarget.parentElement!.getBoundingClientRect();
                            e.currentTarget.setPointerCapture(e.pointerId);
                            setDrag({
                              id: s.id,
                              mode: (e.target as HTMLElement).closest(
                                ".resize-handle",
                              )
                                ? "resize"
                                : "move",
                              originX: e.clientX,
                              originY: e.clientY,
                              dx: 0,
                              dy: 0,
                              width: rect.width,
                            });
                          }}
                          onPointerMove={(e) => {
                            if (drag?.id === s.id)
                              setDrag({
                                ...drag,
                                dx: e.clientX - drag.originX,
                                dy: e.clientY - drag.originY,
                              });
                          }}
                          onPointerUp={() => void finishDrag()}
                          onPointerCancel={() => setDrag(null)}
                        >
                          <button
                            aria-label={`Edit ${s.title}, ${formatTime(s.start, zone)} to ${formatTime(s.end, zone)}${conflict ? ", overlapping" : ""}`}
                            onClick={(e) => {
                              if (
                                e.detail === 0 || (performance.now() >
                                  suppressClickUntil.current &&
                                (!drag ||
                                  Math.abs(drag.dx) + Math.abs(drag.dy) < 5))
                              )
                                edit(s);
                            }}
                            className="calendar-block-content"
                          >
                            <span className="block-title">
                              {s.kind === "fixed" ? (
                                <LockKeyhole size={12} />
                              ) : s.kind === "habit" ? (
                                <Leaf size={12} />
                              ) : (
                                <Flag size={12} />
                              )}
                              <strong>{s.title}</strong>
                              {s.status === "done" && <Check size={12} />}
                            </span>
                            <span className="block-time">
                              {formatTime(s.start, zone)} –{" "}
                              {formatTime(s.end, zone)}
                            </span>
                            {duration >= 50 && (
                              <span className="block-duration">
                                {duration} min{conflict ? " · Overlap" : ""}
                              </span>
                            )}
                          </button>
                          {s.kind !== "fixed" && s.status === "scheduled" && (
                            <div className="resize-handle" aria-hidden="true">
                              <span />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {day === data.today &&
                      currentMinute >= START * 60 &&
                      currentMinute < END * 60 && (
                        <div
                          className="current-time-line"
                          style={{
                            top: ((currentMinute - START * 60) / 60) * HOUR,
                          }}
                        >
                          <span />
                          {formatTime(new Date(now).toISOString(), zone)}
                        </div>
                      )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="calendar-bottom">
            <span>
              <Clock3 size={14} />
              {Math.floor(total / 60)}h {total % 60}m of intention this week
            </span>
            <span>
              Drag to move · Pull the bottom edge to resize · Select to edit
            </span>
          </div>
        </section>
        <section className="mobile-agenda">
          <div className="mobile-day-picker">
            {days.map((day) => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={activeDay === day ? "active" : ""}
              >
                <span>{prettyDate(day, { weekday: "short" }).slice(0, 1)}</span>
                <strong>{Number(day.slice(8))}</strong>
                <i
                  className={
                    sessions.some((s) => dateIn(s.start, zone) === day)
                      ? "has-items"
                      : ""
                  }
                />
              </button>
            ))}
          </div>
          <h2>
            {prettyDate(activeDay, {
              weekday: "long",
              day: "numeric",
              month: "short",
            })}
          </h2>
          {sessions
            .filter((s) => dateIn(s.start, zone) === activeDay)
            .sort((a, b) => a.start.localeCompare(b.start))
            .map((s) => (
              <button
                key={s.id}
                className={`mobile-session ${s.color}`}
                onClick={() => edit(s)}
              >
                <span>
                  {formatTime(s.start, zone)}
                  <small>{durationMinutes(s.start, s.end)} min</small>
                </span>
                <strong>
                  {s.title}
                  <small>
                    {s.kind === "fixed"
                      ? "Fixed commitment"
                      : s.kind === "habit"
                        ? "Habit"
                        : "Task session"}
                    {s.status === "done" ? " · Completed" : ""}
                  </small>
                </strong>
                <ChevronRight size={17} />
              </button>
            ))}
          {!sessions.some((s) => dateIn(s.start, zone) === activeDay) && (
            <Empty
              title="A day with possibilities."
              description="Choose an item below to find it a time."
            />
          )}
          <Button
            variant="secondary"
            onClick={() => setEditor({ type: "task" })}
          >
            <Plus size={16} />
            Add to your day
          </Button>
        </section>
        <aside className="week-queue">
          <div className="queue-heading">
            <div>
              <span className="eyebrow">WAITING IN THE WINGS</span>
              <h2>
                Make a little room
                <span className="count-badge">{targets.length}</span>
              </h2>
            </div>
            <IconButton
              label="Create a task"
              onClick={() => setEditor({ type: "task" })}
            >
              <Plus size={18} />
            </IconButton>
          </div>
          <div className="segmented-control">
            {(["all", "habits", "tasks"] as const).map((tab) => (
              <button
                key={tab}
                className={queueTab === tab ? "active" : ""}
                onClick={() => setQueueTab(tab)}
              >
                {tab[0].toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <p className="queue-instruction">
            Drag onto the calendar, or select to choose a time.
          </p>
          <div className="week-queue-items">
            {targets.slice(0, 24).map((target) => (
              <button
                className="week-queue-item"
                draggable
                key={target.occurrenceId ?? target.taskId}
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    "application/sidequest",
                    JSON.stringify(target),
                  );
                  e.dataTransfer.effectAllowed = "move";
                }}
                onClick={() => setEditor({ type: "schedule", target })}
              >
                <span
                  className={`queue-type ${target.occurrenceId ? "lavender" : "blue"}`}
                >
                  {target.occurrenceId ? (
                    <Leaf size={16} />
                  ) : (
                    <Flag size={16} />
                  )}
                </span>
                <span>
                  <strong>{target.title}</strong>
                  <small>
                    {target.duration} min
                    {target.date
                      ? " · " + prettyDate(target.date, { weekday: "short" })
                      : " · Task"}
                  </small>
                </span>
                <GripVertical size={15} className="muted" />
              </button>
            ))}
            {!targets.length && (
              <p className="small-empty">
                Everything has a place. Leave a little room for life.
              </p>
            )}
          </div>
          <div className="queue-tip">
            <Leaf size={18} />
            <p>
              <strong>A plan with breathing room.</strong>Your{" "}
              {data.user.preferences.breakMinutes}-minute breaks are protected
              in suggested plans.
            </p>
          </div>
          <Button
            variant="secondary"
            className="full-width"
            onClick={() => setEditor({ type: "plan" })}
          >
            <Sparkles size={16} />
            Find the openings
          </Button>
        </aside>
      </div>
    </>
  );
}
