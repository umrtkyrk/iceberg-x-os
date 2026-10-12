-- Legendary badge rarity.
--
-- The single deliberate exception to "no ALTER TYPE" in this project's
-- deployment rule: ADD VALUE only appends a label to the enum. No table, row
-- or index is rewritten and no existing value changes. It is a one-way change
-- (Postgres cannot remove an enum value), and the new value must not be used
-- in the same transaction, so no badge is inserted here. The Legendary badge
-- and quests are created afterwards by backend/src/scripts/seedPeerContent.ts.

-- AlterEnum
ALTER TYPE "BadgeRarity" ADD VALUE 'Legendary';
