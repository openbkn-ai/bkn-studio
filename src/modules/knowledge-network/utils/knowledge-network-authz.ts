/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const knowledgeNetworkChildResourceTypes = [
  "concept_group",
  "object_type",
  "relation_type",
  "action_type",
  "metric",
  "risk_type",
] as const;

export type KnowledgeNetworkChildResourceType =
  (typeof knowledgeNetworkChildResourceTypes)[number];

/** bkn-safe identifies every child resource by its parent KN and child ID. */
export function knowledgeNetworkChildAuthorizationId(networkId: string, childId: string) {
  return `${networkId}/${childId}`;
}
