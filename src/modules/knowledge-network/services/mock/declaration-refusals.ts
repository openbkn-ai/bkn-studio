/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  ClearedDeclaration,
  NetworkCheckResult,
} from "@/modules/knowledge-network/types/knowledge-network";

/**
 * Mock mode answers like a backend whose risk network holds BKN spec 3.0 declarations, so the
 * refusals of an overwrite import and of a 3.0 export can be worked on without a backend.
 */
export const MOCK_DECLARED_NETWORK_ID = "kn-domain-risk";

export const mockClearedDeclarations: ClearedDeclaration[] = [
  { fields: ["aliases"], id: "ot-risk-order", kind: "object_type" },
  {
    fields: ["aliases", "constraints"],
    id: "ot-risk-order",
    kind: "object_type",
    property: "order_no",
  },
  {
    fields: ["semantic", "required"],
    id: "ot-risk-order",
    kind: "object_type",
    property: "created_at",
  },
  {
    fields: ["reverse_name", "cardinality", "importance"],
    id: "rt-risk-bind",
    kind: "relation_type",
  },
  { fields: ["aliases", "lifecycle"], id: "at-risk-block", kind: "action_type" },
];

export const mockNetworkCheckResult: NetworkCheckResult = {
  invalidParameters: [
    {
      actionTypeId: "at-risk-block",
      current: { valueFrom: "context" },
      parameter: "operator",
    },
  ],
  misplacedParameters: [
    {
      actionTypeId: "at-risk-block",
      conflict: false,
      current: { source: "property", value: "order_no" },
      parameter: "order_no",
      suggested: { value: "order_no", valueFrom: "property" },
    },
    {
      conflict: true,
      current: { source: "input" },
      logicProperty: "risk_score",
      objectTypeId: "ot-risk-order",
      parameter: "window_days",
      suggested: { valueFrom: "input" },
    },
  ],
};
