export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

// Same host/port as the API, just ws(s):// instead of http(s):// — the
// backend serves the WebSocket at /ws on its one public port.
export const WS_URL = import.meta.env.VITE_WS_URL ?? `${API_BASE_URL.replace(/^http/, "ws")}/ws`;
