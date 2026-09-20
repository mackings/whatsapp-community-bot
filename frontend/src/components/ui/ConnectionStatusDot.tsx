import type { ConnectionStatus } from "../../types";

const STATUS_MAP: Record<ConnectionStatus, { label: string; className: string }> = {
  open: { label: "Connected", className: "bg-emerald-400" },
  connecting: { label: "Connecting…", className: "bg-amber-400 animate-pulse" },
  closed: { label: "Disconnected", className: "bg-rose-400" },
};

export function ConnectionStatusDot({ status }: { status: ConnectionStatus }) {
  const info = STATUS_MAP[status];
  return (
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <span className={`h-2 w-2 rounded-full ${info.className}`} />
      {info.label}
    </div>
  );
}
