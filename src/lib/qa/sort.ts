import type { Question } from "./types";

export function sortQuestions(questions: Question[]): Question[] {
  return questions
    .filter((question) => question.deleted_at === null)
    .sort((left, right) => {
      if (left.is_pinned !== right.is_pinned) {
        return left.is_pinned ? -1 : 1;
      }

      const voteDifference = right.vote_count - left.vote_count;

      if (voteDifference !== 0) {
        return voteDifference;
      }

      return (
        new Date(right.created_at).getTime() -
        new Date(left.created_at).getTime()
      );
    });
}
