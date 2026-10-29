/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ApartmentOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { AppButton } from "@/framework/ui/common/AppButton";
import { buildReturnToState } from "@/modules/execution-factory/utils/back-navigation";

const graphOverviewPath = (networkId: string) =>
  `/knowledge-network/workspace/${encodeURIComponent(networkId)}/graph-overview`;

/**
 * The graph overview's button in the network overview's header. The overview is a page of its own
 * without the workspace sidebar, so the button hands it this page as the way back.
 */
export function WorkspaceGraphOverviewAction({ networkId }: { networkId: string }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <AppButton
      data-testid="workspace-graph-overview-action"
      icon={<ApartmentOutlined />}
      onClick={() =>
        void navigate(graphOverviewPath(networkId), { state: buildReturnToState(location) })
      }
    >
      {t("knowledgeNetwork.graphOverview.openAction")}
    </AppButton>
  );
}
