import { getDb } from "./mongoClient.js";
import type { PushSubscription as WebPushSubscription } from "web-push";

interface SubscriptionDoc {
  _id: string; // endpoint
  subscription: WebPushSubscription;
  createdAt: number;
}

const subscriptions = () => getDb().collection<SubscriptionDoc>("push_subscriptions");

export async function saveSubscription(subscription: WebPushSubscription): Promise<void> {
  await subscriptions().replaceOne(
    { _id: subscription.endpoint },
    { subscription, createdAt: Date.now() },
    { upsert: true }
  );
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await subscriptions().deleteOne({ _id: endpoint });
}

export async function listSubscriptions(): Promise<WebPushSubscription[]> {
  const docs = await subscriptions().find({}).toArray();
  return docs.map((doc) => doc.subscription);
}
