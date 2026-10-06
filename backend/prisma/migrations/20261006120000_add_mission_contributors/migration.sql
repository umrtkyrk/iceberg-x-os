-- CreateTable (additive: new empty table, no existing table is touched)
CREATE TABLE "MissionContributor" (
    "id" TEXT NOT NULL,
    "mission_id" TEXT NOT NULL,
    "cube_id" TEXT NOT NULL,
    "role" "TeamMemberRole" NOT NULL DEFAULT 'Contributor',
    "team_name" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionContributor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MissionContributor_mission_id_cube_id_key" ON "MissionContributor"("mission_id", "cube_id");

-- CreateIndex
CREATE INDEX "MissionContributor_cube_id_idx" ON "MissionContributor"("cube_id");

-- AddForeignKey
ALTER TABLE "MissionContributor" ADD CONSTRAINT "MissionContributor_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionContributor" ADD CONSTRAINT "MissionContributor_cube_id_fkey" FOREIGN KEY ("cube_id") REFERENCES "CubeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
