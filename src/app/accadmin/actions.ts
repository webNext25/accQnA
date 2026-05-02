"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult, Event } from "@/lib/qa/types";
import { createServerSupabase } from "@/lib/supabase/server";

type CreateEventInput = {
  title: string;
  subtitle: string;
  slug: string;
  backgroundImageUrl: string;
};

export async function createEvent({
  title,
  subtitle,
  slug,
  backgroundImageUrl,
}: CreateEventInput): Promise<ActionResult<Event>> {
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
  const supabase = createServerSupabase();
  const { error } = await supabase.from("questions").delete().eq("id", questionId);

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
  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("questions")
    .update({ is_answered: isAnswered })
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
