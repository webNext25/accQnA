# Live Q&A Platform Design

## Summary

Build a small Slido-style Live Q&A platform for church events. Attendees open one public event link or QR code, submit questions without an account, choose either Anonymous or a typed name, see existing questions, and upvote questions they want answered.

The app will support reusable events, near-instant realtime updates, an unprotected admin route at `/accadmin`, and a presenter display for stage use. The first version targets fewer than 50 concurrent attendees.

## Goals

- Let attendees submit questions from a phone without login.
- Let attendees upvote existing questions to second them.
- Update attendee and presenter screens in near real time.
- Let the team create reusable events with a title, slug, open/closed status, and event background.
- Give the team simple admin controls for copying links and deleting questions.
- Use a modern Gen Z church visual style with a clean app layout and branded event banner.
- Deploy cleanly to Vercel with Supabase for persistence and realtime updates.

## Non-Goals

- User accounts or attendee authentication.
- Moderation queue before questions appear.
- Polls, multiple-choice voting, or surveys.
- Complex analytics, exports, archives, or multi-room sessions.
- Strong anti-spam or identity enforcement.

## Recommended Approach

Use Next.js on Vercel with Supabase Postgres and Supabase Realtime.

This stack fits the deployment target, keeps the app small, and avoids running a custom WebSocket server. Supabase stores events, questions, and votes. Attendee and presenter pages subscribe to realtime changes for the active event.

## Routes And Views

### Attendee View: `/{eventSlug}`

The attendee page is the primary phone experience. It shows the event banner, the question submission form, the Anonymous/Name choice, and the live question list.

Attendees can:

- Submit a question if the event is open.
- Choose Anonymous or enter a display name.
- Read questions already submitted.
- Upvote each question once per browser/device.

Questions appear immediately after submission. The list ranks questions by vote count first and recency second. New questions should remain easy to notice, even if they have no votes yet.

### Presenter View: `/{eventSlug}/present`

The presenter page is a clean big-screen display. It shows top questions with large type, strong contrast, and minimal interface chrome.

The presenter view uses the same event background style as the attendee page, but crops it for a 16:9 stage display. Text overlays stay inside a safe center area so they remain readable on projectors and livestream layouts.

### Admin View: `/accadmin`

The admin page stays unprotected in v1, by request. It should not be linked from attendee-facing screens.

Admins can:

- Create an event with title, slug, optional subtitle, and background image URL.
- Edit event details.
- Open or close an event.
- Copy attendee and presenter links.
- Delete bad or duplicate questions.
- See simple counts for questions and votes.

## Visual Design

Use the selected direction: Clean App + Branded Banner.

The UI should feel modern, youthful, and church-event ready, but the question feed must stay readable. The app should use a light, clean attendee surface with a branded top banner, restrained cards, strong typography, and clear vote controls.

The event background should come from a 16:9 source asset, ideally `1920x1080`. Designers should keep important text, faces, logos, and focal artwork inside the center 60% width and center 70% height. The app will crop this same image into:

- A mobile event banner.
- A desktop event header.
- A presenter display backdrop.

Avoid placing essential text near the edges of the background because phone and presenter crops will differ.

## Data Model

### `events`

- `id`
- `slug`
- `title`
- `subtitle`
- `background_image_url`
- `is_open`
- `created_at`
- `updated_at`

### `questions`

- `id`
- `event_id`
- `body`
- `author_name`
- `is_anonymous`
- `vote_count`
- `created_at`
- `deleted_at`

`author_name` is optional. If `is_anonymous` is true, the UI shows Anonymous regardless of `author_name`.

### `question_votes`

- `id`
- `question_id`
- `event_id`
- `voter_id`
- `created_at`

`voter_id` is a generated browser/device id stored locally. This enforces one vote per question per browser for a trusted event. It is not meant to prove real identity.

## Data Flow

When an attendee opens `/{eventSlug}`, the app loads the event record. If the slug does not exist, it shows an Event Not Found screen. If the event exists but is closed, it shows the event branding and a closed-state message.

When an attendee submits a question, the app validates the body, stores the question, and returns the created row. Supabase Realtime pushes the insert to all open attendee and presenter pages.

When an attendee upvotes a question, the app records a row in `question_votes` for that `voter_id` and question. It increments `vote_count` on the question. Supabase Realtime pushes the updated question count to all clients.

When an admin deletes a question, the app soft-deletes it with `deleted_at`. Realtime updates remove it from attendee and presenter lists.

## Realtime Behavior

Attendee and presenter pages subscribe to changes for the active event. They react to:

- New questions.
- Vote count changes.
- Deleted questions.
- Event open/closed changes.

If realtime disconnects, the page keeps the current questions visible and retries the subscription. A periodic refresh can serve as a fallback so the event keeps working if realtime has a temporary issue.

## Validation And Limits

- Question body is required.
- Question body is limited to `280` characters.
- Display name is optional and short.
- Slugs should be lowercase URL-safe strings.
- Closed events block new questions and votes.
- Deleted questions do not appear in public or presenter lists.

## Error Handling

- Missing event: show a polished Event Not Found screen.
- Closed event: show the event banner and closed message.
- Failed submit: show an inline error near the form and let the attendee retry.
- Failed upvote: leave the UI stable and show a small retry/error state.
- Missing Supabase configuration: fail clearly during setup or startup.
- Realtime disconnect: retry quietly and fall back to refresh if needed.

## Testing Plan

Test the core behavior first:

- Create an event from `/accadmin`.
- Open and close an event.
- Submit Anonymous and named questions.
- Upvote each question once per browser/device.
- Prevent repeat upvotes from the same browser/device.
- Delete a question from admin and confirm it disappears from attendee and presenter views.
- Confirm realtime updates across two browser windows.
- Verify mobile attendee layout, desktop attendee layout, and 16:9 presenter layout.

## Fixed V1 Decisions

- Question body limit is `280` characters.
- Supabase schema starts with the `events`, `questions`, and `question_votes` tables listed above.
- Background image input is a URL in v1. File upload is outside the first implementation.
