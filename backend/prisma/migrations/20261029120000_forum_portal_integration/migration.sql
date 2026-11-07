-- CreateTable
CREATE TABLE "ForumProfile" (
    "user_id" TEXT NOT NULL,
    "signature" VARCHAR(140) NOT NULL DEFAULT '',
    "badge_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForumProfile_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "ForumTopicContext" (
    "edited_at" TIMESTAMP(3),
    "topic_id" TEXT NOT NULL,
    "quest_id" TEXT,
    "mission_id" TEXT,

    CONSTRAINT "ForumTopicContext_pkey" PRIMARY KEY ("topic_id")
);

-- CreateTable
CREATE TABLE "ForumNotificationTarget" (
    "notification_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "reply_id" TEXT,

    CONSTRAINT "ForumNotificationTarget_pkey" PRIMARY KEY ("notification_id")
);

-- CreateIndex
CREATE INDEX "ForumTopicContext_quest_id_idx" ON "ForumTopicContext"("quest_id");

-- CreateIndex
CREATE INDEX "ForumTopicContext_mission_id_idx" ON "ForumTopicContext"("mission_id");

-- CreateIndex
CREATE INDEX "ForumNotificationTarget_topic_id_idx" ON "ForumNotificationTarget"("topic_id");

-- CreateIndex
CREATE INDEX "ForumNotificationTarget_reply_id_idx" ON "ForumNotificationTarget"("reply_id");

-- AddForeignKey
ALTER TABLE "ForumProfile" ADD CONSTRAINT "ForumProfile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumTopicContext" ADD CONSTRAINT "ForumTopicContext_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "ForumTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumTopicContext" ADD CONSTRAINT "ForumTopicContext_quest_id_fkey" FOREIGN KEY ("quest_id") REFERENCES "Quest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumTopicContext" ADD CONSTRAINT "ForumTopicContext_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "Mission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumNotificationTarget" ADD CONSTRAINT "ForumNotificationTarget_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumNotificationTarget" ADD CONSTRAINT "ForumNotificationTarget_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "ForumTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumNotificationTarget" ADD CONSTRAINT "ForumNotificationTarget_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "ForumReply"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Keep the real-api categories and their existing topics. Restore the required ideas area without renaming data.
INSERT INTO "ForumCategory" (id, name, description, position, staff_only)
VALUES ('ideas', 'Fikir atölyesi', 'Yeni fikirleri konuş, birlikte geliştir.', 7, false)
ON CONFLICT (id) DO NOTHING;
