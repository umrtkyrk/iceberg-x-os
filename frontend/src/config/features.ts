// The legacy flag still reveals the route, but /forum now uses the real API.
export const FORUM_PREVIEW_ENABLED = import.meta.env.VITE_CUBE_FORUM_ENABLED === 'true'
  || import.meta.env.VITE_CUBE_FORUM_PREVIEW === 'true';
