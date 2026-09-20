import { ExternalLink, Video } from "lucide-react";
import type { StoredMessage } from "../../types";
import { extractFirstUrl } from "../../utils/text";

function startOfDay(timestamp: number): number {
  const d = new Date(timestamp);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function formatMeetingTime(timestamp: number): string {
  const diffDays = Math.round((startOfDay(timestamp) - startOfDay(Date.now())) / (24 * 60 * 60 * 1000));
  const timeLabel = new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const dateLabel = new Date(timestamp).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

  if (diffDays === 0) return `Today · ${timeLabel}`;
  if (diffDays === 1) return `Tomorrow · ${timeLabel}`;
  if (diffDays > 1 && diffDays <= 7) return `${dateLabel} (in ${diffDays}d) · ${timeLabel}`;
  return `${dateLabel} · ${timeLabel}`;
}

function sortMeetings(meetings: StoredMessage[]): StoredMessage[] {
  const now = Date.now();
  const upcoming = meetings
    .filter((m) => m.meetingTime !== null && m.meetingTime >= now)
    .sort((a, b) => a.meetingTime! - b.meetingTime!);
  const rest = meetings
    .filter((m) => !(m.meetingTime !== null && m.meetingTime >= now))
    .sort((a, b) => b.timestamp - a.timestamp);
  return [...upcoming, ...rest];
}

export function MeetingsList({ meetings, loading }: { meetings: StoredMessage[]; loading: boolean }) {
  if (loading) return <p className="text-sm text-slate-500">Loading meetings…</p>;

  if (meetings.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-surface-border p-6 text-center text-sm text-slate-500">
        No meeting links shared yet.
      </p>
    );
  }

  const sorted = sortMeetings(meetings);
  const now = Date.now();

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((meeting) => {
        const url = extractFirstUrl(meeting.text);
        const isUpcoming = meeting.meetingTime !== null && meeting.meetingTime >= now;

        return (
          <div
            key={meeting.id}
            className="flex items-start gap-3 rounded-xl border border-surface-border bg-surface-raised p-4"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300">
              <Video size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-100">{meeting.contentLabel ?? "Meeting link"}</p>
              {meeting.meetingTime !== null ? (
                <p className={`mt-0.5 text-xs ${isUpcoming ? "text-indigo-300" : "text-slate-500"}`}>
                  {formatMeetingTime(meeting.meetingTime)}
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-slate-500">No specific time given</p>
              )}
              <p className="mt-1 text-xs text-slate-500">
                Shared by {meeting.senderName} · {new Date(meeting.timestamp).toLocaleDateString()}
              </p>
            </div>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex shrink-0 items-center gap-1 rounded-md bg-indigo-500/15 px-2.5 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-500/25"
              >
                Join
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
