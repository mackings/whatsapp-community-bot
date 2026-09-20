import { db } from "./client.js";
import type { PushSubscription as WebPushSubscription } from "web-push";

const upsertStmt = db.prepare(`
  INSERT OR REPLACE INTO push_subscriptions (endpoint, subscription_json, created_at)
  VALUES (@endpoint, @subscriptionJson, @createdAt)
`);

export function saveSubscription(subscription: WebPushSubscription): void {
  upsertStmt.run({
    endpoint: subscription.endpoint,
    subscriptionJson: JSON.stringify(subscription),
    createdAt: Date.now(),
  });
}

export function removeSubscription(endpoint: string): void {
  db.prepare("DELETE FROM push_subscriptions WHERE endpoint = @endpoint").run({ endpoint });
}

export function listSubscriptions(): WebPushSubscription[] {
  const rows = db.prepare("SELECT subscription_json as subscriptionJson FROM push_subscriptions").all() as Array<{
    subscriptionJson: string;
  }>;
  return rows.map((row) => JSON.parse(row.subscriptionJson) as WebPushSubscription);
}
