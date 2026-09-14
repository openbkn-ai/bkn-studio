/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import type { DataConnectDiscoverTab } from "@/modules/data-connect/contracts/scenes";
import { DataConnectDiscoverScene } from "@/modules/data-connect/scenes/DataConnectDiscoverScene";

function resolveDiscoverTab(value: string | null): DataConnectDiscoverTab {
  return value === "schedules" ? "schedules" : "tasks";
}

export function DataConnectDiscoverPage() {
  const { catalogId = "" } = useParams<{ catalogId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = resolveDiscoverTab(searchParams.get("tab"));

  useEffect(() => {
    if (searchParams.get("tab") === activeTab) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", activeTab);
    setSearchParams(nextParams, { replace: true });
  }, [activeTab, searchParams, setSearchParams]);

  return (
    <DataConnectDiscoverScene
      activeTab={activeTab}
      catalogId={catalogId}
      onTabChange={(nextTab) => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("tab", nextTab);
        setSearchParams(nextParams, { replace: true });
      }}
    />
  );
}
