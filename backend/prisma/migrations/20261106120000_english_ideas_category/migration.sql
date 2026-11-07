-- 20261029120000_english_forum_categories ran before 20261029120000_forum_portal_integration
-- (same timestamp, alphabetical order), so the "ideas" category kept its Turkish seed text.
-- Only rename it while it still has that seed text, so a name set by an admin is kept.
UPDATE "ForumCategory"
SET name = 'Idea Workshop', description = 'Talk through new ideas and build on them together.'
WHERE id = 'ideas' AND name = 'Fikir atölyesi';
