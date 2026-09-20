import { Megaphone } from "lucide-react";
import type { StoredMessage } from "../../types";
import { LinkedText } from "../ui/LinkedText";

export function AnnouncementsList({
  announcements,
  loading,
}: {
  announcements: StoredMessage[];
  loading: boolean;
}) {
  if (loading) return <p className="text-sm text-slate-500">Loading announcements…</p>;

  if (announcements.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-surface-border p-6 text-center text-sm text-slate-500">
        No announcements yet.
      </p>
    );
  }

  const sorted = [...announcements].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((item) => (
        <div
          key={item.id}
          className="flex items-start gap-3 rounded-xl border border-surface-border bg-surface-raised p-4"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
            <Megaphone size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-200">
              <LinkedText text={item.text} />
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {item.senderName} · {new Date(item.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
