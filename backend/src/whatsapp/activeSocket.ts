import type { WASocket } from "@whiskeysockets/baileys";

let activeSocket: WASocket | null = null;

export function setActiveSocket(sock: WASocket): void {
  activeSocket = sock;
}

export function getActiveSocket(): WASocket | null {
  return activeSocket;
}
