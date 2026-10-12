-- Hall of Fame: three additive columns on "CubeProfile".
--
-- ADDITIVE ONLY. Two are nullable with no default, one is a boolean with a
-- constant default; on PostgreSQL 11+ that is a metadata-only change (no table
-- rewrite, no row is read or written). Every existing profile reads
-- is_senior_candidate = false and both timestamps NULL, so nothing about any
-- existing Cube changes. No data is migrated; people are promoted by an
-- explicit admin action, never by this migration.

-- AlterTable
ALTER TABLE "CubeProfile" ADD COLUMN     "iceberger_at" TIMESTAMP(3),
ADD COLUMN     "is_senior_candidate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mentor_promoted_at" TIMESTAMP(3);
