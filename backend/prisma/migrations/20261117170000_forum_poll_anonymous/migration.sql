-- Anonymous polls: an additive flag, existing polls keep showing voters.

-- AlterTable
ALTER TABLE "ForumPoll" ADD COLUMN     "hide_voters" BOOLEAN NOT NULL DEFAULT false;

