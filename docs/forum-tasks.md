# Cube Forum MVP: Task List

Team: Mesut Umur Tokyürek (`umrtkyrk`) and Medine Kaynak (`u230709007`).
Work happens in the fork `umrtkyrk/iceberg-x-os`, integration branch `forum-mvp`
(see [`forum-team-workflow.md`](forum-team-workflow.md) and [`WORKFLOW.md`](WORKFLOW.md)).

Status as of 2026-10-22.

---

## Where we are

**Done (merged into `forum-mvp`, PR #2 on the fork)**

- The `mock-forum` design was moved into the portal at `/forum`, under **Community → Forum**.
- It's hidden behind the frontend-only flag `VITE_CUBE_FORUM_PREVIEW=true`.
- The viewer's identity, avatar, level and **earned** badges come from the real portal session and profile API.
- Topics, replies, follows, reports, signature and showcase are **demo only**. They live in `demo-data.js` +
  `localStorage` and are never sent to the server.
- Forum CSS is scoped under `.cube-forum`. Checks: `npm run test:forum`, `npm run check:forum`.

**Not started**

- Forum data model and migration, the real API, a server-side feature flag, soft-delete, server-side
  permissions, rate limits, notifications, the report queue and moderation, and backend tests.

**MVP scope:** topics and replies, categories, Markdown, soft-delete, an ordered showcase of 3 earned badges,
a signature, follow, @mention and reply notifications, reports and moderation, a quest tag, and an
off-topic ("Küpün dışı") area.

**Out of scope:** likes/reactions, image uploads, email digests, Radar/MVCubes scoring.

Size: **S** = under half a day · **M** = 1–2 days · **L** = split before starting.
Owner is a suggestion, so change it freely.

---

## Phase 0: Setup and decisions (do first, together)

| # | Task | Owner | Size |
|---|---|---|---|
| 0.1 | Medine accepts the GitHub collaborator invite on the fork, clones it, and sets up remotes as in `forum-team-workflow.md` | Medine | S |
| 0.2 | Protect `forum-mvp` on the fork: PR required, 1 approval, no force-push | Mesut (repo owner) | S |
| 0.3 | Create GitHub Issues for every task below and a Project board on the fork | Both | S |
| 0.4 | **Clean-database migration bug:** `20260813000000_add_quest_min_sample_size` alters `Quest` before `20260813110832_add_quests_and_streaks` creates it, so `prisma migrate dev` fails on an empty DB. Upstream migrations must **not** be edited. Find and document a local workaround (e.g. restore a schema dump, or apply in a fixed order and then `prisma migrate resolve`) so both of us get the same local DB | Medine | S–M |
| 0.5 | Settle the **open decisions** at the bottom of this file | Both | S |

---

## Phase 1: Backend foundation

> Only **one** migration is in flight at a time (WORKFLOW §6). Phase 1.1 is one PR and blocks most other work.

| # | Task | Owner | Size | Depends on |
|---|---|---|---|---|
| 1.1 | **Additive data model + migration.** New tables only: `ForumCategory` (seeded with the 5 categories: announcements, help, showcase, ideas, lounge), `ForumTopic` (title, Markdown body, category, author, optional `quest_id`, `is_pinned`, `is_locked`, `last_activity_at`, `deleted_at`, `deleted_by_id`), `ForumReply` (topic, author, body, `deleted_at`, `deleted_by_id`), `ForumFollow` (user + topic), `ForumSavedTopic`, `ForumReport` (target type/id, reason, status, reviewer, `resolved_at`), `ForumProfile` (signature ≤ 140 chars, ordered showcase badge IDs, max 3). Indexes on every relation column and on `(category_id, last_activity_at)` | Medine | M | 0.4, 0.5 |
| 1.2 | **Server feature flag** `FORUM_ENABLED` in `config/env.ts`. When it's off, the `/api/forum` router isn't mounted (404) | Mesut | S | — |
| 1.3 | **Per-user rate limits** for creating topics, replies and reports. DB-backed like the peer-feedback limits, not the in-memory IP limiter | Mesut | S | 1.1 |
| 1.4 | Shared **permission helpers:** read/post rules per role and status, ownership checks, locked-topic check, "announcements = ADMIN/MENTOR only" | Medine | S | 1.1 |

## Phase 2: Topics and replies (core vertical)

| # | Task | Owner | Size | Depends on |
|---|---|---|---|---|
| 2.1 | `GET /forum/categories`, `GET /forum/topics` (filter by category, quest, search; cursor pagination; pinned first) | Medine | M | 1.1, 1.4 |
| 2.2 | `GET /forum/topics/:id` with paginated replies. Soft-deleted items show as "[deleted]" to normal users and in full to moderators | Medine | S | 2.1 |
| 2.3 | `POST/PATCH/DELETE /forum/topics` and `/forum/topics/:id/replies`. Owner-only edits, soft-delete, length limits, Markdown stored raw, all errors via `sendError` | Medine | M | 2.2, 1.3 |
| 2.4 | Backend tests for 2.1–2.3, following the `backend/tests/*.test.ts` pattern: permissions, soft-delete visibility, announcements rule, locked topics | Medine | M | 2.3 |
| 2.5 | Frontend: a typed forum API client (`frontend/src/pages/forum/forumApi.ts`) | Mesut | S | 2.1 |
| 2.6 | Frontend: replace `demo-data.js` / `localStorage` with the API for the feed, search, quest filter, topic page, compose, edit and delete. Include loading, empty and error states | Mesut | M | 2.5, 2.3 |

## Phase 3: Profile showcase and signature

| # | Task | Owner | Size | Depends on |
|---|---|---|---|---|
| 3.1 | `GET/PUT /forum/me/profile`. Server checks that every badge ID is one the user actually earned (`CubeBadge`), max 3, order kept; signature is plain text, ≤ 140 chars | Mesut | S | 1.1 |
| 3.2 | Topic and reply payloads include the author's showcase + signature (one query, no N+1) | Mesut | S | 3.1, 2.2 |
| 3.3 | Frontend: wire the showcase/signature settings to 3.1 and drop the `cube-forum-preview-v2:*` localStorage keys | Mesut | S | 3.1 |
| 3.4 | Tests for 3.1: can't showcase badges you don't have, more than 3 is rejected | Mesut | S | 3.1 |

## Phase 4: Follow, save, mentions and notifications

| # | Task | Owner | Size | Depends on |
|---|---|---|---|---|
| 4.1 | Follow/unfollow and save/unsave endpoints. Authors automatically follow their own topic | Mesut | S | 1.1 |
| 4.2 | Notifications through the existing `notification.service`: a reply to my topic, a reply in a topic I follow, an @mention. Never notify yourself, one notification per event per person, and offboarded users get nothing | Mesut | M | 4.1, 2.3 |
| 4.3 | @mention parsing: resolve the handle (see decision D4) to a user on the server, ignore unknown handles, cap mentions per post | Mesut | S | 4.2 |
| 4.4 | Clicking a notification opens the topic (needs decision D5) | Mesut | S | 4.2 |
| 4.5 | Frontend: real follow/save state, a "Saved" list, mention autocomplete (optional) | Mesut | S | 4.1 |
| 4.6 | Tests for 4.1–4.3 | Mesut | S | 4.3 |

## Phase 5: Reports and moderation

| # | Task | Owner | Size | Depends on |
|---|---|---|---|---|
| 5.1 | `POST /forum/reports`: one open report per user per target, with a reason | Medine | S | 1.1, 1.3 |
| 5.2 | Moderator API (`isMentorOrAdmin`): list the report queue, dismiss, soft-delete the reported content, lock/unlock a topic, pin/unpin. Record who did it and when | Medine | M | 5.1 |
| 5.3 | Frontend: connect the existing report form to 5.1, plus a **moderation queue** page for staff | Medine | M | 5.2 |
| 5.4 | Tests: a Cube can't moderate, a duplicate report is rejected, a locked topic rejects replies | Medine | S | 5.2 |

## Phase 6: Hardening and release on the fork

| # | Task | Owner | Size |
|---|---|---|---|
| 6.1 | Security pass: XSS through Markdown (no images, links safe), IDOR on every `:id`, deleted content never leaking to non-moderators, no raw Prisma errors | Both (cross-review) | S |
| 6.2 | Decide whether the frontend flag stays or the frontend reads the server flag (`GET /forum/config`) | Both | S |
| 6.3 | Gradually convert `ForumPreview.jsx` to TypeScript (optional but reduces bugs) | Mesut | M |
| 6.4 | Mobile and keyboard pass on all forum screens | Mesut | S |
| 6.5 | Replace `forum-design-preview.md` with a real `docs/forum.md` covering API, data model, flags and moderation | Medine | S |
| 6.6 | Full check: backend `npm run build && npm test`; frontend `npm run build`, `test:forum`, `check:forum` | Both | S |
| 6.7 | Merge `forum-mvp` → the fork's `main`. Proposing this upstream is a **separate, later decision**; nothing is pushed upstream | Both | S |

---

## Open decisions (Phase 0.5)

| # | Question | Options / note |
|---|---|---|
| D1 | Forum UI language | The preview is **Turkish**; the rest of the portal is **English**. Pick one. If English, "Cube" terminology rules apply |
| D2 | Can offboarded users (`Alumni`, `Former_Cube`) read or post? | Suggestion: read-only, no notifications |
| D3 | Editing: is there a time window? Do we keep edit history? | Suggestion: no window, show an "edited" marker, no history in the MVP |
| D4 | @mention handle | The preview uses `cube-<number>`. Staff have no cube number, so we need a stable handle for every user |
| D5 | How a notification links to its topic | `Notification` only has `message`. Options: add a nullable `link` column (additive migration) or put the path into the message |
| D6 | Who moderates | Suggestion: ADMIN + MENTOR |
| D7 | Replies: flat or nested? | The preview is flat with pagination. Suggestion: flat |
| D8 | Quest tag | Link to the real `Quest` table (`quest_id`) instead of the demo quests |
| D9 | Search | Postgres `ILIKE` for the MVP; full-text search later if needed |

---

## Suggested order

```
0.1–0.5 ──► 1.1 (schema, Medine) ──┬─► 2.x topics/replies (Medine API, Mesut UI)
1.2, 2.5 prep (Mesut) ─────────────┤
                                   ├─► 3.x showcase/signature (Mesut)
                                   ├─► 4.x follow/notifications (Mesut)
                                   └─► 5.x reports/moderation (Medine)
                                                    └─► 6.x hardening → forum-mvp → fork main
```

While 1.1 is in review, Mesut works on 1.2 and 2.5 so nobody waits.
