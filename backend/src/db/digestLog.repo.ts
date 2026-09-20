import { db } from "./client.js";

export type DigestPeriod = "morning" | "evening";

const upsertStmt = db.prepare(`
  INSERT INTO digest_log (group_jid, period, last_sent_date)
  VALUES (@groupJid, @period, @date)
  ON CONFLICT(group_jid, period) DO UPDATE SET last_sent_date = excluded.last_sent_date
`);

export function getLastSentDate(groupJid: string, period: DigestPeriod): string | null {
  const row = db
    .prepare(
      "SELECT last_sent_date as lastSentDate FROM digest_log WHERE group_jid = @groupJid AND period = @period"
    )
    .get({ groupJid, period }) as { lastSentDate: string } | undefined;
  return row?.lastSentDate ?? null;
}

export function setLastSentDate(groupJid: string, period: DigestPeriod, date: string): void {
  upsertStmt.run({ groupJid, period, date });
}
