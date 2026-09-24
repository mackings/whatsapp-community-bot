import { getDb } from "./mongoClient.js";

export type DigestPeriod = "morning" | "evening";

interface DigestLogDoc {
  _id: string; // `${groupJid}:${period}`
  lastSentDate: string;
}

const digestLog = () => getDb().collection<DigestLogDoc>("digest_log");

function docId(groupJid: string, period: DigestPeriod): string {
  return `${groupJid}:${period}`;
}

export async function getLastSentDate(groupJid: string, period: DigestPeriod): Promise<string | null> {
  const doc = await digestLog().findOne({ _id: docId(groupJid, period) });
  return doc?.lastSentDate ?? null;
}

export async function setLastSentDate(groupJid: string, period: DigestPeriod, date: string): Promise<void> {
  await digestLog().updateOne(
    { _id: docId(groupJid, period) },
    { $set: { lastSentDate: date } },
    { upsert: true }
  );
}
