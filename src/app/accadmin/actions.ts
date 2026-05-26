"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  clearAdminSession,
  isAdminAuthenticated,
  isAdminPasscode,
  setAdminSession,
} from "@/lib/admin/auth";
import { getAdvanceQuestionPlan } from "@/lib/qa/queue";
import { sortQuestions } from "@/lib/qa/sort";
import type { ActionResult, Event, Question } from "@/lib/qa/types";
import { createServerSupabase } from "@/lib/supabase/server";

type CreateEventInput = {
  title: string;
  subtitle: string;
  slug: string;
  backgroundImageUrl: string;
};

export async function loginAdmin(formData: FormData): Promise<void> {
  const passcode = String(formData.get("passcode") ?? "");

  if (!isAdminPasscode(passcode)) {
    redirect("/accadmin?error=1");
  }

  await setAdminSession();
  redirect("/accadmin");
}

export async function logoutAdmin(): Promise<void> {
  await clearAdminSession();
  redirect("/accadmin");
}

export async function createEvent({
  title,
  subtitle,
  slug,
  backgroundImageUrl,
}: CreateEventInput): Promise<ActionResult<Event>> {
  const unauthorized = await requireAdminAction<Event>();

  if (unauthorized) {
    return unauthorized;
  }

  const normalizedTitle = title.trim();
  const normalizedSlug = normalizeSlug(slug || title);

  if (!normalizedTitle) {
    return { ok: false, error: "Add an event title first." };
  }

  if (!normalizedSlug) {
    return {
      ok: false,
      error: "Add a slug, or use a title that can become a slug.",
    };
  }

  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("events")
    .insert({
      title: normalizedTitle,
      slug: normalizedSlug,
      subtitle: blankToNull(subtitle),
      background_image_url: blankToNull(backgroundImageUrl),
      is_open: true,
    })
    .select("*")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error:
        error?.code === "23505"
          ? "That event slug is already in use. Try a different slug."
          : "We could not create the event. Please try again.",
    };
  }

  revalidatePath("/accadmin");

  return { ok: true, data: data as Event };
}

export async function setEventOpen(
  eventId: string,
  isOpen: boolean,
): Promise<ActionResult> {
  const unauthorized = await requireAdminAction();

  if (unauthorized) {
    return unauthorized;
  }

  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("events")
    .update({ is_open: isOpen })
    .eq("id", eventId);

  if (error) {
    return {
      ok: false,
      error: isOpen
        ? "We could not open this event. Please try again."
        : "We could not close this event. Please try again.",
    };
  }

  revalidatePath("/accadmin");

  return { ok: true, data: undefined };
}

export async function deleteQuestion(
  questionId: string,
): Promise<ActionResult> {
  const unauthorized = await requireAdminAction();

  if (unauthorized) {
    return unauthorized;
  }

  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("questions")
    .update({ deleted_at: new Date().toISOString(), is_pinned: false })
    .eq("id", questionId);

  if (error) {
    return {
      ok: false,
      error: "We could not delete that question. Please try again.",
    };
  }

  revalidatePath("/accadmin");

  return { ok: true, data: undefined };
}

export async function setQuestionAnswered(
  questionId: string,
  isAnswered: boolean,
): Promise<ActionResult> {
  const unauthorized = await requireAdminAction();

  if (unauthorized) {
    return unauthorized;
  }

  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("questions")
    .update({
      is_answered: isAnswered,
      ...(isAnswered ? { is_pinned: false } : {}),
    })
    .eq("id", questionId);

  if (error) {
    return {
      ok: false,
      error: isAnswered
        ? "We could not mark that question answered. Please try again."
        : "We could not reopen that question. Please try again.",
    };
  }

  revalidatePath("/accadmin");

  return { ok: true, data: undefined };
}

export async function setQuestionPinned(
  questionId: string,
  isPinned: boolean,
): Promise<ActionResult> {
  const unauthorized = await requireAdminAction();

  if (unauthorized) {
    return unauthorized;
  }

  const supabase = createServerSupabase();

  if (!isPinned) {
    const { error } = await supabase
      .from("questions")
      .update({ is_pinned: false })
      .eq("id", questionId);

    if (error) {
      return {
        ok: false,
        error: "We could not unpin that question. Please try again.",
      };
    }

    revalidatePath("/accadmin");
    return { ok: true, data: undefined };
  }

  const { data: question, error: questionError } = await supabase
    .from("questions")
    .select("event_id")
    .eq("id", questionId)
    .single();

  if (questionError || !question) {
    return {
      ok: false,
      error: "We could not pin that question. Please try again.",
    };
  }

  const { error: clearError } = await supabase
    .from("questions")
    .update({ is_pinned: false })
    .eq("event_id", question.event_id)
    .eq("is_pinned", true);

  if (clearError) {
    return {
      ok: false,
      error: "We could not pin that question. Please try again.",
    };
  }

  const { error: pinError } = await supabase
    .from("questions")
    .update({ is_answered: false, is_pinned: true })
    .eq("id", questionId);

  if (pinError) {
    return {
      ok: false,
      error: "We could not pin that question. Please try again.",
    };
  }

  revalidatePath("/accadmin");

  return { ok: true, data: undefined };
}

export async function advanceQuestion(
  eventId: string,
): Promise<ActionResult<Question[]>> {
  const unauthorized = await requireAdminAction<Question[]>();

  if (unauthorized) {
    return unauthorized;
  }

  const supabase = createServerSupabase();
  const { data: questions, error: questionError } = await supabase
    .from("questions")
    .select("*")
    .eq("event_id", eventId)
    .is("deleted_at", null);

  if (questionError) {
    return {
      ok: false,
      error: "We could not load the question queue. Please try again.",
    };
  }

  const plan = getAdvanceQuestionPlan((questions ?? []) as Question[]);

  if (!plan.answerQuestionId && !plan.pinQuestionId) {
    return { ok: true, data: [] };
  }

  if (plan.answerQuestionId) {
    const { error } = await supabase
      .from("questions")
      .update({ is_answered: true, is_pinned: false })
      .eq("id", plan.answerQuestionId)
      .eq("event_id", eventId);

    if (error) {
      return {
        ok: false,
        error: "We could not advance the question queue. Please try again.",
      };
    }
  }

  if (plan.pinQuestionId) {
    const { error: clearError } = await supabase
      .from("questions")
      .update({ is_pinned: false })
      .eq("event_id", eventId)
      .eq("is_pinned", true);

    if (clearError) {
      return {
        ok: false,
        error: "We could not advance the question queue. Please try again.",
      };
    }

    const { error: pinError } = await supabase
      .from("questions")
      .update({ is_answered: false, is_pinned: true })
      .eq("id", plan.pinQuestionId)
      .eq("event_id", eventId);

    if (pinError) {
      return {
        ok: false,
        error: "We could not advance the question queue. Please try again.",
      };
    }
  }

  const { data: nextQuestions, error: nextQuestionError } = await supabase
    .from("questions")
    .select("*")
    .eq("event_id", eventId)
    .is("deleted_at", null);

  if (nextQuestionError) {
    return {
      ok: false,
      error:
        "The queue advanced, but the latest questions could not refresh yet.",
    };
  }

  revalidatePath("/accadmin");

  return { ok: true, data: sortQuestions((nextQuestions ?? []) as Question[]) };
}

async function requireAdminAction<T = undefined>(): Promise<
  ActionResult<T> | null
> {
  if (await isAdminAuthenticated()) {
    return null;
  }

  return {
    ok: false,
    error: "Admin passcode required. Refresh the admin page and sign in again.",
  };
}

function blankToNull(value: string): string | null {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
