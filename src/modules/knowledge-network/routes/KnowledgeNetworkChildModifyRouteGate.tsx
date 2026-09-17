/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { type ReactNode, useCallback } from "react";
import { useParams } from "react-router-dom";

import { KnowledgeNetworkOperationRouteGate } from "./KnowledgeNetworkModifyRouteGate";

type OperationRecord = {
  operations?: string[];
};

export type KnowledgeNetworkChildRecordLoader = (
  networkId: string,
  resourceId: string,
) => Promise<OperationRecord | null>;

type KnowledgeNetworkChildModifyRouteGateProps = {
  children: ReactNode;
  loadResource: KnowledgeNetworkChildRecordLoader;
  resourceIdParam: string;
};

/**
 * Guards an existing child-resource editor with the resource instance's
 * effective modify operation. Creates use KnowledgeNetworkModifyRouteGate
 * because they require modify on the parent knowledge network instead.
 */
export function KnowledgeNetworkChildModifyRouteGate({
  children,
  loadResource,
  resourceIdParam,
}: KnowledgeNetworkChildModifyRouteGateProps) {
  const params = useParams<Record<string, string | undefined>>();
  const networkId = params.networkId ?? "";
  const resourceId = params[resourceIdParam] ?? "";
  const loadRecord = useCallback(
    () => (resourceId ? loadResource(networkId, resourceId) : Promise.resolve(null)),
    [loadResource, networkId, resourceId],
  );

  return (
    <KnowledgeNetworkOperationRouteGate
      loadRecord={loadRecord}
      redirectTo={`/knowledge-network/workspace/${networkId}/overview`}
    >
      {children}
    </KnowledgeNetworkOperationRouteGate>
  );
}
