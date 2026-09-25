export const CATEGORIES = [
  "question",
  "announcement",
  "urgent",
  "greeting",
  "meeting",
  "document",
  "media",
  "spam",
  "general",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface StoredMessage {
  id: string;
  groupJid: string;
  groupName: string;
  senderJid: string;
  senderName: string;
  text: string;
  messageType: string;
  category: Category;
  timestamp: number;
  fromMe: boolean;
  mediaUrl: string | null;
  contentLabel: string | null;
  meetingTime: number | null;
}

export interface GroupInfo {
  jid: string;
  name: string;
  participantCount: number;
  lastSyncedAt: number;
  learnEnabled: boolean;
  respondEnabled: boolean;
  startupReviewEnabled: boolean;
}

export interface GroupSummary extends GroupInfo {
  documentCount: number;
  meetingCount: number;
  announcementCount: number;
  nextMeetingAt: number | null;
}

export interface CategoryCount {
  category: Category;
  count: number;
}

export interface Categorizer {
  categorize(input: { text: string; messageType: string }): Category;
}

export interface GroupAdmin {
  jid: string;
  name: string;
}
