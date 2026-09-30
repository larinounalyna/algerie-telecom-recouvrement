import { WS_URL } from "./config";

/** Events pushed by the backend after every write (see backend/app/realtime.py). */
export type RealtimeEventName =
  | "apres_gaia.created"
  | "apres_gaia_regelement.created"
  | "apres_gaia_regelement.validated"
  | "apres_gaia_regelement.refused"
  | "apres_gaia_regelement.deleted"
  | "apres_gaia_med.updated"
  | "apres_gaia_rappel.created"
  | "apres_gaia_rappel.resolved"
  | "apres_gaia_rappel.read"
  | "corporate_ar.changed";

export interface RealtimeMessage {
  event: RealtimeEventName | (string & {});
  payload: Record<string, unknown>;
}

type Handler = (msg: RealtimeMessage) => void;

// One shared WebSocket for the whole app, opened on the first subscriber and
// closed shortly after the last one leaves. Reconnects with a growing delay.
const handlers = new Set<Handler>();
let socket: WebSocket | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;
let attempts = 0;

function connect() {
  if (socket || typeof WebSocket === "undefined") return;
  const ws = new WebSocket(WS_URL);
  socket = ws;
  ws.onopen = () => {
    attempts = 0;
  };
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(String(e.data)) as RealtimeMessage;
      handlers.forEach((h) => h(msg));
    } catch {
      /* ignore malformed frames */
    }
  };
  ws.onclose = () => {
    if (socket === ws) socket = null;
    if (handlers.size > 0) {
      retry = setTimeout(connect, Math.min(15000, 1000 * 2 ** attempts++));
    }
  };
  ws.onerror = () => ws.close();
}

function disconnect() {
  if (retry) clearTimeout(retry);
  retry = null;
  const ws = socket;
  socket = null;
  ws?.close();
}

/** Subscribes to backend push events; returns the unsubscribe function. */
export function subscribeRealtime(handler: Handler): () => void {
  handlers.add(handler);
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = null;
  connect();
  return () => {
    handlers.delete(handler);
    if (handlers.size === 0) closeTimer = setTimeout(() => handlers.size === 0 && disconnect(), 1000);
  };
}
