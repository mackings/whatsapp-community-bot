import { ExternalLink, FileText } from "lucide-react";
import type { StoredMessage } from "../../types";
import { API_BASE_URL } from "../../api/config";
import { extractFirstUrl } from "../../utils/text";

export function DocumentsList({ documents, loading }: { documents: StoredMessage[]; loading: boolean }) {
  if (loading) return <p className="text-sm text-slate-500">Loading documents…</p>;

  if (documents.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-surface-border p-6 text-center text-sm text-slate-500">
        No documents or links shared yet.
      </p>
    );
  }

  const sorted = [...documents].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((doc) => {
        const href = doc.mediaUrl ? `${API_BASE_URL}${doc.mediaUrl}` : extractFirstUrl(doc.text);

        return (
          <div
            key={doc.id}
            className="flex items-start gap-3 rounded-xl border border-surface-border bg-surface-raised p-4"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
              <FileText size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-100">{doc.contentLabel ?? "Shared link"}</p>
              <p className="mt-1 text-xs text-slate-500">
                Shared by {doc.senderName} · {new Date(doc.timestamp).toLocaleDateString()}
              </p>
            </div>
            {href && (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="flex shrink-0 items-center gap-1 rounded-md bg-cyan-500/15 px-2.5 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/25"
              >
                Open
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
