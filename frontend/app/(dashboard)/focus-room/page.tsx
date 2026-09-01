"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  FolderKanban,
  Lightbulb,
  Loader2,
  Sparkles,
  Target,
  TrendingUp,
  AlertCircle,
} from "lucide-react";

import { Topbar } from "@/components/layout/Topbar";
import { supabase } from "@/lib/supabaseClient";
import type {
  AgentFeedback,
  AgentName,
  ProjectIdea,
} from "@/lib/types";

const AGENTS: AgentName[] = [
  "feasibility_agent",
  "scope_agent",
  "technology_agent",
  "timeline_agent",
  "risk_agent",
  "novelty_agent",
  "skill_development_agent",
  "team_momentum_agent",
  "viva_agent",
  "calibration_agent",
];

const AGENT_LABELS: Record<AgentName, string> = {
  feasibility_agent: "Feasibility",
  scope_agent: "Scope",
  technology_agent: "Technology",
  timeline_agent: "Timeline",
  risk_agent: "Risk",
  novelty_agent: "Novelty",
  skill_development_agent: "Skill Development",
  team_momentum_agent: "Team Momentum",
  viva_agent: "Viva Panel",
  calibration_agent: "Calibration",
};

export default function FocusRoomPage() {
  const [projects, setProjects] = useState<ProjectIdea[]>([]);
  const [feedback, setFeedback] = useState<AgentFeedback[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadFocusRoom();
  }, []);

  async function loadFocusRoom() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You are not logged in.");
        return;
      }

      // Get the student's real database profile.
      const { data: student, error: studentError } = await supabase
        .from("student")
        .select("id")
        .eq("supabase_user_id", user.id)
        .single();

      if (studentError) {
        throw studentError;
      }

      // Get ALL projects belonging to the logged-in student.
      const { data: projectData, error: projectError } = await supabase
        .from("project_ideas")
        .select(
          "id, student_id, title, description, tech_stack, status, domain, objectives, difficulty, duration, team_size, created_at"
        )
        .eq("student_id", student.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (projectError) {
        throw projectError;
      }

      const actualProjects = (projectData ?? []) as ProjectIdea[];

      setProjects(actualProjects);

      // Select the newest active project automatically.
      const firstProject =
        actualProjects.find(
          (project) =>
            project.status?.toLowerCase() !== "completed" &&
            project.status?.toLowerCase() !== "rejected"
        ) ?? actualProjects[0];

      if (!firstProject) {
        setSelectedProjectId(null);
        setFeedback([]);
        return;
      }

      setSelectedProjectId(firstProject.id);

      // Get the REAL stored AI-agent results for the selected project.
      const { data: feedbackData, error: feedbackError } = await supabase
        .from("agent_feedback")
        .select(
          "id, idea_id, agent_name, verdict, confidence_score, reasoning, skill_gaps, suggested_adjustments, model_used, created_at, details"
        )
        .eq("idea_id", firstProject.id)
        .order("created_at", { ascending: false });

      if (feedbackError) {
        throw feedbackError;
      }

      setFeedback((feedbackData ?? []) as AgentFeedback[]);
    } catch (err) {
      console.error("Focus Room loading error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your project data."
      );
    } finally {
      setLoading(false);
    }
  }

  // Load real AI-agent feedback for whichever real project
  // the student selects.
  async function loadProjectFeedback(projectId: string) {
    setFeedback([]);

    const { data, error } = await supabase
      .from("agent_feedback")
      .select(
        "id, idea_id, agent_name, verdict, confidence_score, reasoning, skill_gaps, suggested_adjustments, model_used, created_at, details"
      )
      .eq("idea_id", projectId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Project feedback loading error:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Unable to load project analysis."
      );

      return;
    }

    setError("");
    setFeedback((data ?? []) as AgentFeedback[]);
  }

  const currentProject = useMemo(() => {
    if (selectedProjectId) {
      return projects.find((project) => project.id === selectedProjectId);
    }

    return (
      projects.find(
        (project) =>
          project.status?.toLowerCase() !== "completed" &&
          project.status?.toLowerCase() !== "rejected"
      ) ?? projects[0]
    );
  }, [projects, selectedProjectId]);

  /*
   * Keep only the newest stored result for each agent.
   * This prevents multiple reruns of the same agent from being
   * counted as multiple completed agents.
   */
  const latestFeedbackByAgent = useMemo(() => {
    const map = new Map<AgentName, AgentFeedback>();

    for (const row of feedback) {
      const agent = row.agent_name as AgentName;

      if (!AGENTS.includes(agent)) continue;

      if (!map.has(agent)) {
        map.set(agent, row);
      }
    }

    return map;
  }, [feedback]);

  const agentsCompleted = latestFeedbackByAgent.size;

  const averageConfidence = useMemo(() => {
    const scores = Array.from(latestFeedbackByAgent.values())
      .map((item) => item.confidence_score)
      .filter(
        (score): score is number => typeof score === "number"
      );

    if (!scores.length) return null;

    return Math.round(
      scores.reduce((sum, score) => sum + score, 0) / scores.length
    );
  }, [latestFeedbackByAgent]);

  if (loading) {
    return (
      <>
        <Topbar
          title="Focus Room"
          subtitle="Loading your project workspace..."
        />

        <main className="flex min-h-[70vh] items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-ink-400">
            <Loader2 className="animate-spin" size={18} />
            Loading your real project data...
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Focus Room"
        subtitle="Your project workspace, powered by your real data."
      />

      <main className="px-6 md:px-10 pb-10">
        <div className="mx-auto max-w-[1450px] space-y-6">

          {/* ========================================================= */}
          {/* PROJECT SELECTOR                                          */}
          {/* ========================================================= */}

          {projects.length > 0 && (
            <section className="rounded-[26px] border border-primary-100 bg-surface p-5 md:p-6">
              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary-500">
                  My Projects
                </p>

                <h2 className="mt-1 font-display text-lg font-bold text-ink-900">
                  Choose a project
                </h2>

                <p className="mt-1 text-xs text-ink-400">
                  Select a project to view its real details and AI analysis.
                </p>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-1">
                {projects.map((project) => {
                  const selected = project.id === currentProject?.id;

                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={async () => {
                        setSelectedProjectId(project.id);
                        await loadProjectFeedback(project.id);
                      }}
                      className={`min-w-[220px] max-w-[280px] shrink-0 rounded-2xl border px-4 py-3 text-left transition-all ${
                        selected
                          ? "border-primary-300 bg-primary-100 shadow-sm shadow-primary-100"
                          : "border-primary-100 bg-surface hover:border-primary-200 hover:bg-primary-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p
                            className={`truncate text-sm font-semibold ${
                              selected
                                ? "text-primary-700"
                                : "text-ink-900"
                            }`}
                          >
                            {project.title}
                          </p>

                          {project.domain && (
                            <p className="mt-1 truncate text-[10px] text-ink-400">
                              {project.domain}
                            </p>
                          )}
                        </div>

                        {selected && (
                          <CheckCircle2
                            size={16}
                            className="shrink-0 text-primary-600"
                          />
                        )}
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <span className="rounded-full bg-surface px-2 py-1 text-[9px] font-semibold text-ink-500">
                          {project.status || "No status"}
                        </span>

                        {project.difficulty && (
                          <span className="rounded-full bg-surface px-2 py-1 text-[9px] font-semibold text-ink-500">
                            {project.difficulty}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* ========================================================= */}
          {/* ERROR                                                     */}
          {/* ========================================================= */}

          {error && (
            <div className="flex items-start gap-3 rounded-2xl border border-coral-100 bg-coral-100/50 p-4">
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0 text-coral-500"
              />

              <div>
                <p className="text-sm font-semibold text-ink-900">
                  Couldn't load your project data
                </p>

                <p className="mt-1 text-xs text-ink-500">
                  {error}
                </p>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* NO PROJECT                                                */}
          {/* ========================================================= */}

          {!currentProject && !error && (
            <EmptyProjectState />
          )}

          {/* ========================================================= */}
          {/* CURRENT PROJECT                                           */}
          {/* ========================================================= */}

          {currentProject && (
            <>
              <section className="relative overflow-hidden rounded-[30px] border border-primary-100 bg-surface p-6 md:p-8">

                <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-primary-100 blur-3xl opacity-60" />

                <div className="relative">

                  <div className="flex flex-wrap items-start justify-between gap-5">

                    <div>
                      <div className="flex flex-wrap items-center gap-2">

                        <span className="rounded-full bg-primary-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary-600">
                          Current Project
                        </span>

                        <span className="rounded-full bg-canvas-alt px-3 py-1 text-[10px] font-semibold text-ink-500">
                          {currentProject.status || "Status unavailable"}
                        </span>

                      </div>

                      <h2 className="mt-4 font-display text-2xl md:text-3xl font-bold text-ink-900">
                        {currentProject.title}
                      </h2>

                      {currentProject.domain && (
                        <p className="mt-1 text-sm text-primary-600">
                          {currentProject.domain}
                        </p>
                      )}

                      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink-500">
                        {currentProject.description}
                      </p>
                    </div>

                    <Link
                      href="/projects"
                      className="group flex shrink-0 items-center gap-2 rounded-full bg-primary-600 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-primary-200 transition hover:bg-primary-700"
                    >
                      Open Project

                      <ArrowRight
                        size={14}
                        className="transition-transform group-hover:translate-x-1"
                      />
                    </Link>

                  </div>

                  {/* PROJECT DETAILS */}

                  <div className="mt-7 grid grid-cols-2 md:grid-cols-4 gap-3">

                    <ProjectDetail
                      label="Technology"
                      value={currentProject.tech_stack}
                    />

                    <ProjectDetail
                      label="Difficulty"
                      value={currentProject.difficulty}
                    />

                    <ProjectDetail
                      label="Duration"
                      value={currentProject.duration}
                    />

                    <ProjectDetail
                      label="Team Size"
                      value={
                        currentProject.team_size !== null
                          ? String(currentProject.team_size)
                          : null
                      }
                    />

                  </div>

                </div>
              </section>

              {/* ===================================================== */}
              {/* REAL PROJECT SIGNALS                                  */}
              {/* ===================================================== */}

              <section className="grid md:grid-cols-3 gap-4">

                <MetricCard
                  icon={Bot}
                  label="AI Agents Completed"
                  value={`${agentsCompleted} / ${AGENTS.length}`}
                  description={
                    agentsCompleted
                      ? "Stored analyses for this project"
                      : "No stored agent analyses yet"
                  }
                  tone="purple"
                />

                <MetricCard
                  icon={Target}
                  label="Average AI Confidence"
                  value={
                    averageConfidence !== null
                      ? `${averageConfidence}%`
                      : "—"
                  }
                  description={
                    averageConfidence !== null
                      ? "Based on completed agents"
                      : "Available after agent analysis"
                  }
                  tone="mint"
                />

                <MetricCard
                  icon={TrendingUp}
                  label="Project Status"
                  value={currentProject.status || "—"}
                  description="Current status stored for this project"
                  tone="sky"
                />

              </section>

              {/* ===================================================== */}
              {/* AI AGENT RESULTS                                     */}
              {/* ===================================================== */}

              <section className="rounded-[28px] border border-primary-100 bg-surface p-6 md:p-7">

                <div className="flex flex-wrap items-start justify-between gap-4">

                  <div>
                    <div className="flex items-center gap-2">

                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint-100 text-mint-500">
                        <BrainCircuit size={19} />
                      </div>

                      <div>
                        <h2 className="font-display text-xl font-bold text-ink-900">
                          AI Agent Network
                        </h2>

                        <p className="text-xs text-ink-400">
                          Real analysis stored for this project
                        </p>
                      </div>

                    </div>
                  </div>

                  <Link
                    href="/agents"
                    className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700"
                  >
                    View all agents
                    <ChevronRight size={14} />
                  </Link>

                </div>

                <div className="mt-6 grid md:grid-cols-2 xl:grid-cols-5 gap-3">

                  {AGENTS.map((agent) => {
                    const result = latestFeedbackByAgent.get(agent);

                    return (
                      <AgentCard
                        key={agent}
                        name={AGENT_LABELS[agent]}
                        result={result}
                      />
                    );
                  })}

                </div>

              </section>

              {/* ===================================================== */}
              {/* PROJECT INFORMATION                                  */}
              {/* ===================================================== */}

              <div className="grid lg:grid-cols-2 gap-6">

                <InfoPanel
                  icon={Lightbulb}
                  title="Objectives"
                  content={currentProject.objectives}
                  emptyText="No objectives have been added to this project yet."
                />

                <InfoPanel
                  icon={Sparkles}
                  title="Project Workspace"
                  content={
                    currentProject.description
                      ? "Your project workspace can use the information already stored for this project."
                      : null
                  }
                  emptyText="Project information is not available yet."
                />

              </div>

              {/* ===================================================== */}
              {/* WORKSPACE LINKS                                       */}
              {/* ===================================================== */}

              <section>

                <div className="mb-4">

                  <h2 className="font-display text-xl font-bold text-ink-900">
                    Project Workspace
                  </h2>

                  <p className="mt-1 text-sm text-ink-400">
                    Explore the project using the information already stored
                    in your system.
                  </p>

                </div>

                <div className="grid md:grid-cols-3 gap-4">

                  <WorkspaceCard
                    href="/concept-canvas"
                    icon={Target}
                    title="Concept Canvas"
                    description="Organize the real project idea into a visual concept workspace."
                    tone="sky"
                  />

                  <WorkspaceCard
                    href="/storybook"
                    icon={Sparkles}
                    title="Project Storybook"
                    description="Turn the project's actual journey and AI insights into a story."
                    tone="mint"
                  />

                </div>

              </section>
            </>
          )}

        </div>
      </main>
    </>
  );
}

/* ========================================================= */
/* Components                                                 */
/* ========================================================= */

function ProjectDetail({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="rounded-2xl border border-primary-50 bg-surface-alt p-4">

      <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-ink-400">
        {label}
      </p>

      <p className="mt-2 truncate text-sm font-semibold text-ink-900">
        {value || "Not provided"}
      </p>

    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  description,
  tone,
}: {
  icon: typeof Bot;
  label: string;
  value: string;
  description: string;
  tone: "purple" | "mint" | "sky";
}) {
  const styles = {
    purple: "bg-primary-100 text-primary-600",
    mint: "bg-mint-100 text-mint-500",
    sky: "bg-sky-100 text-sky-500",
  };

  return (
    <div className="rounded-2xl border border-primary-100 bg-surface p-5">

      <div className="flex items-center gap-3">

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${styles[tone]}`}
        >
          <Icon size={18} />
        </div>

        <p className="text-xs font-semibold text-ink-500">
          {label}
        </p>

      </div>

      <p className="mt-4 font-display text-2xl font-bold text-ink-900">
        {value}
      </p>

      <p className="mt-1 text-[11px] text-ink-400">
        {description}
      </p>

    </div>
  );
}

function AgentCard({
  name,
  result,
}: {
  name: string;
  result?: AgentFeedback;
}) {
  return (
    <div className="rounded-2xl border border-primary-50 bg-surface-alt p-4">

      <div className="flex items-center justify-between gap-2">

        <p className="text-xs font-semibold text-ink-700">
          {name}
        </p>

        {result ? (
          <CheckCircle2
            size={15}
            className="shrink-0 text-mint-500"
          />
        ) : (
          <div className="h-2 w-2 rounded-full bg-ink-300" />
        )}

      </div>

      {result ? (
        <>
          <p className="mt-3 text-xs font-bold text-ink-900">
            {result.verdict || "Result available"}
          </p>

          {result.confidence_score !== null && (
            <p className="mt-1 text-[10px] text-ink-400">
              Confidence: {result.confidence_score}%
            </p>
          )}

          <p className="mt-3 line-clamp-3 text-[10px] leading-relaxed text-ink-400">
            {result.reasoning || "No reasoning stored."}
          </p>
        </>
      ) : (
        <p className="mt-3 text-[10px] leading-relaxed text-ink-400">
          No stored result for this agent yet.
        </p>
      )}

    </div>
  );
}

function InfoPanel({
  icon: Icon,
  title,
  content,
  emptyText,
}: {
  icon: typeof Lightbulb;
  title: string;
  content: string | null | undefined;
  emptyText: string;
}) {
  return (
    <section className="rounded-[26px] border border-primary-100 bg-surface p-6">

      <div className="flex items-center gap-3">

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
          <Icon size={18} />
        </div>

        <h3 className="font-display text-lg font-bold text-ink-900">
          {title}
        </h3>

      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-500">
        {content || emptyText}
      </p>

    </section>
  );
}

function WorkspaceCard({
  href,
  icon: Icon,
  title,
  description,
  tone,
}: {
  href: string;
  icon: typeof FolderKanban;
  title: string;
  description: string;
  tone: "purple" | "sky" | "mint";
}) {
  const styles = {
    purple: "bg-primary-100 text-primary-600",
    sky: "bg-sky-100 text-sky-500",
    mint: "bg-mint-100 text-mint-500",
  };

  return (
    <Link
      href={href}
      className="group rounded-[24px] border border-primary-100 bg-surface p-5 transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-lg hover:shadow-primary-100/40"
    >

      <div className="flex items-center justify-between">

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${styles[tone]}`}
        >
          <Icon size={19} />
        </div>

        <ArrowRight
          size={16}
          className="text-ink-300 transition group-hover:translate-x-1 group-hover:text-primary-500"
        />

      </div>

      <h3 className="mt-5 font-semibold text-ink-900">
        {title}
      </h3>

      <p className="mt-1 text-xs leading-relaxed text-ink-400">
        {description}
      </p>

    </Link>
  );
}

function EmptyProjectState() {
  return (
    <section className="flex min-h-[60vh] items-center justify-center rounded-[30px] border border-primary-100 bg-surface p-8">

      <div className="max-w-md text-center">

        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-primary-600">
          <FolderKanban size={27} />
        </div>

        <h2 className="mt-5 font-display text-2xl font-bold text-ink-900">
          No active project yet
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-ink-400">
          Your Focus Room will appear here once you have an active project
          idea in your account.
        </p>

        <Link
          href="/submit-idea"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white hover:bg-primary-700 transition"
        >
          Submit Project Idea
          <ArrowRight size={16} />
        </Link>

      </div>

    </section>
  );
}