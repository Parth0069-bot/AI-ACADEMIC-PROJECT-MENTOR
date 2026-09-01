"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { notify } from "@/lib/notify";
import {
  Plus,
  Loader2,
  Clock,
  FolderKanban,
  Gauge,
  Users,
  Layers,
  Trash2,
} from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { deleteIdea, BackendError, runTeamMomentumAnalysis, type TeamMomentumIn } from "@/lib/backendClient";
import {
  AGENT_ORDER,
  AGENT_RUNNERS,
  AGENT_META,
  type FeedbackByAgent,
  type AgentRunResult,
} from "@/lib/agentChain";
import { AgentChainPanel } from "@/components/projects/AgentChainPanel";
import { cn } from "@/lib/utils";
import type { ProjectIdea, Difficulty, AgentFeedback, AgentName } from "@/lib/types";

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

const TABS = ["All", "Pending", "Submitted", "Under Review", "Approved"] as const;

function statusMeta(status: string) {
  return STATUS_META[status] ?? { label: status || "Pending", className: "bg-canvas-alt text-ink-500" };
}

export default function ProjectsPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const [analyzingKeys, setAnalyzingKeys] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data: ideas, error: ideasError, mutate: mutateIdeas } = useSWR(
    profile ? `projects:${profile.id}` : null,
    async () => {
      const { data, error } = await supabase
        .from("project_ideas")
        .select("*")
        .eq("student_id", profile!.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ProjectIdea[];
    }
  );

  const ideaIds = ideas ? ideas.map((i) => i.id) : [];

  const { data: feedbackByIdea = {}, mutate: mutateFeedback } = useSWR(
    ideaIds.length > 0 ? `feedback:${ideaIds.join(",")}` : null,
    async () => {
      const { data, error } = await supabase
        .from("agent_feedback")
        .select("*")
        .in("idea_id", ideaIds)
        .order("created_at", { ascending: false });

      if (error || !data) return {};

      const latest: Record<string, FeedbackByAgent> = {};
      for (const row of data as AgentFeedback[]) {
        const agentName = row.agent_name as AgentName;
        if (!latest[row.idea_id]) latest[row.idea_id] = {};
        if (!latest[row.idea_id][agentName]) {
          latest[row.idea_id][agentName] = row;
        }
      }
      return latest;
    }
  );

  /** Shared bookkeeping (optimistic feedback update, toasts, expand) for any agent run. */
  function applyAgentRun(ideaId: string, agentName: AgentName, run: AgentRunResult) {
    notify.success(`${AGENT_META[agentName].label} analysis complete!`);
    mutateFeedback((prev: Record<string, FeedbackByAgent> | undefined) => {
      const next: Record<string, FeedbackByAgent> = { ...(prev || {}) };
      next[ideaId] = { ...next[ideaId] };
      next[ideaId][agentName] = {
        id: run.feedback_id ?? `local-${ideaId}-${agentName}`,
        idea_id: ideaId,
        agent_name: agentName,
        verdict: run.result.verdict,
        confidence_score: run.result.confidence_score,
        reasoning: run.result.reasoning,
        skill_gaps: run.result.skill_gaps ?? null,
        suggested_adjustments: run.result.suggested_adjustments ?? null,
        model_used: run.model_used,
        created_at: run.generated_at,
        details: run.result,
      };
      return next;
    }, false);

    setExpandedIds((prev) => new Set(prev).add(ideaId));
    if (!run.stored) {
      toast.error("Result came back but wasn't saved to the database — try again shortly.");
    }
  }

  async function handleRunAgent(ideaId: string, agentName: AgentName) {
    const key = `${ideaId}:${agentName}`;
    setAnalyzingKeys((prev) => new Set(prev).add(key));

    try {
      const run = await AGENT_RUNNERS[agentName](ideaId);
      applyAgentRun(ideaId, agentName, run);
    } catch (err) {
      if (err instanceof BackendError) {
        toast.error(err.message);
      } else {
        toast.error(`Something went wrong running the ${AGENT_META[agentName].label} analysis.`);
      }
    } finally {
      setAnalyzingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  /**
   * Team Momentum needs commit activity supplied by the caller (no live
   * repo integration on this platform), so it gets its own handler rather
   * than going through the generic AGENT_RUNNERS[agentName](ideaId) shape.
   */
  async function handleRunTeamMomentum(ideaId: string, commitData: TeamMomentumIn) {
    const agentName: AgentName = "team_momentum_agent";
    const key = `${ideaId}:${agentName}`;
    setAnalyzingKeys((prev) => new Set(prev).add(key));

    try {
      const run = await runTeamMomentumAnalysis(ideaId, commitData);
      applyAgentRun(ideaId, agentName, run as unknown as AgentRunResult);
    } catch (err) {
      if (err instanceof BackendError) {
        toast.error(err.message);
      } else {
        toast.error(`Something went wrong running the ${AGENT_META[agentName].label} analysis.`);
      }
    } finally {
      setAnalyzingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
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

  function makeIsKeyAnalyzing(ideaId: string) {
    return (agentName: AgentName) => analyzingKeys.has(`${ideaId}:${agentName}`);
  }

  const filtered = (ideas || []).filter((idea) => {
    if (tab === "All") return true;
    const label = statusMeta(idea.status).label;
    return label === tab;
  });

  const handleDeleteIdea = async (ideaId: string) => {
    if (!window.confirm("Are you sure you want to delete this project? This cannot be undone.")) {
      return;
    }
    
    // Optimistic delete for snappy UI
    if (ideas) mutateIdeas(ideas.filter((i) => i.id !== ideaId), false);
    
    try {
      await deleteIdea(ideaId);
      notify.success("Project deleted successfully");
      mutateIdeas();
      mutateFeedback();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete project");
      mutateIdeas(); // revert optimistic delete
    }
  };

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

        {ideasError ? (
          <div className="flex flex-col items-center justify-center py-24 text-coral-500 gap-3">
            <div className="p-3 bg-coral-50 rounded-full">
              <span className="font-bold text-lg">!</span>
            </div>
            <p className="font-semibold text-ink-900">Failed to load projects</p>
            <p className="text-sm max-w-md text-center">
              {ideasError.message || "An unknown error occurred. If you recently updated the app, make sure you ran the SQL command to add the deleted_at column in Supabase."}
            </p>
          </div>
        ) : !ideas ? (
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
              const feedback: FeedbackByAgent = feedbackByIdea[idea.id] ?? {};
              const isExpanded = expandedIds.has(idea.id);
              const isKeyAnalyzing = makeIsKeyAnalyzing(idea.id);

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
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={cn(
                            "text-[10px] font-semibold px-2 py-1 rounded-full",
                            status.className
                          )}
                        >
                          {status.label}
                        </span>
                        <button
                          onClick={() => handleDeleteIdea(idea.id)}
                          className="text-ink-300 hover:text-coral-500 transition-colors p-1 rounded hover:bg-coral-50"
                          title="Delete project"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
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
                      <AgentChainPanel
                        feedback={feedback}
                        isExpanded={isExpanded}
                        isKeyAnalyzing={isKeyAnalyzing}
                        onToggleExpand={() => toggleExpanded(idea.id)}
                        onRunAgent={(agentName) => handleRunAgent(idea.id, agentName)}
                        onRunTeamMomentum={(commitData) => handleRunTeamMomentum(idea.id, commitData)}
                      />
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
