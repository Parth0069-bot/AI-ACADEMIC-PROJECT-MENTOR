"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS } from "@/lib/navigation";
import { OrbitIcon } from "@/components/navigation/OrbitIcon";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-80 shrink-0 flex-col border-r border-primary-100 bg-surface px-5 py-6 min-h-screen">

      {/* LOGO */}
      <div className="flex items-center gap-3 px-3 mb-8">
        <motion.div
          whileHover={{ rotate: -5, scale: 1.05 }}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-100 text-primary-600"
        >
          <GraduationCap size={23} strokeWidth={2} />
        </motion.div>

        <div className="leading-tight">
          <p className="font-display font-bold text-base text-ink-900">
            AI Academic
          </p>

          <p className="font-display text-xs text-ink-400">
            Project Mentor
          </p>
        </div>
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 overflow-y-auto pr-1">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-7">

            {/* SECTION TITLE */}
            <p className="px-3 mb-3 text-[10px] font-bold tracking-[0.18em] text-ink-400">
              {section.title}
            </p>

            <div className="flex flex-col gap-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isOrbit = item.label === "Project Orbit";

                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium transition-all",
                      active
                        ? "bg-primary-100 text-primary-600"
                        : "text-ink-500 hover:bg-primary-50 hover:text-primary-600"
                    )}
                  >
                    {active && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-primary-500"
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 32,
                        }}
                      />
                    )}

                    {isOrbit ? (
                      <span className="relative z-10 -ml-2">
                        <OrbitIcon active={active} size={18} />
                      </span>
                    ) : (
                      <Icon
                        size={18}
                        strokeWidth={1.8}
                        className={cn(
                          "relative z-10",
                          active
                            ? "text-primary-600"
                            : "text-ink-400"
                        )}
                      />
                    )}

                    <span className="relative z-10">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* BOTTOM MESSAGE */}
      <div className="mt-4 rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50 to-white p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles
            size={15}
            className="text-primary-500"
          />

          <p className="text-xs font-semibold text-ink-700">
            Keep building
          </p>
        </div>

        <p className="text-[11px] leading-relaxed text-ink-400">
          Every idea, skill and milestone brings your project one step closer.
        </p>
      </div>
    </aside>
  );
}