"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { GraduationCap, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS } from "@/lib/navigation";
import { OrbitIcon } from "@/components/navigation/OrbitIcon";

/**
 * The mobile counterpart to components/layout/Sidebar.tsx. The
 * Sidebar is `hidden md:flex` -- below that breakpoint there was
 * previously no way to reach any section of the app except whatever
 * page a Topbar link happened to point to. This renders as a
 * slide-in drawer from a hamburger button in the Topbar (mobile-only
 * there too), sharing the exact same NAV_SECTIONS data as the
 * desktop Sidebar so the two surfaces can never list different
 * sections or fall out of sync.
 */
export function MobileNav({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  // Close automatically on navigation, and keep the page from
  // scrolling behind the open drawer.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-[2px] md:hidden"
            aria-hidden="true"
          />

          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="fixed inset-y-0 left-0 z-50 flex w-[85vw] max-w-80 flex-col bg-surface px-5 py-6 shadow-2xl md:hidden"
          >
            {/* LOGO + CLOSE */}
            <div className="mb-8 flex items-center justify-between px-1">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-100 text-primary-600">
                  <GraduationCap size={21} strokeWidth={2} />
                </div>
                <div className="leading-tight">
                  <p className="font-display font-bold text-sm text-ink-900">
                    AI Academic
                  </p>
                  <p className="font-display text-xs text-ink-400">
                    Project Mentor
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-primary-50 hover:text-primary-600"
              >
                <X size={19} />
              </button>
            </div>

            {/* NAVIGATION */}
            <nav className="flex-1 overflow-y-auto pr-1">
              {NAV_SECTIONS.map((section) => (
                <div key={section.title} className="mb-6">
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
                            "flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium transition-all",
                            active
                              ? "bg-primary-100 text-primary-600"
                              : "text-ink-500 hover:bg-primary-50 hover:text-primary-600"
                          )}
                        >
                          {isOrbit ? (
                            <span className="-ml-2">
                              <OrbitIcon active={active} size={18} />
                            </span>
                          ) : (
                            <Icon
                              size={18}
                              strokeWidth={1.8}
                              className={active ? "text-primary-600" : "text-ink-400"}
                            />
                          )}
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
