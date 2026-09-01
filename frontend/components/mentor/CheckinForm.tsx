"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { notify } from "@/lib/notify";
import { Loader2, Send } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BackendError } from "@/lib/backendClient";
import { submitWeeklyCheckin, type CheckinStatus, type WeeklyCheckinResult } from "@/lib/mentorClient";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: { value: CheckinStatus; label: string; className: string }[] = [
  { value: "on_track", label: "On Track", className: "border-mint-500 bg-mint-100 text-mint-600" },
  { value: "behind", label: "Behind", className: "border-amber-500 bg-amber-100 text-amber-600" },
  { value: "blocked", label: "Blocked", className: "border-coral-500 bg-coral-100 text-coral-600" },
];

interface CheckinFormProps {
  ideaId: string;
  nextWeekNumber: number;
  onSubmitted: (result: WeeklyCheckinResult) => void;
}

export function CheckinForm({ ideaId, nextWeekNumber, onSubmitted }: CheckinFormProps) {
  const [status, setStatus] = useState<CheckinStatus>("on_track");
  const [plannedTasks, setPlannedTasks] = useState("");
  const [completedTasks, setCompletedTasks] = useState("");
  const [blockers, setBlockers] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!completedTasks.trim()) {
      toast.error("Let your mentor know what you actually got done this week.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitWeeklyCheckin(ideaId, {
        week_number: nextWeekNumber,
        status,
        planned_tasks: plannedTasks || undefined,
        completed_tasks: completedTasks,
        blockers: blockers || undefined,
        student_notes: notes || undefined,
      });
      notify.success(`Week ${nextWeekNumber} check-in submitted!`);
      onSubmitted(result);
      setPlannedTasks("");
      setCompletedTasks("");
      setBlockers("");
      setNotes("");
      setStatus("on_track");
    } catch (err) {
      toast.error(err instanceof BackendError ? err.message : "Couldn't submit your check-in -- try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-ink-900">Week {nextWeekNumber} Check-In</h3>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-2">Status</p>
          <div className="flex gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatus(opt.value)}
                className={cn(
                  "flex-1 text-xs font-semibold px-3 py-2.5 rounded-xl border-2 transition-colors",
                  status === opt.value ? opt.className : "border-ink-100 bg-canvas-alt text-ink-400 hover:border-ink-200"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1.5">
            What did you plan to do this week?
          </p>
          <textarea
            value={plannedTasks}
            onChange={(e) => setPlannedTasks(e.target.value)}
            rows={2}
            placeholder="Optional -- helps your mentor compare plan vs. reality"
            className="w-full resize-none rounded-xl border border-primary-100 bg-white px-3.5 py-2.5 text-sm text-ink-700 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1.5">
            What did you actually get done?
          </p>
          <textarea
            value={completedTasks}
            onChange={(e) => setCompletedTasks(e.target.value)}
            rows={3}
            required
            placeholder="Be specific -- this is what your mentor grounds its feedback in"
            className="w-full resize-none rounded-xl border border-primary-100 bg-white px-3.5 py-2.5 text-sm text-ink-700 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1.5">Any blockers?</p>
          <textarea
            value={blockers}
            onChange={(e) => setBlockers(e.target.value)}
            rows={2}
            placeholder="Optional"
            className="w-full resize-none rounded-xl border border-primary-100 bg-white px-3.5 py-2.5 text-sm text-ink-700 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>

        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 size={15} className="animate-spin" /> Submitting...
            </>
          ) : (
            <>
              <Send size={15} /> Submit Check-In
            </>
          )}
        </Button>
      </form>
    </Card>
  );
}
