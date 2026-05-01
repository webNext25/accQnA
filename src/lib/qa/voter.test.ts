import { beforeEach, describe, expect, test, vi } from "vitest";

import { getVoterId, hasVotedLocally, markVotedLocally } from "./voter";

describe("voter helpers", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  test("getVoterId creates and stores a UUID when none exists", () => {
    const randomUUID = vi.fn(() => "voter-123");
    vi.stubGlobal("crypto", { randomUUID });

    expect(getVoterId()).toBe("voter-123");
    expect(localStorage.getItem("alpha-colors-live-voter-id")).toBe(
      "voter-123",
    );
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  test("getVoterId reuses an existing stored voter ID", () => {
    const randomUUID = vi.fn(() => "unused");
    vi.stubGlobal("crypto", { randomUUID });
    localStorage.setItem("alpha-colors-live-voter-id", "existing-voter");

    expect(getVoterId()).toBe("existing-voter");
    expect(randomUUID).not.toHaveBeenCalled();
  });

  test("tracks whether a question has been voted on locally", () => {
    expect(hasVotedLocally("question-1")).toBe(false);

    markVotedLocally("question-1");

    expect(hasVotedLocally("question-1")).toBe(true);
    expect(localStorage.getItem("alpha-colors-live-voted-question-1")).toBe(
      "true",
    );
  });

  test("keeps vote markers separate per question", () => {
    markVotedLocally("question-1");

    expect(hasVotedLocally("question-1")).toBe(true);
    expect(hasVotedLocally("question-2")).toBe(false);
  });
});
