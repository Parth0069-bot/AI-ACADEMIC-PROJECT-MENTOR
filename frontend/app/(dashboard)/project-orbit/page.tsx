"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  Code2,
  Cpu,
  GraduationCap,
  Loader2,
  Orbit,
  Sparkles,
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

/* =========================================================
   TYPES
========================================================= */

type OrbitKind =
  | "skill"
  | "technology"
  | "agent";

type OrbitItem = {
  id: string;
  label: string;
  kind: OrbitKind;
  detail: string;
  completed?: boolean;
};

/* =========================================================
   AGENT NAMES
========================================================= */

const AGENT_LABELS: Record<
  string,
  string
> = {
  feasibility_agent: "Feasibility",
  scope_agent: "Scope",
  technology_agent: "Technology",
  timeline_agent: "Timeline",
  risk_agent: "Risk",
  novelty_agent: "Novelty",
  skill_development_agent:
    "Skill Development",
  team_momentum_agent:
    "Team Momentum",
  viva_agent: "Viva Panel",
  calibration_agent: "Calibration",
};

function agentLabel(name: string) {
  return (
    AGENT_LABELS[name] ??
    name
      .replace(/_agent$/, "")
      .split("_")
      .map(
        (part) =>
          part.charAt(0).toUpperCase() +
          part.slice(1)
      )
      .join(" ")
  );
}

/* =========================================================
   HELPERS
========================================================= */

function splitTechStack(
  value: string | null
) {
  if (!value?.trim()) {
    return [];
  }

  return value
    .split(/[,•|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

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

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}

function latestFeedback(
  feedback: AgentFeedback[]
) {
  const map = new Map<
    string,
    AgentFeedback
  >();

  for (const item of feedback) {
    const current = map.get(
      item.agent_name
    );

    if (
      !current ||
      new Date(
        item.created_at
      ).getTime() >
        new Date(
          current.created_at
        ).getTime()
    ) {
      map.set(
        item.agent_name,
        item
      );
    }
  }

  return Array.from(map.values());
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function ProjectOrbitPage() {
  const { profile } = useAuth();

  const [projects, setProjects] =
    useState<ProjectIdea[]>([]);

  const [skills, setSkills] =
    useState<SkillAssessment[]>([]);

  const [feedback, setFeedback] =
    useState<AgentFeedback[]>([]);

  const [
    selectedProjectId,
    setSelectedProjectId,
  ] = useState<string | null>(null);

  const [
    selectedItem,
    setSelectedItem,
  ] = useState<OrbitItem | null>(
    null
  );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    projectMenuOpen,
    setProjectMenuOpen,
  ] = useState(false);

  /* =======================================================
     LOAD PROJECTS + SKILLS
  ======================================================= */

  useEffect(() => {
    const studentId = profile?.id;

    if (!studentId) {
      setLoading(false);
      return;
    }

    async function loadData() {
      setLoading(true);
      setError("");

      const [
        projectsResult,
        skillsResult,
      ] = await Promise.all([
        supabase
          .from("project_ideas")
          .select("*")
          .eq(
            "student_id",
            studentId
          )
          .is("deleted_at", null)
          .order(
            "created_at",
            {
              ascending: false,
            }
          ),

        supabase
          .from("skill_assessment")
          .select("*")
          .eq(
            "student_id",
            studentId
          )
          .order(
            "submitted_at",
            {
              ascending: false,
            }
          ),
      ]);

      if (projectsResult.error) {
        console.error(
          projectsResult.error
        );

        setError(
          "Could not load your projects."
        );
      } else {
        const realProjects =
          (projectsResult.data ??
            []) as ProjectIdea[];

        setProjects(realProjects);

        if (realProjects.length > 0) {
          setSelectedProjectId(
            (current) => {
              if (
                current &&
                realProjects.some(
                  (project) =>
                    project.id ===
                    current
                )
              ) {
                return current;
              }

              return realProjects[0].id;
            }
          );
        }
      }

      if (skillsResult.error) {
        console.error(
          skillsResult.error
        );
      } else {
        setSkills(
          (skillsResult.data ??
            []) as SkillAssessment[]
        );
      }

      setLoading(false);
    }

    loadData();
  }, [profile?.id]);

  /* =======================================================
     LOAD AI FEEDBACK FOR SELECTED PROJECT
  ======================================================= */

  useEffect(() => {
    if (!selectedProjectId) {
      setFeedback([]);
      return;
    }

    async function loadFeedback() {
      const {
        data,
        error: feedbackError,
      } = await supabase
        .from("agent_feedback")
        .select("*")
        .eq(
          "idea_id",
          selectedProjectId
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

      if (feedbackError) {
        console.error(
          feedbackError
        );

        setError(
          "Could not load the project's AI data."
        );

        setFeedback([]);
        return;
      }

      setFeedback(
        (data ?? []) as AgentFeedback[]
      );
    }

    loadFeedback();
  }, [selectedProjectId]);

  /* =======================================================
     SELECTED PROJECT
  ======================================================= */

  const project = useMemo(
    () =>
      projects.find(
        (item) =>
          item.id ===
          selectedProjectId
      ) ?? null,
    [
      projects,
      selectedProjectId,
    ]
  );

  /* =======================================================
     PROJECT TECHNOLOGIES
  ======================================================= */

  const technologies = useMemo(
    () => {
      if (!project) {
        return [];
      }

      return splitTechStack(
        project.tech_stack
      );
    },
    [project]
  );

  /* =======================================================
     LATEST AI RESULTS
  ======================================================= */

  const agentResults = useMemo(
    () =>
      latestFeedback(feedback),
    [feedback]
  );

  /* =======================================================
     ORBIT ITEMS
  ======================================================= */

  const skillItems = useMemo<
    OrbitItem[]
  >(
    () =>
      skills.map((skill) => ({
        id: `skill-${skill.id}`,
        label: skill.tech_stack,
        kind: "skill",
        detail: `Fluency: ${skill.fluency_level}`,
        completed: true,
      })),
    [skills]
  );

  const technologyItems =
    useMemo<OrbitItem[]>(
      () =>
        technologies.map(
          (
            technology,
            index
          ) => ({
            id: `technology-${index}-${technology}`,
            label: technology,
            kind: "technology",
            detail:
              "Technology recorded in this project",
            completed: true,
          })
        ),
      [technologies]
    );

  const agentItems = useMemo<
    OrbitItem[]
  >(
    () =>
      agentResults.map(
        (result) => ({
          id: `agent-${result.id}`,
          label: agentLabel(
            result.agent_name
          ),
          kind: "agent",
          detail:
            result.verdict ??
            "Stored AI analysis",
          completed: true,
        })
      ),
    [agentResults]
  );

  const allItems = useMemo(
    () => [
      ...skillItems,
      ...technologyItems,
      ...agentItems,
    ],
    [
      skillItems,
      technologyItems,
      agentItems,
    ]
  );

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f7fb]">
        <Topbar
          title="Project Orbit"
          subtitle="Explore the real ecosystem surrounding your project."
        />

        <div className="flex min-h-[75vh] items-center justify-center">
          <div className="text-center">

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-primary-600">
              <Orbit
                size={30}
                className="animate-spin"
              />
            </div>

            <p className="mt-4 text-sm text-ink-400">
              Building your project
              orbit...
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
      <div className="min-h-screen bg-[#f5f7fb]">
        <Topbar
          title="Project Orbit"
          subtitle="Explore the real ecosystem surrounding your project."
        />

        <div className="mx-auto mt-16 max-w-xl px-5">

          <div className="rounded-[36px] border border-primary-100 bg-white p-10 text-center shadow-sm">

            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary-100 text-primary-600">
              <Orbit size={34} />
            </div>

            <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.25em] text-primary-600">
              Project Orbit
            </p>

            <h1 className="mt-3 font-display text-3xl font-bold text-ink-900">
              Nothing is orbiting yet
            </h1>

            <p className="mt-3 text-sm leading-7 text-ink-400">
              Create a real project first.
              Once your project exists,
              its connected data can
              appear here.
            </p>

            <Link
              href="/submit-idea"
              className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition hover:bg-primary-700"
            >
              Create Project
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* =======================================================
     MAIN
  ======================================================= */

  return (
    <div className="min-h-screen bg-[#f5f7fb]">

      <Topbar
        title="Project Orbit"
        subtitle="Explore the real ecosystem surrounding your project."
      />

      <main className="px-6 md:px-10 pb-10">

        {/* ERROR */}

        {error && (
          <div className="mx-auto mb-5 flex max-w-6xl items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
            <X size={17} />
            {error}
          </div>
        )}

        {/* PROJECT SELECTOR */}

        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 pt-3">

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-primary-600">
              Project universe
            </p>

            <h1 className="mt-1 font-display text-2xl font-bold text-ink-900 md:text-3xl">
              {project.title}
            </h1>
          </div>

          {projects.length > 1 && (
            <div className="relative">

              <button
                type="button"
                onClick={() =>
                  setProjectMenuOpen(
                    (open) => !open
                  )
                }
                className="flex items-center gap-2 rounded-2xl border border-primary-100 bg-white px-4 py-3 text-xs font-semibold text-ink-600 shadow-sm hover:border-primary-300"
              >
                Change project

                <ChevronDown
                  size={15}
                  className={
                    projectMenuOpen
                      ? "rotate-180 transition"
                      : "transition"
                  }
                />
              </button>

              {projectMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-primary-100 bg-white p-2 shadow-2xl">

                  {projects.map(
                    (item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedProjectId(
                            item.id
                          );
                          setSelectedItem(
                            null
                          );
                          setProjectMenuOpen(
                            false
                          );
                        }}
                        className={[
                          "w-full rounded-xl px-3 py-3 text-left transition",
                          item.id ===
                          selectedProjectId
                            ? "bg-primary-50 text-primary-700"
                            : "text-ink-600 hover:bg-canvas-alt",
                        ].join(" ")}
                      >
                        <p className="text-sm font-semibold">
                          {item.title}
                        </p>

                        <p className="mt-1 text-[10px] text-ink-400">
                          Created{" "}
                          {formatDate(
                            item.created_at
                          )}
                        </p>
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* =====================================================
            ORBIT EXPERIENCE
        ===================================================== */}

        <section className="mx-auto mt-7 max-w-6xl">

          <div className="relative overflow-hidden rounded-[42px] border border-[#dce1ee] bg-[#eef1f8] shadow-[0_25px_70px_rgba(65,72,110,0.12)]">

            {/* BACKGROUND */}

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#ffffff_0%,#f5f7fc_36%,#e9edf6_100%)]" />

            {/* DECORATIVE STARS */}

            <div className="absolute left-[8%] top-[16%] h-1.5 w-1.5 rounded-full bg-primary-200" />
            <div className="absolute left-[15%] top-[65%] h-2 w-2 rounded-full bg-primary-100" />
            <div className="absolute left-[27%] top-[12%] h-1 w-1 rounded-full bg-primary-300" />
            <div className="absolute right-[13%] top-[18%] h-2 w-2 rounded-full bg-primary-100" />
            <div className="absolute right-[8%] top-[65%] h-1.5 w-1.5 rounded-full bg-primary-300" />
            <div className="absolute right-[27%] bottom-[12%] h-1 w-1 rounded-full bg-primary-200" />

            {/* HEADER INSIDE UNIVERSE */}

            <div className="relative z-20 px-6 pt-8 text-center">

              <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-white/80 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary-600 shadow-sm backdrop-blur">
                <Sparkles size={13} />
                Project Universe
              </div>

              <p className="mx-auto mt-3 max-w-xl text-xs leading-5 text-ink-400">
                Everything shown here comes
                from information already
                recorded for this student
                and project.
              </p>
            </div>

            {/* ORBIT CANVAS */}

            <div className="relative mx-auto mt-3 h-[720px] w-full max-w-[850px]">

              {/* OUTER ORBIT */}

              <div className="absolute left-1/2 top-[52%] h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary-100/80" />

              {/* MIDDLE ORBIT */}

              <div className="absolute left-1/2 top-[52%] h-[455px] w-[455px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-100" />

              {/* INNER ORBIT */}

              <div className="absolute left-1/2 top-[52%] h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-mint-100" />

              {/* SMALL ORBIT DOTS */}

              <div className="absolute left-1/2 top-[52%] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-200 shadow-[0_0_18px_rgba(120,100,220,0.35)]" />

              {/* CENTER GLOW */}

              <div className="absolute left-1/2 top-[52%] h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-200/20 blur-3xl" />

              {/* CENTER PROJECT */}

              <div className="absolute left-1/2 top-[52%] z-30 flex h-[175px] w-[175px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[7px] border-white bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 text-center shadow-[0_20px_60px_rgba(89,76,180,0.3)]">

                <div className="px-5">

                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white">
                    <Orbit size={22} />
                  </div>

                  <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.2em] text-white/70">
                    Your Project
                  </p>

                  <p className="mt-1 line-clamp-3 text-sm font-bold leading-5 text-white">
                    {project.title}
                  </p>
                </div>
              </div>

              {/* INNER ORBIT LABEL */}

              <OrbitRingLabel
                label="SKILLS"
                className="left-1/2 top-[30%] text-mint-600"
              />

              {/* MIDDLE ORBIT LABEL */}

              <OrbitRingLabel
                label="TECHNOLOGY"
                className="left-[79%] top-[52%] text-sky-600"
              />

              {/* OUTER ORBIT LABEL */}

              <OrbitRingLabel
                label="AI ANALYSIS"
                className="left-1/2 top-[8%] text-primary-600"
              />

              {/* SKILL PLANETS */}

              {skillItems.map(
                (item, index) => (
                  <OrbitPlanet
                    key={item.id}
                    item={item}
                    index={index}
                    total={
                      skillItems.length
                    }
                    radius={150}
                    centerTop="52%"
                    size="skill"
                    onClick={() =>
                      setSelectedItem(
                        item
                      )
                    }
                  />
                )
              )}

              {/* TECHNOLOGY PLANETS */}

              {technologyItems.map(
                (item, index) => (
                  <OrbitPlanet
                    key={item.id}
                    item={item}
                    index={index}
                    total={
                      technologyItems.length
                    }
                    radius={228}
                    centerTop="52%"
                    size="technology"
                    onClick={() =>
                      setSelectedItem(
                        item
                      )
                    }
                  />
                )
              )}

              {/* AI PLANETS */}

              {agentItems.map(
                (item, index) => (
                  <OrbitPlanet
                    key={item.id}
                    item={item}
                    index={index}
                    total={
                      agentItems.length
                    }
                    radius={310}
                    centerTop="52%"
                    size="agent"
                    onClick={() =>
                      setSelectedItem(
                        item
                      )
                    }
                  />
                )
              )}

              {/* NO CONNECTED DATA */}

              {allItems.length ===
                0 && (
                <div className="absolute bottom-8 left-1/2 z-40 w-[90%] max-w-md -translate-x-1/2 rounded-2xl border border-dashed border-primary-200 bg-white/90 p-5 text-center shadow-lg backdrop-blur">

                  <p className="text-sm font-semibold text-ink-700">
                    This project has no
                    orbit data yet.
                  </p>

                  <p className="mt-1 text-xs leading-5 text-ink-400">
                    Nothing has been
                    invented here. When
                    real skills,
                    technologies, or AI
                    analyses are
                    recorded, they will
                    appear in the orbit.
                  </p>
                </div>
              )}
            </div>

            {/* LEGEND */}

            <div className="relative z-20 flex flex-wrap items-center justify-center gap-2 border-t border-[#dfe3ee] bg-white/55 px-5 py-4 backdrop-blur">

              <LegendItem
                icon={GraduationCap}
                label="Skills"
                className="bg-mint-100 text-mint-600"
              />

              <LegendItem
                icon={Cpu}
                label="Technology"
                className="bg-sky-100 text-sky-600"
              />

              <LegendItem
                icon={Bot}
                label="AI Analysis"
                className="bg-primary-100 text-primary-600"
              />

              <span className="ml-1 text-[10px] text-ink-400">
                Click a planet to explore
              </span>
            </div>
          </div>
        </section>

        {/* =====================================================
            SMALL PROJECT CONTEXT
        ===================================================== */}

        <section className="mx-auto mt-6 max-w-6xl">

          <div className="rounded-[28px] border border-primary-100 bg-white p-6 shadow-sm">

            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

              <div className="max-w-3xl">

                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-primary-600">
                  At the center of the universe
                </p>

                <h2 className="mt-2 font-display text-xl font-bold text-ink-900">
                  {project.title}
                </h2>

                {project.description && (
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-ink-400">
                    {project.description}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">

                {project.domain && (
                  <ContextPill
                    label="Domain"
                    value={
                      project.domain
                    }
                  />
                )}

                {project.difficulty && (
                  <ContextPill
                    label="Difficulty"
                    value={
                      project.difficulty
                    }
                  />
                )}

                {project.duration && (
                  <ContextPill
                    label="Duration"
                    value={
                      project.duration
                    }
                  />
                )}
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================
            NAVIGATION
        ===================================================== */}

        <div className="mx-auto mt-7 flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

          <Link
            href="/journey"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary-100 bg-white px-5 py-3 text-sm font-semibold text-ink-500 transition hover:border-primary-300 hover:text-primary-600"
          >
            <ArrowLeft size={16} />
            My Journey
          </Link>

          <Link
            href="/storybook"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition hover:bg-primary-700"
          >
            Open Storybook
            <ArrowRight size={16} />
          </Link>
        </div>
      </main>

      {/* DETAIL PANEL */}

      {selectedItem && (
        <OrbitDetail
          item={selectedItem}
          feedback={feedback}
          skills={skills}
          onClose={() =>
            setSelectedItem(null)
          }
        />
      )}
    </div>
  );
}

/* =========================================================
   ORBIT PLANET
========================================================= */

function OrbitPlanet({
  item,
  index,
  total,
  radius,
  centerTop,
  size,
  onClick,
}: {
  item: OrbitItem;
  index: number;
  total: number;
  radius: number;
  centerTop: string;
  size: OrbitKind;
  onClick: () => void;
}) {
  /*
   * We deliberately show ONLY the planet on the orbit.
   *
   * The old version put a text card under every planet.
   * That was the main reason the orbit became crowded.
   */

  const angle =
    total === 1
      ? -90
      : (360 / total) *
          index -
        90;

  const x =
    Math.cos(
      (angle * Math.PI) / 180
    ) * radius;

  const y =
    Math.sin(
      (angle * Math.PI) / 180
    ) * radius;

  const Icon =
    size === "skill"
      ? GraduationCap
      : size === "technology"
        ? Cpu
        : Bot;

  const planetClass =
    size === "skill"
      ? "border-mint-200 bg-mint-100 text-mint-600 hover:bg-mint-200"
      : size === "technology"
        ? "border-sky-200 bg-sky-100 text-sky-600 hover:bg-sky-200"
        : "border-primary-200 bg-primary-100 text-primary-600 hover:bg-primary-200";

  const planetSize =
    size === "agent"
      ? "h-14 w-14"
      : "h-12 w-12";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open ${item.label}`}
      className="group absolute left-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
      style={{
        top: centerTop,
        transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
      }}
    >
      {/* PLANET */}

      <span
        className={[
          "relative flex items-center justify-center rounded-full border-4 border-white shadow-[0_8px_25px_rgba(65,72,110,0.16)] transition-all duration-300 group-hover:scale-125 group-hover:shadow-[0_10px_30px_rgba(65,72,110,0.24)]",
          planetSize,
          planetClass,
        ].join(" ")}
      >
        <Icon size={19} />

        {/* SMALL STATUS DOT */}

        {item.completed && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-emerald-400 text-white">
            <CheckCircle2
              size={10}
            />
          </span>
        )}
      </span>

      {/* HOVER LABEL ONLY */}

      <span className="pointer-events-none absolute left-1/2 top-full mt-2 w-max max-w-[150px] -translate-x-1/2 rounded-xl border border-white/80 bg-white/95 px-3 py-2 text-center opacity-0 shadow-lg backdrop-blur transition-all duration-200 group-hover:opacity-100">
        <span className="block truncate text-[10px] font-bold text-ink-800">
          {item.label}
        </span>

        <span className="mt-0.5 block truncate text-[8px] text-ink-400">
          {item.detail}
        </span>
      </span>
    </button>
  );
}

/* =========================================================
   RING LABEL
========================================================= */

function OrbitRingLabel({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <div
      className={[
        "absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 px-3 py-1 text-[8px] font-bold tracking-[0.18em] shadow-sm backdrop-blur",
        className,
      ].join(" ")}
    >
      {label}
    </div>
  );
}

/* =========================================================
   LEGEND
========================================================= */

function LegendItem({
  icon: Icon,
  label,
  className,
}: {
  icon: typeof Bot;
  label: string;
  className: string;
}) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5 text-[10px] font-semibold text-ink-500 shadow-sm">

      <span
        className={[
          "flex h-5 w-5 items-center justify-center rounded-full",
          className,
        ].join(" ")}
      >
        <Icon size={11} />
      </span>

      {label}
    </span>
  );
}

/* =========================================================
   CONTEXT PILL
========================================================= */

function ContextPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-primary-100 bg-canvas-alt px-4 py-3">

      <p className="text-[8px] font-bold uppercase tracking-wider text-ink-400">
        {label}
      </p>

      <p className="mt-1 max-w-[130px] truncate text-xs font-semibold text-ink-700">
        {value}
      </p>
    </div>
  );
}

/* =========================================================
   DETAIL PANEL
========================================================= */

function OrbitDetail({
  item,
  feedback,
  skills,
  onClose,
}: {
  item: OrbitItem;
  feedback: AgentFeedback[];
  skills: SkillAssessment[];
  onClose: () => void;
}) {
  const feedbackItem =
    item.kind === "agent"
      ? feedback.find(
          (result) =>
            `agent-${result.id}` ===
            item.id
        )
      : null;

  const skillItem =
    item.kind === "skill"
      ? skills.find(
          (skill) =>
            `skill-${skill.id}` ===
            item.id
        )
      : null;

  const Icon =
    item.kind === "skill"
      ? GraduationCap
      : item.kind === "technology"
        ? Cpu
        : Bot;

  const category =
    item.kind === "skill"
      ? "Skill"
      : item.kind === "technology"
        ? "Technology"
        : "AI Analysis";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/35 p-4 backdrop-blur-md"
      onMouseDown={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[34px] border border-primary-100 bg-white p-7 shadow-[0_30px_80px_rgba(30,35,60,0.25)]"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >

        {/* HEADER */}

        <div className="flex items-start justify-between">

          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-100 text-primary-600">
            <Icon size={27} />
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-ink-400 transition hover:bg-canvas-alt hover:text-ink-700"
          >
            <X size={19} />
          </button>
        </div>

        <p className="mt-6 text-[9px] font-bold uppercase tracking-[0.25em] text-primary-600">
          {category}
        </p>

        <h2 className="mt-2 font-display text-3xl font-bold text-ink-900">
          {item.label}
        </h2>

        {/* SKILL */}

        {skillItem && (
          <>
            <div className="mt-6 rounded-[24px] bg-mint-100/60 p-5">

              <p className="text-[9px] font-bold uppercase tracking-wider text-ink-400">
                Stored fluency
              </p>

              <p className="mt-2 text-2xl font-bold capitalize text-mint-600">
                {
                  skillItem.fluency_level
                }
              </p>
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-ink-400">
              <CheckCircle2
                size={14}
                className="text-mint-500"
              />

              Assessed{" "}
              {formatDate(
                skillItem.submitted_at
              )}
            </div>
          </>
        )}

        {/* TECHNOLOGY */}

        {item.kind ===
          "technology" && (
          <div className="mt-6 rounded-[24px] bg-sky-100/60 p-5">

            <div className="flex items-center gap-2">
              <Code2
                size={17}
                className="text-sky-600"
              />

              <p className="text-xs font-bold uppercase tracking-wider text-sky-600">
                Recorded technology
              </p>
            </div>

            <p className="mt-3 text-sm leading-7 text-ink-600">
              This technology is
              recorded in the selected
              project's technology
              stack.
            </p>
          </div>
        )}

        {/* AI RESULT */}

        {feedbackItem && (
          <>
            <div className="mt-6 flex flex-wrap gap-2">

              {feedbackItem.verdict && (
                <span className="rounded-full bg-primary-100 px-4 py-2 text-xs font-bold text-primary-600">
                  {
                    feedbackItem.verdict
                  }
                </span>
              )}

              {feedbackItem.confidence_score !==
                null &&
                feedbackItem.confidence_score !==
                  undefined && (
                  <span className="rounded-full bg-canvas-alt px-4 py-2 text-xs font-semibold text-ink-500">
                    {
                      feedbackItem.confidence_score
                    }
                    % confidence
                  </span>
                )}
            </div>

            {feedbackItem.reasoning && (
              <div className="mt-6">

                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-ink-400">
                  Reasoning
                </p>

                <p className="mt-3 text-sm leading-7 text-ink-600">
                  {
                    feedbackItem.reasoning
                  }
                </p>
              </div>
            )}

            {feedbackItem.suggested_adjustments && (
              <div className="mt-6 rounded-[24px] bg-primary-50 p-5">

                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary-600">
                  Suggested adjustment
                </p>

                <p className="mt-3 text-sm leading-7 text-ink-600">
                  {
                    feedbackItem.suggested_adjustments
                  }
                </p>
              </div>
            )}

            <p className="mt-5 text-xs text-ink-400">
              Recorded{" "}
              {formatDate(
                feedbackItem.created_at
              )}
            </p>
          </>
        )}

        {/* CLOSE */}

        <button
          type="button"
          onClick={onClose}
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-600 py-3.5 text-sm font-semibold text-white transition hover:bg-primary-700"
        >
          <Orbit size={16} />
          Return to Orbit
        </button>
      </div>
    </div>
  );
}