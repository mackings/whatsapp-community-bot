import type { Category, StoredMessage } from "../../types";
import { API_BASE_URL } from "../../api/config";
import { LinkedText } from "../ui/LinkedText";

const CATEGORY_STYLES: Record<Category, { label: string; className: string }> = {
  question: { label: "Question", className: "bg-amber-500/15 text-amber-300" },
  urgent: { label: "Urgent", className: "bg-red-500/15 text-red-300" },
  greeting: { label: "Greeting", className: "bg-sky-500/15 text-sky-300" },
  meeting: { label: "Meeting", className: "bg-indigo-500/15 text-indigo-300" },
  document: { label: "Document", className: "bg-cyan-500/15 text-cyan-300" },
  announcement: { label: "Announcement", className: "bg-violet-500/15 text-violet-300" },
  media: { label: "Media", className: "bg-pink-500/15 text-pink-300" },
  spam: { label: "Spam", className: "bg-zinc-500/15 text-zinc-400" },
  general: { label: "General", className: "bg-slate-500/15 text-slate-300" },
};

export function ActivityFeed({ messages, loading }: { messages: StoredMessage[]; loading: boolean }) {
  if (loading) return <p className="text-sm text-slate-500">Loading activity…</p>;

  if (messages.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-surface-border p-6 text-center text-sm text-slate-500">
        No messages yet.
      </p>
    );
  }

  const sorted = [...messages].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((message) => {
        const style = CATEGORY_STYLES[message.category] ?? CATEGORY_STYLES.general;
        const isImage = message.mediaUrl && message.messageType === "imageMessage";

        return (
          <div key={message.id} className="rounded-xl border border-surface-border bg-surface-raised p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-300">{message.senderName}</p>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${style.className}`}>
                  {style.label}
                </span>
                <span className="text-xs text-slate-500">{new Date(message.timestamp).toLocaleString()}</span>
              </div>
            </div>

            {isImage && (
              <img
                src={`${API_BASE_URL}${message.mediaUrl}`}
                alt="Shared media"
                className="mt-2 max-h-64 rounded-lg object-cover"
              />
            )}

            {message.text ? (
              <p className="mt-2 text-sm text-slate-200">
                <LinkedText text={message.text} />
              </p>
            ) : !isImage ? (
              <p className="mt-2 text-sm italic text-slate-500">[{message.messageType}]</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
