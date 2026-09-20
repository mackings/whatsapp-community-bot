import { Router } from "express";
import { env } from "../../config/env.js";
import { saveSubscription, removeSubscription } from "../../db/pushSubscriptions.repo.js";

export const pushRouter = Router();

pushRouter.get("/public-key", (_req, res) => {
  res.json({ publicKey: env.vapidPublicKey ?? null });
});

pushRouter.post("/subscribe", (req, res) => {
  const subscription = req.body;
  if (!subscription?.endpoint) {
    res.status(400).json({ error: "invalid subscription" });
    return;
  }
  saveSubscription(subscription);
  res.status(201).json({ ok: true });
});

pushRouter.post("/unsubscribe", (req, res) => {
  const { endpoint } = req.body ?? {};
  if (!endpoint) {
    res.status(400).json({ error: "endpoint required" });
    return;
  }
  removeSubscription(endpoint);
  res.json({ ok: true });
});
