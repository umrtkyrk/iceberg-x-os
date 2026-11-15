# Cube scoring v2

Design proposal, 16 November 2026. Status: **for review** by admins and mentors. Nothing here is built yet.

## Why change it

Today's overall score (`backend/src/services/score.service.ts`) works like this:

- the all-time mean of 9 scorecard criteria (1–5), averaged 50/50 with the mean private-note score (0–10);
- peer feedback can then move the result by at most 20%.

That causes several problems:

- **It does not show growth.** An early weak scorecard weighs as much as last week's, so a Cube who went from 2 to 4 looks the same as one who stayed at 3.
- **There are no anchors.** Nothing says what "Ownership: 3" means, so a strict mentor and a lenient one score the same work differently.
- **It is engineering-only.** All 9 criteria are required, including Technical ability and Demo output. Marketing, Editor, Sales and Support Cubes cannot be scored fairly.
- **It ignores what we can measure.** Update cadence, deliveries, meeting attendance and quiz results play no part.
- **It hides its basis.** A score built on one scorecard looks as certain as one built on ten.
- **One percentage hides the shape.** A technically strong, quiet communicator and an all-round average Cube can both read 72%.

## Decisions so far

| # | Decision |
|---|---|
| 1 | Scorecards use a **rubric**: every level 1–5 of every criterion is described by behaviour. "Not observed" is allowed. |
| 2 | The score has **three pillars**: mentor assessment, delivery and rhythm, peers. |
| 3 | **Private assessments stay in the score.** The Cube never sees their content, but sees their effect ("Private assessments: −4 points, 2 assessments"). The mentor explains it in 1:1s. |
| 4 | The score is always shown **with its basis**: how many assessments, missions and weeks, and whether any are legacy. |
| 5 | Instead of a bare percentage: a **level band**, a **criteria profile** (radar) and a **growth line**. |
| 6 | **Mid-mission check-ins** and **self-assessment** on the same rubric. |
| 7 | **Mentor calibration** is made visible to admins, not auto-corrected. |
| 8 | **Disciplines**: Engineer, Marketing, Editor, Sales, Support. Only Engineer and Marketing have Cubes today. Admins can add more later. |
| 9 | **Every existing score is backfilled** into v2 from the raw records. No existing row is changed. |
| 10 | Webinar engagement does **not** count towards the score (earlier decision). |
| 11 | Mentor pillar mix is **70% scorecards / 30% private**. |
| 12 | Difficulty weights by mission level as proposed. |
| 13 | The deliverable is **always the demo submission**, for every discipline. |
| 14 | **All Fundamentals quizzes count for everyone**: every Cube should know the basics. |
| 15 | Recency half-life of **10 weeks**, with **check-ins at least every 6 weeks** on an active mission, because some missions run for 6 months. |
| 16 | Band thresholds start as proposed and are tuned in shadow mode. |
| 17 | The quests built on the old average score are **retired** and replaced by v2 quests. Badges already earned stay on profiles as legacy badges; nothing is deleted. |

## The model

```
overall = peer_adjust( 0.70 × mentor_pillar + 0.30 × delivery_pillar )   ≈ 60 / 25 / 15
```

### Mentor pillar (~60%)

1. **Scorecard component:** the rubric-based criteria, combined as a weighted mean.
   - **Recency:** each assessment's weight halves every **10 weeks**, so newer evidence outweighs older evidence. Decay changes only the *relative* weight of assessments, so with no new evidence the score does not move: a long mission with no assessment does not erode anyone's score.
   - **Check-ins keep evidence flowing.** On an active mission, a short check-in on the same rubric is due **at least every 6 weeks** (a 6-month mission gets about 4). It appears as a "check-in due" signal on the mentor's My Cubes panel. A check-in counts like a scorecard but carries **half its weight**, so it nudges the score without dominating it.
   - **Difficulty:** harder missions count more. Weight by mission level: L1 0.8 · L2 0.9 · L3 1.0 · L4 1.15 · L5 1.3. This changes how much a scorecard counts, not the score it gives.
   - **Not observed** criteria are left out of the mean, never treated as zero.
2. **Private component:** private-note scores (0–10), with the same recency weighting.
3. **Mix:** mentor pillar = **70% scorecards + 30% private** (decided; today it is 50/50).

### Delivery pillar (~25%)

Measured from records, not opinion. Each part is 0–100. A part with no data is left out, and the rest are re-weighted.

| Part | Measure | Weight |
|---|---|---|
| Update rhythm | Share of weeks on an active mission with at least one update | 35% |
| Delivery | Demo submissions for missions that reached delivery (the same for every discipline) | 30% |
| Attendance | Meetings attended ÷ meetings the Cube was invited to | 20% |
| Learning | Best score on the Fundamentals quizzes (all of them, for everyone) | 15% |

Portal visits are **not** part of the score. They only show on the focus panels.

### Peers (≤15%)

The existing peer mechanism, unchanged: k-anonymity, a confidence based on how many people and contexts agree, and verified concerns. The cap goes from 20% to **15%**.

### Basis and minimum evidence

The score is always shown, with its basis, for example: **"Based on 3 assessments across 2 missions and 9 active weeks. 1 legacy assessment. Last assessed 3 weeks ago."** When the latest assessment is more than 10 weeks old, the basis says so, so a stale score is visible as stale.

Below **2 assessments** it is labelled **provisional**.

### Private disclosure

```
private_effect = overall − overall_computed_without_private_component
```

The Cube sees, for example, "Private assessments: −4.2 points (2 assessments)". The note text, the subject and the author are never sent to the Cube.

### Bands

| Band | Overall |
|---|---|
| Developing | < 55 |
| Solid | 55 – 70 |
| Strong | 70 – 85 |
| Exceptional | ≥ 85 |

Thresholds are tuned in shadow mode before go-live.

## Criteria and rubric drafts

Draft wording below. It is stored in the database, and admins edit it in the app. The six **core** criteria apply to everyone; each discipline adds two or three of its own. Each legacy column maps to one criterion, shown in brackets.

### Core (every discipline)

**Ownership** [`ownership_score`]
1. Waits to be told; tasks stall without follow-up.
2. Finishes assigned work when reminded; rarely flags problems early.
3. Finishes what they take on and says when they are stuck.
4. Removes their own blockers and keeps others informed without being asked.
5. Takes responsibility for the outcome, not just the task; spots and closes gaps nobody assigned.

**Communication** [`communication_score`]
1. Updates are missing or unclear; others have to chase.
2. Shares status when asked; key details are often missing.
3. Clear, regular updates; explains what they did and what is next.
4. Adapts the message to the audience; written work needs little clarification.
5. Makes complex work easy to follow for anyone, and raises the quality of team communication.

**Collaboration & leadership** [`leadership_score`]
1. Works in isolation; friction with teammates.
2. Cooperates when asked; contributes little to team decisions.
3. A reliable teammate; shares work and helps when asked.
4. Helps others unprompted; coordinates parts of the team's work.
5. Lifts the team: unblocks others, resolves disagreements, takes the lead when it is needed.

**Reliability** [`reliability_score`]
1. Misses commitments and meetings without notice.
2. Meets some commitments; slips are flagged late.
3. Meets commitments or flags changes in good time.
4. Consistently delivers what and when they said; plans realistically.
5. Others plan around them with confidence; protects the team's deadlines.

**Self-reflection** [`self_reflection_score`]
1. Does not acknowledge mistakes or feedback.
2. Accepts feedback but repeats the same issues.
3. Recognises what went well and what did not; acts on feedback.
4. Seeks feedback actively; the next piece of work shows the change.
5. Turns their own lessons into practices others can use.

**Problem & business thinking** [`product_thinking_score`]
1. Executes without understanding the why.
2. Understands the task but not who it is for.
3. Connects the work to the user or business goal.
4. Questions the brief when needed; proposes better options with reasons.
5. Shapes what should be built or done, and why, with clear judgement on trade-offs.

### Engineer

**Technical ability** [`technical_ability_score`]
1. Needs step-by-step help for routine tasks.
2. Handles routine tasks; struggles with unfamiliar code.
3. Delivers working, readable code for the mission's scope.
4. Makes sound design choices; code needs little review rework.
5. Solves hard technical problems cleanly; others learn from their code.

**Research** [`research_ability_score`]
1. Does not investigate before building.
2. Looks for an answer but stops at the first source.
3. Compares options and documents the findings.
4. Research changes the direction of the work for the better.
5. Produces research others reuse; finds non-obvious answers.

**Demo & output** [`demo_output_score`]
1. Nothing demonstrable at the end.
2. A partial demo; the core value is unclear.
3. A working demo of the agreed scope.
4. A polished demo that clearly shows value and limits.
5. Output ready to hand over or to build on directly.

### Marketing

**Content & creative quality**
1. Off-brand or error-prone work that needs a full rewrite.
2. Usable after significant edits.
3. On-brand, accurate work that needs light edits.
4. Strong ideas and execution; ready to publish.
5. Distinctive work that sets the bar for others.

**Campaign execution**
1. Tasks are left incomplete; no plan.
2. Executes parts of a plan with frequent gaps.
3. Runs a planned campaign end to end on schedule.
4. Anticipates issues; coordinates channels and people smoothly.
5. Runs complex campaigns independently; improves the process as they go.

**Data & analysis**
1. Does not measure results.
2. Reports numbers without interpretation.
3. Tracks the right metrics and explains what they mean.
4. Uses data to change decisions; sets up useful measurement.
5. Finds insights that change strategy; others rely on their analysis.

Editor, Sales and Support get their own two or three criteria when the first Cube joins those disciplines.

## Quests and badges

Two quests are built on the old all-time average and do not fit v2:

| Quest | Today's rule | Badge |
|---|---|---|
| High Achiever | Average scorecard score ≥ 4.2 | OwnYourWork (Rare) |
| Iceberg Elite Fellow | Average ≥ 4.7 across several missions | Crown (Epic) |

They are replaced by quests on the v2 score, for example:
- **Strong** band with a non-provisional score;
- **Exceptional** band held for 8 weeks;
- growth of **+10 points** within 12 weeks;
- level **4+ on every core criterion**.

New badges are linked to the new quests.

Two points to handle before removing the old quests:
- **`prisma/seed.ts` runs on every deploy** and recreates any seeded quest missing by title. The old quests must be taken out of the seed in the same change, or they come back.
- **Badges already awarded** stay. Retiring is additive: a `retired_at` field on `Quest`. A retired quest is hidden from quest lists, takes no new progress and is skipped by auto-assignment. Its badge stays on the profiles that earned it, marked *legacy*, and is no longer awarded.

## Data model (additive only)

| Change | Purpose |
|---|---|
| `Discipline` (key, name, active, sort) | Seeded with the five disciplines; admin "add discipline" screen |
| `CubeProfile.discipline_id` (nullable) | The Cube's main discipline |
| `Mission.discipline_id` (nullable) | Which criteria the scorecard shows |
| `Criterion` (key, name, discipline_id null = core, legacy_key, active, sort) | Criteria per discipline |
| `RubricLevel` (criterion_id, level 1–5, description) | Rubric text, edited by admins |
| `ScorecardRating` (feedback_id, criterion_id, value nullable = not observed) | Ratings on new scorecards |
| `ScoreSnapshot` (cube_id, week_start, formula_version, overall, pillars, basis) | Weekly history and backfill |
| Legacy scorecard columns → **nullable** | New scorecards do not have to fill engineering-only fields. Relaxing NOT NULL changes no data. |

Legacy scorecards are **read** through `Criterion.legacy_key`. They are not copied, so there is a single source of truth.

## Backfill

1. **Seed** disciplines, criteria and rubric drafts in the migration.
2. **Assign disciplines.** An admin screen pre-fills a suggestion: Engineer for every Cube with a legacy scorecard or an engineering mission, Marketing from mission categories. An admin confirms each one; nothing is guessed silently.
3. **Map legacy scorecards.** No Marketing Cube has a legacy scorecard, so all 9 columns map directly to the Engineer criteria above. They are labelled *legacy* in the basis, and recency weighting lets new rubric-based scorecards take over naturally.
4. **Compute snapshots.** A script computes, for every Cube and every week since they joined, the score **as of that week**: only records created before the week's end. It writes `ScoreSnapshot` rows tagged with `formula_version`. It is deterministic and safe to re-run; when the formula changes, the snapshots for the new version are rebuilt.
5. **Shadow mode.** Admins see the legacy and v2 scores side by side, with a list of Cubes that moved by more than 10 points. Mentors review them; weights and thresholds are tuned; snapshots are rebuilt.
6. **Go live** behind a flag. Turning the flag off restores the legacy score immediately.

## Delivery plan

Each step is its own PR, safe on `main` behind a flag.

1. Disciplines: tables, seed, admin screens to add disciplines and assign them to Cubes and missions.
2. Criteria and rubrics: tables, seeded drafts, admin rubric editor.
3. New scorecard form: the mission's discipline criteria, rubric hints, "not observed"; legacy columns made nullable.
4. Score engine v2: a pure, unit-tested formula; snapshot backfill script; admin shadow comparison.
5. Cube-facing score: band, basis, private effect, criteria radar and growth line (the "skill map").
6. Check-ins and self-assessment; mentor calibration view for admins.
7. Quests: v2 score quest types and new badges; the old score quests are retired (`Quest.retired_at`) and removed from the seed.

## Open questions

1. Check-in cadence: every 6 weeks on an active mission?
