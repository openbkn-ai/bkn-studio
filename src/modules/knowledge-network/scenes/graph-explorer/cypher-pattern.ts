/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { buildInstanceId, stringifyValue, type GEdge, type GNode } from "@/modules/knowledge-network/services/graph-explorer.service";

/**
 * The Cypher subset the backend compiles is MATCH (a:Label)[-[:REL]->(b:Label)]... [WHERE ...]
 * RETURN a.property ... — whole nodes cannot be returned. The explorer therefore takes only
 * the MATCH / WHERE part from the user, projects every node variable's primary key itself,
 * and rebuilds nodes and edges from the rows.
 */

export type CypherNodeRef = { variable: string; label: string };
export type CypherEdgeRef = { from: string; to: string; relation: string };
export type CypherPattern = { nodes: CypherNodeRef[]; edges: CypherEdgeRef[]; body: string };

export type CypherParseError = {
  error: "empty" | "no_match" | "no_nodes" | "return_present" | "unlabeled" | "multiple_match" | "multiple_patterns";
  detail?: string;
};

const NODE_RE = /\(\s*([A-Za-z_][\w]*)\s*(?::\s*([^\s:)]+))?\s*\)/g;
const TAIL_RE = /\b(RETURN|ORDER\s+BY|SKIP|LIMIT)\b[\s\S]*$/i;

/** Extracts node variables, labels and directed relationships from a MATCH [WHERE] fragment. */
export function parseCypherPattern(input: string): CypherPattern | CypherParseError {
  const trimmed = input.trim();
  if (!trimmed) return { error: "empty" };
  if (TAIL_RE.test(trimmed)) return { error: "return_present" };
  const body = /^\s*MATCH\b/i.test(trimmed) ? trimmed : `MATCH ${trimmed}`;
  // The backend subset compiles exactly one MATCH holding one continuous path: a second MATCH
  // or a comma-separated pattern part is refused with 400, so say so before sending.
  if ((body.match(/\bMATCH\b/gi) ?? []).length > 1) return { error: "multiple_match" };
  const matchOnly = body.replace(/\bWHERE\b[\s\S]*$/i, "");
  if (/\)\s*,\s*\(/.test(matchOnly)) return { error: "multiple_patterns" };
  const nodes = new Map<string, string>();
  const positions: { variable: string; start: number; end: number }[] = [];
  for (const hit of matchOnly.matchAll(NODE_RE)) {
    const variable = hit[1];
    const label = hit[2];
    if (label) {
      if (nodes.has(variable) && nodes.get(variable) !== label) return { error: "unlabeled", detail: variable };
      nodes.set(variable, label);
    } else if (!nodes.has(variable)) {
      nodes.set(variable, "");
    }
    positions.push({ variable, start: hit.index ?? 0, end: (hit.index ?? 0) + hit[0].length });
  }
  if (positions.length === 0) return { error: "no_nodes" };
  for (const [variable, label] of nodes) {
    if (!label) return { error: "unlabeled", detail: variable };
  }
  const edges: CypherEdgeRef[] = [];
  for (let index = 0; index + 1 < positions.length; index += 1) {
    const between = matchOnly.slice(positions[index].end, positions[index + 1].start);
    const forward = /^\s*-\s*\[\s*(?:\w+\s*)?:\s*([^\s\]]+)\s*\]\s*->\s*$/.exec(between);
    const backward = /^\s*<-\s*\[\s*(?:\w+\s*)?:\s*([^\s\]]+)\s*\]\s*-\s*$/.exec(between);
    if (forward) edges.push({ from: positions[index].variable, to: positions[index + 1].variable, relation: forward[1] });
    else if (backward) edges.push({ from: positions[index + 1].variable, to: positions[index].variable, relation: backward[1] });
    // Anything else (a comma, a new path) starts a new chain without an edge.
  }
  return { nodes: [...nodes].map(([variable, label]) => ({ variable, label })), edges, body };
}

export function isCypherParseError(value: CypherPattern | CypherParseError): value is CypherParseError {
  return "error" in value;
}

export type ResolvedNodeRef = CypherNodeRef & { otId: string; otName: string; primaryKeys: string[] };
export type ResolvedEdgeRef = CypherEdgeRef & { relTypeId: string; relTypeName: string };

export function columnAlias(variable: string, primaryKey: string): string {
  return `${variable}__${primaryKey}`;
}

/** Appends the primary-key projection and a row cap to the user's MATCH / WHERE fragment. */
export function buildCypherQuery(pattern: CypherPattern, resolved: ResolvedNodeRef[], limit: number): string {
  const projections = resolved.flatMap((node) =>
    node.primaryKeys.map((pk) => `${node.variable}.${pk} AS ${columnAlias(node.variable, pk)}`),
  );
  return `${pattern.body}\nRETURN DISTINCT ${projections.join(", ")}\nLIMIT ${limit}`;
}

/** Rebuilds canvas nodes and edges from the projected rows. */
export function cypherRowsToGraph(
  rows: Record<string, unknown>[],
  resolvedNodes: ResolvedNodeRef[],
  resolvedEdges: ResolvedEdgeRef[],
): { nodes: GNode[]; edges: GEdge[] } {
  const nodes = new Map<string, GNode>();
  const edges = new Map<string, GEdge>();
  const byVariable = new Map(resolvedNodes.map((node) => [node.variable, node]));
  for (const row of rows) {
    const idByVariable = new Map<string, string>();
    for (const node of resolvedNodes) {
      const identity: Record<string, unknown> = {};
      let complete = true;
      for (const pk of node.primaryKeys) {
        const value = row[columnAlias(node.variable, pk)];
        if (value === undefined || value === null) {
          complete = false;
          break;
        }
        identity[pk] = value;
      }
      if (!complete) continue;
      const id = buildInstanceId(node.otId, node.primaryKeys, identity);
      if (!id) continue;
      idByVariable.set(node.variable, id);
      if (!nodes.has(id)) {
        const display = node.primaryKeys.map((pk) => stringifyValue(identity[pk])).join("_");
        nodes.set(id, { id, otId: node.otId, otName: node.otName, identity, display, props: { ...identity } });
      }
    }
    for (const edge of resolvedEdges) {
      const source = idByVariable.get(edge.from);
      const target = idByVariable.get(edge.to);
      if (!source || !target || !byVariable.has(edge.from) || !byVariable.has(edge.to)) continue;
      const id = `${source}|${edge.relTypeId}|${target}`;
      if (!edges.has(id)) edges.set(id, { id, source, target, relTypeId: edge.relTypeId, relTypeName: edge.relTypeName });
    }
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}
