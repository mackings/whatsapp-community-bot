import { getDb } from "./mongoClient.js";
import type { Category, CategoryCount, GroupInfo, StoredMessage } from "../types/index.js";

interface MessageDoc extends Omit<StoredMessage, "id"> {
  _id: string;
}

interface GroupDoc extends Omit<GroupInfo, "jid"> {
  _id: string;
}

const messages = () => getDb().collection<MessageDoc>("messages");
const groups = () => getDb().collection<GroupDoc>("groups");

function toStoredMessage(doc: MessageDoc): StoredMessage {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

function toGroupInfo(doc: GroupDoc): GroupInfo {
  const { _id, ...rest } = doc;
  return { jid: _id, ...rest };
}

export async function saveMessage(message: StoredMessage): Promise<void> {
  const { id, ...rest } = message;
  await messages().replaceOne({ _id: id }, rest, { upsert: true });
}

export async function getMessageById(id: string): Promise<StoredMessage | null> {
  const doc = await messages().findOne({ _id: id });
  return doc ? toStoredMessage(doc) : null;
}

export async function getLatestSenderNames(groupJid: string, senderJids: string[]): Promise<Record<string, string>> {
  if (senderJids.length === 0) return {};

  const docs = await messages()
    .find({ groupJid, senderJid: { $in: senderJids } })
    .sort({ timestamp: -1 })
    .toArray();

  const result: Record<string, string> = {};
  for (const doc of docs) {
    if (!(doc.senderJid in result)) result[doc.senderJid] = doc.senderName;
  }
  return result;
}

interface ListFilters {
  groupJid?: string;
  senderJid?: string;
  category?: Category;
  limit?: number;
  before?: number;
  after?: number;
}

export async function listMessages(filters: ListFilters): Promise<StoredMessage[]> {
  const query: Record<string, unknown> = {};
  if (filters.groupJid) query.groupJid = filters.groupJid;
  if (filters.senderJid) query.senderJid = filters.senderJid;
  if (filters.category) query.category = filters.category;
  if (filters.before || filters.after) {
    query.timestamp = {
      ...(filters.before ? { $lt: filters.before } : {}),
      ...(filters.after ? { $gte: filters.after } : {}),
    };
  }

  const limit = Math.min(filters.limit ?? 50, 2000);
  const docs = await messages().find(query).sort({ timestamp: -1 }).limit(limit).toArray();
  return docs.map(toStoredMessage);
}

export async function countByCategory(groupJid?: string): Promise<CategoryCount[]> {
  const match = groupJid ? { groupJid } : {};
  const rows = await messages()
    .aggregate<{ _id: Category; count: number }>([
      { $match: match },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray();
  return rows.map((r) => ({ category: r._id, count: r.count }));
}

export async function totalMessageCount(groupJid?: string): Promise<number> {
  return messages().countDocuments(groupJid ? { groupJid } : {});
}

export async function saveGroup(
  group: Omit<GroupInfo, "learnEnabled" | "respondEnabled" | "startupReviewEnabled">
): Promise<void> {
  const { jid, ...rest } = group;
  await groups().updateOne(
    { _id: jid },
    { $set: rest, $setOnInsert: { learnEnabled: false, respondEnabled: false, startupReviewEnabled: false } },
    { upsert: true }
  );
}

export async function listGroups(): Promise<GroupInfo[]> {
  const docs = await groups().find({}).toArray();
  return docs.map(toGroupInfo).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export async function getGroupFlags(
  jid: string
): Promise<{ learnEnabled: boolean; respondEnabled: boolean; startupReviewEnabled: boolean } | null> {
  const doc = await groups().findOne({ _id: jid });
  if (!doc) return null;
  return {
    learnEnabled: Boolean(doc.learnEnabled),
    respondEnabled: Boolean(doc.respondEnabled),
    startupReviewEnabled: Boolean(doc.startupReviewEnabled),
  };
}

export async function setGroupFlags(
  jid: string,
  flags: { learnEnabled?: boolean; respondEnabled?: boolean; startupReviewEnabled?: boolean }
): Promise<void> {
  const update: Record<string, boolean> = {};
  if (flags.learnEnabled !== undefined) update.learnEnabled = flags.learnEnabled;
  if (flags.respondEnabled !== undefined) update.respondEnabled = flags.respondEnabled;
  if (flags.startupReviewEnabled !== undefined) update.startupReviewEnabled = flags.startupReviewEnabled;
  if (Object.keys(update).length === 0) return;

  await groups().updateOne({ _id: jid }, { $set: update });
}

export async function getCategoryCountsByGroup(
  categories: Category[]
): Promise<Record<string, Partial<Record<Category, number>>>> {
  const rows = await messages()
    .aggregate<{ _id: { groupJid: string; category: Category }; count: number }>([
      { $match: { category: { $in: categories } } },
      { $group: { _id: { groupJid: "$groupJid", category: "$category" }, count: { $sum: 1 } } },
    ])
    .toArray();

  const result: Record<string, Partial<Record<Category, number>>> = {};
  for (const row of rows) {
    (result[row._id.groupJid] ??= {})[row._id.category] = row.count;
  }
  return result;
}

export async function getNextMeetingByGroup(after: number): Promise<Record<string, number>> {
  const rows = await messages()
    .aggregate<{ _id: string; nextMeeting: number }>([
      { $match: { category: "meeting", meetingTime: { $ne: null, $gte: after } } },
      { $group: { _id: "$groupJid", nextMeeting: { $min: "$meetingTime" } } },
    ])
    .toArray();

  return Object.fromEntries(rows.map((r) => [r._id, r.nextMeeting]));
}
