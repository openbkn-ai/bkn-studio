/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useNavigate } from "react-router-dom";

import { buildAppPath } from "@/app/router/app-paths";
import { refreshCurrentUser } from "@/framework/auth/current-user";
import { useAppServices } from "@/framework/context/use-app-services";
import { CreateMenu } from "@/modules/execution-factory/components/create-menu/CreateMenu";
import type { CreatedCapabilityPayload } from "@/modules/execution-factory/components/create-menu/AddCapabilityWizard";

type ExecutionUnitCreatePageProps = {
  activeTab: "mcp" | "skill";
};

/** A create-only grant must not route through the view-gated management list. */
export function ExecutionUnitCreatePage({ activeTab }: ExecutionUnitCreatePageProps) {
  const { runtimeConfig } = useAppServices();
  const navigate = useNavigate();

  const handleCreated = ({ id, tab, toolId }: CreatedCapabilityPayload) => {
    const destination = tab === "mcp"
      ? `/execution-factory/mcp/${id}`
      : tab === "skill"
        ? `/execution-factory/skills/${id}`
        : tab === "toolbox"
          ? `/execution-factory/toolboxes/${id}/tools${toolId ? `?toolId=${toolId}` : "?create=1"}`
          : `/execution-factory/units?activeTab=operator&detailId=${id}`;

    void (async () => {
      try {
        runtimeConfig.currentUser = await refreshCurrentUser();
        void navigate(destination);
      } catch {
        window.location.assign(buildAppPath(destination));
      }
    })();
  };

  return <CreateMenu activeTab={activeTab} autoOpen dedicatedMode={activeTab} onResourceCreated={handleCreated} />;
}
