"use client";

import { ArrowBigUp, CheckCircle2, Pin } from "lucide-react";
import type { Question } from "@/lib/qa/types";

type QuestionCardProps = {
  question: Question;
  voted?: boolean;
  disabled?: boolean;
  onUpvote?: (questionId: string) => void;
  onDelete?: (questionId: string) => void;
  onToggleAnswered?: (questionId: string, isAnswered: boolean) => void;
  onTogglePinned?: (questionId: string, isPinned: boolean) => void;
};

export function QuestionCard({
  question,
  voted = false,
  disabled = false,
  onUpvote,
  onDelete,
  onToggleAnswered,
  onTogglePinned,
}: QuestionCardProps) {
  const author =
    question.is_anonymous || !question.author_name
      ? "Anonymous"
      : question.author_name;
  const upvoteDisabled = disabled || voted || !onUpvote;
  const handleDelete = () => {
    if (window.confirm("Delete this question?")) {
      onDelete?.(question.id);
    }
  };

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onUpvote?.(question.id)}
          disabled={upvoteDisabled}
          aria-pressed={voted}
          aria-label="Upvote question"
          className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-900 transition hover:border-slate-300 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowBigUp className="h-5 w-5" aria-hidden="true" />
          <span className="text-sm font-black leading-none">
            {question.vote_count}
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <p className="[overflow-wrap:anywhere] text-base font-bold leading-snug text-slate-950">
            {question.body}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500">
            <span>{author}</span>
            {question.is_answered ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-black text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Answered
              </span>
            ) : null}
            {question.is_pinned ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-black text-amber-700">
                <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                Pinned
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {onDelete || onToggleAnswered || onTogglePinned ? (
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          {onTogglePinned ? (
            <button
              type="button"
              onClick={() => onTogglePinned(question.id, !question.is_pinned)}
              disabled={disabled}
              className="rounded-md px-2 py-1 text-sm font-bold text-amber-700 transition hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {question.is_pinned ? "Unpin" : "Pin active"}
            </button>
          ) : null}

          {onToggleAnswered ? (
            <button
              type="button"
              onClick={() =>
                onToggleAnswered(question.id, !question.is_answered)
              }
              disabled={disabled}
              className="rounded-md px-2 py-1 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {question.is_answered ? "Reopen" : "Mark answered"}
            </button>
          ) : null}

          {onDelete ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={disabled}
              className="rounded-md px-2 py-1 text-sm font-bold text-rose-600 transition hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Delete
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
