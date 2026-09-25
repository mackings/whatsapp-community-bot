import { Router } from "express";
import {
  listGroups,
  getCategoryCountsByGroup,
  getNextMeetingByGroup,
  setGroupFlags,
} from "../../db/messages.repo.js";
import { getActiveSocket } from "../../whatsapp/activeSocket.js";
import type { GroupSummary } from "../../types/index.js";

export const groupsRouter = Router();

groupsRouter.get("/", async (_req, res) => {
  const groups = await listGroups();
  const counts = await getCategoryCountsByGroup(["document", "meeting", "announcement"]);
  const nextMeetings = await getNextMeetingByGroup(Date.now());

  const summaries: GroupSummary[] = groups.map((group) => ({
    ...group,
    documentCount: counts[group.jid]?.document ?? 0,
    meetingCount: counts[group.jid]?.meeting ?? 0,
    announcementCount: counts[group.jid]?.announcement ?? 0,
    nextMeetingAt: nextMeetings[group.jid] ?? null,
  }));

  res.json({ groups: summaries });
});

groupsRouter.patch("/:jid/settings", async (req, res) => {
  const { jid } = req.params;
  const { learnEnabled, respondEnabled, startupReviewEnabled } = req.body ?? {};

  if (learnEnabled === undefined && respondEnabled === undefined && startupReviewEnabled === undefined) {
    res.status(400).json({ error: "provide learnEnabled, respondEnabled, and/or startupReviewEnabled" });
    return;
  }

  await setGroupFlags(jid, { learnEnabled, respondEnabled, startupReviewEnabled });
  res.json({ ok: true });
});

groupsRouter.post("/:jid/send", async (req, res) => {
  const { jid } = req.params;
  const { text } = req.body ?? {};

  if (typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "provide text" });
    return;
  }

  const sock = getActiveSocket();
  if (!sock) {
    res.status(503).json({ error: "WhatsApp is not connected" });
    return;
  }

  await sock.sendMessage(jid, { text });
  res.json({ ok: true });
});
