import { ArrowLeft } from "lucide-react";
import { MeetingsList } from "../components/groups/MeetingsList";
import { DocumentsList } from "../components/groups/DocumentsList";
import { AnnouncementsList } from "../components/groups/AnnouncementsList";
import { ActivityFeed } from "../components/groups/ActivityFeed";
import { useGroupContent } from "../hooks/useGroupContent";
import type { GroupSummary, StoredMessage } from "../types";

export function GroupDetail({
  group,
  liveMessages,
  onBack,
}: {
  group: GroupSummary;
  liveMessages: StoredMessage[];
  onBack: () => void;
}) {
  const { meetings, documents, announcements, allMessages, loading } = useGroupContent(group.jid, liveMessages);

  return (
    <div className="flex flex-col gap-6">
      <button
        onClick={onBack}
        className="flex w-fit items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"
      >
        <ArrowLeft size={15} />
        All groups
      </button>

      <div>
        <h1 className="text-xl font-semibold text-slate-100">{group.name}</h1>
        <p className="text-sm text-slate-500">{group.participantCount} participants</p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-slate-300">All activity</h2>
        <ActivityFeed messages={allMessages} loading={loading} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-slate-300">Meetings</h2>
        <MeetingsList meetings={meetings} loading={loading} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-slate-300">Documents & links</h2>
        <DocumentsList documents={documents} loading={loading} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-slate-300">Announcements</h2>
        <AnnouncementsList announcements={announcements} loading={loading} />
      </section>
    </div>
  );
}
