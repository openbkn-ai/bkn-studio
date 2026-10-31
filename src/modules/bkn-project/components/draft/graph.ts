/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkPreviewGraph,
  KnowledgeNetworkRelationTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";
import { relationsWithUnadoptedEnds } from "@/modules/bkn-project/components/draft/evidence";
import type { Draft } from "@/modules/bkn-project/types/draft";

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
    // No colour of its own: the graph gives each type one from the knowledge network's palette.
    nodes: draft.items.objectTypes
      .filter((item) => item.adopted)
      .map((item) => ({ color: "", id: item.id, name: item.name })),
  };
}

/**
 * The whole draft as the knowledge network's ontology graph reads it: every object type, and
 * every relation type between two of them. What the draft would not publish is listed in
 * `faded`, so the graph draws it faint and dashed beside the model.
 */
export function draftGraphRecords(draft: Draft): {
  faded: Set<string>;
  objectTypes: KnowledgeNetworkObjectTypeRecord[];
  relationTypes: KnowledgeNetworkRelationTypeRecord[];
} {
  const published = draftGraph(draft);
  const kept = new Set([...published.nodes, ...published.edges].map((item) => item.id));
  const names = new Map(draft.items.objectTypes.map((item) => [item.id, item.name]));
  const relationTypes = draft.items.relationTypes.filter(
    (item) => names.has(item.source) && names.has(item.target),
  );
  return {
    faded: new Set(
      [...draft.items.objectTypes, ...relationTypes]
        .map((item) => item.id)
        .filter((id) => !kept.has(id)),
    ),
    objectTypes: draft.items.objectTypes.map((item) => ({
      color: "",
      conceptGroupIds: [],
      conceptGroupNames: [],
      description: item.description,
      hasIndex: false,
      id: item.id,
      name: item.name,
      tags: [],
      updateTime: "",
      updaterName: "",
    })),
    relationTypes: relationTypes.map((item) => ({
      color: "",
      description: item.description,
      id: item.id,
      mappingMode: "direct",
      name: item.name,
      sourceObjectTypeId: item.source,
      sourceObjectTypeName: names.get(item.source) ?? "",
      tags: [],
      targetObjectTypeId: item.target,
      targetObjectTypeName: names.get(item.target) ?? "",
      updateTime: "",
      updaterName: "",
    })),
  };
}
