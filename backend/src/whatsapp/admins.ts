import { getCachedGroupMetadata } from "./groupCache.js";
import { getLatestSenderNames } from "../db/messages.repo.js";
import type { GroupAdmin } from "../types/index.js";

/**
 * Group admins with a display name where we have one — sourced from the
 * most recent message we've seen from them, since group metadata itself
 * only carries JIDs, not names. Falls back to the JID's number if they've
 * never spoken in the group.
 */
export async function getGroupAdmins(groupJid: string): Promise<GroupAdmin[]> {
  const metadata = getCachedGroupMetadata(groupJid);
  if (!metadata) return [];

  const adminJids = metadata.participants.filter((p) => p.admin).map((p) => p.id);
  if (adminJids.length === 0) return [];

  const names = await getLatestSenderNames(groupJid, adminJids);
  return adminJids.map((jid) => ({ jid, name: names[jid] ?? jid.split("@")[0] }));
}
