import webpush, { WebPushError } from "web-push";
import { env } from "../config/env.js";
import { listSubscriptions, removeSubscription } from "../db/pushSubscriptions.repo.js";
import { logger } from "../whatsapp/logger.js";

const isConfigured = Boolean(env.vapidPublicKey && env.vapidPrivateKey);

if (isConfigured) {
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey!, env.vapidPrivateKey!);
}

export async function sendPushToAllSubscribers(payload: { title: string; body: string }): Promise<void> {
  if (!isConfigured) return;

  const subscriptions = await listSubscriptions();
  const json = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(subscription, json);
      } catch (error) {
        // 404/410 means the browser unsubscribed or the subscription expired
        if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
          await removeSubscription(subscription.endpoint);
        } else {
          logger.error({ err: error }, "failed to send push notification");
        }
      }
    })
  );
}
