# Cube Forum MVP: delivery status

Status: 9 November 2026. Team: Mesut Umur Tokyürek (`umrtkyrk`, Cube #018) and Medine Kaynak (`u230709007`, Cube #013).
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
| Existing extras | Accepted answers in Tech Support and image upload/paste up to 5 MB; no score/reward side effects |

## Changes in the handover PR

- Guarded localhost installation: baseline an empty schema without replaying the broken Quest migration order.
- Existing-portal upgrade: preserve category labels by resolving the two reviewed label-only migrations without executing their UPDATEs.
- Seed English defaults only in an empty forum; never overwrite or recreate Admin-managed communities.
- Exercise both real CLI paths, unsafe-target rejection, idempotency, schema consistency and record preservation in disposable PostgreSQL schemas.
- Consolidate current docs and provide the [2:50 Demo Day runbook](forum-demo.md).

## Still required for delivery

- Review/merge the handover PR into the fork's `forum-mvp`.
- Review/merge [contributor-credit PR #6](https://github.com/umrtkyrk/iceberg-x-os/pull/6) if still open. The handover PR is independent of it.
- Run the full checks from `forum.md` on the final merged revision.
- Perform or record the 2–3 minute Demo Day presentation and attach its evidence through the normal mission submission. A runbook does not count as a completed presentation.

The existing write limiter is process-local (20 non-GET requests/minute/account; images additionally 30/hour). Multi-instance rate limiting is a future infrastructure task. Images and accepted answers exceed the original mission minimum; reactions, email digests, reputation and Radar/MVCubes scoring remain absent.

Historical migration SQL is not rewritten, and already-applied category renames cannot be reversed without original values. The current local installer prevents pending label changes; production rollout is outside this fork task.
