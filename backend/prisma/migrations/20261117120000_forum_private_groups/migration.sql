-- WhatsApp-style private groups. Additive apart from widening three columns that now hold ciphertext.
-- Room content is encrypted by the application (FORUM_CHAT_KEY); run `npm run db:forum:encrypt-chat`
-- once after deploying to encrypt rows written before this change.

-- AlterTable
ALTER TABLE "ForumChatRoom" ADD COLUMN "description" TEXT,
ADD COLUMN "only_admins_edit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "only_admins_send" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ForumChatMember" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'MEMBER';

-- AlterTable
ALTER TABLE "ForumChatTask" ALTER COLUMN "title" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "ForumChatLink" ALTER COLUMN "title" SET DATA TYPE TEXT,
ALTER COLUMN "url" SET DATA TYPE TEXT;

-- Existing rooms: the creator becomes group admin; rooms whose creator is no longer a member get their longest-standing member.
UPDATE "ForumChatMember" m SET "role" = 'ADMIN' FROM "ForumChatRoom" r WHERE r."id" = m."room_id" AND r."created_by_id" = m."user_id";
UPDATE "ForumChatMember" m SET "role" = 'ADMIN' WHERE (m."room_id", m."user_id") IN (
  SELECT DISTINCT ON (x."room_id") x."room_id", x."user_id" FROM "ForumChatMember" x
  WHERE NOT EXISTS (SELECT 1 FROM "ForumChatMember" a WHERE a."room_id" = x."room_id" AND a."role" = 'ADMIN')
  ORDER BY x."room_id", x."joined_at", x."user_id");
