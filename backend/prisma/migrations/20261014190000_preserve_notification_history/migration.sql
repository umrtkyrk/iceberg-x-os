ALTER TABLE "Notification" ADD COLUMN "read_at" TIMESTAMP(3);
CREATE INDEX "Notification_user_id_read_at_idx" ON "Notification"("user_id", "read_at");
