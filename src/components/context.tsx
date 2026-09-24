"use client";
import { createContext, useContext } from "react";
import type { AppState } from "@/lib/types";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: { conflicts?: string[] },
  ) {
    super(message);
  }
}
export async function api<T = Record<string, unknown>>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method,
    headers: { "Content-Type": "application/json", "x-sidequest-csrf": "1" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(
      data.error ?? "Please try again.",
      response.status,
      data.details,
    );
  return data;
}
export type ScheduleTarget = {
  occurrenceId?: string;
  taskId?: string;
  sessionId?: string;
  title: string;
  duration: number;
  date?: string;
  time?: string;
};
export type Editor = {
  type:
    | "habit"
    | "task"
    | "schedule"
    | "recovery"
    | "plan"
    | "ai"
    | "notifications";
  id?: string;
  target?: ScheduleTarget;
  draft?: { title: string; duration: number };
} | null;
export type AppContextType = {
  data: AppState;
  reload: (date?: string) => Promise<void>;
  mutate: <T = Record<string, unknown>>(
    path: string,
    method: string,
    body?: unknown,
    message?: string,
  ) => Promise<T>;
  toast: (message: string) => void;
  editor: Editor;
  setEditor: (v: Editor) => void;
  celebrate: () => void;
  viewDate: string;
  setViewDate: (date: string) => void;
};
export const AppContext = createContext<AppContextType | null>(null);
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("Missing app context");
  return ctx;
}
