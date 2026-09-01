"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Sparkles,
  RefreshCw,
  ChevronDown,
  Flag,
  Clock,
  Users,
  ThumbsUp,
  AlertTriangle,
  ArrowRight,
  Info,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { verdictClassName } from "@/lib/agentChain";
import type { ProjectHealthIndicator, MentorDigestResult } from "@/lib/backendClient";

const SCORE_BAR_CLASSNAME: Record<ProjectHealthIndicator["status"], string> = {
  "On Track": "from-mint-400 to-emerald-500",
  "Needs Attention": "from-amber-400 to-orange-500",
  "At Risk": "from-coral-400 to-rose-500",
  "Insufficient Data": "from-ink-300 to-ink-400",
};

function VerdictPill({ label, verdict }: { label: string; verdict: string | null }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        verdict ? verdictClassName(verdict) : "border-ink-200 bg-canvas-alt text-ink-400"
      )}
    >
      <span className="font-semibold">{label}:</span> {verdict ?? "Not run yet"}
    </span>
  );
}

export function ProjectHealthCard({
  project,
  digest,
  isGenerating,
  isLoadingDigest,
  isExpanded,
  onToggleExpand,
  onGenerateDigest,
}: {
  project: ProjectHealthIndicator;
  digest: MentorDigestResult | null;
  isGenerating: boolean;
  isLoadingDigest: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onGenerateDigest: () => void;
}) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display font-semibold text-ink-900 leading-snug truncate">
            {project.title}
          </h3>
          <p className="text-xs text-ink-400 mt-0.5 truncate" title={project.student_email ?? undefined}>
            {project.student_name}
            {project.domain ? ` • ${project.domain}` : ""}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full border",
            verdictClassName(project.status)
          )}
        >
          {project.status}
        </span>
      </div>

      <div>
        <div className="flex items-center justify-between text-[11px] text-ink-400 mb-1">
          <span>Health score</span>
          <span className="font-semibold text-ink-700 tabular-nums">{project.health_score}/100</span>
        </div>
        <div className="h-1.5 rounded-full bg-canvas-alt overflow-hidden">
          <motion.div
            className={cn("h-full rounded-full bg-gradient-to-r", SCORE_BAR_CLASSNAME[project.status])}
            initial={{ width: 0 }}
            animate={{ width: `${project.health_score}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      {project.feasibility_verdict ||
      project.risk_verdict ||
      project.timeline_verdict ||
      project.momentum_verdict ? (
        <div className="flex flex-wrap gap-1.5">
          <VerdictPill label="Feasibility" verdict={project.feasibility_verdict} />
          <VerdictPill label="Risk" verdict={project.risk_verdict} />
          <VerdictPill label="Timeline" verdict={project.timeline_verdict} />
          <VerdictPill label="Momentum" verdict={project.momentum_verdict} />
        </div>
      ) : (
        <div className="flex w-fit items-center gap-1.5 rounded-full border border-ink-200 bg-canvas-alt px-2.5 py-1 text-[11px] text-ink-400">
          <Info size={12} />
          No AI analysis run yet
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-ink-400">
        <span className="flex items-center gap-1">
          <Users size={12} />
          {project.checkins_count} check-in{project.checkins_count === 1 ? "" : "s"}
          {project.latest_checkin_week != null ? ` • week ${project.latest_checkin_week}` : ""}
          {project.latest_checkin_status ? ` • ${project.latest_checkin_status.replace("_", " ")}` : ""}
        </span>
        {project.days_since_last_activity != null && (
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {project.days_since_last_activity === 0
              ? "Active today"
              : `Active ${project.days_since_last_activity}d ago`}
          </span>
        )}
      </div>

      {project.flags.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-xl bg-canvas-alt px-3 py-2.5">
          {project.flags.map((flag) => (
            <div key={flag} className="flex items-start gap-2 text-[11px] text-ink-500">
              <Flag size={12} className="mt-0.5 shrink-0 text-amber-500" />
              <span>{flag}</span>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-primary-100/60 pt-3 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onToggleExpand}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:gap-2 transition-all disabled:opacity-50"
            disabled={!project.has_digest && !digest}
          >
            Mentor Summary
            {(project.has_digest || digest) &&
              (isLoadingDigest ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <ChevronDown
                  size={13}
                  className={cn("transition-transform", isExpanded && "rotate-180")}
                />
              ))}
          </button>

          <Button
            variant="secondary"
            className="px-3 py-1.5 text-xs"
            onClick={onGenerateDigest}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Generating...
              </>
            ) : project.has_digest || digest ? (
              <>
                <RefreshCw size={13} /> Regenerate
              </>
            ) : (
              <>
                <Sparkles size={13} /> Generate Summary
              </>
            )}
          </Button>
        </div>

        {!project.has_digest && !digest && !isGenerating && (
          <p className="text-[11px] text-ink-400">
            No summary generated yet for this project.
          </p>
        )}

        <AnimatePresence>
          {isExpanded && digest && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-3 rounded-xl border border-primary-100/60 bg-primary-50/40 p-4">
                <p className="font-display font-semibold text-sm text-ink-900">{digest.headline}</p>
                <p className="text-xs text-ink-600 leading-relaxed">{digest.summary}</p>

                {(digest.strengths.length > 0 || digest.concerns.length > 0) && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {digest.strengths.length > 0 && (
                      <div>
                        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-mint-500 mb-1.5">
                          <ThumbsUp size={12} /> Strengths
                        </p>
                        <ul className="flex flex-col gap-1">
                          {digest.strengths.map((s) => (
                            <li key={s} className="text-[11px] text-ink-500 leading-snug">
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {digest.concerns.length > 0 && (
                      <div>
                        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-coral-500 mb-1.5">
                          <AlertTriangle size={12} /> Concerns
                        </p>
                        <ul className="flex flex-col gap-1">
                          {digest.concerns.map((c) => (
                            <li key={c} className="text-[11px] text-ink-500 leading-snug">
                              {c}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {digest.recommended_action && (
                  <div className="flex items-start gap-2 rounded-lg bg-surface border border-primary-100 px-3 py-2">
                    <ArrowRight size={13} className="mt-0.5 shrink-0 text-primary-600" />
                    <p className="text-[11px] text-ink-700">
                      <span className="font-semibold">Suggested next step: </span>
                      {digest.recommended_action}
                    </p>
                  </div>
                )}

                {digest.missing_inputs.length > 0 && (
                  <p className="text-[10px] text-ink-400 italic">
                    Based on limited data: {digest.missing_inputs.join(", ")}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}
