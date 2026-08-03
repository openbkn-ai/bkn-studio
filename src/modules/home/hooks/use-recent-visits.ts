/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useCallback, useEffect, useState } from "react";

import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import {
  forgetRecentVisit,
  listRecentVisits,
  recordRecentVisit,
  type RecentVisit,
  type RecentVisitInput,
  type RecentVisitKind,
} from "@/modules/home/services/recent-visits.service";

/** 详情页加载出实体后调用,标题跟着最新命名走,深链和书签进入也能被记录。 */
export function useRecordRecentVisit() {
  const runtimeConfig = useRuntimeConfig();
  const userId = runtimeConfig.currentUser.id;

  return useCallback(
    (visit: RecentVisitInput) => {
      recordRecentVisit(userId, visit);
    },
    [userId],
  );
}

export function useRecentVisits() {
  const runtimeConfig = useRuntimeConfig();
  const userId = runtimeConfig.currentUser.id;
  const [visits, setVisits] = useState<RecentVisit[]>([]);

  useEffect(() => {
    setVisits(listRecentVisits(userId));
  }, [userId]);

  const forget = useCallback(
    (kind: RecentVisitKind, id: string) => {
      forgetRecentVisit(userId, kind, id);
      setVisits(listRecentVisits(userId));
    },
    [userId],
  );

  return { forget, visits };
}
