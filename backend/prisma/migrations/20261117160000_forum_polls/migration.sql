-- WhatsApp-style polls on forum topics and private chat messages. Additive only: three new tables.

-- CreateTable
CREATE TABLE "ForumPoll" (
    "id" TEXT NOT NULL,
    "topic_id" TEXT,
    "message_id" TEXT,
    "question" TEXT NOT NULL,
    "allow_multiple" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumPoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumPollOption" (
    "id" TEXT NOT NULL,
    "poll_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "ForumPollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumPollVote" (
    "poll_id" TEXT NOT NULL,
    "option_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumPollVote_pkey" PRIMARY KEY ("option_id","user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ForumPoll_topic_id_key" ON "ForumPoll"("topic_id");

-- CreateIndex
CREATE UNIQUE INDEX "ForumPoll_message_id_key" ON "ForumPoll"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "ForumPollOption_poll_id_position_key" ON "ForumPollOption"("poll_id", "position");

-- CreateIndex
CREATE INDEX "ForumPollVote_poll_id_user_id_idx" ON "ForumPollVote"("poll_id", "user_id");

-- CreateIndex
CREATE INDEX "ForumPollVote_user_id_idx" ON "ForumPollVote"("user_id");

-- AddForeignKey
ALTER TABLE "ForumPoll" ADD CONSTRAINT "ForumPoll_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "ForumTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumPoll" ADD CONSTRAINT "ForumPoll_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "ForumChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumPollOption" ADD CONSTRAINT "ForumPollOption_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "ForumPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumPollVote" ADD CONSTRAINT "ForumPollVote_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "ForumPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumPollVote" ADD CONSTRAINT "ForumPollVote_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "ForumPollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumPollVote" ADD CONSTRAINT "ForumPollVote_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

