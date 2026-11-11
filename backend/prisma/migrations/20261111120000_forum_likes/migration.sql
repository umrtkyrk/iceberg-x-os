-- Additive only: new like tables. No existing table or row is changed.
-- CreateTable
CREATE TABLE "ForumTopicLike" (
    "user_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumTopicLike_pkey" PRIMARY KEY ("user_id","topic_id")
);

-- CreateTable
CREATE TABLE "ForumReplyLike" (
    "user_id" TEXT NOT NULL,
    "reply_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumReplyLike_pkey" PRIMARY KEY ("user_id","reply_id")
);

-- CreateIndex
CREATE INDEX "ForumTopicLike_topic_id_idx" ON "ForumTopicLike"("topic_id");

-- CreateIndex
CREATE INDEX "ForumReplyLike_reply_id_idx" ON "ForumReplyLike"("reply_id");

-- AddForeignKey
ALTER TABLE "ForumTopicLike" ADD CONSTRAINT "ForumTopicLike_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumTopicLike" ADD CONSTRAINT "ForumTopicLike_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "ForumTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumReplyLike" ADD CONSTRAINT "ForumReplyLike_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumReplyLike" ADD CONSTRAINT "ForumReplyLike_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "ForumReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

