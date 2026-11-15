// The Cube Forum uses the real /api/forum endpoints; the backend needs FORUM_ENABLED=true as well.
export const FORUM_ENABLED = import.meta.env.VITE_CUBE_FORUM_ENABLED === 'true';

// Dark theme for the signed-in workspace. Off: no toggle, everything renders light.
export const DARK_THEME_ENABLED = import.meta.env.VITE_DARK_THEME_ENABLED === 'true';

// Cube focus panel on the Cube dashboard: next steps, mentor, and the activity signals mentors see.
export const CUBE_FOCUS_ENABLED = import.meta.env.VITE_CUBE_FOCUS_ENABLED === 'true';
