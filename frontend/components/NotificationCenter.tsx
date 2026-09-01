"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCheck, Trash2, PartyPopper, XCircle, Info } from "lucide-react";
import {
  type AppNotification,
  getNotifications,
  getUnreadCount,
  markAllRead,
  clearNotifications,
  subscribeNotifications,
} from "@/lib/notifications";

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function KindIcon({ kind }: { kind: AppNotification["kind"] }) {
  if (kind === "error") return <XCircle size={16} className="text-coral-500" />;
  if (kind === "info") return <Info size={16} className="text-sky-500" />;
  return <PartyPopper size={16} className="text-mint-500" />;
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => {
      setItems(getNotifications());
      setUnread(getUnreadCount());
    };
    sync();
    return subscribeNotifications(sync);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function toggleOpen() {
    setOpen((v) => {
      const next = !v;
      if (next) markAllRead();
      return next;
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggleOpen}
        aria-label="Notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-surface border border-primary-100 text-ink-500 hover:text-primary-600 hover:border-primary-300 transition-colors"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral-500 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-xl bg-surface border border-primary-100 shadow-lg overflow-hidden z-30"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-primary-50">
              <p className="text-sm font-semibold text-ink-900">Notifications</p>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => clearNotifications()}
                  className="flex items-center gap-1 text-xs text-ink-400 hover:text-coral-500 transition-colors"
                >
                  <Trash2 size={12} /> Clear all
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <CheckCheck size={22} className="text-ink-300" />
                  <p className="text-sm text-ink-400">You&apos;re all caught up</p>
                </div>
              ) : (
                items.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-start gap-2.5 px-4 py-3 border-b border-primary-50 last:border-b-0 hover:bg-primary-50/60 transition-colors"
                  >
                    <div className="mt-0.5 shrink-0">
                      <KindIcon kind={n.kind} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-ink-700 leading-snug">{n.title}</p>
                      <p className="text-[11px] text-ink-400 mt-0.5">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
