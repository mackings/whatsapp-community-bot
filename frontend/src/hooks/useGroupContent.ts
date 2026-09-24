import { useEffect, useMemo, useState } from "react";
import { fetchMessages } from "../api/client";
import type { Category, StoredMessage } from "../types";

function mergeByCategory(
  history: StoredMessage[],
  live: StoredMessage[],
  groupJid: string,
  category: Category
): StoredMessage[] {
  const merged = [...live, ...history];
  const seen = new Set<string>();
  return merged.filter((m) => {
    if (m.groupJid !== groupJid || m.category !== category) return false;
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

function mergeAll(history: StoredMessage[], live: StoredMessage[], groupJid: string): StoredMessage[] {
  const merged = [...live, ...history];
  const seen = new Set<string>();
  return merged.filter((m) => {
    if (m.groupJid !== groupJid) return false;
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

export function useGroupContent(groupJid: string, liveMessages: StoredMessage[]) {
  const [meetingsHistory, setMeetingsHistory] = useState<StoredMessage[]>([]);
  const [documentsHistory, setDocumentsHistory] = useState<StoredMessage[]>([]);
  const [announcementsHistory, setAnnouncementsHistory] = useState<StoredMessage[]>([]);
  const [allHistory, setAllHistory] = useState<StoredMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetchMessages({ groupJid, category: "meeting", limit: 100 }),
      fetchMessages({ groupJid, category: "document", limit: 100 }),
      fetchMessages({ groupJid, category: "announcement", limit: 50 }),
      fetchMessages({ groupJid, limit: 200 }),
    ])
      .then(([m, d, a, all]) => {
        if (!active) return;
        setMeetingsHistory(m.messages);
        setDocumentsHistory(d.messages);
        setAnnouncementsHistory(a.messages);
        setAllHistory(all.messages);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [groupJid]);

  const meetings = useMemo(
    () => mergeByCategory(meetingsHistory, liveMessages, groupJid, "meeting"),
    [meetingsHistory, liveMessages, groupJid]
  );
  const documents = useMemo(
    () => mergeByCategory(documentsHistory, liveMessages, groupJid, "document"),
    [documentsHistory, liveMessages, groupJid]
  );
  const announcements = useMemo(
    () => mergeByCategory(announcementsHistory, liveMessages, groupJid, "announcement"),
    [announcementsHistory, liveMessages, groupJid]
  );
  const allMessages = useMemo(
    () => mergeAll(allHistory, liveMessages, groupJid),
    [allHistory, liveMessages, groupJid]
  );

  return { meetings, documents, announcements, allMessages, loading };
}
