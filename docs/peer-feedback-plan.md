# Peer Feedback, Radar & MVCubes: Implementation Plan

Status: draft for review. Nothing in this document has been implemented yet.

All user-facing copy in this feature is **English** and uses the term **Cube**.

---

## 1. What exists today (findings)

| Area | Current state |
|---|---|
| Overall score | Computed **in the browser**, `frontend/src/pages/Profile.tsx` (~L499-525): mean of scorecard % (`MentorFeedback`, 9 criteria /5) and private-note % (`PrivateNote.score` /10). No backend source of truth. |
| Public profile | `GET /cubes/public/:identifier` has **no auth** (served at `/x/:cubeNumber`). Anything added there is visible to the open internet. |
| Badges | `Badge` + `CubeBadge`, rarity enum `Common/Rare/Epic`, styles in `frontend/src/utils/badgeRarity.ts` (`RARITY_META`, `compareByRarity`). `CubeBadge.awarded_by_id` is required (a User). |
| Rate limiting | `rateLimit.middleware.ts` is per-IP, in-memory, fixed window. Not usable for per-user weekly budgets. |
| Notifications | `createSingleNotification(userId, message)`, best-effort. |
| Guards | `requireAuth`, `isAdmin`, `isMentorOrAdmin`, `isCube`; frontend `RouteGuard allowedRoles`. |
| Errors | `HttpError` helpers + `sendError(res, error)` in `utils/http.ts`. |
| Quests | `quest.service.ts` recalculates on write, fire-and-forget. Criteria types are string-based. |
| Migrations | 29 SQL migrations; production holds real data (see section 8). |

Consequence: "centralising the score" means **moving the formula to a backend `score.service.ts`** and having `Profile.tsx` read the result, not adding another client-side term.

---

## 2. Product rules (decided)

1. **Feedback types**: `KUDOS`, `OBSERVATION` ("I couldn't see their contribution"), `CONCERN` ("they are not contributing to this mission"). Anyone can give any type about anyone at any time. Context weight differs (section 4).
2. **Tags required, note optional.** Concerns also require a context.
3. **Raw data never leaves the server.** No role (including ADMIN) gets giver identity. Mentors/Admins see aggregates only.
4. **Recipient sees kudos text, anonymously** (no giver, no date, no context). Kudos can be pinned to their profile, max 3.
5. **Concern/observation text never reaches the recipient.** The recipient sees only that a *verified* growth signal exists, with a broad category. A mentor turns it into a constructive conversation.
6. **Peer contribution is at most 20 percent** of the overall score (a constant in `config/peer.ts`). It is scaled by confidence, so with little or no peer data it is effectively zero. No feature flags; the code ships live and we observe.
7. **No data means no effect.** A Cube with no/low peer signal keeps exactly today's score. Peer signal can never create a score for someone with no scorecards.
8. **No bottom ranking anywhere.** Only top tier and the Cube's own trend.
9. **Rarity tiers**: Common / Rare / Epic. Legendary is deferred (section 8).

---

## 3. Data model (all NEW tables, additive)

Apart from one additive column on `Quest` (`auto_assign`, section 6b), no existing table, column, enum or row is modified. Prisma back-relation fields on existing models are schema-only and produce no SQL.

```prisma
enum PeerFeedbackKind   { KUDOS OBSERVATION CONCERN }
enum PeerFeedbackStatus { ACTIVE DISMISSED }            // DISMISSED = mentor judged it unfounded
enum PeerContextType    { MISSION MEETING TEAM OTHER }
enum PeerSignalState    { OPEN IN_CONVERSATION RESOLVED }

model PeerFeedback {
  id            String             @id @default(uuid())
  /// HMAC-SHA256(PEER_PSEUDONYM_SECRET, giver user id). Deliberately NOT a
  /// foreign key: nothing can join this table back to a User through the schema.
  giver_hash    String
  receiver_id   String             // CubeProfile.id
  receiver      CubeProfile        @relation("PeerFeedbackReceived", fields: [receiver_id], references: [id], onDelete: Cascade)
  kind          PeerFeedbackKind
  tags          String[]           // from a fixed server-side catalogue
  note          String?            @db.Text
  context_type  PeerContextType    @default(OTHER)
  context_id    String?            // mission/meeting/team id when applicable
  weight        Float              @default(1)  // context weight, frozen at write time
  status        PeerFeedbackStatus @default(ACTIVE)
  delivered_at  DateTime?          // kudos: set by the weekly digest, null until then
  is_pinned     Boolean            @default(false)
  pinned_at     DateTime?
  was_quiet     Boolean            @default(false) // receiver had < 3 distinct givers when written (quest: peer_quiet_kudos)
  helpful_at    DateTime?          // set by the receiver (quest: peer_helpful_feedback)
  created_at    DateTime           @default(now())

  @@index([receiver_id, kind, created_at])
  @@index([giver_hash, created_at])
  @@index([receiver_id, is_pinned])
}

/// Cached aggregate per Cube. Recomputed on write; the only thing mentors read.
model PeerSignal {
  id                String   @id @default(uuid())
  cube_id           String   @unique
  cube              CubeProfile @relation("PeerSignalCube", fields: [cube_id], references: [id], onDelete: Cascade)
  kudos_score       Float    @default(0)   // weighted, normalised, shrunk
  concern_score     Float    @default(0)   // verified concerns only
  distinct_givers   Int      @default(0)
  distinct_contexts Int      @default(0)
  tag_counts        Json     @default("{}")
  visibility_gap    Float    @default(0)   // peer positive vs mentor visibility (Hidden Gems)
  updated_at        DateTime @updatedAt
}

/// A verified growth signal awaiting / undergoing a mentor conversation.
model PeerGrowthSignal {
  id           String          @id @default(uuid())
  cube_id      String
  cube         CubeProfile     @relation("PeerGrowthCube", fields: [cube_id], references: [id], onDelete: Cascade)
  category     String          // broad: Communication | Contribution | Reliability | Collaboration
  state        PeerSignalState @default(OPEN)
  due_at       DateTime        // mentor SLA
  handled_by_id String?
  handled_at   DateTime?
  created_at   DateTime        @default(now())
  @@index([cube_id, state])
}

/// Peer-earned title (tier upgrades in place; never demoted).
model PeerTitle {
  id        String      @id @default(uuid())
  cube_id   String
  cube      CubeProfile @relation("PeerTitleCube", fields: [cube_id], references: [id], onDelete: Cascade)
  category  String      // UNBLOCKER | DEEP_DIVER | TEAM_GLUE | RISING_STAR ...
  rarity    BadgeRarity // reuses the existing enum, no change to it
  earned_at DateTime    @default(now())
  upgraded_at DateTime?
  @@unique([cube_id, category])   // safe: brand-new table
}

/// Monthly category winners shown on the MVCubes shelf.
model MvcubesAward {
  id        String      @id @default(uuid())
  period    String      // "2026-10"
  category  String
  cube_id   String
  cube      CubeProfile @relation("MvcubesCube", fields: [cube_id], references: [id], onDelete: Cascade)
  note      String?
  @@unique([period, category, cube_id])
  @@index([period])
}

/// Per-reviewer reliability weight used by the anti-abuse pass.
model PeerReviewerStat {
  giver_hash   String   @id
  reliability  Float    @default(1)
  given_total  Int      @default(0)
  dismissed    Int      @default(0)
  confirmed    Int      @default(0)
  updated_at   DateTime @updatedAt
}
```

Notes:
- `PeerFeedback` has **no FK to the giver**, by design. Rate limits and "my feedback" are served by computing the caller's hash.
- `PeerTitle` does not reuse `CubeBadge` (requires an `awarded_by_id`, has no unique constraint, and has an existing duplicate-award rule). It borrows only `RARITY_META` for presentation.
- Unique constraints exist only on the new tables.

---

## 4. Backend

New files, mounted in `routes/index.ts` (after `testimonials`, no path collisions):

```
backend/src/config/peer.ts              // tag catalogue, weights, thresholds, flag readers
backend/src/services/peer.service.ts    // write path, hashing, budgets, aggregation
backend/src/services/peerAbuse.service.ts // normalisation, rings, rival discount, corroboration
backend/src/services/score.service.ts   // single source of truth for overall score
backend/src/routes/peerFeedback.routes.ts
backend/src/routes/radar.routes.ts      // Hidden Gems / Needs Attention
backend/src/routes/mvcubes.routes.ts
```

### Endpoints

| Method + path | Who | Purpose |
|---|---|---|
| `POST /peer-feedback` | any authed Cube/Mentor | create KUDOS / OBSERVATION / CONCERN |
| `GET /peer-feedback/budget` | authed | remaining weekly kudos + cooldown info |
| `GET /peer-feedback/received` | the Cube | delivered kudos texts (anonymous) |
| `GET /peer-feedback/given` | authed | the caller's own history |
| `POST /peer-feedback/:id/pin` / `DELETE` | receiver | pin / unpin (max 3) |
| `GET /cubes/:id/peer-summary` | self (full), others (titles + pins only) | titles, tag distribution, trend, growth indicator (self only) |
| `GET /radar/hidden-gems` | `isMentorOrAdmin` | aggregates only |
| `GET /radar/needs-attention` | `isMentorOrAdmin` | aggregates only |
| `POST /radar/signals/:id/state` | `isMentorOrAdmin` | OPEN -> IN_CONVERSATION -> RESOLVED, with dismissed/confirmed outcome |
| `GET /mvcubes?period=` | authed | category winners, top tier only |
| `POST /mvcubes/compute` | `isAdmin` | compute a period (idempotent) |

All handlers follow the Rule 1 pattern (`try/catch` -> `sendError`, `badRequest()` for client faults). Active-status check via `assertCubesAreActive` is **not** applied to receivers (feedback about Alumni is meaningless but harmless); givers must be in-programme Cubes or staff.

### Context weight (frozen on write)

| Relationship giver -> receiver | weight |
|---|---|
| Share an active `MissionContributor` / `MissionTeamMember` row | 1.0 |
| Both invited to / attended the same completed `Meeting` | 0.5 |
| No shared context | 0.2 (KUDOS/OBSERVATION only; CONCERN allowed but never counts toward score) |

### Rate limits (DB-backed, per user, not per IP)

- KUDOS: 5 per rolling 7 days (tunable).
- CONCERN / OBSERVATION: 1 per target per 14 days, 3 per day overall.
- Self-feedback rejected. Duplicate same-kind/same-target inside cooldown rejected with a clear message.

### Anti-abuse (peerAbuse.service)

1. **Corroboration gate**: a CONCERN affects score / creates a `PeerGrowthSignal` only with >= 3 independent givers (weighted) **or** mentor confirmation. A single concern only increments the mentor aggregate.
2. **Reviewer normalisation**: each giver's total weight per period is scaled so one prolific giver cannot dominate.
3. **Rival discount**: givers who sit adjacent to the receiver in the same MVCubes category get concern weight x 0.5.
4. **Reciprocity**: A concerns B and B concerns A within 7 days -> both flagged, excluded from score, surfaced to mentors as "mutual".
5. **Kudos rings**: dense mutual-kudos cliques have weights reduced.
6. **Reviewer reliability**: `PeerReviewerStat.reliability` goes down when mentors dismiss a giver's concerns as unfounded and up when confirmed; it multiplies their future weight.
7. **k-anonymity**: no aggregate (even to mentors) below 3 distinct givers.
8. **Shrinkage**: with little data the signal collapses to neutral.

### Score service

```
base      = same formula as today (scorecard % and private-notes %, averaged when both exist)
signal s  in [-1, 1]  from PeerSignal (kudos minus verified concerns, shrunk)
peerPct   = s >= 0 ? base + s * (100 - base) : base + s * base
w         = PEER_SCORE_CAP (0.20) * confidence(distinct_givers, distinct_contexts)
overall   = (1 - w) * base + w * peerPct
```

- No scorecards and no private scores -> `overall = null` (N/A), regardless of peers.
- No / insufficient peer data -> `w = 0`, so `overall === base`, identical to today.
- The API returns the breakdown so the UI can explain the number.
- `Profile.tsx` replaces its local `combinedPercentage` with the server value; the sub-averages stay for display.

### Pseudonym secret

`PEER_PSEUDONYM_SECRET` is the one new env var (set once, not a toggle). It is **optional at boot**: if missing, the service falls back to a key derived from `JWT_SECRET` (domain-separated HMAC) and logs a warning, so the app never fails to start. Setting the dedicated secret is recommended so a future `JWT_SECRET` rotation does not invalidate peer hashes (rate-limit history, "my feedback", reviewer stats). There are no feature flags.

### Delivery

- Kudos become visible to the receiver in a **weekly digest** (`delivered_at` set in batch). Timestamps and context are never returned.
- Growth indicator appears only after the corroboration gate, delivered in the same digest, with a broad category only. A mentor task (`due_at` = +7 days) is created automatically and a notification sent to the assigned mentor.

---

## 5. Frontend

All strings in English. Visuals reuse `RARITY_META`; Epic items get the animated frame, so the peer shelf looks like the rest of the badge system rather than a bolt-on.

| Surface | Change |
|---|---|
| Global "Give feedback" entry | Button on Directory cards and Profile; opens the composer (modal). |
| `components/PeerFeedbackComposer.tsx` | Type picker, tag chips, optional note, context picker, guidance panel (copy below), live budget. |
| `pages/Profile.tsx` | New "Peer Recognition" section: title shelf, pinned quotes (max 3), tag distribution. Private "My Feedback" tab: received kudos, trend, growth indicator. Overall score reads server value. |
| `pages/PublicProfile.tsx` | Titles only (rarity, category). Pinned quotes are **not** shown on the unauthenticated page unless the owner opts in per pin (see open decisions). |
| `pages/Radar.tsx` (`/radar`, ADMIN+MENTOR) | Two tabs: **Hidden Gems** and **Needs Attention**. Aggregate cards only: tag counts, distinct givers, trend, state controls. |
| `pages/Dashboard` / new MVCubes section | Monthly category winners, top tier only; each Cube's own trend ("+18% vs last month"). |
| `Layout.tsx` | "Radar" nav item for staff; MVCubes link. |
| `utils/peerCatalog.ts` | Mirrors the backend tag catalogue and category metadata. |

### Composer guidance copy (English, draft)

Header: **"Give feedback to a fellow Cube"**

Always-visible box, "Before you send":
- **You are anonymous.** The person never sees who wrote this, and neither do mentors or admins. Aggregates only.
- **Be specific and observable.** Describe what you saw ("shared a clear plan for the demo"), not what you think of the person.
- **Kudos text is shown to the person** and they may pin it to their profile. Do not include details only you would know.
- **Concerns are never shown to the person.** A mentor may use them, together with other signals, to start a supportive conversation. A single concern changes nothing on its own.
- **Do not name other people** or share private information.
- **Sabotage is detected.** Repeated unfounded or retaliatory reports reduce the weight of your future feedback.
- Quiet teammates matter. Recognising someone who rarely speaks up is one of the most useful things you can do here.

For `CONCERN`, an extra confirm checkbox: "I observed this myself, I am describing behaviour, and I understand this goes to mentors, not to the person."

---

## 6. Rarity thresholds for peer titles (starting values)

| Tier | Condition (per category) |
|---|---|
| Common | >= 3 distinct givers |
| Rare | >= 8 distinct givers across >= 2 contexts |
| Epic | >= 15 distinct givers across >= 3 contexts, sustained over >= 8 weeks |

Tiers upgrade in place and are never lowered.

---

## 6b. Quest mechanics (criteria types with built-in algorithms)

You author the quests in Admin > Quests; each peer criteria type below carries its own **assignment rule** and **progress algorithm**, so no manual assignment or manual verification is needed.

### How the existing system works (and what changes)

- A quest is `criteria_type` (string) + `criteria_value`. `verifyQuestProgress` in `quest.service.ts` has an `if/else` chain per type that computes `current_value`; completion is `current_value >= criteria_value`.
- Assignment today is manual (`/admin/quests/assign`) or by dependency unlock. Nothing assigns automatically.
- Recalculation runs fire-and-forget after relevant writes (`recalculateAllQuestsForCube`).
- **Hazard:** if criteria stop being met, the service **reverts** the completion and `deleteMany`s the badge. Peer-derived values can fall (a concern dismissed, a rate drop), which would silently take badges away. Peer criteria are therefore **sticky**: once completed they never revert. This is a small, additive guard (a `STICKY_CRITERIA` set); existing types keep their behaviour.

### Registry

A single registry in `quest.service.ts` (or `peerQuests.ts`) maps each type to `{ assign, triggers, progress, sticky }`. The `else if` chain gets one delegating branch: `if (isPeerCriteria(type)) newValue = await PEER_QUESTS[type].progress(cubeProfileId, quest)`.

`G` below = the Cube's own given feedback (matched by `giver_hash` of their user id), excluding rows flagged as ring/reciprocal/self.

| criteria_type | Meaning of `criteria_value` | Progress algorithm | Auto-assigned when | Re-evaluated on |
|---|---|---|---|---|
| `peer_kudos_given` | number of different Cubes recognised | count distinct `receiver_id` in G where kind = KUDOS | quest created, new Cube, login | feedback created |
| `peer_feedback_streak` | consecutive ISO weeks | `calculateWeeklyStreak(G.created_at)` (reuses existing helper) | quest created, new Cube, login | feedback created |
| `peer_quiet_kudos` | number of quiet teammates recognised | count distinct receivers in G with `was_quiet = true` (receiver had < 3 distinct givers when the kudos was written; snapshot, so it cannot be gamed afterwards) | quest created, new Cube, login | feedback created |
| `peer_helpful_feedback` | kudos marked helpful | count distinct receivers who set `helpful_at` on one of G's kudos | after the Cube's first kudos | receiver marks helpful |
| `peer_calibration` | percent (rate) | `confirmed / (confirmed + dismissed)` over G's adjudicated concerns, x100; `0` until adjudicated >= `min_sample_size` (reuses the existing rate-sample mechanism) | after the Cube's first concern | mentor adjudicates a signal |
| `peer_distinct_givers_received` | number of different people who recognised you | count distinct `giver_hash` over **delivered** kudos received | quest created, new Cube, login | weekly digest delivery |
| `peer_title_tier` | 1 Common, 2 Rare, 3 Epic | max rarity ordinal across the Cube's `PeerTitle` rows | quest created, new Cube, login | title recompute |
| `mvcubes_awards` | number of MVCubes awards | count of `MvcubesAward` rows for the Cube | quest created, new Cube, login | MVCubes compute |

Design rules baked in:
- **Giving is rewarded for quality and breadth, never for negativity.** There is no "number of concerns filed" criterion. The only concern-related one is a *rate* of confirmed vs dismissed, with a minimum sample.
- **Receive-side progress updates only on weekly digest delivery**, never instantly, so quest progress cannot be used to infer who just wrote kudos.
- Progress values are counts/rates about the Cube itself and never contain who they concern. Admins can see that a Cube gives a lot or little feedback (activity), never to whom or what.

### Auto-assignment (decided: per-quest `auto_assign` checkbox)

Auto-assignment is **opt-in per quest**. The admin form gets an "Auto-assign to all Cubes" checkbox, default off. Assignment stays manual for any quest where it is off, exactly as today, for every criteria type (old and new).

`ensureAutoQuestsForCube(cubeProfileId)`: idempotent; for every quest with `auto_assign = true` whose eligibility rule is satisfied, creates the missing `CubeQuest` row, then verifies progress. The "Auto-assigned when" column above is the **eligibility rule** (`all`, or a condition such as "after the Cube's first concern"); it only applies when the checkbox is on.

Hooks (all fire-and-forget, never fail the user's action):
1. `POST /admin/quests` with `auto_assign = true`: assign to all eligible in-programme Cubes (`IN_PROGRAMME_CUBE_LEVELS`).
2. Cube creation / invite acceptance.
3. `trackUserLogin` (catches anyone missed, including quests created later).
4. First kudos / first concern, for the conditional types.

An existing quest can be switched to auto-assign later with `PUT` (admin edit); doing so assigns to currently eligible Cubes once and then follows the same hooks. Switching it back off never removes existing assignments.

Existing `dependency_quest_id` chaining still applies, so you can build ladders (first kudos -> streak -> quiet-teammate) without extra code.

### Code touch points

| File | Change |
|---|---|
| `backend/src/services/quest.service.ts` | registry + peer branch in `verifyQuestProgress`, `STICKY_CRITERIA` guard in the revert path, `ensureAutoQuestsForCube` |
| `backend/src/routes/quests.routes.ts` | add types to `validCriteriaTypes`; count types need integer >= 1; `peer_title_tier` 1-3; `peer_calibration` 1-100 and added to `RATE_CRITERIA_TYPES` so `min_sample_size` is accepted; accept `auto_assign` on create/update; call auto-assign when it is on |
| `backend/prisma/schema.prisma` | `Quest.auto_assign` |
| `backend/src/services/peer.service.ts` | call `recalculateAllQuestsForCube` after feedback, helpful mark, adjudication, digest, titles |
| `backend/src/routes/cubes.routes.ts` / invite flow | call `ensureAutoQuestsForCube` for new Cubes |
| `frontend/src/pages/AdminQuests.tsx` | dropdown options, labels, rate-type list, progress text, "Auto-assign to all Cubes" checkbox + badge on the quest list |
| `frontend/src/pages/CubeDashboard.tsx`, `Quests.tsx` | human-readable progress text for the new types |

### Schema additions

- `Quest` gets **one** additive column: `auto_assign Boolean @default(false)`. In SQL this is `ALTER TABLE "Quest" ADD COLUMN "auto_assign" BOOLEAN NOT NULL DEFAULT false;`. On PostgreSQL 11+ a constant default is a metadata-only change (no table rewrite, no row rewrite), and every existing quest reads `false`, so no existing behaviour changes. This is the only statement in the migration that touches an existing table.
- `PeerFeedback` gains `was_quiet Boolean @default(false)` and `helpful_at DateTime?` (the table is new in PR 1, so these are part of its first definition).

---

## 7. Rollout (PRs go straight to `main`; there is no develop branch)

Every PR must be safe to deploy on its own. Safety comes from the design, not from flags: with no peer data the peer weight is 0 and every score equals today's.

1. **PR 1, migration only**: new enums + tables + indexes. SQL hand-read and checked to contain nothing but `CREATE TYPE` / `CREATE TABLE` / `CREATE INDEX` / FKs on new tables. Unused by running code.
2. **PR 2, backend**: services, routes, score service, quest criteria + auto-assignment (section 6b). Includes a script that proves `overall` is identical to the current client-side formula for every existing Cube.
3. **PR 3, frontend**: composer, profile sections, radar, MVCubes; `Profile.tsx` reads the server `overall`.
4. **Observe**, then tune constants in `config/peer.ts` via normal PRs.
5. **Later**: Legendary tier, quests/badges for feedback quality ("Helpful Feedback", "Calibrated").

---

## 8. Data-safety constraints (from the project's deployment rule)

- Additive only: no `DROP`, no data backfill, no unique constraints on tables that already hold rows. The single touch of an existing table is `Quest.auto_assign BOOLEAN NOT NULL DEFAULT false` (`ADD COLUMN ... DEFAULT`, allowed by the rule).
- **`BadgeRarity` is not altered.** Adding `Legendary` needs `ALTER TYPE`, which the deployment rule excludes. Peer titles use the existing three values; Legendary is a separate, explicitly approved migration later (the frontend `Rarity` union can be extended without any DB change).
- Existing scores must be identical to today wherever no peer data exists (verified by a comparison script before PR 3 merges).
- `JWT_SECRET` is untouched; a dedicated secret avoids coupling to token rotation.
- No endpoint, log line or error message may contain `giver_hash` or raw feedback outside the routes listed above.

---

## 9. Open decisions

1. **Pinned quotes on the unauthenticated public page**: show (risk: anonymous text on the open internet), hide, or per-pin opt-in? Plan assumes per-pin opt-in, default off.
2. **Cohort size**: k-anonymity of 3 may hide everything in a small cohort. Thresholds are constants in `config/peer.ts`; confirm current active Cube count.
3. **MVCubes period**: monthly, computed by an admin action (no cron infrastructure exists today). Acceptable?
4. **Mentor SLA** for growth signals: 7 days assumed.

---

## 10. Operations notes and known issues (shipped state)

Status: PR 1 (schema), PR 2 (backend) and PR 3 (frontend) implement sections 1-9. This section collects what was deferred or needs a decision after launch.

### Before the first real feedback is written

1. **Set `PEER_PSEUDONYM_SECRET`** (for example `openssl rand -hex 32`) in the deployment environment and never change it afterwards. Without it, the key is derived from `JWT_SECRET` and a warning is logged. Rotating `JWT_SECRET` later would then change every giver hash and break: "feedback I've given", weekly budgets and cooldowns, reviewer reliability and giver-side quest progress. Setting it *after* feedback exists has the same effect on everything written before the change.
2. The secret and the database together can still be used to match a hash to a user. The API never does this for any role, but a person with both can. Say so plainly to Cubes if asked.

### Behaviour worth knowing

| Topic | Behaviour | Why |
|---|---|---|
| "Weekly digest" | A lazy cutoff at Monday 00:00 UTC, not a scheduled job. Titles and growth signals refresh on a Cube's login / inbox load and when staff open Radar. | The project has no cron infrastructure. |
| Peer score weight | Up to 20% of the overall score, scaled by distinct givers and contexts (full weight needs >= 8 givers across >= 2 contexts). Visible to staff only, like the existing Performance Index. | Plan section 2. |
| Pinned quotes | Visible to signed-in members only. Not on the open `/x/:cubeNumber` page, which shows peer title tiers only. | An anonymous quote on an unauthenticated page is a leak risk. Revisit with per-pin opt-in. |
| Feedback context | The composer offers "a mission we were both on" or "somewhere else". The API also supports TEAM and MEETING contexts. | Keeps the form short; extend if wanted. |
| Peer quests | Sticky: never reverted once complete. | A peer-derived value can fall (a concern is dismissed). |
| `peer_calibration` quest | Rewards the share of a Cube's mentor-reviewed concerns that were confirmed. | Risk: mentors may feel pressure to "confirm" so someone earns a badge. A minimum sample size mitigates it; consider not offering this quest at first. |
| Admin visibility of giving | Admins can see how much feedback each Cube gives (quest progress), never to whom or what. | Activity, not content. |

### Known issues not caused by this work

- **Migration history cannot rebuild an empty database.** `20260813000000_add_quest_min_sample_size` alters `Quest` before `20260813110832_add_quests_and_streaks` creates it. Production is unaffected (the tables already exist). A fresh environment or a `prisma migrate dev` shadow database fails. Verification of this feature used `prisma db push` on throwaway databases. Fixing it means re-ordering or squashing history and needs its own careful, additive-only plan.
- `frontend` has 60 pre-existing TypeScript errors (unused imports, a few `api` call signatures). None are in the peer files; `vite build` succeeds.

### Possible follow-ups

- ~~Legendary rarity~~ Shipped (see "Legendary rarity and content" below).
- Auto-award "Be an Iceberger" when a Cube is moved to the Iceberger level (today it is awarded by Admin sign-off on the "Become an Iceberger" quest, or from the Badges page).
- Per-pin public opt-in for quotes.
- Feedback-quality quests ("Helpful Feedback", "Calibrated") are in place as criteria; badge art for them is up to you.
- A scheduled job for digest delivery and MVCubes announcement once cron exists.

### Legendary rarity and content (shipped)

- **Migration `20261013120000_add_legendary_badge_rarity`** is a single `ALTER TYPE "BadgeRarity" ADD VALUE 'Legendary'`. This is the one deliberate exception to the "no `ALTER TYPE`" deployment rule. It rewrites nothing and changes no row, but it is **one-way** (Postgres cannot drop an enum value) and requires PostgreSQL 12+ if run inside a transaction. The migration inserts no data, because the new value cannot be used in the same transaction.
- **Deploy order:** apply the migration (`prisma migrate deploy`) *before* running the content script. Until then no code path can create a Legendary row, so the new client is safe.
- **Content:** `backend/src/scripts/seedPeerContent.ts` creates 14 badges and 14 quests (giving, receiving, MVCubes, calibration, and the Legendary "Be an Iceberger" badge with its "Become an Iceberger" quest). It is **dry-run by default**; pass `--apply` to write. It is idempotent and only creates or updates by name/title; it never deletes and never touches existing awards or progress.
  ```bash
  cd backend
  npx ts-node src/scripts/seedPeerContent.ts            # preview
  npx ts-node src/scripts/seedPeerContent.ts --apply    # write
  ```
- "Calibrated" is created but **not** auto-assigned (it ties a badge to mentor reviews). Turn it on per quest from Quests Admin if you want it.
- "Become an Iceberger" is assigned to every Cube so the goal is always visible, and completed by Admin sign-off (Quests Admin > override) when a Cube joins the main team. The Badges page shows the Legendary badge in a spotlight, "Unclaimed" until someone holds it.
