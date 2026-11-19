# Mission rooms

With the existing forum flags enabled, Admins and Mentors can create a private room from a mission detail page. A unique nullable mission relation distinguishes these rooms from independent private groups. Repeated creation returns the same room. Mission and room pages link to each other.

Mission rooms follow live MissionTeam memberships, excluding Alumni/Former Cubes. Historical MissionContributor records do not grant access. All portal Admins and Mentors are room admins. Membership is reconciled on forum requests and checked again under the room lock for chat/file operations; assignment changes take effect on the next request. New assignees can read existing messages. Independent rooms retain their member-only access rules.

The mission owns the name and membership, so manual rename, participant changes, leaving and room deletion are disabled for linked rooms. A renamed mission updates its room name without advancing the room activity timestamp. Existing message, poll, attachment, reaction and unread features remain in use.

Migration: `20261119180000_forum_mission_rooms` adds a nullable unique mission_id and foreign key to ForumChatRoom. It creates no rooms and changes no existing memberships. The guarded forum setup/migration tools include it. Real deployment or migration requires separate authorization; the prototype has only been run locally.

Current lifecycle: mission completion does not automatically archive the room. Deleting a mission cascades to its linked room, as specified by the foreign key; automatic archival and file cleanup on mission deletion are not included in this prototype. Membership reconciliation currently scans linked rooms per forum request; it should move to targeted roster-mutation hooks before large-scale rollout.

Regression coverage in `forumMissionRooms.cjs` runs through the real local database suite. It covers repeat creation, role guards, joins/removal, shared file-membership authorization, independent-room privacy, renaming and deterministic ordering with two admins. Frontend tests exercise poll state updates without a feed reload, including nested replies, failures and navigation during an in-flight vote.
