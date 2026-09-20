import { MessageSquare, Settings, Users, X } from "lucide-react";
import type { ConnectionStatus, GroupSummary } from "../../types";
import { ConnectionStatusDot } from "../ui/ConnectionStatusDot";
import { NotificationBell } from "./NotificationBell";
import { LogoutButton } from "./LogoutButton";

interface SidebarProps {
  groups: GroupSummary[];
  selectedGroup?: string;
  onSelectGroup: (jid?: string) => void;
  onManageGroups: () => void;
  status: ConnectionStatus;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({
  groups,
  selectedGroup,
  onSelectGroup,
  onManageGroups,
  status,
  open,
  onClose,
}: SidebarProps) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col border-r border-surface-border
          bg-surface-raised transition-transform duration-200 ease-out
          ${open ? "translate-x-0" : "-translate-x-full"} md:static md:z-auto md:w-64 md:translate-x-0`}
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex items-center gap-2 border-b border-surface-border px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
            <MessageSquare size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-100">Community Bot</p>
            <ConnectionStatusDot status={status} />
          </div>
          <NotificationBell />
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-200 md:hidden"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <SectionLabel>Groups</SectionLabel>
          <SidebarItem
            active={!selectedGroup}
            onClick={() => {
              onSelectGroup(undefined);
              onClose();
            }}
          >
            <Users size={15} />
            All groups
          </SidebarItem>
          {groups.map((group) => (
            <SidebarItem
              key={group.jid}
              active={selectedGroup === group.jid}
              onClick={() => {
                onSelectGroup(group.jid);
                onClose();
              }}
            >
              <span className="truncate">{group.name}</span>
              <span className="ml-auto text-[10px] text-slate-500">{group.participantCount}</span>
            </SidebarItem>
          ))}
          {groups.length === 0 && (
            <p className="px-3 py-2 text-xs text-slate-500">
              No active groups — use Manage groups below to turn one on.
            </p>
          )}
        </nav>

        <div className="border-t border-surface-border p-3">
          <button
            onClick={() => {
              onManageGroups();
              onClose();
            }}
            className="mb-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
          >
            <Settings size={15} />
            Manage groups
          </button>
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{children}</p>
  );
}

function SidebarItem({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`mb-0.5 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
        active
          ? "bg-emerald-500/10 text-emerald-300"
          : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}
