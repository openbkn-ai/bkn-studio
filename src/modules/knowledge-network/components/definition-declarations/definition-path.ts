/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { DeclarationDefinitionKind } from "@/modules/knowledge-network/types/knowledge-network";

const SEGMENTS: Record<DeclarationDefinitionKind, string> = {
  action_type: "action-types",
  object_type: "object-types",
  relation_type: "relation-types",
};

/** The detail page of a definition, inside the workspace of its network. */
export function definitionDetailPath(
  networkId: string,
  definition: { id: string; kind: DeclarationDefinitionKind },
) {
  return `/knowledge-network/workspace/${networkId}/${SEGMENTS[definition.kind]}/${definition.id}/detail`;
}
