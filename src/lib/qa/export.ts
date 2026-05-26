import type { Event, Question } from "./types";

export function questionsToCsv(event: Event, questions: Question[]): string {
  const rows = [
    [
      "event_title",
      "event_slug",
      "rank",
      "status",
      "now_answering",
      "votes",
      "question",
      "author",
      "submitted_at",
    ],
    ...questions.map((question, index) => [
      event.title,
      event.slug,
      String(index + 1),
      question.is_answered ? "answered" : "open",
      question.is_pinned && !question.is_answered ? "yes" : "no",
      String(question.vote_count),
      question.body,
      question.is_anonymous || !question.author_name
        ? "Anonymous"
        : question.author_name,
      question.created_at,
    ]),
  ];

  return rows.map((row) => row.map(formatCsvCell).join(",")).join("\n");
}

function formatCsvCell(value: string): string {
  const normalizedValue = value.replace(/\r\n|\r|\n/g, " ");

  if (
    normalizedValue.includes(",") ||
    normalizedValue.includes("\"") ||
    normalizedValue.includes("\n")
  ) {
    return `"${normalizedValue.replace(/"/g, "\"\"")}"`;
  }

  return normalizedValue;
}
