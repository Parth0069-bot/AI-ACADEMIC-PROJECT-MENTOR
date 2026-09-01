"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  FolderKanban,
  Gauge,
  GraduationCap,
  Lightbulb,
  Loader2,
  Target,
  Users,
  Clock3,
  AlertTriangle,
  Sparkles,
  Layers3,
  ShieldAlert,
  ListChecks,
  CalendarDays,
} from "lucide-react";

import { Topbar } from "@/components/layout/Topbar";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import type {
  AgentFeedback,
  ProjectIdea,
  SkillAssessment,
} from "@/lib/types";
import { verdictClassName } from "@/lib/agentChain";

const AGENT_LABELS: Record<string, string> = {
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

const AGENT_ICONS: Record<string, typeof Bot> = {
  feasibility_agent: Sparkles,
  scope_agent: ListChecks,
  technology_agent: Code2,
  timeline_agent: CalendarDays,
  risk_agent: ShieldAlert,
  novelty_agent: Lightbulb,
  skill_development_agent: GraduationCap,
  team_momentum_agent: Users,
  viva_agent: Bot,
  calibration_agent: Gauge,
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function splitObjectives(value: string | null) {
  if (!value?.trim()) return [];

  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanTechStack(value: string | null) {
  if (!value?.trim()) return [];

  return value
    .split(/[,•|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ConceptCanvasPage() {
  const { profile } = useAuth();

  const [projects, setProjects] = useState<ProjectIdea[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );

  const [feedback, setFeedback] = useState<AgentFeedback[]>([]);
  const [skills, setSkills] = useState<SkillAssessment[]>([]);

  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingProjectData, setLoadingProjectData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  /*
   * Load only projects belonging to the currently authenticated student.
   */
  useEffect(() => {
    async function loadProjects() {
      if (!profile?.id) return;

      setLoadingProjects(true);
      setError(null);

      const { data, error: projectError } = await supabase
        .from("project_ideas")
        .select("*")
        .eq("student_id", profile.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (projectError) {
        console.error(projectError);
        setError("Unable to load your projects.");
        setProjects([]);
        setLoadingProjects(false);
        return;
      }

      const realProjects = (data ?? []) as ProjectIdea[];

      setProjects(realProjects);

      if (realProjects.length > 0) {
        setSelectedProjectId((current) =>
          current && realProjects.some((project) => project.id === current)
            ? current
            : realProjects[0].id
        );
      } else {
        setSelectedProjectId(null);
      }

      setLoadingProjects(false);
    }

    loadProjects();
  }, [profile?.id]);

  /*
   * Load all information connected to the selected project.
   */
  useEffect(() => {
    async function loadProjectData() {
      if (!selectedProjectId) {
        setFeedback([]);
        return;
      }

      setLoadingProjectData(true);
      setError(null);

      const [feedbackResult, skillsResult] = await Promise.all([
        supabase
          .from("agent_feedback")
          .select("*")
          .eq("idea_id", selectedProjectId)
          .order("created_at", { ascending: false }),

        profile?.id
          ? supabase
              .from("skill_assessment")
              .select("*")
              .eq("student_id", profile.id)
              .order("submitted_at", { ascending: false })
          : Promise.resolve({
              data: [],
              error: null,
            }),
      ]);

      if (feedbackResult.error) {
        console.error(feedbackResult.error);
        setError("Unable to load the stored AI analysis.");
      }

      if (skillsResult.error) {
        console.error(skillsResult.error);
        setError("Unable to load your stored skill assessment.");
      }

      setFeedback((feedbackResult.data ?? []) as AgentFeedback[]);
      setSkills((skillsResult.data ?? []) as SkillAssessment[]);

      setLoadingProjectData(false);
    }

    loadProjectData();
  }, [selectedProjectId, profile?.id]);

  const completedAgents = feedback.length;

  const averageConfidence =
    feedback.length > 0
      ? Math.round(
          feedback.reduce(
            (total, item) => total + (item.confidence_score ?? 0),
            0
          ) / feedback.length
        )
      : null;

  const uniqueSkillGaps = useMemo(() => {
    const values = feedback.flatMap((item) => item.skill_gaps ?? []);

    return Array.from(
      new Map(
        values
          .map((skill) => skill.trim())
          .filter(Boolean)
          .map((skill) => [skill.toLowerCase(), skill])
      ).values()
    );
  }, [feedback]);

  const recommendations = useMemo(() => {
    return feedback.filter(
      (item) => item.suggested_adjustments?.trim()
    );
  }, [feedback]);

  const objectives = splitObjectives(selectedProject?.objectives ?? null);
  const technologies = cleanTechStack(selectedProject?.tech_stack ?? null);

  const getAgentFeedback = (agentName: string) =>
    feedback.find((item) => item.agent_name === agentName);

  if (loadingProjects) {
    return (
      <div className="min-h-screen bg-canvas">
        <Topbar
          title="Concept Canvas"
          subtitle="Turn your real project data into a clear visual concept."
        />

        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex items-center gap-3 text-ink-500">
            <Loader2 className="animate-spin" size={20} />
            <span>Loading your real projects...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <Topbar
        title="Concept Canvas"
        subtitle="Turn your real project data into a clear visual concept."
      />

      <div className="px-6 md:px-10 pb-10">
        {error && (
          <div className="mb-6 rounded-2xl border border-coral-500/20 bg-coral-100 px-5 py-4 text-sm text-coral-500">
            {error}
          </div>
        )}

        {/* ============================================================
            PROJECT SELECTOR
        ============================================================ */}
        <section className="rounded-3xl border border-primary-100 bg-surface p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-400">
                Your Projects
              </p>
              <p className="mt-1 text-sm text-ink-400">
                Select a real project from your account.
              </p>
            </div>

            <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
              {projects.length} {projects.length === 1 ? "project" : "projects"}
            </span>
          </div>

          {projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-primary-200 bg-surface-alt px-6 py-10 text-center">
              <FolderKanban
                className="mx-auto mb-3 text-primary-400"
                size={30}
              />
              <p className="font-semibold text-ink-900">
                No project data stored yet
              </p>
              <p className="mt-1 text-sm text-ink-400">
                Submit a project idea first and it will appear here.
              </p>
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {projects.map((project) => {
                const active = project.id === selectedProjectId;

                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setSelectedProjectId(project.id)}
                    className={[
                      "shrink-0 rounded-2xl border px-5 py-3 text-sm font-semibold transition-all",
                      active
                        ? "border-primary-600 bg-primary-600 text-white shadow-md shadow-primary-200"
                        : "border-primary-100 bg-surface-alt text-ink-500 hover:border-primary-300 hover:text-primary-600",
                    ].join(" ")}
                  >
                    {project.title}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {!selectedProject ? null : (
          <div className="mt-7 space-y-7">
            {/* ========================================================
                PROJECT CORE
            ======================================================== */}
            <section className="relative overflow-hidden rounded-[32px] border border-primary-100 bg-surface p-7 shadow-sm md:p-9">
              <div className="pointer-events-none absolute right-[-100px] top-[-100px] h-72 w-72 rounded-full bg-primary-100/50 blur-3xl" />

              <div className="relative">
                <div className="mb-5 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.15em] text-primary-600">
                    Project Core
                  </span>

                  {selectedProject.status && (
                    <span className="rounded-full bg-canvas-alt px-3 py-1.5 text-xs font-semibold text-ink-500">
                      {selectedProject.status}
                    </span>
                  )}

                  {selectedProject.domain && (
                    <span className="rounded-full bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-500">
                      {selectedProject.domain}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-4xl">
                    <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900 md:text-4xl">
                      {selectedProject.title}
                    </h2>

                    <p className="mt-4 max-w-3xl text-base leading-8 text-ink-500">
                      {selectedProject.description}
                    </p>
                  </div>

                  <Link
                    href="/projects"
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-primary-100 bg-surface px-4 py-2.5 text-sm font-semibold text-primary-600 transition hover:border-primary-300 hover:bg-primary-50"
                  >
                    Project Details
                    <ArrowRight size={16} />
                  </Link>
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <InfoCard
                    icon={Code2}
                    label="Technology"
                    value={
                      selectedProject.tech_stack || "No technology stored"
                    }
                  />

                  <InfoCard
                    icon={Gauge}
                    label="Difficulty"
                    value={
                      selectedProject.difficulty || "No difficulty stored"
                    }
                  />

                  <InfoCard
                    icon={Clock3}
                    label="Duration"
                    value={selectedProject.duration || "No duration stored"}
                  />

                  <InfoCard
                    icon={Users}
                    label="Team Size"
                    value={
                      selectedProject.team_size !== null
                        ? String(selectedProject.team_size)
                        : "Not stored"
                    }
                  />
                </div>
              </div>
            </section>

            {/* ========================================================
                VISUAL BLUEPRINT
            ======================================================== */}
            <section>
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
                  Project Blueprint
                </p>

                <h3 className="mt-1 font-display text-2xl font-bold text-ink-900">
                  How your project fits together
                </h3>

                <p className="mt-1 text-sm text-ink-400">
                  Built entirely from information already stored in your
                  project.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {/* CORE IDEA */}
                <BlueprintCard
                  icon={Lightbulb}
                  label="Core Idea"
                  title="What the project is about"
                  className="lg:col-span-2"
                >
                  <p className="text-sm leading-7 text-ink-500">
                    {selectedProject.description}
                  </p>
                </BlueprintCard>

                {/* DOMAIN */}
                <BlueprintCard
                  icon={Layers3}
                  label="Domain"
                  title="Project area"
                >
                  {selectedProject.domain ? (
                    <span className="inline-flex rounded-xl bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-500">
                      {selectedProject.domain}
                    </span>
                  ) : (
                    <EmptyData />
                  )}
                </BlueprintCard>

                {/* OBJECTIVES */}
                <BlueprintCard
                  icon={Target}
                  label="Objectives"
                  title="What this project is intended to accomplish"
                  className="lg:col-span-2"
                >
                  {objectives.length > 0 ? (
                    <div className="space-y-3">
                      {objectives.map((objective, index) => (
                        <div
                          key={`${objective}-${index}`}
                          className="flex items-start gap-3"
                        >
                          <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                            <CheckCircle2 size={13} />
                          </div>

                          <p className="text-sm leading-6 text-ink-500">
                            {objective}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyData />
                  )}
                </BlueprintCard>

                {/* TECHNOLOGY */}
                <BlueprintCard
                  icon={Code2}
                  label="Build Stack"
                  title="Technology stored for this project"
                >
                  {technologies.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {technologies.map((technology) => (
                        <span
                          key={technology}
                          className="rounded-full bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-600"
                        >
                          {technology}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <EmptyData />
                  )}
                </BlueprintCard>
              </div>
            </section>

            {/* ========================================================
                AI PERSPECTIVE
            ======================================================== */}
            <section className="rounded-3xl border border-primary-100 bg-surface p-6 shadow-sm md:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mint-100 text-mint-500">
                      <Brain size={22} />
                    </div>

                    <div>
                      <h3 className="font-display text-2xl font-bold text-ink-900">
                        AI Perspective
                      </h3>
                      <p className="text-sm text-ink-400">
                        Based only on stored agent analyses.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Metric
                    label="Agents Completed"
                    value={`${completedAgents} / 10`}
                  />

                  <Metric
                    label="Average Confidence"
                    value={
                      averageConfidence !== null
                        ? `${averageConfidence}%`
                        : "No data"
                    }
                  />

                  <Metric
                    label="Skill Gaps"
                    value={String(uniqueSkillGaps.length)}
                  />
                </div>
              </div>

              {feedback.length === 0 ? (
                <div className="mt-7 rounded-2xl border border-dashed border-primary-200 bg-surface-alt px-6 py-8 text-center">
                  <Bot
                    className="mx-auto mb-3 text-primary-400"
                    size={28}
                  />
                  <p className="font-semibold text-ink-900">
                    No stored AI analysis yet
                  </p>
                  <p className="mt-1 text-sm text-ink-400">
                    The AI perspective will appear after agents analyze this
                    project.
                  </p>
                </div>
              ) : (
                <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {feedback.map((item) => {
                    const Icon =
                      AGENT_ICONS[item.agent_name] ?? Bot;

                    return (
                      <AgentCard
                        key={item.id}
                        feedback={item}
                        icon={Icon}
                      />
                    );
                  })}
                </div>
              )}
            </section>

            {/* ========================================================
                SKILL LANDSCAPE
            ======================================================== */}
            <section className="rounded-3xl border border-primary-100 bg-surface p-6 shadow-sm md:p-8">
              <SectionHeading
                icon={GraduationCap}
                title="Skill Landscape"
                subtitle="Skills already stored or identified by your project data."
              />

              <div className="mt-6">
                {skills.length === 0 && uniqueSkillGaps.length === 0 ? (
                  <EmptyData message="No skill data has been stored for this project yet." />
                ) : (
                  <div className="flex flex-wrap gap-2.5">
                    {skills.map((skill) => (
                      <span
                        key={skill.id}
                        className="rounded-full border border-primary-100 bg-primary-50 px-4 py-2 text-sm font-medium text-primary-600"
                      >
                        {skill.tech_stack}
                        <span className="ml-2 text-xs text-primary-400">
                          {skill.fluency_level}
                        </span>
                      </span>
                    ))}

                    {uniqueSkillGaps.map((skill) => (
                      <span
                        key={`gap-${skill}`}
                        className="rounded-full border border-amber-200 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-500"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* ========================================================
                STORED RECOMMENDATIONS
            ======================================================== */}
            <section className="rounded-3xl border border-primary-100 bg-surface p-6 shadow-sm md:p-8">
              <SectionHeading
                icon={Sparkles}
                title="AI Recommendations"
                subtitle="Only recommendations actually stored by the agents."
              />

              <div className="mt-6 space-y-4">
                {recommendations.length === 0 ? (
                  <EmptyData message="No stored recommendations for this project yet." />
                ) : (
                  recommendations.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-amber-200 bg-amber-100/50 p-5"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-xs font-bold uppercase tracking-[0.15em] text-amber-500">
                          {AGENT_LABELS[item.agent_name] ?? item.agent_name}
                        </span>

                        <span className="text-xs text-ink-400">
                          {formatDate(item.created_at)}
                        </span>
                      </div>

                      <p className="text-sm leading-7 text-ink-700">
                        {item.suggested_adjustments}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* ========================================================
                FOOTER ACTIONS
            ======================================================== */}
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href="/focus-room"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary-100 bg-surface px-5 py-3 text-sm font-semibold text-ink-500 transition hover:border-primary-300 hover:text-primary-600"
              >
                <ArrowLeft size={16} />
                Focus Room
              </Link>

              <Link
                href="/mentor"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition hover:bg-primary-700"
              >
                Open AI Mentor
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        )}

        {loadingProjectData && selectedProject && (
          <div className="fixed bottom-5 right-5 flex items-center gap-2 rounded-full border border-primary-100 bg-surface px-4 py-2.5 text-xs font-semibold text-ink-500 shadow-lg">
            <Loader2 className="animate-spin" size={14} />
            Loading stored project data...
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   SMALL UI COMPONENTS
================================================================ */

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Code2;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-primary-100 bg-surface-alt p-4">
      <div className="mb-3 flex items-center gap-2 text-primary-600">
        <Icon size={17} />
        <span className="text-[10px] font-bold uppercase tracking-[0.16em]">
          {label}
        </span>
      </div>

      <p className="truncate text-sm font-semibold text-ink-900" title={value}>
        {value}
      </p>
    </div>
  );
}

function BlueprintCard({
  icon: Icon,
  label,
  title,
  children,
  className = "",
}: {
  icon: typeof Code2;
  label: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-primary-100 bg-surface p-6 shadow-sm ${className}`}
    >
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
          <Icon size={20} />
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary-600">
            {label}
          </p>

          <h4 className="mt-1 font-display text-lg font-bold text-ink-900">
            {title}
          </h4>
        </div>
      </div>

      {children}
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Code2;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-100 text-primary-600">
        <Icon size={22} />
      </div>

      <div>
        <h3 className="font-display text-2xl font-bold text-ink-900">
          {title}
        </h3>

        <p className="text-sm text-ink-400">{subtitle}</p>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-[120px] rounded-2xl bg-primary-50 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-400">
        {label}
      </p>

      <p className="mt-1 text-xl font-bold text-ink-900">{value}</p>
    </div>
  );
}

function AgentCard({
  feedback,
  icon: Icon,
}: {
  feedback: AgentFeedback;
  icon: typeof Bot;
}) {
  const [open, setOpen] = useState(false);

  const verdict = feedback.verdict ?? "No verdict stored";
  const className = verdictClassName(feedback.verdict);

  return (
    <div className="rounded-2xl border border-primary-100 bg-surface-alt p-5 transition hover:border-primary-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
            <Icon size={19} />
          </div>

          <div>
            <p className="font-semibold text-ink-900">
              {AGENT_LABELS[feedback.agent_name] ?? feedback.agent_name}
            </p>

            {feedback.confidence_score !== null && (
              <p className="text-xs text-ink-400">
                {feedback.confidence_score}% confidence
              </p>
            )}
          </div>
        </div>

        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${className}`}
        >
          {verdict}
        </span>
      </div>

      {feedback.reasoning && (
        <p className="mt-4 line-clamp-3 text-sm leading-6 text-ink-500">
          {feedback.reasoning}
        </p>
      )}

      {(feedback.reasoning ||
        feedback.skill_gaps?.length ||
        feedback.suggested_adjustments) && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="mt-4 flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700"
        >
          {open ? "Hide analysis" : "View analysis"}
          {open ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
        </button>
      )}

      {open && (
        <div className="mt-4 space-y-4 border-t border-primary-100 pt-4">
          {feedback.reasoning && (
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">
                Reasoning
              </p>

              <p className="text-sm leading-6 text-ink-500">
                {feedback.reasoning}
              </p>
            </div>
          )}

          {feedback.skill_gaps && feedback.skill_gaps.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">
                Skill Gaps
              </p>

              <div className="flex flex-wrap gap-2">
                {feedback.skill_gaps.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-primary-50 px-2.5 py-1 text-xs text-primary-600"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {feedback.suggested_adjustments && (
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">
                Recommendation
              </p>

              <p className="text-sm leading-6 text-ink-500">
                {feedback.suggested_adjustments}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyData({
  message = "No data stored yet.",
}: {
  message?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-primary-200 bg-surface-alt px-4 py-5 text-sm text-ink-400">
      {message}
    </div>
  );
}