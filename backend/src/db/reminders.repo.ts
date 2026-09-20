import { randomUUID } from "node:crypto";
import { db } from "./client.js";

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

const insertStmt = db.prepare(`
  INSERT INTO reminders
    (id, group_jid, group_name, user_jid, event_description, event_time, remind_at, status, created_at)
  VALUES
    (@id, @groupJid, @groupName, @userJid, @eventDescription, @eventTime, @remindAt, @status, @createdAt)
`);

export function createReminder(input: Omit<Reminder, "id" | "status" | "createdAt">): Reminder {
  const reminder: Reminder = {
    ...input,
    id: randomUUID(),
    status: "pending",
    createdAt: Date.now(),
  };
  insertStmt.run(reminder);
  return reminder;
}

export function getDueReminders(now: number): Reminder[] {
  return db
    .prepare(
      `SELECT id, group_jid as groupJid, group_name as groupName, user_jid as userJid,
              event_description as eventDescription, event_time as eventTime,
              remind_at as remindAt, status, created_at as createdAt
       FROM reminders
       WHERE status = 'pending' AND remind_at <= @now`
    )
    .all({ now }) as Reminder[];
}

export function markReminderStatus(id: string, status: ReminderStatus): void {
  db.prepare("UPDATE reminders SET status = @status WHERE id = @id").run({ id, status });
}
