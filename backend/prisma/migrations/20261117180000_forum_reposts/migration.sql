-- Reposts of forum topics. Additive only: one new table.

-- CreateTable
CREATE TABLE "ForumTopicRepost" (
    "user_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumTopicRepost_pkey" PRIMARY KEY ("user_id","topic_id")
);

-- CreateIndex
CREATE INDEX "ForumTopicRepost_topic_id_created_at_idx" ON "ForumTopicRepost"("topic_id", "created_at");

-- AddForeignKey
ALTER TABLE "ForumTopicRepost" ADD CONSTRAINT "ForumTopicRepost_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumTopicRepost" ADD CONSTRAINT "ForumTopicRepost_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "ForumTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

