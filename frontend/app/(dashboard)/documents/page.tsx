"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { notify } from "@/lib/notify";
import {
  Archive,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  FileText,
  FolderOpen,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";

import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/context/AuthContext";
import {
  downloadDocument,
  DOCUMENT_TYPE_LABELS,
  type DocumentType,
} from "@/lib/mentorClient";
import { supabase } from "@/lib/supabaseClient";
import type { ProjectIdea } from "@/lib/types";

const DOCUMENT_TYPES: {
  type: DocumentType;
  description: string;
  icon: typeof FileText;
  tone: string;
  badge: string;
}[] = [
  {
    type: "synopsis",
    description:
      "A formal overview of the project, including its problem, objectives and proposed solution.",
    icon: BookOpen,
    tone: "bg-primary-50 text-primary-600",
    badge: "bg-primary-50 text-primary-600",
  },
  {
    type: "methodology",
    description:
      "A structured description of the methodology and implementation approach for the project.",
    icon: FileText,
    tone: "bg-sky-50 text-sky-600",
    badge: "bg-sky-50 text-sky-600",
  },
  {
    type: "progress_report",
    description:
      "A current progress report based on the project's check-ins and available AI analysis.",
    icon: Archive,
    tone: "bg-mint-100 text-mint-600",
    badge: "bg-mint-100 text-mint-600",
  },
];

export default function DocumentsPage() {
  const { profile } = useAuth();

  const [projects, setProjects] = useState<ProjectIdea[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadProjects() {
      if (!profile) {
        if (mounted) {
          setProjects([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from("project_ideas")
        .select("*")
        .eq("student_id", profile.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (!mounted) return;

      if (error) {
        toast.error("Couldn't load your projects.");
        setProjects([]);
      } else {
        setProjects((data ?? []) as ProjectIdea[]);
      }

      setLoading(false);
    }

    loadProjects();

    return () => {
      mounted = false;
    };
  }, [profile]);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesProject =
        selectedProjectId === "all" || project.id === selectedProjectId;

      if (!matchesProject) return false;
      if (!query) return true;

      return (
        project.title.toLowerCase().includes(query) ||
        (project.domain ?? "").toLowerCase().includes(query) ||
        (project.description ?? "").toLowerCase().includes(query)
      );
    });
  }, [projects, selectedProjectId, search]);

  async function handleDownload(
    project: ProjectIdea,
    documentType: DocumentType
  ) {
    const key = `${project.id}:${documentType}`;

    if (generating) return;

    setGenerating(key);

    try {
      await downloadDocument(project.id, documentType);
      notify.success(`${DOCUMENT_TYPE_LABELS[documentType]} downloaded!`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't generate that document. Please try again."
      );
    } finally {
      setGenerating(null);
    }
  }

  const totalDocuments = projects.length * DOCUMENT_TYPES.length;

  return (
    <>
      <Topbar
        title="Documents"
        subtitle="Your project documents, always ready to regenerate"
      />

      <main className="px-6 md:px-10 pb-10">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-[30px] border border-primary-100 bg-gradient-to-br from-[#fffaf1] via-white to-[#f3fbf6] p-7 md:p-9">
          <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-primary-100/50 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-mint-100/70 blur-3xl" />

          <div className="relative grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-white/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary-600">
                <Sparkles size={13} />
                Document library
              </div>

              <h1 className="mt-4 max-w-2xl font-display text-3xl font-bold tracking-tight text-ink-900 md:text-4xl">
                Keep your project work within reach.
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-400 md:text-base">
                Generate your official Word documents whenever you need them.
                They are rebuilt from your latest project information, so a
                lost or deleted download on your laptop never means losing the
                document itself.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <Stat
                value={String(projects.length)}
                label="Projects"
                icon={<FolderOpen size={15} />}
              />
              <Stat
                value={String(totalDocuments)}
                label="Available documents"
                icon={<FileText size={15} />}
              />
              <Stat
                value="DOCX"
                label="Word format"
                icon={<Download size={15} />}
              />
            </div>
          </div>
        </section>

        {/* TOOLBAR */}
        <section className="mt-7">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search
                size={17}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-300"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects or documents..."
                className="h-12 w-full rounded-2xl border border-primary-100 bg-white pl-11 pr-4 text-sm text-ink-800 outline-none transition focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
              />
            </div>

            <div className="relative md:w-72">
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="h-12 w-full appearance-none rounded-2xl border border-primary-100 bg-white px-4 pr-10 text-sm font-medium text-ink-700 outline-none transition focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
              >
                <option value="all">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>

              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-300"
              />
            </div>
          </div>
        </section>

        {/* DOCUMENTS */}
        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-500">
                Your library
              </p>
              <h2 className="mt-1 font-display text-xl font-bold text-ink-900">
                Project documents
              </h2>
            </div>

            <p className="text-xs text-ink-400">
              {filteredProjects.length}{" "}
              {filteredProjects.length === 1 ? "project" : "projects"}
            </p>
          </div>

          {loading ? (
            <Card className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-2 text-sm text-ink-400">
                <Loader2 size={17} className="animate-spin" />
                Loading your project documents...
              </div>
            </Card>
          ) : !profile ? (
            <EmptyState
              icon={<FolderOpen size={24} />}
              title="Sign in to view your documents"
              text="Your project documents will appear here once you are signed in."
            />
          ) : projects.length === 0 ? (
            <EmptyState
              icon={<FileText size={24} />}
              title="No project documents yet"
              text="Create a project first. Once you have a project, its Synopsis, Methodology and Progress Report will appear here."
            />
          ) : filteredProjects.length === 0 ? (
            <EmptyState
              icon={<Search size={24} />}
              title="No matching projects"
              text="Try a different search term or choose another project from the filter."
            />
          ) : (
            <div className="grid gap-6">
              {filteredProjects.map((project) => (
                <ProjectDocumentCard
                  key={project.id}
                  project={project}
                  generating={generating}
                  onDownload={handleDownload}
                />
              ))}
            </div>
          )}
        </section>

        {/* INFO */}
        <section className="mt-7 grid gap-4 md:grid-cols-3">
          <InfoCard
            icon={<Clock3 size={17} />}
            title="Always current"
            text="Documents are generated from your latest available project data."
          />
          <InfoCard
            icon={<Download size={17} />}
            title="Word compatible"
            text="Every download is a .docx file that opens normally in Microsoft Word."
          />
          <InfoCard
            icon={<CheckCircle2 size={17} />}
            title="Easy recovery"
            text="If a downloaded file is lost, return here and generate it again."
          />
        </section>
      </main>
    </>
  );
}

function ProjectDocumentCard({
  project,
  generating,
  onDownload,
}: {
  project: ProjectIdea;
  generating: string | null;
  onDownload: (project: ProjectIdea, type: DocumentType) => void;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-primary-50 bg-gradient-to-r from-white to-primary-50/30 px-6 py-5 md:px-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
                <FolderOpen size={17} />
              </span>

              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary-500">
                  Project
                </p>
                <h3 className="truncate font-display text-lg font-bold text-ink-900">
                  {project.title}
                </h3>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-ink-400">
              {project.domain && (
                <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-primary-100">
                  {project.domain}
                </span>
              )}

              {project.difficulty && (
                <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-primary-100">
                  {project.difficulty}
                </span>
              )}

              <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-primary-100">
                {project.status}
              </span>
            </div>
          </div>

          <div className="shrink-0 rounded-2xl border border-primary-100 bg-white px-4 py-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-ink-300">
              Format
            </p>
            <p className="mt-1 text-sm font-bold text-ink-700">Microsoft Word</p>
            <p className="text-[10px] text-ink-400">.docx</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-5 md:grid-cols-3 md:p-6">
        {DOCUMENT_TYPES.map((document) => {
          const Icon = document.icon;
          const key = `${project.id}:${document.type}`;
          const isGenerating = generating === key;

          return (
            <div
              key={document.type}
              className="group rounded-2xl border border-primary-100 bg-white p-4 transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${document.tone}`}
                >
                  <Icon size={18} />
                </div>

                <span
                  className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${document.badge}`}
                >
                  DOCX
                </span>
              </div>

              <h4 className="mt-4 text-sm font-bold text-ink-900">
                {DOCUMENT_TYPE_LABELS[document.type]}
              </h4>

              <p className="mt-1.5 min-h-[58px] text-[11px] leading-5 text-ink-400">
                {document.description}
              </p>

              <button
                type="button"
                onClick={() => onDownload(project, document.type)}
                disabled={generating !== null}
                className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-3 text-xs font-bold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    Generate & Download
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Stat({
  value,
  label,
  icon,
}: {
  value: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-primary-100 bg-white/85 px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-primary-500">
        {icon}
        <span className="text-[9px] font-bold uppercase tracking-wider text-ink-300">
          {label}
        </span>
      </div>
      <p className="mt-1 text-xl font-bold text-ink-900">{value}</p>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-primary-100 bg-white p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
        {icon}
      </div>
      <h3 className="mt-3 text-sm font-bold text-ink-900">{title}</h3>
      <p className="mt-1.5 text-xs leading-5 text-ink-400">{text}</p>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-[26px] border border-dashed border-primary-200 bg-white px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-500">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-base font-bold text-ink-900">
        {title}
      </h3>
      <p className="mt-1.5 max-w-md text-xs leading-5 text-ink-400">{text}</p>
    </div>
  );
}