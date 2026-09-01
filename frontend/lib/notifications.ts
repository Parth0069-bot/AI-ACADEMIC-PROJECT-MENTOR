"use client";

/**
 * Lightweight, dependency-free notification log.
 *
 * Toasts (react-hot-toast) are ephemeral -- they vanish after a few
 * seconds. This module keeps a small persistent history of the same
 * "something important just happened" moments (idea submitted, check-in
 * logged, document downloaded, project restored, etc.) so a user can
 * open the bell icon and see what happened even after the toast is gone.
 *
 * Persisted to localStorage (per browser) -- no backend/schema changes.
 */

export type NotificationKind = "success" | "error" | "info";

export type AppNotification = {
  id: string;
  title: string;
  kind: NotificationKind;
  read: boolean;
  createdAt: number;
};

const STORAGE_KEY = "academic-mentor:notifications";
const MAX_NOTIFICATIONS = 30;
const EVENT_NAME = "academic-mentor:notifications-changed";

function isBrowser() {
  return typeof window !== "undefined";
}

function readAll(): AppNotification[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function writeAll(notifications: AppNotification[]) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  } catch {
    // localStorage can throw in private-browsing / storage-full edge cases.
    // Notifications are a nice-to-have, so we fail silently.
  }
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function getNotifications(): AppNotification[] {
  return readAll();
}

export function getUnreadCount(): number {
  return readAll().filter((n) => !n.read).length;
}

export function pushNotification(title: string, kind: NotificationKind = "success") {
  const next: AppNotification = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    kind,
    read: false,
    createdAt: Date.now(),
  };
  const all = [next, ...readAll()].slice(0, MAX_NOTIFICATIONS);
  writeAll(all);
}

export function markAllRead() {
  const all = readAll().map((n) => ({ ...n, read: true }));
  writeAll(all);
}

export function clearNotifications() {
  writeAll([]);
}

/** Subscribe to changes (same-tab custom event + cross-tab storage event). */
export function subscribeNotifications(callback: () => void): () => void {
  if (!isBrowser()) return () => {};
  const handler = () => callback();
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener("storage", handler);
  };
}
