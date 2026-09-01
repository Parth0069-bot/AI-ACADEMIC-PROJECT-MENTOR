"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { notify } from "@/lib/notify";

import { Topbar } from "@/components/layout/Topbar";
import { AgentChainPanel } from "@/components/projects/AgentChainPanel";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

import {
  AGENT_ORDER,
  AGENT_META,
  AGENT_NEEDS_INPUT_FORM,
  AGENT_RUNNERS,
  type FeedbackByAgent,
} from "@/lib/agentChain";

import {
  BackendError,
  runTeamMomentumAnalysis,
  type TeamMomentumIn,
} from "@/lib/backendClient";

import type {
  AgentFeedback,
  AgentName,
  ProjectIdea,
} from "@/lib/types";

/* ============================================================
   TYPES
============================================================ */

type LoadingMap = Partial<Record<AgentName, boolean>>;

/* ============================================================
   HELPERS
============================================================ */

function isAgentName(value: string): value is AgentName {
  return AGENT_ORDER.includes(value as AgentName);
}

/**
 * Converts raw Supabase feedback rows into the shape expected
 * by AgentChainPanel.
 *
 * We deliberately validate agent_name first because AgentFeedback
 * allows `string`, while FeedbackByAgent expects AgentName keys.
 */
function latestFeedbackMap(
  feedback: AgentFeedback[]
): FeedbackByAgent {
  const map: FeedbackByAgent = {};

  for (const item of feedback) {
    if (!isAgentName(item.agent_name)) {
      continue;
    }

    const existing = map[item.agent_name];

    if (
      !existing ||
      new Date(item.created_at).getTime() >
        new Date(existing.created_at).getTime()
    ) {
      map[item.agent_name] = item;
    }
  }

  return map;
}

/**
 * Returns the latest stored feedback row for each agent.
 */
function latestFeedbackRows(
  feedback: AgentFeedback[]
): AgentFeedback[] {
  const map = latestFeedbackMap(feedback);

  return AGENT_ORDER
    .map((agentName) => map[agentName])
    .filter(Boolean) as AgentFeedback[];
}

/* ============================================================
   PAGE
============================================================ */

export default function AgentsPage() {
  const { profile } = useAuth();

  const [projects, setProjects] = useState<ProjectIdea[]>([]);
  const [selectedProjectId, setSelectedProjectId] =
    useState<string | null>(null);

  const [feedback, setFeedback] = useState<AgentFeedback[]>([]);

  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  const [runningAgents, setRunningAgents] =
    useState<LoadingMap>({});

  const [panelOpen, setPanelOpen] = useState(false);

  const [error, setError] = useState("");

  /* ==========================================================
     LOAD PROJECTS
  ========================================================== */

  const loadProjects = useCallback(async () => {
    if (!profile?.id) {
      return;
    }

    setLoadingProjects(true);
    setError("");

    try {
      const { data, error: projectError } = await supabase
        .from("project_ideas")
        .select(
          "id, student_id, title, description, tech_stack, status, domain, objectives, difficulty, duration, team_size, created_at"
        )
        .eq("student_id", profile.id)
        .is("deleted_at", null)
        .order("created_at", {
          ascending: false,
        });

      if (projectError) {
        throw projectError;
      }

      const actualProjects = (data ?? []) as ProjectIdea[];

      setProjects(actualProjects);

      /*
       * Automatically select the first project if nothing
       * has been selected yet.
       */
      setSelectedProjectId((current) => {
        if (current && actualProjects.some((p) => p.id === current)) {
          return current;
        }

        return actualProjects[0]?.id ?? null;
      });
    } catch (err) {
      console.error("Failed to load projects:", err);

      setProjects([]);
      setSelectedProjectId(null);

      setError("Could not load your projects.");
    } finally {
      setLoadingProjects(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  /* ==========================================================
     LOAD FEEDBACK
  ========================================================== */

  const loadFeedback = useCallback(async () => {
    if (!selectedProjectId) {
      setFeedback([]);
      return;
    }

    setLoadingFeedback(true);
    setError("");

    try {
      const { data, error: feedbackError } = await supabase
        .from("agent_feedback")
        .select("*")
        .eq("idea_id", selectedProjectId)
        .order("created_at", {
          ascending: true,
        });

      if (feedbackError) {
        throw feedbackError;
      }

      setFeedback((data ?? []) as AgentFeedback[]);
    } catch (err) {
      console.error("Failed to load agent feedback:", err);

      setFeedback([]);
      setError("Could not load the stored AI analysis.");
    } finally {
      setLoadingFeedback(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  /* ==========================================================
     CURRENT PROJECT
  ========================================================== */

  const selectedProject = useMemo(() => {
    return (
      projects.find(
        (project) => project.id === selectedProjectId
      ) ?? null
    );
  }, [projects, selectedProjectId]);

  /* ==========================================================
     AGENT FEEDBACK MAP
  ========================================================== */

  const feedbackByAgent = useMemo(() => {
    return latestFeedbackMap(feedback);
  }, [feedback]);

  /* ==========================================================
     LATEST RESULTS
  ========================================================== */

  const latestResults = useMemo(() => {
    return latestFeedbackRows(feedback);
  }, [feedback]);

  /* ==========================================================
     PROGRESS
  ========================================================== */

  const completedAgents = latestResults.length;

  const nextAgent = useMemo(() => {
    return AGENT_ORDER.find(
      (agentName) => !feedbackByAgent[agentName]
    );
  }, [feedbackByAgent]);

  const progressPercent = Math.round(
    (completedAgents / AGENT_ORDER.length) * 100
  );

  /* ==========================================================
     RUNNING HELPERS
  ========================================================== */

  function isAgentRunning(agentName: AgentName): boolean {
    return Boolean(runningAgents[agentName]);
  }

  function setAgentRunning(
    agentName: AgentName,
    value: boolean
  ) {
    setRunningAgents((current) => ({
      ...current,
      [agentName]: value,
    }));
  }

  /* ==========================================================
     RUN NORMAL AGENT
  ========================================================== */

  const runAgent = useCallback(
    async (agentName: AgentName) => {
      if (!selectedProjectId) {
        toast.error("Please select a project first.");
        return;
      }

      /*
       * Team Momentum has its own input form and must not be
       * called through AGENT_RUNNERS directly.
       */
      if (agentName === "team_momentum_agent") {
        toast.error(
          "Team Momentum requires commit activity input."
        );
        return;
      }

      if (isAgentRunning(agentName)) {
        return;
      }

      setAgentRunning(agentName, true);
      setError("");

      try {
        const runner = AGENT_RUNNERS[agentName];

        await runner(selectedProjectId);

        notify.success(
          `${AGENT_META[agentName].label} analysis completed.`
        );

        await loadFeedback();
      } catch (err) {
        console.error(
          `Failed to run ${agentName}:`,
          err
        );

        const message =
          err instanceof BackendError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Agent analysis failed.";

        setError(message);
        toast.error(message);
      } finally {
        setAgentRunning(agentName, false);
      }
    },
    [
      selectedProjectId,
      loadFeedback,
      runningAgents,
    ]
  );

  /* ==========================================================
     TEAM MOMENTUM
  ========================================================== */

  const runTeamMomentum = useCallback(
    async (commitData: TeamMomentumIn) => {
      if (!selectedProjectId) {
        toast.error("Please select a project first.");
        return;
      }

      const agentName: AgentName =
        "team_momentum_agent";

      if (isAgentRunning(agentName)) {
        return;
      }

      setAgentRunning(agentName, true);
      setError("");

      try {
        /*
         * Team Momentum is special because the backend expects
         * the commit data in the request body.
         */
        await runTeamMomentumAnalysis(
          selectedProjectId,
          commitData
        );

        notify.success(
          "Team Momentum analysis completed."
        );

        await loadFeedback();
      } catch (err) {
        console.error(
          "Failed to run Team Momentum:",
          err
        );

        const message =
          err instanceof BackendError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Team Momentum analysis failed.";

        setError(message);
        toast.error(message);
      } finally {
        setAgentRunning(agentName, false);
      }
    },
    [
      selectedProjectId,
      loadFeedback,
      runningAgents,
    ]
  );

  /* ==========================================================
     REFRESH
  ========================================================== */

  async function refreshAll() {
    await loadProjects();
    await loadFeedback();

    notify.success("Agent data refreshed.");
  }

  /* ==========================================================
     LOADING STATE
  ========================================================== */

  if (loadingProjects) {
    return (
      <div className="min-h-screen bg-canvas">
        <Topbar
          title="AI Agents"
          subtitle="Run and review your project mentor agents."
        />

        <main className="px-6 md:px-10 pb-10">
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-ink-500">
              <Loader2
                size={20}
                className="animate-spin"
              />
              Loading your projects...
            </div>
          </div>
        </main>
      </div>
    );
  }

  /* ==========================================================
     NO PROJECT
  ========================================================== */

  if (projects.length === 0) {
    return (
      <div className="min-h-screen bg-canvas">
        <Topbar
          title="AI Agents"
          subtitle="Run and review your project mentor agents."
        />

        <main className="px-6 md:px-10 pb-10">
          <div className="mx-auto max-w-4xl pt-10">
            <div className="rounded-3xl border border-primary-100 bg-surface p-10 text-center shadow-sm">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50">
                <Sparkles
                  size={28}
                  className="text-primary-600"
                />
              </div>

              <h2 className="font-display text-xl font-semibold text-ink-900">
                No project found
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-500">
                Submit a project idea first. Once your project
                exists, the AI mentor agents can analyze it
                step by step.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  /* ==========================================================
     MAIN PAGE
  ========================================================== */

  return (
    <div className="min-h-screen bg-canvas">
      <Topbar
        title="AI Agents"
        subtitle="Run and review your project mentor agents."
      />

      <main className="px-6 md:px-10 pb-10">
        <div className="mx-auto max-w-7xl pt-6">
          {/* ==================================================
              ERROR
          ================================================== */}

          {error && (
            <div className="mb-5 rounded-2xl border border-coral-500/20 bg-coral-100 px-5 py-4 text-sm text-coral-600">
              {error}
            </div>
          )}

          {/* ==================================================
              PROJECT SELECTOR
          ================================================== */}

          <section className="rounded-3xl border border-primary-100 bg-surface p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-600">
                  AI Mentor Workspace
                </p>

                <h1 className="mt-1 truncate font-display text-xl font-semibold text-ink-900">
                  {selectedProject?.title ??
                    "Select a project"}
                </h1>

                {selectedProject?.description && (
                  <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-500">
                    {selectedProject.description}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <select
                  value={selectedProjectId ?? ""}
                  onChange={(event) =>
                    setSelectedProjectId(
                      event.target.value || null
                    )
                  }
                  className="min-w-[220px] rounded-xl border border-ink-100 bg-canvas px-3 py-2.5 text-xs font-medium text-ink-700 outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
                >
                  {projects.map((project) => (
                    <option
                      key={project.id}
                      value={project.id}
                    >
                      {project.title}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={refreshAll}
                  disabled={
                    loadingFeedback ||
                    loadingProjects
                  }
                  className="inline-flex items-center justify-center rounded-xl border border-ink-100 bg-canvas p-2.5 text-ink-400 transition hover:border-primary-200 hover:text-primary-600 disabled:opacity-50"
                  title="Refresh"
                >
                  <RefreshCw
                    size={15}
                    className={
                      loadingFeedback
                        ? "animate-spin"
                        : ""
                    }
                  />
                </button>
              </div>
            </div>
          </section>

          {/* ==================================================
              PROGRESS
          ================================================== */}

          <section className="mt-5 rounded-3xl border border-primary-100 bg-surface p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-400">
                  Agent Progress
                </p>

                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-display text-2xl font-semibold text-ink-900">
                    {completedAgents}
                  </span>

                  <span className="text-sm text-ink-400">
                    / {AGENT_ORDER.length} agents completed
                  </span>
                </div>
              </div>

              <div className="min-w-[220px] md:w-80">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-ink-400">
                    Overall progress
                  </span>

                  <span className="text-[10px] font-bold text-primary-600">
                    {progressPercent}%
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-canvas-alt">
                  <div
                    className="h-full rounded-full bg-primary-500 transition-all duration-500"
                    style={{
                      width: `${progressPercent}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Agent dots */}
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {AGENT_ORDER.map((agentName) => {
                const completed =
                  Boolean(
                    feedbackByAgent[agentName]
                  );

                const running =
                  isAgentRunning(agentName);

                return (
                  <div
                    key={agentName}
                    className={`rounded-xl border px-3 py-2.5 ${
                      completed
                        ? "border-mint-200 bg-mint-100/50"
                        : running
                        ? "border-primary-200 bg-primary-50"
                        : "border-ink-100 bg-canvas"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {running ? (
                        <Loader2
                          size={12}
                          className="animate-spin text-primary-600"
                        />
                      ) : (
                        <span
                          className={`h-2 w-2 rounded-full ${
                            completed
                              ? "bg-mint-500"
                              : "bg-ink-200"
                          }`}
                        />
                      )}

                      <span className="truncate text-[10px] font-semibold text-ink-600">
                        {AGENT_META[agentName].label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ==================================================
              LOADING FEEDBACK
          ================================================== */}

          {loadingFeedback && (
            <div className="mt-5 flex items-center justify-center rounded-3xl border border-primary-100 bg-surface py-10">
              <div className="flex items-center gap-3 text-sm text-ink-500">
                <Loader2
                  size={18}
                  className="animate-spin"
                />
                Loading stored agent results...
              </div>
            </div>
          )}

          {/* ==================================================
              AGENT CHAIN
          ================================================== */}

          {!loadingFeedback && (
            <section className="mt-5 rounded-3xl border border-primary-100 bg-surface p-5 shadow-sm">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-600">
                    Agent Chain
                  </p>

                  <h2 className="mt-1 font-display text-lg font-semibold text-ink-900">
                    Project Analysis
                  </h2>

                  <p className="mt-1 text-xs text-ink-500">
                    The agents run in dependency order. Each
                    stage builds on the previous analysis.
                  </p>
                </div>

                {nextAgent && (
                  <div className="rounded-full bg-primary-50 px-3 py-1.5 text-[10px] font-semibold text-primary-700">
                    Next:{" "}
                    {AGENT_META[nextAgent].label}
                  </div>
                )}

                {!nextAgent && (
                  <div className="rounded-full bg-mint-100 px-3 py-1.5 text-[10px] font-semibold text-mint-600">
                    All agents completed
                  </div>
                )}
              </div>

              <AgentChainPanel
                feedback={feedbackByAgent}
                isExpanded={panelOpen}
                isKeyAnalyzing={isAgentRunning}
                onToggleExpand={() =>
                  setPanelOpen((current) => !current)
                }
                onRunAgent={runAgent}
                onRunTeamMomentum={runTeamMomentum}
              />
            </section>
          )}

          {/* ==================================================
              STORED RESULTS SUMMARY
          ================================================== */}

          {!loadingFeedback &&
            latestResults.length > 0 && (
              <section className="mt-5">
                <div className="mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-400">
                    Latest Results
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {latestResults.map((result) => {
                    if (
                      !isAgentName(
                        result.agent_name
                      )
                    ) {
                      return null;
                    }

                    const meta =
                      AGENT_META[
                        result.agent_name
                      ];

                    const Icon = meta.icon;

                    return (
                      <div
                        key={result.id}
                        className="rounded-2xl border border-primary-100 bg-surface p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-50">
                              <Icon
                                size={15}
                                className="text-primary-600"
                              />
                            </div>

                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-wider text-ink-400">
                                Agent
                              </p>

                              <p className="text-xs font-semibold text-ink-700">
                                {meta.label}
                              </p>
                            </div>
                          </div>

                          {result.confidence_score !=
                            null && (
                            <span className="rounded-full bg-primary-50 px-2 py-1 text-[9px] font-bold text-primary-600">
                              {result.confidence_score}%
                            </span>
                          )}
                        </div>

                        <div className="mt-4">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-ink-400">
                            Verdict
                          </p>

                          <p className="mt-1 text-sm font-semibold text-ink-700">
                            {result.verdict ??
                              "No verdict"}
                          </p>
                        </div>

                        {result.reasoning && (
                          <p className="mt-3 line-clamp-3 text-[11px] leading-relaxed text-ink-500">
                            {result.reasoning}
                          </p>
                        )}

                        {result.skill_gaps &&
                          result.skill_gaps.length >
                            0 && (
                            <div className="mt-3">
                              <p className="text-[9px] font-bold uppercase tracking-wider text-ink-400">
                                Skill gaps
                              </p>

                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {result.skill_gaps.map(
                                  (skill) => (
                                    <span
                                      key={skill}
                                      className="rounded-full bg-coral-100 px-2 py-1 text-[9px] font-medium text-coral-600"
                                    >
                                      {skill}
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

          {/* ==================================================
              EMPTY FEEDBACK
          ================================================== */}

          {!loadingFeedback &&
            latestResults.length === 0 && (
              <section className="mt-5 rounded-3xl border border-dashed border-primary-200 bg-primary-50/40 p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-100">
                  <Sparkles
                    size={22}
                    className="text-primary-600"
                  />
                </div>

                <h3 className="mt-4 font-display text-base font-semibold text-ink-900">
                  Your AI analysis hasn't started yet
                </h3>

                <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-ink-500">
                  Start with the Feasibility Agent. The
                  remaining agents will become available as
                  their required dependencies are completed.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    runAgent(
                      "feasibility_agent"
                    )
                  }
                  disabled={isAgentRunning(
                    "feasibility_agent"
                  )}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
                >
                  {isAgentRunning(
                    "feasibility_agent"
                  ) ? (
                    <>
                      <Loader2
                        size={14}
                        className="animate-spin"
                      />
                      {
                        AGENT_META
                          .feasibility_agent
                          .loadingLabel
                      }
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      {
                        AGENT_META
                          .feasibility_agent
                          .actionLabel
                      }
                    </>
                  )}
                </button>
              </section>
            )}
        </div>
      </main>
    </div>
  );
}