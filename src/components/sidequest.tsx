"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Character from "./companion";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Compass,
  Flag,
  LayoutGrid,
  Leaf,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Sun,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import type { AppState } from "@/lib/types";
import { AppContext, api, ApiError, type Editor } from "./context";
import { Button, Field, IconButton, Modal } from "./ui";
import { Today } from "./today";
import { Week } from "./week";
import { Habits, Tasks, Progress, Gallery, Onboarding } from "./views";
import { Settings } from "./settings";
import { Editors } from "./editors";
import { todayIn } from "@/lib/time";
const nav = [
  { id: "today", label: "Today", icon: Sun },
  { id: "week", label: "Week", icon: CalendarDays },
  { id: "habits", label: "Habits", icon: Leaf },
  { id: "tasks", label: "Tasks", icon: LayoutGrid },
  { id: "progress", label: "Progress", icon: TrendingUp },
];
export default function Sidequest() {
  const router = useRouter(),
    pathname = usePathname(),
    view = pathname.split("/")[1] || "today";
  const [data, setData] = useState<AppState | null>(null),
    [loading, setLoading] = useState(true),
    [auth, setAuth] = useState(false),
    [error, setError] = useState("");
  const [editor, setEditor] = useState<Editor>(null),
    [notice, setNotice] = useState(""),
    [mobileNav, setMobileNav] = useState(false),
    [event, setEvent] = useState(0),
    [date, setDate] = useState(""),
    [search, setSearch] = useState(""),
    [searchOpen, setSearchOpen] = useState(false);
  const reload = useCallback(async (requestedDate?: string) => {
    try {
      const next = await api<AppState>(
        "state" + (requestedDate ? "?date=" + requestedDate : ""),
      );
      setData(next);
      setDate((prev) => requestedDate ?? (prev || next.today));
      setAuth(true);
      setError("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setAuth(false);
        setData(null);
      } else setError(e instanceof Error ? e.message : "Unable to connect.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(()=>{if(!auth)return;const refresh=()=>{if(!document.hidden)void reload(date||undefined);};const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);};},[auth,date,reload]);
  useEffect(() => {
    if (!data) return;
    const prefs = data.user.preferences,
      theme =
        prefs.theme === "system"
          ? matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : prefs.theme;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.reduced = prefs.reducedMotion
      ? "true"
      : "false";
  }, [data]);
  useEffect(() => {
    if (notice) {
      const timeout = setTimeout(() => setNotice(""), 4500);
      return () => clearTimeout(timeout);
    }
  }, [notice]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((x) => !x);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setMobileNav(false);
      }
      if (
        e.key === "n" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLSelectElement) &&
        !document.querySelector("dialog[open]")
      ) {
        e.preventDefault();
        setEditor({ type: "task" });
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  const mutate = async <T,>(
    path: string,
    method: string,
    body?: unknown,
    message?: string,
  ): Promise<T> => {
    try {
      const result = await api<T>(path, method, body);
      await reload(date || undefined);
      if (message) setNotice(message);
      return result;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not save.");
      throw e;
    }
  };
  const setViewDate = (next: string) => {
    setDate(next);
    void reload(next);
  };
  if (loading)
    return (
      <div className="boot">
        <Brand />
        <div className="loading-line" />
        <p>Making a little room…</p>
      </div>
    );
  if (error && !data)
    return (
      <div className="boot">
        <Brand />
        <h2>We couldn’t reach your planner.</h2>
        <p>{error}</p>
        <Button
          onClick={() => {
            setLoading(true);
            void reload();
          }}
        >
          Try again
        </Button>
      </div>
    );
  if (!auth || !data)
    return (
      <Auth
        onSuccess={async () => {
          await reload();
          router.push("/today");
        }}
      />
    );
  const context = {
    data,
    reload,
    mutate,
    toast: setNotice,
    editor,
    setEditor,
    celebrate: () => setEvent((x) => x + 1),
    viewDate: date || data.today,
    setViewDate,
  };
  if (!data.user.preferences.onboardingDone || view === "onboarding")
    return (
      <AppContext.Provider value={context}>
        <Onboarding onDone={() => router.push("/today")} />
        <Editors />
        {notice && (
          <div className="toast" role="status">
            {notice}
          </div>
        )}
      </AppContext.Provider>
    );
  return (
    <AppContext.Provider value={context}>
      <div className="app-shell">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {mobileNav && (
          <button
            className="nav-backdrop"
            aria-label="Close navigation"
            onClick={() => setMobileNav(false)}
          />
        )}
        <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
          <Link className="brand-link" href="/today">
            <Brand />
          </Link>
          <div className="workspace-label">
            <span className="workspace-avatar">
              {data.user.name.slice(0, 1).toUpperCase()}
            </span>
            <span>
              My little corner<small>Personal workspace</small>
            </span>
            <ChevronDown size={14} />
          </div>
          <div className="nav-caption">YOUR SPACE</div>
          <nav aria-label="Main navigation">
            {nav.map((item) => (
              <Link
                key={item.id}
                href={"/" + item.id}
                onClick={() => setMobileNav(false)}
                className={`nav-link ${view === item.id ? "active" : ""}`}
                aria-current={view === item.id ? "page" : undefined}
              >
                <item.icon size={19} />
                <span>{item.label}</span>
                {item.id === "tasks" && (
                  <span className="nav-count">
                    {data.tasks.filter((t) => t.status !== "done").length}
                  </span>
                )}
                {item.id === "today" && <span className="nav-dot" />}
              </Link>
            ))}
          </nav>
          <div className="sidebar-bottom">
            {data.user.preferences.gamification && data.user.preferences.xp && (
              <div className="level-panel">
                <div>
                  <span className="level-badge">
                    <Zap size={16} />
                  </span>
                  <span>
                    Level {Math.floor(data.xp / 200) + 1}
                    <small>A little further along</small>
                  </span>
                </div>
                <div className="xp-track">
                  <span style={{ width: `${(data.xp % 200) / 2}%` }} />
                </div>
                <p>
                  {data.xp % 200} / 200 XP <span>Keep showing up.</span>
                </p>
              </div>
            )}
            <Link
              href="/settings"
              className={`nav-link ${view === "settings" ? "active" : ""}`}
            >
              <Settings2 size={19} />
              Settings
            </Link>
            <Link
              href="/gallery"
              className={`nav-link ${view === "gallery" ? "active" : ""}`}
            >
              <Compass size={19} />
              Meet the companions
            </Link>
            <div className="user-footer">
              <span className="user-avatar">{data.user.name.slice(0, 1)}</span>
              <span>
                {data.user.name}
                <small>Your own adventure</small>
              </span>
              <IconButton
                label="Sign out"
                onClick={async () => {
                  await api("auth/logout", "POST", {});
                  setAuth(false);
                  setData(null);
                }}
              >
                <LogOut size={16} />
              </IconButton>
            </div>
          </div>
        </aside>
        <div className="app-body">
          <header className="topbar">
            <div className="breadcrumb">
              <IconButton
                label="Open navigation"
                className="mobile-menu"
                onClick={() => setMobileNav(true)}
              >
                <Menu size={21} />
              </IconButton>
              <span>My workspace</span>
              <span className="slash">/</span>
              <strong>
                {nav.find((n) => n.id === view)?.label ??
                  (view === "gallery" ? "Companions" : "Settings")}
              </strong>
            </div>
            <div className="top-actions">
              <button
              className="search-trigger"
              aria-label="Search your workspace"
                onClick={() => setSearchOpen(true)}
              >
                <Search size={16} />
                <span>Find something</span>
                <kbd>⌘ K</kbd>
              </button>
              <span className="top-divider" />
              <IconButton
                label="Notifications"
                onClick={() => setEditor({ type: "notifications" })}
              >
                <Bell size={18} />
                {data.notifications.some((n) => !n.read) && (
                  <span className="notification-dot" />
                )}
              </IconButton>
              <span className="top-avatar">{data.user.name.slice(0, 1)}</span>
            </div>
          </header>
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button onClick={() => void reload()}>Retry</button>
            </div>
          )}
          <main id="main" className={`main-content view-${view}`}>
            {view === "today" ||
            ![
              "week",
              "habits",
              "tasks",
              "progress",
              "settings",
              "gallery",
            ].includes(view) ? (
              <Today event={event} />
            ) : view === "week" ? (
              <Week />
            ) : view === "habits" ? (
              <Habits />
            ) : view === "tasks" ? (
              <Tasks />
            ) : view === "progress" ? (
              <Progress />
            ) : view === "settings" ? (
              <Settings />
            ) : (
              <Gallery />
            )}
          </main>
          <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
            {nav.slice(0, 4).map((n) => (
              <Link
                key={n.id}
                href={"/" + n.id}
                className={view === n.id ? "active" : ""}
              >
                <n.icon size={19} />
                <span>{n.label}</span>
              </Link>
            ))}
            <button onClick={() => setMobileNav(true)}>
              <Menu size={19} />
              <span>More</span>
            </button>
          </nav>
        </div>
        <Editors />
        <AnimatePresence>
          {notice && (
            <motion.div
              className="toast"
              role="status"
              initial={{ opacity: 0, y: 8, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0 }}
            >
              <Check size={17} />
              {notice}
            </motion.div>
          )}
        </AnimatePresence>
        {searchOpen && (
          <Modal title="Find something" onClose={() => setSearchOpen(false)}>
            <section
              className="search-box"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <Search size={20} />
                <input
                  autoFocus
                  aria-label="Search habits and tasks"
                  placeholder="Find a habit or task…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <IconButton
                  label="Close search"
                  onClick={() => setSearchOpen(false)}
                >
                  <X size={19} />
                </IconButton>
              </div>
              {[
                ...data.habits.map((x) => ({ ...x, type: "habit" as const })),
                ...data.tasks.map((x) => ({ ...x, type: "task" as const })),
              ]
                .filter((x) =>
                  x.title.toLowerCase().includes(search.toLowerCase()),
                )
                .slice(0, 7)
                .map((x) => (
                  <button
                    key={x.id}
                    onClick={() => {
                      setEditor({ type: x.type, id: x.id });
                      setSearchOpen(false);
                    }}
                  >
                    {x.type === "habit" ? (
                      <Leaf size={18} />
                    ) : (
                      <Flag size={18} />
                    )}
                    <span>
                      {x.title}
                      <small>{x.type}</small>
                    </span>
                    <ArrowUpRight size={17} />
                  </button>
                ))}
            </section>
          </Modal>
        )}
      </div>
    </AppContext.Provider>
  );
}
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-symbol">
        <svg width="27" height="27" viewBox="0 0 40 40" fill="none">
          <path d="m9 30 11-24 4 14h9L22 34l-3-13Z" fill="currentColor" />
        </svg>
      </span>
      sidequest<span className="brand-period">.</span>
    </span>
  );
}
function Auth({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [reset, setReset] = useState(false);
  return (
    <div className="auth-layout">
      <section className="auth-art">
        <Brand />
        <div className="auth-art-copy">
          <span className="eyebrow">SMALL STEPS. REAL LIFE.</span>
          <h1>
            Make room for
            <br />
            what matters.
          </h1>
          <p>
            Your habits, your tasks, your time.
            <br />A plan that leaves room to be human.
          </p>
        </div>
        <div className="auth-world">
          <div className="world-orbit" />
          <div className="world-platform" />
          <Character state="travel" />
          <span className="world-caption">
            A little intention goes a long way.
          </span>
        </div>
        <span className="auth-foot">
          Your data. Your server. Your own adventure.
        </span>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-form">
          <span className="mobile-brand">
            <Brand />
          </span>
          <span className="eyebrow">WELCOME TO YOUR LITTLE CORNER</span>
          <h2>{signup ? "Start your sidequest." : "Good to see you."}</h2>
          <p>
            {signup
              ? "A realistic week starts with one small thing."
              : "Pick up where you left off."}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const values = Object.fromEntries(new FormData(e.currentTarget));
              try {
                await api(signup ? "auth/signup" : "auth/login", "POST", {
                  ...values,
                  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                });
                await onSuccess();
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Please try again.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {signup && (
              <Field label="Your name">
                <input
                  name="name"
                  placeholder="What should we call you?"
                  autoComplete="given-name"
                  required
                  maxLength={160}
                />
              </Field>
            )}
            <Field label="Email address">
              <input
                type="email"
                name="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </Field>
            <Field
              label="Password"
              hint={
                signup
                  ? "At least 12 characters. Make it a good one."
                  : undefined
              }
            >
              <input
                name="password"
                type="password"
                autoComplete={signup ? "new-password" : "current-password"}
                minLength={signup ? 12 : 1}
                required
              />
            </Field>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button busy={busy} type="submit" className="full-width">
              {signup ? "Create your account" : "Sign in"}
              <ArrowUpRight size={18} />
            </Button>
          </form>
          <p className="auth-switch">
            {signup ? "Already have a little corner?" : "New around here?"}{" "}
            <button
              onClick={() => {
                setSignup(!signup);
                setError("");
              }}
            >
              {signup ? "Sign in" : "Create an account"}
            </button>
          </p>
          {!signup && (
            <button className="text-link" onClick={() => setReset(!reset)}>
              Forgot your password?
            </button>
          )}
          {reset && (
            <div className="info-note">
              This is a self-hosted workspace. Ask your server administrator to
              run <code>npm run account:reset -- your@email.com</code>. They’ll
              give you a temporary password. Existing sessions will be signed
              out.
            </div>
          )}
          <div className="auth-privacy">
            <Leaf size={15} />
            No external account. No AI required.
          </div>
        </div>
      </section>
    </div>
  );
}
