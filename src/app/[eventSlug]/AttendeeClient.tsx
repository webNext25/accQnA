"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { Send } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { EventHero } from "@/components/EventHero";
import { QuestionCard } from "@/components/QuestionCard";
import { sortQuestions } from "@/lib/qa/sort";
import type { Event, Question } from "@/lib/qa/types";
import {
  getVoterId,
  hasVotedLocally,
  markVotedLocally,
} from "@/lib/qa/voter";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { subscribeToEvent } from "@/lib/qa/realtime";

import { submitQuestion, upvoteQuestion } from "./actions";

type AttendeeClientProps = {
  event: Event;
  initialQuestions: Question[];
};

export function AttendeeClient({
  event: initialEvent,
  initialQuestions,
}: AttendeeClientProps) {
  const [event, setEvent] = useState(initialEvent);
  const [questions, setQuestions] = useState(() =>
    sortQuestions(initialQuestions),
  );
  const [body, setBody] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionVotedQuestionIds, setSessionVotedQuestionIds] = useState<
    Set<string>
  >(() => new Set());
  const [pendingVoteIds, setPendingVoteIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isPending, startTransition] = useTransition();

  const remainingCharacters = 280 - body.length;
  const isClosed = !event.is_open;
  const sortedQuestions = useMemo(() => sortQuestions(questions), [questions]);
  const questionIds = useMemo(
    () => sortedQuestions.map((question) => question.id),
    [sortedQuestions],
  );
  const storedVotedQuestionIds = useSyncExternalStore(
    emptySubscribe,
    () => readVotedQuestionIds(questionIds),
    () => "",
  );
  const votedQuestionIds = useMemo(() => {
    const nextIds = new Set(sessionVotedQuestionIds);

    for (const questionId of storedVotedQuestionIds.split("|")) {
      if (questionId) {
        nextIds.add(questionId);
      }
    }

    return nextIds;
  }, [sessionVotedQuestionIds, storedVotedQuestionIds]);

  useEffect(() => {
    const supabase = createBrowserSupabase();

    return subscribeToEvent(supabase, event.id, {
      onQuestionChange: (question) => {
        setQuestions((currentQuestions) => {
          const existingQuestion = currentQuestions.some(
            (item) => item.id === question.id,
          );

          if (existingQuestion) {
            return sortQuestions(
              currentQuestions.map((item) =>
                item.id === question.id ? question : item,
              ),
            );
          }

          return sortQuestions([...currentQuestions, question]);
        });
      },
      onQuestionDelete: (questionId) => {
        setQuestions((currentQuestions) =>
          currentQuestions.filter((question) => question.id !== questionId),
        );
      },
      onEventChange: setEvent,
    });
  }, [event.id]);

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();

    if (isClosed) {
      setError("This live Q&A is closed.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const result = await submitQuestion({
          eventId: event.id,
          eventSlug: event.slug,
          body,
          authorName,
          anonymous,
        });

        if (!result.ok) {
          setError(result.error);
          return;
        }

        setBody("");
        setQuestions((currentQuestions) =>
          sortQuestions([result.data, ...currentQuestions]),
        );
      } catch {
        setError("We could not post your question. Please try again.");
      }
    });
  };

  const handleUpvote = (questionId: string) => {
    if (isClosed) {
      setError("This live Q&A is closed.");
      return;
    }

    if (votedQuestionIds.has(questionId) || pendingVoteIds.has(questionId)) {
      return;
    }

    setError(null);
    setPendingVoteIds((currentIds) => new Set(currentIds).add(questionId));

    startTransition(async () => {
      try {
        const voterId = getVoterId();
        const result = await upvoteQuestion({
          eventId: event.id,
          eventSlug: event.slug,
          questionId,
          voterId,
        });

        if (!result.ok) {
          setError(result.error);
          return;
        }

        markVotedLocally(questionId);
        setSessionVotedQuestionIds((currentIds) =>
          new Set(currentIds).add(questionId),
        );

        if (!result.data.alreadyVoted) {
          setQuestions((currentQuestions) =>
            sortQuestions(
              currentQuestions.map((question) =>
                question.id === questionId
                  ? { ...question, vote_count: question.vote_count + 1 }
                  : question,
              ),
            ),
          );
        }
      } catch {
        setError("We could not record your upvote. Please try again.");
      } finally {
        setPendingVoteIds((currentIds) => {
          const nextIds = new Set(currentIds);
          nextIds.delete(questionId);
          return nextIds;
        });
      }
    });
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <EventHero event={event} />

      <div className="mx-auto grid w-full max-w-5xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:py-8">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black leading-tight text-slate-950">
                Ask a question
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Keep it sharp. The room votes the best ones up.
              </p>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-normal ${
                isClosed
                  ? "border-slate-200 bg-slate-100 text-slate-600"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {isClosed ? "Closed" : "Live"}
            </span>
          </div>

          {isClosed ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
              This Q&A is closed. Submissions and voting are paused.
            </div>
          ) : (
            <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="question-body"
                  className="text-sm font-bold text-slate-900"
                >
                  Question
                </label>
                <textarea
                  id="question-body"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  maxLength={280}
                  rows={5}
                  placeholder="What should the speaker answer next?"
                  className="mt-2 min-h-32 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-3 text-base font-medium leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10"
                />
                <p className="mt-1 text-right text-xs font-semibold text-slate-500">
                  {remainingCharacters}
                </p>
              </div>

              <div
                className="grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 p-1"
                aria-label="Author mode"
              >
                <button
                  type="button"
                  onClick={() => setAnonymous(true)}
                  className={`rounded-md px-3 py-2 text-sm font-black transition ${
                    anonymous
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Anonymous
                </button>
                <button
                  type="button"
                  onClick={() => setAnonymous(false)}
                  className={`rounded-md px-3 py-2 text-sm font-black transition ${
                    !anonymous
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Use name
                </button>
              </div>

              {!anonymous ? (
                <div>
                  <label
                    htmlFor="author-name"
                    className="text-sm font-bold text-slate-900"
                  >
                    Display name
                  </label>
                  <input
                    id="author-name"
                    value={authorName}
                    onChange={(event) => setAuthorName(event.target.value)}
                    maxLength={40}
                    placeholder="Your name"
                    className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10"
                  />
                </div>
              ) : null}

              {error ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isPending || body.trim().length === 0}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-base font-black text-white transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-5 w-5" aria-hidden="true" />
                {isPending ? "Sending" : "Send question"}
              </button>
            </form>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <h2 className="text-xl font-black leading-tight text-slate-950">
                Top questions
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {sortedQuestions.length} submitted
              </p>
            </div>
          </div>

          {sortedQuestions.length === 0 ? (
            <EmptyState
              title="No questions yet"
              message="Be first to ask what everyone else is wondering."
            />
          ) : (
            sortedQuestions.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                voted={votedQuestionIds.has(question.id)}
                disabled={isClosed || pendingVoteIds.has(question.id)}
                onUpvote={handleUpvote}
              />
            ))
          )}
        </section>
      </div>
    </main>
  );
}

function emptySubscribe() {
  return () => undefined;
}

function readVotedQuestionIds(questionIds: string[]): string {
  if (typeof window === "undefined") {
    return "";
  }

  return questionIds
    .filter((questionId) => hasVotedLocally(questionId))
    .sort()
    .join("|");
}
