# Live Q&A Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a small Slido-style Live Q&A platform for church events with public questions, one-click upvotes, a simple admin page, and a presenter display.

**Architecture:** Use a Next.js App Router app deployed on Vercel. Supabase Postgres stores events, questions, and votes; Supabase Realtime updates attendee and presenter screens. Mutations go through server actions so validation stays server-side.

**Tech Stack:** Next.js, TypeScript, Tailwind CSS, Supabase JS, Vitest, Testing Library, lucide-react.

---

## File Structure

- `supabase/schema.sql`: Database schema, indexes, trigger, and realtime publication setup.
- `src/lib/env.ts`: Typed Supabase environment variable checks.
- `src/lib/supabase/browser.ts`: Browser Supabase client factory.
- `src/lib/supabase/server.ts`: Server Supabase client factory.
- `src/lib/qa/types.ts`: Shared event, question, and action result types.
- `src/lib/qa/voter.ts`: Browser voter id helpers.
- `src/lib/qa/sort.ts`: Question ordering helper.
- `src/lib/qa/validation.ts`: Slug, question, and display-name validation helpers.
- `src/lib/qa/realtime.ts`: Realtime channel subscription helper.
- `src/app/[eventSlug]/page.tsx`: Server loader for attendee route.
- `src/app/[eventSlug]/AttendeeClient.tsx`: Attendee realtime UI.
- `src/app/[eventSlug]/actions.ts`: Submit and upvote server actions.
- `src/app/[eventSlug]/present/page.tsx`: Server loader for presenter route.
- `src/app/[eventSlug]/present/PresenterClient.tsx`: Presenter realtime UI.
- `src/app/accadmin/page.tsx`: Server loader for admin route.
- `src/app/accadmin/AdminClient.tsx`: Admin UI.
- `src/app/accadmin/actions.ts`: Admin server actions.
- `src/components/EventHero.tsx`: Shared event banner.
- `src/components/QuestionCard.tsx`: Shared question card.
- `src/components/EmptyState.tsx`: Shared status/empty/error states.
- `src/app/globals.css`: App theme and responsive design polish.
- `src/test/setup.ts`: Test setup.
- `src/**/*.test.ts`: Unit tests for validation, sorting, and voter helpers.

## Task 1: Scaffold Next.js App

**Files:**
- Create: project scaffold files from `create-next-app`
- Modify: `package.json`
- Modify: `vitest.config.ts`
- Modify: `src/test/setup.ts`

- [ ] **Step 1: Create the app scaffold**

Run from `/Users/debbiesoheducation/ALPHA COLORS/Alpha Colors Live Q&A Platform`:

```bash
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Expected: Next.js creates `src/app`, `package.json`, TypeScript config, Tailwind config, and ESLint config.

- [ ] **Step 2: Install runtime and test dependencies**

```bash
npm install @supabase/supabase-js lucide-react
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom
```

Expected: `package.json` includes Supabase, lucide-react, Vitest, jsdom, and Testing Library.

- [ ] **Step 3: Add test scripts**

Modify `package.json` scripts to include:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 4: Add Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 5: Add test setup**

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 6: Verify scaffold**

```bash
npm run lint
npm run test
npm run build
```

Expected: lint, tests, and build pass. Vitest may report no tests yet.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json next.config.* tsconfig.json postcss.config.* eslint.config.* src vitest.config.ts
git commit -m "chore: scaffold Next.js app"
```

## Task 2: Add Supabase Schema And Environment Helpers

**Files:**
- Create: `supabase/schema.sql`
- Create: `src/lib/env.ts`
- Create: `src/lib/supabase/browser.ts`
- Create: `src/lib/supabase/server.ts`

- [ ] **Step 1: Add database schema**

Create `supabase/schema.sql`:

```sql
create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text,
  background_image_url text,
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  author_name text,
  is_anonymous boolean not null default true,
  vote_count integer not null default 0 check (vote_count >= 0),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.question_votes (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  voter_id text not null,
  created_at timestamptz not null default now(),
  unique (question_id, voter_id)
);

create index if not exists events_slug_idx on public.events (slug);
create index if not exists questions_event_rank_idx
  on public.questions (event_id, deleted_at, vote_count desc, created_at desc);
create index if not exists question_votes_event_idx on public.question_votes (event_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create or replace function public.increment_question_vote_count()
returns trigger as $$
begin
  update public.questions
  set vote_count = vote_count + 1
  where id = new.question_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists question_votes_increment_count on public.question_votes;
create trigger question_votes_increment_count
after insert on public.question_votes
for each row execute function public.increment_question_vote_count();

alter table public.events replica identity full;
alter table public.questions replica identity full;
alter table public.question_votes replica identity full;

alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.questions;
alter publication supabase_realtime add table public.question_votes;
```

- [ ] **Step 2: Add environment helper**

Create `src/lib/env.ts`:

```ts
const required = (name: string, value: string | undefined) => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

export const env = {
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
};
```

- [ ] **Step 3: Add Supabase browser client**

Create `src/lib/supabase/browser.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export const createBrowserSupabase = () =>
  createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
```

- [ ] **Step 4: Add Supabase server client**

Create `src/lib/supabase/server.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export const createServerSupabase = () =>
  createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
```

- [ ] **Step 5: Verify**

```bash
npm run lint
npm run test
```

Expected: both commands pass.

- [ ] **Step 6: Commit**

```bash
git add supabase/schema.sql src/lib/env.ts src/lib/supabase
git commit -m "feat: add Supabase schema and clients"
```

## Task 3: Add QA Domain Helpers With Tests

**Files:**
- Create: `src/lib/qa/types.ts`
- Create: `src/lib/qa/validation.ts`
- Create: `src/lib/qa/sort.ts`
- Create: `src/lib/qa/voter.ts`
- Create: `src/lib/qa/validation.test.ts`
- Create: `src/lib/qa/sort.test.ts`
- Create: `src/lib/qa/voter.test.ts`

- [ ] **Step 1: Write validation tests**

Create `src/lib/qa/validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeDisplayName, normalizeQuestionBody, normalizeSlug } from "./validation";

describe("normalizeQuestionBody", () => {
  it("trims valid question text", () => {
    expect(normalizeQuestionBody("  How do I hear God clearly?  ")).toEqual({
      ok: true,
      value: "How do I hear God clearly?",
    });
  });

  it("rejects empty question text", () => {
    expect(normalizeQuestionBody("   ")).toEqual({
      ok: false,
      error: "Question cannot be empty.",
    });
  });

  it("rejects questions over 280 characters", () => {
    expect(normalizeQuestionBody("a".repeat(281))).toEqual({
      ok: false,
      error: "Question must be 280 characters or fewer.",
    });
  });
});

describe("normalizeDisplayName", () => {
  it("uses Anonymous for blank names", () => {
    expect(normalizeDisplayName("   ")).toBe("Anonymous");
  });

  it("trims and limits names", () => {
    expect(normalizeDisplayName("  Sarah Elizabeth Tan  ")).toBe("Sarah Elizabeth Tan");
    expect(normalizeDisplayName("a".repeat(80))).toHaveLength(40);
  });
});

describe("normalizeSlug", () => {
  it("normalizes titles into slugs", () => {
    expect(normalizeSlug("Youth Night 2026!")).toBe("youth-night-2026");
  });
});
```

- [ ] **Step 2: Write sort tests**

Create `src/lib/qa/sort.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Question } from "./types";
import { sortQuestions } from "./sort";

const question = (id: string, voteCount: number, createdAt: string): Question => ({
  id,
  event_id: "event-1",
  body: id,
  author_name: null,
  is_anonymous: true,
  vote_count: voteCount,
  created_at: createdAt,
  deleted_at: null,
});

describe("sortQuestions", () => {
  it("sorts by votes first and recency second", () => {
    const result = sortQuestions([
      question("old-high", 5, "2026-05-01T10:00:00.000Z"),
      question("new-high", 5, "2026-05-01T11:00:00.000Z"),
      question("low", 1, "2026-05-01T12:00:00.000Z"),
    ]);

    expect(result.map((item) => item.id)).toEqual(["new-high", "old-high", "low"]);
  });

  it("omits deleted questions", () => {
    const deleted = question("deleted", 99, "2026-05-01T12:00:00.000Z");
    deleted.deleted_at = "2026-05-01T13:00:00.000Z";

    expect(sortQuestions([deleted, question("visible", 0, "2026-05-01T10:00:00.000Z")])).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Write voter tests**

Create `src/lib/qa/voter.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getVoterId, hasVotedLocally, markVotedLocally } from "./voter";

describe("voter helpers", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(crypto, "randomUUID").mockReturnValue("voter-1");
  });

  it("creates and reuses a voter id", () => {
    expect(getVoterId()).toBe("voter-1");
    expect(getVoterId()).toBe("voter-1");
  });

  it("tracks local votes by question id", () => {
    expect(hasVotedLocally("q1")).toBe(false);
    markVotedLocally("q1");
    expect(hasVotedLocally("q1")).toBe(true);
  });
});
```

- [ ] **Step 4: Run tests to verify failure**

```bash
npm run test -- src/lib/qa
```

Expected: tests fail because helper modules do not exist yet.

- [ ] **Step 5: Add shared types**

Create `src/lib/qa/types.ts`:

```ts
export type Event = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  background_image_url: string | null;
  is_open: boolean;
  created_at: string;
  updated_at: string;
};

export type Question = {
  id: string;
  event_id: string;
  body: string;
  author_name: string | null;
  is_anonymous: boolean;
  vote_count: number;
  created_at: string;
  deleted_at: string | null;
};

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type ValidationResult =
  | { ok: true; value: string }
  | { ok: false; error: string };
```

- [ ] **Step 6: Add validation helpers**

Create `src/lib/qa/validation.ts`:

```ts
import type { ValidationResult } from "./types";

export const normalizeQuestionBody = (body: string): ValidationResult => {
  const value = body.trim();

  if (!value) {
    return { ok: false, error: "Question cannot be empty." };
  }

  if (value.length > 280) {
    return { ok: false, error: "Question must be 280 characters or fewer." };
  }

  return { ok: true, value };
};

export const normalizeDisplayName = (name: string) => {
  const value = name.trim();
  return value ? value.slice(0, 40) : "Anonymous";
};

export const normalizeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
```

- [ ] **Step 7: Add sort helper**

Create `src/lib/qa/sort.ts`:

```ts
import type { Question } from "./types";

export const sortQuestions = (questions: Question[]) =>
  [...questions]
    .filter((question) => !question.deleted_at)
    .sort((left, right) => {
      if (right.vote_count !== left.vote_count) {
        return right.vote_count - left.vote_count;
      }

      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });
```

- [ ] **Step 8: Add voter helper**

Create `src/lib/qa/voter.ts`:

```ts
const VOTER_ID_KEY = "alpha-colors-live-voter-id";
const votedQuestionKey = (questionId: string) => `alpha-colors-live-voted-${questionId}`;

export const getVoterId = () => {
  const existing = localStorage.getItem(VOTER_ID_KEY);

  if (existing) {
    return existing;
  }

  const next = crypto.randomUUID();
  localStorage.setItem(VOTER_ID_KEY, next);
  return next;
};

export const hasVotedLocally = (questionId: string) =>
  localStorage.getItem(votedQuestionKey(questionId)) === "true";

export const markVotedLocally = (questionId: string) => {
  localStorage.setItem(votedQuestionKey(questionId), "true");
};
```

- [ ] **Step 9: Verify tests pass**

```bash
npm run test -- src/lib/qa
npm run lint
```

Expected: tests and lint pass.

- [ ] **Step 10: Commit**

```bash
git add src/lib/qa
git commit -m "feat: add Q&A domain helpers"
```

## Task 4: Build Shared UI Components

**Files:**
- Modify: `src/app/globals.css`
- Create: `src/components/EventHero.tsx`
- Create: `src/components/QuestionCard.tsx`
- Create: `src/components/EmptyState.tsx`

- [ ] **Step 1: Add global styling**

Replace `src/app/globals.css` with:

```css
@import "tailwindcss";

:root {
  --background: #f8fafc;
  --foreground: #0f172a;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}

button,
input,
textarea {
  font: inherit;
}

.event-backdrop {
  background-image:
    linear-gradient(135deg, rgba(15, 23, 42, 0.88), rgba(51, 65, 85, 0.55)),
    var(--event-image);
  background-position: center;
  background-size: cover;
}
```

- [ ] **Step 2: Add event hero**

Create `src/components/EventHero.tsx`:

```tsx
import type { CSSProperties } from "react";
import type { Event } from "@/lib/qa/types";

type Props = {
  event: Event;
  compact?: boolean;
};

export function EventHero({ event, compact = false }: Props) {
  const image = event.background_image_url
    ? `url("${event.background_image_url}")`
    : "linear-gradient(135deg, #111827, #475569)";

  return (
    <section
      className={`event-backdrop flex flex-col justify-end rounded-b-[28px] px-5 text-white shadow-xl shadow-slate-900/10 ${
        compact ? "min-h-44 py-6" : "min-h-56 py-8"
      }`}
      style={{ "--event-image": image } as CSSProperties}
    >
      <p className="text-sm font-medium text-white/75">Alpha Colors Live</p>
      <h1 className="mt-2 max-w-xl text-4xl font-black leading-none tracking-normal sm:text-5xl">
        {event.title}
      </h1>
      {event.subtitle ? <p className="mt-3 max-w-lg text-white/80">{event.subtitle}</p> : null}
    </section>
  );
}
```

- [ ] **Step 3: Add question card**

Create `src/components/QuestionCard.tsx`:

```tsx
import { ArrowBigUp } from "lucide-react";
import type { Question } from "@/lib/qa/types";

type Props = {
  question: Question;
  voted?: boolean;
  disabled?: boolean;
  onUpvote?: (questionId: string) => void;
  onDelete?: (questionId: string) => void;
};

export function QuestionCard({ question, voted = false, disabled = false, onUpvote, onDelete }: Props) {
  const author = question.is_anonymous ? "Anonymous" : question.author_name || "Anonymous";

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onUpvote?.(question.id)}
          disabled={disabled || voted || !onUpvote}
          className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-900 disabled:opacity-50"
          aria-label="Upvote question"
        >
          <ArrowBigUp className="h-5 w-5" aria-hidden="true" />
          <span className="text-sm font-black">{question.vote_count}</span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold leading-snug text-slate-950">{question.body}</p>
          <p className="mt-2 text-sm text-slate-500">{author}</p>
        </div>
      </div>
      {onDelete ? (
        <button
          type="button"
          onClick={() => onDelete(question.id)}
          className="mt-3 text-sm font-bold text-rose-600"
        >
          Delete
        </button>
      ) : null}
    </article>
  );
}
```

- [ ] **Step 4: Add empty state**

Create `src/components/EmptyState.tsx`:

```tsx
type Props = {
  title: string;
  message: string;
};

export function EmptyState({ title, message }: Props) {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <h2 className="text-xl font-black text-slate-950">{title}</h2>
      <p className="mt-2 text-sm text-slate-500">{message}</p>
    </section>
  );
}
```

- [ ] **Step 5: Verify**

```bash
npm run lint
npm run build
```

Expected: lint and build pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/components
git commit -m "feat: add shared Q&A UI components"
```

## Task 5: Build Attendee Route And Mutations

**Files:**
- Create: `src/app/[eventSlug]/page.tsx`
- Create: `src/app/[eventSlug]/AttendeeClient.tsx`
- Create: `src/app/[eventSlug]/actions.ts`
- Create: `src/lib/qa/realtime.ts`

- [ ] **Step 1: Add attendee server actions**

Create `src/app/[eventSlug]/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ActionResult, Question } from "@/lib/qa/types";
import { normalizeDisplayName, normalizeQuestionBody } from "@/lib/qa/validation";

export async function submitQuestion(input: {
  eventId: string;
  eventSlug: string;
  body: string;
  authorName: string;
  anonymous: boolean;
}): Promise<ActionResult<Question>> {
  const body = normalizeQuestionBody(input.body);
  if (!body.ok) return { ok: false, error: body.error };

  const supabase = createServerSupabase();
  const { data: event } = await supabase
    .from("events")
    .select("is_open")
    .eq("id", input.eventId)
    .single();

  if (!event?.is_open) return { ok: false, error: "This Q&A is closed." };

  const { data, error } = await supabase
    .from("questions")
    .insert({
      event_id: input.eventId,
      body: body.value,
      author_name: input.anonymous ? null : normalizeDisplayName(input.authorName),
      is_anonymous: input.anonymous,
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: "Could not submit question. Try again." };

  revalidatePath(`/${input.eventSlug}`);
  return { ok: true, data: data as Question };
}

export async function upvoteQuestion(input: {
  eventId: string;
  eventSlug: string;
  questionId: string;
  voterId: string;
}): Promise<ActionResult> {
  const supabase = createServerSupabase();
  const { data: event } = await supabase
    .from("events")
    .select("is_open")
    .eq("id", input.eventId)
    .single();

  if (!event?.is_open) return { ok: false, error: "This Q&A is closed." };

  const { error } = await supabase.from("question_votes").insert({
    event_id: input.eventId,
    question_id: input.questionId,
    voter_id: input.voterId,
  });

  if (error?.code === "23505") return { ok: false, error: "You already upvoted this question." };
  if (error) return { ok: false, error: "Could not upvote. Try again." };

  revalidatePath(`/${input.eventSlug}`);
  return { ok: true, data: undefined };
}
```

- [ ] **Step 2: Add realtime helper**

Create `src/lib/qa/realtime.ts`:

```ts
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { Event, Question } from "./types";

type Handlers = {
  onQuestionChange: (question: Question) => void;
  onQuestionDelete: (question: Question) => void;
  onEventChange?: (event: Event) => void;
};

export function subscribeToEvent(
  supabase: SupabaseClient,
  eventId: string,
  handlers: Handlers,
): RealtimeChannel {
  return supabase
    .channel(`event:${eventId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "questions", filter: `event_id=eq.${eventId}` },
      (payload) => {
        const question = payload.new as Question;
        if (question.deleted_at) handlers.onQuestionDelete(question);
        else handlers.onQuestionChange(question);
      },
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "events", filter: `id=eq.${eventId}` },
      (payload) => handlers.onEventChange?.(payload.new as Event),
    )
    .subscribe();
}
```

- [ ] **Step 3: Add attendee server page**

Create `src/app/[eventSlug]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { EventHero } from "@/components/EventHero";
import { EmptyState } from "@/components/EmptyState";
import { createServerSupabase } from "@/lib/supabase/server";
import { sortQuestions } from "@/lib/qa/sort";
import type { Event, Question } from "@/lib/qa/types";
import { AttendeeClient } from "./AttendeeClient";

export default async function EventPage({ params }: { params: Promise<{ eventSlug: string }> }) {
  const { eventSlug } = await params;
  const supabase = createServerSupabase();

  const { data: event } = await supabase.from("events").select("*").eq("slug", eventSlug).single();
  if (!event) notFound();

  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .eq("event_id", event.id)
    .is("deleted_at", null)
    .order("vote_count", { ascending: false })
    .order("created_at", { ascending: false });

  const typedEvent = event as Event;

  if (!typedEvent.is_open) {
    return (
      <main className="mx-auto min-h-screen max-w-3xl bg-slate-50 pb-10">
        <EventHero event={typedEvent} />
        <div className="p-5">
          <EmptyState title="Q&A is closed" message="Thanks for being part of the conversation." />
        </div>
      </main>
    );
  }

  return (
    <AttendeeClient
      event={typedEvent}
      initialQuestions={sortQuestions((questions ?? []) as Question[])}
    />
  );
}
```

- [ ] **Step 4: Add attendee client**

Create `src/app/[eventSlug]/AttendeeClient.tsx`:

```tsx
"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { EventHero } from "@/components/EventHero";
import { EmptyState } from "@/components/EmptyState";
import { QuestionCard } from "@/components/QuestionCard";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { sortQuestions } from "@/lib/qa/sort";
import { getVoterId, hasVotedLocally, markVotedLocally } from "@/lib/qa/voter";
import type { Event, Question } from "@/lib/qa/types";
import { subscribeToEvent } from "@/lib/qa/realtime";
import { submitQuestion, upvoteQuestion } from "./actions";

type Props = {
  event: Event;
  initialQuestions: Question[];
};

export function AttendeeClient({ event: initialEvent, initialQuestions }: Props) {
  const [event, setEvent] = useState(initialEvent);
  const [questions, setQuestions] = useState(initialQuestions);
  const [body, setBody] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const sortedQuestions = useMemo(() => sortQuestions(questions), [questions]);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    const channel = subscribeToEvent(supabase, event.id, {
      onQuestionChange: (next) =>
        setQuestions((current) => {
          const existing = current.some((item) => item.id === next.id);
          return existing ? current.map((item) => (item.id === next.id ? next : item)) : [next, ...current];
        }),
      onQuestionDelete: (deleted) =>
        setQuestions((current) => current.filter((item) => item.id !== deleted.id)),
      onEventChange: setEvent,
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [event.id]);

  const handleSubmit = (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await submitQuestion({
        eventId: event.id,
        eventSlug: event.slug,
        body,
        authorName,
        anonymous,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setBody("");
    });
  };

  const handleUpvote = (questionId: string) => {
    setError("");
    startTransition(async () => {
      const voterId = getVoterId();
      const result = await upvoteQuestion({ eventId: event.id, eventSlug: event.slug, questionId, voterId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      markVotedLocally(questionId);
    });
  };

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-slate-50 pb-10">
      <EventHero event={event} />
      <section className="p-5">
        <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-4 shadow-sm">
          <textarea
            value={body}
            onChange={(item) => setBody(item.target.value)}
            maxLength={280}
            rows={4}
            className="w-full resize-none rounded-xl border border-slate-200 p-3 text-base outline-none focus:border-slate-900"
            placeholder="Type your question..."
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setAnonymous(true)} className={`rounded-full px-4 py-2 text-sm font-bold ${anonymous ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-900"}`}>
              Anonymous
            </button>
            <button type="button" onClick={() => setAnonymous(false)} className={`rounded-full px-4 py-2 text-sm font-bold ${!anonymous ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-900"}`}>
              Use name
            </button>
          </div>
          {!anonymous ? (
            <input
              value={authorName}
              onChange={(item) => setAuthorName(item.target.value)}
              maxLength={40}
              className="mt-3 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-slate-900"
              placeholder="Your name"
            />
          ) : null}
          {error ? <p className="mt-3 text-sm font-medium text-rose-600">{error}</p> : null}
          <button disabled={isPending} className="mt-4 w-full rounded-xl bg-slate-950 py-3 font-black text-white disabled:opacity-60">
            Submit question
          </button>
        </form>
        <div className="mt-6 grid gap-3">
          {sortedQuestions.length ? (
            sortedQuestions.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                voted={typeof window !== "undefined" && hasVotedLocally(question.id)}
                disabled={isPending || !event.is_open}
                onUpvote={handleUpvote}
              />
            ))
          ) : (
            <EmptyState title="No questions yet" message="Be the first to ask what everyone else is thinking." />
          )}
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Verify**

```bash
npm run lint
npm run build
```

Expected: lint and build pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/'[eventSlug]' src/lib/qa/realtime.ts
git commit -m "feat: add attendee Q&A flow"
```

## Task 6: Build Admin Route

**Files:**
- Create: `src/app/accadmin/page.tsx`
- Create: `src/app/accadmin/AdminClient.tsx`
- Create: `src/app/accadmin/actions.ts`

- [ ] **Step 1: Add admin actions**

Create `src/app/accadmin/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ActionResult, Event } from "@/lib/qa/types";
import { normalizeSlug } from "@/lib/qa/validation";

export async function createEvent(input: {
  title: string;
  subtitle: string;
  slug: string;
  backgroundImageUrl: string;
}): Promise<ActionResult<Event>> {
  const title = input.title.trim();
  const slug = normalizeSlug(input.slug || title);

  if (!title) return { ok: false, error: "Event title is required." };
  if (!slug) return { ok: false, error: "Event slug is required." };

  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("events")
    .insert({
      title,
      slug,
      subtitle: input.subtitle.trim() || null,
      background_image_url: input.backgroundImageUrl.trim() || null,
      is_open: true,
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: "Could not create event. Try another slug." };
  revalidatePath("/accadmin");
  return { ok: true, data: data as Event };
}

export async function setEventOpen(eventId: string, isOpen: boolean): Promise<ActionResult> {
  const supabase = createServerSupabase();
  const { error } = await supabase.from("events").update({ is_open: isOpen }).eq("id", eventId);
  if (error) return { ok: false, error: "Could not update event status." };
  revalidatePath("/accadmin");
  return { ok: true, data: undefined };
}

export async function deleteQuestion(questionId: string): Promise<ActionResult> {
  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("questions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", questionId);
  if (error) return { ok: false, error: "Could not delete question." };
  revalidatePath("/accadmin");
  return { ok: true, data: undefined };
}
```

- [ ] **Step 2: Add admin server page**

Create `src/app/accadmin/page.tsx`:

```tsx
import { createServerSupabase } from "@/lib/supabase/server";
import type { Event, Question } from "@/lib/qa/types";
import { AdminClient } from "./AdminClient";

export default async function AdminPage() {
  const supabase = createServerSupabase();
  const { data: events } = await supabase.from("events").select("*").order("created_at", { ascending: false });
  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return <AdminClient initialEvents={(events ?? []) as Event[]} initialQuestions={(questions ?? []) as Question[]} />;
}
```

- [ ] **Step 3: Add admin client**

Create `src/app/accadmin/AdminClient.tsx`:

```tsx
"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { QuestionCard } from "@/components/QuestionCard";
import type { Event, Question } from "@/lib/qa/types";
import { createEvent, deleteQuestion, setEventOpen } from "./actions";

type Props = {
  initialEvents: Event[];
  initialQuestions: Question[];
};

export function AdminClient({ initialEvents, initialQuestions }: Props) {
  const [events, setEvents] = useState(initialEvents);
  const [questions, setQuestions] = useState(initialQuestions);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const questionsByEvent = useMemo(
    () =>
      questions.reduce<Record<string, Question[]>>((grouped, question) => {
        grouped[question.event_id] = [...(grouped[question.event_id] ?? []), question];
        return grouped;
      }, {}),
    [questions],
  );

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await createEvent({ title, slug, subtitle, backgroundImageUrl });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEvents((current) => [result.data, ...current]);
      setTitle("");
      setSlug("");
      setSubtitle("");
      setBackgroundImageUrl("");
    });
  };

  const handleStatus = (eventId: string, isOpen: boolean) => {
    startTransition(async () => {
      const result = await setEventOpen(eventId, isOpen);
      if (result.ok) {
        setEvents((current) => current.map((item) => (item.id === eventId ? { ...item, is_open: isOpen } : item)));
      }
    });
  };

  const handleDelete = (questionId: string) => {
    startTransition(async () => {
      const result = await deleteQuestion(questionId);
      if (result.ok) {
        setQuestions((current) => current.filter((item) => item.id !== questionId));
      }
    });
  };

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-4xl font-black text-slate-950">ACC Admin</h1>
        <form onSubmit={handleCreate} className="mt-6 grid gap-3 rounded-2xl bg-white p-5 shadow-sm md:grid-cols-2">
          <input value={title} onChange={(item) => setTitle(item.target.value)} className="rounded-xl border border-slate-200 p-3" placeholder="Event title" />
          <input value={slug} onChange={(item) => setSlug(item.target.value)} className="rounded-xl border border-slate-200 p-3" placeholder="event-slug" />
          <input value={subtitle} onChange={(item) => setSubtitle(item.target.value)} className="rounded-xl border border-slate-200 p-3" placeholder="Subtitle" />
          <input value={backgroundImageUrl} onChange={(item) => setBackgroundImageUrl(item.target.value)} className="rounded-xl border border-slate-200 p-3" placeholder="Background image URL" />
          {error ? <p className="text-sm font-bold text-rose-600 md:col-span-2">{error}</p> : null}
          <button disabled={isPending} className="rounded-xl bg-slate-950 px-5 py-3 font-black text-white md:col-span-2">Create event</button>
        </form>
        <div className="mt-8 grid gap-5">
          {events.map((event) => {
            const eventQuestions = questionsByEvent[event.id] ?? [];
            return (
              <section key={event.id} className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black">{event.title}</h2>
                    <p className="text-sm text-slate-500">/{event.slug} · {eventQuestions.length} questions · {event.is_open ? "Open" : "Closed"}</p>
                    <p className="mt-2 text-sm text-slate-600">{origin}/{event.slug}</p>
                    <p className="text-sm text-slate-600">{origin}/{event.slug}/present</p>
                  </div>
                  <button onClick={() => handleStatus(event.id, !event.is_open)} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black">
                    {event.is_open ? "Close" : "Open"}
                  </button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {eventQuestions.map((question) => (
                    <QuestionCard key={question.id} question={question} onDelete={handleDelete} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verify**

```bash
npm run lint
npm run build
```

Expected: lint and build pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/accadmin
git commit -m "feat: add admin event controls"
```

## Task 7: Build Presenter Route

**Files:**
- Create: `src/app/[eventSlug]/present/page.tsx`
- Create: `src/app/[eventSlug]/present/PresenterClient.tsx`

- [ ] **Step 1: Add presenter server page**

Create `src/app/[eventSlug]/present/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { sortQuestions } from "@/lib/qa/sort";
import type { Event, Question } from "@/lib/qa/types";
import { PresenterClient } from "./PresenterClient";

export default async function PresenterPage({ params }: { params: Promise<{ eventSlug: string }> }) {
  const { eventSlug } = await params;
  const supabase = createServerSupabase();
  const { data: event } = await supabase.from("events").select("*").eq("slug", eventSlug).single();
  if (!event) notFound();

  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .eq("event_id", event.id)
    .is("deleted_at", null)
    .order("vote_count", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <PresenterClient
      event={event as Event}
      initialQuestions={sortQuestions((questions ?? []) as Question[])}
    />
  );
}
```

- [ ] **Step 2: Add presenter client**

Create `src/app/[eventSlug]/present/PresenterClient.tsx`:

```tsx
"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { subscribeToEvent } from "@/lib/qa/realtime";
import { sortQuestions } from "@/lib/qa/sort";
import type { Event, Question } from "@/lib/qa/types";

type Props = {
  event: Event;
  initialQuestions: Question[];
};

export function PresenterClient({ event: initialEvent, initialQuestions }: Props) {
  const [event, setEvent] = useState(initialEvent);
  const [questions, setQuestions] = useState(initialQuestions);
  const topQuestions = useMemo(() => sortQuestions(questions).slice(0, 5), [questions]);
  const image = event.background_image_url
    ? `url("${event.background_image_url}")`
    : "linear-gradient(135deg, #020617, #334155)";

  useEffect(() => {
    const supabase = createBrowserSupabase();
    const channel = subscribeToEvent(supabase, event.id, {
      onQuestionChange: (next) =>
        setQuestions((current) => {
          const existing = current.some((item) => item.id === next.id);
          return existing ? current.map((item) => (item.id === next.id ? next : item)) : [next, ...current];
        }),
      onQuestionDelete: (deleted) =>
        setQuestions((current) => current.filter((item) => item.id !== deleted.id)),
      onEventChange: setEvent,
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [event.id]);

  return (
    <main
      className="event-backdrop flex min-h-screen flex-col justify-between overflow-hidden p-10 text-white"
      style={{ "--event-image": image } as CSSProperties}
    >
      <header>
        <p className="text-xl font-medium text-white/70">Alpha Colors Live Q&A</p>
        <h1 className="mt-3 max-w-5xl text-7xl font-black leading-none tracking-normal">{event.title}</h1>
      </header>
      <section className="grid gap-4">
        {topQuestions.length ? (
          topQuestions.map((question, index) => (
            <article key={question.id} className="rounded-2xl border border-white/15 bg-white/12 p-6 backdrop-blur">
              <div className="flex items-start gap-5">
                <span className="text-4xl font-black text-white/60">#{index + 1}</span>
                <div>
                  <p className="text-4xl font-black leading-tight">{question.body}</p>
                  <p className="mt-3 text-xl text-white/65">{question.vote_count} votes</p>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-2xl border border-white/15 bg-white/12 p-8 text-4xl font-black backdrop-blur">
            Questions will appear here live.
          </div>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Verify**

```bash
npm run lint
npm run build
```

Expected: lint and build pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/'[eventSlug]'/present
git commit -m "feat: add presenter display"
```

## Task 8: End-To-End Manual Verification

**Files:**
- Modify only if verification reveals issues.

- [ ] **Step 1: Create `.env.local`**

Create `.env.local` with real Supabase project values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 2: Apply schema in Supabase**

Run `supabase/schema.sql` in the Supabase SQL editor.

Expected: tables, triggers, indexes, and realtime publication setup succeed.

- [ ] **Step 3: Start dev server**

```bash
npm run dev
```

Expected: local app starts, usually on `http://localhost:3000`.

- [ ] **Step 4: Verify admin creates event**

Open `http://localhost:3000/accadmin`.

Create:

```text
Title: Questions for Tonight
Slug: youth-night
Subtitle: Ask anything. Second what matters.
Background image URL: https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1600&q=80
```

Expected: event appears in admin with attendee link `/youth-night` and presenter link `/youth-night/present`.

- [ ] **Step 5: Verify attendee submit and upvote**

Open `http://localhost:3000/youth-night` in two browser windows.

Submit:

```text
Question: How do I hear God clearly?
Identity: Anonymous
```

Expected: question appears in both windows without refresh. Upvote in one window; vote count updates in both windows.

- [ ] **Step 6: Verify presenter display**

Open `http://localhost:3000/youth-night/present`.

Expected: top question appears large on the presenter display. Upvotes in attendee windows update the presenter display.

- [ ] **Step 7: Verify admin delete and close**

In `/accadmin`, delete the test question.

Expected: question disappears from attendee and presenter windows.

Close the event.

Expected: attendee page blocks submission and shows the closed state.

- [ ] **Step 8: Final checks**

```bash
npm run lint
npm run test
npm run build
git status --short
```

Expected: lint, tests, and build pass. `git status --short` shows only intended changes or is clean after commit.

- [ ] **Step 9: Commit fixes from verification**

If verification required edits:

```bash
git add .
git commit -m "fix: polish live Q&A verification issues"
```

If no edits were needed, skip this commit.

## Self-Review

- Spec coverage: attendee link, anonymous/name choice, upvotes, reusable events, `/accadmin`, presenter display, modern branded banner design, Supabase persistence, realtime updates, validation, error handling, and verification are covered by Tasks 1-8.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation steps remain.
- Type consistency: event, question, action result, validation, sorting, and realtime helper names are consistent across tasks.
