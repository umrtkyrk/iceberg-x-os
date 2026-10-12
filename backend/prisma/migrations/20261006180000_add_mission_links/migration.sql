-- CreateTable (additive: new empty table, no existing table is touched)
CREATE TABLE "MissionLink" (
    "id" TEXT NOT NULL,
    "mission_id" TEXT NOT NULL,
    "predecessor_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MissionLink_mission_id_predecessor_id_key" ON "MissionLink"("mission_id", "predecessor_id");

-- CreateIndex
CREATE INDEX "MissionLink_predecessor_id_idx" ON "MissionLink"("predecessor_id");

-- AddForeignKey
ALTER TABLE "MissionLink" ADD CONSTRAINT "MissionLink_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionLink" ADD CONSTRAINT "MissionLink_predecessor_id_fkey" FOREIGN KEY ("predecessor_id") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
