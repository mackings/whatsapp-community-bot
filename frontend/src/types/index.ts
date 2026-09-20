export type Category =
  | "question"
  | "announcement"
  | "urgent"
  | "greeting"
  | "meeting"
  | "document"
  | "media"
  | "spam"
  | "general";

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
}

export interface GroupSummary extends GroupInfo {
  documentCount: number;
  meetingCount: number;
  announcementCount: number;
  nextMeetingAt: number | null;
}

export type ConnectionStatus = "connecting" | "open" | "closed";
