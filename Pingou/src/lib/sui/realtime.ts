/**
 * Realtime relay client — a singleton WebSocket to the sponsor backend.
 *
 * On connect we `register` our Sui address; the scanner sends a `notify` to the
 * scanned address; the backend pushes it to that address's open socket → the
 * scanned device shows "Connected!" instantly (no chain polling). Auto-reconnects.
 */
import { SPONSOR_API_URL, SPONSOR_SECRET } from './config';

export interface IncomingConnection {
  from: string;
  name?: string;
  avatar?: string;
  profileId?: string;
}

let ws: WebSocket | null = null;
let myAddress: string | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<(c: IncomingConnection) => void>();

function wsUrl(): string {
  const base = SPONSOR_API_URL.replace(/^http/, 'ws'); // http→ws, https→wss
  const q = SPONSOR_SECRET ? `?token=${encodeURIComponent(SPONSOR_SECRET)}` : '';
  return `${base}/ws${q}`;
}

function open() {
  if (!myAddress) return;
  try {
    ws = new WebSocket(wsUrl());
    ws.onopen = () => ws?.send(JSON.stringify({ type: 'register', address: myAddress }));
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(String(e.data));
        if (msg.type === 'connected') listeners.forEach((l) => l(msg as IncomingConnection));
      } catch {}
    };
    ws.onclose = () => scheduleReconnect();
    ws.onerror = () => {
      try {
        ws?.close();
      } catch {}
    };
  } catch {
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer || !myAddress) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    open();
  }, 3000);
}

export function connectRealtime(address: string) {
  if (myAddress === address && ws && ws.readyState === WebSocket.OPEN) return;
  myAddress = address;
  open();
}

export function disconnectRealtime() {
  myAddress = null;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  try {
    ws?.close();
  } catch {}
  ws = null;
}

/** Tell `to` that `from` just connected with them. */
export function notifyConnection(to: string, payload: IncomingConnection) {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'notify', to, ...payload }));
    }
  } catch {}
}

/** Subscribe to incoming connection notifications. Returns an unsubscribe fn. */
export function onConnection(cb: (c: IncomingConnection) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
