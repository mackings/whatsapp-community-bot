import { API_BASE_URL } from "./config";
import type { Category, GroupSummary, StoredMessage } from "../types";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`);
  if (!res.ok) throw new Error(`request failed: ${res.status} ${path}`);
  return res.json() as Promise<T>;
}

export function fetchMessages(params: { groupJid?: string; category?: Category; limit?: number } = {}) {
  const query = new URLSearchParams();
  if (params.groupJid) query.set("groupJid", params.groupJid);
  if (params.category) query.set("category", params.category);
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return get<{ messages: StoredMessage[] }>(`/api/messages${qs ? `?${qs}` : ""}`);
}

export function fetchGroups() {
  return get<{ groups: GroupSummary[] }>("/api/groups");
}

export function fetchPushPublicKey() {
  return get<{ publicKey: string | null }>("/api/push/public-key");
}

async function post(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`request failed: ${res.status} ${path}`);
}

export function subscribeToPush(subscription: PushSubscriptionJSON) {
  return post("/api/push/subscribe", subscription);
}

export function unsubscribeFromPush(endpoint: string) {
  return post("/api/push/unsubscribe", { endpoint });
}

export function logoutWhatsApp() {
  return post("/api/auth/logout", {});
}

export async function updateGroupSettings(
  jid: string,
  settings: { learnEnabled?: boolean; respondEnabled?: boolean }
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/groups/${encodeURIComponent(jid)}/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error(`request failed: ${res.status}`);
}
