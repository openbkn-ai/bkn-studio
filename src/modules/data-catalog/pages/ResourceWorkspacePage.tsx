/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import type { ResourceIndexView } from "@/modules/data-catalog/lib/index-build-filters";
import {
  applyResourceIndexView,
  readResourceIndexView,
} from "@/modules/data-catalog/lib/index-build-filters";
import {
  ResourceWorkspaceScene,
  type ResourceWorkspaceTab,
} from "@/modules/data-catalog/scenes/ResourceWorkspaceScene";

function resolveResourceWorkspaceTab(value: string | null): ResourceWorkspaceTab {
  if (value === "preview") {
    return "preview";
  }
  if (value === "index") {
    return "index";
  }
  return "detail";
}

export function ResourceWorkspacePage() {
  const { resourceId = "" } = useParams<{ resourceId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = resolveResourceWorkspaceTab(searchParams.get("tab"));
  const indexView = readResourceIndexView(searchParams.get("tab"), searchParams.get("view"));

  const setIndexView = useCallback(
    (nextView: ResourceIndexView) => {
      const nextParams = applyResourceIndexView(searchParams, nextView);
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  return (
    <ResourceWorkspaceScene
      indexView={indexView}
      onIndexViewChange={setIndexView}
      onTabChange={(nextTab) => {
        const nextParams = new URLSearchParams(searchParams);
        if (nextTab === "detail") {
          nextParams.delete("tab");
        } else {
          nextParams.set("tab", nextTab);
        }
        if (nextTab !== "index") {
          nextParams.delete("view");
        }
        nextParams.delete("action");
        setSearchParams(nextParams, { replace: true });
      }}
      resourceId={resourceId}
      tab={tab}
    />
  );
}
