import { useEffect, useRef, useState } from "react";
import { WS_URL } from "../api/config";
import type { ConnectionStatus, StoredMessage } from "../types";

interface RealtimeEvent {
  type: "message" | "status" | "qr";
  payload?: StoredMessage | ConnectionStatus | string | null;
}

/**
 * Subscribes to the backend's WebSocket feed and hands back the live stream
 * of new messages, the current WhatsApp connection status, and a QR code
 * data URL to render whenever the bot needs to be (re)linked. Reconnects
 * automatically with a short backoff if the socket drops.
 */
export function useRealtime() {
  const [liveMessages, setLiveMessages] = useState<StoredMessage[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout>;

    function connect() {
      const socket = new WebSocket(WS_URL);
      socketRef.current = socket;

      socket.onmessage = (event) => {
        const data: RealtimeEvent = JSON.parse(event.data);
        if (data.type === "message") {
          setLiveMessages((prev) => [data.payload as StoredMessage, ...prev].slice(0, 200));
        } else if (data.type === "status") {
          setStatus(data.payload as ConnectionStatus);
          if (data.payload === "open") setQrCode(null);
        } else if (data.type === "qr") {
          setQrCode((data.payload as string | null) ?? null);
        }
      };

      socket.onclose = () => {
        if (!cancelled) retryTimer = setTimeout(connect, 2000);
      };
    }

    connect();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      socketRef.current?.close();
    };
  }, []);

  return { liveMessages, status, qrCode };
}
