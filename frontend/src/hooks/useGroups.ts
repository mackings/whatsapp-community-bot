import { useEffect, useState } from "react";
import { fetchGroups } from "../api/client";
import type { GroupSummary } from "../types";

export function useGroups(refreshTrigger?: unknown) {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchGroups()
      .then(({ groups }) => active && setGroups(groups))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  return { groups, loading };
}
