"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  Sparkles,
  CircleAlert,
  Brain,
  CalendarDays,
  Leaf,
  Map,
} from "lucide-react";

import { Topbar } from "@/components/layout/Topbar";
import { FloatingMascot } from "@/components/illustrations/FloatingMascot";
import { useAuth } from "@/context/AuthContext";

const journey = [
  {
    number: "01",
    title: "Foundation",
    description: "Profile, skills & project idea",
    status: "complete",
  },
  {
    number: "02",
    title: "Analysis",
    description: "Feasibility, scope & technology",
    status: "complete",
  },
  {
    number: "03",
    title: "Planning",
    description: "Timeline, milestones & risks",
    status: "current",
  },
  {
    number: "04",
    title: "Execution",
    description: "Build, test & improve",
    status: "locked",
  },
  {
    number: "05",
    title: "Delivery",
    description: "Documentation & viva",
    status: "locked",
  },
];

const health = [
  {
    label: "Feasibility",
    value: 92,
    tone: "bg-[#8fcfb0]",
  },
  {
    label: "Scope",
    value: 78,
    tone: "bg-[#a997e8]",
  },
  {
    label: "Technology",
    value: 88,
    tone: "bg-[#91c8e8]",
  },
  {
    label: "Timeline",
    value: 85,
    tone: "bg-[#f2c27e]",
  },
  {
    label: "Risk",
    value: 70,
    tone: "bg-[#eaa1a8]",
  },
];

const upcoming = [
  {
    title: "Literature Review",
    date: "Due in 2 days",
    urgent: true,
  },
  {
    title: "System Architecture",
    date: "Due in 5 days",
    urgent: false,
  },
  {
    title: "Implementation Plan",
    date: "Due in 9 days",
    urgent: false,
  },
];

export default function DashboardPage() {
  const { profile } = useAuth();

  const firstName = profile?.name?.split(" ")[0] ?? "there";

  return (
    <>
      <Topbar
        title={`Welcome back, ${firstName}! 👋`}
        subtitle="Let's continue your project journey."
      />

      <main className="px-6 md:px-10 pb-10">
        <div className="mx-auto max-w-[1500px] space-y-6">

          {/* ================================================= */}
          {/* PROJECT ORBIT */}
          {/* ================================================= */}

          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="relative overflow-hidden rounded-[30px] border border-primary-100 bg-surface"
          >
            {/* soft decorative blobs */}
            <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-primary-100 blur-3xl opacity-60" />
            <div className="absolute -left-24 -bottom-32 h-72 w-72 rounded-full bg-mint-100 blur-3xl opacity-60" />

            <div className="relative p-6 md:p-8">

              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="rounded-full bg-primary-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary-600">
                      Project Orbit
                    </span>

                    <span className="flex items-center gap-1.5 rounded-full bg-[#e8f8ef] px-3 py-1 text-[10px] font-semibold text-[#3e9670]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#59b98d]" />
                      On Track
                    </span>
                  </div>

                  <h2 className="font-display text-2xl md:text-3xl font-bold text-[#2c263d]">
                    Your project at a glance
                  </h2>

                  <p className="mt-1 text-sm text-[#91889f]">
                    A living view of your project health, journey and AI insights.
                  </p>
                </div>

                <Link
                  href="/projects"
                  className="group flex items-center gap-2 rounded-full border border-[#e4dcf2] bg-white px-4 py-2.5 text-xs font-semibold text-[#6d58b0] shadow-sm transition-all hover:border-[#cfc1ee] hover:shadow-md"
                >
                  Open Project
                  <ArrowRight
                    size={14}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </Link>
              </div>

              <div className="mt-8 grid lg:grid-cols-[250px_1fr] gap-8 items-center">

                {/* Orbit score */}
                <div className="flex justify-center">
                  <div className="relative flex h-[205px] w-[205px] items-center justify-center">

                    <div className="absolute inset-0 rounded-full border-[10px] border-[#f0ebf8]" />

                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background:
                          "conic-gradient(#8266d9 0deg 295deg, transparent 295deg 360deg)",
                        mask:
                          "radial-gradient(farthest-side, transparent calc(100% - 10px), #000 0)",
                        WebkitMask:
                          "radial-gradient(farthest-side, transparent calc(100% - 10px), #000 0)",
                      }}
                    />

                    <div className="relative flex h-[155px] w-[155px] flex-col items-center justify-center rounded-full bg-white shadow-[0_10px_40px_rgba(91,70,130,0.08)]">
                      <span className="font-display text-5xl font-bold text-[#514274]">
                        82
                      </span>

                      <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a29aae]">
                        Project Health
                      </span>

                      <span className="mt-2 text-[10px] text-[#65a783]">
                        â†‘ 12% this month
                      </span>
                    </div>
                  </div>
                </div>

                {/* Health matrix */}
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#a098ac]">
                        Health Matrix
                      </p>

                      <p className="mt-1 text-sm text-[#777086]">
                        Your AI mentor&apos;s latest project assessment.
                      </p>
                    </div>

                    <Brain size={20} className="text-[#9a87d5]" />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    {health.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-2xl border border-[#eee9f4] bg-white/80 p-3.5"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-[#6f667c]">
                            {item.label}
                          </span>

                          <span className="text-xs font-bold text-[#4f475e]">
                            {item.value}%
                          </span>
                        </div>

                        <div className="h-1.5 overflow-hidden rounded-full bg-[#f1edf5]">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${item.value}%` }}
                            transition={{
                              duration: 0.9,
                              delay: 0.2,
                            }}
                            className={`h-full rounded-full ${item.tone}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* ================================================= */}
          {/* JOURNEY + AI MENTOR */}
          {/* ================================================= */}

          <div className="grid xl:grid-cols-[1.45fr_0.85fr] gap-6">

            {/* Journey Map */}
            <motion.section
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08 }}
              className="rounded-[28px] border border-primary-100 bg-surface p-6 md:p-7"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <MapIcon />
                    <h3 className="font-display text-lg font-bold text-[#30293f]">
                      My Journey
                    </h3>
                  </div>

                  <p className="mt-1 text-xs text-[#948ba0]">
                    Five stages from idea to final delivery.
                  </p>
                </div>

                <Link
                  href="/progress"
                  className="text-xs font-semibold text-[#7359c4] hover:underline"
                >
                  View journey
                </Link>
              </div>

              <div className="mt-7">
                {journey.map((stage, index) => (
                  <div key={stage.number} className="relative flex gap-4">

                    {/* vertical line */}
                    {index !== journey.length - 1 && (
                      <div className="absolute left-[18px] top-10 h-[calc(100%-4px)] w-px bg-[#e7e0f0]" />
                    )}

                    <div
                      className={[
                        "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",
                        stage.status === "complete"
                          ? "border-[#bfe4d1] bg-[#eaf8f0] text-[#52a67c]"
                          : stage.status === "current"
                          ? "border-primary-200 bg-primary-100 text-primary-600"
                          : "border-primary-100 bg-surface-alt text-ink-300",
                      ].join(" ")}
                    >
                      {stage.status === "complete" ? (
                        <Check size={15} strokeWidth={2.5} />
                      ) : (
                        <span className="text-[10px] font-bold">
                          {stage.number}
                        </span>
                      )}
                    </div>

                    <div
                      className={[
                        "mb-5 flex-1 rounded-2xl border p-4 transition-all",
                        stage.status === "current"
                          ? "border-[#ded3f3] bg-[#faf7ff] shadow-sm"
                          : "border-[#f0ebf3] bg-white",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-[#51495d]">
                            {stage.title}
                          </p>

                          <p className="mt-0.5 text-[11px] text-[#9a92a4]">
                            {stage.description}
                          </p>
                        </div>

                        {stage.status === "current" && (
                          <span className="rounded-full bg-[#e9e1ff] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#7255c5]">
                            Current
                          </span>
                        )}

                        {stage.status === "complete" && (
                          <span className="text-[10px] font-semibold text-[#63a27f]">
                            Completed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.section>

            {/* AI Mentor Desk */}
            <motion.section
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.14 }}
              className="relative overflow-hidden rounded-[28px] border border-primary-100 bg-gradient-to-b from-primary-50 via-surface-alt to-surface p-6"
            >
              <div className="absolute -right-16 -top-20 h-44 w-44 rounded-full bg-[#e3d8ff] opacity-50 blur-3xl" />

              <div className="relative">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="rounded-full bg-white/80 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-[#8067c2]">
                      AI Mentor Desk
                    </span>

                    <h3 className="mt-3 font-display text-xl font-bold text-[#403653]">
                      Your mentor is here.
                    </h3>
                  </div>

                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm">
                    <Sparkles size={16} className="text-[#8b70d3]" />
                  </div>
                </div>

                <div className="mt-2 flex justify-center">
                  <FloatingMascot
                    pose="graduate"
                    className="w-36 md:w-40"
                  />
                </div>

                <div className="rounded-[20px] border border-white/80 bg-white/75 p-4 shadow-sm backdrop-blur">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#aaa0b3]">
                    Today&apos;s insight
                  </p>

                  <p className="mt-2 text-sm leading-relaxed text-[#62586d]">
                    Your project is moving well. Your next focus should be
                    completing the planning stage before starting execution.
                  </p>

                  <Link
                    href="/mentor"
                    className="mt-4 flex items-center justify-center gap-2 rounded-full bg-[#8063d5] px-4 py-2.5 text-xs font-bold text-white shadow-[0_8px_20px_rgba(128,99,213,0.25)] transition hover:bg-[#7153c7]"
                  >
                    Ask your mentor
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </motion.section>
          </div>

          {/* ================================================= */}
          {/* NOTEBOOK + GROWTH + UPCOMING */}
          {/* ================================================= */}

          <div className="grid lg:grid-cols-3 gap-6">

            {/* Project Orbit */}
            <Link
              href="/project-orbit"
              className="group rounded-[26px] border border-[#e6def5] bg-[#faf7ff] p-6 transition-all hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(91,70,130,0.09)]"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-100 text-primary-600">
                  <Brain size={20} />
                </div>

                <ChevronRight
                  size={17}
                  className="text-[#b0a1d2] transition-transform group-hover:translate-x-1"
                />
              </div>

              <p className="mt-5 text-[9px] font-bold uppercase tracking-[0.16em] text-[#8067c2]">
                AI Workspace
              </p>

              <h3 className="mt-1 font-display text-lg font-bold text-[#514274]">
                Project Orbit
              </h3>

              <p className="mt-2 text-xs leading-relaxed text-[#8f84a1]">
                Explore your project&apos;s health, AI analysis, skills and journey in one living workspace.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {["Health", "AI Insights", "Skills", "Journey"].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-white/80 px-2.5 py-1 text-[9px] font-semibold text-[#806da7]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Link>

            {/* Garden preview */}
            <Link
              href="/skills"
              className="group rounded-[26px] border border-[#dcebe2] bg-[#f4fbf7] p-6 transition-all hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(62,120,88,0.08)]"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e1f3e8] text-[#5a9c78]">
                  <Leaf size={20} />
                </div>

                <ChevronRight
                  size={17}
                  className="text-[#9ab9a6] transition-transform group-hover:translate-x-1"
                />
              </div>

              <p className="mt-5 text-[9px] font-bold uppercase tracking-[0.16em] text-[#77a18a]">
                Growth
              </p>

              <h3 className="mt-1 font-display text-lg font-bold text-[#476351]">
                Garden of Growth
              </h3>

              <div className="mt-5 space-y-3">
                <GrowthBar label="Project Progress" value={68} />
                <GrowthBar label="Skill Growth" value={80} />
              </div>

              <p className="mt-5 text-[11px] text-[#7e9a88]">
                ðŸŒ± Every milestone helps your project grow.
              </p>
            </Link>

            {/* Upcoming */}
            <div className="rounded-[26px] border border-[#e8e1ee] bg-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#aaa0b2]">
                    Coming Up
                  </p>

                  <h3 className="mt-1 font-display text-lg font-bold text-[#4c4455]">
                    Your next steps
                  </h3>
                </div>

                <CalendarDays size={19} className="text-[#9d91ad]" />
              </div>

              <div className="mt-5 space-y-2">
                {upcoming.map((item) => (
                  <div
                    key={item.title}
                    className="flex items-center gap-3 rounded-2xl border border-primary-100 bg-surface p-3"
                  >
                    <div
                      className={[
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                        item.urgent
                          ? "bg-[#fff0ef] text-[#db7e7e]"
                          : "bg-[#f0ecf8] text-[#8a78a5]",
                      ].join(" ")}
                    >
                      {item.urgent ? (
                        <CircleAlert size={15} />
                      ) : (
                        <Clock3 size={15} />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[#625969]">
                        {item.title}
                      </p>

                      <p
                        className={[
                          "mt-0.5 text-[10px]",
                          item.urgent
                            ? "text-[#d47c7c]"
                            : "text-[#a29aa9]",
                        ].join(" ")}
                      >
                        {item.date}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ================================================= */}
          {/* BOTTOM AI AGENT PREVIEW */}
          {/* ================================================= */}

          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.2 }}
            className="rounded-[28px] border border-[#e5def1] bg-gradient-to-r from-[#f6f1ff] via-[#fcf9ff] to-[#f2faf7] p-6 md:p-7"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">

              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#7b62c7] shadow-sm">
                    <Brain size={17} />
                  </div>

                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#8f82a8]">
                    AI Agent Network
                  </p>
                </div>

                <h3 className="mt-3 font-display text-xl font-bold text-[#40374e]">
                  10 AI agents are working behind your project.
                </h3>

                <p className="mt-1 text-xs text-[#92899c]">
                  Feasibility, scope, technology, milestones, risks, skills,
                  viva and more.
                </p>
              </div>

              <Link
                href="/projects"
                className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#7860ca] px-5 py-3 text-xs font-bold text-white shadow-[0_10px_25px_rgba(120,96,202,0.2)] transition hover:bg-[#694fb9]"
              >
                Explore AI Agents
                <ArrowRight
                  size={13}
                  className="transition-transform group-hover:translate-x-1"
                />
              </Link>
            </div>
          </motion.section>

        </div>
      </main>
    </>
  );
}

/* --------------------------------------------------------- */
/* Small reusable pieces                                    */
/* --------------------------------------------------------- */

function MapIcon() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eee9fb] text-[#7b64c3]">
      <Map size={17} />
    </div>
  );
}

function GrowthBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-[#789081]">
          {label}
        </span>

        <span className="text-[10px] font-bold text-[#62856f]">
          {value}%
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-[#dfeee5]">
        <div
          className="h-full rounded-full bg-[#83bd9a]"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}