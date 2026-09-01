"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { notify } from "@/lib/notify";
import {
  ArrowRight,
  Check,
  Code2,
  Clock3,
  FileText,
  Gauge,
  Layers,
  Lightbulb,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import type { Difficulty } from "@/lib/types";

const DIFFICULTIES: {
  value: Difficulty;
  label: string;
  description: string;
}[] = [
  {
    value: "Easy",
    label: "Easy",
    description: "A focused project with a smaller scope.",
  },
  {
    value: "Medium",
    label: "Medium",
    description: "A balanced project with moderate complexity.",
  },
  {
    value: "Hard",
    label: "Hard",
    description: "An ambitious project with deeper challenges.",
  },
];

const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  Easy: "border-mint-300 bg-mint-100 text-mint-600",
  Medium: "border-amber-300 bg-amber-100 text-amber-600",
  Hard: "border-coral-300 bg-coral-100 text-coral-600",
};

const STEPS = [
  {
    number: "01",
    title: "Describe",
    text: "Explain the problem and your idea.",
  },
  {
    number: "02",
    title: "Shape",
    text: "Add objectives, technology and scope.",
  },
  {
    number: "03",
    title: "Submit",
    text: "Send it to your project workspace.",
  },
];

export default function SubmitIdeaPage() {
  const { profile } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [techStack, setTechStack] = useState("");
  const [domain, setDomain] = useState("");
  const [objectives, setObjectives] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("Easy");
  const [duration, setDuration] = useState("");
  const [teamSize, setTeamSize] = useState("1");
  const [status, setStatus] = useState("Pending");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!profile) {
      toast.error("You need to be logged in to submit an idea.");
      return;
    }

    if (!title.trim() || !description.trim()) {
      toast.error("Please fill in the project title and description.");
      return;
    }

    const teamSizeNum = parseInt(teamSize, 10);

    if (!teamSizeNum || teamSizeNum < 1) {
      toast.error("Team size must be at least 1.");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from("project_ideas").insert({
      student_id: profile.id,
      title: title.trim(),
      description: description.trim(),
      tech_stack: techStack.trim() || null,
      domain: domain.trim() || null,
      objectives: objectives.trim() || null,
      difficulty,
      duration: duration.trim() || null,
      team_size: teamSizeNum,
      status,
    });

    setSubmitting(false);

    if (error) {
      toast.error("Couldn't submit your idea: " + error.message);
      return;
    }

    notify.success("Idea submitted successfully!");

    setTitle("");
    setDescription("");
    setTechStack("");
    setDomain("");
    setObjectives("");
    setDifficulty("Easy");
    setDuration("");
    setTeamSize("1");
    setStatus("Pending");

    router.push("/projects");
  }

  return (
    <main className="min-h-full bg-[#fffdfb]">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-primary-50 bg-gradient-to-br from-[#fffaf2] via-white to-[#f4fbf7]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary-100/50 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-mint-100/60 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-6 pb-10 pt-8 md:px-10 md:pb-12">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end"
          >
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-white/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary-600 shadow-sm">
                <Sparkles size={13} />
                Project creation
              </div>

              <h1 className="mt-5 max-w-2xl font-display text-3xl font-bold tracking-tight text-ink-900 md:text-4xl">
                Turn your idea into a project worth building.
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-400 md:text-base">
                Start with the problem you want to solve. Shape the idea with
                objectives, technology and scope, then send it into your
                project workspace.
              </p>
            </div>

            <div className="rounded-[26px] border border-primary-100 bg-white/80 p-5 shadow-sm backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-bold text-ink-800">
                <Lightbulb size={17} className="text-primary-500" />
                Your project journey starts here
              </div>

              <div className="mt-5 grid gap-3">
                {STEPS.map((step, index) => (
                  <div key={step.number} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-[10px] font-bold text-primary-600">
                      {step.number}
                    </div>

                    <div>
                      <p className="text-xs font-bold text-ink-800">
                        {step.title}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-5 text-ink-400">
                        {step.text}
                      </p>
                    </div>

                    {index < STEPS.length - 1 && (
                      <div className="ml-auto hidden h-8 w-px bg-primary-100 sm:block" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FORM */}
      <div className="mx-auto max-w-7xl px-6 py-8 md:px-10 md:py-10">
        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
          onSubmit={handleSubmit}
          className="grid gap-7 lg:grid-cols-[1.15fr_0.85fr]"
        >
          {/* LEFT */}
          <div className="flex flex-col gap-7">
            <Card className="overflow-hidden p-0">
              <div className="border-b border-primary-50 bg-gradient-to-r from-primary-50/70 to-white px-6 py-5 md:px-7">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
                    <Lightbulb size={19} />
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-500">
                      Step 01
                    </p>
                    <h2 className="font-display text-lg font-bold text-ink-900">
                      The core idea
                    </h2>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-6 p-6 md:p-7">
                <Input
                  id="title"
                  label="Project Title"
                  placeholder="E.g., AI-Powered Study Assistant"
                  icon={<Lightbulb size={16} />}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />

                <Textarea
                  id="description"
                  label="Project Description"
                  placeholder="Describe the problem, what your project will do, and who it is for..."
                  icon={<FileText size={16} />}
                  rows={7}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />

                <Textarea
                  id="objectives"
                  label="Project Objectives"
                  placeholder="What are the key goals this project should achieve?"
                  icon={<Target size={16} />}
                  rows={5}
                  value={objectives}
                  onChange={(e) => setObjectives(e.target.value)}
                />
              </div>
            </Card>

            <Card className="overflow-hidden p-0">
              <div className="border-b border-primary-50 bg-gradient-to-r from-[#f4fbf7] to-white px-6 py-5 md:px-7">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint-100 text-mint-600">
                    <Code2 size={19} />
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-mint-600">
                      Step 02
                    </p>
                    <h2 className="font-display text-lg font-bold text-ink-900">
                      Shape the project
                    </h2>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 p-6 md:grid-cols-2 md:p-7">
                <Input
                  id="domain"
                  label="Project Domain"
                  placeholder="E.g., Artificial Intelligence"
                  icon={<Layers size={16} />}
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                />

                <Input
                  id="tech-stack"
                  label="Proposed Tech Stack"
                  placeholder="E.g., Next.js, Python, Supabase"
                  icon={<Code2 size={16} />}
                  value={techStack}
                  onChange={(e) => setTechStack(e.target.value)}
                />
              </div>
            </Card>
          </div>

          {/* RIGHT */}
          <div className="flex flex-col gap-7">
            <Card className="overflow-hidden p-0">
              <div className="border-b border-primary-50 bg-gradient-to-r from-[#fff9ef] to-white px-6 py-5 md:px-7">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                    <Gauge size={19} />
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-600">
                      Project level
                    </p>
                    <h2 className="font-display text-lg font-bold text-ink-900">
                      How ambitious is it?
                    </h2>
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-7">
                <div className="grid gap-3">
                  {DIFFICULTIES.map((item) => {
                    const selected = difficulty === item.value;

                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setDifficulty(item.value)}
                        className={cn(
                          "group flex items-center gap-4 rounded-2xl border p-4 text-left transition-all",
                          selected
                            ? DIFFICULTY_STYLE[item.value] + " shadow-sm"
                            : "border-primary-100 bg-white text-ink-500 hover:border-primary-200 hover:bg-primary-50/40"
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                            selected ? "bg-white/80" : "bg-canvas-alt"
                          )}
                        >
                          {selected ? (
                            <Check size={17} strokeWidth={2.5} />
                          ) : (
                            <Gauge size={17} />
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="text-sm font-bold">{item.label}</p>
                          <p
                            className={cn(
                              "mt-0.5 text-[11px] leading-5",
                              selected ? "opacity-80" : "text-ink-400"
                            )}
                          >
                            {item.description}
                          </p>
                        </div>

                        <div
                          className={cn(
                            "ml-auto h-4 w-4 rounded-full border-2",
                            selected
                              ? "border-current bg-current"
                              : "border-primary-200"
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden p-0">
              <div className="border-b border-primary-50 px-6 py-5 md:px-7">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                    <Clock3 size={19} />
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-600">
                      Project logistics
                    </p>
                    <h2 className="font-display text-lg font-bold text-ink-900">
                      Set the boundaries
                    </h2>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 p-6 md:p-7">
                <Input
                  id="duration"
                  label="Estimated Duration"
                  placeholder="E.g., 1 Month, 6 Weeks"
                  icon={<Clock3 size={16} />}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />

                <Input
                  id="team-size"
                  type="number"
                  min={1}
                  label="Team Size"
                  placeholder="1"
                  icon={<Users size={16} />}
                  value={teamSize}
                  onChange={(e) => setTeamSize(e.target.value)}
                />

                <div>
                  <label
                    htmlFor="status"
                    className="mb-1.5 block text-sm font-medium text-ink-700"
                  >
                    Initial Status
                  </label>

                  <select
                    id="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-xl border border-primary-100 bg-surface px-3.5 py-2.5 text-sm text-ink-900 outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Submitted">Submitted</option>
                    <option value="Under Review">Under Review</option>
                  </select>

                  <p className="mt-1.5 text-xs leading-5 text-ink-300">
                    New projects normally start as Pending until they are
                    reviewed.
                  </p>
                </div>
              </div>
            </Card>

            {/* SUBMIT CARD */}
            <div className="rounded-[28px] border border-primary-100 bg-gradient-to-br from-primary-50 via-white to-mint-100/60 p-6 shadow-sm md:p-7">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary-600 shadow-sm">
                  <Sparkles size={18} />
                </div>

                <div>
                  <h3 className="font-display text-base font-bold text-ink-900">
                    Ready to plant the idea?
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-ink-400">
                    Your project will appear in Projects after submission,
                    ready for your AI mentor and project workspace.
                  </p>
                </div>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="mt-6 w-full justify-center"
              >
                {submitting ? "Creating Project..." : "Create Project"}
                {!submitting && <ArrowRight size={15} />}
              </Button>
            </div>
          </div>
        </motion.form>
      </div>
    </main>
  );
}