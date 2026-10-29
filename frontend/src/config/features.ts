// The Cube Forum uses the real /api/forum endpoints; the backend needs FORUM_ENABLED=true as well.
export const FORUM_ENABLED = import.meta.env.VITE_CUBE_FORUM_ENABLED === 'true';
