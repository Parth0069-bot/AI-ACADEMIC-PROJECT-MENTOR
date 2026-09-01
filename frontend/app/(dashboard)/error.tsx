"use client";

import { useEffect } from "react";
import { RefreshCcw, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Mascot } from "@/components/illustrations/Mascot";

/**
 * Scoped to the (dashboard) route group. The parent layout
 * (app/(dashboard)/layout.tsx) keeps rendering around this -- Sidebar
 * and AuthProvider stay mounted -- so a crash on one page (e.g. the
 * Viva Studio or a document generator) doesn't strand the student
 * without navigation the way falling through to the root error
 * boundary would.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DashboardError]", error);
  }, [error]);

  return (
    <div className="px-6 md:px-10 py-10">
      <Card className="mx-auto flex max-w-xl flex-col items-center justify-center py-14 text-center">
        <Mascot pose="point" className="w-32" />
        <p className="mt-4 font-display font-semibold text-ink-900">
          This page hit a snag
        </p>
        <p className="mt-1 max-w-sm text-sm text-ink-400">
          Something went wrong loading this section. Your other data is safe
          -- try again, or head back to the dashboard.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-ink-300">Reference: {error.digest}</p>
        )}

        <div className="mt-6 flex items-center gap-3">
          <Button onClick={() => reset()}>
            <RefreshCcw size={15} />
            Try again
          </Button>
          <Link href="/dashboard">
            <Button variant="secondary">
              <LayoutDashboard size={15} />
              Dashboard
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
