"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/lib/useCountUp";

const TONES = {
  primary: {
    badge: "bg-gradient-to-br from-primary-500 to-primary-700 text-white",
    glow: "glow-primary",
    ring: "hover:border-primary-300/70",
    trend: "text-primary-600",
  },
  mint: {
    badge: "bg-gradient-to-br from-mint-500 to-emerald-600 text-white",
    glow: "glow-mint",
    ring: "hover:border-mint-500/50",
    trend: "text-mint-500",
  },
  amber: {
    badge: "bg-gradient-to-br from-amber-500 to-orange-600 text-white",
    glow: "glow-amber",
    ring: "hover:border-amber-500/50",
    trend: "text-amber-500",
  },
  sky: {
    badge: "bg-gradient-to-br from-sky-500 to-blue-600 text-white",
    glow: "glow-sky",
    ring: "hover:border-sky-500/50",
    trend: "text-sky-500",
  },
  coral: {
    badge: "bg-gradient-to-br from-coral-500 to-rose-600 text-white",
    glow: "glow-coral",
    ring: "hover:border-coral-500/50",
    trend: "text-coral-500",
  },
} as const;

export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  tone = "primary",
  trend,
}: {
  label: string;
  value: number;
  sublabel: string;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  /** Optional short trend string, e.g. "+3 this week" */
  trend?: string;
}) {
  const t = TONES[tone];
  const animatedValue = useCountUp(value);

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={cn(
        "gradient-ring relative flex-1 min-w-[160px] rounded-2xl bg-surface border border-primary-100/60 p-5 overflow-hidden",
        "shadow-[0_2px_16px_rgba(109,63,251,0.05)] transition-[border-color,box-shadow] duration-300",
        "hover:shadow-[0_16px_40px_-12px_rgba(109,63,251,0.25)]",
        t.ring
      )}
    >
      {/* faint decorative corner glow, purely cosmetic */}
      <div
        className={cn(
          "absolute -top-6 -right-6 h-20 w-20 rounded-full opacity-[0.12] blur-2xl pointer-events-none",
          t.badge
        )}
      />

      <div className="relative flex items-start justify-between">
        <motion.div
          whileHover={{ rotate: -6, scale: 1.08 }}
          transition={{ type: "spring", stiffness: 400, damping: 12 }}
          className={cn("h-10 w-10 rounded-xl flex items-center justify-center", t.badge, t.glow)}
        >
          <Icon size={18} />
        </motion.div>

        {trend && (
          <span className={cn("flex items-center gap-1 text-[10px] font-semibold", t.trend)}>
            <TrendingUp size={11} /> {trend}
          </span>
        )}
      </div>

      <p
        key={value}
        className="font-display text-3xl font-bold text-ink-900 mt-3 tabular-nums"
        style={{ animation: "count-pop 0.4s ease-out" }}
      >
        {animatedValue}
      </p>
      <p className="text-xs font-semibold text-ink-700 mt-0.5">{label}</p>
      <p className="text-[11px] text-ink-400 mt-0.5">{sublabel}</p>
    </motion.div>
  );
}
