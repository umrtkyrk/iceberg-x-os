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

Messages are plain text (up to 5,000 characters), paginated 50 per page, and
refresh every four seconds. This prototype uses polling, not WebSockets. Room
contents are not included in public search, feed, stats, dashboards, mentions,
notifications or browser storage. Uploads are deliberately absent because the
portal's current image URLs are publicly served.

Every message and membership read/write checks membership on the server. A
shared room row lock serializes those operations with membership removal.
Removed users cannot make new reads/writes, including direct requests to guessed
room IDs. The browser discards room content when access checks fail; data a
person already read cannot be retroactively erased from their device.

Room reads and management responses use `Cache-Control: no-store`. Forum
authentication, feature flags and the existing write rate limiter still apply.
Account deletion removes memberships and retains messages with a nullable author.

## Schema and verification

The additive `20261113120000_forum_private_chat` migration creates three tables:
`ForumChatRoom`, `ForumChatMember`, `ForumChatMessage`. It changes no existing
content. The guarded localhost installer recognizes it for empty setup and
forum upgrades. Do not replay historical migrations or reset existing databases.

The real PostgreSQL suite covers admin-only management, non-member/admin
message denial, room-list privacy, removal and concurrent read/send revocation,
cross-room isolation, history access on joining, pagination, public-data
projections and topic/reply liker lists. It also exercises real HTTP authorization
and confirms private messages never appear in public topic search or statistics.
The migration suite verifies schema parity and preservation of existing data.
