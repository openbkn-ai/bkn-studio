/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { KnowledgeNetworkMutationPayload } from "@/modules/knowledge-network/types/knowledge-network";

export const DEFAULT_KNOWLEDGE_NETWORK_BRANCH = "main";
export const DEFAULT_KNOWLEDGE_NETWORK_ICON = "icon-dip-graph";

export function toBackendKnowledgeNetworkCreatePayload(
  input: KnowledgeNetworkMutationPayload,
) {
  return {
    branch: DEFAULT_KNOWLEDGE_NETWORK_BRANCH,
    color: input.color,
    comment: input.description,
    icon: DEFAULT_KNOWLEDGE_NETWORK_ICON,
    id: input.identifier,
    name: input.name,
    tags: input.tags,
  };
}

export function toBackendKnowledgeNetworkUpdatePayload(
  input: KnowledgeNetworkMutationPayload,
) {
  return {
    branch: DEFAULT_KNOWLEDGE_NETWORK_BRANCH,
    color: input.color,
    comment: input.description,
    icon: DEFAULT_KNOWLEDGE_NETWORK_ICON,
    name: input.name,
    tags: input.tags,
  };
}
