import { Router } from "express";
import { listMessages } from "../../db/messages.repo.js";
import { CATEGORIES, type Category } from "../../types/index.js";

export const messagesRouter = Router();

messagesRouter.get("/", async (req, res) => {
  const { groupJid, category, before } = req.query;

  if (category && !CATEGORIES.includes(category as Category)) {
    res.status(400).json({ error: `invalid category: ${category}` });
    return;
  }

  const messages = await listMessages({
    groupJid: typeof groupJid === "string" ? groupJid : undefined,
    category: typeof category === "string" ? (category as Category) : undefined,
    before: before ? Number(before) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });

  res.json({ messages });
});
