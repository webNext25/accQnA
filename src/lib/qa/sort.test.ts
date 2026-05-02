import { describe, expect, test } from "vitest";

import type { Question } from "./types";
import { sortQuestions } from "./sort";

const question = (overrides: Partial<Question>): Question => ({
  id: "question-1",
  event_id: "event-1",
  body: "Question?",
  author_name: null,
  is_anonymous: true,
  vote_count: 0,
  is_answered: false,
  created_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
  ...overrides,
});

describe("sortQuestions", () => {
  test("excludes deleted questions", () => {
    const questions = [
      question({ id: "visible" }),
      question({ id: "deleted", deleted_at: "2026-01-02T00:00:00.000Z" }),
    ];

    expect(sortQuestions(questions).map((item) => item.id)).toEqual([
      "visible",
    ]);
  });

  test("sorts by vote count descending, then newest first", () => {
    const questions = [
      question({
        id: "older-two-votes",
        vote_count: 2,
        created_at: "2026-01-01T00:00:00.000Z",
      }),
      question({
        id: "newer-two-votes",
        vote_count: 2,
        created_at: "2026-01-03T00:00:00.000Z",
      }),
      question({
        id: "one-vote",
        vote_count: 1,
        created_at: "2026-01-04T00:00:00.000Z",
      }),
      question({
        id: "three-votes",
        vote_count: 3,
        created_at: "2026-01-02T00:00:00.000Z",
      }),
    ];

    expect(sortQuestions(questions).map((item) => item.id)).toEqual([
      "three-votes",
      "newer-two-votes",
      "older-two-votes",
      "one-vote",
    ]);
  });

  test("returns a new array without mutating the input", () => {
    const questions = [
      question({ id: "first", vote_count: 1 }),
      question({ id: "second", vote_count: 2 }),
    ];
    const originalOrder = questions.map((item) => item.id);

    const sorted = sortQuestions(questions);

    expect(sorted).not.toBe(questions);
    expect(questions.map((item) => item.id)).toEqual(originalOrder);
  });
});
