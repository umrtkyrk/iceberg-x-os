-- Post visibility (public, one group, or chosen people). Additive: existing posts stay PUBLIC.

-- AlterTable
ALTER TABLE "ForumTopic" ADD COLUMN     "audience_room_id" TEXT,
ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'PUBLIC';

-- CreateTable
CREATE TABLE "ForumTopicAudience" (
    "topic_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "ForumTopicAudience_pkey" PRIMARY KEY ("topic_id","user_id")
);

-- CreateIndex
CREATE INDEX "ForumTopicAudience_user_id_idx" ON "ForumTopicAudience"("user_id");

-- AddForeignKey
ALTER TABLE "ForumTopic" ADD CONSTRAINT "ForumTopic_audience_room_id_fkey" FOREIGN KEY ("audience_room_id") REFERENCES "ForumChatRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumTopicAudience" ADD CONSTRAINT "ForumTopicAudience_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "ForumTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumTopicAudience" ADD CONSTRAINT "ForumTopicAudience_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

