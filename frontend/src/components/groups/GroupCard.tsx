import { Calendar, FileText, Users, Video } from "lucide-react";
import type { GroupSummary } from "../../types";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function formatUpcoming(timestamp: number): string {
  const date = new Date(timestamp);
  const dayLabel = date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  const timeLabel = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${dayLabel} · ${timeLabel}`;
}

export function GroupCard({ group, onClick }: { group: GroupSummary; onClick: () => void }) {
  const isUpcomingSoon =
    group.nextMeetingAt !== null && group.nextMeetingAt - Date.now() <= THREE_DAYS_MS;

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-3 rounded-xl border border-surface-border bg-surface-raised p-4 text-left transition-colors hover:border-emerald-500/30 hover:bg-white/5"
    >
      <div className="flex w-full items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-slate-100">{group.name}</p>
        <span className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
          <Users size={12} />
          {group.participantCount}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <CountBadge icon={Video} count={group.meetingCount} label="Meetings" accent="text-indigo-300 bg-indigo-500/10" />
        <CountBadge icon={FileText} count={group.documentCount} label="Documents" accent="text-cyan-300 bg-cyan-500/10" />
        {group.announcementCount > 0 && (
          <CountBadge
            icon={Calendar}
            count={group.announcementCount}
            label="Announcements"
            accent="text-violet-300 bg-violet-500/10"
          />
        )}
      </div>

      {group.nextMeetingAt !== null && (
        <div
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${
            isUpcomingSoon ? "bg-indigo-500/15 text-indigo-300" : "bg-white/5 text-slate-400"
          }`}
        >
          <Video size={12} />
          Upcoming: {formatUpcoming(group.nextMeetingAt)}
        </div>
      )}
    </button>
  );
}

function CountBadge({
  icon: Icon,
  count,
  label,
  accent,
}: {
  icon: typeof Video;
  count: number;
  label: string;
  accent: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${accent}`}>
      <Icon size={12} />
      {count} {label}
    </span>
  );
}
