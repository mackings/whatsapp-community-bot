import { Router } from "express";
import { countByCategory, totalMessageCount } from "../../db/messages.repo.js";

export const statsRouter = Router();

statsRouter.get("/", async (req, res) => {
  const groupJid = typeof req.query.groupJid === "string" ? req.query.groupJid : undefined;

  res.json({
    total: await totalMessageCount(groupJid),
    byCategory: await countByCategory(groupJid),
  });
});
