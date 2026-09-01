import Link from "next/link";
import { Home, Compass } from "lucide-react";
import { Mascot } from "@/components/illustrations/Mascot";

/**
 * Renders inside the root layout (ThemeProvider/Toaster are present
 * here, unlike app/error.tsx), so ordinary Tailwind theme classes
 * are safe to use and dark mode is respected automatically.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-canvas px-6 text-center">
      <div className="w-36">
        <Mascot pose="graduate" />
      </div>

      <div className="max-w-md">
        <p className="font-display text-5xl font-bold text-primary-300">404</p>
        <h1 className="mt-2 font-display text-xl font-bold text-ink-900">
          This page wandered off the syllabus
        </h1>
        <p className="mt-2 text-sm text-ink-400">
          The page you&apos;re looking for doesn&apos;t exist, or may have
          moved. Let&apos;s get you back on track.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary-200 transition-all hover:bg-primary-700 active:scale-[0.98]"
        >
          <Home size={15} />
          Back to dashboard
        </Link>
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 rounded-xl bg-primary-50 px-5 py-2.5 text-sm font-semibold text-primary-700 transition-all hover:bg-primary-100 active:scale-[0.98]"
        >
          <Compass size={15} />
          My projects
        </Link>
      </div>
    </div>
  );
}
