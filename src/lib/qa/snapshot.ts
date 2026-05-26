import type { SupabaseClient } from "@supabase/supabase-js";

import { sortQuestions } from "./sort";
import type { Event, Question } from "./types";

type SnapshotClient = Pick<SupabaseClient, "from">;

export type EventSnapshot = {
  event: Event | null;
  questions: Question[];
  error: string | null;
};

export type AdminSnapshot = {
  events: Event[];
  questions: Question[];
  error: string | null;
};

export async function loadEventSnapshot(
  supabase: SnapshotClient,
  eventId: string,
): Promise<EventSnapshot> {
  const [eventResult, questionResult] = await Promise.all([
    supabase.from("events").select("*").eq("id", eventId).maybeSingle(),
    supabase
      .from("questions")
      .select("*")
      .eq("event_id", eventId)
      .is("deleted_at", null)
      .order("vote_count", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  if (eventResult.error || questionResult.error) {
    return {
      event: null,
      questions: [],
      error: "Snapshot could not refresh.",
    };
  }

  return {
    event: (eventResult.data ?? null) as Event | null,
    questions: sortQuestions((questionResult.data ?? []) as Question[]),
    error: null,
  };
}

export async function loadAdminSnapshot(
  supabase: SnapshotClient,
): Promise<AdminSnapshot> {
  const [eventsResult, questionsResult] = await Promise.all([
    supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("questions")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  if (eventsResult.error || questionsResult.error) {
    return {
      events: [],
      questions: [],
      error: "Snapshot could not refresh.",
    };
  }

  return {
    events: (eventsResult.data ?? []) as Event[],
    questions: sortQuestions((questionsResult.data ?? []) as Question[]),
    error: null,
  };
}
