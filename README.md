# Iceberg X OS — Cube Forum fork

This is the **[umrtkyrk/iceberg-x-os](https://github.com/umrtkyrk/iceberg-x-os)** fork, where the Cube Forum is developed inside the existing Iceberg X portal. Work, branches and pull requests stay in this fork. Never push, open PRs, merge, deploy or run repository synchronization against `yemrealtanay/iceberg-x-os` or `Iceberg-Digital-Team/iceberg-x-os`.

`forum-mvp` is the integration branch; the fork's `main` receives releases through a fork-local pull request. A release here is a source-code handover, not a production deployment. See [the team workflow](docs/WORKFLOW.md) and [the fork boundary](docs/forum-team-workflow.md).

Iceberg X OS is the internal operating platform for the **Iceberg X** R&D programme. It connects Cubes, missions, Demo Days, feedback, badges, progression and programme history. Slack remains the communication layer and GitHub/GitLab the code and PR layer.

## Start here

- [Forum setup, permissions, APIs and moderation](docs/forum.md)
- [Implementation and delivery status](docs/forum-tasks.md)
- [Branches, releases and archived designs](docs/repository-branches.md)
- [2:50 Demo Day runbook](docs/forum-demo.md) — presentation/recording evidence is a separate delivery step
- [UI V4](docs/archive/forum-ui-v4.md) and [UI V5](docs/archive/forum-ui-v5.md) — historical design notes

## Local forum setup

Use a separate **localhost PostgreSQL** database for development. The guarded installation paths below are the tested forum setup; [the current guide](docs/forum.md#local-setup) explains their checks and recovery boundaries.

1. Install dependencies from the repository root:

   ```sh
   npm ci
   npm ci --prefix backend
   npm ci --prefix frontend
   ```

2. Create `backend/.env` from [the environment example](backend/.env.example), replacing the inherited sample values with your own local settings. Configure `DATABASE_URL` and `DIRECT_URL` to the same localhost database/schema, your own `JWT_SECRET`, `APP_URL=http://localhost:5173`, `NODE_ENV=development` and `PORT=5001`. Keep environment files and credentials out of Git.

3. Enable `FORUM_ENABLED=true` in `backend/.env` and `VITE_CUBE_FORUM_ENABLED=true` in `frontend/.env.local`. Both flags default to off.

4. Start your local PostgreSQL instance. If you use the included Compose database service, start **only** that service with `docker-compose up postgres -d` and make the localhost connection settings match it.

5. Generate the Prisma client:

   ```sh
   npx --prefix backend prisma generate --schema backend/prisma/schema.prisma
   ```

6. Choose the database path that applies, with local dev servers stopped:

   | Target | Commands from the repository root |
   |---|---|
   | New, completely empty local schema | `npm run db:forum:init --prefix backend` |
   | Existing portal with Prisma migration history | `npm run db:forum:plan --prefix backend`, then `npm run db:forum:migrate --prefix backend` |

   These commands preserve existing category labels and avoid replaying the portal's historical Quest migration ordering bug. They reject production/non-local targets and never reset the database or run `db push`. Initialization creates default communities; it does not create accounts, badges, topics or replies. Read [the migration guide](docs/forum.md#migration-history-and-data-preservation) before upgrading an existing local database.

7. Start the development servers:

   ```sh
   npm run dev
   ```

   Open [http://localhost:5173/forum](http://localhost:5173/forum). The frontend uses the backend on port `5001`. Restart the appropriate server after changing a feature flag; the frontend flag is applied at build time.

## Local accounts and onboarding

Use the portal's existing local account/invitation workflow. In the invitation path, a new account receives an unusable random password hash until its owner chooses a password through a one-time link. Invite tokens expire after 72 hours and only their SHA-256 hashes are stored. The Admin receives the link to share; the portal does not send an invitation email automatically. Existing accounts keep their passwords. Admin user creation also supports an explicitly supplied password; shared default Cube passwords are not the onboarding model.

The broad portal seed is an optional, separate setup tool and is never run by the forum installer. If deliberately using it in a disposable local environment, configure your own `SEED_STAFF_PASSWORD` and `SEED_CUBE_PASSWORD`; `SEED_YUNUS_PASSWORD` is an optional seed override. Do not treat seeded accounts or the inherited example passwords as a shared forum login.

## Cube Forum

The forum appears under **Community → Forum** at `/forum`. Topics, replies, follows, reports and statistics use the real `/api/forum` endpoints and PostgreSQL.

It includes public portal identity/progression, up to three ordered earned badges, signatures, quest/mission context, exact-reply notifications, Admin-managed communities, topic movement and mobile layouts. Image upload/paste (PNG/JPEG/WEBP/GIF, up to 5 MB) and accepted answers are implemented extras beyond the original MVP. Upload storage/access behavior, current limits and validation commands are documented in [the forum guide](docs/forum.md).

## Tech stack

- **Backend:** Node.js, Express and TypeScript
- **Frontend:** React, Vite, TypeScript and Tailwind CSS
- **Database:** PostgreSQL with Prisma
- **Existing portal AI helpers:** optional and separate from forum operation

## What Each User Type Can Do

Iceberg X OS is built around three main user types: **Admin**, **Mentor**, and **Cube**. After login, all roles can access the shared workspace areas such as Dashboard, Cube Directory, Missions, Cube Vault, Badges, and Change Password. Create, edit, review, and administration permissions vary by role.

### Admin

Admin users own the operational layer of the programme. They manage people, missions, programme quality, and final administrative decisions.

Admins can:
- Monitor programme health from the Admin Dashboard: total Cubes, active Cubes, active missions, upcoming Demo Days, recent demo submissions, recent badges, progression recommendations, and inactive-risk signals.
- Create Admin, Mentor, or Cube users. When creating a Cube, they can define the Cube number, cohort, university, department, social links, skills/interests, and assigned mentor.
- Review Cube applications, approve or reject applicants, and delete applications. Approved applications can automatically create Cube user/profile records.
- Update Cube progression fields such as current level, fellowship status, and assigned mentor.
- Create and edit R&D missions, update mission status, and set final mission decisions.
- Create mission teams and assign Cubes to teams with team roles.
- Schedule Demo Days, add presentations, and approve mission completion.
- Create badge definitions, award badges, delete badge definitions, or revoke awarded badges.
- Delete operational records such as mentor feedback, updates, demo submissions, and missions.
- Use AI helpers to generate mission summaries, Cube progress summaries, and mentor feedback drafts.

Typical Admin flow: review applications, prepare Cube/Mentor accounts, set up missions and teams, track Demo Day/review activity, and update progression decisions.

### Mentor

Mentor users guide assigned Cubes and missions. Their focus is delivery quality, feedback, blockers, demo review, and progression recommendations.

Mentors can:
- Use the Mentor Dashboard to see assigned missions, assigned Cubes, pending demo reviews, recent update activity, and Cubes waiting for feedback.
- Create or edit R&D missions, including mission status, mentor assignment, repository/demo/slack links, and other mission details.
- Create teams and manage mission team member assignments.
- Read Cube daily, weekly, and mission progress updates, including blockers.
- Review demo submissions and submit scorecards.
- Evaluate Cubes across 9 scorecard metrics: technical ability, research ability, demo output, ownership, communication, leadership, product thinking, reliability, and self reflection.
- Enter strengths, areas to improve, private notes, and recommended next steps.
- Choose whether feedback is visible to the Cube or kept private for Admin/Mentor review only.
- Award badges and associate them with a mission or general fellowship achievement.
- Help schedule Demo Days and add presentations.
- Use AI helpers to generate mission summaries and feedback drafts.

Typical Mentor flow: check assigned missions, read Cube updates, identify blockers, review demo submissions, submit scorecards, separate public feedback from private notes, and add progression recommendations where needed.

### Cube

Cube users are programme participants and builders. Their workspace is centered on assigned missions, progress reporting, demo submissions, reflection, and feedback visibility.

Cubes can:
- Use the Cube Dashboard to see their Cube number, current level, status, earned badges, assigned mentor, active mission, active team, and upcoming Demo Day.
- Open assigned mission details such as description, context, problem statement, expected deliverables, Slack channel, repository link, and demo link.
- Submit daily, weekly, or mission progress updates, including optional blockers.
- Submit Demo Day material with summary, what was built, what was learned, what worked well, and the mandatory **"What could we have done better?"** reflection.
- Attach repository, pull request, live demo, document, and video links to demo submissions.
- Use the AI Reflection Helper to improve reflection drafts.
- Edit their own public profile: name, university, department, GitHub/GitLab/LinkedIn, Slack handle, internship status, skills, and interests.
- Browse Cube Directory, Missions, Cube Vault, and Badges.
- View earned badges and mentor feedback that has been explicitly made visible to them.
- Submit individual mission reflections. When all team reflections are submitted, the mission can move into pending approval.

Cube security boundaries:
- Cubes cannot edit another Cube profile.
- Cubes cannot view private mentor notes.
- Cubes cannot create or edit scorecards or mentor feedback records.
- Cubes cannot manage users, badge definitions, mission deletion, or programme progression.

Typical Cube flow: follow the active mission, submit updates, report blockers, submit demo material and reflection, then track public feedback and badges.

---

## Core Concept Workflows

### R&D Missions
Missions start in the **Idea Pool** and progress through stages: **Selected** ➔ **Researching** ➔ **Building Demo** ➔ **Demo Ready** ➔ **Reviewed** ➔ **Promoted to Backlog** / **Archived**.

### Demo Days & Reflections
Cubes present their progress during Demo Days. Before presenting, they submit a Demo Showcase containing:
- What was built and learned.
- **"What could we have done better?"**: A mandatory reflection component that fosters a culture of constant engineering improvement.
- Links to repository, PR, and Loom walk-through.

Mentors grade the presentation on 9 metrics (Tech, Research, Demo, Ownership, Communication, Leadership, Product thinking, Reliability, Reflection) and recommend next steps (e.g. Consider for Senior Cube).

### AI Helpers
Four AI assistants are available to help:
- **Mission Summary**: Summarizes description, updates, demos, and reviews into a Markdown draft.
- **Cube Progress**: Assesses updates, scores, and badges to draft progression reviews.
- **Reflection Helper**: Cleans up and structures Cube reflection submissions.
- **Mentor Review Drafter**: Writes professional reviews based on scorecard values.

*Note: All AI outputs are presented as editable drafts in the UI, allowing review before saving.*

---

## Inherited infrastructure files

[Dockerfile](Dockerfile) and [docker-compose.yml](docker-compose.yml) are retained from the portal. The full application container starts with raw Prisma migration deployment, and its configuration is not the guarded local forum installation described above. The full Docker application and Railway production rollout are not validated release paths for this fork. Use the local forum guide for development; a later deployment requires its own reviewed migration, environment and upload-storage plan.
