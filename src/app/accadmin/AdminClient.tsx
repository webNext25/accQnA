"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Copy,
  ExternalLink,
  FileDown,
  Link as LinkIcon,
  Lock,
  LogOut,
  Plus,
  QrCode,
  StepForward,
  Unlock,
} from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { QuestionCard } from "@/components/QuestionCard";
import { questionsToCsv } from "@/lib/qa/export";
import { splitQuestionQueue } from "@/lib/qa/queue";
import { sortQuestions } from "@/lib/qa/sort";
import { loadAdminSnapshot } from "@/lib/qa/snapshot";
import { subscribeToEvent } from "@/lib/qa/realtime";
import type { Event, Question } from "@/lib/qa/types";
import { createBrowserSupabase } from "@/lib/supabase/browser";

import {
  advanceQuestion,
  createEvent,
  deleteQuestion,
  logoutAdmin,
  setEventOpen,
  setQuestionAnswered,
  setQuestionPinned,
} from "./actions";

type AdminClientProps = {
  initialEvents: Event[];
  initialQuestions: Question[];
};

type EventForm = {
  title: string;
  slug: string;
  subtitle: string;
  backgroundImageUrl: string;
};

const emptyForm: EventForm = {
  title: "",
  slug: "",
  subtitle: "",
  backgroundImageUrl: "",
};

export function AdminClient({
  initialEvents,
  initialQuestions,
}: AdminClientProps) {
  const [events, setEvents] = useState(initialEvents);
  const [questions, setQuestions] = useState(initialQuestions);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const eventSubscriptionKey = useMemo(
    () =>
      events
        .map((event) => event.id)
        .sort()
        .join("|"),
    [events],
  );

  const questionsByEvent = useMemo(() => {
    const groupedQuestions = new Map<string, Question[]>();

    for (const question of sortQuestions(questions)) {
      const eventQuestions = groupedQuestions.get(question.event_id) ?? [];
      eventQuestions.push(question);
      groupedQuestions.set(question.event_id, eventQuestions);
    }

    return groupedQuestions;
  }, [questions]);

  const totalQuestionCount = questions.length;
  const openEventCount = events.filter((event) => event.is_open).length;

  useEffect(() => {
    const supabase = createBrowserSupabase();
    const eventIds = eventSubscriptionKey
      ? eventSubscriptionKey.split("|")
      : [];
    const unsubscribes = eventIds.map((eventId) =>
      subscribeToEvent(supabase, eventId, {
        onQuestionChange: (question) => {
          setQuestions((currentQuestions) =>
            upsertQuestionById(currentQuestions, question),
          );
        },
        onQuestionDelete: (questionId) => {
          setQuestions((currentQuestions) =>
            currentQuestions.filter((question) => question.id !== questionId),
          );
        },
        onEventChange: (nextEvent) => {
          setEvents((currentEvents) =>
            currentEvents.map((event) =>
              event.id === nextEvent.id ? nextEvent : event,
            ),
          );
        },
      }),
    );

    return () => {
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };
  }, [eventSubscriptionKey]);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    let cancelled = false;

    const refreshSnapshot = async () => {
      const snapshot = await loadAdminSnapshot(supabase);

      if (cancelled || snapshot.error) {
        return;
      }

      setEvents(snapshot.events);
      setQuestions(snapshot.questions);
    };

    const intervalId = window.setInterval(refreshSnapshot, 12000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const handleCreate = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    setError(null);
    setNotice(null);

    startTransition(async () => {
      try {
        const result = await createEvent(form);

        if (!result.ok) {
          setError(result.error);
          return;
        }

        setEvents((currentEvents) => [result.data, ...currentEvents]);
        setForm(emptyForm);
        setNotice("Event created.");
      } catch {
        setError("We could not create the event. Please try again.");
      }
    });
  };

  const handleToggleOpen = (eventId: string, isOpen: boolean) => {
    setError(null);
    setNotice(null);

    startTransition(async () => {
      try {
        const result = await setEventOpen(eventId, isOpen);

        if (!result.ok) {
          setError(result.error);
          return;
        }

        setEvents((currentEvents) =>
          currentEvents.map((event) =>
            event.id === eventId ? { ...event, is_open: isOpen } : event,
          ),
        );
      } catch {
        setError("We could not update that event. Please try again.");
      }
    });
  };

  const handleDeleteQuestion = (questionId: string) => {
    setError(null);
    setNotice(null);

    startTransition(async () => {
      try {
        const result = await deleteQuestion(questionId);

        if (!result.ok) {
          setError(result.error);
          return;
        }

        setQuestions((currentQuestions) =>
          currentQuestions.filter((question) => question.id !== questionId),
        );
      } catch {
        setError("We could not delete that question. Please try again.");
      }
    });
  };

  const handleToggleAnswered = (questionId: string, isAnswered: boolean) => {
    setError(null);
    setNotice(null);

    startTransition(async () => {
      try {
        const result = await setQuestionAnswered(questionId, isAnswered);

        if (!result.ok) {
          setError(result.error);
          return;
        }

        setQuestions((currentQuestions) =>
          sortQuestions(
            currentQuestions.map((question) =>
              question.id === questionId
                ? {
                    ...question,
                    is_answered: isAnswered,
                    is_pinned: isAnswered ? false : question.is_pinned,
                  }
                : question,
            ),
          ),
        );
      } catch {
        setError("We could not update that question. Please try again.");
      }
    });
  };

  const handleTogglePinned = (questionId: string, isPinned: boolean) => {
    setError(null);
    setNotice(null);

    startTransition(async () => {
      try {
        const result = await setQuestionPinned(questionId, isPinned);

        if (!result.ok) {
          setError(result.error);
          return;
        }

        setQuestions((currentQuestions) => {
          const targetQuestion = currentQuestions.find(
            (question) => question.id === questionId,
          );

          if (!targetQuestion) {
            return currentQuestions;
          }

          return sortQuestions(
            currentQuestions.map((question) => {
              if (question.id === questionId) {
                return {
                  ...question,
                  is_answered: isPinned ? false : question.is_answered,
                  is_pinned: isPinned,
                };
              }

              if (isPinned && question.event_id === targetQuestion.event_id) {
                return { ...question, is_pinned: false };
              }

              return question;
            }),
          );
        });
      } catch {
        setError("We could not update that question. Please try again.");
      }
    });
  };

  const handleAdvanceQuestion = (eventId: string) => {
    setError(null);
    setNotice(null);

    startTransition(async () => {
      try {
        const result = await advanceQuestion(eventId);

        if (!result.ok) {
          setError(result.error);
          return;
        }

        setQuestions((currentQuestions) =>
          replaceEventQuestions(currentQuestions, eventId, result.data),
        );
        setNotice(
          result.data.length > 0
            ? "Live queue advanced."
            : "No open questions to advance.",
        );
      } catch {
        setError("We could not advance the question queue. Please try again.");
      }
    });
  };

  const handleCopyLink = async (event: Event) => {
    setError(null);
    setNotice(null);

    try {
      await navigator.clipboard.writeText(getEventUrl(event.slug));
      setNotice("Attendee link copied.");
    } catch {
      setError("We could not copy the attendee link.");
    }
  };

  const handleExportCsv = (event: Event, eventQuestions: Question[]) => {
    setError(null);
    setNotice(null);
    downloadTextFile(
      `${event.slug}-questions.csv`,
      questionsToCsv(event, eventQuestions),
      "text/csv;charset=utf-8",
    );
    setNotice("Question CSV downloaded.");
  };

  const handleDownloadQrPng = async (event: Event) => {
    setError(null);
    setNotice(null);

    try {
      await downloadQrPng(event, getEventUrl(event.slug));
      setNotice("QR slide PNG downloaded.");
    } catch {
      setError("We could not generate the QR PNG.");
    }
  };

  const handleDownloadQrSvg = async (event: Event) => {
    setError(null);
    setNotice(null);

    try {
      await downloadQrSvg(event, getEventUrl(event.slug));
      setNotice("QR SVG downloaded.");
    } catch {
      setError("We could not generate the QR SVG.");
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">
              Alpha Colors
            </p>
            <h1 className="mt-2 text-3xl font-black leading-tight text-slate-950 [overflow-wrap:anywhere] sm:text-4xl">
              Live Q&A Admin
            </h1>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:min-w-64">
            <Stat label="Open" value={openEventCount} />
            <Stat label="Questions" value={totalQuestionCount} />
          </div>
          <form action={logoutAdmin}>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </header>

        {error ? (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700"
          >
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            {notice}
          </div>
        ) : null}

        <div className="grid gap-5 py-5 lg:grid-cols-[minmax(20rem,0.42fr)_minmax(0,1fr)] lg:items-start">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03] sm:p-5">
            <div>
              <h2 className="text-xl font-black leading-tight text-slate-950">
                Create event
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                New events start open and ready for attendee questions.
              </p>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleCreate}>
              <Field label="Title" htmlFor="event-title">
                <input
                  id="event-title"
                  value={form.title}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      title: event.target.value,
                    }))
                  }
                  placeholder="May town hall"
                  className={inputClassName}
                />
              </Field>

              <Field label="Slug" htmlFor="event-slug">
                <input
                  id="event-slug"
                  value={form.slug}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      slug: event.target.value,
                    }))
                  }
                  placeholder="may-town-hall"
                  className={inputClassName}
                />
              </Field>

              <Field label="Subtitle" htmlFor="event-subtitle">
                <input
                  id="event-subtitle"
                  value={form.subtitle}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      subtitle: event.target.value,
                    }))
                  }
                  placeholder="Optional"
                  className={inputClassName}
                />
              </Field>

              <Field label="Background image URL" htmlFor="event-background">
                <input
                  id="event-background"
                  value={form.backgroundImageUrl}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      backgroundImageUrl: event.target.value,
                    }))
                  }
                  placeholder="https://..."
                  className={inputClassName}
                />
              </Field>

              <button
                type="submit"
                disabled={isPending || !form.title.trim()}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-base font-black text-white transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-5 w-5" aria-hidden="true" />
                {isPending ? "Creating" : "Create event"}
              </button>
            </form>
          </section>

          <section className="space-y-4">
            {events.length === 0 ? (
              <EmptyState
                title="No events yet"
                message="Create the first event to start collecting live questions."
              />
            ) : (
              events.map((event) => {
                const eventQuestions = questionsByEvent.get(event.id) ?? [];
                const { liveQuestions, answeredQuestions } =
                  splitQuestionQueue(eventQuestions);
                const attendeeUrl = `/${event.slug}`;
                const presenterUrl = `/${event.slug}/present`;
                const hasActiveQuestion = liveQuestions.some(
                  (question) => question.is_pinned,
                );

                return (
                  <article
                    key={event.id}
                    className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03] sm:p-5"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-2xl font-black leading-tight text-slate-950 [overflow-wrap:anywhere]">
                            {event.title}
                          </h2>
                          <StatusBadge isOpen={event.is_open} />
                        </div>
                        <p className="mt-2 text-sm font-bold text-slate-500 [overflow-wrap:anywhere]">
                          /{event.slug}
                        </p>
                        {event.subtitle ? (
                          <p className="mt-2 text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]">
                            {event.subtitle}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row xl:shrink-0">
                        <LinkButton href={attendeeUrl} label="Attendee" />
                        <LinkButton href={presenterUrl} label="Presenter" />
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleOpen(event.id, !event.is_open)
                          }
                          disabled={isPending}
                          className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-black transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                            event.is_open
                              ? "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-slate-500"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 focus-visible:outline-emerald-600"
                          }`}
                        >
                          {event.is_open ? (
                            <Lock className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <Unlock className="h-4 w-4" aria-hidden="true" />
                          )}
                          {event.is_open ? "Close submissions" : "Open Q&A"}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 text-sm font-bold text-slate-500">
                      <span>{eventQuestions.length} questions</span>
                      <span>{liveQuestions.length} open</span>
                      <span>{answeredQuestions.length} answered</span>
                      {event.background_image_url ? (
                        <span className="[overflow-wrap:anywhere]">
                          Image set
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                      <ActionButton
                        icon={<StepForward className="h-4 w-4" aria-hidden="true" />}
                        label={
                          hasActiveQuestion ? "Next question" : "Start queue"
                        }
                        disabled={isPending || liveQuestions.length === 0}
                        onClick={() => handleAdvanceQuestion(event.id)}
                      />
                      <ActionButton
                        icon={<Copy className="h-4 w-4" aria-hidden="true" />}
                        label="Copy link"
                        onClick={() => handleCopyLink(event)}
                      />
                      <ActionButton
                        icon={<QrCode className="h-4 w-4" aria-hidden="true" />}
                        label="QR PNG"
                        onClick={() => void handleDownloadQrPng(event)}
                      />
                      <ActionButton
                        icon={<QrCode className="h-4 w-4" aria-hidden="true" />}
                        label="QR SVG"
                        onClick={() => void handleDownloadQrSvg(event)}
                      />
                      <ActionButton
                        icon={<FileDown className="h-4 w-4" aria-hidden="true" />}
                        label="Export CSV"
                        disabled={eventQuestions.length === 0}
                        onClick={() => handleExportCsv(event, eventQuestions)}
                      />
                    </div>

                    <div className="mt-4 space-y-3">
                      {eventQuestions.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">
                          No questions for this event yet.
                        </div>
                      ) : (
                        <>
                          {liveQuestions.length > 0 ? (
                            <QuestionSectionLabel
                              label="Live queue"
                              count={liveQuestions.length}
                            />
                          ) : null}
                          {liveQuestions.map((question) => (
                            <QuestionCard
                              key={question.id}
                              question={question}
                              disabled={isPending}
                              onDelete={handleDeleteQuestion}
                              onToggleAnswered={handleToggleAnswered}
                              onTogglePinned={handleTogglePinned}
                            />
                          ))}

                          {answeredQuestions.length > 0 ? (
                            <div className="space-y-3 pt-2">
                              <QuestionSectionLabel
                                label="Answered"
                                count={answeredQuestions.length}
                              />
                              {answeredQuestions.map((question) => (
                                <QuestionCard
                                  key={question.id}
                                  question={question}
                                  disabled={isPending}
                                  onDelete={handleDeleteQuestion}
                                  onToggleAnswered={handleToggleAnswered}
                                  onTogglePinned={handleTogglePinned}
                                />
                              ))}
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function QuestionSectionLabel({
  label,
  count,
}: {
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
      <span>{label}</span>
      <span>{count}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm shadow-slate-950/[0.02]">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-sm font-bold text-slate-900">
        {label}
      </label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function StatusBadge({ isOpen }: { isOpen: boolean }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-normal ${
        isOpen
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-100 text-slate-600"
      }`}
    >
      {isOpen ? "Open" : "Closed"}
    </span>
  );
}

function LinkButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
    >
      {href ? (
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
      ) : (
        <LinkIcon className="h-4 w-4" aria-hidden="true" />
      )}
      {label}
    </a>
  );
}

function ActionButton({
  icon,
  label,
  disabled = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  );
}

const inputClassName =
  "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10";

function upsertQuestionById(
  currentQuestions: Question[],
  nextQuestion: Question,
): Question[] {
  const existingQuestion = currentQuestions.some(
    (question) => question.id === nextQuestion.id,
  );

  if (!existingQuestion) {
    return sortQuestions([nextQuestion, ...currentQuestions]);
  }

  return sortQuestions(
    currentQuestions.map((question) =>
      question.id === nextQuestion.id ? nextQuestion : question,
    ),
  );
}

function replaceEventQuestions(
  currentQuestions: Question[],
  eventId: string,
  nextEventQuestions: Question[],
): Question[] {
  return sortQuestions([
    ...currentQuestions.filter((question) => question.event_id !== eventId),
    ...nextEventQuestions,
  ]);
}

function getEventUrl(slug: string): string {
  if (typeof window === "undefined") {
    return `/${slug}`;
  }

  return new URL(`/${slug}`, window.location.origin).toString();
}

function downloadTextFile(
  filename: string,
  content: string,
  type: string,
): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function downloadQrSvg(event: Event, eventUrl: string): Promise<void> {
  const QRCode = await import("qrcode");
  const svg = await QRCode.toString(eventUrl, {
    type: "svg",
    width: 960,
    margin: 2,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });

  downloadTextFile(`${event.slug}-qr.svg`, svg, "image/svg+xml;charset=utf-8");
}

async function downloadQrPng(event: Event, eventUrl: string): Promise<void> {
  const QRCode = await import("qrcode");
  const canvas = document.createElement("canvas");
  const width = 1920;
  const height = 1080;
  const safeMargin = 120;
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas unavailable.");
  }

  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#0f172a");
  gradient.addColorStop(0.55, "#111827");
  gradient.addColorStop(1, "#312e81");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.fillStyle = "rgba(255,255,255,0.08)";
  context.fillRect(width - 620, 0, 620, height);

  context.fillStyle = "#ffffff";
  context.font = "900 92px Arial, sans-serif";
  context.fillText("Scan to ask", safeMargin, 250);

  context.fillStyle = "rgba(255,255,255,0.72)";
  context.font = "700 42px Arial, sans-serif";
  wrapCanvasText(context, event.title, safeMargin, 330, 760, 54, 3);

  if (event.subtitle) {
    context.fillStyle = "rgba(255,255,255,0.58)";
    context.font = "600 30px Arial, sans-serif";
    wrapCanvasText(context, event.subtitle, safeMargin, 520, 760, 42, 2);
  }

  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, eventUrl, {
    width: 620,
    margin: 2,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });

  const qrX = width - safeMargin - 620;
  const qrY = 185;
  context.fillStyle = "#ffffff";
  context.fillRect(qrX - 28, qrY - 28, 676, 676);
  context.drawImage(qrCanvas, qrX, qrY);

  context.fillStyle = "rgba(255,255,255,0.78)";
  context.font = "700 34px Arial, sans-serif";
  context.fillText(eventUrl, safeMargin, height - 135);

  context.fillStyle = "rgba(255,255,255,0.5)";
  context.font = "700 24px Arial, sans-serif";
  context.fillText(
    "16:9 slide-safe PNG - keep the QR clear and uncropped",
    safeMargin,
    height - 88,
  );

  const imageUrl = canvas.toDataURL("image/png");
  const anchor = document.createElement("a");
  anchor.href = imageUrl;
  anchor.download = `${event.slug}-qr-slide.png`;
  anchor.click();
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): void {
  const words = text.split(/\s+/);
  let line = "";
  let lineCount = 0;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;

    if (context.measureText(testLine).width > maxWidth && line) {
      context.fillText(line, x, y + lineCount * lineHeight);
      line = word;
      lineCount += 1;

      if (lineCount >= maxLines) {
        return;
      }
    } else {
      line = testLine;
    }
  }

  if (line && lineCount < maxLines) {
    context.fillText(line, x, y + lineCount * lineHeight);
  }
}
