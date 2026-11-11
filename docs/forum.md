# Cube Forum

Current setup and handover guide, 9 November 2026. The forum uses the real portal API and PostgreSQL, not a localStorage mock. Development and PRs belong only to `umrtkyrk/iceberg-x-os`, with `forum-mvp` as the integration branch. No upstream operation or deployment is included.

## Local setup

Install the backend/frontend dependencies. Set `DATABASE_URL` and `DIRECT_URL` to the same **local** PostgreSQL database and schema in `backend/.env`; set `JWT_SECRET` through the normal portal setup. Do not commit environment files. Generate the client:

```sh
npm ci --prefix backend
npm ci --prefix frontend
npx --prefix backend prisma generate --schema backend/prisma/schema.prisma
```

Choose the database path that matches your environment, with local dev servers stopped:

| Target | Command from repository root |
|---|---|
| An empty local schema, with no tables, types or functions | `npm run db:forum:init --prefix backend` |
| An existing portal with Prisma migration history | `npm run db:forum:plan --prefix backend`, then `npm run db:forum:migrate --prefix backend` |

The commands accept only localhost PostgreSQL targets, reject `NODE_ENV=production`, and require both URLs to point to the same database/schema. Initialization refuses any non-empty schema. Missing migration history, a failed migration, history from a different checkout, or pending portal migrations stops the upgrade for review. `plan` is read only. The commands never reset a database or run `db push`.

Enable both flags:

```dotenv
# backend/.env
FORUM_ENABLED=true
# frontend/.env.local
VITE_CUBE_FORUM_ENABLED=true
```

Both default to off. Restart the backend after changing its flag; restart Vite or rebuild the frontend after changing its build-time flag. Start the normal dev scripts and open `/forum` under Community. Database initialization creates seven default communities, but no accounts, badges, topics or replies. Use local test accounts provided through the portal's existing account/invitation workflow; the broad portal seed is not run automatically.

## Migration history and data preservation

Historical migration files remain unchanged. The older portal chain tries to alter `Quest` before creating it, so replaying it on an empty database is not a supported fresh-install path for this fork. `db:forum:init` instead generates additive SQL from the current Prisma schema, applies it only to an empty local schema, and records the historical migrations with Prisma's `migrate resolve --applied`. Those old SQL files are **baselined, not replayed**. The new `20261109180000_forum_default_categories` migration seeds English defaults only when the forum has no communities, with `ON CONFLICT (id) DO NOTHING`. It does not recreate communities an Admin removed from an existing forum.

For existing migrated portals, the upgrade allows only the known forum migrations. Two inherited files (`20261029120000_english_forum_categories` and `20261106120000_english_ideas_category`) only rename category data. If pending, the installer checks their reviewed content hashes and records them as applied **without executing their UPDATEs**. Other pending forum migrations run through `prisma migrate deploy`. Already-applied renames cannot be undone without knowing the original values; the installer does not attempt to guess or restore them.

Existing category names, descriptions and positions stay intact. Older installations can therefore retain their Turkish names; Admins can deliberately edit them through **Manage communities**. On an older portal receiving the original forum migration for the first time, that migration supplies its historical category labels; subsequent setup does not rename them. New empty-baseline installations start with English labels.

Use these guarded commands for local fork setup rather than raw `prisma migrate deploy`/`migrate dev` against an unreviewed database. The history still contains the old data-changing SQL; running it directly bypasses the preservation policy. Production rollout and reconciliation of an independently modified database require a separate owner-reviewed plan, outside this fork task.

Keep a local backup before upgrading. If a CLI/database failure interrupts baselining, inspect the local schema and `_prisma_migrations` state before retrying; initialization will refuse the partially created, non-empty schema. No automatic deletion or reset is attempted. Future migration names not covered by this procedure require review before extending it.

## Identity, permissions and profile

| Account | Forum access |
|---|---|
| Active Cube, Senior Cube, candidate or Iceberger | Read, post, reply; edit/withdraw own content; follow/save/report |
| Alumni, Former Cube, or Cube account without a profile | Read-only posting access; own preferences, follows/saves and withdrawal remain available |
| Mentor | Post in Announcements; pin/lock/move/remove content; review reports |
| Admin | Mentor permissions plus community management |

Progression does not grant moderation rights. Staff without a Cube profile still work. Nobody can rewrite another author's words. Posts show a public avatar/name, Cube number/profile link when available, progression, Founding status, the author's selected badges and signature. Private contact, NDA, feedback and Radar fields are not part of that author projection.

In **Forum profile**, select up to three of your earned badges, arrange their order and save a plain-text signature of at most 140 characters. The backend rejects foreign, duplicate and fourth badges; revoked badges disappear from the showcase.

## Topics, notifications and moderation

- Create a topic with a title of up to 160 characters and Markdown body up to 10,000; replies allow 5,000. Quest/mission links use accessible portal records and do not advance progress or award points.
- Replies are chronological, 20 per page. Authors can edit or soft-delete their own content; edits show a marker. Search matches title/body/reply text; category, quest, mission and feed filters work together. New/unread state persists per account.
- Use **Add emoji** in the topic/reply editor to insert an emoji at the cursor or replace selected text. The picker also works when editing a post, supports keyboard navigation and Escape, and preserves mentions/attachments. Emoji use the existing message length limit; an oversized edit is rejected without shortening the draft.
- Authors automatically follow their topics. Replies notify the owner/followers; `@` search inserts stable Cube/staff mention handles. Recipients are deduplicated, excluding self and exited Cubes. Code and quoted text do not send mentions. Up to ten distinct handles are processed; edits do not resend notifications.
- The portal bell/history links to the exact topic/reply; the server resolves its current page. Manual pagination releases that notification target. Saved/following lists belong to the signed-in user.
- Report another author's topic/reply with a reason. Mentor/Admin opens **Moderation**, follows the target, removes content if appropriate and marks the report reviewed. Deleting content resolves its open reports. Reports are not public.
- In a thread, staff can pin/unpin, lock/unlock, move or remove content. Locked topics reject new replies and edits. Admins manage communities; Announcements remains staff-only and communities with topic history cannot be deleted.

## Images and other extras

The merged real-api design includes **image upload/paste** and **accepted answers** beyond the original mission's minimum scope. They are existing features, not a requirement to earn Radar/MVCubes points.

The editor accepts PNG/JPEG/WEBP/GIF up to 5 MB, one file per upload. The server checks file signatures, uses random filenames and adds `nosniff`/sandbox headers. Only portal-hosted `/uploads/forum/...` images render in forum Markdown; external images and raw HTML are not rendered. Only accounts with posting permission can upload. General writes are limited to 20/minute/account and uploads additionally to 30/hour/account, in process memory.

Uploaded files are publicly served at their random URLs, like portal avatars. Soft-deleting a post does not delete its image files; the feature flag hides the UI/API rather than revoking already-uploaded static URLs. Forum uploads are for discussion images, not confidential portal documents. Persistence/retention of the storage volume is part of any later deployment plan.

Topic authors can accept one answer in Tech Support. Moving the topic out of Tech Support clears the accepted marker and keeps the replies. Topics and replies support likes with grouped author notifications; removing a like updates the unread summary. Reading a notification preserves its history, and a later like starts a new unread notification. Other emoji reactions, email digests, reputation and score changes are not implemented.

## API and data model

Every `/api/forum` endpoint requires portal authentication and the backend flag. Client faults use `HttpError`; handlers use `sendError`, so raw Prisma exceptions are not sent to clients.

| API under `/api/forum` | Purpose |
|---|---|
| `GET /categories`, `GET /stats` | Community counts/activity and board statistics |
| `GET /topics`, `GET /topics/:id` | Filter/search/page topics; paginated replies and optional `reply` target |
| `POST /topics`, `PATCH/DELETE /topics/:id` | Create, owner edit, soft-delete |
| `POST /topics/:id/replies`, `PATCH/DELETE /topics/:id/replies/:replyId` | Replies and ownership checks |
| `PUT /topics/:id/state` | Follow/save state |
| `GET/PUT /me/profile` | Ordered earned badges and signature |
| `GET /context`, `GET /mentions?q=...` | Accessible portal context and mention search |
| `POST /topics/:id/reports` | Report a topic or reply |
| `GET /reports`, `PATCH /reports/:id` | Staff report review |
| `PATCH /topics/:id/moderation` | Staff pin/lock/move |
| `POST /categories`, `PATCH/DELETE /categories/:id` | Admin community management |
| `POST /images` | Authenticated multipart image upload |
| `PUT /topics/:id/answer` | Owner accepts/clears an answer |

Tables: `ForumCategory`, `ForumTopic`, `ForumReply`, `ForumTopicState` (read/follow/save), `ForumReport`, `ForumProfile` (signature/ordered badge IDs), `ForumTopicContext` (quest/mission/edit marker), and `ForumNotificationTarget` (existing notification to exact content). Existing portal tables supply identity, earned badges and notifications. Relations/activity columns are indexed. Account deletion preserves forum history with nullable authors.

## Validation and delivery

```sh
npm run build --prefix backend
npm test --prefix backend
npm run test:forum --prefix backend
npm run test:forum:flag --prefix backend
npm run test:forum:db --prefix backend
npm run test:forum:migrations --prefix backend
npm run check:forum --prefix frontend
npm run test:forum --prefix frontend
npm run build --prefix frontend
```

Both database suites require localhost and create/delete only random disposable schemas. The service suite verifies forum SQL/features; the migration suite additionally runs the real installer against an empty schema and an older forum, verifies no schema drift, preserves existing records, checks idempotency and refuses unsafe targets. It does not claim to replay the broken historical portal chain.

The [Demo Day runbook](forum-demo.md) provides a 2:50 live demonstration and final acceptance checklist. A prepared runbook is not a recorded video or evidence that a live presentation has occurred. Footer [PR #6](https://github.com/umrtkyrk/iceberg-x-os/pull/6) and handover [PR #7](https://github.com/umrtkyrk/iceberg-x-os/pull/7) are merged into `forum-mvp`; the full checks passed on combined revision `2d07051` on 11 November 2026. Fork releases use a separate PR into the same repository's `main`. See [branch roles and design archives](repository-branches.md); no upstream deployment is authorized.
