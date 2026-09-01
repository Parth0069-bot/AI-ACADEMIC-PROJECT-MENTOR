"use client";

import { useEffect } from "react";
import { RefreshCcw, Home } from "lucide-react";
import { Mascot } from "@/components/illustrations/Mascot";

/**
 * Root error boundary. Catches anything that escapes every more
 * specific boundary (e.g. app/(dashboard)/error.tsx), including
 * errors thrown by a layout itself. Deliberately has NO dependency
 * on app context (auth, theme, etc.) -- an error boundary should
 * assume as little as possible about app state still being intact,
 * so it stays plain HTML/Tailwind rather than reaching for Topbar
 * or other components that expect providers to be present.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Errors here are the ones nothing else caught -- worth a distinct
    // console signature so they're easy to spot while debugging.
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#f7f5fd] px-6 text-center">
          <div className="w-32">
            <Mascot pose="point" />
          </div>

          <div className="max-w-md">
            <h1 className="font-display text-xl font-bold text-[#1a1533]">
              Something went off script
            </h1>
            <p className="mt-2 text-sm text-[#6b6285]">
              An unexpected error interrupted this page. It&apos;s been
              logged -- try again, or head back to the dashboard.
            </p>
            {error.digest && (
              <p className="mt-2 text-xs text-[#8d84a6]">
                Reference: {error.digest}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#6d3ffb] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#5d2fe0] active:scale-[0.98]"
            >
              <RefreshCcw size={15} />
              Try again
            </button>
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-[#e9e5ff] px-5 py-2.5 text-sm font-semibold text-[#5d2fe0] transition-all hover:bg-[#d5cdff] active:scale-[0.98]"
            >
              <Home size={15} />
              Back to dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
