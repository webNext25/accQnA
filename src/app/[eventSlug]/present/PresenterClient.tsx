"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Pin } from "lucide-react";

import { sortQuestions } from "@/lib/qa/sort";
import type { Event, Question } from "@/lib/qa/types";
import { subscribeToEvent } from "@/lib/qa/realtime";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type PresenterClientProps = {
  event: Event;
  initialQuestions: Question[];
  questionLoadError?: string | null;
};

type PendingQuestionChange =
  | { type: "change"; question: Question }
  | { type: "delete"; questionId: string };

export function PresenterClient({
  event: initialEvent,
  initialQuestions,
  questionLoadError = null,
}: PresenterClientProps) {
  const [event, setEvent] = useState(initialEvent);
  const [questions, setQuestions] = useState(() =>
    sortQuestions(initialQuestions),
  );

  const sortedQuestions = useMemo(() => sortQuestions(questions), [questions]);
  const currentQuestion =
    sortedQuestions.find(
      (question) => question.is_pinned && !question.is_answered,
    ) ?? null;
  const queuedQuestions = currentQuestion
    ? sortedQuestions.filter((question) => question.id !== currentQuestion.id)
    : sortedQuestions;
  const openQuestionCount = sortedQuestions.filter(
    (question) => !question.is_answered,
  ).length;
  const answeredQuestionCount = sortedQuestions.length - openQuestionCount;
  const eventImage = event.background_image_url
    ? `url(${JSON.stringify(event.background_image_url)})`
    : "linear-gradient(135deg, #111827, #475569)";

  useEffect(() => {
    const supabase = createBrowserSupabase();
    let cancelled = false;
    let snapshotReconciled = false;
    const pendingChanges: PendingQuestionChange[] = [];

    const applyChange = (change: PendingQuestionChange) => {
      setQuestions((currentQuestions) =>
        applyPendingQuestionChange(currentQuestions, change),
      );
    };

    const unsubscribe = subscribeToEvent(supabase, event.id, {
      onQuestionChange: (question) => {
        if (!snapshotReconciled) {
          pendingChanges.push({ type: "change", question });
          return;
        }

        applyChange({ type: "change", question });
      },
      onQuestionDelete: (questionId) => {
        if (!snapshotReconciled) {
          pendingChanges.push({ type: "delete", questionId });
          return;
        }

        applyChange({ type: "delete", questionId });
      },
      onEventChange: setEvent,
      onSubscribed: () => {
        void reconcileQuestionSnapshot();
      },
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };

    async function reconcileQuestionSnapshot() {
      const { data, error } = await supabase
        .from("questions")
        .select("*")
        .eq("event_id", event.id)
        .is("deleted_at", null)
        .order("vote_count", { ascending: false })
        .order("created_at", { ascending: false });

      if (cancelled) {
        return;
      }

      snapshotReconciled = true;

      if (error) {
        setQuestions((currentQuestions) =>
          applyPendingQuestionChanges(currentQuestions, pendingChanges),
        );
        return;
      }

      setQuestions(
        applyPendingQuestionChanges(
          sortQuestions((data ?? []) as Question[]),
          pendingChanges,
        ),
      );
    }
  }, [event.id]);

  return (
    <main
      className="event-backdrop min-h-screen bg-slate-950 px-4 py-5 text-white sm:px-6 lg:px-10 lg:py-8"
      style={{ "--event-image": eventImage } as CSSProperties}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-white/18 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-white/72">
              Alpha Colors Live Q&amp;A
            </p>
            <h1 className="mt-3 text-4xl font-black leading-none tracking-normal text-balance [overflow-wrap:anywhere] sm:text-5xl lg:text-7xl">
              {event.title}
            </h1>
            {event.subtitle ? (
              <p className="mt-3 max-w-3xl text-base font-semibold leading-7 text-white/78 [overflow-wrap:anywhere] sm:text-lg lg:text-xl">
                {event.subtitle}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:w-64">
            <Stat label="Open" value={openQuestionCount} />
            <Stat label="Answered" value={answeredQuestionCount} />
          </div>
        </header>

        {questionLoadError ? (
          <section
            role="alert"
            className="rounded-lg border border-amber-200/50 bg-amber-50/95 p-4 text-amber-950 shadow-xl shadow-slate-950/20"
          >
            <div className="flex gap-3">
              <AlertTriangle
                className="mt-0.5 h-5 w-5 shrink-0"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <h2 className="text-lg font-black leading-tight">
                  Presenter questions are temporarily unavailable
                </h2>
                <p className="mt-1 text-sm font-semibold leading-6">
                  {questionLoadError}
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="flex flex-col">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black leading-tight sm:text-3xl">
                Live question queue
              </h2>
              <p className="mt-1 text-sm font-bold uppercase tracking-[0.12em] text-white/62">
                Now answering, then votes, then answered
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-black uppercase tracking-normal ${
                event.is_open
                  ? "border-emerald-200/45 bg-emerald-300/18 text-emerald-50"
                  : "border-white/22 bg-white/12 text-white/76"
              }`}
            >
              {event.is_open ? "Live" : "Closed"}
            </span>
          </div>

          {sortedQuestions.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-white/28 bg-slate-950/35 px-5 py-14 text-center shadow-2xl shadow-slate-950/20">
              <div className="max-w-2xl">
                <h3 className="text-3xl font-black leading-tight sm:text-5xl">
                  No questions yet
                </h3>
                <p className="mt-4 text-lg font-semibold leading-8 text-white/70 sm:text-xl">
                  As attendees submit and vote, the leading questions will
                  appear here automatically.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {currentQuestion ? (
                <div>
                  <p className="mb-2 text-sm font-black uppercase tracking-[0.12em] text-amber-100">
                    Now answering
                  </p>
                  <PresenterQuestionCard
                    question={currentQuestion}
                    position={1}
                    featured
                  />
                </div>
              ) : null}

              {queuedQuestions.length > 0 ? (
                <div className="space-y-3 lg:space-y-4">
                  {currentQuestion ? (
                    <p className="pt-1 text-sm font-black uppercase tracking-[0.12em] text-white/58">
                      Full queue
                    </p>
                  ) : null}
                  {queuedQuestions.map((question, index) => (
                    <PresenterQuestionCard
                      key={question.id}
                      question={question}
                      position={currentQuestion ? index + 2 : index + 1}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function PresenterQuestionCard({
  question,
  position,
  featured = false,
}: {
  question: Question;
  position: number;
  featured?: boolean;
}) {
  const author =
    question.is_anonymous || !question.author_name
      ? "Anonymous"
      : question.author_name;
  const isAnswered = question.is_answered;

  return (
    <article
      className={`grid grid-cols-[3rem_minmax(0,1fr)_4.75rem] items-start gap-3 rounded-lg border px-4 py-4 shadow-2xl shadow-slate-950/25 transition sm:grid-cols-[4rem_minmax(0,1fr)_6rem] sm:gap-4 sm:px-5 lg:px-6 ${
        isAnswered
          ? "border-emerald-200/45 bg-slate-200/86 text-slate-500"
          : featured
            ? "border-amber-200/70 bg-white text-slate-950"
            : "border-white/18 bg-white/92 text-slate-950"
      } ${featured ? "lg:py-6" : ""}`}
    >
      <div
        className={`flex aspect-square h-11 items-center justify-center rounded-lg text-xl font-black leading-none sm:h-14 sm:text-2xl ${
          isAnswered ? "bg-emerald-600 text-white" : "bg-slate-950 text-white"
        }`}
      >
        {position}
      </div>

      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap gap-2">
          {isAnswered ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-black uppercase tracking-normal text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Answered
            </span>
          ) : null}
          {question.is_pinned && !isAnswered ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-black uppercase tracking-normal text-amber-700">
              <Pin className="h-3.5 w-3.5" aria-hidden="true" />
              Now answering
            </span>
          ) : null}
        </div>

        <p
          className={`font-black leading-snug break-words [overflow-wrap:anywhere] ${
            featured
              ? "text-2xl sm:text-3xl lg:text-5xl"
              : "text-lg sm:text-xl lg:text-3xl"
          }`}
        >
          {question.body}
        </p>
        <p className="mt-3 text-sm font-bold text-slate-500 [overflow-wrap:anywhere] sm:text-base">
          {author}
        </p>
      </div>

      <div className="justify-self-end text-right">
        <p
          className={`font-black leading-none ${
            featured ? "text-4xl sm:text-6xl" : "text-3xl sm:text-5xl"
          }`}
        >
          {question.vote_count}
        </p>
        <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
          votes
        </p>
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/18 bg-slate-950/36 px-4 py-3 text-right shadow-xl shadow-slate-950/15 backdrop-blur-sm">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-white/58">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black leading-none text-white sm:text-3xl">
        {value}
      </p>
    </div>
  );
}

function upsertQuestionById(
  currentQuestions: Question[],
  nextQuestion: Question,
): Question[] {
  if (nextQuestion.deleted_at) {
    return currentQuestions.filter(
      (question) => question.id !== nextQuestion.id,
    );
  }

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

function applyPendingQuestionChange(
  currentQuestions: Question[],
  change: PendingQuestionChange,
): Question[] {
  if (change.type === "delete") {
    return currentQuestions.filter(
      (question) => question.id !== change.questionId,
    );
  }

  return upsertQuestionById(currentQuestions, change.question);
}

function applyPendingQuestionChanges(
  currentQuestions: Question[],
  changes: PendingQuestionChange[],
): Question[] {
  return changes.reduce(applyPendingQuestionChange, currentQuestions);
}
