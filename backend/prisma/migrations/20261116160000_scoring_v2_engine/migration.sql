-- AlterTable
ALTER TABLE "Quest" ADD COLUMN     "retired_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ScoreSnapshot" (
    "id" TEXT NOT NULL,
    "cube_id" TEXT NOT NULL,
    "week_start" TIMESTAMP(3) NOT NULL,
    "formula_version" TEXT NOT NULL,
    "overall" DOUBLE PRECISION,
    "mentor" DOUBLE PRECISION,
    "delivery" DOUBLE PRECISION,
    "private_effect" DOUBLE PRECISION,
    "band" TEXT,
    "provisional" BOOLEAN NOT NULL DEFAULT true,
    "detail" JSONB NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL,
    "cube_id" TEXT NOT NULL,
    "mission_id" TEXT,
    "author_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckInRating" (
    "id" TEXT NOT NULL,
    "check_in_id" TEXT NOT NULL,
    "criterion_id" TEXT NOT NULL,
    "value" INTEGER,

    CONSTRAINT "CheckInRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsRun" (
    "id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "started_by" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "OpsRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScoreSnapshot_formula_version_week_start_idx" ON "ScoreSnapshot"("formula_version", "week_start");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreSnapshot_cube_id_week_start_formula_version_key" ON "ScoreSnapshot"("cube_id", "week_start", "formula_version");

-- CreateIndex
CREATE INDEX "CheckIn_cube_id_kind_created_at_idx" ON "CheckIn"("cube_id", "kind", "created_at");

-- CreateIndex
CREATE INDEX "CheckIn_author_id_idx" ON "CheckIn"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "CheckInRating_check_in_id_criterion_id_key" ON "CheckInRating"("check_in_id", "criterion_id");

-- CreateIndex
CREATE INDEX "OpsRun_operation_started_at_idx" ON "OpsRun"("operation", "started_at");

-- AddForeignKey
ALTER TABLE "CheckInRating" ADD CONSTRAINT "CheckInRating_check_in_id_fkey" FOREIGN KEY ("check_in_id") REFERENCES "CheckIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckInRating" ADD CONSTRAINT "CheckInRating_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "Criterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

