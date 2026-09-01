"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Code2,
  Feather,
  Lightbulb,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";

import { Topbar } from "@/components/layout/Topbar";
import { Book } from "@/components/storybook/Book";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import type { ProjectIdea } from "@/lib/types";

/* =========================================================
   REAL AGENTS USED BY THE STORYBOOK
========================================================= */

const AGENT_ORDER: string[] = [
  "feasibility_agent",
  "scope_agent",
  "technology_agent",
  "timeline_agent",
  "risk_agent",
  "novelty_agent",
];

const AGENT_LABELS: Record<string, string> = {
  feasibility_agent: "Feasibility",
  scope_agent: "Scope",
  technology_agent: "Technology",
  timeline_agent: "Timeline",
  risk_agent: "Risk",
  novelty_agent: "Novelty",
};

const AGENT_STORY_TEXT: Record<string, string> = {
  feasibility_agent:
    "The project reached its first recorded checkpoint: could this idea realistically become something that can be built?",

  scope_agent:
    "The next chapter looks at the boundaries of the project and what the recorded analysis says about its scope.",

  technology_agent:
    "The project then reached a practical question: which technology choices were recorded for this idea?",

  timeline_agent:
    "An idea also needs time. This chapter preserves the timeline analysis that was actually recorded for the project.",

  risk_agent:
    "Every project has uncertainties. This chapter keeps the risks that were identified in the stored analysis.",

  novelty_agent:
    "The project was also examined for its uniqueness. This chapter preserves the novelty result recorded by the mentor system.",
};

/* =========================================================
   STORED AGENT FEEDBACK
========================================================= */

interface StoredAgentFeedback {
  id?: string;
  idea_id?: string;
  agent_name: string;
  created_at: string;

  verdict?: string | null;
  confidence_score?: number | null;
  reasoning?: string | null;
  suggested_adjustments?: string | null;

  skill_gaps?: string[] | null;
}

/* =========================================================
   DATE HELPERS
========================================================= */

function formatDate(
  value: string | null | undefined
) {
  if (!value) {
    return "Date not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date not recorded";
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(
  value: string | null | undefined
) {
  if (!value) {
    return "Time not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Time not recorded";
  }

  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* =========================================================
   GET LATEST RESULT FOR EACH AGENT
========================================================= */

function getLatestResults(
  feedback: StoredAgentFeedback[]
) {
  const latest = new Map<
    string,
    StoredAgentFeedback
  >();

  for (const item of feedback) {
    const current = latest.get(
      item.agent_name
    );

    if (!current) {
      latest.set(item.agent_name, item);
      continue;
    }

    const currentTime = new Date(
      current.created_at
    ).getTime();

    const itemTime = new Date(
      item.created_at
    ).getTime();

    if (itemTime > currentTime) {
      latest.set(item.agent_name, item);
    }
  }

  return AGENT_ORDER
    .map((agent) => latest.get(agent))
    .filter(
      (
        item
      ): item is StoredAgentFeedback =>
        Boolean(item)
    );
}

/* =========================================================
   MAIN STORYBOOK PAGE
========================================================= */

export default function StorybookPage() {
  const { profile } = useAuth();

  const [projects, setProjects] =
    useState<ProjectIdea[]>([]);

  const [selectedProjectId, setSelectedProjectId] =
    useState<string | null>(null);

  const [feedback, setFeedback] =
    useState<StoredAgentFeedback[]>([]);

  const [loadingProjects, setLoadingProjects] =
    useState(true);

  const [loadingFeedback, setLoadingFeedback] =
    useState(false);

  const [error, setError] = useState("");

  const [page, setPage] = useState(0);

  const [direction, setDirection] =
    useState(1);

  const [showProjectPicker, setShowProjectPicker] =
    useState(false);

  /* =======================================================
     LOAD REAL PROJECTS
  ======================================================= */

  useEffect(() => {
    const studentId = profile?.id;

    if (!studentId) {
      setLoadingProjects(false);
      return;
    }

    async function loadProjects() {
      setLoadingProjects(true);
      setError("");

      const {
        data,
        error: projectError,
      } = await supabase
        .from("project_ideas")
        .select("*")
        .eq("student_id", studentId)
        .is("deleted_at", null)
        .order("created_at", {
          ascending: true,
        });

      if (projectError) {
        console.error(
          "Storybook project error:",
          projectError
        );

        setProjects([]);
        setError(
          "Could not load your projects."
        );
      } else {
        const realProjects =
          (data ?? []) as ProjectIdea[];

        setProjects(realProjects);

        if (realProjects.length > 0) {
          setSelectedProjectId(
            (current) => {
              const currentStillExists =
                current &&
                realProjects.some(
                  (project) =>
                    project.id === current
                );

              if (currentStillExists) {
                return current;
              }

              return realProjects[0].id;
            }
          );
        } else {
          setSelectedProjectId(null);
        }
      }

      setLoadingProjects(false);
    }

    loadProjects();
  }, [profile?.id]);

  /* =======================================================
     LOAD REAL AGENT FEEDBACK
  ======================================================= */

  useEffect(() => {
    if (!selectedProjectId) {
      setFeedback([]);
      setLoadingFeedback(false);
      return;
    }

    async function loadFeedback() {
      setLoadingFeedback(true);
      setError("");

      const {
        data,
        error: feedbackError,
      } = await supabase
        .from("agent_feedback")
        .select("*")
        .eq("idea_id", selectedProjectId)
        .order("created_at", {
          ascending: true,
        });

      if (feedbackError) {
        console.error(
          "Storybook feedback error:",
          feedbackError
        );

        setFeedback([]);

        setError(
          "Could not load the stored AI analysis."
        );
      } else {
        setFeedback(
          (data ?? []) as StoredAgentFeedback[]
        );
      }

      setLoadingFeedback(false);
    }

    loadFeedback();

    setPage(0);
  }, [selectedProjectId]);

  /* =======================================================
     SELECTED PROJECT
  ======================================================= */

  const project = useMemo(() => {
    return (
      projects.find(
        (item) =>
          item.id === selectedProjectId
      ) ?? null
    );
  }, [
    projects,
    selectedProjectId,
  ]);

  /* =======================================================
     LATEST AGENT RESULTS
  ======================================================= */

  const latestResults = useMemo(() => {
    return getLatestResults(feedback);
  }, [feedback]);

  /*
   * Page 0 = Cover
   * Page 1 = Beginning
   * Page 2... = AI chapters
   * Last page = Closing
   */

  const totalPages = project
    ? latestResults.length + 3
    : 1;

  /* =======================================================
     PAGE NAVIGATION
  ======================================================= */

  function goNext() {
    if (page >= totalPages - 1) {
      return;
    }

    setDirection(1);
    setPage(
      (current) => current + 1
    );
  }

  function goPrevious() {
    if (page <= 0) {
      return;
    }

    setDirection(-1);
    setPage(
      (current) => current - 1
    );
  }

  function goToPage(
    nextPage: number
  ) {
    if (nextPage === page) {
      return;
    }

    setDirection(
      nextPage > page ? 1 : -1
    );

    setPage(nextPage);
  }

  function selectProject(id: string) {
    setSelectedProjectId(id);
    setShowProjectPicker(false);
    setPage(0);
  }

  /* =======================================================
     CURRENT AGENT CHAPTER
  ======================================================= */

  const chapterIndex = page - 2;

  const currentAgent =
    chapterIndex >= 0 &&
    chapterIndex < latestResults.length
      ? latestResults[chapterIndex]
      : null;

  /* =======================================================
     LOADING PROJECTS
  ======================================================= */

  if (loadingProjects) {
    return (
      <div className="min-h-screen bg-[#f4eee2]">
        <Topbar
          title="Project Storybook"
          subtitle="Your project's story, told through real project records."
        />

        <div className="flex min-h-[75vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#eadcc5] text-[#806746]">
              <BookOpen size={28} />
            </div>

            <Loader2
              size={18}
              className="mx-auto mt-5 animate-spin text-[#9a8058]"
            />

            <p className="mt-3 font-serif text-sm text-[#8d7b61]">
              Opening your story...
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* =======================================================
     NO PROJECT
  ======================================================= */

  if (!project) {
    return (
      <div className="min-h-screen bg-[#f4eee2]">
        <Topbar
          title="Project Storybook"
          subtitle="Your project's story, told through real project records."
        />

        <div className="flex min-h-[75vh] items-center justify-center px-5">
          <div className="max-w-xl rounded-[38px] border border-[#d8c8ac] bg-[#fbf6ec] p-12 text-center shadow-xl">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[#d1bc98] bg-[#f1e4cf] text-[#8a704c]">
              <BookOpen size={34} />
            </div>

            <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.35em] text-[#a18a67]">
              Project Storybook
            </p>

            <h1 className="mt-3 font-serif text-3xl font-bold text-[#2a2316]">
              The first page is waiting
            </h1>

            <p className="mx-auto mt-4 max-w-md font-serif text-sm leading-7 text-[#806e55]">
              Submit a real project
              first. Once the project
              exists, its stored
              information and AI
              analyses can become
              chapters in your story.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* =======================================================
     MAIN UI
  ======================================================= */

  return (
    <div className="min-h-screen bg-[#f4eee2]">
      <Topbar
        title="Project Storybook"
        subtitle="Your project's story, told through real project records."
      />

      <main className="px-6 md:px-10 pb-10">

        {/* PAGE HEADER */}

        <div className="mx-auto mb-7 flex max-w-7xl flex-col gap-4 md:flex-row md:items-end md:justify-between">

          <div>
            <div className="flex items-center gap-2 text-[#8b704b]">
              <Feather size={17} />

              <span className="text-[10px] font-bold uppercase tracking-[0.28em]">
                Your project story
              </span>
            </div>

            <h1 className="mt-2 max-w-3xl font-serif text-3xl font-bold leading-tight text-[#2a2316] md:text-4xl">
              {project.title}
            </h1>

            <p className="mt-2 max-w-2xl font-serif text-sm italic text-[#8a775e]">
              A book made from what
              your project has actually
              recorded.
            </p>
          </div>

          {/* PROJECT SWITCHER */}

          {projects.length > 1 && (
            <div className="relative shrink-0">

              <button
                type="button"
                onClick={() =>
                  setShowProjectPicker(
                    (value) => !value
                  )
                }
                className="flex items-center gap-3 rounded-2xl border border-[#d6c5a7] bg-[#fbf6ec] px-4 py-3 text-left shadow-sm transition hover:border-[#bfa77e]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eadcc5] text-[#806746]">
                  <BookOpen size={16} />
                </div>

                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[#a18b69]">
                    Reading
                  </p>

                  <p className="max-w-[220px] truncate font-serif text-sm font-bold text-[#5a4935]">
                    {project.title}
                  </p>
                </div>

                <ChevronRight
                  size={16}
                  className="rotate-90 text-[#9a876b]"
                />
              </button>

              <AnimatePresence>
                {showProjectPicker && (
                  <motion.div
                    initial={{
                      opacity: 0,
                      y: -8,
                      scale: 0.98,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                    }}
                    exit={{
                      opacity: 0,
                      y: -8,
                      scale: 0.98,
                    }}
                    className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-[#d6c5a7] bg-[#fbf6ec] shadow-2xl"
                  >
                    <div className="border-b border-[#e4d8c3] px-4 py-3">
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#a18b69]">
                        Your Projects
                      </p>
                    </div>

                    <div className="max-h-64 overflow-y-auto p-2">
                      {projects.map(
                        (item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() =>
                              selectProject(
                                item.id
                              )
                            }
                            className={[
                              "w-full rounded-xl px-3 py-3 text-left transition",
                              item.id ===
                              selectedProjectId
                                ? "bg-[#eadcc5]"
                                : "hover:bg-[#f1e8d8]",
                            ].join(" ")}
                          >
                            <p className="font-serif text-sm font-bold text-[#5a4935]">
                              {item.title}
                            </p>

                            <p className="mt-1 text-[10px] text-[#9b886d]">
                              Started{" "}
                              {formatDate(
                                item.created_at
                              )}
                            </p>
                          </button>
                        )
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* BOOK */}

        <section className="mx-auto max-w-7xl">

          <Book
            page={page}
            direction={direction}
            loading={loadingFeedback}
            loadingLabel="Reading the recorded chapters..."
          >
            {/* COVER */}

            {page === 0 && (
              <CoverPage
                project={project}
                onOpen={goNext}
              />
            )}

            {/* BEGINNING */}

            {page === 1 && (
              <BeginningPage
                project={project}
              />
            )}

            {/* AI CHAPTER */}

            {currentAgent && (
              <AgentChapter
                feedback={
                  currentAgent
                }
                chapterNumber={
                  page
                }
              />
            )}

            {/* CLOSING */}

            {page ===
              totalPages - 1 &&
              page > 1 && (
                <ClosingPage
                  project={project}
                  analysisCount={
                    latestResults.length
                  }
                  onReadAgain={() =>
                    goToPage(0)
                  }
                />
              )}
          </Book>

          {/* BOOK CONTROLS */}

          <div className="mt-6 flex items-center justify-between">

            <button
              type="button"
              onClick={goPrevious}
              disabled={page === 0}
              className="inline-flex items-center gap-2 rounded-full border border-[#d7c7aa] bg-[#fbf6ec] px-5 py-3 font-serif text-sm font-semibold text-[#705c40] shadow-sm transition hover:bg-[#f1e6d5] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft size={17} />
              Previous
            </button>

            <div className="hidden items-center gap-1.5 sm:flex">
              {Array.from({
                length: totalPages,
              }).map(
                (_, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label={`Go to page ${
                      index + 1
                    }`}
                    onClick={() =>
                      goToPage(index)
                    }
                    className={[
                      "h-2 rounded-full transition-all",
                      index === page
                        ? "w-8 bg-[#806746]"
                        : "w-2 bg-[#d4c2a3] hover:bg-[#bda67e]",
                    ].join(" ")}
                  />
                )
              )}
            </div>

            <button
              type="button"
              onClick={goNext}
              disabled={
                page ===
                totalPages - 1
              }
              className="inline-flex items-center gap-2 rounded-full bg-[#725b3d] px-5 py-3 font-serif text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#604b32] disabled:cursor-not-allowed disabled:opacity-30"
            >
              Next
              <ChevronRight size={17} />
            </button>
          </div>

          <p className="mt-3 text-center font-serif text-[11px] text-[#9b896e]">
            Page {page + 1} of{" "}
            {totalPages}
          </p>
        </section>

        {/* ERROR */}

        {error && (
          <div className="mx-auto mt-5 flex max-w-3xl items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            <X size={16} />
            {error}
          </div>
        )}
      </main>
    </div>
  );
}

/* =========================================================
   COVER PAGE
========================================================= */

function CoverPage({
  project,
  onOpen,
}: {
  project: ProjectIdea;
  onOpen: () => void;
}) {
  return (
    <div className="relative flex min-h-[720px] items-center justify-center overflow-hidden px-8 py-16">

      <div className="pointer-events-none absolute inset-6 rounded-[24px] border border-[#d3bf9c]" />

      <div className="pointer-events-none absolute inset-10 rounded-[18px] border border-[#eadbc0]" />

      <div className="absolute left-14 top-14 text-[#c3a97d]">
        <Sparkles size={25} />
      </div>

      <div className="absolute right-16 top-20 text-[#c3a97d]">
        <Feather size={27} />
      </div>

      <div className="absolute bottom-16 left-20 text-[#c3a97d]">
        <Feather size={22} />
      </div>

      <div className="absolute bottom-14 right-20 text-[#c3a97d]">
        <Sparkles size={21} />
      </div>

      <div className="relative z-10 max-w-3xl text-center">

        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-[#c6ad84] bg-[#f1e4cf] text-[#806746] shadow-inner">
          <BookOpen size={40} />
        </div>

        <p className="mt-9 text-[10px] font-bold uppercase tracking-[0.4em] text-[#9b8059]">
          A Project Story
        </p>

        <h2 className="mt-5 font-serif text-5xl font-bold leading-tight text-[#2a2316] md:text-7xl">
          {project.title}
        </h2>

        <div className="mx-auto mt-8 flex items-center justify-center gap-3">
          <span className="h-px w-16 bg-[#c8b38f]" />

          <Sparkles
            size={14}
            className="text-[#a68a60]"
          />

          <span className="h-px w-16 bg-[#c8b38f]" />
        </div>

        <p className="mx-auto mt-8 max-w-xl font-serif text-lg italic leading-8 text-[#806e55]">
          A living record of the
          idea, the project, and the
          real analyses recorded
          along its path.
        </p>

        <p className="mt-8 font-serif text-xs text-[#a18d70]">
          Began{" "}
          {formatDate(
            project.created_at
          )}
        </p>

        <button
          type="button"
          onClick={onOpen}
          className="mt-10 inline-flex items-center gap-2 rounded-full bg-[#725b3d] px-7 py-3.5 font-serif text-sm font-semibold text-white shadow-xl transition hover:-translate-y-1 hover:bg-[#604b32]"
        >
          Begin reading
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   BEGINNING PAGE
========================================================= */

function BeginningPage({
  project,
}: {
  project: ProjectIdea;
}) {
  return (
    <div className="grid min-h-[720px] md:grid-cols-2">

      {/* LEFT PAGE */}

      <div className="relative flex flex-col justify-center border-b border-[#dfd1b9] px-8 py-14 md:border-b-0 md:px-10 md:pr-14 lg:px-16 lg:pr-20">

        <div className="absolute left-8 top-9 text-[#c4aa7d] md:left-10 lg:left-16">
          <Feather size={18} />
        </div>

        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#a18b69]">
          Chapter I
        </p>

        <h2 className="mt-6 font-serif text-5xl font-bold leading-tight text-[#2a2316]">
          In the beginning,
          <br />
          there was an idea.
        </h2>

        <div className="mt-7 h-px w-20 bg-[#cbb996]" />

        <p className="mt-7 font-serif text-lg leading-9 text-[#4a3d29]">
          Every project begins
          somewhere. For{" "}
          <strong className="text-[#2a2316]">
            {project.title}
          </strong>
          , the first recorded
          page is the project that
          exists in your workspace
          today.
        </p>

        <div className="mt-9 flex items-center gap-2 text-xs text-[#9a8a72]">
          <CalendarDays size={14} />
          Started{" "}
          {formatDate(
            project.created_at
          )}
        </div>
      </div>

      {/* RIGHT PAGE */}

      <div className="relative flex flex-col justify-center px-8 py-14 md:pl-14 md:pr-10 lg:pl-20 lg:pr-16">

        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#a18b69]">
          The project
        </p>

        <h3 className="mt-3 font-serif text-3xl font-bold text-[#2a2316]">
          What was recorded
        </h3>

        <div className="mt-7 space-y-4">

          {project.description && (
            <StoryField
              label="Description"
              value={
                project.description
              }
            />
          )}

          {project.domain && (
            <StoryField
              label="Domain"
              value={
                project.domain
              }
            />
          )}

          {project.tech_stack && (
            <StoryField
              label="Technology"
              value={
                project.tech_stack
              }
              icon={Code2}
            />
          )}

          {project.difficulty && (
            <StoryField
              label="Difficulty"
              value={
                project.difficulty
              }
            />
          )}

          {project.duration && (
            <StoryField
              label="Duration"
              value={
                project.duration
              }
            />
          )}

          {project.objectives && (
            <StoryField
              label="Objectives"
              value={
                project.objectives
              }
            />
          )}

        </div>
      </div>
    </div>
  );
}

/* =========================================================
   AGENT CHAPTER
========================================================= */

function AgentChapter({
  feedback,
  chapterNumber,
}: {
  feedback: StoredAgentFeedback;
  chapterNumber: number;
}) {
  const agentName =
    feedback.agent_name;

  const label =
    AGENT_LABELS[agentName] ??
    feedback.agent_name;

  const story =
    AGENT_STORY_TEXT[agentName] ??
    "A recorded analysis became part of the project's story.";

  return (
    <div className="grid min-h-[720px] md:grid-cols-2">

      {/* LEFT PAGE */}

      <div className="relative flex flex-col justify-center border-b border-[#dfd1b9] px-8 py-14 md:border-b-0 md:px-10 md:pr-14 lg:px-16 lg:pr-20">

        <div className="absolute left-8 top-9 text-[#c4aa7d] md:left-10 lg:left-16">
          <Feather size={18} />
        </div>

        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#a18b69]">
          Chapter{" "}
          {String(
            chapterNumber
          ).padStart(2, "0")}
        </p>

        <h2 className="mt-6 font-serif text-5xl font-bold leading-tight text-[#2a2316]">
          {label}
        </h2>

        <div className="mt-6 h-px w-20 bg-[#cbb996]" />

        <p className="mt-7 font-serif text-lg italic leading-9 text-[#4a3d29]">
          {story}
        </p>

        <div className="mt-8 rounded-[22px] border border-[#ded0b8] bg-[#f5eadb] p-5">

          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#a18b69]">
            Recorded verdict
          </p>

          <p className="mt-2 font-serif text-2xl font-bold text-[#2a2316]">
            {feedback.verdict ||
              "No verdict recorded"}
          </p>
        </div>

        <div className="mt-6 flex items-center gap-2 text-xs text-[#9a8a72]">
          <Clock3 size={14} />

          Recorded{" "}
          {formatDateTime(
            feedback.created_at
          )}
        </div>
      </div>

      {/* RIGHT PAGE */}

      <div className="relative flex flex-col justify-center px-8 py-14 md:pl-14 md:pr-10 lg:pl-20 lg:pr-16">

        <div className="flex items-center gap-2">
          <Sparkles
            size={16}
            className="text-[#a17e4d]"
          />

          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#a18b69]">
            What the mentor recorded
          </p>
        </div>

        {feedback.confidence_score !==
          null &&
          feedback.confidence_score !==
            undefined && (
            <div className="mt-7">

              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#a18b69]">
                Confidence
              </p>

              <div className="mt-2 flex items-baseline gap-2">

                <span className="font-serif text-5xl font-bold text-[#5e4930]">
                  {
                    feedback.confidence_score
                  }
                </span>

                <span className="font-serif text-xl text-[#806e55]">
                  %
                </span>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e9dcc6]">

                <div
                  className="h-full rounded-full bg-[#9d8057]"
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(
                        100,
                        Number(
                          feedback.confidence_score
                        )
                      )
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

        {feedback.reasoning && (
          <div className="mt-8">

            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#a18b69]">
              What was discovered
            </p>

            <p className="mt-3 font-serif text-base leading-8 text-[#3d3222]">
              {feedback.reasoning}
            </p>
          </div>
        )}

        {feedback.suggested_adjustments && (
          <div className="mt-7 rounded-[22px] border border-[#d9c6a6] bg-[#f3e7d4] p-5">

            <div className="flex items-center gap-2">

              <Lightbulb
                size={15}
                className="text-[#9b7845]"
              />

              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#9b7845]">
                Direction recorded
              </p>
            </div>

            <p className="mt-3 font-serif text-sm leading-7 text-[#3d3222]">
              {
                feedback.suggested_adjustments
              }
            </p>
          </div>
        )}

        {feedback.skill_gaps &&
          feedback.skill_gaps.length >
            0 && (
            <div className="mt-7">

              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#a18b69]">
                Skills mentioned
              </p>

              <div className="mt-3 flex flex-wrap gap-2">

                {feedback.skill_gaps.map(
                  (
                    skill,
                    index
                  ) => (
                    <span
                      key={`${skill}-${index}`}
                      className="rounded-full border border-[#d8c5a5] bg-[#fbf5eb] px-3 py-1.5 font-serif text-xs text-[#3d3222]"
                    >
                      {skill}
                    </span>
                  )
                )}
              </div>
            </div>
          )}

        <p className="mt-8 border-t border-[#ded1bb] pt-4 text-[10px] leading-5 text-[#a18b69]">
          This chapter displays the
          stored{" "}
          <strong>
            {label}
          </strong>{" "}
          result for this project.
          Missing information is left
          missing rather than invented.
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   CLOSING PAGE
========================================================= */

function ClosingPage({
  project,
  analysisCount,
  onReadAgain,
}: {
  project: ProjectIdea;
  analysisCount: number;
  onReadAgain: () => void;
}) {
  return (
    <div className="relative flex min-h-[720px] items-center justify-center overflow-hidden px-8 py-16 text-center">

      <div className="pointer-events-none absolute inset-6 rounded-[24px] border border-[#d7c5a5]" />

      <div className="relative max-w-2xl">

        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[#cdb993] bg-[#f1e5d3] text-[#8f7650]">
          <Feather size={30} />
        </div>

        <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.35em] text-[#a18b69]">
          End of the recorded chapters
        </p>

        <h2 className="mt-5 font-serif text-5xl font-bold leading-tight text-[#2a2316]">
          Your story continues.
        </h2>

        <div className="mx-auto mt-6 h-px w-24 bg-[#cbb996]" />

        <p className="mt-7 font-serif text-lg leading-9 text-[#4a3d29]">
          This book contains what
          has actually been
          recorded for{" "}
          <strong>
            {project.title}
          </strong>
          .
          <br />
          The next chapter belongs
          to the work you do next.
        </p>

        <div className="mt-9 inline-flex items-center gap-3 rounded-full border border-[#d9c8aa] bg-[#f8f0e2] px-5 py-3">

          <CheckCircle2
            size={17}
            className="text-[#7f986d]"
          />

          <span className="font-serif text-sm font-semibold text-[#3d3222]">
            {analysisCount} real AI{" "}
            {analysisCount === 1
              ? "analysis"
              : "analyses"}{" "}
            recorded
          </span>
        </div>

        <div className="mt-10">

          <button
            type="button"
            onClick={onReadAgain}
            className="inline-flex items-center gap-2 rounded-full border border-[#cbb996] px-6 py-3 font-serif text-sm font-semibold text-[#725b3d] transition hover:bg-[#f1e5d3]"
          >
            <BookOpen size={16} />
            Read again
          </button>

        </div>
      </div>
    </div>
  );
}

/* =========================================================
   STORY FIELD
========================================================= */

function StoryField({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof Code2;
}) {
  return (
    <div className="rounded-[20px] border border-[#ded1bb] bg-[#fbf5eb] p-4">

      <div className="flex items-center gap-2">

        {Icon && (
          <Icon
            size={14}
            className="text-[#a18b69]"
          />
        )}

        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#a18b69]">
          {label}
        </p>
      </div>

      <p className="mt-2 font-serif text-sm leading-7 text-[#3d3222]">
        {value}
      </p>
    </div>
  );
}