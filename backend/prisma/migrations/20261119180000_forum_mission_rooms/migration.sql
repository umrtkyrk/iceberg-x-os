ALTER TABLE "ForumChatRoom" ADD COLUMN "mission_id" TEXT;
CREATE UNIQUE INDEX "ForumChatRoom_mission_id_key" ON "ForumChatRoom"("mission_id");
ALTER TABLE "ForumChatRoom" ADD CONSTRAINT "ForumChatRoom_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
