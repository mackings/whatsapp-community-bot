import { randomUUID } from "node:crypto";
import { getDb } from "./mongoClient.js";

export type ReminderStatus = "pending" | "sent" | "failed";

export interface Reminder {
  id: string;
  groupJid: string;
  groupName: string;
  userJid: string;
  eventDescription: string;
  eventTime: number;
  remindAt: number;
  status: ReminderStatus;
  createdAt: number;
}

interface ReminderDoc extends Omit<Reminder, "id"> {
  _id: string;
}

const reminders = () => getDb().collection<ReminderDoc>("reminders");

function toReminder(doc: ReminderDoc): Reminder {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

export async function createReminder(input: Omit<Reminder, "id" | "status" | "createdAt">): Promise<Reminder> {
  const reminder: Reminder = {
    ...input,
    id: randomUUID(),
    status: "pending",
    createdAt: Date.now(),
  };
  const { id, ...rest } = reminder;
  await reminders().insertOne({ _id: id, ...rest });
  return reminder;
}

export async function getDueReminders(now: number): Promise<Reminder[]> {
  const docs = await reminders()
    .find({ status: "pending", remindAt: { $lte: now } })
    .toArray();
  return docs.map(toReminder);
}

export async function markReminderStatus(id: string, status: ReminderStatus): Promise<void> {
  await reminders().updateOne({ _id: id }, { $set: { status } });
}
