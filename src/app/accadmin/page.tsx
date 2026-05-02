import { AlertTriangle } from "lucide-react";

import { createServerSupabase } from "@/lib/supabase/server";
import type { Event, Question } from "@/lib/qa/types";

import { AdminClient } from "./AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = createServerSupabase();

  const [eventsResult, questionsResult] = await Promise.all([
    supabase.from("events").select("*").order("created_at", {
      ascending: false,
    }),
    supabase
      .from("questions")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  if (eventsResult.error || questionsResult.error) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
        <section className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center justify-center">
          <div className="w-full rounded-lg border border-rose-200 bg-white p-6 shadow-sm shadow-slate-950/[0.03]">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-black leading-tight text-slate-950">
                  Admin data could not load
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Refresh the page in a moment. If it keeps happening, check the
                  Supabase connection and table permissions.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <AdminClient
      initialEvents={(eventsResult.data ?? []) as Event[]}
      initialQuestions={(questionsResult.data ?? []) as Question[]}
    />
  );
}
