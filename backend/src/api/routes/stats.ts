import { Router } from "express";
import { countByCategory, totalMessageCount } from "../../db/messages.repo.js";

export const statsRouter = Router();

statsRouter.get("/", (req, res) => {
  const groupJid = typeof req.query.groupJid === "string" ? req.query.groupJid : undefined;

  res.json({
    total: totalMessageCount(groupJid),
    byCategory: countByCategory(groupJid),
  });
});
