"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  BrainCircuit,
  CalendarClock,
  ChevronDown,
  Code2,
  Lightbulb,
  ListChecks,
  MessageCircle,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  ArrowRight,
  BookOpen,
  Compass,
  Target,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Topbar } from "@/components/layout/Topbar";
import { ChatPanel } from "@/components/mentor/ChatPanel";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import type { ProjectIdea } from "@/lib/types";

/* =========================================================
   TYPES
========================================================= */

type AgentName =
  | "feasibility_agent"
  | "scope_agent"
  | "technology_agent"
  | "timeline_agent"
  | "risk_agent"
  | "novelty_agent";

type AgentFeedbackRow = {
  id?: string;
  idea_id?: string;
  agent_name: string;
  created_at: string;
  [key: string]: unknown;
};

type AgentItem = {
  name: AgentName;
  label: string;
  icon: LucideIcon;
  description: string;
};

/* =========================================================
   AGENTS
========================================================= */

const AGENTS: AgentItem[] = [
  {
    name: "feasibility_agent",
    label: "Feasibility",
    icon: Sparkles,
    description: "Can this idea realistically be built?",
  },
  {
    name: "scope_agent",
    label: "Scope",
    icon: ListChecks,
    description: "Is the project focused and manageable?",
  },
  {
    name: "technology_agent",
    label: "Technology",
    icon: Code2,
    description: "Are the technology choices appropriate?",
  },
  {
    name: "timeline_agent",
    label: "Timeline",
    icon: CalendarClock,
    description: "Can the work fit the available time?",
  },
  {
    name: "risk_agent",
    label: "Risk",
    icon: ShieldAlert,
    description: "What could cause problems later?",
  },
  {
    name: "novelty_agent",
    label: "Novelty",
    icon: Lightbulb,
    description: "What makes this project interesting?",
  },
];

/* =========================================================
   HELPERS
========================================================= */

function getTechStack(
  project: ProjectIdea | null
): string[] {
  if (!project?.tech_stack) {
    return [];
  }

  return project.tech_stack
    .split(/[,|•]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasAgentResult(
  feedback: AgentFeedbackRow[],
  agentName: AgentName
): boolean {
  return feedback.some(
    (item) => item.agent_name === agentName
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function MentorPage() {
  const { profile } = useAuth();

  const [projects, setProjects] =
    useState<ProjectIdea[]>([]);

  const [selectedIdeaId, setSelectedIdeaId] =
    useState<string | null>(null);

  const [feedback, setFeedback] =
    useState<AgentFeedbackRow[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [loadingAgents, setLoadingAgents] =
    useState(false);

  const [projectMenuOpen, setProjectMenuOpen] =
    useState(false);

  /* =======================================================
     LOAD PROJECTS
  ======================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      if (!profile?.id) {
        if (!cancelled) {
          setProjects([]);
          setSelectedIdeaId(null);
          setLoading(false);
        }

        return;
      }

      if (!cancelled) {
        setLoading(true);
      }

      const {
        data,
        error,
      } = await supabase
        .from("project_ideas")
        .select("*")
        .eq("student_id", profile.id)
        .is("deleted_at", null)
        .order("created_at", {
          ascending: false,
        });

      if (cancelled) {
        return;
      }

      if (error) {
        console.error(
          "Error loading projects:",
          error
        );

        setProjects([]);
        setSelectedIdeaId(null);
        setLoading(false);

        return;
      }

      const loadedProjects =
        (data ?? []) as ProjectIdea[];

      setProjects(loadedProjects);

      if (loadedProjects.length > 0) {
        setSelectedIdeaId((currentId) => {
          const stillExists =
            currentId &&
            loadedProjects.some(
              (project) =>
                project.id === currentId
            );

          if (stillExists) {
            return currentId;
          }

          return loadedProjects[0].id;
        });
      } else {
        setSelectedIdeaId(null);
      }

      setLoading(false);
    }

    loadProjects();

    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  /* =======================================================
     LOAD AGENT FEEDBACK
  ======================================================= */

  async function loadAgentFeedback(
    ideaId: string
  ) {
    if (!ideaId) {
      setFeedback([]);
      return;
    }

    setLoadingAgents(true);

    const {
      data,
      error,
    } = await supabase
      .from("agent_feedback")
      .select("*")
      .eq("idea_id", ideaId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Error loading agent feedback:",
        error
      );

      setFeedback([]);
    } else {
      setFeedback(
        (data ?? []) as AgentFeedbackRow[]
      );
    }

    setLoadingAgents(false);
  }

  /* =======================================================
     LOAD FEEDBACK WHEN PROJECT CHANGES
  ======================================================= */

  useEffect(() => {
    if (!selectedIdeaId) {
      setFeedback([]);
      return;
    }

    loadAgentFeedback(selectedIdeaId);
  }, [selectedIdeaId]);

  /* =======================================================
     CURRENT PROJECT
  ======================================================= */

  const selectedProject =
    useMemo(() => {
      if (!selectedIdeaId) {
        return null;
      }

      return (
        projects.find(
          (project) =>
            project.id === selectedIdeaId
        ) ?? null
      );
    }, [
      projects,
      selectedIdeaId,
    ]);

  /* =======================================================
     TECHNOLOGIES
  ======================================================= */

  const technologies =
    useMemo(
      () =>
        getTechStack(
          selectedProject
        ),
      [selectedProject]
    );

  /* =======================================================
     AGENT COUNT
  ======================================================= */

  const completedAgentCount =
    useMemo(() => {
      return AGENTS.filter(
        (agent) =>
          hasAgentResult(
            feedback,
            agent.name
          )
      ).length;
    }, [feedback]);

  /* =======================================================
     LOADING SCREEN
  ======================================================= */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fffdfb]">
        <Topbar
          title="AI Mentor Desk"
          subtitle="Your personal project mentor"
        />

        <main className="flex min-h-[70vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[26px] bg-primary-100 text-primary-600">
              <Bot
                size={28}
                className="animate-pulse"
              />
            </div>

            <p className="mt-4 text-sm text-ink-400">
              Preparing your mentor desk...
            </p>
          </div>
        </main>
      </div>
    );
  }

  /* =======================================================
     NO PROJECT
  ======================================================= */

  if (!selectedProject) {
    return (
      <div className="min-h-screen bg-[#fffdfb]">
        <Topbar
          title="AI Mentor Desk"
          subtitle="Your personal project mentor"
        />

        <main className="px-6 md:px-10 pb-10">
          <div className="mx-auto mt-12 max-w-xl rounded-[34px] border border-primary-100 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-primary-100 text-primary-600">
              <Bot size={34} />
            </div>

            <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.25em] text-primary-600">
              AI Mentor Desk
            </p>

            <h1 className="mt-2 font-display text-3xl font-bold text-ink-900">
              Your mentor is waiting
            </h1>

            <p className="mt-3 text-sm leading-7 text-ink-400">
              Submit a project idea first. Once you have a
              project, bring it here and start a conversation
              with your AI mentor.
            </p>

            <a
              href="/submit-idea"
              className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition hover:bg-primary-700"
            >
              Submit Project
              <ArrowRight size={16} />
            </a>
          </div>
        </main>
      </div>
    );
  }

  /* =======================================================
     MAIN PAGE
  ======================================================= */

  return (
    <div className="min-h-screen bg-[#fffdfb]">
      <Topbar
        title="AI Mentor Desk"
        subtitle="A quiet space to think, question, and build."
      />

      <main className="px-6 md:px-10 pb-10">
        <div className="mx-auto max-w-[1350px]">

          {/* =================================================
              DESK HEADER
          ================================================= */}

          <section className="pt-4">
            <div className="relative overflow-visible rounded-[38px] border border-primary-100 bg-white shadow-sm">

              <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-primary-50 blur-3xl" />

              <div className="relative px-6 py-7 md:px-9 md:py-8">

                <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">

                  {/* LEFT */}
                  <div className="flex min-w-0 items-start gap-4">

                    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-[24px] bg-primary-100 text-primary-600">

                      <Bot
                        size={29}
                        strokeWidth={1.7}
                      />

                      <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-mint-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      </span>

                    </div>

                    <div className="min-w-0">

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary-600">
                          AI Mentor Desk
                        </span>

                        <span className="rounded-full bg-mint-100 px-2.5 py-1 text-[9px] font-semibold text-mint-600">
                          Ready
                        </span>
                      </div>

                      <h1 className="mt-2 font-display text-2xl font-bold text-ink-900 md:text-3xl">
                        Let&apos;s think this through.
                      </h1>

                      <p className="mt-2 max-w-xl text-sm leading-6 text-ink-500">
                        Your project is on the desk. Ask your mentor
                        anything — from your next task to a difficult
                        technical decision.
                      </p>

                    </div>
                  </div>

                  {/* PROJECT SELECTOR */}
                  <div className="relative z-[200] shrink-0">

                    <p className="mb-2 px-1 text-[9px] font-bold uppercase tracking-[0.18em] text-ink-400">
                      Working project
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        setProjectMenuOpen(
                          (value) => !value
                        )
                      }
                      className="flex min-w-[290px] items-center justify-between gap-5 rounded-2xl border border-primary-100 bg-[#fffdfb] px-4 py-3.5 text-left shadow-sm transition hover:border-primary-300 hover:shadow-md"
                    >
                      <div className="min-w-0">

                        <p className="truncate text-sm font-semibold text-ink-800">
                          {selectedProject.title}
                        </p>

                        <p className="mt-1 truncate text-[10px] text-ink-400">
                          {selectedProject.domain ??
                            "Your current project"}
                        </p>

                      </div>

                      <ChevronDown
                        size={17}
                        className={
                          projectMenuOpen
                            ? "rotate-180 text-primary-600 transition"
                            : "text-ink-400 transition"
                        }
                      />
                    </button>

                    {projectMenuOpen && (
                      <div className="absolute right-0 top-full z-[300] mt-2 w-full min-w-[300px] rounded-2xl border border-primary-100 bg-white p-2 shadow-2xl">

                        {projects.map(
                          (project) => (
                            <button
                              key={project.id}
                              type="button"
                              onClick={() => {
                                setSelectedIdeaId(
                                  project.id
                                );

                                setProjectMenuOpen(
                                  false
                                );
                              }}
                              className={`w-full rounded-xl px-3 py-3 text-left transition ${
                                project.id ===
                                selectedIdeaId
                                  ? "bg-primary-50 text-primary-700"
                                  : "text-ink-600 hover:bg-canvas-alt"
                              }`}
                            >
                              <p className="text-sm font-semibold">
                                {project.title}
                              </p>

                              <p className="mt-1 text-[10px] text-ink-400">
                                {project.domain ??
                                  "Project"}
                              </p>
                            </button>
                          )
                        )}

                      </div>
                    )}

                  </div>

                </div>
              </div>
            </div>
          </section>

          {/* =================================================
              DESK
          ================================================= */}

          <section className="mt-7 grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">

            {/* =================================================
                LEFT SIDE — DESK NOTES
            ================================================= */}

            <aside className="space-y-5">

              {/* PROJECT CARD */}
              <div className="rounded-[30px] border border-primary-100 bg-white p-5 shadow-sm">

                <div className="flex items-center gap-3">

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-100 text-primary-600">
                    <BookOpen size={19} />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-[0.17em] text-ink-400">
                      On the desk
                    </p>

                    <p className="mt-1 truncate text-sm font-bold text-ink-800">
                      {selectedProject.title}
                    </p>
                  </div>

                </div>

                {selectedProject.description && (
                  <p className="mt-5 line-clamp-5 text-xs leading-6 text-ink-400">
                    {selectedProject.description}
                  </p>
                )}

                {selectedProject.domain && (
                  <div className="mt-5 rounded-2xl bg-canvas-alt p-3.5">
                    <div className="flex items-center gap-2">
                      <Compass
                        size={13}
                        className="text-primary-500"
                      />

                      <p className="text-[8px] font-bold uppercase tracking-wider text-ink-400">
                        Domain
                      </p>
                    </div>

                    <p className="mt-1.5 text-xs font-semibold text-ink-700">
                      {selectedProject.domain}
                    </p>
                  </div>
                )}

                {technologies.length > 0 && (
                  <div className="mt-5">

                    <div className="flex items-center gap-2">
                      <Code2
                        size={13}
                        className="text-primary-500"
                      />

                      <p className="text-[8px] font-bold uppercase tracking-wider text-ink-400">
                        Technology
                      </p>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {technologies.map(
                        (technology) => (
                          <span
                            key={technology}
                            className="rounded-full bg-primary-50 px-2.5 py-1 text-[10px] font-semibold text-primary-600"
                          >
                            {technology}
                          </span>
                        )
                      )}
                    </div>

                  </div>
                )}

              </div>

              {/* QUICK PROMPTS */}
              <div className="rounded-[30px] border border-primary-100 bg-white p-5 shadow-sm">

                <div className="flex items-center gap-2">
                  <MessageCircle
                    size={14}
                    className="text-primary-500"
                  />

                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary-600">
                    Conversation starters
                  </p>
                </div>

                <p className="mt-2 text-[11px] leading-5 text-ink-400">
                  Not sure what to ask? Start with one of these.
                </p>

                <div className="mt-4 space-y-2">

                  {[
                    {
                      icon: Target,
                      text: "What should I work on next?",
                    },
                    {
                      icon: ShieldAlert,
                      text: "What could go wrong with my project?",
                    },
                    {
                      icon: Code2,
                      text: "Help me think through my architecture.",
                    },
                    {
                      icon: BrainCircuit,
                      text: "What concept should I understand better?",
                    },
                  ].map(
                    ({
                      icon: Icon,
                      text,
                    }) => (
                      <div
                        key={text}
                        className="group flex items-start gap-2.5 rounded-2xl border border-transparent bg-canvas-alt px-3 py-3 transition hover:border-primary-100 hover:bg-primary-50"
                      >
                        <Icon
                          size={14}
                          className="mt-0.5 shrink-0 text-primary-400 transition group-hover:text-primary-600"
                        />

                        <p className="text-[11px] leading-5 text-ink-500">
                          {text}
                        </p>
                      </div>
                    )
                  )}

                </div>
              </div>

              {/* KNOWLEDGE CARD */}
              <div className="rounded-[30px] border border-primary-100 bg-white p-5 shadow-sm">

                <div className="flex items-start justify-between gap-3">

                  <div className="flex items-start gap-3">

                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
                      <BrainCircuit size={18} />
                    </div>

                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.17em] text-primary-600">
                        Mentor knowledge
                      </p>

                      <p className="mt-1 text-sm font-bold text-ink-800">
                        Project context
                      </p>
                    </div>

                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (selectedIdeaId) {
                        loadAgentFeedback(
                          selectedIdeaId
                        );
                      }
                    }}
                    disabled={loadingAgents}
                    className="rounded-xl p-2 text-ink-400 transition hover:bg-canvas-alt hover:text-primary-600 disabled:opacity-50"
                    title="Refresh project knowledge"
                  >
                    <RefreshCw
                      size={14}
                      className={
                        loadingAgents
                          ? "animate-spin"
                          : ""
                      }
                    />
                  </button>

                </div>

                <div className="mt-5 flex items-end gap-2">

                  <span className="font-display text-3xl font-bold text-primary-600">
                    {completedAgentCount}
                  </span>

                  <span className="mb-1 text-sm text-ink-300">
                    / {AGENTS.length}
                  </span>

                </div>

                <p className="mt-1 text-[10px] leading-5 text-ink-400">
                  AI analyses currently available for this project.
                </p>

                <div className="mt-4 space-y-2">

                  {AGENTS.map(
                    (agent) => {
                      const complete =
                        hasAgentResult(
                          feedback,
                          agent.name
                        );

                      const Icon =
                        agent.icon;

                      return (
                        <div
                          key={agent.name}
                          className="flex items-center gap-2.5"
                        >
                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                              complete
                                ? "bg-mint-100 text-mint-600"
                                : "bg-canvas-alt text-ink-300"
                            }`}
                          >
                            <Icon size={12} />
                          </div>

                          <span
                            className={`text-[10px] ${
                              complete
                                ? "font-semibold text-ink-600"
                                : "text-ink-400"
                            }`}
                          >
                            {agent.label}
                          </span>

                          <span
                            className={`ml-auto h-1.5 w-1.5 rounded-full ${
                              complete
                                ? "bg-mint-500"
                                : "bg-ink-200"
                            }`}
                          />
                        </div>
                      );
                    }
                  )}

                </div>

              </div>

            </aside>

            {/* =================================================
                MAIN CONVERSATION
            ================================================= */}

            <div className="min-w-0">

              <div className="relative overflow-hidden rounded-[34px] border border-primary-100 bg-white shadow-sm">

                {/* DESK TOP */}
                <div className="border-b border-primary-50 bg-gradient-to-r from-primary-50/70 via-white to-[#fffdfb] px-5 py-4 md:px-6">

                  <div className="flex items-center justify-between gap-4">

                    <div className="flex items-center gap-3">

                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-100 text-primary-600">
                        <Sparkles size={17} />
                      </div>

                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary-600">
                          Your mentor
                        </p>

                        <p className="mt-0.5 text-sm font-bold text-ink-800">
                          Project thinking space
                        </p>
                      </div>

                    </div>

                    <div className="hidden items-center gap-2 rounded-full bg-mint-100 px-3 py-1.5 text-[10px] font-semibold text-mint-600 sm:flex">
                      <span className="h-1.5 w-1.5 rounded-full bg-mint-500" />
                      Ready to help
                    </div>

                  </div>

                </div>

                {/* CHAT */}
                <div className="p-3 md:p-4">

                  <ChatPanel
                    ideaId={selectedProject.id}
                  />

                </div>

                {/* CONTEXT NOTE */}
                <div className="border-t border-primary-50 bg-primary-50/50 px-5 py-4 md:px-6">

                  <div className="flex items-start gap-3">

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary-600 shadow-sm">
                      <Bot size={16} />
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-ink-700">
                        Your mentor works with your real project context.
                      </p>

                      <p className="mt-1 text-[10px] leading-5 text-ink-400">
                        Project information and stored AI analysis
                        are connected to this conversation. Change
                        the project above whenever you want to work
                        on something else.
                      </p>
                    </div>

                  </div>

                </div>

              </div>

              {/* DESK FOOTNOTE */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-2">

                <div className="flex items-center gap-2 text-[10px] text-ink-400">
                  <BookOpen size={12} />
                  <span>
                    Keep your project questions here as you build.
                  </span>
                </div>



              </div>

            </div>

          </section>

        </div>
      </main>
    </div>
  );
}