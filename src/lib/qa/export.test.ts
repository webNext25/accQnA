import { describe, expect, test } from "vitest";

import { questionsToCsv } from "./export";
import type { Event, Question } from "./types";

const event: Event = {
  id: "event-1",
  slug: "creative-workshop",
  title: "Creative Workshop",
  subtitle: null,
  background_image_url: null,
  is_open: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

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

describe("questionsToCsv", () => {
  test("exports ranked questions with status and author", () => {
    const csv = questionsToCsv(event, [
      question({
        id: "active",
        body: "What should we answer next?",
        author_name: "Debbie",
        is_anonymous: false,
        is_pinned: true,
        vote_count: 7,
      }),
      question({
        id: "answered",
        body: "Answered question",
        is_answered: true,
      }),
    ]);

    expect(csv).toContain(
      "event_title,event_slug,rank,status,now_answering,votes,question,author,submitted_at",
    );
    expect(csv).toContain(
      "Creative Workshop,creative-workshop,1,open,yes,7,What should we answer next?,Debbie",
    );
    expect(csv).toContain(
      "Creative Workshop,creative-workshop,2,answered,no,0,Answered question,Anonymous",
    );
  });

  test("escapes commas and quotes", () => {
    const csv = questionsToCsv(event, [
      question({
        body: "Can we say \"yes\", then explain?",
      }),
    ]);

    expect(csv).toContain("\"Can we say \"\"yes\"\", then explain?\"");
  });
});
