/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ChainGraph } from "./evidence-chain.types";
/** A shared query/source does not establish object membership for its other returned rows. */
export function scopeObjectFacts(graph: ChainGraph, objectId: string, fieldId?: string): ChainGraph {
  const fields = new Set(graph.edges.filter(e => e.kind === "object" && e.source === objectId && graph.nodes.some(n => n.id === e.target && n.kind === "field")).map(e => e.target));
  const chosen = fieldId ? new Set(fields.has(fieldId) ? [fieldId] : []) : fields;
  const ids = new Set([objectId, ...chosen]);
  for (const edge of graph.edges) if (edge.kind === "value" && chosen.has(edge.target) && graph.nodes.some(n => n.id === edge.source && n.kind === "source")) ids.add(edge.source);
  if (!fieldId) {
    const relationships = new Set(graph.edges.filter(e => e.kind === "relation" && (e.source === objectId || e.target === objectId)).flatMap(e => [e.source, e.target]).filter(id => graph.nodes.some(n => n.id === id && n.kind === "relation")));
    for (const id of relationships) ids.add(id);
    for (const e of graph.edges) if (e.kind === "relation" && (relationships.has(e.source) || relationships.has(e.target))) {
      for (const id of [e.source, e.target]) if (graph.nodes.some(n => n.id === id && (n.kind === "object" || n.kind === "relation"))) ids.add(id);
    }
  }
  return { nodes: graph.nodes.filter(n => ids.has(n.id)), edges: graph.edges.filter(e => ids.has(e.source) && ids.has(e.target)) };
}

function unownedFields(graph: ChainGraph, sourceId: string) {
  const owned = new Set(graph.edges.filter(e => e.kind === "object").map(e => e.target));
  return new Set(graph.edges.filter(e => e.kind === "value" && e.source === sourceId && !owned.has(e.target) && graph.nodes.some(n => n.id === e.target && n.kind === "field")).map(e => e.target));
}
/** Directory groups use source IDs, not tool labels or matching values. */
export function sourceFactGroups(graph: ChainGraph) {
  return graph.nodes.filter(n => n.kind === "source" && unownedFields(graph, n.id).size > 0);
}
export function scopeSourceFacts(graph: ChainGraph, sourceId: string, fieldId?: string): ChainGraph {
  const fields = unownedFields(graph, sourceId);
  const ids = new Set([sourceId, ...(fieldId ? fields.has(fieldId) ? [fieldId] : [] : fields)]);
  return {nodes: graph.nodes.filter(n => ids.has(n.id)), edges: graph.edges.filter(e => e.source === sourceId && e.kind === "value" && ids.has(e.target))};
}
/** One recorded operation and its immediate declared links. No synthetic sequential edges. */
export function scopeExecution(graph: ChainGraph, id?: string): ChainGraph {
  const ids = new Set(id ? [id] : []);
  for (const e of graph.edges) if (e.source === id || e.target === id) { ids.add(e.source); ids.add(e.target); }
  return { nodes: graph.nodes.filter(n => ids.has(n.id)), edges: graph.edges.filter(e => ids.has(e.source) && ids.has(e.target)) };
}
