import { AlertTriangle } from "lucide-react";

import {
  getAdminPasscodeHint,
  isAdminAuthenticated,
} from "@/lib/admin/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Event, Question } from "@/lib/qa/types";

import { AdminClient } from "./AdminClient";
import { loginAdmin } from "./actions";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const resolvedSearchParams = await searchParams;

  if (!(await isAdminAuthenticated())) {
    return (
      <AdminLogin
        wrongPasscode={resolvedSearchParams?.error === "1"}
        defaultPasscode={getAdminPasscodeHint()}
      />
    );
  }

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

function AdminLogin({
  wrongPasscode,
  defaultPasscode,
}: {
  wrongPasscode: boolean;
  defaultPasscode: string | null;
}) {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 lg:px-8">
      <section className="mx-auto flex min-h-[80vh] w-full max-w-md items-center justify-center">
        <div className="w-full rounded-lg border border-white/15 bg-white/95 p-5 text-slate-950 shadow-2xl shadow-slate-950/30 sm:p-6">
          <p className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">
            Alpha Colors
          </p>
          <h1 className="mt-2 text-3xl font-black leading-tight">
            Admin passcode
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Sign in to manage questions, event links, QR downloads, and the live
            queue.
          </p>

          <form action={loginAdmin} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="admin-passcode"
                className="text-sm font-bold text-slate-900"
              >
                Passcode
              </label>
              <input
                id="admin-passcode"
                name="passcode"
                type="password"
                autoComplete="current-password"
                autoFocus
                className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10"
              />
            </div>

            {wrongPasscode ? (
              <p
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700"
              >
                That passcode did not work.
              </p>
            ) : null}

            {defaultPasscode ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                Default passcode: {defaultPasscode}. Set ACC_ADMIN_PASSCODE in
                Vercel when you want to change it.
              </p>
            ) : null}

            <button
              type="submit"
              className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-slate-950 px-4 text-base font-black text-white transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
            >
              Open admin
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
