"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Bot,
  Brain,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Target,
  Trophy,
  Volume2,
  XCircle,
  Zap,
} from "lucide-react";

import { Topbar } from "@/components/layout/Topbar";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import type { ProjectIdea } from "@/lib/types";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type Difficulty = "Basic" | "Intermediate" | "Advanced";

type VivaQuestion = {
  id: number;
  question: string;
  difficulty: Difficulty;
};

type VivaEvaluation = {
  question_id: number;
  question: string;
  answer: string;
  score: number;
  evaluation: string;
  expected_answer: string;
  strengths: string[];
  areas_to_improve: string[];
};

type VivaFinalResult = {
  idea_id: string;
  difficulty: Difficulty;
  total_questions: number;
  average_score: number;
  overall_feedback: string;
  strong_areas: string[];
  areas_to_work_on: string[];
  final_suggestion: string;
};

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionEventLike = {
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((event: SpeechRecognitionEventLike) => void)
    | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const DIFFICULTIES: {
  value: Difficulty;
  title: string;
  description: string;
  icon: typeof Brain;
}[] = [
  {
    value: "Basic",
    title: "Basic",
    description:
      "Fundamentals, project understanding and simple explanations.",
    icon: BookOpen,
  },
  {
    value: "Intermediate",
    title: "Intermediate",
    description:
      "Reasoning, implementation decisions, trade-offs and problem solving.",
    icon: Brain,
  },
  {
    value: "Advanced",
    title: "Advanced",
    description:
      "Architecture, limitations, alternatives, scalability and deeper defense.",
    icon: Zap,
  },
];

const QUESTION_COUNTS = [5, 10, 15, 20];

function getDifficultyStyles(
  difficulty: Difficulty,
  selected: boolean
) {
  if (!selected) {
    return "border-primary-100 bg-white hover:border-primary-300 hover:bg-primary-50/40";
  }

  if (difficulty === "Basic") {
    return "border-emerald-300 bg-emerald-50 ring-2 ring-emerald-100";
  }

  if (difficulty === "Intermediate") {
    return "border-amber-300 bg-amber-50 ring-2 ring-amber-100";
  }

  return "border-violet-300 bg-violet-50 ring-2 ring-violet-100";
}

function getScoreMessage(score: number) {
  if (score >= 9) {
    return {
      title: "Excellent defense! 🎉",
      description:
        "You demonstrated strong understanding of your project.",
    };
  }

  if (score >= 7) {
    return {
      title: "Good performance! 👏",
      description:
        "You have a solid foundation, but there are a few areas to strengthen.",
    };
  }

  if (score >= 5) {
    return {
      title: "Keep practicing! 💪",
      description:
        "Your project understanding is developing. Focus on the suggested improvement areas.",
    };
  }

  return {
    title: "More preparation needed",
    description:
      "Use the suggestions below to strengthen your project defense.",
  };
}

export default function VivaStudioPage() {
  const { profile, loading: authLoading } = useAuth();

  const [projects, setProjects] = useState<ProjectIdea[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const [selectedProjectId, setSelectedProjectId] =
    useState<string>("");

  const [difficulty, setDifficulty] =
    useState<Difficulty>("Intermediate");

  const [questionCount, setQuestionCount] = useState(5);

  const [questions, setQuestions] = useState<VivaQuestion[]>(
    []
  );

  const [evaluations, setEvaluations] = useState<
    VivaEvaluation[]
  >([]);

  const [currentQuestionIndex, setCurrentQuestionIndex] =
    useState(0);

  const [answer, setAnswer] = useState("");

  const [loadingViva, setLoadingViva] = useState(false);
  const [evaluating, setEvaluating] = useState(false);

  const [countdown, setCountdown] = useState(0);

  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] =
    useState(false);

  const [error, setError] = useState("");

  const [finalResult, setFinalResult] =
    useState<VivaFinalResult | null>(null);

  const recognitionRef =
    useRef<SpeechRecognitionInstance | null>(null);

  const listeningRef = useRef(false);

  const selectedProject = useMemo(
    () =>
      projects.find(
        (project) => project.id === selectedProjectId
      ) || null,
    [projects, selectedProjectId]
  );

  const currentQuestion =
    questions[currentQuestionIndex] || null;

  const isSetup = questions.length === 0 && !finalResult;

  const progress =
    questions.length > 0
      ? ((currentQuestionIndex + 1) / questions.length) * 100
      : 0;

  /*
   * ---------------------------------------------------------
   * PROJECT LOADING
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    setSpeechSupported(Boolean(SpeechRecognition));
  }, []);

  useEffect(() => {
    async function loadProjects() {
      if (!profile?.id) {
        setLoadingProjects(false);
        return;
      }

      setLoadingProjects(true);
      setError("");

      const { data, error: projectError } = await supabase
        .from("project_ideas")
        .select("*")
        .eq("student_id", profile.id)
        .is("deleted_at", null)
        .order("created_at", {
          ascending: false,
        });

      if (projectError) {
        console.error(projectError);
        setError(
          "Could not load your projects. Please refresh and try again."
        );
        setProjects([]);
      } else {
        const realProjects =
          (data ?? []) as ProjectIdea[];

        setProjects(realProjects);

        if (
          realProjects.length > 0 &&
          !selectedProjectId
        ) {
          setSelectedProjectId(realProjects[0].id);
        }
      }

      setLoadingProjects(false);
    }

    if (!authLoading) {
      loadProjects();
    }
  }, [
    profile?.id,
    authLoading,
    selectedProjectId,
  ]);

  /*
   * ---------------------------------------------------------
   * SPEECH RECOGNITION
   * ---------------------------------------------------------
   */

  const stopListening = useCallback(() => {
    listeningRef.current = false;
    setIsListening(false);

    try {
      recognitionRef.current?.stop();
    } catch {
      // Browser may already have stopped.
    }
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError(
        "Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge."
      );
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore previous recognition errors.
        }
      }

      const recognition = new SpeechRecognition();

      recognition.lang = "en-IN";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (
        event: SpeechRecognitionEventLike
      ) => {
        let transcript = "";

        for (
          let i = 0;
          i < event.results.length;
          i++
        ) {
          transcript +=
            event.results[i][0].transcript + " ";
        }

        setAnswer(transcript.trim());
      };

      recognition.onend = () => {
        if (listeningRef.current) {
          try {
            recognition.start();
          } catch {
            listeningRef.current = false;
            setIsListening(false);
          }
        }
      };

      recognition.onerror = (event) => {
        console.error(
          "Speech recognition error:",
          event.error
        );

        listeningRef.current = false;
        setIsListening(false);

        if (event.error === "not-allowed") {
          setError(
            "Microphone permission was denied. Please allow microphone access in your browser."
          );
        }
      };

      recognitionRef.current = recognition;

      listeningRef.current = true;
      setIsListening(true);
      setError("");

      recognition.start();
    } catch (err) {
      console.error(err);
      listeningRef.current = false;
      setIsListening(false);

      setError(
        "Could not start the microphone. Please try again."
      );
    }
  }, []);

  useEffect(() => {
    return () => {
      listeningRef.current = false;

      try {
        recognitionRef.current?.abort();
      } catch {
        // Ignore cleanup errors.
      }
    };
  }, []);

  /*
   * ---------------------------------------------------------
   * COUNTDOWN
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (countdown <= 0) return;

    const timer = window.setInterval(() => {
      setCountdown((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return value - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [countdown]);

  useEffect(() => {
    if (
      countdown === 0 &&
      questions.length > 0 &&
      !finalResult &&
      !evaluating &&
      !answer.trim() &&
      !isListening
    ) {
      const timer = window.setTimeout(() => {
        startListening();
      }, 300);

      return () => {
        window.clearTimeout(timer);
      };
    }

    return undefined;
  }, [
    countdown,
    questions.length,
    finalResult,
    evaluating,
    answer,
    isListening,
    startListening,
  ]);

  /*
   * ---------------------------------------------------------
   * START VIVA
   * ---------------------------------------------------------
   */

  async function startViva() {
    if (!selectedProjectId) {
      setError("Please select a project first.");
      return;
    }

    setLoadingViva(true);
    setError("");

    stopListening();

    try {
      const response = await fetch(
        `${BACKEND_URL}/viva-studio/start`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            idea_id: selectedProjectId,
            difficulty,
            question_count: questionCount,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "Could not start Viva Studio."
        );
      }

      setQuestions(data.questions || []);
      setEvaluations([]);
      setCurrentQuestionIndex(0);
      setAnswer("");
      setFinalResult(null);

      /*
       * 7 second thinking period.
       */
      setCountdown(7);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not start Viva Studio."
      );
    } finally {
      setLoadingViva(false);
    }
  }

  /*
   * ---------------------------------------------------------
   * SUBMIT ANSWER
   * ---------------------------------------------------------
   */

  async function submitAnswer() {
    if (!currentQuestion) return;

    const cleanAnswer = answer.trim();

    if (!cleanAnswer) {
      setError(
        "Please answer the question before continuing."
      );
      return;
    }

    stopListening();
    setEvaluating(true);
    setError("");

    try {
      const response = await fetch(
        `${BACKEND_URL}/viva-studio/answer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            idea_id: selectedProjectId,
            question_id: currentQuestion.id,
            question: currentQuestion.question,
            answer: cleanAnswer,
            difficulty,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "Could not evaluate your answer."
        );
      }

      const evaluation =
        data.evaluation as VivaEvaluation;

      const updatedEvaluations = [
        ...evaluations,
        evaluation,
      ];

      setEvaluations(updatedEvaluations);

      /*
       * More questions remaining.
       */
      if (
        currentQuestionIndex <
        questions.length - 1
      ) {
        setCurrentQuestionIndex(
          currentQuestionIndex + 1
        );
        setAnswer("");

        /*
         * Give the student another 7-second
         * thinking period.
         */
        setCountdown(7);
      } else {
        /*
         * Last question completed.
         * Generate final suggestion box.
         */
        await completeViva(updatedEvaluations);
      }
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not evaluate your answer."
      );
    } finally {
      setEvaluating(false);
    }
  }

  /*
   * ---------------------------------------------------------
   * COMPLETE VIVA
   * ---------------------------------------------------------
   */

  async function completeViva(
    completedEvaluations: VivaEvaluation[]
  ) {
    try {
      const response = await fetch(
        `${BACKEND_URL}/viva-studio/complete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            idea_id: selectedProjectId,
            difficulty,
            evaluations: completedEvaluations,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "Could not generate your final feedback."
        );
      }

      setFinalResult(data as VivaFinalResult);
      stopListening();
      setCountdown(0);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not generate final feedback."
      );
    }
  }

  /*
   * ---------------------------------------------------------
   * RESET
   * ---------------------------------------------------------
   */

  function resetViva() {
    stopListening();

    setQuestions([]);
    setEvaluations([]);
    setCurrentQuestionIndex(0);
    setAnswer("");
    setCountdown(0);
    setFinalResult(null);
    setError("");
  }

  /*
   * ---------------------------------------------------------
   * UI
   * ---------------------------------------------------------
   */

  return (
    <div className="min-h-screen bg-canvas">
      <Topbar
  title="Viva Studio"
  subtitle="Practice your project defense with AI"
/>

      <main className="mx-auto max-w-7xl px-6 md:px-10 pb-10 pt-8">
        {/* HEADER */}

        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              href="/dashboard"
              className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink-400 transition-colors hover:text-primary-600"
            >
              <ArrowLeft size={15} />
              Back to dashboard
            </Link>

            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-100 text-primary-600">
                <Mic size={24} />
              </div>

              <div>
                <h1 className="font-display text-3xl font-bold text-ink-900">
                  Viva Studio
                </h1>

                <p className="mt-1 text-sm text-ink-400">
                  Practice your project defense with your
                  AI examiner.
                </p>
              </div>
            </div>
          </div>

          {!isSetup && !finalResult && (
            <div className="flex items-center gap-3 rounded-2xl border border-primary-100 bg-white px-4 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                <Target size={17} />
              </div>

              <div>
                <p className="text-xs font-medium text-ink-400">
                  Progress
                </p>

                <p className="text-sm font-bold text-ink-800">
                  Question{" "}
                  {currentQuestionIndex + 1} of{" "}
                  {questions.length}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ERROR */}

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            <XCircle
              size={18}
              className="mt-0.5 shrink-0"
            />

            <div className="flex-1">
              {error}
            </div>

            <button
              type="button"
              onClick={() => setError("")}
              className="text-red-400 hover:text-red-600"
            >
              <XCircle size={16} />
            </button>
          </div>
        )}

        {/* ==================================================
            SETUP SCREEN
            ================================================== */}

        {isSetup && (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            {/* LEFT */}

            <section className="rounded-[30px] border border-primary-100 bg-white p-6 shadow-sm md:p-8">
              <div className="mb-8">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-600">
                  <Sparkles size={13} />
                  AI-powered project defense
                </div>

                <h2 className="font-display text-2xl font-bold text-ink-900 md:text-3xl">
                  Prepare for your viva
                </h2>

                <p className="mt-2 max-w-xl text-sm leading-6 text-ink-400">
                  Choose your project, decide how difficult
                  the questions should be, and let the AI
                  simulate your viva experience.
                </p>
              </div>

              {/* PROJECT */}

              <div className="mb-8">
                <label className="mb-2 block text-sm font-semibold text-ink-700">
                  Select your project
                </label>

                <div className="relative">
                  <select
                    value={selectedProjectId}
                    onChange={(event) =>
                      setSelectedProjectId(
                        event.target.value
                      )
                    }
                    disabled={
                      loadingProjects ||
                      projects.length === 0
                    }
                    className="w-full appearance-none rounded-2xl border border-primary-100 bg-canvas-alt px-4 py-3.5 pr-10 text-sm font-medium text-ink-800 outline-none transition focus:border-primary-300 focus:ring-4 focus:ring-primary-100"
                  >
                    {loadingProjects ? (
                      <option>
                        Loading your projects...
                      </option>
                    ) : projects.length === 0 ? (
                      <option>
                        No projects available
                      </option>
                    ) : (
                      projects.map((project) => (
                        <option
                          key={project.id}
                          value={project.id}
                        >
                          {project.title}
                        </option>
                      ))
                    )}
                  </select>

                  <ChevronDown
                    size={17}
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-400"
                  />
                </div>

                {selectedProject && (
                  <div className="mt-3 rounded-2xl bg-primary-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-500">
                      Selected project
                    </p>

                    <p className="mt-1 text-sm font-bold text-ink-900">
                      {selectedProject.title}
                    </p>

                    {selectedProject.description && (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-400">
                        {selectedProject.description}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* DIFFICULTY */}

              <div className="mb-8">
                <div className="mb-3">
                  <label className="block text-sm font-semibold text-ink-700">
                    Choose question difficulty
                  </label>

                  <p className="mt-1 text-xs text-ink-400">
                    The AI will adapt every question to
                    this level.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {DIFFICULTIES.map((item) => {
                    const Icon = item.icon;
                    const selected =
                      difficulty === item.value;

                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() =>
                          setDifficulty(item.value)
                        }
                        className={`rounded-2xl border p-4 text-left transition-all ${getDifficultyStyles(
                          item.value,
                          selected
                        )}`}
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-primary-600 shadow-sm">
                            <Icon size={18} />
                          </div>

                          {selected && (
                            <CheckCircle2
                              size={18}
                              className="text-primary-600"
                            />
                          )}
                        </div>

                        <p className="text-sm font-bold text-ink-900">
                          {item.title}
                        </p>

                        <p className="mt-1 text-xs leading-5 text-ink-400">
                          {item.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* QUESTION COUNT */}

              <div>
                <label className="mb-3 block text-sm font-semibold text-ink-700">
                  How many questions?
                </label>

                <div className="grid grid-cols-4 gap-2">
                  {QUESTION_COUNTS.map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() =>
                        setQuestionCount(count)
                      }
                      className={`rounded-xl border px-3 py-3 text-sm font-bold transition ${
                        questionCount === count
                          ? "border-primary-500 bg-primary-600 text-white shadow-sm"
                          : "border-primary-100 bg-white text-ink-600 hover:border-primary-300 hover:bg-primary-50"
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* RIGHT */}

            <section className="flex flex-col rounded-[30px] border border-primary-100 bg-gradient-to-br from-primary-50 via-white to-mint-50 p-6 shadow-sm md:p-8">
              <div className="flex-1">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-[22px] bg-white text-primary-600 shadow-sm">
                  <Bot size={30} />
                </div>

                <h3 className="font-display text-2xl font-bold text-ink-900">
                  Your AI examiner is ready.
                </h3>

                <p className="mt-2 text-sm leading-6 text-ink-500">
                  The questions won't be generic. They will
                  be generated from your selected project's
                  description, objectives, technology stack,
                  scope and other real project information.
                </p>

                <div className="mt-7 space-y-3">
                  {[
                    "Project-specific questions",
                    "Adjustable difficulty",
                    "Choose your question count",
                    "7-second thinking time",
                    "Voice-based answers",
                    "Personalized improvement suggestions",
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 rounded-xl bg-white/80 px-3 py-2.5"
                    >
                      <CheckCircle2
                        size={16}
                        className="shrink-0 text-mint-500"
                      />

                      <span className="text-sm font-medium text-ink-600">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={startViva}
                disabled={
                  loadingViva ||
                  loadingProjects ||
                  !selectedProjectId
                }
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-600 px-5 py-4 text-sm font-bold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingViva ? (
                  <>
                    <Sparkles
                      size={18}
                      className="animate-pulse"
                    />
                    Preparing your viva...
                  </>
                ) : (
                  <>
                    <Play size={18} />
                    Start Viva
                    <ArrowRight size={17} />
                  </>
                )}
              </button>

              {!speechSupported && (
                <p className="mt-3 text-center text-xs text-amber-600">
                  Voice input works best in Chrome or Edge.
                </p>
              )}
            </section>
          </div>
        )}

        {/* ==================================================
            VIVA SCREEN
            ================================================== */}

        {!isSetup && !finalResult && currentQuestion && (
          <div>
            {/* PROGRESS */}

            <div className="mb-6 overflow-hidden rounded-full bg-primary-100">
              <div
                className="h-2 rounded-full bg-primary-600 transition-all duration-500"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_330px]">
              {/* QUESTION AREA */}

              <section className="rounded-[30px] border border-primary-100 bg-white p-6 shadow-sm md:p-8">
                <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-primary-50 px-3 py-1.5 text-xs font-bold text-primary-600">
                      {difficulty}
                    </span>

                    <span className="rounded-full bg-canvas-alt px-3 py-1.5 text-xs font-medium text-ink-400">
                      Question{" "}
                      {currentQuestionIndex + 1} /{" "}
                      {questions.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-ink-400">
                    <Clock3 size={14} />
                    Viva practice
                  </div>
                </div>

                {/* THINKING */}

                {countdown > 0 && (
                  <div className="mb-8 rounded-[26px] border border-primary-100 bg-gradient-to-br from-primary-50 to-white p-8 text-center">
                    <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full border-8 border-primary-100 bg-white">
                      <span className="font-display text-4xl font-bold text-primary-600">
                        {countdown}
                      </span>
                    </div>

                    <p className="text-sm font-bold text-ink-800">
                      Take a moment to think...
                    </p>

                    <p className="mt-1 text-xs text-ink-400">
                      Your microphone will start
                      automatically.
                    </p>
                  </div>
                )}

                {/* QUESTION */}

                <div className="rounded-[26px] bg-canvas-alt p-6 md:p-8">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white">
                      <Bot size={20} />
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-500">
                        AI Examiner
                      </p>

                      <p className="text-xs text-ink-400">
                        {difficulty} level
                      </p>
                    </div>
                  </div>

                  <h2 className="font-display text-2xl font-bold leading-relaxed text-ink-900 md:text-3xl">
                    {currentQuestion.question}
                  </h2>
                </div>

                {/* ANSWER */}

                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <label className="text-sm font-bold text-ink-700">
                      Your answer
                    </label>

                    {isListening && (
                      <span className="flex items-center gap-2 text-xs font-semibold text-red-500">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                        Listening...
                      </span>
                    )}
                  </div>

                  <div
                    className={`relative rounded-[24px] border transition ${
                      isListening
                        ? "border-red-200 bg-red-50/30 ring-4 ring-red-50"
                        : "border-primary-100 bg-white"
                    }`}
                  >
                    <textarea
                      value={answer}
                      onChange={(event) =>
                        setAnswer(event.target.value)
                      }
                      placeholder={
                        isListening
                          ? "Speak your answer..."
                          : "Your spoken answer will appear here..."
                      }
                      rows={7}
                      className="w-full resize-none rounded-[24px] bg-transparent px-5 py-5 pr-16 text-sm leading-7 text-ink-700 outline-none placeholder:text-ink-300"
                    />

                    <button
                      type="button"
                      onClick={
                        isListening
                          ? stopListening
                          : startListening
                      }
                      className={`absolute bottom-4 right-4 flex h-11 w-11 items-center justify-center rounded-full transition ${
                        isListening
                          ? "bg-red-500 text-white shadow-sm hover:bg-red-600"
                          : "bg-primary-100 text-primary-600 hover:bg-primary-200"
                      }`}
                      title={
                        isListening
                          ? "Stop microphone"
                          : "Start microphone"
                      }
                    >
                      {isListening ? (
                        <MicOff size={19} />
                      ) : (
                        <Mic size={19} />
                      )}
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="flex items-center gap-1.5 text-xs text-ink-400">
                      <Volume2 size={13} />
                      Speak naturally. Your answer is
                      transcribed here.
                    </p>

                    <span className="text-xs text-ink-300">
                      {answer.length} characters
                    </span>
                  </div>
                </div>

                {/* SUBMIT */}

                <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                  <button
                    type="button"
                    onClick={resetViva}
                    disabled={evaluating}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary-100 px-4 py-3 text-sm font-semibold text-ink-500 transition hover:bg-canvas-alt disabled:opacity-50"
                  >
                    <XCircle size={16} />
                    End Viva
                  </button>

                  <button
                    type="button"
                    onClick={submitAnswer}
                    disabled={
                      evaluating ||
                      countdown > 0 ||
                      !answer.trim()
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {evaluating ? (
                      <>
                        <Sparkles
                          size={16}
                          className="animate-pulse"
                        />
                        AI is evaluating...
                      </>
                    ) : currentQuestionIndex ===
                      questions.length - 1 ? (
                      <>
                        <Trophy size={17} />
                        Finish Viva
                      </>
                    ) : (
                      <>
                        Submit Answer
                        <ArrowRight size={17} />
                      </>
                    )}
                  </button>
                </div>
              </section>

              {/* SIDE PANEL */}

              <aside className="space-y-5">
                <div className="rounded-[26px] border border-primary-100 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint-100 text-mint-600">
                      <Target size={18} />
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-ink-400">
                        Project
                      </p>

                      <p className="line-clamp-2 text-sm font-bold text-ink-800">
                        {selectedProject?.title}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-canvas-alt p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                        Level
                      </p>

                      <p className="mt-1 text-sm font-bold text-ink-800">
                        {difficulty}
                      </p>
                    </div>

                    <div className="rounded-xl bg-canvas-alt p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                        Questions
                      </p>

                      <p className="mt-1 text-sm font-bold text-ink-800">
                        {questions.length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[26px] border border-primary-100 bg-white p-5 shadow-sm">
                  <p className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-ink-400">
                    Session progress
                  </p>

                  <div className="space-y-2">
                    {questions.map((question, index) => {
                      const completed =
                        index < evaluations.length;

                      const active =
                        index === currentQuestionIndex;

                      return (
                        <div
                          key={question.id}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                            active
                              ? "bg-primary-50"
                              : "bg-transparent"
                          }`}
                        >
                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                              completed
                                ? "bg-mint-100 text-mint-600"
                                : active
                                ? "bg-primary-600 text-white"
                                : "bg-canvas-alt text-ink-400"
                            }`}
                          >
                            {completed ? (
                              <CheckCircle2 size={14} />
                            ) : (
                              index + 1
                            )}
                          </div>

                          <span
                            className={`text-xs ${
                              active
                                ? "font-bold text-primary-700"
                                : "text-ink-400"
                            }`}
                          >
                            Question {index + 1}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-[26px] bg-primary-600 p-5 text-white">
                  <Mic
                    size={22}
                    className="mb-4"
                  />

                  <p className="text-sm font-bold">
                    Speak like you're in the real viva.
                  </p>

                  <p className="mt-1 text-xs leading-5 text-primary-100">
                    Explain your thinking instead of trying
                    to memorize perfect answers.
                  </p>
                </div>
              </aside>
            </div>
          </div>
        )}

        {/* ==================================================
            FINAL RESULTS
            ================================================== */}

        {finalResult && (
          <div className="mx-auto max-w-5xl">
            <section className="overflow-hidden rounded-[32px] border border-primary-100 bg-white shadow-sm">
              {/* RESULT HEADER */}

              <div className="bg-gradient-to-br from-primary-600 via-primary-600 to-mint-500 px-6 py-10 text-center text-white md:px-10">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] bg-white/15">
                  <Trophy size={31} />
                </div>

                <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">
                  Viva completed
                </p>

                <h2 className="mt-2 font-display text-3xl font-bold md:text-4xl">
                  {getScoreMessage(
                    finalResult.average_score
                  ).title}
                </h2>

                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/80">
                  {
                    getScoreMessage(
                      finalResult.average_score
                    ).description
                  }
                </p>

                <div className="mx-auto mt-7 flex h-28 w-28 items-center justify-center rounded-full border-8 border-white/20 bg-white/10">
                  <div className="text-center">
                    <p className="font-display text-4xl font-bold">
                      {finalResult.average_score}
                    </p>

                    <p className="text-xs text-white/70">
                      / 10
                    </p>
                  </div>
                </div>
              </div>

              {/* SUMMARY */}

              <div className="grid gap-4 border-b border-primary-50 p-6 md:grid-cols-3 md:p-8">
                <div className="rounded-2xl bg-canvas-alt p-4 text-center">
                  <Award
                    size={20}
                    className="mx-auto text-primary-600"
                  />

                  <p className="mt-2 text-2xl font-bold text-ink-900">
                    {finalResult.average_score}
                  </p>

                  <p className="text-xs text-ink-400">
                    Average score
                  </p>
                </div>

                <div className="rounded-2xl bg-canvas-alt p-4 text-center">
                  <BookOpen
                    size={20}
                    className="mx-auto text-mint-600"
                  />

                  <p className="mt-2 text-2xl font-bold text-ink-900">
                    {finalResult.total_questions}
                  </p>

                  <p className="text-xs text-ink-400">
                    Questions completed
                  </p>
                </div>

                <div className="rounded-2xl bg-canvas-alt p-4 text-center">
                  <Brain
                    size={20}
                    className="mx-auto text-primary-600"
                  />

                  <p className="mt-2 text-lg font-bold text-ink-900">
                    {finalResult.difficulty}
                  </p>

                  <p className="text-xs text-ink-400">
                    Difficulty
                  </p>
                </div>
              </div>

              <div className="space-y-8 p-6 md:p-8">
                {/* OVERALL */}

                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <Sparkles
                      size={18}
                      className="text-primary-600"
                    />

                    <h3 className="text-lg font-bold text-ink-900">
                      AI Mentor Summary
                    </h3>
                  </div>

                  <div className="rounded-2xl bg-primary-50 p-5">
                    <p className="text-sm leading-7 text-ink-600">
                      {finalResult.overall_feedback}
                    </p>
                  </div>
                </div>

                {/* TWO COLUMNS */}

                <div className="grid gap-5 md:grid-cols-2">
                  {/* STRONG */}

                  <div className="rounded-2xl border border-mint-100 bg-mint-50/50 p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <CheckCircle2
                        size={18}
                        className="text-mint-600"
                      />

                      <h3 className="font-bold text-ink-900">
                        What you're doing well
                      </h3>
                    </div>

                    {finalResult.strong_areas
                      .length > 0 ? (
                      <div className="space-y-2">
                        {finalResult.strong_areas.map(
                          (area, index) => (
                            <div
                              key={`${area}-${index}`}
                              className="flex gap-2 text-sm leading-6 text-ink-600"
                            >
                              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-mint-500" />

                              <span>{area}</span>
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-ink-400">
                        Keep practicing to identify your
                        strongest areas.
                      </p>
                    )}
                  </div>

                  {/* IMPROVE */}

                  <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <Target
                        size={18}
                        className="text-amber-600"
                      />

                      <h3 className="font-bold text-ink-900">
                        Areas to work on
                      </h3>
                    </div>

                    {finalResult.areas_to_work_on
                      .length > 0 ? (
                      <div className="space-y-2">
                        {finalResult.areas_to_work_on.map(
                          (area, index) => (
                            <div
                              key={`${area}-${index}`}
                              className="flex gap-2 text-sm leading-6 text-ink-600"
                            >
                              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />

                              <span>{area}</span>
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-ink-400">
                        No major improvement areas were
                        identified.
                      </p>
                    )}
                  </div>
                </div>

                {/* SUGGESTION BOX */}

                <div className="relative overflow-hidden rounded-[26px] border border-primary-200 bg-gradient-to-br from-primary-50 to-mint-50 p-6 md:p-7">
                  <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary-100/60 blur-2xl" />

                  <div className="relative">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-primary-600 shadow-sm">
                        <Sparkles size={20} />
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-500">
                          Suggestion Box
                        </p>

                        <h3 className="text-xl font-bold text-ink-900">
                          What should you prepare next?
                        </h3>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white/80 p-5">
                      <p className="text-sm leading-7 text-ink-600">
                        {finalResult.final_suggestion}
                      </p>
                    </div>
                  </div>
                </div>

                {/* QUESTION BREAKDOWN */}

                <div>
                  <div className="mb-4 flex items-center gap-2">
                    <BookOpen
                      size={18}
                      className="text-primary-600"
                    />

                    <h3 className="text-lg font-bold text-ink-900">
                      Question breakdown
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {evaluations.map(
                      (evaluation, index) => (
                        <details
                          key={`${evaluation.question_id}-${index}`}
                          className="group rounded-2xl border border-primary-100 bg-white"
                        >
                          <summary className="flex cursor-pointer list-none items-center gap-4 p-4">
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                                evaluation.score >= 8
                                  ? "bg-mint-100 text-mint-600"
                                  : evaluation.score >= 5
                                  ? "bg-amber-100 text-amber-600"
                                  : "bg-red-100 text-red-600"
                              }`}
                            >
                              {evaluation.score}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-ink-400">
                                Question {index + 1}
                              </p>

                              <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-ink-800">
                                {evaluation.question}
                              </p>
                            </div>

                            <ChevronDown
                              size={17}
                              className="shrink-0 text-ink-300 transition group-open:rotate-180"
                            />
                          </summary>

                          <div className="border-t border-primary-50 px-4 pb-5 pt-4">
                            <div className="space-y-4">
                              <div>
                                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-400">
                                  Your answer
                                </p>

                                <p className="text-sm leading-6 text-ink-600">
                                  {evaluation.answer}
                                </p>
                              </div>

                              <div>
                                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-400">
                                  AI evaluation
                                </p>

                                <p className="text-sm leading-6 text-ink-600">
                                  {evaluation.evaluation}
                                </p>
                              </div>

                              <div className="rounded-xl bg-primary-50 p-4">
                                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-primary-500">
                                  Stronger answer
                                </p>

                                <p className="text-sm leading-6 text-ink-600">
                                  {
                                    evaluation.expected_answer
                                  }
                                </p>
                              </div>
                            </div>
                          </div>
                        </details>
                      )
                    )}
                  </div>
                </div>

                {/* ACTIONS */}

                <div className="flex flex-col gap-3 border-t border-primary-50 pt-6 sm:flex-row sm:justify-center">
                  <button
                    type="button"
                    onClick={resetViva}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary-100 px-6 py-3 text-sm font-bold text-ink-600 transition hover:bg-canvas-alt"
                  >
                    <RotateCcw size={16} />
                    Practice Again
                  </button>

                  <button
                    type="button"
                    onClick={resetViva}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-primary-700"
                  >
                    <RotateCcw size={16} />
                    Practice Another Viva
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}