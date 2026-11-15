-- CreateTable
CREATE TABLE "Criterion" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discipline_id" TEXT,
    "legacy_key" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Criterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RubricLevel" (
    "id" TEXT NOT NULL,
    "criterion_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RubricLevel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Criterion_key_key" ON "Criterion"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Criterion_legacy_key_key" ON "Criterion"("legacy_key");

-- CreateIndex
CREATE INDEX "Criterion_discipline_id_idx" ON "Criterion"("discipline_id");

-- CreateIndex
CREATE UNIQUE INDEX "RubricLevel_criterion_id_level_key" ON "RubricLevel"("criterion_id", "level");

-- AddForeignKey
ALTER TABLE "Criterion" ADD CONSTRAINT "Criterion_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "Discipline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RubricLevel" ADD CONSTRAINT "RubricLevel_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "Criterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Seed the scoring v2 criteria and rubric drafts from docs/scoring-v2.md.
-- Fixed ids keep this deterministic; admins edit the wording in the app afterwards.
INSERT INTO "Criterion" ("id", "key", "name", "discipline_id", "legacy_key", "sort_order", "updated_at") VALUES
  ('6a1c2e4f-3b5d-4e7f-8a90-000000000001', 'ownership', 'Ownership', NULL, 'ownership_score', 10, CURRENT_TIMESTAMP),
  ('6a1c2e4f-3b5d-4e7f-8a90-000000000002', 'communication', 'Communication', NULL, 'communication_score', 20, CURRENT_TIMESTAMP),
  ('6a1c2e4f-3b5d-4e7f-8a90-000000000003', 'collaboration_leadership', 'Collaboration & leadership', NULL, 'leadership_score', 30, CURRENT_TIMESTAMP),
  ('6a1c2e4f-3b5d-4e7f-8a90-000000000004', 'reliability', 'Reliability', NULL, 'reliability_score', 40, CURRENT_TIMESTAMP),
  ('6a1c2e4f-3b5d-4e7f-8a90-000000000005', 'self_reflection', 'Self-reflection', NULL, 'self_reflection_score', 50, CURRENT_TIMESTAMP),
  ('6a1c2e4f-3b5d-4e7f-8a90-000000000006', 'problem_business_thinking', 'Problem & business thinking', NULL, 'product_thinking_score', 60, CURRENT_TIMESTAMP),
  ('6a1c2e4f-3b5d-4e7f-8a90-000000000007', 'technical_ability', 'Technical ability', '5f0e8a3c-0d1b-4c6e-9a01-000000000001', 'technical_ability_score', 70, CURRENT_TIMESTAMP),
  ('6a1c2e4f-3b5d-4e7f-8a90-000000000008', 'research', 'Research', '5f0e8a3c-0d1b-4c6e-9a01-000000000001', 'research_ability_score', 80, CURRENT_TIMESTAMP),
  ('6a1c2e4f-3b5d-4e7f-8a90-000000000009', 'demo_output', 'Demo & output', '5f0e8a3c-0d1b-4c6e-9a01-000000000001', 'demo_output_score', 90, CURRENT_TIMESTAMP),
  ('6a1c2e4f-3b5d-4e7f-8a90-000000000010', 'content_quality', 'Content & creative quality', '5f0e8a3c-0d1b-4c6e-9a01-000000000002', NULL, 100, CURRENT_TIMESTAMP),
  ('6a1c2e4f-3b5d-4e7f-8a90-000000000011', 'campaign_execution', 'Campaign execution', '5f0e8a3c-0d1b-4c6e-9a01-000000000002', NULL, 110, CURRENT_TIMESTAMP),
  ('6a1c2e4f-3b5d-4e7f-8a90-000000000012', 'data_analysis', 'Data & analysis', '5f0e8a3c-0d1b-4c6e-9a01-000000000002', NULL, 120, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RubricLevel" ("id", "criterion_id", "level", "description", "updated_at") VALUES
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000101', '6a1c2e4f-3b5d-4e7f-8a90-000000000001', 1, 'Waits to be told; tasks stall without follow-up.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000102', '6a1c2e4f-3b5d-4e7f-8a90-000000000001', 2, 'Finishes assigned work when reminded; rarely flags problems early.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000103', '6a1c2e4f-3b5d-4e7f-8a90-000000000001', 3, 'Finishes what they take on and says when they are stuck.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000104', '6a1c2e4f-3b5d-4e7f-8a90-000000000001', 4, 'Removes their own blockers and keeps others informed without being asked.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000105', '6a1c2e4f-3b5d-4e7f-8a90-000000000001', 5, 'Takes responsibility for the outcome, not just the task; spots and closes gaps nobody assigned.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000201', '6a1c2e4f-3b5d-4e7f-8a90-000000000002', 1, 'Updates are missing or unclear; others have to chase.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000202', '6a1c2e4f-3b5d-4e7f-8a90-000000000002', 2, 'Shares status when asked; key details are often missing.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000203', '6a1c2e4f-3b5d-4e7f-8a90-000000000002', 3, 'Clear, regular updates; explains what they did and what is next.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000204', '6a1c2e4f-3b5d-4e7f-8a90-000000000002', 4, 'Adapts the message to the audience; written work needs little clarification.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000205', '6a1c2e4f-3b5d-4e7f-8a90-000000000002', 5, 'Makes complex work easy to follow for anyone, and raises the quality of team communication.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000301', '6a1c2e4f-3b5d-4e7f-8a90-000000000003', 1, 'Works in isolation; friction with teammates.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000302', '6a1c2e4f-3b5d-4e7f-8a90-000000000003', 2, 'Cooperates when asked; contributes little to team decisions.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000303', '6a1c2e4f-3b5d-4e7f-8a90-000000000003', 3, 'A reliable teammate; shares work and helps when asked.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000304', '6a1c2e4f-3b5d-4e7f-8a90-000000000003', 4, 'Helps others unprompted; coordinates parts of the team''s work.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000305', '6a1c2e4f-3b5d-4e7f-8a90-000000000003', 5, 'Lifts the team: unblocks others, resolves disagreements, takes the lead when it is needed.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000401', '6a1c2e4f-3b5d-4e7f-8a90-000000000004', 1, 'Misses commitments and meetings without notice.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000402', '6a1c2e4f-3b5d-4e7f-8a90-000000000004', 2, 'Meets some commitments; slips are flagged late.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000403', '6a1c2e4f-3b5d-4e7f-8a90-000000000004', 3, 'Meets commitments or flags changes in good time.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000404', '6a1c2e4f-3b5d-4e7f-8a90-000000000004', 4, 'Consistently delivers what and when they said; plans realistically.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000405', '6a1c2e4f-3b5d-4e7f-8a90-000000000004', 5, 'Others plan around them with confidence; protects the team''s deadlines.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000501', '6a1c2e4f-3b5d-4e7f-8a90-000000000005', 1, 'Does not acknowledge mistakes or feedback.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000502', '6a1c2e4f-3b5d-4e7f-8a90-000000000005', 2, 'Accepts feedback but repeats the same issues.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000503', '6a1c2e4f-3b5d-4e7f-8a90-000000000005', 3, 'Recognises what went well and what did not; acts on feedback.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000504', '6a1c2e4f-3b5d-4e7f-8a90-000000000005', 4, 'Seeks feedback actively; the next piece of work shows the change.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000505', '6a1c2e4f-3b5d-4e7f-8a90-000000000005', 5, 'Turns their own lessons into practices others can use.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000601', '6a1c2e4f-3b5d-4e7f-8a90-000000000006', 1, 'Executes without understanding the why.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000602', '6a1c2e4f-3b5d-4e7f-8a90-000000000006', 2, 'Understands the task but not who it is for.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000603', '6a1c2e4f-3b5d-4e7f-8a90-000000000006', 3, 'Connects the work to the user or business goal.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000604', '6a1c2e4f-3b5d-4e7f-8a90-000000000006', 4, 'Questions the brief when needed; proposes better options with reasons.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000605', '6a1c2e4f-3b5d-4e7f-8a90-000000000006', 5, 'Shapes what should be built or done, and why, with clear judgement on trade-offs.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000701', '6a1c2e4f-3b5d-4e7f-8a90-000000000007', 1, 'Needs step-by-step help for routine tasks.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000702', '6a1c2e4f-3b5d-4e7f-8a90-000000000007', 2, 'Handles routine tasks; struggles with unfamiliar code.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000703', '6a1c2e4f-3b5d-4e7f-8a90-000000000007', 3, 'Delivers working, readable code for the mission''s scope.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000704', '6a1c2e4f-3b5d-4e7f-8a90-000000000007', 4, 'Makes sound design choices; code needs little review rework.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000705', '6a1c2e4f-3b5d-4e7f-8a90-000000000007', 5, 'Solves hard technical problems cleanly; others learn from their code.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000801', '6a1c2e4f-3b5d-4e7f-8a90-000000000008', 1, 'Does not investigate before building.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000802', '6a1c2e4f-3b5d-4e7f-8a90-000000000008', 2, 'Looks for an answer but stops at the first source.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000803', '6a1c2e4f-3b5d-4e7f-8a90-000000000008', 3, 'Compares options and documents the findings.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000804', '6a1c2e4f-3b5d-4e7f-8a90-000000000008', 4, 'Research changes the direction of the work for the better.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000805', '6a1c2e4f-3b5d-4e7f-8a90-000000000008', 5, 'Produces research others reuse; finds non-obvious answers.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000901', '6a1c2e4f-3b5d-4e7f-8a90-000000000009', 1, 'Nothing demonstrable at the end.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000902', '6a1c2e4f-3b5d-4e7f-8a90-000000000009', 2, 'A partial demo; the core value is unclear.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000903', '6a1c2e4f-3b5d-4e7f-8a90-000000000009', 3, 'A working demo of the agreed scope.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000904', '6a1c2e4f-3b5d-4e7f-8a90-000000000009', 4, 'A polished demo that clearly shows value and limits.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000000905', '6a1c2e4f-3b5d-4e7f-8a90-000000000009', 5, 'Output ready to hand over or to build on directly.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000001001', '6a1c2e4f-3b5d-4e7f-8a90-000000000010', 1, 'Off-brand or error-prone work that needs a full rewrite.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000001002', '6a1c2e4f-3b5d-4e7f-8a90-000000000010', 2, 'Usable after significant edits.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000001003', '6a1c2e4f-3b5d-4e7f-8a90-000000000010', 3, 'On-brand, accurate work that needs light edits.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000001004', '6a1c2e4f-3b5d-4e7f-8a90-000000000010', 4, 'Strong ideas and execution; ready to publish.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000001005', '6a1c2e4f-3b5d-4e7f-8a90-000000000010', 5, 'Distinctive work that sets the bar for others.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000001101', '6a1c2e4f-3b5d-4e7f-8a90-000000000011', 1, 'Tasks are left incomplete; no plan.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000001102', '6a1c2e4f-3b5d-4e7f-8a90-000000000011', 2, 'Executes parts of a plan with frequent gaps.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000001103', '6a1c2e4f-3b5d-4e7f-8a90-000000000011', 3, 'Runs a planned campaign end to end on schedule.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000001104', '6a1c2e4f-3b5d-4e7f-8a90-000000000011', 4, 'Anticipates issues; coordinates channels and people smoothly.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000001105', '6a1c2e4f-3b5d-4e7f-8a90-000000000011', 5, 'Runs complex campaigns independently; improves the process as they go.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000001201', '6a1c2e4f-3b5d-4e7f-8a90-000000000012', 1, 'Does not measure results.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000001202', '6a1c2e4f-3b5d-4e7f-8a90-000000000012', 2, 'Reports numbers without interpretation.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000001203', '6a1c2e4f-3b5d-4e7f-8a90-000000000012', 3, 'Tracks the right metrics and explains what they mean.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000001204', '6a1c2e4f-3b5d-4e7f-8a90-000000000012', 4, 'Uses data to change decisions; sets up useful measurement.', CURRENT_TIMESTAMP),
  ('7b2d3f5a-4c6e-4f80-9ba1-000000001205', '6a1c2e4f-3b5d-4e7f-8a90-000000000012', 5, 'Finds insights that change strategy; others rely on their analysis.', CURRENT_TIMESTAMP)
ON CONFLICT ("criterion_id", "level") DO NOTHING;
