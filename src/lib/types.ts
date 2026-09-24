export type Recurrence = {
  frequency: "daily" | "weekly" | "monthly";
  interval: number;
  days: number[];
  monthDay: number;
  startDate: string;
  endDate?: string;
};
export type Preferences = {
  theme: "light" | "dark" | "system";
  weekStart: 1 | 7;
  companions: boolean;
  reducedMotion: boolean;
  gamification: boolean;
  xp: boolean;
  streaks: boolean;
  humour: boolean;
  achievements: boolean;
  breakMinutes: number;
  dailyLimit: number;
  reminderMinutes: number;
  reminders: boolean;
  emailReminders: boolean;
  aiEnabled: boolean;
  onboardingDone: boolean;
  xpHabit: number;
  xpTask: number;
};
export const defaultPreferences: Preferences = {
  theme: "light",
  weekStart: 1,
  companions: true,
  reducedMotion: false,
  gamification: true,
  xp: true,
  streaks: true,
  humour: true,
  achievements: true,
  breakMinutes: 10,
  dailyLimit: 360,
  reminderMinutes: 10,
  reminders: true,
  emailReminders: false,
  aiEnabled: false,
  onboardingDone: false,
  xpHabit: 20,
  xpTask: 30,
};
export type Habit = {
  id: string;
  title: string;
  description: string;
  duration: number;
  fallback: number | null;
  preferredStart: string;
  preferredEnd: string;
  recurrence: Recurrence;
  color: string;
  archived: boolean;
  revision: number;
  createdAt: string;
};
export type Occurrence = {
  id: string;
  habitId: string;
  localDate: string;
  timezone: string;
  title: string;
  duration: number;
  fallback: number | null;
  status: "pending" | "completed" | "skipped";
  skipReason: string | null;
  ruleRevision: number;
  completedAt: string | null;
};
export type Task = {
  id: string;
  title: string;
  description: string;
  estimate: number;
  dueDate: string | null;
  priority: number;
  projectId: string | null;
  status: "inbox" | "active" | "done";
  createdAt: string;
};
export type Subtask = {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
};
export type Project = { id: string; name: string; color: string };
export type Session = {
  id: string;
  occurrenceId: string | null;
  taskId: string | null;
  commitmentId: string | null;
  title: string;
  start: string;
  end: string;
  status: "scheduled" | "done" | "cancelled";
  kind: "habit" | "task" | "fixed";
  color: string;
  completedAt: string | null;
};
export type Availability = {
  id?: string;
  day: number;
  start: string;
  end: string;
};
export type Commitment = {
  id: string;
  title: string;
  days: number[];
  startTime: string;
  endTime: string;
};
export type Proposal = {
  id: string;
  items: PlanItem[];
  status: string;
  createdAt: string;
};
export type PlanItem = {
  key: string;
  title: string;
  occurrenceId?: string;
  taskId?: string;
  start?: string;
  end?: string;
  explanation: string;
  conflicts: string[];
  accepted?: boolean;
  duration: number;
};
export type Notification = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};
export type Completion = {
  id: string;
  sourceKey: string;
  kind: string;
  createdAt: string;
  minutes: number;
  localDate: string;
  timezone: string;
};
export type AppState = {
  user: {
    id: string;
    name: string;
    email: string;
    timezone: string;
    preferences: Preferences;
  };
  today: string;
  habits: Habit[];
  occurrences: Occurrence[];
  tasks: Task[];
  subtasks: Subtask[];
  projects: Project[];
  sessions: Session[];
  availability: Availability[];
  commitments: Commitment[];
  proposals: Proposal[];
  notifications: Notification[];
  completions: Completion[];
  xp: number;
  streaks: Record<string, number>;
  earnedAchievements: string[];
  aiAvailable: boolean;
  emailAvailable: boolean;
};
