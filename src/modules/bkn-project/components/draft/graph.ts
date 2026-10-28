/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { KnowledgeNetworkPreviewGraph } from "@/modules/knowledge-network/types/knowledge-network";
import { relationsWithUnadoptedEnds } from "@/modules/bkn-project/components/draft/evidence";
import type { Draft } from "@/modules/bkn-project/types/draft";

/** Nodes take the theme's primary color, so the graph follows light and dark themes. */
const NODE_COLOR = "var(--color-primary-600)";

/**
 * The concept model the draft would publish: adopted object types, and adopted relation types
 * whose two ends are adopted too. An older draft may hold a relation adopted with an end that is
 * not; it is left out, as it would not be published.
 */
export function draftGraph(draft: Draft): KnowledgeNetworkPreviewGraph {
  // The same rule as the notice about relations whose ends are not adopted.
  const unadoptedEnds = new Set(relationsWithUnadoptedEnds(draft).map((item) => item.id));
  return {
    edges: draft.items.relationTypes
      .filter((item) => item.adopted && !unadoptedEnds.has(item.id))
      .map((item) => ({
        id: item.id,
        name: item.name,
        sourceId: item.source,
        targetId: item.target,
      })),
    nodes: draft.items.objectTypes
      .filter((item) => item.adopted)
      .map((item) => ({ color: NODE_COLOR, id: item.id, name: item.name })),
  };
}
