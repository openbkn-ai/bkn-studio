import { useEffect, useRef, useState } from "react";

import type { CapabilityKind } from "@/modules/execution-factory-lab/types/capability";

const STORAGE_KEY = "execution-factory-lab:list-filters";

type StoredFilters = {
  kind?: CapabilityKind;
  status?: string;
  keyword?: string;
  groupId?: string;
};

function readStoredFilters(): StoredFilters {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as StoredFilters;
  } catch {
    return {};
  }
}

export function useLabListFilters(defaultKind: CapabilityKind = "all") {
  const stored = readStoredFilters();
  const [kind, setKind] = useState<CapabilityKind>(stored.kind ?? defaultKind);
  const [status, setStatus] = useState<string>(stored.status ?? "all");
  const [keyword, setKeyword] = useState(stored.keyword ?? "");
  const [groupId, setGroupId] = useState<string | undefined>(stored.groupId || undefined);
  const debounceRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ kind, status, keyword, groupId: groupId ?? "" } satisfies StoredFilters),
      );
    }, 300);

    return () => {
      window.clearTimeout(debounceRef.current);
    };
  }, [groupId, keyword, kind, status]);

  const clearAll = () => {
    setKeyword("");
    setKind("all");
    setStatus("all");
    setGroupId(undefined);
  };

  return {
    kind,
    setKind,
    status,
    setStatus,
    keyword,
    setKeyword,
    groupId,
    setGroupId,
    clearAll,
  };
}
