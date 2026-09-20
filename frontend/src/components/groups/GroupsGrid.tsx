import type { GroupSummary } from "../../types";
import { GroupCard } from "./GroupCard";

export function GroupsGrid({
  groups,
  loading,
  onSelectGroup,
}: {
  groups: GroupSummary[];
  loading: boolean;
  onSelectGroup: (jid: string) => void;
}) {
  if (loading) {
    return <div className="py-10 text-center text-sm text-slate-500">Loading groups…</div>;
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-surface-border py-14 text-center text-sm text-slate-500">
        No groups synced yet — link the bot to WhatsApp and add it to a group.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((group) => (
        <GroupCard key={group.jid} group={group} onClick={() => onSelectGroup(group.jid)} />
      ))}
    </div>
  );
}
