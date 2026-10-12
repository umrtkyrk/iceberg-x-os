-- Peer feedback, Radar and MVCubes.
-- Additive only: new enums and new tables, plus ONE column on "Quest" with a
-- constant default (existing rows read false; no table rewrite, no backfill).
-- No existing row is read, changed or removed.

-- CreateEnum
CREATE TYPE "PeerFeedbackKind" AS ENUM ('KUDOS', 'OBSERVATION', 'CONCERN');

-- CreateEnum
CREATE TYPE "PeerFeedbackStatus" AS ENUM ('ACTIVE', 'DISMISSED');

-- CreateEnum
CREATE TYPE "PeerContextType" AS ENUM ('MISSION', 'MEETING', 'TEAM', 'OTHER');

-- CreateEnum
CREATE TYPE "PeerSignalState" AS ENUM ('OPEN', 'IN_CONVERSATION', 'RESOLVED');

-- AlterTable
ALTER TABLE "Quest" ADD COLUMN     "auto_assign" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PeerFeedback" (
    "id" TEXT NOT NULL,
    "giver_hash" TEXT NOT NULL,
    "receiver_id" TEXT NOT NULL,
    "kind" "PeerFeedbackKind" NOT NULL,
    "tags" TEXT[],
    "note" TEXT,
    "context_type" "PeerContextType" NOT NULL DEFAULT 'OTHER',
    "context_id" TEXT,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "status" "PeerFeedbackStatus" NOT NULL DEFAULT 'ACTIVE',
    "delivered_at" TIMESTAMP(3),
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "pinned_at" TIMESTAMP(3),
    "was_quiet" BOOLEAN NOT NULL DEFAULT false,
    "helpful_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeerFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeerSignal" (
    "id" TEXT NOT NULL,
    "cube_id" TEXT NOT NULL,
    "kudos_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "concern_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "distinct_givers" INTEGER NOT NULL DEFAULT 0,
    "distinct_contexts" INTEGER NOT NULL DEFAULT 0,
    "tag_counts" JSONB NOT NULL DEFAULT '{}',
    "visibility_gap" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeerSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeerGrowthSignal" (
    "id" TEXT NOT NULL,
    "cube_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "state" "PeerSignalState" NOT NULL DEFAULT 'OPEN',
    "due_at" TIMESTAMP(3) NOT NULL,
    "handled_by_id" TEXT,
    "handled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeerGrowthSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeerTitle" (
    "id" TEXT NOT NULL,
    "cube_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "rarity" "BadgeRarity" NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "upgraded_at" TIMESTAMP(3),

    CONSTRAINT "PeerTitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MvcubesAward" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "cube_id" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "MvcubesAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeerReviewerStat" (
    "giver_hash" TEXT NOT NULL,
    "reliability" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "given_total" INTEGER NOT NULL DEFAULT 0,
    "dismissed" INTEGER NOT NULL DEFAULT 0,
    "confirmed" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeerReviewerStat_pkey" PRIMARY KEY ("giver_hash")
);

-- CreateIndex
CREATE INDEX "PeerFeedback_receiver_id_kind_created_at_idx" ON "PeerFeedback"("receiver_id", "kind", "created_at");

-- CreateIndex
CREATE INDEX "PeerFeedback_giver_hash_created_at_idx" ON "PeerFeedback"("giver_hash", "created_at");

-- CreateIndex
CREATE INDEX "PeerFeedback_receiver_id_is_pinned_idx" ON "PeerFeedback"("receiver_id", "is_pinned");

-- CreateIndex
CREATE UNIQUE INDEX "PeerSignal_cube_id_key" ON "PeerSignal"("cube_id");

-- CreateIndex
CREATE INDEX "PeerGrowthSignal_cube_id_state_idx" ON "PeerGrowthSignal"("cube_id", "state");

-- CreateIndex
CREATE INDEX "PeerGrowthSignal_state_due_at_idx" ON "PeerGrowthSignal"("state", "due_at");

-- CreateIndex
CREATE INDEX "PeerTitle_category_rarity_idx" ON "PeerTitle"("category", "rarity");

-- CreateIndex
CREATE UNIQUE INDEX "PeerTitle_cube_id_category_key" ON "PeerTitle"("cube_id", "category");

-- CreateIndex
CREATE INDEX "MvcubesAward_period_idx" ON "MvcubesAward"("period");

-- CreateIndex
CREATE INDEX "MvcubesAward_cube_id_idx" ON "MvcubesAward"("cube_id");

-- CreateIndex
CREATE UNIQUE INDEX "MvcubesAward_period_category_cube_id_key" ON "MvcubesAward"("period", "category", "cube_id");

-- AddForeignKey
ALTER TABLE "PeerFeedback" ADD CONSTRAINT "PeerFeedback_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "CubeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeerSignal" ADD CONSTRAINT "PeerSignal_cube_id_fkey" FOREIGN KEY ("cube_id") REFERENCES "CubeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeerGrowthSignal" ADD CONSTRAINT "PeerGrowthSignal_cube_id_fkey" FOREIGN KEY ("cube_id") REFERENCES "CubeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeerTitle" ADD CONSTRAINT "PeerTitle_cube_id_fkey" FOREIGN KEY ("cube_id") REFERENCES "CubeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MvcubesAward" ADD CONSTRAINT "MvcubesAward_cube_id_fkey" FOREIGN KEY ("cube_id") REFERENCES "CubeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

