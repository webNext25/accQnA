import Link from "next/link";
import { ArrowRight, Radio } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col justify-between rounded-lg border border-white/12 bg-white/[0.06] p-6 shadow-2xl shadow-slate-950/30 sm:p-8 lg:p-10">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-slate-950">
            <Radio className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-white/60">
              Alpha Colors
            </p>
            <p className="font-black">Live Q&amp;A</p>
          </div>
        </div>

        <div className="py-16">
          <h1 className="max-w-3xl text-5xl font-black leading-none tracking-normal [overflow-wrap:anywhere] sm:text-7xl">
            Questions for the room, live on screen.
          </h1>
          <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-white/68">
            Create an event, share the QR link, and let attendees ask or second
            questions without accounts.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/accadmin"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white px-5 text-base font-black text-slate-950 transition hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Open admin
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
            <span className="inline-flex h-12 items-center justify-center rounded-lg border border-white/16 px-5 text-sm font-bold text-white/70">
              Event links use /event-slug
            </span>
          </div>
        </div>

        <p className="text-sm font-semibold text-white/45">
          Designed for simple church events: immediate questions, live upvotes,
          and a clean presenter display.
        </p>
      </section>
    </main>
  );
}
