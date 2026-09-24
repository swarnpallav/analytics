// AI features (Chat, Voice) are off unless VITE_ENABLE_AI=true is set. The server has a matching ENABLE_AI flag.
export const AI_ENABLED = import.meta.env.VITE_ENABLE_AI === 'true';
