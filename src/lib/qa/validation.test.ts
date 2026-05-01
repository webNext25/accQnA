import { describe, expect, test } from "vitest";

import {
  normalizeDisplayName,
  normalizeQuestionBody,
  normalizeSlug,
} from "./validation";

describe("normalizeQuestionBody", () => {
  test("trims surrounding whitespace", () => {
    expect(normalizeQuestionBody("  What time does it start?  ")).toEqual({
      ok: true,
      value: "What time does it start?",
    });
  });

  test("rejects an empty question", () => {
    expect(normalizeQuestionBody(" \n\t ")).toEqual({
      ok: false,
      error: "Question cannot be empty.",
    });
  });

  test("rejects questions over 280 characters", () => {
    expect(normalizeQuestionBody("a".repeat(281))).toEqual({
      ok: false,
      error: "Question must be 280 characters or fewer.",
    });
  });
});

describe("normalizeDisplayName", () => {
  test("trims a provided display name", () => {
    expect(normalizeDisplayName("  Debbie  ")).toBe("Debbie");
  });

  test("uses Anonymous for blank display names", () => {
    expect(normalizeDisplayName("   ")).toBe("Anonymous");
  });

  test("limits display names to 40 characters", () => {
    expect(normalizeDisplayName("a".repeat(45))).toBe("a".repeat(40));
  });
});

describe("normalizeSlug", () => {
  test("lowercases, hyphenates, and trims separators", () => {
    expect(normalizeSlug("  Alpha Colors: Live Q&A!!  ")).toBe(
      "alpha-colors-live-q-a",
    );
  });

  test("limits slugs to 60 characters", () => {
    expect(normalizeSlug("a".repeat(80))).toBe("a".repeat(60));
  });
});
