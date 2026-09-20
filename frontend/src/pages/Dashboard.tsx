import { useState } from "react";
import { Sidebar } from "../components/layout/Sidebar";
import { MobileTopBar } from "../components/layout/MobileTopBar";
import { GroupsGrid } from "../components/groups/GroupsGrid";
import { GroupDetail } from "./GroupDetail";
import { ManageGroups } from "./ManageGroups";
import { QrPanel } from "../components/connection/QrPanel";
import { useGroups } from "../hooks/useGroups";
import { useRealtime } from "../hooks/useRealtime";

export function Dashboard() {
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined);
  const [managingGroups, setManagingGroups] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { liveMessages, status, qrCode } = useRealtime();
  const { groups: allGroups, loading } = useGroups(liveMessages.length);

  // The dashboard only ever surfaces groups the bot has been explicitly
  // turned on for — everything else stays out of sight (see ManageGroups).
  const groups = allGroups.filter((g) => g.learnEnabled || g.respondEnabled);

  const activeGroup = groups.find((g) => g.jid === selectedGroup);
  const title = managingGroups ? "Manage groups" : activeGroup?.name ?? "All groups";

  function openGroup(jid: string) {
    setManagingGroups(false);
    setSelectedGroup(jid);
  }

  return (
    <div className="flex h-screen bg-surface">
      <Sidebar
        groups={groups}
        selectedGroup={selectedGroup}
        onSelectGroup={(jid) => {
          setManagingGroups(false);
          setSelectedGroup(jid);
        }}
        onManageGroups={() => {
          setManagingGroups(true);
          setSelectedGroup(undefined);
        }}
        status={status}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar title={title} onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
            {qrCode && status !== "open" && (
              <div className="mb-6">
                <QrPanel qrCode={qrCode} />
              </div>
            )}

            {managingGroups ? (
              <ManageGroups onBack={() => setManagingGroups(false)} />
            ) : activeGroup ? (
              <GroupDetail
                group={activeGroup}
                liveMessages={liveMessages}
                onBack={() => setSelectedGroup(undefined)}
              />
            ) : (
              <>
                <header className="mb-6 hidden md:block">
                  <h1 className="text-xl font-semibold text-slate-100">All groups</h1>
                  <p className="text-sm text-slate-500">
                    Pick a group to see its meetings, documents, and announcements.
                  </p>
                </header>
                <GroupsGrid groups={groups} loading={loading} onSelectGroup={openGroup} />
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
