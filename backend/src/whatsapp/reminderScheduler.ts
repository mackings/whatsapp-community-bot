import { getDueReminders, markReminderStatus } from "../db/reminders.repo.js";
import { getActiveSocket } from "./activeSocket.js";
import { logger } from "./logger.js";

const POLL_INTERVAL_MS = 30_000;

/**
 * Polls for reminders whose time has come and DMs the requester. Runs
 * against whatever socket is currently connected (see activeSocket.ts) so
 * it survives reconnects without needing to be re-registered.
 */
export function startReminderScheduler(): void {
  setInterval(async () => {
    const sock = getActiveSocket();
    if (!sock) return;

    for (const reminder of await getDueReminders(Date.now())) {
      try {
        await sock.sendMessage(reminder.userJid, {
          text: `Reminder: ${reminder.eventDescription}\n(from ${reminder.groupName})`,
        });
        await markReminderStatus(reminder.id, "sent");
      } catch (error) {
        logger.error({ err: error, reminderId: reminder.id }, "failed to send reminder DM");
        await markReminderStatus(reminder.id, "failed");
      }
    }
  }, POLL_INTERVAL_MS);
}
