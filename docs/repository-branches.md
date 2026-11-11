# Fork branches and archived work

This workflow applies only to **`umrtkyrk/iceberg-x-os`**. The upstream repositories are read-only references. Never push, open a PR, merge, deploy, or run remote synchronization against upstream as part of this fork workflow.

## Branches we keep

| Branch | Purpose | How it changes |
| --- | --- | --- |
| `main` | The fork's reviewed release | A reviewed PR from `forum-mvp`; never delete this branch. |
| `forum-mvp` | Shared forum integration | Reviewed feature/fix PRs; never delete this branch. |

A fork release is separate from a production deployment or an upstream contribution. Neither happens automatically as part of this workflow.

Start new work on a separate feature or fix branch from the current `forum-mvp`. Use a descriptive name such as `codex/forum-search` or `fix/forum-notifications`. Open the PR against **`umrtkyrk/iceberg-x-os:forum-mvp`**, verify the base repository, run the relevant checks, and have the other team member review it. After it is merged, delete the finished branch only when no open PR or ongoing work still depends on it. A new design gets its own branch.

## Archive manifest — 11 November 2026

The following tags preserve the exact old branch heads. The tag format is **`archive/2026-11-11/<original-branch>`**; slashes in the original branch name remain part of the tag name.

All ten annotated archive tags below were pushed to the fork and their peeled commit SHAs were verified on 11 November 2026. This manifest is **not a deletion log**: a branch is eligible for cleanup only when its current remote head still matches the recorded SHA and no active work or PR depends on it.

| Original branch | Recorded full commit SHA | Archive tag |
| --- | --- | --- |
| `codex/fix-mention-text-loss` | `4f41df92444e46d1a304ebc160f4828be6ec7097` | `archive/2026-11-11/codex/fix-mention-text-loss` |
| `codex/forum-footer-credits` | `5971442c2a856260f3efed9484719a2b29196e58` | `archive/2026-11-11/codex/forum-footer-credits` |
| `codex/forum-release-readiness` | `25b357bed1885a53074c345819fb1aab8c23f7ee` | `archive/2026-11-11/codex/forum-release-readiness` |
| `codex/ui-v4` | `fafa06785a0174556a437474f87c9b04da2be5b1` | `archive/2026-11-11/codex/ui-v4` |
| `codex/ui-v5` | `6feaf7a4db03a8ade3d4454932feed1c624cb5a5` | `archive/2026-11-11/codex/ui-v5` |
| `fix/forum-review-followups` | `95183b8b0fb6dfae200f81c7a455428b3d31c512` | `archive/2026-11-11/fix/forum-review-followups` |
| `forum-design-preview` | `d88171b1c00fadf80c473fbeb3fedde4f7580071` | `archive/2026-11-11/forum-design-preview` |
| `forum/real-api` | `aba9a850890d2886a60cb0055767aef3b788a9cf` | `archive/2026-11-11/forum/real-api` |
| `ui-v2` | `cc9f1746037ab7816bfeb9a6b2b217277405c3ec` | `archive/2026-11-11/ui-v2` |
| `ui-v3` | `738811c91888c6dfe8aef64131db36db89910d2a` | `archive/2026-11-11/ui-v3` |

At the audit baseline, `forum-mvp` was `2d070513fe221959d65f7c7e1dfe9a55f3d56116`. The first eight branch heads in this table are ancestors of that commit. Their merged work remains in integration history.

`ui-v2` and `ui-v3` each contain **one unique old design commit** outside that history. They must not be described as merged. Their archive tags preserve those complete design snapshots, including the unique commits, before their branch names can be removed. Create a new branch from the corresponding tag whenever an old design needs to be inspected or continued; do not overwrite an archive tag.

## Cleanup safeguards

1. Inspect open PRs, active work and local worktrees before removing a shared branch. Keep a branch that still has ongoing work or an open PR.
2. Push each archive tag to the fork and verify that the remote tag resolves to the full commit SHA in the manifest. A local tag alone is insufficient.
3. Recheck each remote branch immediately before deleting it. Delete only with a lease for its recorded head. If the head has changed, retain the branch and audit the new work; never overwrite or discard a teammate's update.
4. Promote the reviewed integration state to the fork's `main` through a fork PR. Keep both `main` and `forum-mvp` after promotion.
5. Remove only the verified, inactive old branch names. Preserve archive tags, commits, PRs and review history. Branch cleanup does not require deleting PRs or rewriting history.

The one-time organization branch follows the same lifecycle: keep it while its PR is open, then remove it after merge and confirmation that no work depends on it.
