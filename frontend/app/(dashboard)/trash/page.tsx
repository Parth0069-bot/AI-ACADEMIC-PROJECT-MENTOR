"use client";

import useSWR from "swr";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { notify } from "@/lib/notify";
import {
  Loader2,
  Trash2,
  RotateCcw,
  Layers,
  Gauge,
  Clock,
  Users,
} from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { restoreIdea, hardDeleteIdea } from "@/lib/backendClient";
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

function statusMeta(status: string) {
  return STATUS_META[status] ?? { label: status || "Pending", className: "bg-canvas-alt text-ink-500" };
}

export default function TrashPage() {
  const { profile } = useAuth();

  const { data: ideas, error: ideasError, mutate: mutateIdeas } = useSWR(
    profile ? `trash:${profile.id}` : null,
    async () => {
      const { data, error } = await supabase
        .from("project_ideas")
        .select("*")
        .eq("student_id", profile!.id)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return data as ProjectIdea[];
    }
  );

  const handleRestoreIdea = async (ideaId: string) => {
    // Optimistic restore for snappy UI
    if (ideas) mutateIdeas(ideas.filter((i) => i.id !== ideaId), false);
    
    try {
      await restoreIdea(ideaId);
      notify.success("Project restored successfully");
      mutateIdeas();
    } catch (error: any) {
      toast.error(error.message || "Failed to restore project");
      mutateIdeas(); // revert optimistic restore
    }
  };

  const handleHardDeleteIdea = async (ideaId: string) => {
    if (!window.confirm("Are you sure you want to PERMANENTLY delete this project? This cannot be undone.")) {
      return;
    }
    
    // Optimistic hard delete
    if (ideas) mutateIdeas(ideas.filter((i) => i.id !== ideaId), false);
    
    try {
      await hardDeleteIdea(ideaId);
      notify.success("Project permanently deleted");
      mutateIdeas();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete project permanently");
      mutateIdeas(); // revert optimistic hard delete
    }
  };

  return (
    <>
      <Topbar title="Trash" subtitle="Recover or permanently delete projects" />

      <div className="px-6 md:px-10 pb-10 mt-6">
        {ideasError ? (
          <div className="flex flex-col items-center justify-center py-24 text-coral-500 gap-3">
            <div className="p-3 bg-coral-50 rounded-full">
              <span className="font-bold text-lg">!</span>
            </div>
            <p className="font-semibold text-ink-900">Failed to load trash</p>
            <p className="text-sm max-w-md text-center">
              {ideasError.message || "An unknown error occurred. If you recently updated the app, make sure you ran the SQL command to add the deleted_at column in Supabase."}
            </p>
          </div>
        ) : !ideas ? (
          <div className="flex items-center justify-center py-24 text-ink-400 gap-2">
            <Loader2 size={18} className="animate-spin" /> Loading trash...
          </div>
        ) : ideas.length === 0 ? (
          <Card className="flex flex-col items-center text-center py-16">
            <div className="h-12 w-12 rounded-full bg-primary-50 flex items-center justify-center text-primary-500 mb-3">
              <Trash2 size={22} />
            </div>
            <p className="font-display font-semibold text-ink-900">Trash is empty</p>
            <p className="text-sm text-ink-400 mt-1 mb-4">
              Deleted projects will appear here for 30 days before being permanently removed.
            </p>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ideas.map((idea, i) => {
              const status = statusMeta(idea.status);

              return (
                <motion.div
                  key={idea.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="h-full flex flex-col hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-display font-semibold text-ink-900 leading-snug">
                        {idea.title}
                      </h3>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={cn(
                            "text-[10px] font-semibold px-2 py-1 rounded-full",
                            status.className
                          )}
                        >
                          {status.label}
                        </span>
                      </div>
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
                        <span className="flex items-center gap-1 text-[10px] font-medium text-ink-500">
                          <Clock size={10} /> {idea.duration}
                        </span>
                      )}
                      {idea.team_size && (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-ink-500">
                          <Users size={10} /> {idea.team_size}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-primary-50">
                      <button
                        onClick={() => handleRestoreIdea(idea.id)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg text-primary-600 hover:bg-primary-50 transition-colors border border-primary-100"
                      >
                        <RotateCcw size={14} /> Restore
                      </button>
                      <button
                        onClick={() => handleHardDeleteIdea(idea.id)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg text-coral-600 hover:bg-coral-50 transition-colors border border-coral-100"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
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
