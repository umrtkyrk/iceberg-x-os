-- Additive only: threaded forum replies, and a to-do board, pinned links and a GitHub repository per private room.
-- Existing replies keep parent_id NULL and stay top-level comments.

-- AlterTable
ALTER TABLE "ForumReply" ADD COLUMN "parent_id" TEXT;

-- AlterTable
ALTER TABLE "ForumChatRoom" ADD COLUMN "github_repo" TEXT;

-- CreateTable
CREATE TABLE "ForumChatTask" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForumChatTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumChatLink" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumChatLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ForumReply_parent_id_created_at_idx" ON "ForumReply"("parent_id", "created_at");

-- CreateIndex
CREATE INDEX "ForumChatTask_room_id_status_created_at_idx" ON "ForumChatTask"("room_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "ForumChatLink_room_id_created_at_idx" ON "ForumChatLink"("room_id", "created_at");

-- AddForeignKey
ALTER TABLE "ForumReply" ADD CONSTRAINT "ForumReply_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "ForumReply"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumChatTask" ADD CONSTRAINT "ForumChatTask_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "ForumChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumChatTask" ADD CONSTRAINT "ForumChatTask_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumChatLink" ADD CONSTRAINT "ForumChatLink_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "ForumChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumChatLink" ADD CONSTRAINT "ForumChatLink_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
