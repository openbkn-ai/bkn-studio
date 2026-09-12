/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ChainGraph, ChainNode } from "./evidence-chain.types";
export interface NodeBox { x: number; y: number; width: number; height: number }
function column(node: ChainNode, mode: "evidence" | "execution"): number {
  if (mode === "execution") {
    if (node.role === "input" || node.kind === "source") return 0;
    if (node.role === "output" || node.kind === "result" || node.kind === "conclusion") return 2;
    return 1;
  }
  if (node.kind === "conclusion" || node.role === "conclusion") return 0;
  if (node.kind === "source" || node.role === "source" || node.role === "input" || node.role === "output") return 3;
  if (["object", "calculation", "function", "query", "api"].includes(node.kind) || node.role === "context" || node.role === "process") return 2;
  return 1;
}
/** Position is a reading aid, never evidence of causality. Edges are never generated here. */
export function layoutChain(graph: ChainGraph, mode: "evidence" | "execution") {
  const groups = new Map<number, ChainNode[]>();
  for (const node of graph.nodes) { const slot = column(node, mode); const list = groups.get(slot) ?? []; list.push(node); groups.set(slot, list); }
  const slots = [...groups.keys()].sort((a, b) => a - b);
  const positions = new Map<string, NodeBox>();
  const names = mode === "execution" ? ["inputs", "process", "outputs"] : ["conclusion", "facts", "context", "sources"];
  let height = 260;
  slots.forEach((slot, index) => {
    const nodes = groups.get(slot)!.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
    nodes.forEach((node, row) => positions.set(node.id, { x: 28 + index * 310, y: 62 + row * 162, width: 230, height: 122 }));
    height = Math.max(height, 100 + nodes.length * 162);
  });
  return { positions, width: Math.max(340, slots.length * 310 + 10), height, columns: slots.map(s => names[s]) };
}
