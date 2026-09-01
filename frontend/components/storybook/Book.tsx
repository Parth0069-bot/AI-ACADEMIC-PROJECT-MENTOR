"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Loader2, Maximize2, Minimize2 } from "lucide-react";

/* =========================================================
   BOOK

   A realistic, skeuomorphic "open physical book" shell.
   Wraps whatever page content is passed in as `children`,
   animates page turns, and owns the fullscreen toggle so any
   page using this component gets it for free.
========================================================= */

interface BookProps {
  page: number;
  direction: number;
  loading?: boolean;
  loadingLabel?: string;
  children: ReactNode;
}

export function Book({
  page,
  direction,
  loading = false,
  loadingLabel = "Reading the recorded chapters...",
  children,
}: BookProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  /* Escape key shrinks the book back to normal DOM flow. */
  useEffect(() => {
    if (!isFullscreen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsFullscreen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen]);

  /* Lock page scroll while the book is fullscreen so only the
     book itself scrolls if content overflows. */
  useEffect(() => {
    if (!isFullscreen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-50 flex w-screen h-screen items-center justify-center bg-black/80 p-4 backdrop-blur-sm md:p-10"
          : "relative"
      }
    >
      <div
        className={[
          "storybook-shell relative rounded-[34px] p-3 md:p-5",
          isFullscreen
            ? "flex max-h-full w-full max-w-6xl flex-col overflow-y-auto"
            : "w-full",
        ].join(" ")}
      >
        {/* DECORATIVE INNER FRAME */}
        <div className="pointer-events-none absolute inset-3 rounded-[28px] border border-[#bda67e]/70 md:inset-5" />

        {/* CENTER FOLD / SPINE — realistic gradient, not a flat line */}
        <div className="storybook-spine pointer-events-none absolute bottom-7 left-1/2 top-7 z-40 hidden w-10 -translate-x-1/2 md:block" />

        {/* FULLSCREEN TOGGLE — top-right corner of the book */}
        <button
          type="button"
          onClick={() => setIsFullscreen((value) => !value)}
          aria-label={isFullscreen ? "Shrink book" : "Expand book to fullscreen"}
          title={isFullscreen ? "Shrink" : "Expand"}
          className="absolute right-6 top-6 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-[#d2c0a1] bg-[#fbf5e9]/90 text-[#725b3d] shadow-[0_4px_10px_rgba(83,63,37,0.25)] backdrop-blur transition hover:scale-105 hover:bg-[#fbf5e9] active:scale-95"
        >
          {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        </button>

        <div
          className={[
            "storybook-page-surface relative overflow-hidden rounded-[25px] border border-[#d2c0a1]",
            isFullscreen ? "flex-1" : "",
          ].join(" ")}
          style={{ perspective: "1800px" }}
        >
          {/* subtle curl shading near the outer edges of the leaves */}
          <div className="storybook-curve-left pointer-events-none absolute inset-y-0 left-0 z-30 hidden w-10 md:block" />
          <div className="storybook-curve-right pointer-events-none absolute inset-y-0 right-0 z-30 hidden w-10 md:block" />

          {loading ? (
            <div className="flex min-h-[720px] items-center justify-center">
              <div className="text-center">
                <BookOpen size={32} className="mx-auto text-[#b39b75]" />

                <Loader2
                  size={17}
                  className="mx-auto mt-4 animate-spin text-[#9b8059]"
                />

                <p className="mt-3 font-serif text-sm text-[#8d7b61]">
                  {loadingLabel}
                </p>
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={page}
                custom={direction}
                initial={{
                  opacity: 0,
                  rotateY: direction > 0 ? -16 : 16,
                  x: direction > 0 ? 35 : -35,
                }}
                animate={{ opacity: 1, rotateY: 0, x: 0 }}
                exit={{
                  opacity: 0,
                  rotateY: direction > 0 ? 16 : -16,
                  x: direction > 0 ? -35 : 35,
                }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="min-h-[720px] [transform-style:preserve-3d]"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
