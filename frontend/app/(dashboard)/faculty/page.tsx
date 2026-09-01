"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Link from "next/link";
import { notify } from "@/lib/notify";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  FolderKanban,
  HeartPulse,
  HelpCircle,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Mascot } from "@/components/illustrations/Mascot";
import { ProjectHealthCard } from "@/components/faculty/ProjectHealthCard";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import {
  fetchFacultyOverview,
  fetchLatestMentorDigest,
  runMentorDigest,
  BackendError,
  type ProjectHealthIndicator,
  type MentorDigestResult,
  type ProjectHealthStatus,
  type CohortHealthSummary,
  type FacultyOverviewResult,
} from "@/lib/backendClient";

import {
  downloadDocument,
  DOCUMENT_TYPE_LABELS,
  type DocumentType,
} from "@/lib/mentorClient";

// ---------- Direct-Supabase, domain-scoped project fetch ----------
// This is the source of truth for which projects a faculty member can
// see at all -- it mirrors the RLS policy on project_ideas exactly
// (see current_faculty_domain() in supabase/migration.sql): CSE gets
// every project, every other domain is scoped to its own. RLS backs
// this up server-side regardless of what this query does; the filter
// here just avoids asking Postgres to hand back rows the client is
// going to discard.
//
// There is no "profiles" table in this schema -- project_ideas has a
// direct FK to `student`, so that's what gets embedded below. One
// query, one round trip: no N+1.

interface FacultyDomainProfile {
  id: string;
  name: string;
  email: string;
  domain: string;
}

interface DomainProjectRow {
  id: string;
  title: string;
  description: string;
  tech_stack: string | null;
  status: string;
  domain: string | null;
  created_at: string;
  student: { name: string; email: string } | null;
}

async function fetchFacultyProfile(userId: string): Promise<FacultyDomainProfile | null> {
  const { data, error } = await supabase
    .from("faculty")
    .select("id, name, email, domain")
    .eq("supabase_user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function fetchDomainProjects(facultyDomain: string): Promise<DomainProjectRow[]> {
  let query = supabase
    .from("project_ideas")
    .select(
      "id, title, description, tech_stack, status, domain, created_at, student:student_id(name, email)"
    )
    .is("deleted_at", null);

  if (facultyDomain !== "CSE") {
    query = query.eq("domain", facultyDomain);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as DomainProjectRow[];
}

function buildFallbackIndicator(row: DomainProjectRow): ProjectHealthIndicator {
  // No backend health computation has matched this project yet (the
  // backend overview is best-effort enrichment, not the source of
  // truth for which projects appear) -- render it honestly as
  // unscored rather than inventing a status.
  return {
    idea_id: row.id,
    title: row.title,
    domain: row.domain,
    student_id: "",
    student_name: row.student?.name ?? "Unknown student",
    student_email: row.student?.email ?? null,
    status: "Insufficient Data",
    health_score: 0,
    flags: [],
    feasibility_verdict: null,
    risk_verdict: null,
    momentum_verdict: null,
    timeline_verdict: null,
    latest_checkin_status: null,
    latest_checkin_week: null,
    planned_weeks: null,
    checkins_count: 0,
    agents_run: 0,
    days_since_last_activity: null,
    has_digest: false,
    latest_digest_headline: null,
    latest_digest_generated_at: null,
    created_at: row.created_at,
  };
}

function computeSummary(projects: ProjectHealthIndicator[]): CohortHealthSummary {
  const scored = projects.filter((p) => p.status !== "Insufficient Data");
  const average = scored.length
    ? Math.round((scored.reduce((sum, p) => sum + p.health_score, 0) / scored.length) * 10) / 10
    : 0;

  return {
    total_projects: projects.length,
    on_track: projects.filter((p) => p.status === "On Track").length,
    needs_attention: projects.filter((p) => p.status === "Needs Attention").length,
    at_risk: projects.filter((p) => p.status === "At Risk").length,
    insufficient_data: projects.filter((p) => p.status === "Insufficient Data").length,
    average_health_score: average,
  };
}

const TABS = [
  "All",
  "On Track",
  "Needs Attention",
  "At Risk",
  "Insufficient Data",
] as const;

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" as const },
  },
};

export default function FacultyDashboardPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const [search, setSearch] = useState("");
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [generatingDocument, setGeneratingDocument] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [digestsByIdea, setDigestsByIdea] = useState<
    Record<string, MentorDigestResult>
  >({});
  const [loadingDigestIds, setLoadingDigestIds] = useState<Set<string>>(
    new Set()
  );

  const { user } = useAuth();

  const {
    data: facultyProfile,
    error: profileError,
    isLoading: profileLoading,
  } = useSWR(user ? ["faculty-profile", user.id] : null, () => fetchFacultyProfile(user!.id));

  const {
    data: domainRows,
    error: projectsError,
    isLoading: projectsLoading,
    mutate: mutateProjects,
  } = useSWR(
    facultyProfile ? ["faculty-domain-projects", facultyProfile.domain] : null,
    () => fetchDomainProjects(facultyProfile!.domain)
  );

  // Best-effort enrichment only -- never the source of truth for which
  // projects are visible. If this fails or hasn't loaded yet, every
  // project just renders with its honest "Insufficient Data" fallback
  // instead of blocking the page.
  const { data: overview, mutate: mutateOverview } = useSWR(
    "faculty-overview",
    fetchFacultyOverview
  );

  const backendByIdeaId = useMemo(() => {
    const map = new Map<string, ProjectHealthIndicator>();
    (overview?.projects ?? []).forEach((p) => map.set(p.idea_id, p));
    return map;
  }, [overview]);

  const projects: ProjectHealthIndicator[] = useMemo(() => {
    return (domainRows ?? []).map(
      (row) => backendByIdeaId.get(row.id) ?? buildFallbackIndicator(row)
    );
  }, [domainRows, backendByIdeaId]);

  const summary = useMemo(() => computeSummary(projects), [projects]);

  const data: FacultyOverviewResult | null =
    facultyProfile && domainRows
      ? { generated_at: new Date().toISOString(), summary, projects }
      : null;

  const isLoading = profileLoading || (!!facultyProfile && projectsLoading);
  const error = profileError || projectsError;
  const notAuthorized = !profileLoading && !profileError && facultyProfile === null;

  async function mutate() {
    await Promise.all([mutateProjects(), mutateOverview()]);
  }

  async function handleToggleExpand(project: ProjectHealthIndicator) {
    const next = new Set(expandedIds);

    if (next.has(project.idea_id)) {
      next.delete(project.idea_id);
      setExpandedIds(next);
      return;
    }

    next.add(project.idea_id);
    setExpandedIds(next);

    if (!digestsByIdea[project.idea_id] && project.has_digest) {
      setLoadingDigestIds((prev) => new Set(prev).add(project.idea_id));

      try {
        const stored = await fetchLatestMentorDigest(project.idea_id);

        if (stored?.details) {
          setDigestsByIdea((prev) => ({
            ...prev,
            [project.idea_id]: stored.details as MentorDigestResult,
          }));
        }
      } catch (err) {
        toast.error(
          err instanceof BackendError
            ? err.message
            : "Couldn't load the mentor summary."
        );
      } finally {
        setLoadingDigestIds((prev) => {
          const nextSet = new Set(prev);
          nextSet.delete(project.idea_id);
          return nextSet;
        });
      }
    }
  }

  async function handleGenerateDigest(project: ProjectHealthIndicator) {
    setGeneratingIds((prev) => new Set(prev).add(project.idea_id));

    try {
      const run = await runMentorDigest(project.idea_id);

      setDigestsByIdea((prev) => ({
        ...prev,
        [project.idea_id]: run.result,
      }));

      setExpandedIds((prev) => new Set(prev).add(project.idea_id));

      mutateOverview((prev) => {
        const updatedEntry: ProjectHealthIndicator = {
          ...project,
          has_digest: true,
          latest_digest_headline: run.result.headline,
          latest_digest_generated_at: run.generated_at,
          health_score: run.health_score,
          status: run.health_status,
        };

        if (!prev) {
          return {
            generated_at: new Date().toISOString(),
            summary: computeSummary([updatedEntry]),
            projects: [updatedEntry],
          };
        }

        const exists = prev.projects.some((p) => p.idea_id === project.idea_id);
        const nextProjects = exists
          ? prev.projects.map((p) => (p.idea_id === project.idea_id ? updatedEntry : p))
          : [...prev.projects, updatedEntry];

        return { ...prev, projects: nextProjects, summary: computeSummary(nextProjects) };
      }, false);

      notify.success("Mentor summary generated!");

      if (!run.stored) {
        toast.error(
          "Summary generated but wasn't saved to the database — try again shortly."
        );
      }
    } catch (err) {
      toast.error(
        err instanceof BackendError
          ? err.message
          : "Something went wrong generating the mentor summary."
      );
    } finally {
      setGeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(project.idea_id);
        return next;
      });
    }
  }

  async function handleGenerateDocument(
    project: ProjectHealthIndicator,
    documentType: DocumentType
  ) {
    const key = `${project.idea_id}:${documentType}`;

    if (generatingDocument) return;

    setGeneratingDocument(key);

    try {
      await downloadDocument(project.idea_id, documentType);

      notify.success(
        `${DOCUMENT_TYPE_LABELS[documentType]} generated successfully!`
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't generate the document. Please try again."
      );
    } finally {
      setGeneratingDocument(null);
    }
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesTab =
        tab === "All" ||
        project.status === (tab as ProjectHealthStatus);

      if (!matchesTab) return false;
      if (!query) return true;

      return (
        project.title.toLowerCase().includes(query) ||
        project.student_name.toLowerCase().includes(query) ||
        (project.domain ?? "").toLowerCase().includes(query)
      );
    });
  }, [projects, tab, search]);

  const attentionProjects = useMemo(
    () =>
      projects
        .filter(
          (project) =>
            project.status === "At Risk" ||
            project.status === "Needs Attention"
        )
        .sort((a, b) => {
          if (a.status === "At Risk" && b.status !== "At Risk") return -1;
          if (a.status !== "At Risk" && b.status === "At Risk") return 1;
          return a.health_score - b.health_score;
        })
        .slice(0, 4),
    [projects]
  );

  const averageScore = data?.summary.average_health_score ?? 0;

  if (notAuthorized) {
    return (
      <>
        <Topbar
          title="Faculty Command Center"
          subtitle="Understand your cohort and know which projects need your attention"
        />
        <main className="px-6 md:px-10 pb-10">
          <Card className="mt-10 flex flex-col items-center gap-3 py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-coral-50 text-coral-500">
              <Lock size={22} />
            </div>
            <p className="font-display font-semibold text-ink-900">
              This account isn&apos;t registered as faculty
            </p>
            <p className="max-w-md text-sm text-ink-400">
              You&apos;re signed in, but there&apos;s no faculty profile on
              this account, so there's no domain to show projects for.
            </p>
            <Link
              href="/login/faculty"
              className="mt-2 text-sm font-semibold text-primary-600 hover:underline"
            >
              Go to faculty login
            </Link>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Faculty Command Center"
        subtitle="Understand your cohort and know which projects need your attention"
      />

      <motion.main
        variants={container}
        initial="hidden"
        animate="show"
        className="px-6 md:px-10 pb-10"
      >
        {/* HERO */}
        <motion.section
          variants={item}
          className="relative overflow-hidden rounded-[30px] border border-primary-100 bg-gradient-to-br from-[#fffaf1] via-white to-[#f2fbf6] p-7 md:p-9"
        >
          <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-primary-100/60 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-mint-100/60 blur-3xl" />

          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-white/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary-600">
                <Sparkles size={13} />
                Faculty workspace
              </div>

              <h1 className="mt-4 max-w-3xl font-display text-3xl font-bold tracking-tight text-ink-900 md:text-4xl">
                Your cohort, at a glance.
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-400 md:text-base">
                Monitor project health, spot emerging risks, and use AI
                summaries to decide where your guidance will have the most
                impact.
              </p>

              {data && (
                <div className="mt-5 flex flex-wrap items-center gap-3 text-xs">
                  <span className="rounded-full bg-primary-600 px-3 py-1.5 font-semibold text-white">
                    {facultyProfile?.domain === "CSE"
                      ? "CSE • Global view"
                      : `${facultyProfile?.domain} domain`}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1.5 font-semibold text-ink-600 ring-1 ring-primary-100">
                    {data.summary.total_projects}{" "}
                    {data.summary.total_projects === 1
                      ? "project"
                      : "projects"}{" "}
                    in cohort
                  </span>
                  <span className="rounded-full bg-white px-3 py-1.5 font-semibold text-ink-600 ring-1 ring-primary-100">
                    Average health {Math.round(averageScore)}/100
                  </span>
                </div>
              )}
            </div>

            <div className="hidden lg:block">
              <Mascot pose="graduate" className="w-40" />
            </div>
          </div>
        </motion.section>

        {/* SUMMARY */}
        {data && (
          <motion.section variants={item} className="mt-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard
                label="Projects"
                sublabel="Total in cohort"
                value={data.summary.total_projects}
                icon={FolderKanban}
                tone="primary"
              />
              <StatCard
                label="On Track"
                sublabel="Healthy projects"
                value={data.summary.on_track}
                icon={CheckCircle2}
                tone="mint"
              />
              <StatCard
                label="Needs Attention"
                sublabel="Worth a check-in"
                value={data.summary.needs_attention}
                icon={HeartPulse}
                tone="amber"
              />
              <StatCard
                label="At Risk"
                sublabel="Needs intervention"
                value={data.summary.at_risk}
                icon={AlertTriangle}
                tone="coral"
              />
              <StatCard
                label="Insufficient Data"
                sublabel="Not enough signals"
                value={data.summary.insufficient_data}
                icon={HelpCircle}
                tone="sky"
              />
            </div>
          </motion.section>
        )}

        {/* HEALTH + ATTENTION */}
        {data && (
          <motion.section
            variants={item}
            className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.5fr]"
          >
            <Card className="overflow-hidden">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-500">
                    Cohort health
                  </p>
                  <h2 className="mt-1 font-display text-xl font-bold text-ink-900">
                    How things are going
                  </h2>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                  <BarChart3 size={18} />
                </div>
              </div>

              <div className="mt-6 flex items-end gap-4">
                <span className="font-display text-4xl font-bold text-ink-900">
                  {Math.round(averageScore)}
                </span>
                <span className="pb-1 text-sm text-ink-400">/ 100 average</span>
              </div>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-canvas-alt">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(0, Math.min(100, averageScore))}%` }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                  className="h-full rounded-full bg-gradient-to-r from-primary-400 via-amber-400 to-mint-500"
                />
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                <HealthMini
                  value={data.summary.on_track}
                  label="Healthy"
                  tone="mint"
                />
                <HealthMini
                  value={data.summary.needs_attention}
                  label="Attention"
                  tone="amber"
                />
                <HealthMini
                  value={data.summary.at_risk}
                  label="At risk"
                  tone="coral"
                />
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-coral-500">
                    Faculty attention
                  </p>
                  <h2 className="mt-1 font-display text-xl font-bold text-ink-900">
                    Projects that need you
                  </h2>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-coral-50 text-coral-500">
                  <AlertTriangle size={18} />
                </div>
              </div>

              {attentionProjects.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-mint-100 bg-mint-50/60 p-5">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="text-mint-500" size={20} />
                    <div>
                      <p className="text-sm font-semibold text-ink-800">
                        Nothing urgent right now.
                      </p>
                      <p className="mt-0.5 text-xs text-ink-400">
                        Your cohort currently has no projects flagged for
                        immediate attention.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-5 divide-y divide-primary-50">
                  {attentionProjects.map((project) => (
                    <AttentionRow
                      key={project.idea_id}
                      project={project}
                      onOpen={() => {
                        setTab(
                          project.status as (typeof TABS)[number]
                        );
                        setSearch(project.title);
                        window.scrollTo({ top: 900, behavior: "smooth" });
                      }}
                    />
                  ))}
                </div>
              )}
            </Card>
          </motion.section>
        )}

        {/* PROJECTS TOOLBAR */}
        <motion.section variants={item} className="mt-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-500">
                Project intelligence
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold text-ink-900">
                All student projects
              </h2>
              <p className="mt-1 text-sm text-ink-400">
                Review live health signals and generate a faculty-facing AI
                briefing for any project.
              </p>
            </div>

            <button
              type="button"
              onClick={() => mutate()}
              disabled={isLoading}
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-primary-100 bg-white px-4 text-xs font-bold text-ink-600 transition hover:border-primary-300 hover:text-primary-700 disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                className={cn(isLoading && "animate-spin")}
              />
              Refresh cohort
            </button>
          </div>

          <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn(
                    "rounded-full px-3.5 py-2 text-xs font-semibold transition",
                    tab === t
                      ? "bg-primary-600 text-white shadow-sm shadow-primary-200"
                      : "border border-primary-100 bg-white text-ink-500 hover:border-primary-300 hover:text-primary-700"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="relative w-full xl:w-72">
              <Search
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student or project..."
                className="h-10 w-full rounded-xl border border-primary-100 bg-white pl-10 pr-3 text-xs text-ink-800 outline-none transition focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
              />
            </div>
          </div>
        </motion.section>

        {/* ERROR */}
        {error ? (
          <motion.div variants={item} className="mt-6">
            <Card className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-coral-50 text-coral-500">
                <AlertTriangle size={22} />
              </div>
              <p className="mt-4 font-display font-semibold text-ink-900">
                Failed to load the faculty dashboard
              </p>
              <p className="mt-1 max-w-md text-sm text-ink-400">
                {error instanceof BackendError
                  ? error.message
                  : (error as { message?: string })?.message ?? "An unknown error occurred."}
              </p>
              <button
                type="button"
                onClick={() => mutate()}
                className="mt-5 rounded-xl bg-primary-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-primary-700"
              >
                Try again
              </button>
            </Card>
          </motion.div>
        ) : !data ? (
          <motion.div
            variants={item}
            className="mt-6 flex items-center justify-center py-24 text-sm text-ink-400"
          >
            <Loader />
            Loading cohort intelligence...
          </motion.div>
        ) : filtered.length === 0 ? (
          <motion.div variants={item} className="mt-6">
            <Card className="flex flex-col items-center text-center py-16">
              <Mascot pose="graduate" className="w-28" />
              <p className="mt-3 font-display font-semibold text-ink-900">
                {projects.length === 0
                  ? facultyProfile?.domain === "CSE"
                    ? "No projects submitted yet"
                    : `No projects found for your domain`
                  : "No projects match your filters"}
              </p>
              <p className="mt-1 max-w-sm text-sm text-ink-400">
                {projects.length === 0
                  ? facultyProfile?.domain === "CSE"
                    ? "Once students submit ideas, they'll appear here with live health signals."
                    : `No projects have been submitted in the ${facultyProfile?.domain} domain yet.`
                  : "Try another health filter or search term."}
              </p>
            </Card>
          </motion.div>
        ) : (
          <motion.section
            variants={item}
            className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
          >
            {filtered.map((project) => (
              <div key={project.idea_id} className="flex flex-col gap-3">
                <ProjectHealthCard
                  project={project}
                  digest={digestsByIdea[project.idea_id] ?? null}
                  isGenerating={generatingIds.has(project.idea_id)}
                  isLoadingDigest={loadingDigestIds.has(project.idea_id)}
                  isExpanded={expandedIds.has(project.idea_id)}
                  onToggleExpand={() => handleToggleExpand(project)}
                  onGenerateDigest={() => handleGenerateDigest(project)}
                />

                <div className="rounded-2xl border border-primary-100 bg-white p-3 shadow-sm">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                      <FileText size={14} />
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary-500">
                        Faculty Documents
                      </p>
                      <p className="text-[10px] text-ink-400">
                        Generate a fresh Word document from this project's live data
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <DocumentButton
                      label="Synopsis"
                      type="synopsis"
                      project={project}
                      generatingDocument={generatingDocument}
                      onGenerate={handleGenerateDocument}
                    />

                    <DocumentButton
                      label="Methodology"
                      type="methodology"
                      project={project}
                      generatingDocument={generatingDocument}
                      onGenerate={handleGenerateDocument}
                    />

                    <DocumentButton
                      label="Progress Report"
                      type="progress_report"
                      project={project}
                      generatingDocument={generatingDocument}
                      onGenerate={handleGenerateDocument}
                    />
                  </div>
                </div>
              </div>
            ))}
          </motion.section>
        )}

        {/* FOOTER INSIGHT */}
        {data && projects.length > 0 && (
          <motion.section variants={item} className="mt-7">
            <div className="rounded-[24px] border border-primary-100 bg-primary-50/50 p-5 md:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary-600 shadow-sm">
                    <TrendingUp size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-ink-900">
                      Faculty review principle
                    </p>
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-ink-500">
                      Use the health score as a quick signal, then open the
                      Mentor Summary to understand the strengths, concerns and
                      recommended next action before intervening.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] font-semibold text-ink-400">
                  <Clock3 size={13} />
                  Updated from live cohort data
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </motion.main>
    </>
  );
}

function Loader() {
  return <span className="mr-2 inline-flex"><RefreshCw size={17} className="animate-spin" /></span>;
}

function DocumentButton({
  label,
  type,
  project,
  generatingDocument,
  onGenerate,
}: {
  label: string;
  type: DocumentType;
  project: ProjectHealthIndicator;
  generatingDocument: string | null;
  onGenerate: (
    project: ProjectHealthIndicator,
    documentType: DocumentType
  ) => void;
}) {
  const key = `${project.idea_id}:${type}`;
  const isGenerating = generatingDocument === key;

  return (
    <button
      type="button"
      disabled={generatingDocument !== null}
      onClick={() => onGenerate(project, type)}
      className={cn(
        "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[10px] font-bold transition",
        isGenerating
          ? "cursor-wait border-primary-200 bg-primary-50 text-primary-600"
          : "border-primary-100 bg-white text-ink-600 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600",
        generatingDocument !== null && !isGenerating
          ? "cursor-not-allowed opacity-50"
          : ""
      )}
    >
      {isGenerating ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Download size={14} />
      )}

      {isGenerating ? "Generating..." : label}
    </button>
  );
}

function HealthMini({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: "mint" | "amber" | "coral";
}) {
  const styles = {
    mint: "bg-mint-50 text-mint-600",
    amber: "bg-amber-50 text-amber-600",
    coral: "bg-coral-50 text-coral-600",
  };

  return (
    <div className={cn("rounded-xl px-3 py-2.5", styles[tone])}>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] font-semibold">{label}</p>
    </div>
  );
}

function AttentionRow({
  project,
  onOpen,
}: {
  project: ProjectHealthIndicator;
  onOpen: () => void;
}) {
  const atRisk = project.status === "At Risk";

  return (
    <div className="flex items-center gap-3 py-3.5">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          atRisk
            ? "bg-coral-50 text-coral-500"
            : "bg-amber-50 text-amber-600"
        )}
      >
        {atRisk ? (
          <AlertTriangle size={16} />
        ) : (
          <HeartPulse size={16} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-ink-800">
          {project.title}
        </p>
        <p className="mt-0.5 truncate text-[10px] text-ink-400">
          {project.student_name}
          {project.domain ? ` • ${project.domain}` : ""}
        </p>
      </div>

      <div className="hidden text-right sm:block">
        <p className="text-xs font-bold text-ink-700">
          {project.health_score}/100
        </p>
        <p className="text-[9px] text-ink-400">
          {project.flags.length > 0
            ? project.flags[0]
            : project.status}
        </p>
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-primary-600 hover:bg-primary-50"
      >
        Review
      </button>
    </div>
  );
}