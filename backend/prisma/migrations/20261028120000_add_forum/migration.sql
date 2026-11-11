-- CreateTable
CREATE TABLE "ForumCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "staff_only" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ForumCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumTopic" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "author_id" TEXT,
    "title" VARCHAR(160) NOT NULL,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" TEXT,

    CONSTRAINT "ForumTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumReply" (
    "id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "author_id" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" TEXT,

    CONSTRAINT "ForumReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumTopicState" (
    "user_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "saved" BOOLEAN NOT NULL DEFAULT false,
    "following" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "ForumTopicState_pkey" PRIMARY KEY ("user_id","topic_id")
);

-- CreateTable
CREATE TABLE "ForumReport" (
    "id" TEXT NOT NULL,
    "reporter_id" TEXT,
    "topic_id" TEXT NOT NULL,
    "reply_id" TEXT,
    "reason" VARCHAR(1000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_id" TEXT,

    CONSTRAINT "ForumReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ForumTopic_category_id_deleted_at_last_activity_at_idx" ON "ForumTopic"("category_id", "deleted_at", "last_activity_at");

-- CreateIndex
CREATE INDEX "ForumTopic_author_id_idx" ON "ForumTopic"("author_id");

-- CreateIndex
CREATE INDEX "ForumTopic_deleted_at_pinned_last_activity_at_idx" ON "ForumTopic"("deleted_at", "pinned", "last_activity_at");

-- CreateIndex
CREATE INDEX "ForumReply_topic_id_deleted_at_created_at_idx" ON "ForumReply"("topic_id", "deleted_at", "created_at");

-- CreateIndex
CREATE INDEX "ForumReply_author_id_idx" ON "ForumReply"("author_id");

-- CreateIndex
CREATE INDEX "ForumTopicState_topic_id_idx" ON "ForumTopicState"("topic_id");

-- CreateIndex
CREATE INDEX "ForumReport_topic_id_idx" ON "ForumReport"("topic_id");

-- CreateIndex
CREATE INDEX "ForumReport_reply_id_idx" ON "ForumReport"("reply_id");

-- CreateIndex
CREATE INDEX "ForumReport_reporter_id_idx" ON "ForumReport"("reporter_id");

-- CreateIndex
CREATE INDEX "ForumReport_resolved_at_created_at_idx" ON "ForumReport"("resolved_at", "created_at");

-- AddForeignKey
ALTER TABLE "ForumTopic" ADD CONSTRAINT "ForumTopic_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ForumCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumTopic" ADD CONSTRAINT "ForumTopic_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumReply" ADD CONSTRAINT "ForumReply_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "ForumTopic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumReply" ADD CONSTRAINT "ForumReply_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumTopicState" ADD CONSTRAINT "ForumTopicState_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumTopicState" ADD CONSTRAINT "ForumTopicState_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "ForumTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumReport" ADD CONSTRAINT "ForumReport_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumReport" ADD CONSTRAINT "ForumReport_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "ForumTopic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumReport" ADD CONSTRAINT "ForumReport_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "ForumReply"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- The live forum starts empty: no fictional authors, topics or messages.
INSERT INTO "ForumCategory" (id, name, description, position, staff_only) VALUES
('announcements', 'Duyurular ve kurallar', 'Topluluk duyuruları, forum kuralları ve önemli gelişmeler.', 1, true),
('introductions', 'Tanışma köşesi', 'Kendinden bahset, yeni gelen Cubelara merhaba de.', 2, false),
('help', 'Yazılım desteği', 'Hata mesajını, denediğin çözümü ve ilgili kodu paylaş; birlikte çözelim.', 3, false),
('showcase', 'Proje günlüğü', 'Üzerinde çalıştığın projeyi anlat, ilerlemeni paylaş ve geri bildirim al.', 4, false),
('resources', 'Kaynak kütüphanesi', 'İşine yarayan bir yazıyı, aracı veya öğrenme kaynağını açıklamasıyla paylaş.', 5, false),
('lounge', 'Konu dışı', 'Teknolojiden oyunlara, müzikten günlük hayata: biraz da sohbet.', 6, false);

-- A question can have one accepted answer. Membership is validated under the topic row lock.
ALTER TABLE "ForumTopic" ADD COLUMN "accepted_reply_id" TEXT;
CREATE UNIQUE INDEX "ForumTopic_accepted_reply_id_key" ON "ForumTopic"("accepted_reply_id");
ALTER TABLE "ForumTopic" ADD CONSTRAINT "ForumTopic_accepted_reply_id_fkey" FOREIGN KEY ("accepted_reply_id") REFERENCES "ForumReply"("id") ON DELETE SET NULL ON UPDATE CASCADE;
