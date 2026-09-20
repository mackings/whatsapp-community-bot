import { Router } from "express";
import { logoutAndRelink } from "../../whatsapp/connectionManager.js";
import { logger } from "../../whatsapp/logger.js";

export const authRouter = Router();

authRouter.post("/logout", async (_req, res) => {
  try {
    await logoutAndRelink();
    res.json({ ok: true });
  } catch (error) {
    logger.error({ error }, "logout request failed");
    res.status(500).json({ error: "failed to logout" });
  }
});
