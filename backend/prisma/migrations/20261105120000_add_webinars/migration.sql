-- Webinars (additive only): new enum, new tables, indexes on the new tables.
-- No existing table or row is modified.

-- CreateEnum
CREATE TYPE "WebinarStatus" AS ENUM ('Draft', 'Published', 'Completed', 'Cancelled');

-- CreateTable
CREATE TABLE "Speaker" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "headline" TEXT,
    "company" TEXT,
    "photo_url" TEXT,
    "bio" TEXT,
    "linkedin_url" TEXT,
    "website_url" TEXT,
    "career" JSONB,
    "expertise" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Speaker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Webinar" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "meeting_url" TEXT,
    "questions_close_at" TIMESTAMP(3) NOT NULL,
    "status" "WebinarStatus" NOT NULL DEFAULT 'Draft',
    "invited_cube_ids" TEXT[],
    "recording_url" TEXT,
    "slides_url" TEXT,
    "summary" TEXT,
    "created_by_id" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Webinar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebinarSpeaker" (
    "webinar_id" TEXT NOT NULL,
    "speaker_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WebinarSpeaker_pkey" PRIMARY KEY ("webinar_id","speaker_id")
);

-- CreateTable
CREATE TABLE "WebinarQuestion" (
    "id" TEXT NOT NULL,
    "webinar_id" TEXT NOT NULL,
    "cube_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "is_late" BOOLEAN NOT NULL DEFAULT false,
    "asked_live" BOOLEAN NOT NULL DEFAULT false,
    "is_strong" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebinarQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Webinar_status_date_idx" ON "Webinar"("status", "date");

-- CreateIndex
CREATE INDEX "WebinarSpeaker_speaker_id_idx" ON "WebinarSpeaker"("speaker_id");

-- CreateIndex
CREATE INDEX "WebinarQuestion_webinar_id_idx" ON "WebinarQuestion"("webinar_id");

-- CreateIndex
CREATE INDEX "WebinarQuestion_cube_id_idx" ON "WebinarQuestion"("cube_id");

-- AddForeignKey
ALTER TABLE "WebinarSpeaker" ADD CONSTRAINT "WebinarSpeaker_webinar_id_fkey" FOREIGN KEY ("webinar_id") REFERENCES "Webinar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebinarSpeaker" ADD CONSTRAINT "WebinarSpeaker_speaker_id_fkey" FOREIGN KEY ("speaker_id") REFERENCES "Speaker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebinarQuestion" ADD CONSTRAINT "WebinarQuestion_webinar_id_fkey" FOREIGN KEY ("webinar_id") REFERENCES "Webinar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebinarQuestion" ADD CONSTRAINT "WebinarQuestion_cube_id_fkey" FOREIGN KEY ("cube_id") REFERENCES "CubeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

