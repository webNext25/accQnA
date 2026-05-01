import { notFound } from "next/navigation";

import { EmptyState } from "@/components/EmptyState";
import { EventHero } from "@/components/EventHero";
import { createServerSupabase } from "@/lib/supabase/server";
import { sortQuestions } from "@/lib/qa/sort";
import type { Event, Question } from "@/lib/qa/types";

import { AttendeeClient } from "./AttendeeClient";

type AttendeePageProps = {
  params: Promise<{ eventSlug: string }>;
};

export default async function AttendeePage({ params }: AttendeePageProps) {
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

  const { data: questionData } = await supabase
    .from("questions")
    .select("*")
    .eq("event_id", event.id)
    .is("deleted_at", null)
    .order("vote_count", { ascending: false })
    .order("created_at", { ascending: false });

  const initialQuestions = sortQuestions((questionData ?? []) as Question[]);

  if (!event.is_open) {
    return (
      <main className="min-h-screen bg-slate-50">
        <EventHero event={event} />
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
          <EmptyState
            title="This Q&A is closed"
            message="Thanks for joining Alpha Colors Live. Question submissions and voting are no longer open."
          />
        </div>
      </main>
    );
  }

  return <AttendeeClient event={event} initialQuestions={initialQuestions} />;
}
