-- Pinned group messages. Additive only: two nullable columns.

-- AlterTable
ALTER TABLE "ForumChatMessage" ADD COLUMN     "pinned_at" TIMESTAMP(3),
ADD COLUMN     "pinned_by_id" TEXT;

