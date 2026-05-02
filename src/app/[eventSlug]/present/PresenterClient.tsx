"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { sortQuestions } from "@/lib/qa/sort";
import type { Event, Question } from "@/lib/qa/types";
import { subscribeToEvent } from "@/lib/qa/realtime";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type PresenterClientProps = {
  event: Event;
  initialQuestions: Question[];
  questionLoadError?: string | null;
};

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
  const topQuestions = sortedQuestions.slice(0, 5);
  const eventImage = event.background_image_url
    ? `url(${JSON.stringify(event.background_image_url)})`
    : "linear-gradient(135deg, #111827, #475569)";

  useEffect(() => {
    const supabase = createBrowserSupabase();

    return subscribeToEvent(supabase, event.id, {
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
      onEventChange: setEvent,
    });
  }, [event.id]);

  return (
    <main
      className="event-backdrop min-h-screen bg-slate-950 px-4 py-5 text-white sm:px-6 lg:px-10 lg:py-8"
      style={{ "--event-image": eventImage } as CSSProperties}
    >
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-7xl flex-col gap-5 sm:min-h-[calc(100vh-3rem)] lg:min-h-[calc(100vh-4rem)]">
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
            <Stat label="Top" value={topQuestions.length} />
            <Stat label="Total" value={sortedQuestions.length} />
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

        <section className="flex min-h-0 flex-1 flex-col">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black leading-tight sm:text-3xl">
                Top questions
              </h2>
              <p className="mt-1 text-sm font-bold uppercase tracking-[0.12em] text-white/62">
                Ranked by room votes
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

          {topQuestions.length === 0 ? (
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
            <div className="grid flex-1 auto-rows-fr gap-3 lg:gap-4">
              {topQuestions.map((question, index) => (
                <article
                  key={question.id}
                  className="grid min-h-0 grid-cols-[3rem_minmax(0,1fr)_4.75rem] items-center gap-3 rounded-lg border border-white/18 bg-white/92 px-4 py-3 text-slate-950 shadow-2xl shadow-slate-950/25 sm:grid-cols-[4rem_minmax(0,1fr)_6rem] sm:gap-4 sm:px-5 lg:px-6"
                >
                  <div className="flex aspect-square h-11 items-center justify-center rounded-lg bg-slate-950 text-xl font-black leading-none text-white sm:h-14 sm:text-2xl">
                    {index + 1}
                  </div>

                  <div className="min-w-0">
                    <p className="text-xl font-black leading-snug [overflow-wrap:anywhere] sm:text-2xl lg:text-3xl">
                      {question.body}
                    </p>
                    <p className="mt-2 text-sm font-bold text-slate-500 [overflow-wrap:anywhere] sm:text-base">
                      {question.is_anonymous || !question.author_name
                        ? "Anonymous"
                        : question.author_name}
                    </p>
                  </div>

                  <div className="justify-self-end text-right">
                    <p className="text-3xl font-black leading-none sm:text-5xl">
                      {question.vote_count}
                    </p>
                    <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                      votes
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
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
