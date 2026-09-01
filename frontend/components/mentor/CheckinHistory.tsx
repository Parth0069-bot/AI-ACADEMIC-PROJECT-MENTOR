"use client";

import { CalendarClock, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { WeeklyCheckinOut } from "@/lib/mentorClient";
import { cn } from "@/lib/utils";

const STATUS_CLASSNAMES: Record<string, string> = {
  on_track: "border-mint-500 bg-mint-100 text-mint-600",
  behind: "border-amber-500 bg-amber-100 text-amber-600",
  blocked: "border-coral-500 bg-coral-100 text-coral-600",
};

const STATUS_LABELS: Record<string, string> = {
  on_track: "On Track",
  behind: "Behind",
  blocked: "Blocked",
};

interface CheckinHistoryProps {
  checkins: WeeklyCheckinOut[];
}

export function CheckinHistory({ checkins }: CheckinHistoryProps) {
  if (checkins.length === 0) {
    return (
      <Card className="flex flex-col items-center text-center py-10">
        <CalendarClock size={22} className="text-primary-300 mb-2" />
        <p className="text-sm text-ink-400">No check-ins yet -- submit your first one to get started.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {checkins.map((c) => (
        <Card key={c.id} className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-display font-semibold text-ink-900">Week {c.week_number}</span>
            <span
              className={cn(
                "text-[10px] font-semibold px-2.5 py-1 rounded-full border",
                STATUS_CLASSNAMES[c.status] ?? "border-ink-200 bg-canvas-alt text-ink-500"
              )}
            >
              {STATUS_LABELS[c.status] ?? c.status}
            </span>
          </div>

          <p className="text-[11px] text-ink-500 leading-relaxed">
            <span className="font-semibold text-ink-600">Completed: </span>
            {c.completed_tasks}
          </p>

          {c.blockers && (
            <p className="text-[11px] text-ink-500 leading-relaxed">
              <span className="font-semibold text-ink-600">Blockers: </span>
              {c.blockers}
            </p>
          )}

          {c.mentor_message && (
            <div className="bg-primary-50/60 rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary-600 mb-1">Mentor</p>
              <p className="text-[11px] text-ink-600 leading-relaxed">{c.mentor_message}</p>
            </div>
          )}

          {c.timeline_adjusted && c.adjusted_plan && (
            <div className="bg-amber-50 rounded-xl p-3 flex flex-col gap-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1">
                <ArrowRight size={11} /> Timeline Adjusted
              </p>
              <p className="text-[11px] text-ink-600 leading-relaxed">{c.adjusted_plan}</p>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
