import { Bell, BellOff } from "lucide-react";
import { usePushNotifications } from "../../hooks/usePushNotifications";

export function NotificationBell() {
  const { supported, subscribed, loading, subscribe, unsubscribe } = usePushNotifications();

  if (!supported) return null;

  return (
    <button
      onClick={subscribed ? unsubscribe : subscribe}
      disabled={loading}
      title={subscribed ? "Turn off announcement notifications" : "Get notified about announcements"}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
        subscribed
          ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
          : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
      }`}
    >
      {subscribed ? <Bell size={16} /> : <BellOff size={16} />}
    </button>
  );
}
