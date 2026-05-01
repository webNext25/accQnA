"use server";

import { revalidatePath } from "next/cache";

import { createServerSupabase } from "@/lib/supabase/server";
import {
  normalizeDisplayName,
  normalizeQuestionBody,
} from "@/lib/qa/validation";
import type { ActionResult, Event, Question } from "@/lib/qa/types";

type SubmitQuestionInput = {
  eventId: string;
  eventSlug: string;
  body: string;
  authorName: string;
  anonymous: boolean;
};

type UpvoteQuestionInput = {
  eventId: string;
  eventSlug: string;
  questionId: string;
  voterId: string;
};

export async function submitQuestion({
  eventId,
  eventSlug,
  body,
  authorName,
  anonymous,
}: SubmitQuestionInput): Promise<ActionResult<Question>> {
  const normalizedBody = normalizeQuestionBody(body);

  if (!normalizedBody.ok) {
    return { ok: false, error: normalizedBody.error };
  }

  const supabase = createServerSupabase();
  const event = await loadOpenEvent(supabase, eventId, eventSlug);

  if (!event.ok) {
    return event;
  }

  const { data, error } = await supabase
    .from("questions")
    .insert({
      event_id: eventId,
      body: normalizedBody.value,
      author_name: anonymous ? null : normalizeDisplayName(authorName),
      is_anonymous: anonymous,
    })
    .select("*")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: "We could not post your question. Please try again.",
    };
  }

  revalidatePath(`/${eventSlug}`);

  return { ok: true, data: data as Question };
}

export async function upvoteQuestion({
  eventId,
  eventSlug,
  questionId,
  voterId,
}: UpvoteQuestionInput): Promise<ActionResult<{ alreadyVoted: boolean }>> {
  if (!voterId.trim()) {
    return { ok: false, error: "We could not identify this browser." };
  }

  const supabase = createServerSupabase();
  const event = await loadOpenEvent(supabase, eventId, eventSlug);

  if (!event.ok) {
    return event;
  }

  const { data: question, error: questionError } = await supabase
    .from("questions")
    .select("id")
    .eq("id", questionId)
    .eq("event_id", eventId)
    .is("deleted_at", null)
    .maybeSingle();

  if (questionError || !question) {
    return {
      ok: false,
      error: "That question is no longer available.",
    };
  }

  const { error } = await supabase.from("question_votes").insert({
    event_id: eventId,
    question_id: questionId,
    voter_id: voterId,
  });

  if (error) {
    if (error.code === "23505") {
      revalidatePath(`/${eventSlug}`);
      return { ok: true, data: { alreadyVoted: true } };
    }

    return {
      ok: false,
      error: "We could not record your upvote. Please try again.",
    };
  }

  revalidatePath(`/${eventSlug}`);

  return { ok: true, data: { alreadyVoted: false } };
}

async function loadOpenEvent(
  supabase: ReturnType<typeof createServerSupabase>,
  eventId: string,
  eventSlug: string,
): Promise<ActionResult<Event>> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .eq("slug", eventSlug)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      error: "We could not find this live Q&A.",
    };
  }

  const event = data as Event;

  if (!event.is_open) {
    return {
      ok: false,
      error: "This live Q&A is closed.",
    };
  }

  return { ok: true, data: event };
}
