"use client";

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let messageHandlers: Set<(msg: Record<string, unknown>) => void> = new Set();
let statusHandlers: Set<(connected: boolean) => void> = new Set();

export function connectWS(): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

  ws.onopen = () => {
    console.log("[WS] Connected");
    statusHandlers.forEach((h) => h(true));
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string) as Record<string, unknown>;
      messageHandlers.forEach((h) => h(msg));
    } catch { /* ignore */ }
  };

  ws.onclose = () => {
    console.log("[WS] Disconnected, reconnecting in 2s...");
    statusHandlers.forEach((h) => h(false));
    ws = null;
    reconnectTimer = setTimeout(connectWS, 2000);
  };

  ws.onerror = () => {
    ws?.close();
  };
}

export function sendWS(msg: object): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function onWSMessage(handler: (msg: Record<string, unknown>) => void): () => void {
  messageHandlers.add(handler);
  return () => messageHandlers.delete(handler);
}

export function onWSStatus(handler: (connected: boolean) => void): () => void {
  statusHandlers.add(handler);
  return () => statusHandlers.delete(handler);
}

export function disconnectWS(): void {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  ws?.close();
  ws = null;
}
