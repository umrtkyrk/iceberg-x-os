-- Polls on forum comments. Additive only: one nullable column, its unique index and foreign key.

-- AlterTable
ALTER TABLE "ForumPoll" ADD COLUMN     "reply_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ForumPoll_reply_id_key" ON "ForumPoll"("reply_id");

-- AddForeignKey
ALTER TABLE "ForumPoll" ADD CONSTRAINT "ForumPoll_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "ForumReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

