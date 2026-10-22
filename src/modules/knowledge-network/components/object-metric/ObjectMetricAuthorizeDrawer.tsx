/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { KnowledgeNetworkObjectAuthorizeDrawer } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkObjectAuthorizeDrawer";
import type { ObjectMetricRecordV1 } from "@/modules/knowledge-network/types/object-metric";

type Props = {
  metric?: ObjectMetricRecordV1 | null;
  networkId: string;
  networkName?: string;
  onClose: () => void;
  open: boolean;
};

/** Adapts a visible versioned metric to its version-independent Safe resource. */
export function ObjectMetricAuthorizeDrawer({
  metric,
  networkId,
  networkName,
  onClose,
  open,
}: Props) {
  return (
    <KnowledgeNetworkObjectAuthorizeDrawer
      networkId={networkId}
      networkName={networkName}
      objectType="metric"
      onClose={onClose}
      open={open}
      record={
        metric
          ? {
              id: metric.definition.id,
              name: metric.definition.name,
              // Object-metric list and detail endpoints require view_detail. The V1 response does
              // not project operations yet, so a successfully loaded record is the visibility proof.
              operations: ["view_detail"],
            }
          : null
      }
    />
  );
}
