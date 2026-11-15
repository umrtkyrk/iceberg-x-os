-- AlterTable
ALTER TABLE "MentorFeedback" ALTER COLUMN "technical_ability_score" DROP NOT NULL,
ALTER COLUMN "research_ability_score" DROP NOT NULL,
ALTER COLUMN "demo_output_score" DROP NOT NULL,
ALTER COLUMN "ownership_score" DROP NOT NULL,
ALTER COLUMN "communication_score" DROP NOT NULL,
ALTER COLUMN "leadership_score" DROP NOT NULL,
ALTER COLUMN "product_thinking_score" DROP NOT NULL,
ALTER COLUMN "reliability_score" DROP NOT NULL,
ALTER COLUMN "self_reflection_score" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ScorecardRating" (
    "id" TEXT NOT NULL,
    "feedback_id" TEXT NOT NULL,
    "criterion_id" TEXT NOT NULL,
    "value" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScorecardRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScorecardRating_criterion_id_idx" ON "ScorecardRating"("criterion_id");

-- CreateIndex
CREATE UNIQUE INDEX "ScorecardRating_feedback_id_criterion_id_key" ON "ScorecardRating"("feedback_id", "criterion_id");

-- AddForeignKey
ALTER TABLE "ScorecardRating" ADD CONSTRAINT "ScorecardRating_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "MentorFeedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScorecardRating" ADD CONSTRAINT "ScorecardRating_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "Criterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

