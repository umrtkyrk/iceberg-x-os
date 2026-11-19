-- AlterTable
ALTER TABLE "CubeProfile" ADD COLUMN     "discipline_id" TEXT;

-- AlterTable
ALTER TABLE "Mission" ADD COLUMN     "discipline_id" TEXT;

-- CreateTable
CREATE TABLE "Discipline" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Discipline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Discipline_key_key" ON "Discipline"("key");

-- CreateIndex
CREATE INDEX "CubeProfile_discipline_id_idx" ON "CubeProfile"("discipline_id");

-- CreateIndex
CREATE INDEX "Mission_discipline_id_idx" ON "Mission"("discipline_id");

-- AddForeignKey
ALTER TABLE "CubeProfile" ADD CONSTRAINT "CubeProfile_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "Discipline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "Discipline"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Seed the disciplines agreed for scoring v2. Fixed ids keep this deterministic;
-- ON CONFLICT makes the step safe if a discipline was already created by hand.
INSERT INTO "Discipline" ("id", "key", "name", "description", "active", "sort_order", "updated_at") VALUES
  ('5f0e8a3c-0d1b-4c6e-9a01-000000000001', 'engineer',  'Engineer',  'Software engineering missions: research, prototypes and integration work.', true, 10, CURRENT_TIMESTAMP),
  ('5f0e8a3c-0d1b-4c6e-9a01-000000000002', 'marketing', 'Marketing', 'Campaigns, content and growth work.', true, 20, CURRENT_TIMESTAMP),
  ('5f0e8a3c-0d1b-4c6e-9a01-000000000003', 'editor',    'Editor',    'Writing, editing and content quality.', true, 30, CURRENT_TIMESTAMP),
  ('5f0e8a3c-0d1b-4c6e-9a01-000000000004', 'sales',     'Sales',     'Prospecting, outreach and deals.', true, 40, CURRENT_TIMESTAMP),
  ('5f0e8a3c-0d1b-4c6e-9a01-000000000005', 'support',   'Support',   'Customer support and success.', true, 50, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
