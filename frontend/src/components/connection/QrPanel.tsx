import { Smartphone } from "lucide-react";

export function QrPanel({ qrCode }: { qrCode: string }) {
  return (
    <div className="flex flex-col items-center gap-5 rounded-xl border border-surface-border bg-surface-raised p-8 text-center">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
        <Smartphone size={16} className="text-emerald-400" />
        Link WhatsApp to start receiving messages
      </div>

      <div className="rounded-lg bg-white p-3">
        <img src={qrCode} alt="WhatsApp linking QR code" width={220} height={220} />
      </div>

      <ol className="max-w-sm list-decimal space-y-1 text-left text-xs text-slate-400 marker:text-slate-600">
        <li>Open WhatsApp on the phone you want to use for the bot.</li>
        <li>Go to Settings → Linked Devices → Link a Device.</li>
        <li>Scan this code before it refreshes (~20s).</li>
      </ol>

      <p className="text-xs text-slate-500">
        This code refreshes automatically until it's scanned — use a dedicated/burner number,
        not your personal one.
      </p>
    </div>
  );
}
