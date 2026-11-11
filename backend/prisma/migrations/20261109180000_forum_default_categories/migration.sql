-- Seed only a completely empty forum. Never rename or recreate Admin-managed communities.
-- The local empty-baseline installer creates the schema without running historical label UPDATEs.
INSERT INTO "ForumCategory" (id, name, description, position, staff_only)
SELECT supplied.* FROM (VALUES
('announcements', 'Announcements & Rules', 'Community announcements, forum rules and important news.', 1, true),
('introductions', 'Introductions', 'Tell us about yourself and say hello to new Cubes.', 2, false),
('help', 'Tech Support', 'Share the error, what you tried and the relevant code; we will solve it together.', 3, false),
('showcase', 'Project Logs', 'Describe what you are building, share your progress and get feedback.', 4, false),
('resources', 'Resource Library', 'Share a useful article, tool or learning resource with a short note.', 5, false),
('lounge', 'Off-Topic Lounge', 'From games to music to everyday life: a place to just chat.', 6, false),
('ideas', 'Idea Workshop', 'Talk through new ideas and build on them together.', 7, false)
) AS supplied(id, name, description, position, staff_only)
WHERE NOT EXISTS (SELECT 1 FROM "ForumCategory")
ON CONFLICT (id) DO NOTHING;
