// Where the FastAPI backend lives. Override with VITE_API_URL (see .env.example).
const raw = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || "http://localhost:8000";

export const API_BASE_URL = raw.replace(/\/+$/, "");

/** WebSocket endpoint of the backend (`/ws`), derived from the HTTP base URL. */
export const WS_URL = `${API_BASE_URL.replace(/^http/i, "ws")}/ws`;
