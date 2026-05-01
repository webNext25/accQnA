"use client";

import { ArrowBigUp } from "lucide-react";
import type { Question } from "@/lib/qa/types";

type QuestionCardProps = {
  question: Question;
  voted?: boolean;
  disabled?: boolean;
  onUpvote?: (questionId: string) => void;
  onDelete?: (questionId: string) => void;
};

export function QuestionCard({
  question,
  voted = false,
  disabled = false,
  onUpvote,
  onDelete,
}: QuestionCardProps) {
  const author =
    question.is_anonymous || !question.author_name
      ? "Anonymous"
      : question.author_name;
  const upvoteDisabled = disabled || voted || !onUpvote;

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onUpvote?.(question.id)}
          disabled={upvoteDisabled}
          aria-pressed={voted}
          aria-label="Upvote question"
          className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-900 transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
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
          <p className="mt-2 text-sm font-medium text-slate-500">{author}</p>
        </div>
      </div>

      {onDelete ? (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => onDelete(question.id)}
            disabled={disabled}
            className="rounded-md px-2 py-1 text-sm font-bold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      ) : null}
    </article>
  );
}
