-- CreateEnum
CREATE TYPE "RecruitmentStage" AS ENUM ('Applied', 'Evaluation', 'Interview', 'Offer');

-- AlterTable (additive only: new nullable columns and one defaulted column)
ALTER TABLE "CubeApplication" ADD COLUMN     "stage" "RecruitmentStage" NOT NULL DEFAULT 'Applied',
ADD COLUMN     "score_case" INTEGER,
ADD COLUMN     "score_communication" INTEGER,
ADD COLUMN     "score_ownership" INTEGER,
ADD COLUMN     "score_teamfit" INTEGER,
ADD COLUMN     "evaluation_note" TEXT,
ADD COLUMN     "interview_at" TIMESTAMP(3),
ADD COLUMN     "interview_note" TEXT;

-- CreateIndex
CREATE INDEX "CubeApplication_stage_idx" ON "CubeApplication"("stage");
