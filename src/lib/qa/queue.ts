import { sortQuestions } from "./sort";
import type { Question } from "./types";

export type AdvanceQuestionPlan = {
  answerQuestionId: string | null;
  pinQuestionId: string | null;
};

export type SplitQuestionQueue = {
  liveQuestions: Question[];
  answeredQuestions: Question[];
};

export function getActiveQuestion(questions: Question[]): Question | null {
  return (
    sortQuestions(questions).find(
      (question) => question.is_pinned && !question.is_answered,
    ) ?? null
  );
}

export function getAdvanceQuestionPlan(
  questions: Question[],
): AdvanceQuestionPlan {
  const liveQuestions = sortQuestions(questions).filter(
    (question) => !question.is_answered && question.deleted_at === null,
  );
  const activeQuestion =
    liveQuestions.find((question) => question.is_pinned) ?? null;

  if (!activeQuestion) {
    return {
      answerQuestionId: null,
      pinQuestionId: liveQuestions[0]?.id ?? null,
    };
  }

  return {
    answerQuestionId: activeQuestion.id,
    pinQuestionId:
      liveQuestions.find((question) => question.id !== activeQuestion.id)?.id ??
      null,
  };
}

export function splitQuestionQueue(questions: Question[]): SplitQuestionQueue {
  const sortedQuestions = sortQuestions(questions);

  return {
    liveQuestions: sortedQuestions.filter((question) => !question.is_answered),
    answeredQuestions: sortedQuestions.filter((question) => question.is_answered),
  };
}
