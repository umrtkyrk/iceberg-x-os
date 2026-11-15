// The Cube Forum uses the real /api/forum endpoints; the backend needs FORUM_ENABLED=true as well.
export const FORUM_ENABLED = import.meta.env.VITE_CUBE_FORUM_ENABLED === 'true';

// Dark theme for the signed-in workspace. Off: no toggle, everything renders light.
export const DARK_THEME_ENABLED = import.meta.env.VITE_DARK_THEME_ENABLED === 'true';

// Cube focus panel on the Cube dashboard: next steps, mentor, and the activity signals mentors see.
export const CUBE_FOCUS_ENABLED = import.meta.env.VITE_CUBE_FOCUS_ENABLED === 'true';

// Image, PDF and DOCX attachments on progress updates and demo submissions.
export const ATTACHMENTS_ENABLED = import.meta.env.VITE_ATTACHMENTS_ENABLED === 'true';

// Mentor dashboard "My Cubes" panel built on the Cube signals (status, reasons, activity).
export const MENTOR_CUBES_ENABLED = import.meta.env.VITE_MENTOR_CUBES_ENABLED === 'true';

// Scoring v2 (docs/scoring-v2.md): disciplines and, later, rubrics and the new score. Admin screens only for now.
export const SCORING_V2_ENABLED = import.meta.env.VITE_SCORING_V2_ENABLED === 'true';

// Scoring v2 go-live: Cubes see their v2 score and can rate themselves. Pair with SCORING_V2_LIVE=true on the backend.
export const SCORING_V2_LIVE = import.meta.env.VITE_SCORING_V2_LIVE === 'true';
