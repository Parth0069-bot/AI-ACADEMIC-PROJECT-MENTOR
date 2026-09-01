"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import useSWR from "swr";
import toast from "react-hot-toast";

import {
  Bot,
  Loader2,
  Send,
  Sparkles,
  User as UserIcon,
} from "lucide-react";

import {
  BackendError,
} from "@/lib/backendClient";

import {
  fetchChatHistory,
  sendMentorMessage,
  type ChatMessage,
} from "@/lib/mentorClient";

interface ChatPanelProps {
  ideaId: string;
}

export function ChatPanel({
  ideaId,
}: ChatPanelProps) {
  const [input, setInput] =
    useState("");

  const [sending, setSending] =
    useState(false);

  const bottomRef =
    useRef<HTMLDivElement>(null);

  const textareaRef =
    useRef<HTMLTextAreaElement>(null);

  const {
    data: history,
    mutate,
  } = useSWR<ChatMessage[]>(
    `mentor-chat:${ideaId}`,
    () => fetchChatHistory(ideaId)
  );

  /* ---------------------------------------------------------
     AUTO SCROLL
  --------------------------------------------------------- */

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [history, sending]);

  /* ---------------------------------------------------------
     SEND MESSAGE
  --------------------------------------------------------- */

  async function handleSend() {
    const message =
      input.trim();

    if (!message || sending) {
      return;
    }

    setInput("");
    setSending(true);

    mutate(
      (prev) => [
        ...(prev ?? []),
        {
          role: "student",
          message,
        },
      ],
      false
    );

    try {
      const response =
        await sendMentorMessage(
          ideaId,
          message
        );

      mutate(
        (prev) => [
          ...(prev ?? []).slice(
            0,
            -1
          ),
          {
            role: "student",
            message,
          },
          {
            role: "mentor",
            message:
              response.reply,
          },
        ],
        false
      );
    } catch (err) {
      toast.error(
        err instanceof BackendError
          ? err.message
          : "Couldn't reach your mentor. Try again."
      );

      mutate();
    } finally {
      setSending(false);

      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }

  /* ---------------------------------------------------------
     KEYBOARD
  --------------------------------------------------------- */

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      handleSend();
    }
  }

  /* ---------------------------------------------------------
     UI
  --------------------------------------------------------- */

  return (
    <div className="overflow-hidden rounded-[32px] border border-primary-100 bg-white shadow-[0_12px_40px_rgba(60,50,90,0.08)]">

      {/* =====================================================
          MENTOR HEADER
      ===================================================== */}

      <div className="border-b border-primary-50 bg-gradient-to-r from-primary-50/80 to-white px-5 py-4">

        <div className="flex items-center gap-3">

          <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-lg shadow-primary-100">

            <Bot size={21} />

            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-mint-400">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            </span>
          </div>

          <div>
            <p className="text-sm font-bold text-ink-800">
              AI Academic Mentor
            </p>

            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="text-[10px] text-mint-600">
                Ready to help
              </span>

              <Sparkles
                size={10}
                className="text-primary-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================
          CONVERSATION
      ===================================================== */}

      <div className="h-[530px] overflow-y-auto bg-surface px-4 py-6 sm:px-6">

        {!history ? (
          <div className="flex h-full items-center justify-center">

            <div className="text-center">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-500">
                <Loader2
                  size={24}
                  className="animate-spin"
                />
              </div>

              <p className="mt-4 text-xs text-ink-400">
                Opening your mentor
                conversation...
              </p>
            </div>
          </div>
        ) : history.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">

            <div className="relative flex h-20 w-20 items-center justify-center rounded-[28px] bg-primary-50 text-primary-500">

              <Bot size={32} />

              <Sparkles
                size={14}
                className="absolute -right-1 top-1 text-primary-400"
              />
            </div>

            <p className="mt-5 font-display text-xl font-bold text-ink-800">
              Where should we start?
            </p>

            <p className="mt-2 max-w-sm text-xs leading-6 text-ink-400">
              Ask your mentor about your
              project&apos;s scope, technology,
              architecture, timeline, or
              whatever you are currently
              stuck on.
            </p>

            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {[
                "What should I build first?",
                "Is my scope too large?",
                "Help me choose a technology",
              ].map(
                (suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setInput(
                        suggestion
                      );
                      textareaRef.current?.focus();
                    }}
                    className="rounded-full border border-primary-100 bg-white px-3 py-2 text-[10px] font-semibold text-ink-500 transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600"
                  >
                    {suggestion}
                  </button>
                )
              )}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-5">

            {history.map(
              (message, index) => {
                const isStudent =
                  message.role ===
                  "student";

                return (
                  <div
                    key={`${message.role}-${index}`}
                    className={[
                      "flex items-end gap-2.5",
                      isStudent
                        ? "justify-end"
                        : "justify-start",
                    ].join(" ")}
                  >

                    {!isStudent && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-mint-100 text-mint-600">
                        <Bot size={15} />
                      </div>
                    )}

                    <div
                      className={[
                        "max-w-[82%] rounded-[22px] px-4 py-3 text-sm leading-7 whitespace-pre-wrap",
                        isStudent
                          ? "rounded-br-sm bg-primary-600 text-white"
                          : "rounded-bl-sm bg-canvas-alt text-ink-700",
                      ].join(" ")}
                    >
                      {message.message}
                    </div>

                    {isStudent && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                        <UserIcon
                          size={15}
                        />
                      </div>
                    )}
                  </div>
                );
              }
            )}

            {sending && (
              <div className="flex items-end gap-2.5">

                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-mint-100 text-mint-600">
                  <Bot size={15} />
                </div>

                <div className="flex items-center gap-2 rounded-[22px] rounded-bl-sm bg-canvas-alt px-4 py-3 text-xs text-ink-400">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-300" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-300 [animation-delay:120ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-300 [animation-delay:240ms]" />
                  <span className="ml-1">
                    Mentor is thinking...
                  </span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* =====================================================
          COMPOSER
      ===================================================== */}

      <div className="border-t border-primary-50 bg-white p-4">

        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-[22px] border border-primary-100 bg-surface p-2 shadow-inner focus-within:border-primary-300 focus-within:ring-4 focus-within:ring-primary-50">

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) =>
              setInput(
                event.target.value
              )
            }
            onKeyDown={handleKeyDown}
            placeholder="Ask your mentor anything..."
            rows={1}
            className="max-h-32 min-h-[42px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm leading-6 text-ink-700 outline-none placeholder:text-ink-300"
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={
              sending ||
              !input.trim()
            }
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
          >
            {sending ? (
              <Loader2
                size={16}
                className="animate-spin"
              />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>

        <p className="mx-auto mt-2 max-w-3xl text-center text-[9px] text-ink-300">
          Enter to send · Shift + Enter
          for a new line
        </p>
      </div>
    </div>
  );
}