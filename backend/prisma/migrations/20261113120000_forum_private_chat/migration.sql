CREATE TABLE "ForumChatRoom" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "created_by_id" TEXT,
  CONSTRAINT "ForumChatRoom_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ForumChatRoom_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "ForumChatMember" (
  "room_id" TEXT NOT NULL, "user_id" TEXT NOT NULL, "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ForumChatMember_pkey" PRIMARY KEY ("room_id", "user_id"),
  CONSTRAINT "ForumChatMember_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "ForumChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ForumChatMember_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ForumChatMember_user_id_idx" ON "ForumChatMember"("user_id");
CREATE TABLE "ForumChatMessage" (
  "id" TEXT NOT NULL, "room_id" TEXT NOT NULL, "author_id" TEXT, "body" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ForumChatMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ForumChatMessage_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "ForumChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ForumChatMessage_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ForumChatMessage_room_id_created_at_id_idx" ON "ForumChatMessage"("room_id", "created_at", "id");
CREATE INDEX "ForumChatMessage_author_id_idx" ON "ForumChatMessage"("author_id");
