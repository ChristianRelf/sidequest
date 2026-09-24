"use client";
import { useRef, useState } from "react";
import {
  Bell,
  Check,
  ChevronRight,
  Download,
  Globe2,
  Heart,
  Leaf,
  LockKeyhole,
  Palette,
  Plus,
  Shield,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useApp, api } from "./context";
import { Button, Field, IconButton, Modal, Toggle } from "./ui";
import type { Preferences, Availability } from "@/lib/types";
const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
export function Settings() {
  const { data, mutate, toast } = useApp(),
    [section, setSection] = useState("rhythm"),
    [busy, setBusy] = useState(false),
    [remove, setRemove] = useState(false),
    [backup, setBackup] = useState<unknown>(null),
    [importName, setImportName] = useState(""),
    file = useRef<HTMLInputElement>(null);
  const [availability, setAvailability] = useState<Availability[]>(
      data.availability,
    ),
    prefs = data.user.preferences;
  const setPref = async (key: keyof Preferences, value: unknown) => {
    await mutate("settings", "PATCH", { preferences: { [key]: value } });
  };
  const sections = [
    { id: "rhythm", name: "Your rhythm", icon: Globe2 },
    { id: "appearance", name: "Make it yours", icon: Palette },
    { id: "reminders", name: "Gentle reminders", icon: Bell },
    { id: "integrations", name: "AI & integrations", icon: Sparkles },
    { id: "data", name: "Your data", icon: Shield },
    { id: "account", name: "Your account", icon: LockKeyhole },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="date-eyebrow">YOUR LITTLE CORNER, YOUR WAY</div>
          <h1>
            Make yourself <span>at home.</span>
          </h1>
          <p>A planner should fit your life. Here’s where you make it yours.</p>
        </div>
      </div>
      <div className="settings-layout">
        <aside className="settings-nav">
          {sections.map((s) => (
            <button
              key={s.id}
              className={section === s.id ? "active" : ""}
              onClick={() => setSection(s.id)}
            >
              <s.icon size={18} />
              {s.name}
              <ChevronRight size={15} />
            </button>
          ))}
        </aside>
        <section className="settings-panel">
          {section === "rhythm" && (
            <>
              <div className="settings-section-heading">
                <h2>Your rhythm</h2>
                <p>The boundaries that make a realistic plan possible.</p>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  const f = Object.fromEntries(new FormData(e.currentTarget));
                  try {
                    await mutate(
                      "settings",
                      "PATCH",
                      {
                        timezone: f.timezone,
                        preferences: {
                          weekStart: Number(f.weekStart),
                          breakMinutes: Number(f.breakMinutes),
                          dailyLimit: Number(f.dailyLimit),
                        },
                        availability: availability.map(
                          ({ day, start, end }) => ({ day, start, end }),
                        ),
                      },
                      "Your rhythm is saved. Existing time blocks keep their exact times.",
                    );
                  } catch {
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <div className="form-row">
                  <Field label="Timezone">
                    <input
                      name="timezone"
                      list="settings-timezones"
                      defaultValue={data.user.timezone}
                      required
                    />
                    <datalist id="settings-timezones">
                      {Intl.supportedValuesOf("timeZone").map((z) => (
                        <option key={z} value={z} />
                      ))}
                    </datalist>
                  </Field>
                  <Field label="Week starts on">
                    <select name="weekStart" defaultValue={prefs.weekStart}>
                      <option value={1}>Monday</option>
                      <option value={7}>Sunday</option>
                    </select>
                  </Field>
                </div>
                <p className="info-note">
                  A timezone change affects future occurrences. Existing
                  occurrence dates, their original timezone and all scheduled
                  instants stay fixed. DST gaps move forward; repeated times use
                  the earlier offset.
                </p>
                <div className="form-rule" />
                <h3>When life has room</h3>
                <p className="muted">
                  Suggestions stay inside these windows. Unchecked days are rest
                  days for planning.
                </p>
                <div className="availability-editor">
                  {days.map((day, index) => {
                    const rule = availability.find((a) => a.day === index + 1);
                    return (
                      <div className="availability-row" key={day}>
                        <label>
                          <input
                            type="checkbox"
                            checked={!!rule}
                            onChange={(e) =>
                              setAvailability(
                                e.target.checked
                                  ? [
                                      ...availability,
                                      {
                                        day: index + 1,
                                        start: "08:00",
                                        end: "20:00",
                                      },
                                    ]
                                  : availability.filter(
                                      (x) => x.day !== index + 1,
                                    ),
                              )
                            }
                          />
                          {day}
                        </label>
                        {rule ? (
                          <>
                            <input
                              aria-label={`${day} availability start`}
                              type="time"
                              required
                              value={rule.start}
                              onChange={(e) =>
                                setAvailability(
                                  availability.map((a) =>
                                    a === rule
                                      ? { ...a, start: e.target.value }
                                      : a,
                                  ),
                                )
                              }
                            />
                            <span>to</span>
                            <input
                              aria-label={`${day} availability end`}
                              type="time"
                              required
                              value={rule.end}
                              onChange={(e) =>
                                setAvailability(
                                  availability.map((a) =>
                                    a === rule
                                      ? { ...a, end: e.target.value }
                                      : a,
                                  ),
                                )
                              }
                            />
                          </>
                        ) : (
                          <span className="rest-label">
                            A little breathing room
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="form-row">
                  <Field label="Minimum break">
                    <div className="input-suffix">
                      <input
                        name="breakMinutes"
                        type="number"
                        min={0}
                        max={120}
                        defaultValue={prefs.breakMinutes}
                      />
                      <span>min</span>
                    </div>
                  </Field>
                  <Field
                    label="Daily workload limit"
                    hint="Flexible sessions only. 0 means no limit."
                  >
                    <div className="input-suffix">
                      <input
                        name="dailyLimit"
                        type="number"
                        min={0}
                        max={1440}
                        step={15}
                        defaultValue={prefs.dailyLimit}
                      />
                      <span>min</span>
                    </div>
                  </Field>
                </div>
                <div className="form-actions">
                  <Button busy={busy} type="submit">
                    Save my rhythm
                    <Check size={16} />
                  </Button>
                </div>
              </form>
              <div className="form-rule" />
              <CommitmentSettings />
            </>
          )}
          {section === "appearance" && (
            <>
              <div className="settings-section-heading">
                <h2>Make it yours</h2>
                <p>A little personality. Only as much as you like.</p>
              </div>
              <h3>Your canvas</h3>
              <div className="theme-options">
                {(["light", "dark", "system"] as const).map((theme) => (
                  <button
                    className={`theme-option ${theme} ${prefs.theme === theme ? "selected" : ""}`}
                    key={theme}
                    onClick={() => void setPref("theme", theme).catch(()=>{})}
                    aria-pressed={prefs.theme === theme}
                  >
                    <span className="theme-preview">
                      <i />
                      <b />
                      <em />
                    </span>
                    <strong>{theme[0].toUpperCase() + theme.slice(1)}</strong>
                    {prefs.theme === theme && <Check size={16} />}
                  </button>
                ))}
              </div>
              <div className="form-rule" />
              <Toggle
                label="A little company"
                description="Show Pip, Zip and Moss in quiet corners of the app."
                checked={prefs.companions}
                onChange={(v) => setPref("companions", v)}
              />
              <Toggle
                label="Reduced motion"
                description="Keep state changes simple. Your system preference is always respected."
                checked={prefs.reducedMotion}
                onChange={(v) => setPref("reducedMotion", v)}
              />
              <div className="form-rule" />
              <h3>A small nod to your effort</h3>
              <Toggle
                label="Game layer"
                description="The master switch for XP, streaks and achievements."
                checked={prefs.gamification}
                onChange={(v) => setPref("gamification", v)}
              />
              <Toggle
                label="Experience points"
                description="A little recognition for completed intentions. Never lost for rest."
                checked={prefs.xp}
                onChange={(v) => setPref("xp", v)}
              />
              <Toggle
                label="Sustainable streaks"
                description="Count eligible occurrences, with rest days and skips as neutral."
                checked={prefs.streaks}
                onChange={(v) => setPref("streaks", v)}
              />
              <Toggle
                label="Small achievements"
                description="Occasional milestones. No competition, no leaderboard."
                checked={prefs.achievements}
                onChange={(v) => setPref("achievements", v)}
              />
              <Toggle
                label="A little dry humour"
                description="An occasional observation in your weekly recap."
                checked={prefs.humour}
                onChange={(v) => setPref("humour", v)}
              />
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = Object.fromEntries(new FormData(e.currentTarget));
                  await mutate(
                    "settings",
                    "PATCH",
                    {
                      preferences: {
                        xpHabit: Number(f.habit),
                        xpTask: Number(f.task),
                      },
                    },
                    "XP values updated for future completions.",
                  );
                }}
              >
                <div className="form-row">
                  <Field label="XP per habit occurrence">
                    <input
                      name="habit"
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={prefs.xpHabit}
                    />
                  </Field>
                  <Field label="XP per completed task">
                    <input
                      name="task"
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={prefs.xpTask}
                    />
                  </Field>
                </div>
                <Button variant="secondary" type="submit">
                  Save XP values
                </Button>
              </form>
            </>
          )}
          {section === "reminders" && (
            <>
              <div className="settings-section-heading">
                <h2>A gentle heads-up</h2>
                <p>Useful reminders, without the noise.</p>
              </div>
              <Toggle
                label="In-app reminders"
                description="A notification shortly before a scheduled session starts."
                checked={prefs.reminders}
                onChange={(v) => setPref("reminders", v)}
              />
              <Field label="Remind me before a session">
                <select
                  value={prefs.reminderMinutes}
                  onChange={(e) =>
                    void setPref("reminderMinutes", Number(e.target.value)).catch(()=>{})
                  }
                >
                  {[0, 5, 10, 15, 30, 60].map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? "At the start" : n + " minutes before"}
                    </option>
                  ))}
                </select>
              </Field>
              <Toggle
                label="Email reminders"
                description={
                  data.emailAvailable
                    ? "Send reminders to your account email. In-app reminders remain available."
                    : "Email is not configured. Set SMTP variables on your server to enable it."
                }
                checked={prefs.emailReminders}
                disabled={!data.emailAvailable}
                onChange={(v) => setPref("emailReminders", v)}
              />
              <p className="info-note">
                Reminders run in the background worker. A retry never creates
                another in-app notification for the same session time. No
                reminder marks a session complete.
              </p>
            </>
          )}
          {section === "integrations" && (
            <>
              <div className="settings-section-heading">
                <h2>AI, on your terms</h2>
                <p>Optional help with words. Your calendar remains yours.</p>
              </div>
              <div className="integration-status">
                <span
                  className={`status-dot ${data.aiAvailable ? "online" : ""}`}
                />
                <div>
                  <strong>
                    {data.aiAvailable
                      ? "A model endpoint is configured"
                      : "No model connected"}
                  </strong>
                  <p>
                    {data.aiAvailable
                      ? "Configured by your server administrator."
                      : "The entire core app works without AI or an API key."}
                  </p>
                </div>
                <span className="tag">OPTIONAL</span>
              </div>
              <Toggle
                label="Enable intention drafts"
                description="Turn a short intention into a structured draft for your review."
                checked={prefs.aiEnabled}
                onChange={(v) => setPref("aiEnabled", v)}
              />
              <div className="privacy-note">
                <Shield size={22} />
                <div>
                  <h3>Exactly what leaves your server</h3>
                  <p>
                    Only the intention text you submit and the draft-format
                    instructions are sent to the configured endpoint. Your name,
                    email, calendar and history are excluded. A remote provider
                    can process that text under its own policy.
                  </p>
                  <p>
                    Model output is validated on the server. It never writes to
                    your database, changes recurrence, calculates scores or
                    schedules a session. If it fails, you get a simple editable
                    draft.
                  </p>
                </div>
              </div>
              <p className="info-note">
                Server administrators can configure a local Ollama endpoint or
                an OpenAI-compatible endpoint through environment variables.
                External calendar sync is not included in this release;
                repeating commitments are managed in Your rhythm.
              </p>
            </>
          )}
          {section === "data" && (
            <>
              <div className="settings-section-heading">
                <h2>Your data is yours</h2>
                <p>
                  Take a copy. Keep a backup. Bring your little world with you.
                </p>
              </div>
              <div className="data-action">
                <span className="data-icon">
                  <Download size={22} />
                </span>
                <div>
                  <h3>A complete copy</h3>
                  <p>
                    Habits, tasks, sessions, occurrence history, XP and
                    preferences. No passwords or login sessions.
                  </p>
                </div>
                <a
                  className="button secondary"
                  href="/api/export?format=json"
                  download
                >
                  Export JSON
                </a>
              </div>
              <div className="data-action">
                <span className="data-icon">
                  <Download size={22} />
                </span>
                <div>
                  <h3>A spreadsheet-friendly view</h3>
                  <p>
                    Your records in one CSV, labelled by type. Formula-like text
                    is safely escaped.
                  </p>
                </div>
                <a
                  className="button secondary"
                  href="/api/export?format=csv"
                  download
                >
                  Export CSV
                </a>
              </div>
              <div className="data-action">
                <span className="data-icon">
                  <Upload size={22} />
                </span>
                <div>
                  <h3>Bring back a backup</h3>
                  <p>
                    Merge a Sidequest JSON export. Existing items stay.
                    Re-importing the same file is safe.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => file.current?.click()}
                >
                  Import JSON
                </Button>
                <input
                  className="visually-hidden"
                  ref={file}
                  type="file"
                  accept=".json,application/json"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > 2_000_000) {
                      toast("Choose a JSON export under 2 MB.");
                      return;
                    }
                    try {
                      setBackup(JSON.parse(await f.text()));
                      setImportName(f.name);
                    } catch {
                      toast("That file is not valid JSON.");
                    }
                    e.target.value = "";
                  }}
                />
              </div>
              <div className="privacy-note">
                <LockKeyhole size={22} />
                <div>
                  <h3>Private by design</h3>
                  <p>
                    Your account’s data is isolated on the server. Core features
                    do not contact external services. Back up your PostgreSQL
                    volume as well as exporting individual accounts.
                  </p>
                </div>
              </div>
            </>
          )}
          {section === "account" && (
            <>
              <div className="settings-section-heading">
                <h2>Your account</h2>
                <p>The details of your little corner.</p>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await mutate(
                    "settings",
                    "PATCH",
                    { name: new FormData(e.currentTarget).get("name") },
                    "Name updated.",
                  );
                }}
              >
                <Field label="Your name">
                  <input name="name" required defaultValue={data.user.name} />
                </Field>
                <Field label="Email address">
                  <input type="email" value={data.user.email} readOnly />
                </Field>
                <Button variant="secondary" type="submit">
                  Save details
                </Button>
              </form>
              <div className="form-rule" />
              <h3>Change password</h3>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const f = Object.fromEntries(new FormData(form));
                  try {
                    await mutate(
                      "account/password",
                      "POST",
                      f,
                      "Password changed. Other sessions have been signed out.",
                    );
                    form.reset();
                  } catch {}
                }}
              >
                <Field label="Current password">
                  <input
                    name="current"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </Field>
                <Field label="New password" hint="At least 12 characters.">
                  <input
                    name="password"
                    type="password"
                    minLength={12}
                    required
                    autoComplete="new-password"
                  />
                </Field>
                <Button variant="secondary" type="submit">
                  Change password
                </Button>
              </form>
              <div className="form-rule" />
              <div className="danger-zone">
                <h3>Leave this little corner</h3>
                <p>
                  Permanently delete your account and every associated record.
                  Export a copy first if you’d like to keep one.
                </p>
                <Button variant="danger" onClick={() => setRemove(true)}>
                  <Trash2 size={16} />
                  Delete my account
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
      {backup !== null && (
        <Modal
          title="Bring back this little world?"
          onClose={() => setBackup(null)}
        >
          <p>
            Import <strong>{importName}</strong> into this account. Definitions
            and completion history will be merged with new IDs. Preferences and
            availability will be restored; your timezone and credentials stay as
            they are. Nothing is deleted.
          </p>
          <p className="info-note">
            Only import an export you trust. Review the filename and keep a
            current backup first.
          </p>
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setBackup(null)}>
              Cancel
            </Button>
            <Button
              busy={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await mutate<{ message: string }>(
                    "import",
                    "POST",
                    backup,
                  );
                  toast(result.message);
                  setBackup(null);
                } catch {
                } finally {
                  setBusy(false);
                }
              }}
            >
              Import this backup
            </Button>
          </div>
        </Modal>
      )}
      {remove && (
        <Modal title="Delete your account?" onClose={() => setRemove(false)}>
          <p>
            All habits, tasks, sessions, completions, XP and notifications will
            be permanently deleted.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api(
                  "account",
                  "POST",
                  Object.fromEntries(new FormData(e.currentTarget)),
                );
                window.location.assign("/");
              } catch (err) {
                toast(err instanceof Error ? err.message : "Could not delete.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Your password">
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
              />
            </Field>
            <Field label="Type DELETE to confirm">
              <input name="confirmation" pattern="DELETE" required />
            </Field>
            <div className="form-actions">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setRemove(false)}
              >
                Keep my account
              </Button>
              <Button variant="danger" type="submit" busy={busy}>
                Permanently delete
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
function CommitmentSettings() {
  const { data, mutate } = useApp(),
    [show, setShow] = useState(false),
    [days, setDays] = useState([1, 2, 3, 4, 5]);
  return (
    <>
      <div className="section-heading">
        <div>
          <h3>Repeating commitments</h3>
          <p className="small muted">
            Hard boundaries. Suggestions plan around these.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setShow(!show)}>
          <Plus size={16} />
          Add
        </Button>
      </div>
      {data.commitments.map((c) => (
        <div className="commitment-row" key={c.id}>
          <LockKeyhole size={17} />
          <span>
            <strong>{c.title}</strong>
            <small>
              {c.startTime}–{c.endTime} ·{" "}
              {c.days
                .map(
                  (d) =>
                    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][d - 1],
                )
                .join(", ")}
            </small>
          </span>
          <IconButton
            label={`Remove commitment ${c.title}`}
            onClick={() =>
              void mutate(
                "commitments/" + c.id,
                "DELETE",
                undefined,
                "Repeating commitment removed.",
              ).catch(() => {})
            }
          >
            <X size={17} />
          </IconButton>
        </div>
      ))}
      {show && (
        <form
          className="commitment-form"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await mutate(
                "commitments",
                "POST",
                { ...Object.fromEntries(new FormData(e.currentTarget)), days },
                "Repeating commitment added.",
              );
              setShow(false);
            } catch {}
          }}
        >
          <Field label="Commitment name">
            <input
              name="title"
              required
              placeholder="Lunch, school pickup, team catch-up…"
            />
          </Field>
          <div className="day-toggle-group">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <button
                key={i}
                type="button"
                className={days.includes(i + 1) ? "active" : ""}
                aria-label={
                  [
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                  ][i]
                }
                aria-pressed={days.includes(i + 1)}
                onClick={() =>
                  setDays(
                    days.includes(i + 1)
                      ? days.filter((x) => x !== i + 1)
                      : [...days, i + 1],
                  )
                }
              >
                {d}
              </button>
            ))}
          </div>
          <div className="form-row">
            <Field label="Starts">
              <input
                name="startTime"
                type="time"
                defaultValue="12:00"
                required
              />
            </Field>
            <Field label="Ends">
              <input name="endTime" type="time" defaultValue="13:00" required />
            </Field>
          </div>
          <Button type="submit">Save commitment</Button>
        </form>
      )}
    </>
  );
}
