const VOTER_ID_KEY = "alpha-colors-live-voter-id";
const VOTED_QUESTION_KEY_PREFIX = "alpha-colors-live-voted-";

export function getVoterId(): string {
  const existingVoterId = localStorage.getItem(VOTER_ID_KEY);

  if (existingVoterId !== null) {
    return existingVoterId;
  }

  const voterId = crypto.randomUUID();
  localStorage.setItem(VOTER_ID_KEY, voterId);

  return voterId;
}

export function hasVotedLocally(questionId: string): boolean {
  return localStorage.getItem(getVotedQuestionKey(questionId)) === "true";
}

export function markVotedLocally(questionId: string): void {
  localStorage.setItem(getVotedQuestionKey(questionId), "true");
}

function getVotedQuestionKey(questionId: string): string {
  return `${VOTED_QUESTION_KEY_PREFIX}${questionId}`;
}
