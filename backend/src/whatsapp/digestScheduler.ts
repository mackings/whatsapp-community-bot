import { listGroups, listMessages } from "../db/messages.repo.js";
import { getLastSentDate, setLastSentDate, type DigestPeriod } from "../db/digestLog.repo.js";
import { getCachedGroupMetadata } from "./groupCache.js";
import { getActiveSocket } from "./activeSocket.js";
import { generateDailyDigest } from "../assistant/dailyDigest.js";
import { getZonedParts, startOfDayUtc } from "./timezone.js";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

const CHECK_INTERVAL_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toHHMM(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Every minute, checks whether it's the configured morning/evening time in
 * DIGEST_TIMEZONE, and if so posts a Gemini-generated recap (tagging every
 * participant) to each group that had activity in the relevant period.
 * Per-group/period send state lives in digest_log so a restart mid-minute
 * (or a missed tick) can't double-post the same day's digest.
 */
export function startDigestScheduler(): void {
  setInterval(async () => {
    const sock = getActiveSocket();
    if (!sock) return;

    const now = new Date();
    const parts = getZonedParts(now, env.digestTimezone);
    const currentHHMM = toHHMM(parts.hour, parts.minute);

    let period: DigestPeriod | null = null;
    if (currentHHMM === env.digestMorningTime) period = "morning";
    else if (currentHHMM === env.digestEveningTime) period = "evening";
    if (!period) return;

    const todayKey = toDateKey(parts.year, parts.month, parts.day);

    for (const group of await listGroups()) {
      if (!group.respondEnabled) continue;
      if ((await getLastSentDate(group.jid, period)) === todayKey) continue;

      let rangeStart: number;
      let rangeEnd: number;
      let periodLabel: string;

      if (period === "evening") {
        rangeStart = startOfDayUtc(parts.year, parts.month, parts.day, env.digestTimezone);
        rangeEnd = now.getTime();
        periodLabel = "today";
      } else {
        rangeEnd = startOfDayUtc(parts.year, parts.month, parts.day, env.digestTimezone);
        rangeStart = rangeEnd - DAY_MS;
        periodLabel = "yesterday";
      }

      const history = await listMessages({ groupJid: group.jid, after: rangeStart, before: rangeEnd, limit: 2000 });
      if (history.length === 0) {
        await setLastSentDate(group.jid, period, todayKey); // quiet day — mark done, don't post an empty digest
        continue;
      }

      try {
        const digest = await generateDailyDigest({ groupName: group.name, period, periodLabel, history });
        if (!digest) continue;

        const metadata = getCachedGroupMetadata(group.jid);
        const botIds = new Set(
          [sock.user?.id, sock.user?.lid].filter((id): id is string => Boolean(id))
        );
        const participantJids = (metadata?.participants ?? [])
          .map((p) => p.id)
          .filter((id) => !botIds.has(id));

        const greeting = period === "morning" ? "Good morning everyone!" : "Good evening everyone!";
        const tagLine = participantJids.length
          ? `\n\n${participantJids.map((id) => `@${id.split("@")[0]}`).join(" ")}`
          : "";

        await sock.sendMessage(group.jid, {
          text: `${greeting}\n\n${digest}${tagLine}`,
          mentions: participantJids,
        });

        await setLastSentDate(group.jid, period, todayKey);
      } catch (error) {
        logger.error({ err: error, groupJid: group.jid, period }, "failed to send daily digest");
      }
    }
  }, CHECK_INTERVAL_MS);
}
