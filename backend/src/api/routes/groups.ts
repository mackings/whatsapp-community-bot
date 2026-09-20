import { Router } from "express";
import {
  listGroups,
  getCategoryCountsByGroup,
  getNextMeetingByGroup,
  setGroupFlags,
} from "../../db/messages.repo.js";
import type { GroupSummary } from "../../types/index.js";

export const groupsRouter = Router();

groupsRouter.get("/", (_req, res) => {
  const groups = listGroups();
  const counts = getCategoryCountsByGroup(["document", "meeting", "announcement"]);
  const nextMeetings = getNextMeetingByGroup(Date.now());

  const summaries: GroupSummary[] = groups.map((group) => ({
    ...group,
    documentCount: counts[group.jid]?.document ?? 0,
    meetingCount: counts[group.jid]?.meeting ?? 0,
    announcementCount: counts[group.jid]?.announcement ?? 0,
    nextMeetingAt: nextMeetings[group.jid] ?? null,
  }));

  res.json({ groups: summaries });
});

groupsRouter.patch("/:jid/settings", (req, res) => {
  const { jid } = req.params;
  const { learnEnabled, respondEnabled } = req.body ?? {};

  if (learnEnabled === undefined && respondEnabled === undefined) {
    res.status(400).json({ error: "provide learnEnabled and/or respondEnabled" });
    return;
  }

  setGroupFlags(jid, { learnEnabled, respondEnabled });
  res.json({ ok: true });
});
