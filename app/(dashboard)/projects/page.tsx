"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, Loader2, Clock, FolderKanban, Gauge, Users, Layers } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import type { ProjectIdea, Difficulty } from "@/lib/types";

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-sky-100 text-sky-500" },
  Pending: { label: "Pending", className: "bg-sky-100 text-sky-500" },
  submitted: { label: "Submitted", className: "bg-sky-100 text-sky-500" },
  Submitted: { label: "Submitted", className: "bg-sky-100 text-sky-500" },
  under_review: { label: "Under Review", className: "bg-amber-100 text-amber-500" },
  "Under Review": { label: "Under Review", className: "bg-amber-100 text-amber-500" },
  approved: { label: "Approved", className: "bg-mint-100 text-mint-500" },
  Approved: { label: "Approved", className: "bg-mint-100 text-mint-500" },
};

const DIFFICULTY_META: Record<Difficulty, string> = {
  Easy: "bg-mint-100 text-mint-500",
  Medium: "bg-amber-100 text-amber-500",
  Hard: "bg-coral-100 text-coral-500",
};

const TABS = ["All", "Pending", "Submitted", "Under Review", "Approved"] as const;

function statusMeta(status: string) {
  return STATUS_META[status] ?? { label: status || "Pending", className: "bg-canvas-alt text-ink-500" };
}

export default function ProjectsPage() {
  const { profile } = useAuth();
  const [ideas, setIdeas] = useState<ProjectIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");

  const loadIdeas = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("project_ideas")
      .select("*")
      .eq("student_id", profile.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load projects:", error.message);
    }
    if (!error && data) setIdeas(data as ProjectIdea[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    loadIdeas();
  }, [loadIdeas]);

  const filtered = ideas.filter((idea) => {
    if (tab === "All") return true;
    const label = statusMeta(idea.status).label;
    return label === tab;
  });

  return (
    <>
      <Topbar title="My Projects" subtitle="Track and manage your submitted ideas" />

      <div className="px-6 md:px-10 pb-10">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-full px-4 py-2 text-xs font-semibold transition-colors",
                  tab === t
                    ? "bg-primary-600 text-white"
                    : "bg-white border border-primary-100 text-ink-500 hover:bg-primary-50"
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <Link href="/submit-idea">
            <Button>
              <Plus size={15} /> New Project
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-ink-400 gap-2">
            <Loader2 size={18} className="animate-spin" /> Loading your projects...
          </div>
        ) : filtered.length === 0 ? (
          <Card className="flex flex-col items-center text-center py-16">
            <div className="h-12 w-12 rounded-full bg-primary-50 flex items-center justify-center text-primary-500 mb-3">
              <FolderKanban size={22} />
            </div>
            <p className="font-display font-semibold text-ink-900">No projects yet</p>
            <p className="text-sm text-ink-400 mt-1 mb-4">
              Submit your first idea and it&apos;ll show up here.
            </p>
            <Link href="/submit-idea">
              <Button>
                <Plus size={15} /> Submit an Idea
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((idea, i) => {
              const status = statusMeta(idea.status);
              return (
                <motion.div
                  key={idea.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="h-full flex flex-col hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-display font-semibold text-ink-900 leading-snug">
                        {idea.title}
                      </h3>
                      <span
                        className={cn(
                          "text-[10px] font-semibold px-2 py-1 rounded-full shrink-0",
                          status.className
                        )}
                      >
                        {status.label}
                      </span>
                    </div>

                    {idea.domain && (
                      <div className="flex items-center gap-1.5 text-[11px] text-primary-600 font-medium mb-2">
                        <Layers size={12} /> {idea.domain}
                      </div>
                    )}

                    <p className="text-sm text-ink-500 line-clamp-3 flex-1">
                      {idea.description}
                    </p>

                    {idea.tech_stack && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {idea.tech_stack.split(",").map((t) => (
                          <span
                            key={t}
                            className="text-[11px] bg-canvas-alt text-ink-500 px-2 py-1 rounded-full"
                          >
                            {t.trim()}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                      {idea.difficulty && (
                        <span
                          className={cn(
                            "flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full",
                            DIFFICULTY_META[idea.difficulty]
                          )}
                        >
                          <Gauge size={10} /> {idea.difficulty}
                        </span>
                      )}
                      {idea.duration && (
                        <span className="flex items-center gap-1 text-[10px] text-ink-400">
                          <Clock size={10} /> {idea.duration}
                        </span>
                      )}
                      {idea.team_size && (
                        <span className="flex items-center gap-1 text-[10px] text-ink-400">
                          <Users size={10} /> {idea.team_size}{" "}
                          {idea.team_size === 1 ? "member" : "members"}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-ink-300 mt-4 pt-3 border-t border-primary-50">
                      <Clock size={11} />
                      {new Date(idea.created_at).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
