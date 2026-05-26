import { describe, expect, test } from "vitest";

import type { Question } from "./types";
import { getActiveQuestion, getAdvanceQuestionPlan } from "./queue";

const question = (overrides: Partial<Question>): Question => ({
  id: "question-1",
  event_id: "event-1",
  body: "Question?",
  author_name: null,
  is_anonymous: true,
  vote_count: 0,
  is_answered: false,
  is_pinned: false,
  created_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
  ...overrides,
});

describe("getActiveQuestion", () => {
  test("returns the unanswered pinned question", () => {
    expect(
      getActiveQuestion([
        question({ id: "answered-pin", is_answered: true, is_pinned: true }),
        question({ id: "active", is_pinned: true }),
      ])?.id,
    ).toBe("active");
  });
});

describe("getAdvanceQuestionPlan", () => {
  test("pins the leading open question when no question is active", () => {
    expect(
      getAdvanceQuestionPlan([
        question({ id: "low", vote_count: 1 }),
        question({ id: "top", vote_count: 5 }),
        question({ id: "answered", is_answered: true, vote_count: 50 }),
      ]),
    ).toEqual({
      answerQuestionId: null,
      pinQuestionId: "top",
    });
  });

  test("answers the active question and pins the next leading question", () => {
    expect(
      getAdvanceQuestionPlan([
        question({ id: "active", is_pinned: true, vote_count: 1 }),
        question({ id: "next", vote_count: 8 }),
        question({ id: "third", vote_count: 3 }),
      ]),
    ).toEqual({
      answerQuestionId: "active",
      pinQuestionId: "next",
    });
  });

  test("answers the final active question when nothing else is open", () => {
    expect(
      getAdvanceQuestionPlan([
        question({ id: "active", is_pinned: true, vote_count: 1 }),
      ]),
    ).toEqual({
      answerQuestionId: "active",
      pinQuestionId: null,
    });
  });
});
