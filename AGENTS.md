# Iceberg X Portal - Developer Handbook & Coding Guidelines (V2)

Welcome to the Iceberg X Portal developer guidelines. This repository has been refactored into a secure, modular, production-grade architecture. 

Use this guide to align development practices, preserve system safety, enforce role boundaries, and navigate backend/frontend layers.

---

## 1. Project Architecture

The application is structured into clearly separated layers on both the backend and frontend:

```mermaid
graph TD
    subgraph Frontend (React SPA)
        A[Pages & Components] -->|API client: fetch| B[utils/api.ts]
        B --> C[Auth Context]
    end
    subgraph Backend (Express Node.js)
        D[app.ts Router Mounts] --> E[routes/* modules]
        E -->|Middlewares: auth, rateLimit| F[Middlewares]
        F --> G[Services Layer]
        G -->|Prisma Client| H[PostgreSQL DB]
    end
```

### Backend Directory structure (`/backend/src`)
- `app.ts`: Global Express initialization, CORS headers, SPA routing fallbacks, and central error handling middleware.
- `config/`: Configuration variables (`env.ts` verifying required env vars on boot, `constants.ts` hosting domain rules).
- `middlewares/`: Security filters:
  - `auth.middleware.ts`: Handles JWT verification (`requireAuth`) and role guards (`requireRole`).
  - `rateLimit.middleware.ts`: Process-memory rate limiters protecting public endpoints.
- `routes/`: Modular endpoints (`auth.routes.ts`, `cubes.routes.ts`, `adminUsers.routes.ts`, etc.) mounted at a central `index.ts`.
- `services/`: Decoupled business logic (e.g. `invite.service.ts` for secure invites, `team.service.ts` for member synchronization, `prisma.ts` for database connections).
- `utils/`: Common helpers (`http.ts` hosting type/score parsers and centralized error responders).

### Frontend Directory structure (`/frontend/src`)
- `components/`: Layout shells, Markdown editors, and components.
- `pages/`: Specific page views (`Welcome.tsx`, `Missions.tsx`, `Profile.tsx`, etc.).
- `utils/`: Data formatters, state mappers, and API wrappers (`api.ts`).
  - `badgeIcons.ts`: Maps Lucide icons, grouping categories, and legacy aliases.
  - `badgeRarity.ts`: Defines style attributes, frames, and orders for badge rarities.

---

## 2. Core Coding Rules

### Rule 1: Centralized Error Sanitization
- **Strict Error Masking**: Never expose raw database or Prisma engine exceptions to the client. Prisma errors contain table names, column constraints, and SQL structure that leak system design.
- **Implementation**: Catch route errors and delegate to `sendError(res, error)` inside `backend/src/utils/http.ts`. If it is a client-side fault, throw `HttpError` (e.g., `badRequest()`, `notFound()`). Unhandled exceptions are automatically logged on the server and returned to the client as a generic `500` error: *"An unexpected server error occurred."*
  ```typescript
  // Example backend handler pattern
  router.post('/my-endpoint', requireAuth, async (req, res) => {
    try {
      if (!req.body.data) throw badRequest('Data is required');
      const result = await myService.process(req.body.data);
      return res.json(result);
    } catch (error) {
      return sendError(res, error);
    }
  });
  ```

### Rule 2: Safe Data Parsing & Validation
- **Scorecards**: Mentor feedback scores must be processed through `parseScore()`. Any rating outside `1` to `5` must be rejected or set to null to avoid breaking frontend radar charts.
- **Lexicographical Ordering**: Cube numbers are zero-padded string sequences (e.g., `"001"`, `"042"`). Always pass incoming values through `parseCubeNumber()` to pad integer inputs correctly. When calculating the next sequential ID, use `highestCubeNumber()` to parse values to integers first, preventing `"9"` from sorting above `"10"`.
- **Active Status Checks**: Offboarded profiles (`Alumni`, `Former_Cube`) cannot be assigned to active tasks or invited to meetings. Verify status constraints using `assertCubesAreActive(ids, 'assign')` prior to database writes.

### Rule 3: Frontend Null-Safety
- **Optional Chaining**: Always assume that nested relations (such as `cube.user`, `team.members`, or `meeting.attendance`) can be null or undefined. Use optional chaining `cube?.user?.name || 'Unknown'` at all times.
- **Search Lowercasing**: To prevent white-screen crashes, fall back to empty strings before lowercasing text queries: `(c.user?.name || '').toLowerCase()`.

### Rule 4: Frontend Layout Row Alignments
- Enforce strict layout heights on grid/list items (e.g. card lists in `Missions.tsx` or `Directory.tsx`) to prevent text wraps from breaking vertical row alignments:
  - Header badges row: `min-h-[1.75rem] flex flex-wrap gap-1.5`
  - Card title header: `line-clamp-2 min-h-[2.75rem] flex items-center`
  - Snippet description: `line-clamp-3 min-h-[3.75rem]`
  - Content details blocks: `min-h-[3.25rem] flex flex-col gap-1`

---

## 3. Security Guidelines & Token Onboarding

### One-Time Onboarding Invites
- **No Shared Passwords**: Replaced `DEFAULT_CUBE_PASSWORD` onboarding. New users are created in a locked state with a cryptographically random, unusable password hash (`unusablePasswordHash()`).
- **Token Hashing**: Invitation links contain a unique Base64-URL token. The database only stores the SHA-256 hash (`token_hash`) of this token. plain tokens are never stored. If the database leaks, invite links cannot be replayed.
- **Double-Submit Protection**: When accepting an invitation and setting a password, the transaction must re-verify `accepted_at` inside `prisma.$transaction` to prevent race conditions.
- **BCrypt Performance**: Perform password hashing (`bcrypt.hash`) outside database transactions. Bcrypt is intentionally slow and CPU-heavy; executing it inside a database transaction wastes connection pool slots.

### Endpoint Guards
- Verify user context on `AuthenticatedRequest` using `req.user`.
- Guard endpoints using Express middleware presets:
  - `requireAuth`: JWT check and user profile verification.
  - `isAdmin`: Admin-only write actions.
  - `isMentorOrAdmin`: Mentor/Admin-level controls.
  - `isCube`: Cube-specific actions.

---

## 4. Badge System & Rarity Hierarchy

The system defines three badge rarity tiers (`BadgeRarity`) with specific visual layouts:

1. **Common**: Flat design, white background card, and neutral border. Hint: expected of every Cube.
2. **Rare**: Coloured glow, lit gradient border (`from-sky-400 via-cyan-400 to-blue-600`). Hint: real depth of skill.
3. **Epic**: Dark card, animated rotating spectrum border (`badge-frame-epic` CSS class), sheen sweep, and sparkles. Hint: moves the programme forward.

### Naming & Asset Resolutions
- **Rarity Sort**: Sorted rarest first using `compareByRarity` (order: Epic = 1, Rare = 2, Common = 3).
- **Lucide Icon Collisions**: Aliased imports that shadow JavaScript globals (e.g. `Map as MapIcon`, `Infinity as InfinityIcon`) must be strictly observed in `badgeIcons.ts` to prevent import-time application crashes.
- **Backward Compatibility**: Pre-catalogue PascalCase icons (e.g. `ClarityMaker`, `DeepDiver`) map to new keys using `LEGACY_ICON_ALIASES` in `badgeIcons.ts`.
- **Award Guards**: Prevents duplicate awards for the same mission/cube combination. Deleting a badge requires `?force=true` query confirmation if active awards exist.

---

## 5. Database Schema & Migration Rules

### Migration Operations (Zero Loss)
- **Safe Migrations**: Never push schema changes using `prisma db push` or interactively override database states in production. All schema changes must be logged as SQL migrations in `backend/prisma/migrations/`.
- **Zero-Reset Deployment**: Deploy changes using `npx prisma migrate deploy` to roll out changes safely without wiping existing records.
- **Index Optimization**: Maintain query index annotations (`@@index([user_id])`, etc.) on relational columns to speed up dashboard calculations.

---

## 6. Terminology Conventions

- **Standardized Word**: Use the term **Cube** exclusively across all user interfaces, button texts, page headers, lists, and form placeholders when referring to fellowship developers. Never refer to them as "students" or "interns".

---

## 7. Repositories & deployment

The code lives in **two repositories that must stay identical**:

| Role | Repository | Used for |
|---|---|---|
| **Deploy** | `yemrealtanay/iceberg-x-os` | Production deploys from its `main` |
| Org | `Iceberg-Digital-Team/iceberg-x-os` | Team copy and pull requests |

There is no `develop` branch; pull requests go straight to `main`, so **every merge to the deploy repo's `main` is a production deploy**.

### Rules
1. **Merge a pull request in only one repository**, then bring the other up to date with `scripts/sync-remotes.sh --apply`. Merging the same PR in both creates two different merge commits and the histories drift apart.
2. **Never resolve "merge main into my branch" conflicts by hand without building.** Run `cd frontend && npm run build` (the exact command the Docker image runs) before pushing; an unbalanced JSX tag is only caught by the build.
3. If the repositories have diverged, `scripts/sync-remotes.sh` stops and prints how to reconcile. It only ever fast-forwards and never force-pushes.

### Checking and syncing
```bash
scripts/sync-remotes.sh            # report only
scripts/sync-remotes.sh --apply    # fast-forward whichever repository is behind
```
