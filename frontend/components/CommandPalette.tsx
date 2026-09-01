"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, CornerDownLeft, ArrowUp, ArrowDown } from "lucide-react";
import { NAV_SECTIONS, type NavItem } from "@/lib/navigation";

type FlatItem = NavItem & { section: string };

const ALL_ITEMS: FlatItem[] = NAV_SECTIONS.flatMap((section) =>
  section.items.map((item) => ({ ...item, section: section.title }))
);

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Reset the search state whenever the palette transitions open/closed
  // or the query changes -- done during render (React's recommended
  // pattern for derived state) rather than in an effect, to avoid an
  // extra cascading-render setState-in-effect.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setQuery("");
      setActiveIndex(0);
    }
  }
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setActiveIndex(0);
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_ITEMS;
    return ALL_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.section.toLowerCase().includes(q)
    );
  }, [query]);

  // Global Cmd/Ctrl+K shortcut to open the palette from anywhere.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(true);
      }
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange]);

  useEffect(() => {
    if (open) {
      // Wait for the entrance animation to mount the input.
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  function go(item: FlatItem) {
    router.push(item.href);
    onOpenChange(false);
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[activeIndex];
      if (item) go(item);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm"
          />

          <motion.div
            key="palette"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="fixed left-1/2 top-24 z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-2xl border border-primary-100 bg-surface shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-primary-50 px-4 py-3.5">
              <Search size={18} className="shrink-0 text-ink-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Jump to a page..."
                className="w-full bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none"
              />
              <kbd className="hidden sm:block shrink-0 rounded border border-primary-100 bg-canvas px-1.5 py-0.5 text-[10px] font-medium text-ink-400">
                Esc
              </kbd>
            </div>

            <div className="max-h-80 overflow-y-auto py-2">
              {results.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-ink-400">
                  No pages match &quot;{query}&quot;
                </p>
              ) : (
                results.map((item, index) => {
                  const Icon = item.icon;
                  const active = index === activeIndex;
                  return (
                    <button
                      key={item.href}
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => go(item)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                        active
                          ? "bg-primary-100 text-primary-700"
                          : "text-ink-600 hover:bg-primary-50"
                      }`}
                    >
                      <Icon size={16} className={active ? "text-primary-600" : "text-ink-400"} />
                      <span className="flex-1 truncate">{item.label}</span>
                      <span className="text-[11px] text-ink-400">{item.section}</span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="hidden sm:flex items-center gap-4 border-t border-primary-50 px-4 py-2.5 text-[11px] text-ink-400">
              <span className="flex items-center gap-1">
                <ArrowUp size={12} /> <ArrowDown size={12} /> Navigate
              </span>
              <span className="flex items-center gap-1">
                <CornerDownLeft size={12} /> Select
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
