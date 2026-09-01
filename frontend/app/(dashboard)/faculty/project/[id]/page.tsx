"use client";

/**
 * Faculty project detail / progress tracking view.
 *
 * Audit note: the task's "projects" and "weekly_progress" tables map
 * to what actually exists in this schema -- project_ideas and
 * weekly_checkins (see supabase/migration.sql and
 * backend/milestone3_migration.sql). weekly_checkins had no RLS at
 * all before this change; it's now domain-scoped for faculty the same
 * way project_ideas already was (see the migration.sql diff alongside
 * this file) -- otherwise this page would either return nothing for
 * a real project (RLS too strict) or leak check-ins across domains
 * (no RLS at all, which was the actual prior state).
 *
 * Both queries run concurrently via Promise.all rather than in
 * sequence, and neither one is faked or backed by a mock array --
 * a project with zero check-ins yet just renders an honest empty
 * timeline instead of placeholder rows.
 */

import { use, useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { notify } from "@/lib/notify";
import {
  ArrowLeft,
  Ban,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FolderKanban,
  GraduationCap,
  Layers,
  Loader2,
  Lock,
  Mail,
  MessageSquarePlus,
  RefreshCw,
  Send,
  Target,
  TriangleAlert,
  User,
  Users as UsersIcon,
} from "lucide-react";

import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

// ---------- Types ----------

interface ProjectDetail {
  id: string;
  title: string;
  description: string;
  tech_stack: string | null;
  status: string;
  domain: string | null;
  objectives: string | null;
  difficulty: string | null;
  duration: string | null;
  team_size: number | null;
  created_at: string;
  student: {
    name: string;
    email: string;
    department: string | null;
    year_of_study: string | null;
    university: string | null;
  } | null;
}

interface WeeklyCheckin {
  id: string;
  week_number: number;
  status: string;
  planned_tasks: string | null;
  completed_tasks: string;
  blockers: string | null;
  student_notes: string | null;
  mentor_message: string | null;
  adjusted_plan: string | null;
  timeline_adjusted: boolean;
  created_at: string;
}

interface FeedbackRow {
  id: string;
  week_number: number;
  feedback_text: string;
  created_at: string;
  faculty: { name: string } | null;
}

// ---------- Concurrent Supabase fetch ----------

async function fetchProjectWithProgress(ideaId: string) {
  const [projectResult, progressResult] = await Promise.all([
    supabase
      .from("project_ideas")
      .select(
        "id, title, description, tech_stack, status, domain, objectives, difficulty, duration, team_size, created_at, student:student_id(name, email, department, year_of_study, university)"
      )
      .eq("id", ideaId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("weekly_checkins")
      .select(
        "id, week_number, status, planned_tasks, completed_tasks, blockers, student_notes, mentor_message, adjusted_plan, timeline_adjusted, created_at"
      )
      .eq("idea_id", ideaId)
      .order("week_number", { ascending: true }),
  ]);

  if (projectResult.error) throw projectResult.error;
  if (progressResult.error) throw progressResult.error;

  return {
    project: (projectResult.data as unknown as ProjectDetail) ?? null,
    checkins: (progressResult.data as unknown as WeeklyCheckin[]) ?? [],
  };
}

// ---------- Faculty feedback (closed loop) ----------
// The faculty half of the same faculty_feedback table the student
// progress page reads from. RLS (see supabase/migration.sql) already
// scopes both the SELECT and INSERT here to faculty whose domain
// covers this project's domain -- a bad-faith insert attempt for a
// project outside that scope is rejected by the database, not just
// hidden by the UI.

async function fetchFacultySelf(userId: string): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("faculty")
    .select("id")
    .eq("supabase_user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function fetchProjectFeedback(ideaId: string): Promise<FeedbackRow[]> {
  const { data, error } = await supabase
    .from("faculty_feedback")
    .select("id, week_number, feedback_text, created_at, faculty:faculty_id(name)")
    .eq("idea_id", ideaId)
    .order("week_number", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as FeedbackRow[];
}

function parseDurationWeeks(duration: string | null): number | null {
  if (!duration) return null;
  const weekMatch = duration.match(/(\d+)\s*week/i);
  if (weekMatch) return parseInt(weekMatch[1], 10);
  const monthMatch = duration.match(/(\d+)\s*month/i);
  if (monthMatch) return parseInt(monthMatch[1], 10) * 4;
  return null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const STATUS_META: Record<
  string,
  { label: string; badge: string; dot: string; icon: typeof CheckCircle2 }
> = {
  on_track: {
    label: "On Track",
    badge: "border-mint-500 bg-mint-100 text-mint-600",
    dot: "bg-mint-500",
    icon: CheckCircle2,
  },
  behind: {
    label: "Behind",
    badge: "border-amber-500 bg-amber-100 text-amber-600",
    dot: "bg-amber-500",
    icon: TriangleAlert,
  },
  blocked: {
    label: "Blocked",
    badge: "border-coral-500 bg-coral-100 text-coral-600",
    dot: "bg-coral-500",
    icon: Ban,
  },
};

export default function FacultyProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data, error, isLoading, mutate } = useSWR(["faculty-project-detail", id], () =>
    fetchProjectWithProgress(id)
  );

  const project = data?.project ?? null;
  const checkins = useMemo(() => data?.checkins ?? [], [data]);

  // CRITICAL: derived from the fetched array, not stored anywhere --
  // the highest week_number any check-in was submitted for.
  const currentWeek = useMemo(
    () => checkins.reduce((max, c) => Math.max(max, c.week_number), 0),
    [checkins]
  );

  const totalWeeks = useMemo(() => parseDurationWeeks(project?.duration ?? null), [project]);
  const completionPct =
    totalWeeks && totalWeeks > 0 ? Math.min(100, Math.round((currentWeek / totalWeeks) * 100)) : null;

  const latestStatus = checkins.length > 0 ? checkins[checkins.length - 1].status : null;

  const { user } = useAuth();
  const { data: facultySelf } = useSWR(user ? ["faculty-self", user.id] : null, () =>
    fetchFacultySelf(user!.id)
  );

  const {
    data: feedbackRows,
    mutate: mutateFeedback,
  } = useSWR(["project-feedback", id], () => fetchProjectFeedback(id));

  const feedbackByWeek = useMemo(() => {
    const map = new Map<number, FeedbackRow[]>();
    (feedbackRows ?? []).forEach((f) => {
      const arr = map.get(f.week_number) ?? [];
      arr.push(f);
      map.set(f.week_number, arr);
    });
    return map;
  }, [feedbackRows]);

  // Weeks a faculty member can reasonably leave feedback on: any week
  // the student has actually checked in for, defaulting to week 1 if
  // the project hasn't started yet.
  const availableWeeks = useMemo(() => {
    const weeks = checkins.length > 0 ? checkins.map((c) => c.week_number) : [1];
    return Array.from(new Set(weeks)).sort((a, b) => a - b);
  }, [checkins]);

  const [feedbackWeek, setFeedbackWeek] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const resolvedFeedbackWeek =
    feedbackWeek ?? availableWeeks[availableWeeks.length - 1] ?? 1;

  async function handleSubmitFeedback(e: React.FormEvent) {
    e.preventDefault();

    if (!feedbackText.trim()) {
      toast.error("Feedback can't be empty.");
      return;
    }
    if (!facultySelf) {
      toast.error("Only registered faculty accounts can leave feedback.");
      return;
    }

    setSubmittingFeedback(true);

    const { error: insertError } = await supabase.from("faculty_feedback").insert({
      faculty_id: facultySelf.id,
      idea_id: id,
      week_number: resolvedFeedbackWeek,
      feedback_text: feedbackText.trim(),
    });

    setSubmittingFeedback(false);

    if (insertError) {
      toast.error(insertError.message);
      return;
    }

    notify.success("Feedback sent to the student.");
    setFeedbackText("");
    mutateFeedback();
  }

  return (
    <>
      <Topbar
        title={project?.title ?? "Project Detail"}
        subtitle="Faculty Command Center"
      />
      <main className="px-6 md:px-10 pb-14">
        <Link
          href="/faculty"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-primary-600 transition-colors"
        >
          <ArrowLeft size={15} />
          Back to Command Center
        </Link>

        {isLoading && (
          <div className="mt-16 flex flex-col items-center justify-center gap-3 py-20 text-ink-400">
            <Loader2 size={26} className="animate-spin text-primary-500" />
            <p className="text-sm">Loading project...</p>
          </div>
        )}

        {!isLoading && (error || !project) && (
          <Card className="mt-10 flex flex-col items-center gap-3 py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-coral-50 text-coral-500">
              <Lock size={22} />
            </div>
            <p className="font-display font-semibold text-ink-900">
              {error ? "Couldn't load this project" : "Project not found"}
            </p>
            <p className="max-w-md text-sm text-ink-400">
              {error
                ? (error as { message?: string })?.message ?? "Something went wrong."
                : "This project doesn't exist, or it's outside the domain your faculty account can view."}
            </p>
            <button
              onClick={() => mutate()}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:underline"
            >
              <RefreshCw size={13} />
              Try again
            </button>
          </Card>
        )}

        {!isLoading && project && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="mt-6 flex flex-col gap-6"
          >
            {/* ---------- Header ---------- */}
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-display text-xl font-bold text-ink-900 truncate">
                      {project.title}
                    </h1>
                    <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-[11px] font-semibold text-primary-600">
                      {project.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-ink-500">{project.description}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {project.domain && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-canvas-alt px-2.5 py-1 text-[11px] font-medium text-ink-500">
                    <Layers size={11} /> {project.domain}
                  </span>
                )}
                {project.difficulty && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-canvas-alt px-2.5 py-1 text-[11px] font-medium text-ink-500">
                    <Target size={11} /> {project.difficulty}
                  </span>
                )}
                {project.duration && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-canvas-alt px-2.5 py-1 text-[11px] font-medium text-ink-500">
                    <Clock3 size={11} /> {project.duration}
                  </span>
                )}
                {project.team_size != null && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-canvas-alt px-2.5 py-1 text-[11px] font-medium text-ink-500">
                    <UsersIcon size={11} /> Team of {project.team_size}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full bg-canvas-alt px-2.5 py-1 text-[11px] font-medium text-ink-500">
                  <CalendarDays size={11} /> Submitted {formatDate(project.created_at)}
                </span>
              </div>

              {project.tech_stack && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {project.tech_stack.split(",").map((t) => (
                    <span
                      key={t}
                      className="rounded-lg bg-primary-50 px-2 py-1 text-[11px] font-semibold text-primary-700"
                    >
                      {t.trim()}
                    </span>
                  ))}
                </div>
              )}

              {project.objectives && (
                <div className="mt-4 rounded-xl bg-canvas-alt p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1">
                    Objectives
                  </p>
                  <p className="text-xs leading-relaxed text-ink-600">{project.objectives}</p>
                </div>
              )}
            </Card>

            <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
              {/* ---------- Student details ---------- */}
              <Card className="flex flex-col gap-4">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-400">
                  Student
                </p>
                {project.student ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-sm font-bold text-white">
                        {project.student.name
                          .split(" ")
                          .map((p) => p[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-display font-semibold text-ink-900 truncate">
                          {project.student.name}
                        </p>
                        <p className="flex items-center gap-1 text-xs text-ink-400 truncate">
                          <Mail size={11} /> {project.student.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 text-xs text-ink-500">
                      {project.student.department && (
                        <span className="flex items-center gap-1.5">
                          <Building2 size={13} className="text-ink-300" />
                          {project.student.department}
                        </span>
                      )}
                      {project.student.year_of_study && (
                        <span className="flex items-center gap-1.5">
                          <GraduationCap size={13} className="text-ink-300" />
                          {project.student.year_of_study}
                        </span>
                      )}
                      {project.student.university && (
                        <span className="flex items-center gap-1.5">
                          <User size={13} className="text-ink-300" />
                          {project.student.university}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-ink-400">Student profile unavailable.</p>
                )}
              </Card>

              {/* ---------- Progress overview ---------- */}
              <Card className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink-400">
                    Progress overview
                  </p>
                  {latestStatus && STATUS_META[latestStatus] && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                        STATUS_META[latestStatus].badge
                      )}
                    >
                      {STATUS_META[latestStatus].label}
                    </span>
                  )}
                </div>

                <div className="flex items-end gap-2">
                  <span className="font-display text-3xl font-bold text-ink-900">
                    {currentWeek > 0 ? `Week ${currentWeek}` : "Not started"}
                  </span>
                  {totalWeeks && (
                    <span className="mb-1 text-sm text-ink-400">of {totalWeeks} planned</span>
                  )}
                </div>

                {completionPct !== null ? (
                  <div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-canvas-alt">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${completionPct}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-700"
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-ink-400">{completionPct}% of timeline elapsed</p>
                  </div>
                ) : (
                  <p className="text-xs text-ink-400">
                    No estimated duration on file -- showing week progress only.
                  </p>
                )}

                <div className="mt-1 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl bg-canvas-alt py-2.5">
                    <p className="font-display text-lg font-bold text-ink-900">{checkins.length}</p>
                    <p className="text-[10px] text-ink-400">Check-ins</p>
                  </div>
                  <div className="rounded-xl bg-canvas-alt py-2.5">
                    <p className="font-display text-lg font-bold text-ink-900">
                      {checkins.filter((c) => c.status === "on_track").length}
                    </p>
                    <p className="text-[10px] text-ink-400">On track</p>
                  </div>
                  <div className="rounded-xl bg-canvas-alt py-2.5">
                    <p className="font-display text-lg font-bold text-ink-900">
                      {checkins.filter((c) => c.status === "blocked" || c.status === "behind").length}
                    </p>
                    <p className="text-[10px] text-ink-400">Flagged</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* ---------- Leave feedback ---------- */}
            <Card>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                  <MessageSquarePlus size={16} />
                </div>
                <p className="text-xs font-bold uppercase tracking-wider text-ink-400">
                  Leave feedback
                </p>
              </div>

              <form onSubmit={handleSubmitFeedback} className="mt-4 flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="feedback-week" className="text-xs font-semibold text-ink-600">
                    Week
                  </label>
                  <select
                    id="feedback-week"
                    value={resolvedFeedbackWeek}
                    onChange={(e) => setFeedbackWeek(Number(e.target.value))}
                    className="w-40 rounded-xl border border-primary-100 bg-surface px-3 py-2 text-sm text-ink-900 outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                  >
                    {availableWeeks.map((w) => (
                      <option key={w} value={w}>
                        Week {w}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="feedback-text" className="text-xs font-semibold text-ink-600">
                    Feedback
                  </label>
                  <textarea
                    id="feedback-text"
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    rows={3}
                    placeholder="Share guidance on this week's progress..."
                    className="w-full resize-none rounded-xl border border-primary-100 bg-surface px-3.5 py-2.5 text-sm text-ink-900 outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submittingFeedback}
                  className="self-end"
                >
                  <Send size={14} />
                  {submittingFeedback ? "Sending..." : "Send feedback"}
                </Button>
              </form>
            </Card>

            {/* ---------- Weekly progress timeline ---------- */}
            <Card>
              <p className="mb-5 text-xs font-bold uppercase tracking-wider text-ink-400">
                Weekly progress
              </p>

              {checkins.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-14 text-center">
                  <FolderKanban size={22} className="text-primary-300" />
                  <p className="text-sm text-ink-400">
                    No weekly updates submitted yet for this project.
                  </p>
                </div>
              ) : (
                <ol className="relative flex flex-col gap-6 pl-2">
                  <div
                    className="absolute left-[15px] top-2 bottom-2 w-px bg-primary-100"
                    aria-hidden
                  />
                  {checkins.map((c) => {
                    const meta = STATUS_META[c.status] ?? {
                      label: c.status,
                      badge: "border-ink-200 bg-canvas-alt text-ink-500",
                      dot: "bg-ink-300",
                      icon: CheckCircle2,
                    };
                    const Icon = meta.icon;

                    return (
                      <li key={c.id} className="relative pl-9">
                        <span
                          className={cn(
                            "absolute left-0 top-0.5 flex h-[30px] w-[30px] items-center justify-center rounded-full text-white ring-4 ring-surface",
                            meta.dot
                          )}
                        >
                          <Icon size={14} />
                        </span>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-display font-semibold text-ink-900">
                            Week {c.week_number}
                          </span>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "rounded-full border px-2.5 py-0.5 text-[10px] font-semibold",
                                meta.badge
                              )}
                            >
                              {meta.label}
                            </span>
                            <span className="text-[11px] text-ink-300">{formatDate(c.created_at)}</span>
                          </div>
                        </div>

                        <div className="mt-2 flex flex-col gap-2 text-xs leading-relaxed text-ink-600">
                          <p>
                            <span className="font-semibold text-ink-700">Completed: </span>
                            {c.completed_tasks}
                          </p>
                          {c.planned_tasks && (
                            <p>
                              <span className="font-semibold text-ink-700">Planned: </span>
                              {c.planned_tasks}
                            </p>
                          )}
                          {c.blockers && (
                            <p className="rounded-lg bg-coral-50 px-2.5 py-1.5 text-coral-600">
                              <span className="font-semibold">Blockers: </span>
                              {c.blockers}
                            </p>
                          )}
                          {c.student_notes && (
                            <p className="text-ink-500 italic">&quot;{c.student_notes}&quot;</p>
                          )}
                          {c.mentor_message && (
                            <div className="rounded-lg bg-primary-50/60 px-2.5 py-1.5">
                              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-600">
                                Mentor
                              </p>
                              <p className="text-ink-600">{c.mentor_message}</p>
                            </div>
                          )}
                          {c.timeline_adjusted && c.adjusted_plan && (
                            <div className="rounded-lg bg-amber-50 px-2.5 py-1.5">
                              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600">
                                Timeline adjusted
                              </p>
                              <p className="text-ink-600">{c.adjusted_plan}</p>
                            </div>
                          )}
                          {(feedbackByWeek.get(c.week_number) ?? []).map((f) => (
                            <div
                              key={f.id}
                              className="rounded-lg border border-primary-200 bg-primary-50 px-2.5 py-1.5"
                            >
                              <p className="mb-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary-700">
                                <MessageSquarePlus size={11} />
                                Your feedback{f.faculty?.name ? ` — ${f.faculty.name}` : ""}
                              </p>
                              <p className="text-ink-600">{f.feedback_text}</p>
                            </div>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Card>
          </motion.div>
        )}
      </main>
    </>
  );
}
