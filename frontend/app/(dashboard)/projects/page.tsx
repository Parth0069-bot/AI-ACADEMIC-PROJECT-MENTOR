"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  Plus,
  Loader2,
  Clock,
  FolderKanban,
  Gauge,
  Users,
  Layers,
  Sparkles,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { runFeasibilityAnalysis, BackendError } from "@/lib/backendClient";
import { cn } from "@/lib/utils";
import type { ProjectIdea, Difficulty, AgentFeedback } from "@/lib/types";

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-sky-100 text-sky-500" },
  Pending: { label: "Pending", className: "bg-sky-100 text-sky-500" },
  submitted: { label: "Submitted", className: "bg-sky-100 text-sky-500" },
  Submitted: { label: "Submitted", className: "bg-sky-100 text-sky-500" },
  under_review: { label: "Under Review", className: "bg-amber-100 text-amber-500" },
  "Under Review": { label: "Under Review", className: "bg-amber-100 text-amber-500" },
  approved: { label: "Approved", className: "bg-mint-100 text-mint-500" },
  Approved: { label: "Approved", className: "bg-mint-100 text-mint-500" },
};

const DIFFICULTY_META: Record<Difficulty, string> = {
  Easy: "bg-mint-100 text-mint-500",
  Medium: "bg-amber-100 text-amber-500",
  Hard: "bg-coral-100 text-coral-500",
};

const VERDICT_META: Record<string, { className: string }> = {
  Feasible: { className: "border-mint-500 bg-mint-100 text-mint-500" },
  "Feasible with Adjustments": { className: "border-amber-500 bg-amber-100 text-amber-500" },
  "Not Feasible": { className: "border-coral-500 bg-coral-100 text-coral-500" },
};

const TABS = ["All", "Pending", "Submitted", "Under Review", "Approved"] as const;

function statusMeta(status: string) {
  return STATUS_META[status] ?? { label: status || "Pending", className: "bg-canvas-alt text-ink-500" };
}

export default function ProjectsPage() {
  const { profile } = useAuth();
  const [ideas, setIdeas] = useState<ProjectIdea[]>([]);
  const [feedbackByIdea, setFeedbackByIdea] = useState<Record<string, AgentFeedback>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const loadFeedback = useCallback(async (ideaIds: string[]) => {
    if (ideaIds.length === 0) return;

    const { data, error } = await supabase
      .from("agent_feedback")
      .select("*")
      .in("idea_id", ideaIds)
      .eq("agent_name", "feasibility_agent")
      .order("created_at", { ascending: false });

    if (error || !data) return;

    const latest: Record<string, AgentFeedback> = {};
    for (const row of data as AgentFeedback[]) {
      if (!latest[row.idea_id]) latest[row.idea_id] = row;
    }
    setFeedbackByIdea(latest);
  }, []);

  const loadIdeas = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("project_ideas")
      .select("*")
      .eq("student_id", profile.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setIdeas(data as ProjectIdea[]);
      await loadFeedback((data as ProjectIdea[]).map((i) => i.id));
    }
    setLoading(false);
  }, [profile, loadFeedback]);

  useEffect(() => {
    loadIdeas();
  }, [loadIdeas]);

  async function handleAnalyze(ideaId: string) {
    setAnalyzingIds((prev) => new Set(prev).add(ideaId));

    try {
      const run = await runFeasibilityAnalysis(ideaId);
      toast.success("Feasibility analysis complete!");
      setFeedbackByIdea((prev) => ({
        ...prev,
        [ideaId]: {
          id: run.feedback_id ?? `local-${ideaId}`,
          idea_id: ideaId,
          agent_name: "feasibility_agent",
          verdict: run.result.verdict as AgentFeedback["verdict"],
          confidence_score: run.result.confidence_score,
          reasoning: run.result.reasoning,
          skill_gaps: run.result.skill_gaps,
          suggested_adjustments: run.result.suggested_adjustments,
          model_used: run.model_used,
          created_at: run.generated_at,
        },
      }));
      setExpandedIds((prev) => new Set(prev).add(ideaId));
      if (!run.stored) {
        toast.error("Result came back but wasn't saved to the database — try again shortly.");
      }
    } catch (err) {
      if (err instanceof BackendError) {
        toast.error(err.message);
      } else {
        toast.error("Something went wrong running the analysis.");
      }
    } finally {
      setAnalyzingIds((prev) => {
        const next = new Set(prev);
        next.delete(ideaId);
        return next;
      });
    }
  }

  function toggleExpanded(ideaId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(ideaId)) next.delete(ideaId);
      else next.add(ideaId);
      return next;
    });
  }

  const filtered = ideas.filter((idea) => {
    if (tab === "All") return true;
    const label = statusMeta(idea.status).label;
    return label === tab;
  });

  return (
    <>
      <Topbar title="My Projects" subtitle="Track and manage your submitted ideas" />

      <div className="px-6 md:px-10 pb-10">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-full px-4 py-2 text-xs font-semibold transition-colors",
                  tab === t
                    ? "bg-primary-600 text-white"
                    : "bg-white border border-primary-100 text-ink-500 hover:bg-primary-50"
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <Link href="/submit-idea">
            <Button>
              <Plus size={15} /> New Project
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-ink-400 gap-2">
            <Loader2 size={18} className="animate-spin" /> Loading your projects...
          </div>
        ) : filtered.length === 0 ? (
          <Card className="flex flex-col items-center text-center py-16">
            <div className="h-12 w-12 rounded-full bg-primary-50 flex items-center justify-center text-primary-500 mb-3">
              <FolderKanban size={22} />
            </div>
            <p className="font-display font-semibold text-ink-900">No projects yet</p>
            <p className="text-sm text-ink-400 mt-1 mb-4">
              Submit your first idea and it&apos;ll show up here.
            </p>
            <Link href="/submit-idea">
              <Button>
                <Plus size={15} /> Submit an Idea
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((idea, i) => {
              const status = statusMeta(idea.status);
              const feedback = feedbackByIdea[idea.id];
              const isAnalyzing = analyzingIds.has(idea.id);
              const isExpanded = expandedIds.has(idea.id);
              const verdictStyle = feedback?.verdict
                ? VERDICT_META[feedback.verdict]?.className ?? "border-ink-300 bg-canvas-alt text-ink-500"
                : "";

              return (
                <motion.div
                  key={idea.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="h-full flex flex-col hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-display font-semibold text-ink-900 leading-snug">
                        {idea.title}
                      </h3>
                      <span
                        className={cn(
                          "text-[10px] font-semibold px-2 py-1 rounded-full shrink-0",
                          status.className
                        )}
                      >
                        {status.label}
                      </span>
                    </div>

                    {idea.domain && (
                      <div className="flex items-center gap-1.5 text-[11px] text-primary-600 font-medium mb-2">
                        <Layers size={12} /> {idea.domain}
                      </div>
                    )}

                    <p className="text-sm text-ink-500 line-clamp-3 flex-1">
                      {idea.description}
                    </p>

                    {idea.tech_stack && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {idea.tech_stack.split(",").map((t) => (
                          <span
                            key={t}
                            className="text-[11px] bg-canvas-alt text-ink-500 px-2 py-1 rounded-full"
                          >
                            {t.trim()}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                      {idea.difficulty && (
                        <span
                          className={cn(
                            "flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full",
                            DIFFICULTY_META[idea.difficulty]
                          )}
                        >
                          <Gauge size={10} /> {idea.difficulty}
                        </span>
                      )}
                      {idea.duration && (
                        <span className="flex items-center gap-1 text-[10px] text-ink-400">
                          <Clock size={10} /> {idea.duration}
                        </span>
                      )}
                      {idea.team_size && (
                        <span className="flex items-center gap-1 text-[10px] text-ink-400">
                          <Users size={10} /> {idea.team_size}{" "}
                          {idea.team_size === 1 ? "member" : "members"}
                        </span>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-primary-50">
                      {!feedback ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="w-full !py-2 text-xs"
                          disabled={isAnalyzing}
                          onClick={() => handleAnalyze(idea.id)}
                        >
                          {isAnalyzing ? (
                            <>
                              <Loader2 size={13} className="animate-spin" /> Analyzing with AI...
                            </>
                          ) : (
                            <>
                              <Sparkles size={13} /> Analyze Feasibility
                            </>
                          )}
                        </Button>
                      ) : (
                        <div>
                          <button
                            type="button"
                            onClick={() => toggleExpanded(idea.id)}
                            className="w-full flex items-center justify-between gap-2"
                          >
                            <span
                              className={cn(
                                "flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-full border",
                                verdictStyle
                              )}
                            >
                              <Sparkles size={11} /> {feedback.verdict}
                              {feedback.confidence_score != null && (
                                <span className="opacity-70">· {feedback.confidence_score}%</span>
                              )}
                            </span>
                            <ChevronDown
                              size={14}
                              className={cn(
                                "text-ink-300 transition-transform",
                                isExpanded && "rotate-180"
                              )}
                            />
                          </button>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="pt-3 flex flex-col gap-2">
                                  {feedback.reasoning && (
                                    <p className="text-[11px] text-ink-500 leading-relaxed">
                                      {feedback.reasoning}
                                    </p>
                                  )}
                                  {feedback.skill_gaps && feedback.skill_gaps.length > 0 && (
                                    <div>
                                      <p className="text-[10px] font-semibold text-ink-400 mb-1">
                                        SKILL GAPS
                                      </p>
                                      <div className="flex flex-wrap gap-1">
                                        {feedback.skill_gaps.map((gap) => (
                                          <span
                                            key={gap}
                                            className="text-[10px] bg-coral-100 text-coral-500 px-2 py-0.5 rounded-full"
                                          >
                                            {gap}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {feedback.suggested_adjustments && (
                                    <div>
                                      <p className="text-[10px] font-semibold text-ink-400 mb-1">
                                        SUGGESTED
                                      </p>
                                      <p className="text-[11px] text-ink-500 leading-relaxed">
                                        {feedback.suggested_adjustments}
                                      </p>
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleAnalyze(idea.id)}
                                    disabled={isAnalyzing}
                                    className="flex items-center gap-1.5 text-[10px] text-primary-600 font-medium mt-1 hover:underline disabled:opacity-50"
                                  >
                                    {isAnalyzing ? (
                                      <Loader2 size={11} className="animate-spin" />
                                    ) : (
                                      <RefreshCw size={11} />
                                    )}
                                    Re-analyze
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-ink-300 mt-3 pt-3 border-t border-primary-50">
                      <Clock size={11} />
                      {new Date(idea.created_at).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
