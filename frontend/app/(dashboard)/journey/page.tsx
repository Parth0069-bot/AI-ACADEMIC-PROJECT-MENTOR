"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  Code2,
  Compass,
  GraduationCap,
  Lightbulb,
  ListChecks,
  Loader2,
  Map,
  MapPin,
  Mic,
  Route,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
  X,
} from "lucide-react";

import { Topbar } from "@/components/layout/Topbar";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

import type {
  AgentFeedback,
  ProjectIdea,
  SkillAssessment,
} from "@/lib/types";

/* ================================================================
   REAL AGENT ORDER
================================================================ */

const AGENT_ORDER = [
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

/* ================================================================
   AGENT INFORMATION
================================================================ */

const AGENT_META: Record<
  string,
  {
    label: string;
    description: string;
    icon: typeof Bot;
    place: string;
  }
> = {
  feasibility_agent: {
    label: "Feasibility",
    description: "Can the project realistically be built?",
    icon: Sparkles,
    place: "Feasibility Hills",
  },

  scope_agent: {
    label: "Scope",
    description: "Is the project scope manageable?",
    icon: ListChecks,
    place: "Scope Valley",
  },

  technology_agent: {
    label: "Technology",
    description: "What technology stack fits the project?",
    icon: Code2,
    place: "Technology Forest",
  },

  timeline_agent: {
    label: "Timeline",
    description: "Is there a realistic implementation timeline?",
    icon: CalendarDays,
    place: "Timeline Bridge",
  },

  risk_agent: {
    label: "Risk",
    description: "What risks have been identified?",
    icon: ShieldAlert,
    place: "Risk Ridge",
  },

  novelty_agent: {
    label: "Novelty",
    description: "How distinct is the project idea?",
    icon: Lightbulb,
    place: "Novelty Garden",
  },

  skill_development_agent: {
    label: "Skill Development",
    description: "What skills need to be developed?",
    icon: GraduationCap,
    place: "Skill Meadow",
  },

  team_momentum_agent: {
    label: "Team Momentum",
    description: "How healthy is the team's momentum?",
    icon: Users,
    place: "Team Camp",
  },

  viva_agent: {
    label: "Viva Panel",
    description: "How prepared is the project for defense?",
    icon: Mic,
    place: "Viva Summit",
  },

  calibration_agent: {
    label: "Calibration",
    description: "How well calibrated is the overall pipeline?",
    icon: Target,
    place: "Calibration Point",
  },
};

/* ================================================================
   HELPERS
================================================================ */

function formatDate(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function latestFeedbackForAgent(
  feedback: AgentFeedback[],
  agentName: string
) {
  return feedback
    .filter((item) => item.agent_name === agentName)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    )[0];
}

/* ================================================================
   PAGE
================================================================ */

export default function JourneyPage() {
  const { profile } = useAuth();

  const [projects, setProjects] = useState<ProjectIdea[]>([]);
  const [skills, setSkills] = useState<SkillAssessment[]>([]);
  const [feedback, setFeedback] = useState<AgentFeedback[]>([]);

  const [selectedProjectId, setSelectedProjectId] =
    useState<string | null>(null);

  const [selectedStage, setSelectedStage] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingJourney, setLoadingJourney] = useState(false);
  const [error, setError] = useState("");

  /* ==============================================================
     LOAD PROJECTS + SKILLS
  ============================================================== */

  useEffect(() => {
    if (!profile?.id) return;

    const studentId = profile.id;

    async function loadProjects() {
      setLoading(true);
      setError("");

      const [projectsResult, skillsResult] = await Promise.all([
        supabase
          .from("project_ideas")
          .select("*")
          .eq("student_id", studentId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),

        supabase
          .from("skill_assessment")
          .select("*")
          .eq("student_id", studentId)
          .order("submitted_at", { ascending: false }),
      ]);

      if (projectsResult.error) {
        console.error(projectsResult.error);
        setError("Unable to load your projects.");
      } else {
        const realProjects =
          (projectsResult.data ?? []) as ProjectIdea[];

        setProjects(realProjects);

        if (realProjects.length > 0) {
          setSelectedProjectId((current) => {
            if (
              current &&
              realProjects.some((project) => project.id === current)
            ) {
              return current;
            }

            return realProjects[0].id;
          });
        }
      }

      if (skillsResult.error) {
        console.error(skillsResult.error);
      } else {
        setSkills((skillsResult.data ?? []) as SkillAssessment[]);
      }

      setLoading(false);
    }

    loadProjects();
  }, [profile?.id]);

  /* ==============================================================
     LOAD REAL AGENT FEEDBACK
  ============================================================== */

  useEffect(() => {
    async function loadFeedback() {
      if (!selectedProjectId) {
        setFeedback([]);
        return;
      }

      setLoadingJourney(true);

      const { data, error: feedbackError } = await supabase
        .from("agent_feedback")
        .select("*")
        .eq("idea_id", selectedProjectId)
        .order("created_at", { ascending: true });

      if (feedbackError) {
        console.error(feedbackError);
        setError("Unable to load the project's stored journey.");
        setFeedback([]);
      } else {
        setFeedback((data ?? []) as AgentFeedback[]);
      }

      setLoadingJourney(false);
    }

    loadFeedback();
  }, [selectedProjectId]);

  /* ==============================================================
     SELECTED PROJECT
  ============================================================== */

  const selectedProject = useMemo(
    () =>
      projects.find(
        (project) => project.id === selectedProjectId
      ) ?? null,
    [projects, selectedProjectId]
  );

  /* ==============================================================
     JOURNEY
  ============================================================== */

  const journey = useMemo(
    () =>
      AGENT_ORDER.map((agentName) => {
        const feedbackItem = latestFeedbackForAgent(
          feedback,
          agentName
        );

        return {
          agentName,
          ...AGENT_META[agentName],
          feedback: feedbackItem,
          completed: Boolean(feedbackItem),
        };
      }),
    [feedback]
  );

  const completedCount = journey.filter(
    (item) => item.completed
  ).length;

  const latestEvent = useMemo(() => {
    if (!feedback.length) return null;

    return [...feedback].sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    )[0];
  }, [feedback]);

  const selectedStageData = useMemo(
    () =>
      journey.find(
        (stage) => stage.agentName === selectedStage
      ) ?? null,
    [journey, selectedStage]
  );

  /* ==============================================================
     CURRENT POSITION
  ============================================================== */

  const currentStageIndex = useMemo(() => {
    const nextIndex = journey.findIndex(
      (stage) => !stage.completed
    );

    return nextIndex === -1 ? journey.length : nextIndex;
  }, [journey]);

  const currentPosition = useMemo(() => {
    if (completedCount === 0) {
      return "Project Start";
    }

    if (completedCount === AGENT_ORDER.length) {
      return "Journey Complete";
    }

    const next = journey.find(
      (stage) => !stage.completed
    );

    return next?.label ?? "Current Position";
  }, [completedCount, journey]);

  /* ==============================================================
     LOADING
  ============================================================== */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8f3]">
        <Topbar
          title="My Journey"
          subtitle="Explore the real path your project has taken."
        />

        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-primary-600">
              <Compass
                size={30}
                className="animate-pulse"
              />
            </div>

            <p className="mt-4 text-sm text-ink-400">
              Drawing your journey...
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ==============================================================
     EMPTY
  ============================================================== */

  if (!projects.length) {
    return (
      <div className="min-h-screen bg-[#f7f8f3]">
        <Topbar
          title="My Journey"
          subtitle="Explore the real path your project has taken."
        />

        <div className="flex min-h-[70vh] items-center justify-center px-6">
          <div className="max-w-lg rounded-[34px] border border-primary-100 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-primary-600">
              <Map size={30} />
            </div>

            <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.2em] text-primary-600">
              Your map is waiting
            </p>

            <h1 className="mt-2 font-display text-2xl font-bold text-ink-900">
              Your journey starts with a project
            </h1>

            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink-400">
              Submit a project and your real mentor journey will
              appear here.
            </p>

            <Link
              href="/submit-idea"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-200"
            >
              Submit a Project
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ==============================================================
     MAIN
  ============================================================== */

  return (
    <div className="min-h-screen bg-[#f7f8f3]">
      <Topbar
        title="My Journey"
        subtitle="Explore the real path your project has taken."
      />

      <main className="px-6 md:px-10 pb-10">

        {/* ========================================================
            PROJECT SELECTOR
        ======================================================== */}

        <section className="mx-auto max-w-7xl pt-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary-600">
                Your expedition
              </p>

              <h1 className="mt-1 font-display text-3xl font-bold text-ink-900">
                {selectedProject?.title}
              </h1>
            </div>

            {projects.length > 1 && (
              <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
                {projects.map((project) => {
                  const active =
                    project.id === selectedProjectId;

                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => {
                        setSelectedProjectId(project.id);
                        setSelectedStage(null);
                      }}
                      className={[
                        "shrink-0 rounded-full border px-4 py-2.5 text-xs font-semibold transition",
                        active
                          ? "border-primary-600 bg-primary-600 text-white shadow-md"
                          : "border-primary-100 bg-white text-ink-500 hover:border-primary-300 hover:text-primary-600",
                      ].join(" ")}
                    >
                      {project.title}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {selectedProject && (
          <>

            {/* ====================================================
                MAP
            ==================================================== */}

            <section className="mx-auto mt-7 max-w-7xl overflow-hidden rounded-[42px] border border-[#d8e1d0] bg-[#eaf0e5] shadow-sm">

              <div className="relative min-h-[760px] overflow-hidden">

                {/* ==================================================
                    LANDSCAPE
                ================================================== */}

                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,.95),transparent_30%),linear-gradient(135deg,#edf3e9,#e0eadb)]" />

                {/* Soft hills */}

                <div className="absolute -left-24 top-20 h-96 w-96 rounded-full bg-[#d7e6cf]" />

                <div className="absolute -right-28 top-40 h-[430px] w-[430px] rounded-full bg-[#d4e4cc]" />

                <div className="absolute bottom-[-180px] left-[25%] h-[480px] w-[480px] rounded-full bg-[#dbe8d4]" />

                <div className="absolute bottom-[-160px] right-[10%] h-[420px] w-[420px] rounded-full bg-[#d4e4cc]" />

                {/* Little decorative dots */}

                <div className="absolute left-[12%] top-[28%] h-3 w-3 rounded-full bg-white/80" />
                <div className="absolute left-[20%] top-[70%] h-2 w-2 rounded-full bg-white/70" />
                <div className="absolute right-[18%] top-[32%] h-3 w-3 rounded-full bg-white/80" />
                <div className="absolute right-[28%] bottom-[20%] h-2 w-2 rounded-full bg-white/70" />

                {/* ==================================================
                    TOP MAP HEADER
                ================================================== */}

                <div className="absolute left-6 top-6 z-30 md:left-8 md:top-8">
                  <div className="rounded-[26px] border border-white/80 bg-white/90 px-5 py-4 shadow-lg backdrop-blur">

                    <div className="flex items-center gap-3">

                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-100 text-primary-600">
                        <Map size={21} />
                      </div>

                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary-600">
                          Project Journey
                        </p>

                        <p className="mt-0.5 text-sm font-bold text-ink-800">
                          Follow the path
                        </p>
                      </div>

                    </div>
                  </div>
                </div>

                {/* ==================================================
                    CURRENT POSITION
                ================================================== */}

                <div className="absolute right-6 top-6 z-30 md:right-8 md:top-8">
                  <div className="rounded-[26px] border border-white/80 bg-white/90 px-5 py-4 shadow-lg backdrop-blur">

                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-ink-400">
                      You are here
                    </p>

                    <div className="mt-1 flex items-center gap-2">

                      <span
                        className={[
                          "h-2.5 w-2.5 rounded-full",
                          completedCount === 10
                            ? "bg-mint-500"
                            : "bg-amber-400 animate-pulse",
                        ].join(" ")}
                      />

                      <p className="text-sm font-bold text-primary-600">
                        {currentPosition}
                      </p>

                    </div>

                    <p className="mt-1 text-[10px] text-ink-400">
                      {completedCount} of 10 places discovered
                    </p>
                  </div>
                </div>

                {/* ==================================================
                    MAP TITLE
                ================================================== */}

                <div className="absolute left-1/2 top-24 z-20 -translate-x-1/2 text-center">

                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary-600">
                    The adventure of
                  </p>

                  <h2 className="mt-1 max-w-[500px] font-display text-2xl font-bold text-ink-900 md:text-3xl">
                    {selectedProject.title}
                  </h2>

                  <p className="mt-2 text-xs text-ink-400">
                    Every discovered place comes from a real stored AI result.
                  </p>

                </div>

                {/* ==================================================
                    WANDERING PATH
                ================================================== */}

                <svg
                  className="absolute inset-x-0 top-[220px] z-10 h-[450px] w-full"
                  viewBox="0 0 1200 450"
                  preserveAspectRatio="none"
                >
                  {/* outer road */}

                  <path
                    d="M90 370
                       C150 300 150 150 270 145
                       C380 140 350 315 470 325
                       C590 335 570 120 690 125
                       C820 130 740 350 875 350
                       C1010 350 950 135 1110 100"
                    fill="none"
                    stroke="#c8d9be"
                    strokeWidth="42"
                    strokeLinecap="round"
                  />

                  {/* inner road */}

                  <path
                    d="M90 370
                       C150 300 150 150 270 145
                       C380 140 350 315 470 325
                       C590 335 570 120 690 125
                       C820 130 740 350 875 350
                       C1010 350 950 135 1110 100"
                    fill="none"
                    stroke="#f8fbf5"
                    strokeWidth="28"
                    strokeLinecap="round"
                  />

                  {/* road marks */}

                  <path
                    d="M90 370
                       C150 300 150 150 270 145
                       C380 140 350 315 470 325
                       C590 335 570 120 690 125
                       C820 130 740 350 875 350
                       C1010 350 950 135 1110 100"
                    fill="none"
                    stroke="#dce8d5"
                    strokeWidth="3"
                    strokeDasharray="12 18"
                    strokeLinecap="round"
                  />
                </svg>

                {/* ==================================================
                    START
                ================================================== */}

                <button
                  type="button"
                  onClick={() => setSelectedStage("project_start")}
                  className="absolute bottom-[92px] left-[5%] z-30 group"
                >

                  <div className="relative">

                    <div className="flex h-16 w-16 items-center justify-center rounded-full border-[5px] border-white bg-[#dcebd6] text-[#638653] shadow-xl transition group-hover:-translate-y-1 group-hover:shadow-2xl">
                      <MapPin size={25} />
                    </div>

                    <div className="absolute left-1/2 top-full mt-3 w-32 -translate-x-1/2 rounded-2xl border border-white bg-white/95 px-3 py-2 text-center shadow-lg">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-ink-400">
                        Origin
                      </p>

                      <p className="mt-0.5 text-xs font-bold text-ink-800">
                        Project Start
                      </p>

                      <p className="mt-0.5 text-[9px] text-ink-400">
                        {formatDate(selectedProject.created_at)}
                      </p>
                    </div>

                  </div>
                </button>

                {/* ==================================================
                    AGENT LOCATIONS
                ================================================== */}

                <JourneyLocations
                  journey={journey}
                  currentStageIndex={currentStageIndex}
                  selectedStage={selectedStage}
                  onSelect={setSelectedStage}
                />

                {/* ==================================================
                    DESTINATION
                ================================================== */}

                <div className="absolute bottom-[78px] right-[5%] z-30">

                  <div className="rounded-[24px] border border-white/90 bg-white/95 px-5 py-4 shadow-xl">

                    <div className="flex items-center gap-3">

                      <div
                        className={[
                          "flex h-12 w-12 items-center justify-center rounded-full",
                          completedCount === 10
                            ? "bg-mint-100 text-mint-600"
                            : "bg-amber-100 text-amber-600",
                        ].join(" ")}
                      >
                        {completedCount === 10 ? (
                          <CheckCircle2 size={23} />
                        ) : (
                          <Target size={23} />
                        )}
                      </div>

                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-ink-400">
                          Destination
                        </p>

                        <p className="text-sm font-bold text-ink-800">
                          {completedCount === 10
                            ? "Journey Complete"
                            : "Still Exploring"}
                        </p>
                      </div>

                    </div>

                  </div>
                </div>

                {/* ==================================================
                    MAP COMPASS
                ================================================== */}

                <div className="absolute bottom-8 left-1/2 z-20 hidden -translate-x-1/2 md:block">

                  <div className="flex items-center gap-2 rounded-full border border-white/80 bg-white/75 px-4 py-2 text-[10px] font-semibold text-ink-400 backdrop-blur">
                    <Compass size={13} />
                    Explore the places along your project path
                  </div>

                </div>

              </div>
            </section>

            {/* ====================================================
                SELECTED LOCATION
            ==================================================== */}

            {selectedStageData && (
              <StagePopup
                stage={selectedStageData}
                onClose={() => setSelectedStage(null)}
              />
            )}

            {/* ====================================================
                LATEST EVENT — ONLY WHEN NOTHING SELECTED
            ==================================================== */}

            {latestEvent && !selectedStageData && (
              <section className="mx-auto mt-7 max-w-4xl">

                <div className="rounded-[28px] border border-primary-100 bg-white p-6 shadow-sm">

                  <div className="flex items-start gap-4">

                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-mint-100 text-mint-600">
                      <CheckCircle2 size={22} />
                    </div>

                    <div className="min-w-0">

                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-mint-600">
                        Last place visited
                      </p>

                      <h3 className="mt-1 font-display text-xl font-bold text-ink-900">
                        {AGENT_META[latestEvent.agent_name]?.place ??
                          latestEvent.agent_name}
                      </h3>

                      <p className="mt-1 text-xs text-ink-400">
                        {formatDate(latestEvent.created_at)} at{" "}
                        {formatTime(latestEvent.created_at)}
                      </p>

                      {latestEvent.verdict && (
                        <span className="mt-4 inline-flex rounded-full bg-mint-100 px-3 py-1.5 text-xs font-bold text-mint-600">
                          {latestEvent.verdict}
                        </span>
                      )}

                      {latestEvent.reasoning && (
                        <p className="mt-4 text-sm leading-7 text-ink-500">
                          {latestEvent.reasoning}
                        </p>
                      )}

                    </div>

                  </div>

                </div>

              </section>
            )}

            {/* ====================================================
                SMALL FOOTER
            ==================================================== */}

            <div className="mx-auto mt-8 flex max-w-7xl flex-col items-center justify-between gap-3 sm:flex-row">

              <p className="text-xs text-ink-400">
                {skills.length} skill assessment
                {skills.length === 1 ? "" : "s"} stored for this journey.
              </p>

              <Link
                href="/mentor"
                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition hover:bg-primary-700"
              >
                Continue with AI Mentor
                <ArrowRight size={16} />
              </Link>

            </div>

          </>
        )}

      </main>
    </div>
  );
}

/* ================================================================
   JOURNEY LOCATIONS
================================================================ */

function JourneyLocations({
  journey,
  currentStageIndex,
  selectedStage,
  onSelect,
}: {
  journey: Array<{
    agentName: string;
    label: string;
    description: string;
    icon: typeof Bot;
    place: string;
    completed: boolean;
    feedback?: AgentFeedback;
  }>;
  currentStageIndex: number;
  selectedStage: string | null;
  onSelect: (name: string) => void;
}) {
  /*
    The positions are purely visual.
    Whether a location is discovered comes ONLY
    from real agent_feedback data.
  */

  const positions = [
    {
      left: "22%",
      top: "25%",
    },
    {
      left: "30%",
      top: "57%",
    },
    {
      left: "40%",
      top: "29%",
    },
    {
      left: "50%",
      top: "55%",
    },
    {
      left: "60%",
      top: "28%",
    },
    {
      left: "69%",
      top: "56%",
    },
    {
      left: "77%",
      top: "29%",
    },
    {
      left: "84%",
      top: "55%",
    },
    {
      left: "91%",
      top: "30%",
    },
    {
      left: "95%",
      top: "48%",
    },
  ];

  return (
    <>
      {journey.map((stage, index) => {
        const Icon = stage.icon;

        const position =
          positions[index] ?? positions[positions.length - 1];

        const isCurrent =
          index === currentStageIndex &&
          !stage.completed;

        const isSelected =
          selectedStage === stage.agentName;

        return (
          <button
            key={stage.agentName}
            type="button"
            onClick={() => onSelect(stage.agentName)}
            className="absolute z-30 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 hover:-translate-y-[calc(50%+5px)]"
            style={{
              left: position.left,
              top: `calc(220px + ${position.top})`,
            }}
          >

            {/* glowing current location */}

            {isCurrent && (
              <span className="absolute -inset-4 animate-ping rounded-full bg-amber-300/40" />
            )}

            {/* selected ring */}

            {isSelected && (
              <span className="absolute -inset-3 rounded-full border-2 border-primary-400" />
            )}

            {/* icon */}

            <div
              className={[
                "relative flex h-[58px] w-[58px] items-center justify-center rounded-full border-[5px] border-white shadow-xl transition",
                stage.completed
                  ? "bg-primary-600 text-white"
                  : isCurrent
                    ? "bg-amber-400 text-white"
                    : "bg-white text-ink-300",
              ].join(" ")}
            >
              {stage.completed ? (
                <Icon size={21} />
              ) : (
                <Icon size={20} />
              )}

              {stage.completed && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-mint-500 text-white ring-2 ring-white">
                  <Check size={12} />
                </span>
              )}
            </div>

            {/* location label */}

            <div
              className={[
                "absolute left-1/2 top-full mt-2 -translate-x-1/2 rounded-2xl border px-3 py-2 text-center shadow-lg backdrop-blur transition",
                isSelected
                  ? "border-primary-200 bg-white"
                  : "border-white/80 bg-white/90",
              ].join(" ")}
            >
              <p className="whitespace-nowrap text-[10px] font-bold text-ink-800">
                {stage.place}
              </p>

              <p
                className={[
                  "mt-0.5 whitespace-nowrap text-[8px] font-semibold",
                  stage.completed
                    ? "text-mint-600"
                    : isCurrent
                      ? "text-amber-600"
                      : "text-ink-300",
                ].join(" ")}
              >
                {stage.completed
                  ? "DISCOVERED"
                  : isCurrent
                    ? "YOU ARE HERE"
                    : "NOT RECORDED"}
              </p>
            </div>

          </button>
        );
      })}
    </>
  );
}

/* ================================================================
   STAGE POPUP
================================================================ */

function StagePopup({
  stage,
  onClose,
}: {
  stage: {
    agentName: string;
    label: string;
    description: string;
    icon: typeof Bot;
    place: string;
    completed: boolean;
    feedback?: AgentFeedback;
  };
  onClose: () => void;
}) {
  const Icon = stage.icon;

  return (
    <section className="mx-auto mt-7 max-w-4xl">

      <div className="relative overflow-hidden rounded-[32px] border border-primary-100 bg-white shadow-lg">

        {/* decorative background */}

        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary-100/60 blur-3xl" />

        <div className="relative p-6 md:p-8">

          {/* close */}

          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-canvas-alt text-ink-400 transition hover:bg-primary-100 hover:text-primary-600"
          >
            <X size={17} />
          </button>

          <div className="flex flex-col gap-6 sm:flex-row">

            {/* location icon */}

            <div
              className={[
                "flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px]",
                stage.completed
                  ? "bg-primary-100 text-primary-600"
                  : "bg-canvas-alt text-ink-300",
              ].join(" ")}
            >
              <Icon size={28} />
            </div>

            {/* content */}

            <div className="min-w-0 flex-1 pr-8">

              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-primary-600">
                Journey location
              </p>

              <h2 className="mt-1 font-display text-2xl font-bold text-ink-900">
                {stage.place}
              </h2>

              <p className="mt-1 text-sm font-medium text-ink-500">
                {stage.label}
              </p>

              <p className="mt-2 text-sm leading-6 text-ink-400">
                {stage.description}
              </p>

              {!stage.feedback ? (
                <div className="mt-6 rounded-2xl border border-dashed border-primary-100 bg-canvas-alt p-5">

                  <p className="text-sm font-semibold text-ink-700">
                    This place has not been discovered yet.
                  </p>

                  <p className="mt-1 text-xs leading-5 text-ink-400">
                    No stored AI-agent result exists for this stage.
                    It remains unexplored until a real result is recorded.
                  </p>

                </div>
              ) : (
                <div className="mt-6 rounded-[24px] bg-primary-50/70 p-5">

                  <div className="flex flex-wrap gap-2">

                    {stage.feedback.verdict && (
                      <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-primary-600 shadow-sm">
                        {stage.feedback.verdict}
                      </span>
                    )}

                    {stage.feedback.confidence_score !== null && (
                      <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink-500 shadow-sm">
                        {stage.feedback.confidence_score}% confidence
                      </span>
                    )}

                  </div>

                  <p className="mt-3 text-[10px] text-ink-400">
                    Discovered on{" "}
                    {formatDate(stage.feedback.created_at)} at{" "}
                    {formatTime(stage.feedback.created_at)}
                  </p>

                  {stage.feedback.reasoning && (
                    <div className="mt-5">

                      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink-400">
                        What happened here
                      </p>

                      <p className="mt-2 text-sm leading-7 text-ink-600">
                        {stage.feedback.reasoning}
                      </p>

                    </div>
                  )}

                  {stage.feedback.suggested_adjustments && (
                    <div className="mt-5 rounded-2xl bg-white p-4">

                      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink-400">
                        Suggested direction
                      </p>

                      <p className="mt-2 text-sm leading-6 text-ink-500">
                        {stage.feedback.suggested_adjustments}
                      </p>

                    </div>
                  )}

                </div>
              )}

            </div>

          </div>

        </div>
      </div>

    </section>
  );
}