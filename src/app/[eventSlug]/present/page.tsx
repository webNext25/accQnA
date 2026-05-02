import { notFound } from "next/navigation";

import { createServerSupabase } from "@/lib/supabase/server";
import { sortQuestions } from "@/lib/qa/sort";
import type { Event, Question } from "@/lib/qa/types";

import { PresenterClient } from "./PresenterClient";

type PresenterPageProps = {
  params: Promise<{ eventSlug: string }>;
};

export const dynamic = "force-dynamic";

export default async function PresenterPage({ params }: PresenterPageProps) {
  const { eventSlug } = await params;
  const supabase = createServerSupabase();

  const { data: eventData, error: eventError } = await supabase
    .from("events")
    .select("*")
    .eq("slug", eventSlug)
    .maybeSingle();

  if (eventError || !eventData) {
    notFound();
  }

  const event = eventData as Event;

  const { data: questionData, error: questionError } = await supabase
    .from("questions")
    .select("*")
    .eq("event_id", event.id)
    .is("deleted_at", null)
    .order("vote_count", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <PresenterClient
      event={event}
      initialQuestions={sortQuestions((questionData ?? []) as Question[])}
      questionLoadError={
        questionError
          ? "Questions could not load. Refresh this display in a moment to reconnect to the live queue."
          : null
      }
    />
  );
}
