import { db } from "./client.js";
import type { Category, CategoryCount, GroupInfo, StoredMessage } from "../types/index.js";

const insertMessageStmt = db.prepare(`
  INSERT OR REPLACE INTO messages
    (id, group_jid, group_name, sender_jid, sender_name, text, message_type, category, timestamp, from_me, media_url, content_label, meeting_time)
  VALUES
    (@id, @groupJid, @groupName, @senderJid, @senderName, @text, @messageType, @category, @timestamp, @fromMe, @mediaUrl, @contentLabel, @meetingTime)
`);

export function saveMessage(message: StoredMessage): void {
  insertMessageStmt.run({ ...message, fromMe: message.fromMe ? 1 : 0 });
}

export function getMessageById(id: string): StoredMessage | null {
  const row = db
    .prepare(
      `SELECT id, group_jid as groupJid, group_name as groupName, sender_jid as senderJid,
              sender_name as senderName, text, message_type as messageType, category,
              timestamp, from_me as fromMe, media_url as mediaUrl, content_label as contentLabel,
              meeting_time as meetingTime
       FROM messages WHERE id = @id`
    )
    .get({ id }) as (Omit<StoredMessage, "fromMe"> & { fromMe: number }) | undefined;

  if (!row) return null;
  return { ...row, fromMe: Boolean(row.fromMe) };
}

export function getLatestSenderNames(groupJid: string, senderJids: string[]): Record<string, string> {
  if (senderJids.length === 0) return {};

  const placeholders = senderJids.map((_, i) => `@jid${i}`).join(", ");
  const params: Record<string, unknown> = { groupJid };
  senderJids.forEach((jid, i) => (params[`jid${i}`] = jid));

  // SQLite's documented "bare column" behavior: when MAX() picks a unique
  // row per group, the other selected columns come from that same row —
  // this is the standard groupwise-max trick, not an arbitrary pick.
  const rows = db
    .prepare(
      `SELECT sender_jid as senderJid, sender_name as senderName, MAX(timestamp) as ts
       FROM messages
       WHERE group_jid = @groupJid AND sender_jid IN (${placeholders})
       GROUP BY sender_jid`
    )
    .all(params) as Array<{ senderJid: string; senderName: string; ts: number }>;

  return Object.fromEntries(rows.map((r) => [r.senderJid, r.senderName]));
}

interface ListFilters {
  groupJid?: string;
  category?: Category;
  limit?: number;
  before?: number;
  after?: number;
}

export function listMessages(filters: ListFilters): StoredMessage[] {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.groupJid) {
    clauses.push("group_jid = @groupJid");
    params.groupJid = filters.groupJid;
  }
  if (filters.category) {
    clauses.push("category = @category");
    params.category = filters.category;
  }
  if (filters.before) {
    clauses.push("timestamp < @before");
    params.before = filters.before;
  }
  if (filters.after) {
    clauses.push("timestamp >= @after");
    params.after = filters.after;
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.min(filters.limit ?? 50, 2000);

  const rows = db
    .prepare(
      `SELECT id, group_jid as groupJid, group_name as groupName, sender_jid as senderJid,
              sender_name as senderName, text, message_type as messageType, category,
              timestamp, from_me as fromMe, media_url as mediaUrl, content_label as contentLabel,
              meeting_time as meetingTime
       FROM messages ${where}
       ORDER BY timestamp DESC
       LIMIT @limit`
    )
    .all({ ...params, limit }) as Array<Omit<StoredMessage, "fromMe"> & { fromMe: number }>;

  return rows.map((row) => ({ ...row, fromMe: Boolean(row.fromMe) }));
}

export function countByCategory(groupJid?: string): CategoryCount[] {
  const where = groupJid ? "WHERE group_jid = @groupJid" : "";
  return db
    .prepare(
      `SELECT category, COUNT(*) as count FROM messages ${where} GROUP BY category ORDER BY count DESC`
    )
    .all({ groupJid }) as CategoryCount[];
}

export function totalMessageCount(groupJid?: string): number {
  const where = groupJid ? "WHERE group_jid = @groupJid" : "";
  const row = db
    .prepare(`SELECT COUNT(*) as count FROM messages ${where}`)
    .get({ groupJid }) as { count: number };
  return row.count;
}

const upsertGroupStmt = db.prepare(`
  INSERT INTO groups (jid, name, participant_count, last_synced_at)
  VALUES (@jid, @name, @participantCount, @lastSyncedAt)
  ON CONFLICT(jid) DO UPDATE SET
    name = excluded.name,
    participant_count = excluded.participant_count,
    last_synced_at = excluded.last_synced_at
`);

export function saveGroup(group: Omit<GroupInfo, "learnEnabled" | "respondEnabled">): void {
  upsertGroupStmt.run(group);
}

export function listGroups(): GroupInfo[] {
  const rows = db
    .prepare(
      `SELECT jid, name, participant_count as participantCount, last_synced_at as lastSyncedAt,
              learn_enabled as learnEnabled, respond_enabled as respondEnabled
       FROM groups ORDER BY name COLLATE NOCASE ASC`
    )
    .all() as Array<Omit<GroupInfo, "learnEnabled" | "respondEnabled"> & { learnEnabled: number; respondEnabled: number }>;

  return rows.map((row) => ({
    ...row,
    learnEnabled: Boolean(row.learnEnabled),
    respondEnabled: Boolean(row.respondEnabled),
  }));
}

export function getGroupFlags(jid: string): { learnEnabled: boolean; respondEnabled: boolean } | null {
  const row = db
    .prepare("SELECT learn_enabled as learnEnabled, respond_enabled as respondEnabled FROM groups WHERE jid = @jid")
    .get({ jid }) as { learnEnabled: number; respondEnabled: number } | undefined;

  if (!row) return null;
  return { learnEnabled: Boolean(row.learnEnabled), respondEnabled: Boolean(row.respondEnabled) };
}

export function setGroupFlags(jid: string, flags: { learnEnabled?: boolean; respondEnabled?: boolean }): void {
  const clauses: string[] = [];
  const params: Record<string, unknown> = { jid };

  if (flags.learnEnabled !== undefined) {
    clauses.push("learn_enabled = @learnEnabled");
    params.learnEnabled = flags.learnEnabled ? 1 : 0;
  }
  if (flags.respondEnabled !== undefined) {
    clauses.push("respond_enabled = @respondEnabled");
    params.respondEnabled = flags.respondEnabled ? 1 : 0;
  }
  if (clauses.length === 0) return;

  db.prepare(`UPDATE groups SET ${clauses.join(", ")} WHERE jid = @jid`).run(params);
}

export function getCategoryCountsByGroup(categories: Category[]): Record<string, Partial<Record<Category, number>>> {
  const placeholders = categories.map((_, i) => `@cat${i}`).join(", ");
  const params: Record<string, unknown> = {};
  categories.forEach((category, i) => (params[`cat${i}`] = category));

  const rows = db
    .prepare(
      `SELECT group_jid as groupJid, category, COUNT(*) as count
       FROM messages
       WHERE category IN (${placeholders})
       GROUP BY group_jid, category`
    )
    .all(params) as Array<{ groupJid: string; category: Category; count: number }>;

  const result: Record<string, Partial<Record<Category, number>>> = {};
  for (const row of rows) {
    (result[row.groupJid] ??= {})[row.category] = row.count;
  }
  return result;
}

export function getNextMeetingByGroup(after: number): Record<string, number> {
  const rows = db
    .prepare(
      `SELECT group_jid as groupJid, MIN(meeting_time) as nextMeeting
       FROM messages
       WHERE category = 'meeting' AND meeting_time IS NOT NULL AND meeting_time >= @after
       GROUP BY group_jid`
    )
    .all({ after }) as Array<{ groupJid: string; nextMeeting: number }>;

  return Object.fromEntries(rows.map((r) => [r.groupJid, r.nextMeeting]));
}
