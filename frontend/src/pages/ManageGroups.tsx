import { useEffect, useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { fetchGroups, updateGroupSettings } from "../api/client";
import { Switch } from "../components/ui/Switch";
import type { GroupSummary } from "../types";

export function ManageGroups({ onBack }: { onBack: () => void }) {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchGroups()
      .then(({ groups }) => setGroups(groups))
      .finally(() => setLoading(false));
  }, []);

  async function toggleLearn(group: GroupSummary, value: boolean) {
    // turning learn off also turns off respond, since respond requires learn
    const next = { learnEnabled: value, respondEnabled: value ? group.respondEnabled : false };
    setGroups((prev) => prev.map((g) => (g.jid === group.jid ? { ...g, ...next } : g)));
    await updateGroupSettings(group.jid, next);
  }

  async function toggleRespond(group: GroupSummary, value: boolean) {
    setGroups((prev) => prev.map((g) => (g.jid === group.jid ? { ...g, respondEnabled: value } : g)));
    await updateGroupSettings(group.jid, { respondEnabled: value });
  }

  const filtered = groups.filter((g) => g.name.toLowerCase().includes(query.toLowerCase()));
  const active = filtered.filter((g) => g.learnEnabled || g.respondEnabled);
  const inactive = filtered.filter((g) => !g.learnEnabled && !g.respondEnabled);

  return (
    <div className="flex flex-col gap-6">
      <button onClick={onBack} className="flex w-fit items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200">
        <ArrowLeft size={15} />
        Back
      </button>

      <div>
        <h1 className="text-xl font-semibold text-slate-100">Manage groups</h1>
        <p className="text-sm text-slate-500">
          The bot only learns from or responds in groups you've explicitly turned on here — everything
          else stays completely untouched.
        </p>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search groups…"
          className="w-full rounded-lg border border-surface-border bg-surface-raised py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none"
        />
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading groups…</p>
      ) : (
        <>
          {active.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Active</h2>
              <div className="flex flex-col gap-1">
                {active.map((group) => (
                  <GroupRow
                    key={group.jid}
                    group={group}
                    onToggleLearn={toggleLearn}
                    onToggleRespond={toggleRespond}
                  />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              All groups ({inactive.length})
            </h2>
            <div className="flex flex-col gap-1">
              {inactive.map((group) => (
                <GroupRow
                  key={group.jid}
                  group={group}
                  onToggleLearn={toggleLearn}
                  onToggleRespond={toggleRespond}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function GroupRow({
  group,
  onToggleLearn,
  onToggleRespond,
}: {
  group: GroupSummary;
  onToggleLearn: (group: GroupSummary, value: boolean) => void;
  onToggleRespond: (group: GroupSummary, value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-surface-border bg-surface-raised px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-slate-200">{group.name}</p>
        <p className="text-xs text-slate-500">{group.participantCount} members</p>
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-400">
        Learn
        <Switch checked={group.learnEnabled} onChange={(v) => onToggleLearn(group, v)} />
      </label>
      <label className="flex items-center gap-2 text-xs text-slate-400">
        Respond
        <Switch
          checked={group.respondEnabled}
          onChange={(v) => onToggleRespond(group, v)}
          disabled={!group.learnEnabled}
        />
      </label>
    </div>
  );
}
