-- AlterEnum (additive only; existing values are kept)
ALTER TYPE "RecruitmentStage" ADD VALUE 'CaseSent';
ALTER TYPE "RecruitmentStage" ADD VALUE 'CaseSubmitted';
ALTER TYPE "RecruitmentStage" ADD VALUE 'Evaluated';

-- CreateEnum
CREATE TYPE "CaseDecision" AS ENUM ('StrongYes', 'Yes', 'Maybe', 'No');

-- CreateTable
CREATE TABLE "ApplicationCase" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consent_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "answers" JSONB,
    "ai_model" TEXT,
    "ai_scored_at" TIMESTAMP(3),
    "ai_scores" JSONB,
    "ai_reduction" TEXT,
    "ai_interview_focus" TEXT,
    "final_scores" JSONB,
    "decision" "CaseDecision",
    "reviewer_note" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "ApplicationCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationCase_application_id_key" ON "ApplicationCase"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationCase_token_hash_key" ON "ApplicationCase"("token_hash");

-- AddForeignKey
ALTER TABLE "ApplicationCase" ADD CONSTRAINT "ApplicationCase_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "CubeApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
