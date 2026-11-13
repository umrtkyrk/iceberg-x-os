# Local prototype: private rooms and liker lists

This branch is for local evaluation only. It is not pushed, deployed or submitted as a PR.

## Liker lists

The heart toggles the current person's like. The adjacent count opens a paginated
list of people who liked that topic or reply. Read-only forum accounts may open
the list. Deleted topics/replies cannot be queried, and responses contain only
the existing public forum author projection.

## Private rooms

Open **Private rooms** from the forum. **My rooms** shows only rooms the current
account belongs to. An admin can create rooms and add/remove active portal
accounts through **Manage rooms**. A room supports up to 100 members. The creator
is added automatically. A newly added member can read existing room history.

The admin management endpoint lists room names and memberships so admins can
manage them. It does not return messages. Even an admin must be a member to read
or send messages. Other roles cannot create rooms or change memberships.

Messages allow text/emoji (up to 5,000 characters), replies, owner-only edits and
soft deletion, and one of six emoji reactions per person. Re-selecting your
reaction removes it. Read markers advance up to the latest displayed message;
search and older pages do not mark the whole conversation read. The typing
indicator expires after eight seconds without a heartbeat. Room-scoped search
never returns messages from another room or deleted text. Messages are paginated
50 per page and refresh every three seconds. This prototype uses polling, not WebSockets. Room
contents are not included in public search, feed, stats, dashboards, mentions,
notifications or browser storage.

## Private attachments

Attach up to five files per message, **10 MiB (10 × 1,024 × 1,024 bytes) per file**.
The client and multipart endpoint enforce the limit; empty files are rejected.
Files are saved under a private directory with UUID storage keys, never under the
public forum image mount. Metadata responses omit storage paths/keys. Downloads
require a bearer token and fresh room-membership checks, with `no-store`,
`nosniff`, sandbox and forced-attachment headers. Files are not rendered as HTML.
There is no public download URL or automatic image/media preview.

Before sending, staged files are accessible only to their uploader; another room
member cannot attach someone else's staged file. A sent attachment belongs to
one message in one room. Revocation and message deletion disable subsequent
downloads. Cancel/remove discards a staged file. Deleted-message files are kept
on disk but inaccessible; periodic orphan/retention cleanup is not implemented
in this local prototype.

Every message and membership read/write checks membership on the server. A
shared room row lock serializes those operations with membership removal.
Removed users cannot make new reads/writes, including direct requests to guessed
room IDs. The browser discards room content when access checks fail; data a
person already read cannot be retroactively erased from their device.

Room reads and management responses use `Cache-Control: no-store`. Forum
authentication, feature flags and the existing write rate limiter still apply.
Typing/read heartbeats have a separate 60/minute/account quota so polling cannot
consume the 20/minute message/upload/reaction write quota.
Account deletion removes memberships and retains messages with a nullable author.

## Schema and verification

The additive `20261113120000_forum_private_chat` migration creates three tables:
`ForumChatRoom`, `ForumChatMember`, `ForumChatMessage`. The follow-up
`20261113160000_forum_chat_extras` adds attachment/reaction tables, read/typing
fields and nullable reply/edit/delete fields. Both are additive and preserve
existing messages. The guarded localhost installer recognizes them for empty setup and
forum upgrades. Do not replay historical migrations or reset existing databases.

The real PostgreSQL suite covers admin-only management, non-member/admin
message denial, room-list privacy, removal and concurrent read/send revocation,
cross-room isolation, history access on joining, pagination, public-data
projections and topic/reply liker lists. It also exercises real HTTP authorization
and confirms private messages never appear in public topic search or statistics.
The migration suite verifies schema parity and preservation of existing data.

Extra tests cover exact 10 MiB HTTP/service acceptance and one-byte overflow,
private binary downloads, draft-file ownership, cross-room and revoked-member
denial, deleted attachments, Unicode emoji, replies, edit ownership, reaction
replacement/removal, read-cursor monotonicity, typing expiration, search isolation
and heartbeat/write quota separation. Neither calls nor production deployment,
end-to-end encryption, virus scanning or full WhatsApp feature parity are claimed.

## Unread badges

The Private rooms entry and room heading show the total unread-message count across current memberships. Each room also shows its own count. Own messages and deleted messages are excluded; attachment-only messages count. Admin management access does not grant unread counts for rooms the admin has not joined. Counts refresh every three seconds and immediately after the UI acknowledges a newly displayed message. A zero count hides the badge entirely. Background tabs, search results and older message pages do not automatically mark a conversation read.

The additive `20261113190000_forum_chat_unread_cursor` migration adds a nullable message-id tie-breaker to the existing read timestamp. This prevents two messages created at the same timestamp from being mistaken for one read event and keeps read receipts aligned with unread counts. Existing read timestamps remain valid. Tests verify per-room/total counts, timestamp ties, monotonically advancing reads, own/deleted/attachment-only messages, account isolation and membership revocation.
