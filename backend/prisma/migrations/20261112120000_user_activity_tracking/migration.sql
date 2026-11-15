-- Additive only: one nullable column and one new table. No existing row is
-- rewritten and nothing is dropped.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "last_seen_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UserActivityDay" (
    "user_id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "page_views" INTEGER NOT NULL DEFAULT 0,
    "active_minutes" INTEGER NOT NULL DEFAULT 0,
    "last_path" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserActivityDay_pkey" PRIMARY KEY ("user_id","day")
);

-- CreateIndex
CREATE INDEX "UserActivityDay_day_idx" ON "UserActivityDay"("day");

-- AddForeignKey
ALTER TABLE "UserActivityDay" ADD CONSTRAINT "UserActivityDay_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
