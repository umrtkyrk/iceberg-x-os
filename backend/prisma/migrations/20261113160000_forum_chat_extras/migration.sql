ALTER TABLE "ForumChatMember" ADD COLUMN "read_at" TIMESTAMP(3), ADD COLUMN "typing_until" TIMESTAMP(3);
ALTER TABLE "ForumChatMessage" ADD COLUMN "edited_at" TIMESTAMP(3), ADD COLUMN "deleted_at" TIMESTAMP(3), ADD COLUMN "reply_to_id" TEXT;
ALTER TABLE "ForumChatMessage" ADD CONSTRAINT "ForumChatMessage_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "ForumChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TABLE "ForumChatAttachment" (
"id" TEXT NOT NULL, "room_id" TEXT NOT NULL, "uploader_id" TEXT, "message_id" TEXT, "original_name" TEXT NOT NULL,
"byte_size" INTEGER NOT NULL, "storage_key" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "ForumChatAttachment_pkey" PRIMARY KEY ("id"),
CONSTRAINT "ForumChatAttachment_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "ForumChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE,
CONSTRAINT "ForumChatAttachment_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
CONSTRAINT "ForumChatAttachment_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "ForumChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ForumChatAttachment_storage_key_key" ON "ForumChatAttachment"("storage_key");
CREATE INDEX "ForumChatAttachment_room_id_uploader_id_idx" ON "ForumChatAttachment"("room_id", "uploader_id");
CREATE INDEX "ForumChatAttachment_message_id_idx" ON "ForumChatAttachment"("message_id");
CREATE TABLE "ForumChatReaction" ("message_id" TEXT NOT NULL, "user_id" TEXT NOT NULL, "emoji" TEXT NOT NULL,
CONSTRAINT "ForumChatReaction_pkey" PRIMARY KEY ("message_id", "user_id"),
CONSTRAINT "ForumChatReaction_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "ForumChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
CONSTRAINT "ForumChatReaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ForumChatReaction_user_id_idx" ON "ForumChatReaction"("user_id");
