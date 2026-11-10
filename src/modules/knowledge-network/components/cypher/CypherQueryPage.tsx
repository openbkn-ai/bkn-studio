/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useLocation, useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { hasPermissions } from "@/framework/permission/has-permissions";
import { buildReturnToState } from "@/modules/execution-factory/utils/back-navigation";
import type {
  CypherFunctionDraft,
  CypherFunctionDraftState,
} from "@/modules/execution-factory/utils/cypher-function-draft";
import { CypherQueryScene } from "@/modules/knowledge-network/components/cypher/CypherQueryScene";

/**
 * The data query page in a network's workspace. A viewer who can edit functions may publish a
 * statement: it opens as a new Cypher function in the chosen toolbox's workbench, whose back
 * button returns here.
 */
export function CypherQueryPage({ networkId, knId }: { networkId: string; knId: string }) {
  const { runtimeConfig } = useAppServices();
  const navigate = useNavigate();
  const location = useLocation();
  const canEditFunction = hasPermissions({
    currentPermissions: runtimeConfig.currentUser.permissions,
    requiredPermissions: "execution-factory:function:edit",
  });

  const publish = (boxId: string, cypherDraft: CypherFunctionDraft) => {
    const state: CypherFunctionDraftState & ReturnType<typeof buildReturnToState> = {
      ...buildReturnToState(location),
      cypherDraft,
    };
    void navigate(`/execution-factory/toolboxes/${encodeURIComponent(boxId)}/tools`, { state });
  };

  return (
    <CypherQueryScene
      knId={knId}
      networkId={networkId}
      onPublishFunction={canEditFunction ? publish : undefined}
    />
  );
}
