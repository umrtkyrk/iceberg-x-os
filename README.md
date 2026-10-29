# Iceberg X OS

Iceberg X OS is the internal operating platform for the **Iceberg X** R&D internship and innovation programme. It serves as the lightweight management system of record for Cubes, missions, demo days, feedback, badges, progression, and programme history—replacing the separate use of Jira, Notion, and Google Sheets.

Important: This app does **NOT** replace Slack (communication) or GitHub/GitLab (code and pull requests). It connects those layers into the program's operations.

---

## Tech Stack

- **Backend**: Node.js with Express and TypeScript
- **Frontend**: React + Vite + TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Styling**: Tailwind CSS
- **AI Support**: OpenAI API (graceful mock mode included for local testing)

---

## ⚡ Quick Start: Run Everything in Docker (Recommended)

This is the easiest way to launch the application. Both the frontend and backend are served from a single port (`5001`), completely bypassing any CORS preflight restrictions.

### 1. Start the Containers
Ensure Docker Desktop is running. In the project root, run:
```bash
docker-compose up --build -d
```
This will:
- Spin up the PostgreSQL database container.
- Build the React frontend and compile the Express backend.
- Wait for the database to become online.
- Apply database migrations and seed the initial data.
- Start the server on port `5001`.

### 2. Access the Application
Open [http://localhost:5001](http://localhost:5001) in your browser.

---

## 🛠️ Manual Setup (Alternative for Local Development)

If you wish to run the frontend Vite dev server (with hot reloading) and the backend Express server separately:

### 1. Configure Environment Variables
Create a `.env` file in the `backend/` directory:
```text
DATABASE_URL="postgresql://iceberg:iceberg_password@localhost:5432/iceberg_x_db?schema=public"
JWT_SECRET="super_secret_jwt_key_iceberg_x"
OPENAI_API_KEY="your_openai_api_key_here"
APP_URL="http://localhost:5173"
NODE_ENV="development"
PORT=5001
SEED_STAFF_PASSWORD="set-a-secure-staff-seed-password"
SEED_CUBE_PASSWORD="set-a-secure-cube-seed-password"
DEFAULT_CUBE_PASSWORD="set-a-secure-default-cube-password"
```

### 2. Install Dependencies
Run the command below in the workspace root:
```bash
npm run install-all
```

### 3. Start PostgreSQL Database
```bash
docker-compose up postgres -d
```

### 4. Run Migrations & Seed Data
```bash
npm run db:migrate
npm run db:seed
```

### 5. Launch Development Servers
```bash
npm run dev
```
Open the Vite dev server at [http://localhost:5173](http://localhost:5173). The API client will automatically proxy requests to port `5001`.

---

## Seeded Users

Seeded Admin users:
- `yunus.altanay@iceberg-digital.co.uk`
- `mark@iceberg-digital.co.uk`
- `ahmet.solmaz@iceberg-digital.co.uk`
- `baris@iceberg-digital.co.uk`
- `yusuf@iceberg-digital.co.uk`

Seeded Mentor users:
- `onur.basterzi@iceberg-digital.co.uk`
- `altug.ege@iceberg-digital.co.uk`
- `bora.kucukkara@iceberg-digital.co.uk`
- `furkan.meraloglu@iceberg-digital.co.uk`

Seeded Iceberg Fellows use `Role.CUBE`, `current_level = Iceberg_Fellow`, and `status = alumni` until the dedicated Cube Mentor/Fellow layer is introduced.

Passwords are intentionally not documented in the repository. Configure seed and default onboarding passwords with `SEED_STAFF_PASSWORD`, `SEED_CUBE_PASSWORD`, optional `SEED_YUNUS_PASSWORD`, and `DEFAULT_CUBE_PASSWORD` in the deployment environment or local `.env`.

---

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

## Railway Deployment

Deploying this monorepo to Railway is straightforward:

1. **Database**: Add the **Railway PostgreSQL** plugin to your project.
2. **Web Application**:
   - Root Directory: `.`
   - Build Command: `npm run build`
   - Start Command: `sh -c "node backend/dist/wait-db.js && npx prisma migrate deploy && npx prisma db seed && node backend/dist/index.js"`
   - Environment Variables:
     - `DATABASE_URL`: (linked from Postgres plugin)
     - `JWT_SECRET`: (generate a secure string)
     - `OPENAI_API_KEY`: (your OpenAI developer key)
     - `APP_URL`: (the domain URL of your frontend service)
     - `NODE_ENV`: `production`
     - `PORT`: `5001`

## Cube Forum design preview (fork)

The Cube Forum lives on `/forum` under Community. Turn it on with `FORUM_ENABLED=true` in `backend/.env` and `VITE_CUBE_FORUM_ENABLED=true` in `frontend/.env`, then run `npx prisma migrate deploy`. All topics, comments, follows, reports and statistics come from the `/api/forum` endpoints; there is no demo data. The forum starts empty: no seeded or sample topics.
