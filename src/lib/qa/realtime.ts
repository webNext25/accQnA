import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

import type { Event, Question } from "./types";

type RealtimePayload<T> = {
  new: Partial<T>;
  old: Partial<T>;
};

type EventHandlers = {
  onQuestionChange: (question: Question) => void;
  onQuestionDelete: (questionId: string) => void;
  onEventChange?: (event: Event) => void;
  onSubscribed?: () => void;
};

export function subscribeToEvent(
  supabase: Pick<SupabaseClient, "channel" | "removeChannel">,
  eventId: string,
  handlers: EventHandlers,
): () => void {
  const channel = supabase
    .channel(`event:${eventId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "questions",
        filter: `event_id=eq.${eventId}`,
      },
      (payload: RealtimePayload<Question>) => {
        const nextQuestion = payload.new;

        if (isQuestion(nextQuestion)) {
          if (nextQuestion.deleted_at) {
            handlers.onQuestionDelete(nextQuestion.id);
            return;
          }

          handlers.onQuestionChange(nextQuestion);
          return;
        }

        const previousQuestion = payload.old;
        if (typeof previousQuestion.id === "string") {
          handlers.onQuestionDelete(previousQuestion.id);
        }
      },
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "events",
        filter: `id=eq.${eventId}`,
      },
      (payload: RealtimePayload<Event>) => {
        if (handlers.onEventChange && isEvent(payload.new)) {
          handlers.onEventChange(payload.new);
        }
      },
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        handlers.onSubscribed?.();
      }
    });

  return () => {
    void supabase.removeChannel(channel as RealtimeChannel);
  };
}

function isQuestion(value: Partial<Question>): value is Question {
  return (
    typeof value.id === "string" &&
    typeof value.event_id === "string" &&
    typeof value.body === "string" &&
    typeof value.is_anonymous === "boolean" &&
    typeof value.vote_count === "number" &&
    typeof value.created_at === "string" &&
    (typeof value.author_name === "string" || value.author_name === null) &&
    (typeof value.deleted_at === "string" || value.deleted_at === null)
  );
}

function isEvent(value: Partial<Event>): value is Event {
  return (
    typeof value.id === "string" &&
    typeof value.slug === "string" &&
    typeof value.title === "string" &&
    typeof value.is_open === "boolean" &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string" &&
    (typeof value.subtitle === "string" || value.subtitle === null) &&
    (typeof value.background_image_url === "string" ||
      value.background_image_url === null)
  );
}
