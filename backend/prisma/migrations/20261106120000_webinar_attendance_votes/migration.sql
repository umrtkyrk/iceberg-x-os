-- Webinar attendance, recovery notes and question upvotes (additive only).
-- New enums and tables, plus nullable columns on "Webinar" (added in phase 1,
-- so no older table is touched). No existing row is changed.

-- CreateEnum
CREATE TYPE "WebinarAttendanceStatus" AS ENUM ('Present', 'Late', 'Absent', 'Excused');

-- CreateEnum
CREATE TYPE "WebinarRecoveryStatus" AS ENUM ('Pending', 'Approved', 'Rejected');

-- AlterTable
ALTER TABLE "Webinar" ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "deadline_reminder_sent_at" TIMESTAMP(3),
ADD COLUMN     "question_groups" JSONB,
ADD COLUMN     "question_groups_at" TIMESTAMP(3),
ADD COLUMN     "start_reminder_sent_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WebinarQuestionVote" (
    "question_id" TEXT NOT NULL,
    "cube_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebinarQuestionVote_pkey" PRIMARY KEY ("question_id","cube_id")
);

-- CreateTable
CREATE TABLE "WebinarAttendance" (
    "id" TEXT NOT NULL,
    "webinar_id" TEXT NOT NULL,
    "cube_id" TEXT NOT NULL,
    "status" "WebinarAttendanceStatus" NOT NULL,
    "note" TEXT,
    "recorded_by_id" TEXT,
    "recovery_note" TEXT,
    "recovery_status" "WebinarRecoveryStatus",
    "recovery_submitted_at" TIMESTAMP(3),
    "recovery_reviewed_at" TIMESTAMP(3),
    "recovery_reviewed_by_id" TEXT,
    "recovery_feedback" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebinarAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebinarQuestionVote_cube_id_idx" ON "WebinarQuestionVote"("cube_id");

-- CreateIndex
CREATE INDEX "WebinarAttendance_cube_id_idx" ON "WebinarAttendance"("cube_id");

-- CreateIndex
CREATE UNIQUE INDEX "WebinarAttendance_webinar_id_cube_id_key" ON "WebinarAttendance"("webinar_id", "cube_id");

-- AddForeignKey
ALTER TABLE "WebinarQuestionVote" ADD CONSTRAINT "WebinarQuestionVote_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "WebinarQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebinarQuestionVote" ADD CONSTRAINT "WebinarQuestionVote_cube_id_fkey" FOREIGN KEY ("cube_id") REFERENCES "CubeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebinarAttendance" ADD CONSTRAINT "WebinarAttendance_webinar_id_fkey" FOREIGN KEY ("webinar_id") REFERENCES "Webinar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebinarAttendance" ADD CONSTRAINT "WebinarAttendance_cube_id_fkey" FOREIGN KEY ("cube_id") REFERENCES "CubeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

