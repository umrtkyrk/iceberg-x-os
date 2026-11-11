# Cube Forum MVP: delivery status

Status: 11 November 2026. Team: Mesut Umur Tokyürek (`umrtkyrk`, Cube #018) and Medine Kaynak (`u230709007`, Cube #013).
Work stays in `umrtkyrk/iceberg-x-os`; PRs target `forum-mvp`. No upstream write or deployment is authorized.

The October mock/preview task list has been replaced by this implementation status. See [forum.md](forum.md) for current setup, permissions, APIs and moderation; UI V4/V5 documents are historical design notes.

| Area | Implemented behavior |
|---|---|
| Core forum | Real API/PostgreSQL; topic/reply creation, ownership edits, soft-delete, edited markers and 20-reply chronological pages |
| Discovery | Admin-managed communities, counts/latest activity, title/body/reply search, category/context filters, unread markers |
| Portal profile | Public avatar/name, Cube progression/candidacy/Founding, three ordered earned badges and a 140-character signature |
| Notifications | Follow/save state, owner/follower/mention delivery, recipient deduplication, exact reply links |
| Moderation | Mentor/Admin reports, pin/lock/move/remove; Admin community management; no rewriting another author's content |
| Permissions | Staff-only Announcements; active Cubes post; Alumni/Former/missing Cube profiles have read-only posting access |
| Feature flags | `FORUM_ENABLED` and `VITE_CUBE_FORUM_ENABLED`, both off by default |
| Frontend quality | TypeScript, scoped CSS, mobile/keyboard navigation, empty/loading/error states, guarded mention length |
| Existing extras | Accepted answers in Tech Support, image upload/paste up to 5 MB, forum quest progress and dashboard activity |

## Integrated handover

- Guarded localhost installation: baseline an empty schema without replaying the broken Quest migration order.
- Existing-portal upgrade: preserve category labels by resolving the two reviewed label-only migrations without executing their UPDATEs.
- Seed English defaults only in an empty forum; never overwrite or recreate Admin-managed communities.
- Exercise both real CLI paths, unsafe-target rejection, idempotency, schema consistency and record preservation in disposable PostgreSQL schemas.
- Consolidate current docs and provide the [2:50 Demo Day runbook](forum-demo.md).

## Validation and remaining delivery

- [Contributor-credit PR #6](https://github.com/umrtkyrk/iceberg-x-os/pull/6) and [handover PR #7](https://github.com/umrtkyrk/iceberg-x-os/pull/7) are merged into `forum-mvp`.
- All 41 automated tests, both builds, feature-off checks, PostgreSQL service/setup suites and synthetic HTTP permission/image checks passed on merged revision `2d07051` on 11 November 2026.
- The repository organization change prepares a fork-local release into `main`; branch roles and historical design tags are documented in [repository-branches.md](repository-branches.md). Main promotion does not constitute deployment or Demo Day delivery.
- Perform or record the 2–3 minute Demo Day presentation and attach its evidence through the normal mission submission. A runbook does not count as a completed presentation.

The existing write limiter is process-local (20 non-GET requests/minute/account; images additionally 30/hour). Multi-instance rate limiting is a future infrastructure task. Images, accepted answers and likes on topics/replies with grouped author notifications exceed the original mission minimum. Other emoji reactions, email digests, reputation and Radar/MVCubes scoring remain absent.

Historical migration SQL is not rewritten, and already-applied category renames cannot be reversed without original values. The current local installer prevents pending label changes; production rollout is outside this fork task.
