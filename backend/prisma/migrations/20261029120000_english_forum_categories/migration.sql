-- The forum UI is English; rename the seeded categories to match. Topics and posts are untouched.
UPDATE "ForumCategory" SET name = 'Announcements & Rules', description = 'Community announcements, forum rules and important news.' WHERE id = 'announcements';
UPDATE "ForumCategory" SET name = 'Introductions', description = 'Tell us about yourself and say hello to new Cubes.' WHERE id = 'introductions';
UPDATE "ForumCategory" SET name = 'Tech Support', description = 'Share the error, what you tried and the relevant code; we will solve it together.' WHERE id = 'help';
UPDATE "ForumCategory" SET name = 'Project Logs', description = 'Describe what you are building, share your progress and get feedback.' WHERE id = 'showcase';
UPDATE "ForumCategory" SET name = 'Resource Library', description = 'Share a useful article, tool or learning resource with a short note.' WHERE id = 'resources';
UPDATE "ForumCategory" SET name = 'Off-Topic Lounge', description = 'From games to music to everyday life: a place to just chat.' WHERE id = 'lounge';
