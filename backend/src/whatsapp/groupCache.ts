import type { GroupMetadata, WASocket } from "@whiskeysockets/baileys";
import { saveGroup } from "../db/messages.repo.js";
import { logger } from "./logger.js";

/**
 * In-memory group metadata cache, as recommended by the Baileys docs
 * (avoids refetching metadata on every message) plus persistence of the
 * group list so the dashboard can show group names/participant counts.
 */
const cache = new Map<string, GroupMetadata>();

export function getCachedGroupMetadata(jid: string): GroupMetadata | undefined {
  return cache.get(jid);
}

function persist(metadata: GroupMetadata): void {
  // Some groups (e.g. a WhatsApp Community's parent group) can have no
  // subject set — fall back to the jid rather than violate the NOT NULL
  // constraint and crash the process.
  saveGroup({
    jid: metadata.id,
    name: metadata.subject || metadata.id,
    participantCount: metadata.participants.length,
    lastSyncedAt: Date.now(),
  });
}

export function primeGroupCache(sock: WASocket) {
  return async () => {
    const groups = await sock.groupFetchAllParticipating();
    for (const metadata of Object.values(groups)) {
      try {
        cache.set(metadata.id, metadata);
        persist(metadata);
      } catch (error) {
        logger.error({ error, groupJid: metadata.id }, "failed to persist group metadata");
      }
    }
    return groups;
  };
}

export function watchGroupUpdates(sock: WASocket): void {
  sock.ev.on("groups.update", async ([event]) => {
    if (!event.id) return;
    try {
      const metadata = await sock.groupMetadata(event.id);
      cache.set(metadata.id, metadata);
      persist(metadata);
    } catch (error) {
      logger.error({ error, groupJid: event.id }, "failed to handle groups.update");
    }
  });

  sock.ev.on("group-participants.update", async (event) => {
    try {
      const metadata = await sock.groupMetadata(event.id);
      cache.set(metadata.id, metadata);
      persist(metadata);
    } catch (error) {
      logger.error({ error, groupJid: event.id }, "failed to handle group-participants.update");
    }
  });
}
