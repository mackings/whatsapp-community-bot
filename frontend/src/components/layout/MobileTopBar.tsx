import { Menu } from "lucide-react";
import { NotificationBell } from "./NotificationBell";

export function MobileTopBar({ title, onMenuClick }: { title: string; onMenuClick: () => void }) {
  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-3 border-b border-surface-border bg-surface-raised px-4 py-3 md:hidden"
      style={{ paddingTop: "env(safe-area-inset-top, 12px)" }}
    >
      <button
        onClick={onMenuClick}
        className="rounded-md p-1.5 text-slate-300 hover:bg-white/5"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>
      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-100">{title}</p>
      <NotificationBell />
    </header>
  );
}
