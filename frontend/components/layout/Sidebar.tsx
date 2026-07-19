"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  User,
  ListChecks,
  FolderKanban,
  Lightbulb,
  Bot,
  TrendingUp,
  Settings,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Profile", href: "/profile", icon: User },
  { label: "Skills", href: "/skills", icon: ListChecks },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Submit Idea", href: "/submit-idea", icon: Lightbulb },
  { label: "AI Mentor", href: "/mentor", icon: Bot },
  { label: "Progress", href: "/progress", icon: TrendingUp },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 shrink-0 flex-col border-r border-primary-100 bg-white px-4 py-6">
      <div className="flex items-center gap-2 px-2 mb-8">
        <motion.div
          whileHover={{ rotate: -8, scale: 1.05 }}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white"
        >
          <GraduationCap size={20} />
        </motion.div>
        <div className="leading-tight">
          <p className="font-display font-bold text-sm text-ink-900">AI Academic</p>
          <p className="font-display text-[11px] text-ink-400 -mt-0.5">Project Mentor</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((navItem) => {
          const active = pathname === navItem.href;
          const Icon = navItem.icon;
          return (
            <Link
              key={navItem.href}
              href={navItem.href}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "text-white"
                  : "text-ink-500 hover:bg-primary-50 hover:text-primary-700"
              )}
            >
              {active && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl bg-primary-600 shadow-sm shadow-primary-200"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <Icon size={18} strokeWidth={2} className="relative z-10" />
              <span className="relative z-10">{navItem.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-2xl bg-canvas-alt p-4 text-center">
        <p className="text-xs text-ink-500 leading-relaxed">
          Keep building — every skill logged gets you closer to your next project.
        </p>
      </div>
    </aside>
  );
}
