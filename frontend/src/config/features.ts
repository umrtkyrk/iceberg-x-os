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
