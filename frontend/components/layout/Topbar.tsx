"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Search, LogOut, User } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export function Topbar({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const firstName = profile?.name?.split(" ")[0] ?? "";
  const initials = profile?.name
    ? profile.name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function handleLogout() {
    await signOut();
    router.push("/login");
  }

  const resolvedTitle = title.replace("{name}", firstName);

  return (
    <header className="flex items-center justify-between px-6 md:px-10 py-6">
      <div>
        <h1 className="font-display text-xl md:text-2xl font-bold text-ink-900">
          {resolvedTitle}
        </h1>
        {subtitle && <p className="text-sm text-ink-400 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 rounded-full bg-white border border-primary-100 px-4 py-2 text-sm text-ink-400 w-56">
          <Search size={16} />
          <span>Search anything...</span>
        </div>
        <button
          type="button"
          aria-label="Notifications"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-primary-100 text-ink-500 hover:text-primary-600 hover:border-primary-300 transition-colors"
        >
          <Bell size={18} />
        </button>

        <div className="relative" ref={menuRef}>
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => setOpen((v) => !v)}
            className="h-10 w-10 rounded-full bg-primary-200 flex items-center justify-center font-display font-semibold text-primary-700 text-sm hover:ring-2 hover:ring-primary-300 transition-all"
          >
            {initials}
          </motion.button>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-48 rounded-xl bg-white border border-primary-100 shadow-lg overflow-hidden z-20"
              >
                <div className="px-4 py-3 border-b border-primary-50">
                  <p className="text-sm font-semibold text-ink-900 truncate">
                    {profile?.name ?? "Student"}
                  </p>
                  <p className="text-xs text-ink-400 truncate">{profile?.email}</p>
                </div>
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-ink-600 hover:bg-primary-50 transition-colors"
                >
                  <User size={15} /> View Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-coral-500 hover:bg-coral-100 transition-colors"
                >
                  <LogOut size={15} /> Log Out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
