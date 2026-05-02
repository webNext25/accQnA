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
  is_answered: boolean;
  is_pinned: boolean;
  created_at: string;
  deleted_at: string | null;
};

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type ValidationResult =
  | { ok: true; value: string }
  | { ok: false; error: string };
