# Two-Person Development Workflow: Cube Forum (Medine & Mesut)

How the two of us plan, build, review, and integrate the Cube Forum without stepping on each other.

It builds on:

- [`forum-team-workflow.md`](forum-team-workflow.md): the fork boundary. **That document wins on anything about
  repositories, pushing, or deploying.**
- [`AGENTS.md`](../AGENTS.md): coding, security and migration rules for the whole portal.
- [`forum-tasks.md`](forum-tasks.md): what we are building and who does what.

---

## 0. The rules that matter most

1. **We work only in the fork `umrtkyrk/iceberg-x-os`.** No push, PR, merge, deploy, or
   `scripts/sync-remotes.sh` against `yemrealtanay/iceberg-x-os` or `Iceberg-Digital-Team/iceberg-x-os`.
   Upstream is read-only for us.
2. **Nobody pushes directly to `forum-mvp` or `main`.** Every change is a PR into `forum-mvp`, reviewed by the
   other person.
3. **When you open a PR, check the base:** repository **`umrtkyrk/iceberg-x-os`**, branch **`forum-mvp`**.
   GitHub suggests upstream by default.
4. **Only one migration is in flight at a time,** it is additive only, and we never edit upstream migrations.
5. **Build before you push** (see §5.1).

---

## 1. One-time setup (each of us)

### 1.1 Remotes

| Remote | Repository | Use |
|---|---|---|
| `origin` | `umrtkyrk/iceberg-x-os` (fork) | Everything: branches, PRs, merges |
| `upstream` | `yemrealtanay/iceberg-x-os` | **Fetch only**, to pick up portal updates |

```bash
git clone https://github.com/umrtkyrk/iceberg-x-os.git
cd iceberg-x-os
git remote add upstream https://github.com/yemrealtanay/iceberg-x-os.git
git remote set-url --push upstream https://example.invalid/upstream-push-disabled
git config remote.pushDefault origin
git config push.default current
git switch --track origin/forum-mvp
```

These settings are local to each clone. They don't block a push typed with a full URL, so don't do that.

### 1.2 Local environment

```bash
npm run install-all
cp backend/.env.example backend/.env        # fill in; never commit
echo "VITE_CUBE_FORUM_ENABLED=true" > frontend/.env.local   # plus FORUM_ENABLED=true in backend/.env
docker-compose up postgres -d
npm run db:migrate                           # see task 0.4 if this fails on an empty DB
npm run db:seed
npm run dev                                  # backend :5001, frontend :5173 → /forum
```

Each of us has a separate local database. Never point `.env` at a production database.

### 1.3 GitHub settings on the fork (Mesut, once)

Protect `forum-mvp` and `main`: PR required, 1 approval, dismiss stale approvals, no force-push or deletion.

---

## 2. Planning

### 2.1 Board

GitHub Issues + a Project board **on the fork**, one issue per task in `forum-tasks.md`.

`Backlog → Ready → In Progress → In Review → Done (in forum-mvp)`

An issue is **Ready** when it has a one-line goal, acceptance criteria, an area label (`api`, `ui`, `db`,
`notifications`, `moderation`) and a size (`S`, `M`; split anything `L`).

### 2.2 Splitting work

- **Split by feature where possible:** one person owns a feature end to end. Where API and UI are split
  (e.g. Phase 2), agree the request/response shape **in the issue** before either side starts.
- **At most 2 issues In Progress per person.**
- **Assign yourself before you start.** Assigned = taken.

### 2.3 Hot files: post in chat before editing

| File | Why |
|---|---|
| `backend/prisma/schema.prisma` + `migrations/` | Migration order (§6) |
| `backend/src/routes/index.ts` | Router mounting |
| `backend/src/config/env.ts` | Feature flags |
| `frontend/src/App.tsx`, `components/Layout.tsx` | Routes and nav; a bad merge here has broken a build before |
| `frontend/src/pages/forum/ForumPreview.jsx` | One large file both of us will touch |
| `frontend/src/pages/forum/forum.css` | Shared scoped styles |
| `package.json` / `package-lock.json` | Dependency conflicts |

Example message: "Editing `ForumPreview.jsx` topic list for #12, will push by 15:00."

---

## 3. Daily routine

**Start of day**

```bash
git switch forum-mvp
git pull --ff-only
npm run install-all     # only if a package-lock changed
npm run db:migrate      # only if new migrations arrived
```

Async stand-up in chat:

```
Yesterday: #8 topics API – PR open
Today:     #9 replies API
Blocked:   need review on #8
Hot files: schema.prisma (no), routes/index.ts (yes)
```

**During the day:** rebase on `origin/forum-mvp` at least once, and push often. Open a **Draft PR** early.

**End of day:** push everything and review whatever is waiting on you. **No review waits longer than one
working day.**

---

## 4. Branches and commits

### 4.1 Branches

Always from an up-to-date `forum-mvp`, named `forum-<area>-<short>`:

```bash
git fetch origin
git switch -c forum-api-topics origin/forum-mvp
```

Examples: `forum-db-schema`, `forum-api-topics`, `forum-ui-feed`, `forum-notifications`,
`forum-moderation`, `forum-fix-reply-pagination`.

- One branch belongs to one person. Suggest changes in review rather than pushing to the other's branch.
- Merge within ~3 days, or split it.
- Delete it after merge.

### 4.2 Commit messages

Same style as the portal history:

```
feat(forum): list topics by category with cursor pagination
fix(forum): hide soft-deleted replies from non-moderators
test(forum): cover the announcements posting rule
docs(forum): describe the moderation queue
```

Imperative, ≤ 72 characters; the body explains **why**; reference the issue (`Closes #9`) in the PR.

### 4.3 Staying current

```bash
git fetch origin
git rebase origin/forum-mvp
# resolve conflicts, then run the §5.1 checks
git push --force-with-lease      # own feature branch only
```

If you merge instead of rebasing, **run the frontend build before pushing.** Broken JSX only shows up there.

### 4.4 Pulling in upstream portal changes (occasionally, by agreement)

Upstream keeps moving. About every 1–2 weeks, one of us (announced in chat) does:

```bash
git fetch upstream
git switch main && git merge --ff-only upstream/main && git push origin main
git switch -c forum-sync-upstream origin/forum-mvp
git merge main                   # resolve, build, test
git push                         # PR into forum-mvp, reviewed like any other
```

This only fetches **from** upstream. Nothing goes back.

---

## 5. Pull requests and review

### 5.1 Author checklist

- [ ] Base is **`umrtkyrk/iceberg-x-os` ← `forum-mvp`**
- [ ] Rebased on the latest `origin/forum-mvp`
- [ ] Backend: `cd backend && npm run build && npm test`
- [ ] Frontend: `cd frontend && npm run build && npm run test:forum && npm run check:forum`
- [ ] Tried it locally at `/forum` as a Cube **and** as a Mentor/Admin
- [ ] No `.env`, `.env.local`, tokens, local DB files, uploads, or debug logs
- [ ] Migration (if any) created with `prisma migrate dev`, additive only, committed

### 5.2 PR description

```markdown
## What
## Why        (Closes #…)
## How to test
1. Log in as … 2. Open /forum → … 3. Expect …
## Screenshots (UI: desktop + mobile)
## Risk       (migration? new env var? hot files?)
```

Aim for **under ~400 changed lines** (excluding lock files).

### 5.3 Reviewer checklist

**API**
- [ ] Mounted only when `FORUM_ENABLED` is on
- [ ] `requireAuth` on every route; moderation behind `isMentorOrAdmin`
- [ ] Ownership checked on the server for edit and delete. Changing an `:id` can't touch someone else's post
- [ ] Announcements: only ADMIN/MENTOR can post; locked topics reject replies
- [ ] Soft-deleted content isn't returned to non-moderators
- [ ] Errors via `sendError`, client faults via `badRequest()` / `notFound()`; no raw Prisma errors
- [ ] Input lengths limited; per-user rate limit on writes
- [ ] Showcase badges are checked against the user's **earned** badges, max 3
- [ ] Notifications: never to yourself, never twice per event, none to offboarded users
- [ ] Tests cover the permission rules, not just the happy path

**UI**
- [ ] Optional chaining on relations; `(x || '').toLowerCase()` in search
- [ ] Loading, empty and error states; works at phone width; modals keep keyboard focus
- [ ] Markdown goes through the portal's safe renderer, with no images
- [ ] Styles stay under `.cube-forum`

**Database:** SQL read line by line, new tables only, indexes on relation columns.

### 5.4 Etiquette

Prefix comments: `blocking:` · `suggestion:` · `question:` · `nit:`.
Approve when nothing `blocking:` is left. The **author** merges.
If two comments don't settle a disagreement, have a 10-minute call and write the decision in the PR.

### 5.5 Merging

**Squash and merge** into `forum-mvp` on the fork, delete the branch, and move the issue to **Done**.

---

## 6. Database migrations

- Announce before editing `schema.prisma`: "Starting migration for #5 (forum tables)". The other person waits
  for it to merge before creating a migration of their own.
- **Additive only:** new tables or new nullable columns. No renames or drops of portal tables.
- **Never edit upstream migration files,** including the known `Quest` ordering problem (task 0.4).
- Never edit a migration after it's merged into `forum-mvp`. Fix forward with a new one.
- Never use `prisma db push`.

```bash
cd backend
npx prisma migrate dev --name add_forum_tables
```

**If your migration conflicts after a rebase:** delete your migration folder, reset your **local** DB
(`npx prisma migrate reset`), and run `migrate dev` again with the same name to get a fresh timestamp.

---

## 7. Integration milestones (no production deploy)

The forum is never deployed by us. "Done" means merged into the fork:

1. **Feature done:** PR merged into `forum-mvp`.
2. **MVP done:** every task in `forum-tasks.md` Phases 1–6 is merged and the full checks pass on `forum-mvp`.
3. **Fork release:** `forum-mvp` → the fork's `main` via a reviewed PR.
4. **Upstream:** proposing the forum to the production portal is a separate decision for the project owners.
   It isn't part of this workflow.

**If `forum-mvp` breaks** (build or tests fail after a merge): post in chat right away, then the author of the
breaking PR either fixes forward within the hour or opens a revert PR (`git revert <sha>`), reviewed with
priority.

---

## 8. Communication

| What | Where |
|---|---|
| Stand-up, hot-file notes, "forum-mvp is broken" | Team chat |
| Decisions about a change | The PR |
| Tasks, bugs, open decisions | GitHub Issues on the fork |
| Bigger designs | A short doc in `docs/`, reviewed as a PR |

**Weekly 30-minute sync:** demo what merged → groom the board and split `L` items → pick the week's tasks and
hot-file owners → update this document if something slowed us down.

---

## 9. Quick reference

```bash
# start a task
git fetch origin && git switch -c forum-<area>-<name> origin/forum-mvp

# stay current
git fetch origin && git rebase origin/forum-mvp && git push --force-with-lease

# checks
(cd backend && npm run build && npm test)
(cd frontend && npm run build && npm run test:forum && npm run check:forum)

# new migration (announce first)
cd backend && npx prisma migrate dev --name <name>
```

| Situation | Do this |
|---|---|
| Opening a PR | Base = `umrtkyrk/iceberg-x-os` ← `forum-mvp` |
| Editing a hot file | Post in chat first |
| Schema change | Announce; one at a time; additive only |
| Review waiting on you | Within one working day |
| `forum-mvp` broken | Fix forward or revert within the hour |
| Tempted to push upstream / run `sync-remotes.sh` | Don't |
