import { useState } from "react";
import { LogOut } from "lucide-react";
import { logoutWhatsApp } from "../../api/client";

export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!window.confirm("Unlink this WhatsApp account and relink a different one?")) return;
    setLoading(true);
    try {
      await logoutWhatsApp();
    } catch {
      window.alert("Failed to log out — check the backend is running.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50"
    >
      <LogOut size={15} />
      {loading ? "Logging out…" : "Log out & relink"}
    </button>
  );
}
