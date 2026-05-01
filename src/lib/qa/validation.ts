import type { ValidationResult } from "./types";

const MAX_QUESTION_BODY_LENGTH = 280;
const MAX_DISPLAY_NAME_LENGTH = 40;
const MAX_SLUG_LENGTH = 60;

export function normalizeQuestionBody(body: string): ValidationResult {
  const value = body.trim();

  if (value.length === 0) {
    return { ok: false, error: "Question cannot be empty." };
  }

  if (value.length > MAX_QUESTION_BODY_LENGTH) {
    return {
      ok: false,
      error: "Question must be 280 characters or fewer.",
    };
  }

  return { ok: true, value };
}

export function normalizeDisplayName(displayName: string): string {
  const value = displayName.trim();

  if (value.length === 0) {
    return "Anonymous";
  }

  return value.slice(0, MAX_DISPLAY_NAME_LENGTH);
}

export function normalizeSlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, "");
}
