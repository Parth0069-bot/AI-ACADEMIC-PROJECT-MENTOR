"use client";

import useSWR from "swr";
import { FolderKanban } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import type { ProjectIdea } from "@/lib/types";

interface IdeaPickerProps {
  selectedId: string | null;
  onSelect: (ideaId: string) => void;
}

export function IdeaPicker({ selectedId, onSelect }: IdeaPickerProps) {
  const { profile } = useAuth();

  const { data: ideas, error } = useSWR(profile ? `idea-picker:${profile.id}` : null, async () => {
    const { data, error } = await supabase
      .from("project_ideas")
      .select("*")
      .eq("student_id", profile!.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as ProjectIdea[];
  });

  if (error) {
    return <p className="text-sm text-coral-500">Couldn&apos;t load your projects.</p>;
  }

  if (!ideas) {
    return <p className="text-sm text-ink-400">Loading your projects...</p>;
  }

  if (ideas.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-400">
        <FolderKanban size={16} />
        You don&apos;t have any projects yet -- submit an idea first.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {ideas.map((idea) => (
        <button
          key={idea.id}
          type="button"
          onClick={() => onSelect(idea.id)}
          className={cn(
            "text-xs font-semibold px-3.5 py-2 rounded-full border transition-colors",
            selectedId === idea.id
              ? "bg-primary-600 text-white border-primary-600"
              : "bg-white text-ink-500 border-primary-100 hover:bg-primary-50"
          )}
        >
          {idea.title}
        </button>
      ))}
    </div>
  );
}
