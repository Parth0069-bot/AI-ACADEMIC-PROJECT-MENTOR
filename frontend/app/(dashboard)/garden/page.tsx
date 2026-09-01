"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Plus,
  Sparkles,
  CheckCircle2,
  Code2,
  Flower2,
  GraduationCap,
  Leaf,
  Loader2,
  Sprout,
  Target,
  TreePine,
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

type SkillGap = {
  name: string;
  agents: string[];
};

const FLUENCY_LABELS = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
} as const;

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

function agentLabel(name: string) {
  return (
    AGENT_LABELS[name] ??
    name
      .replace(/_agent$/, "")
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function splitTechStack(value: string | null) {
  if (!value?.trim()) return [];

  return value
    .split(/[,â€¢|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function GardenOfGrowthPage() {
  const { profile } = useAuth();

  const [skills, setSkills] = useState<SkillAssessment[]>([]);
  const [projects, setProjects] = useState<ProjectIdea[]>([]);
  const [feedback, setFeedback] = useState<AgentFeedback[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedSkill, setSelectedSkill] =
    useState<SkillAssessment | null>(null);

  const [selectedGap, setSelectedGap] =
    useState<SkillGap | null>(null);

  const [showAddSkill, setShowAddSkill] = useState(false);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillLevel, setNewSkillLevel] =
    useState<SkillAssessment["fluency_level"]>("beginner");
  const [savingSkill, setSavingSkill] = useState(false);
  const [skillSaveError, setSkillSaveError] = useState("");
  const [skillSaveSuccess, setSkillSaveSuccess] = useState("");

  useEffect(() => {
    if (!profile?.id) return;

    const studentId = profile.id;

    async function loadGardenData() {
      setLoading(true);
      setError("");

      const [skillsResult, projectsResult] = await Promise.all([
        supabase
          .from("skill_assessment")
          .select("*")
          .eq("student_id", studentId)
          .order("submitted_at", { ascending: false }),

        supabase
          .from("project_ideas")
          .select("*")
          .eq("student_id", studentId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
      ]);

      if (skillsResult.error) {
        console.error(skillsResult.error);
        setError("Unable to load your skill assessment.");
      }

      if (projectsResult.error) {
        console.error(projectsResult.error);
        setError("Unable to load your projects.");
      }

      const realSkills =
        (skillsResult.data ?? []) as SkillAssessment[];

      const realProjects =
        (projectsResult.data ?? []) as ProjectIdea[];

      setSkills(realSkills);
      setProjects(realProjects);

      if (realProjects.length > 0) {
        const projectIds = realProjects.map(
          (project) => project.id
        );

        const { data: feedbackData, error: feedbackError } =
          await supabase
            .from("agent_feedback")
            .select("*")
            .in("idea_id", projectIds)
            .order("created_at", { ascending: false });

        if (feedbackError) {
          console.error(feedbackError);
        } else {
          setFeedback(
            (feedbackData ?? []) as AgentFeedback[]
          );
        }
      } else {
        setFeedback([]);
      }

      setLoading(false);
    }

    loadGardenData();
  }, [profile?.id]);

  const projectTechnologies = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        projects: string[];
      }
    >();

    projects.forEach((project) => {
      splitTechStack(project.tech_stack).forEach(
        (technology) => {
          const key = technology.toLowerCase();

          if (!map.has(key)) {
            map.set(key, {
              name: technology,
              projects: [],
            });
          }

          const current = map.get(key)!;

          if (!current.projects.includes(project.title)) {
            current.projects.push(project.title);
          }
        }
      );
    });

    return Array.from(map.values());
  }, [projects]);

  const skillGaps = useMemo<SkillGap[]>(() => {
    const map = new Map<string, SkillGap>();

    feedback.forEach((item) => {
      (item.skill_gaps ?? []).forEach((gap) => {
        const clean = gap.trim();

        if (!clean) return;

        const key = clean.toLowerCase();

        if (!map.has(key)) {
          map.set(key, {
            name: clean,
            agents: [],
          });
        }

        const current = map.get(key)!;
        const label = agentLabel(item.agent_name);

        if (!current.agents.includes(label)) {
          current.agents.push(label);
        }
      });
    });

    return Array.from(map.values());
  }, [feedback]);

  const strongestSkill = useMemo(() => {
    if (!skills.length) return null;

    const order = {
      beginner: 1,
      intermediate: 2,
      advanced: 3,
    };

    return [...skills].sort(
      (a, b) =>
        order[b.fluency_level] -
        order[a.fluency_level]
    )[0];
  }, [skills]);

  const skillDevelopmentResults = useMemo(
    () =>
      feedback.filter(
        (item) =>
          item.agent_name === "skill_development_agent"
      ),
    [feedback]
  );

  async function addSkill() {
    const skillName = newSkillName.trim();

    if (!profile?.id || !skillName) {
      setSkillSaveError("Please enter a skill name.");
      return;
    }

    setSavingSkill(true);
    setSkillSaveError("");
    setSkillSaveSuccess("");

    const { data, error: insertError } = await supabase
      .from("skill_assessment")
      .insert({
        student_id: profile.id,
        tech_stack: skillName,
        fluency_level: newSkillLevel,
      })
      .select("*")
      .single();

    if (insertError) {
      console.error(insertError);
      setSkillSaveError(
        insertError.message || "Unable to save this skill right now."
      );
      setSavingSkill(false);
      return;
    }

    setSkills((current) => [
      data as SkillAssessment,
      ...current,
    ]);

    setNewSkillName("");
    setNewSkillLevel("beginner");
    setSkillSaveSuccess("Skill planted successfully.");
    setSavingSkill(false);

    window.setTimeout(() => {
      setShowAddSkill(false);
      setSkillSaveSuccess("");
    }, 900);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas">
        <Topbar
          title="Garden of Growth"
          subtitle="Watch your real skills take shape."
        />

        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-mint-100">
              <Sprout
                size={30}
                className="animate-pulse text-mint-500"
              />
            </div>

            <p className="mt-4 text-sm text-ink-400">
              Growing your real skill garden...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f8ef]">
      <Topbar
        title="Garden of Growth"
        subtitle="A visual garden built from your real skills and project data."
      />

      <main className="px-6 md:px-10 pb-10">
        {error && (
          <div className="mx-auto mb-5 flex max-w-7xl items-center gap-2 rounded-2xl border border-coral-500/20 bg-coral-100 px-5 py-4 text-sm text-coral-500">
            <X size={17} />
            {error}
          </div>
        )}

        {/* ============================================================
            GARDEN HERO
        ============================================================ */}

        <section className="relative mx-auto max-w-7xl overflow-hidden rounded-[38px] border border-[#dce7c8] bg-gradient-to-b from-[#f4f8e9] to-[#eaf3df] px-6 pb-0 pt-8 shadow-sm md:px-10 md:pt-10">
          <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-mint-100/70 blur-3xl" />

          <div className="pointer-events-none absolute -right-20 top-0 h-72 w-72 rounded-full bg-primary-100/50 blur-3xl" />

          <div className="relative text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/80 text-mint-500 shadow-sm">
              <Flower2 size={28} />
            </div>

            <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.3em] text-mint-600">
              Your living skill garden
            </p>

            <h1 className="mt-2 font-display text-3xl font-bold text-ink-900 md:text-4xl">
              Watch What You&apos;ve Grown
            </h1>

            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-ink-500">
              Every plant below represents something that is
              actually recorded in your academic project data.
            </p>
          </div>

          {/* ==========================================================
              ACTUAL GARDEN
          ========================================================== */}

          <div className="relative mx-auto mt-10 min-h-[430px] max-w-5xl overflow-hidden rounded-t-[40px] border-x border-t border-[#d7e4c0] bg-gradient-to-b from-[#e9f3df] to-[#dcebcf]">
            {/* sky decorations */}
            <div className="absolute left-[12%] top-12 h-10 w-24 rounded-full bg-white/50 blur-sm" />
            <div className="absolute right-[15%] top-24 h-8 w-20 rounded-full bg-white/40 blur-sm" />

            {/* sun */}
            <div className="absolute right-[8%] top-8 h-16 w-16 rounded-full bg-[#fff3b5]/70 blur-sm" />

            {/* distant hills */}
            <div className="absolute bottom-28 left-0 right-0 h-32 rounded-[50%] bg-[#cfe2bd]" />

            {/* garden ground */}
            <div className="absolute bottom-0 left-0 right-0 h-36 bg-[#b7d39f]" />

            {/* garden center */}
            <div className="relative z-10 flex min-h-[430px] flex-col items-center justify-end pb-14">
              <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-[#f2ead2] shadow-lg">
                <TreePine
                  size={40}
                  className="text-[#648b4b]"
                />
              </div>

              <div className="rounded-full border border-white/70 bg-white/75 px-5 py-2 text-center shadow-sm backdrop-blur">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-mint-600">
                  Your Garden
                </p>

                <p className="mt-0.5 text-sm font-semibold text-ink-800">
                  {skills.length}{" "}
                  {skills.length === 1 ? "skill" : "skills"} planted
                </p>
              </div>
            </div>

            {/* ========================================================
                REAL SKILL PLANTS
            ======================================================== */}

            {skills.map((skill, index) => {
              const positions = [
                "left-[8%] bottom-[120px]",
                "left-[24%] bottom-[85px]",
                "left-[40%] bottom-[130px]",
                "right-[40%] bottom-[115px]",
                "right-[24%] bottom-[82px]",
                "right-[8%] bottom-[125px]",
              ];

              const position =
                positions[index % positions.length];

              return (
                <SkillPlant
                  key={skill.id}
                  skill={skill}
                  className={position}
                  onClick={() => setSelectedSkill(skill)}
                />
              );
            })}

            {skills.length === 0 && (
              <div className="absolute inset-0 z-20 flex items-center justify-center p-6">
                <div className="max-w-sm rounded-3xl border border-white/70 bg-white/85 p-7 text-center shadow-lg backdrop-blur">
                  <Sprout
                    size={36}
                    className="mx-auto text-mint-500"
                  />

                  <h2 className="mt-4 font-display text-xl font-bold text-ink-900">
                    Your first seed is waiting
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-ink-400">
                    No skill assessment has been stored yet.
                  </p>

                  <button
                    type="button"
                    onClick={() => setShowAddSkill(true)}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white"
                  >
                    Plant Your First Skill
                    <Plus size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ============================================================
            MY SKILLS — EMBEDDED INSIDE THE GARDEN
        ============================================================ */}

        <section className="mx-auto mt-7 max-w-7xl rounded-[32px] border border-[#dce7c8] bg-white p-7 shadow-sm md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-mint-100 text-mint-600">
                <Sprout size={23} />
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-mint-600">
                  Garden growth
                </p>

                <h2 className="mt-1 font-display text-2xl font-bold text-ink-900">
                  My Skills
                </h2>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-400">
                  Plant a skill, choose its current maturity, and watch it
                  appear directly in your garden.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSkillSaveError("");
                setSkillSaveSuccess("");
                setShowAddSkill(true);
              }}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
            >
              <Plus size={17} />
              Add a Skill
            </button>
          </div>

          {skills.length === 0 ? (
            <div className="mt-7 rounded-[26px] border border-dashed border-mint-200 bg-[#f7faef] p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-mint-500 shadow-sm">
                <Sprout size={27} />
              </div>

              <h3 className="mt-4 font-display text-lg font-bold text-ink-900">
                Your skill garden is ready
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-400">
                Add your first skill below. Beginner skills start as seeds,
                intermediate skills grow into leafy plants, and advanced
                skills become mature trees.
              </p>

              <button
                type="button"
                onClick={() => setShowAddSkill(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl border border-mint-200 bg-white px-5 py-3 text-sm font-semibold text-mint-600 transition hover:bg-mint-100"
              >
                <Plus size={16} />
                Plant a Skill
              </button>
            </div>
          ) : (
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {skills.map((skill) => {
                const isAdvanced = skill.fluency_level === "advanced";
                const isIntermediate =
                  skill.fluency_level === "intermediate";

                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => setSelectedSkill(skill)}
                    className="group rounded-[24px] border border-[#dce7c8] bg-[#f8faf2] p-5 text-left transition hover:-translate-y-1 hover:bg-white hover:shadow-md"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-mint-600 shadow-sm">
                        {isAdvanced ? (
                          <TreePine size={22} />
                        ) : isIntermediate ? (
                          <Leaf size={22} />
                        ) : (
                          <Sprout size={22} />
                        )}
                      </div>

                      <span
                        className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${
                          isAdvanced
                            ? "bg-mint-100 text-mint-600"
                            : isIntermediate
                              ? "bg-sky-100 text-sky-600"
                              : "bg-amber-100 text-amber-600"
                        }`}
                      >
                        {FLUENCY_LABELS[skill.fluency_level]}
                      </span>
                    </div>

                    <h3 className="mt-5 truncate font-display text-lg font-bold text-ink-900">
                      {skill.tech_stack}
                    </h3>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                      <div
                        className={`h-full rounded-full ${
                          isAdvanced
                            ? "w-full bg-mint-500"
                            : isIntermediate
                              ? "w-2/3 bg-sky-400"
                              : "w-1/3 bg-amber-400"
                        }`}
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[10px] text-ink-400">
                      <span>
                        {isAdvanced
                          ? "Mature tree"
                          : isIntermediate
                            ? "Growing plant"
                            : "New seed"}
                      </span>
                      <span className="font-semibold text-mint-600">
                        View
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-7 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-amber-50 p-4">
              <div className="flex items-center gap-2">
                <Sprout size={17} className="text-amber-500" />
                <span className="text-xs font-bold text-amber-600">
                  Seed
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-ink-400">
                Beginner skills are the seeds you're starting to develop.
              </p>
            </div>

            <div className="rounded-2xl bg-sky-50 p-4">
              <div className="flex items-center gap-2">
                <Leaf size={17} className="text-sky-500" />
                <span className="text-xs font-bold text-sky-600">
                  Growing
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-ink-400">
                Intermediate skills are actively growing through practice.
              </p>
            </div>

            <div className="rounded-2xl bg-mint-50 p-4">
              <div className="flex items-center gap-2">
                <TreePine size={17} className="text-mint-600" />
                <span className="text-xs font-bold text-mint-600">
                  Mature
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-ink-400">
                Advanced skills are represented as mature trees.
              </p>
            </div>
          </div>
        </section>

        {/* ============================================================
            GROWTH SNAPSHOT
        ============================================================ */}

        <section className="mx-auto mt-7 grid max-w-7xl gap-5 md:grid-cols-3">
          <GardenCard
            icon={Sprout}
            title="Seeds"
            value={String(
              skills.filter(
                (skill) => skill.fluency_level === "beginner"
              ).length
            )}
            description="Skills currently recorded at beginner level."
            iconClass="bg-amber-100 text-amber-500"
          />

          <GardenCard
            icon={Leaf}
            title="Growing"
            value={String(
              skills.filter(
                (skill) =>
                  skill.fluency_level === "intermediate"
              ).length
            )}
            description="Skills currently recorded at intermediate level."
            iconClass="bg-sky-100 text-sky-500"
          />

          <GardenCard
            icon={TreePine}
            title="Mature"
            value={String(
              skills.filter(
                (skill) => skill.fluency_level === "advanced"
              ).length
            )}
            description="Skills currently recorded at advanced level."
            iconClass="bg-mint-100 text-mint-500"
          />
        </section>

        {/* ============================================================
            STRONGEST PLANT
        ============================================================ */}

        {strongestSkill && (
          <section className="mx-auto mt-7 max-w-7xl">
            <div className="relative overflow-hidden rounded-[30px] border border-[#dce7c8] bg-white p-7 shadow-sm">
              <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-mint-100/60 blur-3xl" />

              <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-mint-600">
                    Your strongest recorded plant
                  </p>

                  <h2 className="mt-2 font-display text-2xl font-bold text-ink-900">
                    {strongestSkill.tech_stack}
                  </h2>

                  <p className="mt-2 text-sm text-ink-400">
                    This is based directly on the highest fluency
                    level currently stored in your assessment.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedSkill(strongestSkill)
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-mint-100 px-5 py-3 text-sm font-semibold text-mint-600 transition hover:bg-mint-100/70"
                >
                  <Sprout size={17} />
                  Visit Plant
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ============================================================
            PROJECT TECHNOLOGY MEADOW
        ============================================================ */}

        <section className="mx-auto mt-7 max-w-7xl rounded-[30px] border border-[#dce7c8] bg-white p-7 shadow-sm md:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-100 text-primary-600">
              <Code2 size={22} />
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-600">
                Project ecosystem
              </p>

              <h2 className="mt-1 font-display text-2xl font-bold text-ink-900">
                Your Technology Meadow
              </h2>

              <p className="mt-1 text-sm text-ink-400">
                Technologies taken directly from your stored project
                ideas.
              </p>
            </div>
          </div>

          {projectTechnologies.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-primary-200 bg-surface-alt p-7 text-center text-sm text-ink-400">
              No project technologies are stored yet.
            </div>
          ) : (
            <div className="mt-7 flex flex-wrap gap-3">
              {projectTechnologies.map((technology) => (
                <div
                  key={technology.name}
                  className="group rounded-full border border-[#dce7c8] bg-[#f5f9ed] px-4 py-2.5 transition hover:-translate-y-0.5 hover:shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[#648b4b]">
                      <Leaf size={15} />
                    </span>

                    <span className="text-sm font-semibold text-ink-800">
                      {technology.name}
                    </span>

                    <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-ink-400">
                      {technology.projects.length}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ============================================================
            AI GAPS â€” DRY PATCH
        ============================================================ */}

        <section className="mx-auto mt-7 max-w-7xl rounded-[30px] border border-[#eadcb9] bg-[#fffaf0] p-7 shadow-sm md:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-500">
              <Target size={22} />
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600">
                Needs nourishment
              </p>

              <h2 className="mt-1 font-display text-2xl font-bold text-ink-900">
                Areas That Need Attention
              </h2>

              <p className="mt-1 text-sm text-ink-400">
                These are only the skill gaps actually returned by
                your stored AI analyses.
              </p>
            </div>
          </div>

          {skillGaps.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-amber-200 bg-white/70 p-7 text-center">
              <CheckCircle2
                size={30}
                className="mx-auto text-mint-500"
              />

              <p className="mt-3 text-sm font-semibold text-ink-800">
                No stored AI skill gaps yet.
              </p>

              <p className="mt-1 text-xs text-ink-400">
                Nothing has been invented to fill this section.
              </p>
            </div>
          ) : (
            <div className="mt-6 flex flex-wrap gap-3">
              {skillGaps.map((gap) => (
                <button
                  key={gap.name}
                  type="button"
                  onClick={() => setSelectedGap(gap)}
                  className="rounded-full border border-amber-200 bg-white px-4 py-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-sm"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-amber-500">
                      <Target size={14} />
                    </span>

                    <span className="text-sm font-semibold text-ink-800">
                      {gap.name}
                    </span>

                    <span className="text-[9px] font-bold text-ink-400">
                      {gap.agents.length}{" "}
                      {gap.agents.length === 1
                        ? "agent"
                        : "agents"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ============================================================
            SKILL DEVELOPMENT INSIGHT
        ============================================================ */}

        {skillDevelopmentResults.length > 0 && (
          <section className="mx-auto mt-7 max-w-7xl rounded-[30px] border border-primary-100 bg-white p-7 shadow-sm md:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-100 text-primary-600">
                <Brain size={22} />
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-600">
                  AI garden guide
                </p>

                <h2 className="mt-1 font-display text-2xl font-bold text-ink-900">
                  What Your Skill Development Agent Saw
                </h2>

                <p className="mt-1 text-sm text-ink-400">
                  Actual stored output â€” no invented learning path.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {skillDevelopmentResults.map((result) => (
                <div
                  key={result.id}
                  className="rounded-2xl border border-primary-100 bg-primary-50/40 p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-primary-600">
                        {result.verdict || "Stored Analysis"}
                      </p>

                      {result.confidence_score !== null && (
                        <p className="mt-1 text-xs text-ink-400">
                          {result.confidence_score}% confidence
                        </p>
                      )}
                    </div>

                    <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold text-ink-400">
                      {formatDate(result.created_at)}
                    </span>
                  </div>

                  {result.reasoning && (
                    <p className="mt-4 text-sm leading-7 text-ink-600">
                      {result.reasoning}
                    </p>
                  )}

                  {result.suggested_adjustments && (
                    <div className="mt-4 rounded-2xl bg-white p-4">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-ink-400">
                        Stored Recommendation
                      </p>

                      <p className="mt-2 text-sm leading-6 text-ink-500">
                        {result.suggested_adjustments}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ============================================================
            IMPORTANT TRUTHFUL LIMITATION
        ============================================================ */}

        <section className="mx-auto mt-7 max-w-7xl rounded-[30px] border border-[#dce7c8] bg-white p-7 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-mint-100 text-mint-600">
              <GraduationCap size={22} />
            </div>

            <div>
              <h2 className="font-display text-lg font-bold text-ink-900">
                A truthful garden
              </h2>

              <p className="mt-1 text-sm leading-6 text-ink-400">
                Plant size and maturity here represent your stored
                fluency level, not an invented growth percentage.
                The current database does not contain enough
                historical assessment snapshots to calculate genuine
                improvement over time.
              </p>
            </div>
          </div>
        </section>

        {/* ============================================================
            NAVIGATION
        ============================================================ */}

        <div className="mx-auto mt-9 flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/concept-canvas"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary-100 bg-white px-5 py-3 text-sm font-semibold text-ink-500 transition hover:border-primary-300 hover:text-primary-600"
          >
            <ArrowLeft size={16} />
            Concept Canvas
          </Link>

          <Link
            href="/progress"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition hover:bg-primary-700"
          >
            Open Progress
            <ArrowRight size={16} />
          </Link>
        </div>
      </main>

      {/* ================================================================
          ADD SKILL MODAL
      ================================================================ */}

      {showAddSkill && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 p-4 backdrop-blur-sm"
          onMouseDown={() => {
            if (!savingSkill) {
              setShowAddSkill(false);
              setSkillSaveError("");
              setSkillSaveSuccess("");
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-[30px] border border-[#dce7c8] bg-white p-7 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mint-100 text-mint-600">
                <Sprout size={28} />
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowAddSkill(false);
                  setSkillSaveError("");
                  setSkillSaveSuccess("");
                }}
                disabled={savingSkill}
                className="rounded-full p-2 text-ink-400 transition hover:bg-canvas-alt hover:text-ink-700 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-mint-600">
              Plant a new skill
            </p>

            <h2 className="mt-2 font-display text-2xl font-bold text-ink-900">
              Add to your garden
            </h2>

            <p className="mt-2 text-sm leading-6 text-ink-400">
              Record the skill you are currently developing and choose its
              real stored fluency level.
            </p>

            <label className="mt-6 block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                Skill name
              </span>
              <input
                value={newSkillName}
                onChange={(event) => setNewSkillName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !savingSkill) {
                    void addSkill();
                  }
                }}
                placeholder="e.g. Python, React, SQL, Machine Learning"
                disabled={savingSkill}
                className="mt-2 w-full rounded-2xl border border-primary-100 bg-canvas-alt px-4 py-3 text-sm text-ink-800 outline-none transition focus:border-primary-300 focus:ring-2 focus:ring-primary-100 disabled:opacity-60"
              />
            </label>

            <label className="mt-5 block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                Current level
              </span>
              <select
                value={newSkillLevel}
                onChange={(event) =>
                  setNewSkillLevel(
                    event.target.value as SkillAssessment["fluency_level"]
                  )
                }
                disabled={savingSkill}
                className="mt-2 w-full rounded-2xl border border-primary-100 bg-canvas-alt px-4 py-3 text-sm font-medium text-ink-800 outline-none transition focus:border-primary-300 focus:ring-2 focus:ring-primary-100 disabled:opacity-60"
              >
                <option value="beginner">Beginner — Seed</option>
                <option value="intermediate">Intermediate — Growing</option>
                <option value="advanced">Advanced — Mature</option>
              </select>
            </label>

            {skillSaveError && (
              <div className="mt-4 rounded-2xl border border-coral-500/20 bg-coral-100 px-4 py-3 text-xs font-medium text-coral-500">
                {skillSaveError}
              </div>
            )}

            {skillSaveSuccess && (
              <div className="mt-4 rounded-2xl border border-mint-200 bg-mint-100 px-4 py-3 text-xs font-semibold text-mint-600">
                {skillSaveSuccess}
              </div>
            )}

            <button
              type="button"
              onClick={() => void addSkill()}
              disabled={savingSkill || !newSkillName.trim()}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-600 py-3.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingSkill ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  Planting skill...
                </>
              ) : (
                <>
                  <Sparkles size={17} />
                  Plant Skill
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ================================================================
          SKILL DETAIL MODAL
      ================================================================ */}

      {selectedSkill && (
        <SkillModal
          skill={selectedSkill}
          onClose={() => setSelectedSkill(null)}
        />
      )}

      {/* ================================================================
          GAP DETAIL MODAL
      ================================================================ */}

      {selectedGap && (
        <GapModal
          gap={selectedGap}
          onClose={() => setSelectedGap(null)}
        />
      )}
    </div>
  );
}

/* ================================================================
   SKILL PLANT
================================================================ */

function SkillPlant({
  skill,
  className,
  onClick,
}: {
  skill: SkillAssessment;
  className: string;
  onClick: () => void;
}) {
  const isBeginner = skill.fluency_level === "beginner";
  const isIntermediate =
    skill.fluency_level === "intermediate";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute z-20 flex flex-col items-center transition duration-300 hover:-translate-y-2 ${className}`}
    >
      {/* plant */}
      <div className="relative">
        {isBeginner && (
          <div className="relative">
            <div className="mx-auto h-7 w-2 rounded-full bg-[#668d4e]" />
            <div className="absolute -left-4 top-2 h-5 w-7 rotate-[-25deg] rounded-full rounded-br-none bg-[#7da65e]" />
            <div className="absolute left-1 top-1 h-5 w-7 rotate-[25deg] rounded-full rounded-bl-none bg-[#91b96f]" />
          </div>
        )}

        {isIntermediate && (
          <div className="relative h-20 w-20">
            <div className="absolute bottom-0 left-1/2 h-16 w-2 -translate-x-1/2 rounded-full bg-[#5d8846]" />

            <div className="absolute left-1 top-7 h-7 w-12 -rotate-[25deg] rounded-full rounded-br-none bg-[#79a95a]" />

            <div className="absolute right-1 top-2 h-7 w-12 rotate-[25deg] rounded-full rounded-bl-none bg-[#8cba69]" />

            <div className="absolute left-5 top-0 h-6 w-10 -rotate-[15deg] rounded-full rounded-br-none bg-[#a0c97a]" />
          </div>
        )}

        {!isBeginner && !isIntermediate && (
          <div className="relative h-28 w-28">
            <div className="absolute bottom-0 left-1/2 h-24 w-3 -translate-x-1/2 rounded-full bg-[#557b42]" />

            <div className="absolute left-0 top-9 h-9 w-16 -rotate-[30deg] rounded-full rounded-br-none bg-[#719d52]" />

            <div className="absolute right-0 top-3 h-9 w-16 rotate-[30deg] rounded-full rounded-bl-none bg-[#83ad60]" />

            <div className="absolute left-5 top-0 h-8 w-16 -rotate-[12deg] rounded-full rounded-br-none bg-[#98c873]" />

            <div className="absolute right-4 top-12 h-8 w-14 rotate-[22deg] rounded-full rounded-bl-none bg-[#6f9d51]" />
          </div>
        )}
      </div>

      {/* label */}
      <div className="mt-1 max-w-[125px] rounded-full border border-white/80 bg-white/90 px-3 py-1.5 shadow-sm backdrop-blur">
        <p className="truncate text-[11px] font-bold text-ink-800">
          {skill.tech_stack}
        </p>

        <p className="text-[9px] text-ink-400">
          {FLUENCY_LABELS[skill.fluency_level]}
        </p>
      </div>
    </button>
  );
}

/* ================================================================
   GARDEN CARD
================================================================ */

function GardenCard({
  icon: Icon,
  title,
  value,
  description,
  iconClass,
}: {
  icon: typeof Sprout;
  title: string;
  value: string;
  description: string;
  iconClass: string;
}) {
  return (
    <div className="rounded-[28px] border border-[#dce7c8] bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconClass}`}
        >
          <Icon size={21} />
        </div>

        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-ink-400">
            {title}
          </p>

          <p className="font-display text-3xl font-bold text-ink-900">
            {value}
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs leading-5 text-ink-400">
        {description}
      </p>
    </div>
  );
}

/* ================================================================
   SKILL MODAL
================================================================ */

function SkillModal({
  skill,
  onClose,
}: {
  skill: SkillAssessment;
  onClose: () => void;
}) {
  const icon =
    skill.fluency_level === "advanced"
      ? TreePine
      : skill.fluency_level === "intermediate"
        ? Leaf
        : Sprout;

  const Icon = icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-md rounded-[30px] border border-[#dce7c8] bg-white p-7 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mint-100 text-mint-600">
            <Icon size={28} />
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-ink-400 transition hover:bg-canvas-alt hover:text-ink-700"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-mint-600">
          Skill plant
        </p>

        <h2 className="mt-2 font-display text-2xl font-bold text-ink-900">
          {skill.tech_stack}
        </h2>

        <div className="mt-5 rounded-2xl bg-mint-100/60 p-4">
          <p className="text-[9px] font-bold uppercase tracking-wider text-ink-400">
            Stored fluency
          </p>

          <p className="mt-1 text-lg font-bold capitalize text-mint-600">
            {skill.fluency_level}
          </p>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-ink-400">
          <CheckCircle2 size={14} className="text-mint-500" />
          Assessed {formatDate(skill.submitted_at)}
        </div>

        <p className="mt-6 text-sm leading-6 text-ink-400">
          This plant is based directly on your stored skill
          assessment. Its appearance represents the recorded
          fluency level, not an invented progress percentage.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-2xl bg-primary-600 py-3 text-sm font-semibold text-white transition hover:bg-primary-700"
        >
          Back to Garden
        </button>
      </div>
    </div>
  );
}

/* ================================================================
   GAP MODAL
================================================================ */

function GapModal({
  gap,
  onClose,
}: {
  gap: SkillGap;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-md rounded-[30px] border border-amber-200 bg-white p-7 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-500">
            <Target size={27} />
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-ink-400 transition hover:bg-canvas-alt hover:text-ink-700"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600">
          Needs nourishment
        </p>

        <h2 className="mt-2 font-display text-2xl font-bold text-ink-900">
          {gap.name}
        </h2>

        <p className="mt-3 text-sm leading-6 text-ink-400">
          This area was actually identified as a skill gap by your
          stored AI analysis.
        </p>

        <div className="mt-6">
          <p className="text-[9px] font-bold uppercase tracking-wider text-ink-400">
            Identified by
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {gap.agents.map((agent) => (
              <span
                key={agent}
                className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-600"
              >
                {agent}
              </span>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-7 w-full rounded-2xl bg-primary-600 py-3 text-sm font-semibold text-white transition hover:bg-primary-700"
        >
          Back to Garden
        </button>
      </div>
    </div>
  );
}