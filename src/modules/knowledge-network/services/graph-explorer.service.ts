/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { parsePrecisionSafeJSON } from "@/framework/request/precision-safe-json";

import { REST_PREFIX, restPost, type BknCallScope, type ContextLoaderEnv, type McpAuth, type McpSession, type McpToolCallResult } from "./context-loader.service";

/* ============================ Graph model ============================ */

/** One instance on the canvas. `id` is the ontology-query object id, see buildInstanceId. */
export type GNode = {
  id: string;
  otId: string;
  otName: string;
  /** Primary key -> value. */
  identity: Record<string, unknown>;
  /** Resolved label, see pickDisplay. */
  display: string;
  /** Every property of the instance, system fields (`_` prefix) included. */
  props: Record<string, unknown>;
};

/** One relation instance between two canvas nodes. */
export type GEdge = {
  id: string;
  source: string;
  target: string;
  relTypeId: string;
  relTypeName: string;
};

export type PropertyMeta = { name: string; displayName?: string; type?: string };

export type ObjectTypeMeta = {
  id: string;
  name: string;
  primaryKeys: string[];
  properties: PropertyMeta[];
  /** Display property configured on the object type definition (bkn-backend), when known. */
  displayKey?: string;
};

export type ExpandDirection = "forward" | "backward" | "bidirectional";

/** Filter condition, isomorphic to query_object_instance / explore_subgraph `condition`. */
export type KnCondition = {
  field?: string;
  operation: string;
  value?: unknown;
  sub_conditions?: KnCondition[];
};

export type RelationRef = {
  relation_type_id: string;
  relation_type_name: string;
  source_object_id: string;
  target_object_id: string;
};

export type RelationPath = { relations: RelationRef[]; length?: number };

export type SubgraphResult = { nodes: GNode[]; edges: GEdge[]; isolated: GNode[] };

/** Canvas size guard, see spec §7.4. */
export const NODE_LIMIT = 500;
/** Hop bound for path finding; explore_subgraph rejects more than 3. */
export const PATH_MAX_HOPS = 3;

const SYSTEM_PREFIX = "_";
const INSTANCE_ID = "_instance_id";
const INSTANCE_IDENTITY = "_instance_identity";
const DISPLAY = "_display";

/* ============================ Pure helpers ============================ */

type Rec = Record<string, unknown>;

function isRecord(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Renders any property value as text without ever falling back to "[object Object]". */
export function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  if (typeof value === "symbol") return value.description ?? "";
  if (typeof value === "function") return "";
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return Object.prototype.toString.call(value);
  }
}

const asString = stringifyValue;

function nonEmpty(value: unknown): boolean {
  return value !== null && value !== undefined && asString(value).trim() !== "";
}

/**
 * Mirrors ontology-query `logics.GetObjectID`: `<ot_id>-<pk values joined by "_">`,
 * a missing key written as `__NULL__`. Returns null when the object type has no primary key,
 * because there is then no identity the backend would recognise either.
 */
export function buildInstanceId(otId: string, primaryKeys: string[], identity: Rec): string | null {
  if (!otId || primaryKeys.length === 0) return null;
  const parts = primaryKeys.map((pk) => (pk in identity && identity[pk] !== undefined ? asString(identity[pk]) : "__NULL__"));
  return `${otId}-${parts.join("_")}`;
}

/**
 * Label resolution chain: an explicit label property first, then
 * `_display` → `display_name` → `name` → `id` → first non-system property → node id.
 */
export function pickDisplay(props: Rec, nodeId: string, labelKey?: string): string {
  if (labelKey && nonEmpty(props[labelKey])) return asString(props[labelKey]);
  for (const key of [DISPLAY, "display_name", "name", "id"]) {
    if (nonEmpty(props[key])) return asString(props[key]);
  }
  for (const [key, value] of Object.entries(props)) {
    if (!key.startsWith(SYSTEM_PREFIX) && nonEmpty(value)) return asString(value);
  }
  return nodeId;
}

/** Builds the start-node filter for explore_subgraph from a node's primary keys. */
export function identityCondition(identity: Rec): KnCondition | null {
  const entries = Object.entries(identity).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return null;
  const leaves: KnCondition[] = entries.map(([field, value]) => ({ field, operation: "==", value }));
  return leaves.length === 1 ? leaves[0] : { operation: "and", sub_conditions: leaves };
}

/** Normalises one get_object_types / get_kn_detail object type into the metadata the explorer needs. */
export function objectTypeMetaFrom(raw: unknown): ObjectTypeMeta | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id) return null;
  const primaryKeys = Array.isArray(raw.primary_keys)
    ? raw.primary_keys.filter((item): item is string => typeof item === "string" && item !== "")
    : [];
  const properties: PropertyMeta[] = Array.isArray(raw.data_properties)
    ? raw.data_properties
        .filter((item): item is Rec => isRecord(item) && typeof item.name === "string")
        .map((item) => ({
          name: item.name as string,
          displayName: typeof item.display_name === "string" ? item.display_name : undefined,
          type: typeof item.type === "string" ? item.type : undefined,
        }))
    : [];
  return { id: raw.id, name: typeof raw.name === "string" && raw.name ? raw.name : raw.id, primaryKeys, properties };
}

function identityFromRow(row: Rec, primaryKeys: string[]): Rec {
  const embedded = row[INSTANCE_IDENTITY];
  if (isRecord(embedded) && Object.keys(embedded).length > 0) return { ...embedded };
  const identity: Rec = {};
  for (const pk of primaryKeys) {
    if (pk in row) identity[pk] = row[pk];
  }
  return identity;
}

function nodeFromRow(meta: ObjectTypeMeta, row: Rec, labelKey?: string): GNode | null {
  const identity = identityFromRow(row, meta.primaryKeys);
  const embeddedId = typeof row[INSTANCE_ID] === "string" && row[INSTANCE_ID] ? row[INSTANCE_ID] : null;
  const id = embeddedId ?? buildInstanceId(meta.id, meta.primaryKeys, identity);
  if (!id) return null;
  const props: Rec = { ...row };
  delete props._score;
  return { id, otId: meta.id, otName: meta.name, identity, display: pickDisplay(props, id, labelKey), props };
}

/**
 * Maps a search_instance payload. Nodes whose object type has no primary key and no
 * embedded `_instance_id` cannot be identified and are reported in `skipped` by object type.
 */
export function fromSearchInstance(
  payload: unknown,
  metaByOt: Record<string, ObjectTypeMeta>,
  labelByOt: Record<string, string> = {},
): { nodes: GNode[]; skipped: { otId: string; otName: string }[] } {
  const nodes: GNode[] = [];
  const skipped = new Map<string, string>();
  const list = isRecord(payload) && Array.isArray(payload.nodes) ? payload.nodes : [];
  for (const item of list) {
    if (!isRecord(item) || typeof item.object_type_id !== "string") continue;
    const otId = item.object_type_id;
    const otName = typeof item.object_type_name === "string" && item.object_type_name ? item.object_type_name : otId;
    const props: Rec = isRecord(item.properties) ? { ...item.properties } : {};
    if (!nonEmpty(props[DISPLAY]) && nonEmpty(item.instance_name)) props[DISPLAY] = item.instance_name;
    const identity: Rec = isRecord(item.unique_identities) ? { ...item.unique_identities } : {};
    if (isRecord(props[INSTANCE_IDENTITY]) && Object.keys(identity).length === 0) {
      Object.assign(identity, props[INSTANCE_IDENTITY]);
    }
    const meta = metaByOt[otId];
    const embeddedId = typeof props[INSTANCE_ID] === "string" && props[INSTANCE_ID] ? props[INSTANCE_ID] : null;
    const id = embeddedId ?? (meta ? buildInstanceId(otId, meta.primaryKeys, identity) : null);
    if (!id) {
      skipped.set(otId, otName);
      continue;
    }
    nodes.push({ id, otId, otName, identity, display: pickDisplay(props, id, labelByOt[otId]), props });
  }
  return { nodes, skipped: [...skipped].map(([otId, otName]) => ({ otId, otName })) };
}

/** Maps query_object_instance rows of one object type. */
export function fromQueryObjectInstance(meta: ObjectTypeMeta, payload: unknown, labelKey?: string): GNode[] {
  const rows = isRecord(payload) && Array.isArray(payload.datas) ? payload.datas : [];
  const nodes: GNode[] = [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const node = nodeFromRow(meta, row, labelKey);
    if (node) nodes.push(node);
  }
  return nodes;
}

function nodeFromSubgraphObject(key: string, raw: unknown, labelByOt: Record<string, string>): GNode | null {
  if (!isRecord(raw)) return null;
  const otId = typeof raw.object_type_id === "string" ? raw.object_type_id : "";
  if (!otId) return null;
  const otName = typeof raw.object_type_name === "string" && raw.object_type_name ? raw.object_type_name : otId;
  const props: Rec = isRecord(raw.properties) ? { ...raw.properties } : {};
  for (const field of [INSTANCE_ID, INSTANCE_IDENTITY, DISPLAY]) {
    if (field in raw && raw[field] !== undefined && raw[field] !== null) props[field] = raw[field];
  }
  const id = typeof raw[INSTANCE_ID] === "string" && raw[INSTANCE_ID] ? raw[INSTANCE_ID] : key;
  const identity: Rec = isRecord(raw[INSTANCE_IDENTITY]) ? { ...raw[INSTANCE_IDENTITY] } : {};
  return { id, otId, otName, identity, display: pickDisplay(props, id, labelByOt[otId]), props };
}

/** Maps an explore_subgraph / query_instance_subgraph entry into nodes and edges. */
export function fromExploreSubgraph(payload: unknown, labelByOt: Record<string, string> = {}): SubgraphResult {
  const result: SubgraphResult = { nodes: [], edges: [], isolated: [] };
  if (!isRecord(payload)) return result;
  const objects = isRecord(payload.objects) ? payload.objects : {};
  for (const [key, raw] of Object.entries(objects)) {
    const node = nodeFromSubgraphObject(key, raw, labelByOt);
    if (node) result.nodes.push(node);
  }
  const isolated = isRecord(payload.isolated_objects) ? payload.isolated_objects : {};
  for (const [key, raw] of Object.entries(isolated)) {
    const node = nodeFromSubgraphObject(key, raw, labelByOt);
    if (node) result.isolated.push(node);
  }
  const seen = new Set<string>();
  for (const relation of flattenRelations(payload.relation_paths)) {
    const edge = edgeFromRelation(relation);
    if (seen.has(edge.id)) continue;
    seen.add(edge.id);
    result.edges.push(edge);
  }
  return result;
}

export type RelationTypeMeta = { id: string; sourceOtId: string; targetOtId: string };

/**
 * ontology-query reports each relation in the direction it was walked, so a hop taken against
 * the relation's declared direction (a backward expansion, the far half of a two-sided path)
 * arrives with source and target swapped. This puts such an edge back into its declared
 * direction so one relation always has one id and one arrow on the canvas. Only relation types
 * between two different object types can be told apart; self-relations are left as reported.
 */
export function orientEdges(
  edges: GEdge[],
  relations: ReadonlyMap<string, RelationTypeMeta>,
  otOf: (nodeId: string) => string | undefined,
): GEdge[] {
  return edges.map((edge) => {
    const meta = relations.get(edge.relTypeId);
    if (!meta || meta.sourceOtId === meta.targetOtId) return edge;
    if (otOf(edge.source) !== meta.targetOtId || otOf(edge.target) !== meta.sourceOtId) return edge;
    return { ...edge, id: `${edge.target}|${edge.relTypeId}|${edge.source}`, source: edge.target, target: edge.source };
  });
}

export function edgeFromRelation(relation: RelationRef): GEdge {
  return {
    id: `${relation.source_object_id}|${relation.relation_type_id}|${relation.target_object_id}`,
    source: relation.source_object_id,
    target: relation.target_object_id,
    relTypeId: relation.relation_type_id,
    relTypeName: relation.relation_type_name || relation.relation_type_id,
  };
}

function isRelationRef(value: unknown): value is RelationRef {
  return (
    isRecord(value) &&
    typeof value.source_object_id === "string" &&
    typeof value.target_object_id === "string" &&
    typeof value.relation_type_id === "string"
  );
}

export function parseRelationPaths(raw: unknown): RelationPath[] {
  if (!Array.isArray(raw)) return [];
  const paths: RelationPath[] = [];
  for (const item of raw) {
    if (!isRecord(item) || !Array.isArray(item.relations)) continue;
    const relations = item.relations.filter(isRelationRef);
    if (relations.length > 0) paths.push({ relations, length: relations.length });
  }
  return paths;
}

function* flattenRelations(raw: unknown): Generator<RelationRef> {
  for (const path of parseRelationPaths(raw)) {
    for (const relation of path.relations) yield relation;
  }
}

/**
 * Picks, across every returned path from `startId`, the shortest prefix that reaches
 * `targetId`. A relation "reaches" the target when either end is the target; the prefix
 * is cut there so trailing hops past the target are not returned. Null when no path reaches it.
 */
export function shortestChainTo(paths: RelationPath[], startId: string, targetId: string): RelationRef[] | null {
  if (!targetId || targetId === startId) return null;
  let best: RelationRef[] | null = null;
  for (const path of paths) {
    for (let index = 0; index < path.relations.length; index += 1) {
      const relation = path.relations[index];
      if (relation.source_object_id === targetId || relation.target_object_id === targetId) {
        const prefix = path.relations.slice(0, index + 1);
        if (!best || prefix.length < best.length) best = prefix;
        break;
      }
    }
    if (best && best.length === 1) break;
  }
  return best;
}

/** Shortest relation chain from `start` to every node its paths reach; `start` itself maps to []. */
function chainsFrom(paths: RelationPath[], start: string): Map<string, RelationRef[]> {
  const best = new Map<string, RelationRef[]>([[start, []]]);
  for (const path of paths) {
    for (let index = 0; index < path.relations.length; index += 1) {
      const relation = path.relations[index];
      const prefix = path.relations.slice(0, index + 1);
      for (const id of [relation.source_object_id, relation.target_object_id]) {
        const known = best.get(id);
        if (!known || prefix.length < known.length) best.set(id, prefix);
      }
    }
  }
  return best;
}

/**
 * Joins two explorations, one from each endpoint, at a shared node. explore_subgraph caps a
 * single walk at three hops; meeting in the middle finds paths up to twice that. The chain is
 * ordered start → meeting node → end; every relation keeps its own direction.
 */
export function meetInTheMiddle(pathsA: RelationPath[], a: string, pathsB: RelationPath[], b: string): RelationRef[] | null {
  if (!a || !b || a === b) return null;
  const fromA = chainsFrom(pathsA, a);
  const fromB = chainsFrom(pathsB, b);
  let best: RelationRef[] | null = null;
  for (const [node, chainA] of fromA) {
    const chainB = fromB.get(node);
    if (!chainB) continue;
    const joined = [...chainA, ...[...chainB].reverse()];
    if (joined.length === 0) continue;
    if (!best || joined.length < best.length) best = joined;
  }
  return best;
}

/** Display keys from object type definitions, overridden by the user's per-type label choice. */
export function effectiveLabelsFrom(metas: Record<string, ObjectTypeMeta>, overrides: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, meta] of Object.entries(metas)) {
    if (meta.displayKey) out[id] = meta.displayKey;
  }
  return { ...out, ...overrides };
}

/**
 * Merges incoming nodes and edges into the canvas maps in place. Edges are only kept when
 * both endpoints are present after the merge, so a dangling relation never produces a
 * phantom node. Returns what was actually new.
 */
export function mergeGraph(
  nodes: Map<string, GNode>,
  edges: Map<string, GEdge>,
  incoming: { nodes: GNode[]; edges: GEdge[] },
): { addedNodes: GNode[]; addedEdges: GEdge[] } {
  const addedNodes: GNode[] = [];
  const addedEdges: GEdge[] = [];
  for (const node of incoming.nodes) {
    if (nodes.has(node.id)) continue;
    nodes.set(node.id, node);
    addedNodes.push(node);
  }
  for (const edge of incoming.edges) {
    if (edges.has(edge.id) || !nodes.has(edge.source) || !nodes.has(edge.target)) continue;
    edges.set(edge.id, edge);
    addedEdges.push(edge);
  }
  return { addedNodes, addedEdges };
}

/**
 * Keeps nodes already on the canvas plus as many new ones as still fit under the limit.
 * Returns how many new nodes were dropped so the caller can say so.
 */
export function capIncomingNodes(incoming: GNode[], existing: ReadonlySet<string>, limit: number): { nodes: GNode[]; dropped: number } {
  const room = Math.max(0, limit - existing.size);
  const kept: GNode[] = [];
  let fresh = 0;
  let dropped = 0;
  for (const node of incoming) {
    if (existing.has(node.id)) {
      kept.push(node);
      continue;
    }
    if (fresh < room) {
      kept.push(node);
      fresh += 1;
    } else dropped += 1;
  }
  return { nodes: kept, dropped };
}

/** Re-resolves labels after the user changes the label property for an object type. */
export function relabel(nodes: Iterable<GNode>, labelByOt: Record<string, string>): GNode[] {
  const out: GNode[] = [];
  for (const node of nodes) {
    out.push({ ...node, display: pickDisplay(node.props, node.id, labelByOt[node.otId]) });
  }
  return out;
}

/**
 * Turns a backend error into one readable sentence. Context Loader wraps a downstream
 * failure as JSON whose `details` string embeds the downstream JSON, which may embed yet
 * another one (ontology-query → bkn-backend / vega). Every layer is unwrapped and the
 * innermost description — the actual cause — leads the message.
 */
export function friendlyError(error: unknown): string {
  const text = (error instanceof Error ? error.message : String(error)).trim();
  const outer = parseErrorEnvelope(text);
  if (!outer) return text;
  let deepest = outer;
  for (let depth = 0; depth < 6; depth += 1) {
    const next = parseErrorEnvelope(deepest.details) ?? parseErrorEnvelope(lastJsonObject(deepest.details));
    if (!next || (!next.description && !next.details)) break;
    deepest = next;
  }
  const head = outer.description || outer.details || text;
  const cause = deepest === outer ? "" : deepest.description || deepest.details;
  const hint = deepest.solution;
  if (cause && cause !== head) return hint ? `${head}：${cause}（${hint}）` : `${head}：${cause}`;
  if (!cause && outer.details && outer.details !== head) {
    const tail = outer.details.length > 160 ? `…${outer.details.slice(-160)}` : outer.details;
    return `${head}：${tail}`;
  }
  return hint ? `${head}（${hint}）` : head;
}

type ErrorEnvelope = { description: string; details: string; solution: string };

function parseErrorEnvelope(text: string): ErrorEnvelope | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return null;
  let parsed: unknown = tryParseJson(trimmed);
  // A downstream envelope embedded as a string arrives with escaped quotes ({\"error_code\":…});
  // unescape one level and try again before giving up.
  if (parsed === undefined && trimmed.includes('\\"')) parsed = tryParseJson(trimmed.replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
  if (!isRecord(parsed)) return null;
  const body = isRecord(parsed.error) ? parsed.error : parsed;
  const pick = (...keys: string[]): string => {
    for (const key of keys) {
      const value = body[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  };
  return { description: pick("description", "message"), details: pick("details", "error_details"), solution: pick("solution") };
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** The last `{…}` block inside a string, for details that read `… error: {"error_code": …}`. */
function lastJsonObject(text: string): string {
  const start = text.lastIndexOf("{");
  if (start < 0) return "";
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    if (text[index] === "{") depth += 1;
    if (text[index] === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return "";
}

/* ============================ Subgraph from an id list ============================ */

export type IdListItem = { otId: string; key: string };
export type IdListParse = { items: IdListItem[]; unknown: string[] };

/**
 * Parses pasted ids, one per line or comma-separated. A line shaped like `<ot_id>-<key>`
 * (the explorer's instance id) is resolved against the known object types with the longest
 * matching prefix; anything else is a raw primary-key value for `fallbackOt`, or unknown
 * when no object type is selected.
 */
export function parseIdList(text: string, objectTypeIds: string[], fallbackOt?: string): IdListParse {
  const items: IdListItem[] = [];
  const unknown: string[] = [];
  const seen = new Set<string>();
  const prefixes = [...objectTypeIds].sort((a, b) => b.length - a.length);
  for (const raw of text.split(/[\n,;，；]+/)) {
    const token = raw.trim();
    if (!token) continue;
    const prefix = prefixes.find((id) => token.startsWith(`${id}-`) && token.length > id.length + 1);
    let item: IdListItem | null = null;
    if (prefix) item = { otId: prefix, key: token.slice(prefix.length + 1) };
    else if (fallbackOt) item = { otId: fallbackOt, key: token };
    if (!item) {
      unknown.push(token);
      continue;
    }
    const dedupe = `${item.otId}|${item.key}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    items.push(item);
  }
  return { items, unknown };
}

/** Splits a single-key instance id tail back into a typed value: numbers stay numbers when the key type says so. */
export function keyValueFor(meta: ObjectTypeMeta, key: string): unknown {
  const pk = meta.primaryKeys[0];
  const type = (meta.properties.find((property) => property.name === pk)?.type ?? "").toLowerCase();
  if (/(int|long|float|double|decimal|number|numeric|real|bigint|short)/.test(type)) {
    const numeric = Number(key);
    if (Number.isFinite(numeric) && key.trim() !== "") return numeric;
  }
  return key;
}

/** Keeps only the edges whose both ends are in the given node set. */
/* ============================ Loaders shared by the explorer page and the viewer ============================ */

export type RelationEnds = { id: string; sourceId: string; targetId: string };
export type CollectedSubgraph = { nodes: GNode[]; edges: GEdge[]; raw: Record<string, unknown> };

const ID_BATCH = 50;
const PATH_BATCH = 5;

/**
 * Instances behind a parsed id list plus the relations among them: one `pk in` query per
 * object type (50 keys a batch), then one query_instance_subgraph path per relation type whose
 * two ends are both in the set, keeping only edges between resolved nodes. Paths travel in
 * batches; when a batch fails its paths are retried one at a time, so a single relation type the
 * backend refuses costs only its own edges instead of the whole batch's. What still fails is
 * recorded under `raw.paths` and skipped rather than sinking the call. Every object type
 * involved must be in `metas` with exactly one primary key.
 */
export async function collectSubgraphByIds(
  client: GraphExplorerClient,
  items: IdListItem[],
  metas: Record<string, ObjectTypeMeta>,
  relations: RelationEnds[],
  labelByOt: Record<string, string>,
  scope: BknCallScope | null,
): Promise<CollectedSubgraph> {
  const byOt = new Map<string, string[]>();
  for (const item of items) byOt.set(item.otId, [...(byOt.get(item.otId) ?? []), item.key]);
  const pkOf = (otId: string): string => {
    const meta = metas[otId];
    if (!meta || meta.primaryKeys.length !== 1) throw new Error(`object type ${otId} needs exactly one primary key`);
    return meta.primaryKeys[0];
  };
  const keysOf = (otId: string) => (byOt.get(otId) ?? []).map((key) => keyValueFor(metas[otId], key));
  const nodes: GNode[] = [];
  const instances: Record<string, unknown[]> = {};
  for (const [otId, keys] of byOt) {
    const pk = pkOf(otId);
    for (let start = 0; start < keys.length; start += ID_BATCH) {
      const chunk = keys.slice(start, start + ID_BATCH).map((key) => keyValueFor(metas[otId], key));
      const payload = await client.queryInstances(otId, { field: pk, operation: "in", value: chunk }, chunk.length, scope);
      (instances[otId] ??= []).push(payload);
      nodes.push(...fromQueryObjectInstance(metas[otId], payload, labelByOt[otId]));
    }
  }
  const nodeIds = new Set(nodes.map((node) => node.id));
  const paths: SubgraphPath[] = relations
    .filter((relation) => byOt.has(relation.sourceId) && byOt.has(relation.targetId))
    .map((relation) => ({
      object_types: [
        { id: relation.sourceId, condition: { field: pkOf(relation.sourceId), operation: "in", value: keysOf(relation.sourceId) } },
        { id: relation.targetId, condition: { field: pkOf(relation.targetId), operation: "in", value: keysOf(relation.targetId) } },
      ],
      relation_types: [{ relation_type_id: relation.id, source_object_type_id: relation.sourceId, target_object_type_id: relation.targetId }],
      limit: Math.min(1000, Math.max(10, keysOf(relation.sourceId).length)),
    }));
  const edges: GEdge[] = [];
  const pathPayloads: unknown[] = [];
  const collect = async (group: SubgraphPath[]): Promise<boolean> => {
    try {
      const payload = await client.queryInstanceSubgraph(group, scope);
      pathPayloads.push(payload);
      const entries = Array.isArray(payload.entries) ? payload.entries : [];
      for (const entry of entries) edges.push(...edgesAmong(fromExploreSubgraph(entry, labelByOt).edges, nodeIds));
      return true;
    } catch (error) {
      if (group.length === 1) pathPayloads.push({ error: friendlyError(error), paths: group });
      return false;
    }
  };
  for (let start = 0; start < paths.length; start += PATH_BATCH) {
    const batch = paths.slice(start, start + PATH_BATCH);
    if (await collect(batch)) continue;
    // One refused relation type must not cost the others their edges.
    for (const single of batch) await collect([single]);
  }
  return { nodes, edges, raw: { instances, paths: pathPayloads } };
}

/**
 * One-hop neighbours of many seed nodes: one explore_subgraph per object type with `pk in`
 * when the type has a single primary key, otherwise one call per seed on its full identity.
 */
export async function expandSeeds(
  client: GraphExplorerClient,
  seeds: GNode[],
  metas: Record<string, ObjectTypeMeta>,
  direction: ExpandDirection,
  labelByOt: Record<string, string>,
  scope: BknCallScope | null,
): Promise<CollectedSubgraph> {
  const byOt = new Map<string, GNode[]>();
  for (const node of seeds) byOt.set(node.otId, [...(byOt.get(node.otId) ?? []), node]);
  const nodes: GNode[] = [];
  const edges: GEdge[] = [];
  const calls: unknown[] = [];
  const collect = (payload: Rec) => {
    calls.push(payload);
    const sub = fromExploreSubgraph(payload, labelByOt);
    nodes.push(...sub.nodes);
    edges.push(...sub.edges);
  };
  for (const [otId, list] of byOt) {
    const meta = metas[otId];
    if (meta && meta.primaryKeys.length === 1) {
      const pk = meta.primaryKeys[0];
      const keys = list.map((node) => node.identity[pk] ?? keyValueFor(meta, node.id.slice(otId.length + 1)));
      collect(await client.exploreSubgraph({ sourceOtId: otId, condition: { field: pk, operation: "in", value: keys }, direction, pathLength: 1, limit: keys.length }, scope));
      continue;
    }
    for (const node of list) {
      const condition = identityCondition(node.identity);
      if (condition) collect(await client.exploreSubgraph({ sourceOtId: otId, condition, direction, pathLength: 1 }, scope));
    }
  }
  return { nodes, edges, raw: { calls } };
}

export function edgesAmong(edges: GEdge[], nodeIds: ReadonlySet<string>): GEdge[] {
  return edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
}

/* ============================ Cypher (bkn-backend) ============================ */

export type CypherResult = { columns: { name: string; type?: string }[]; entries: Record<string, unknown>[] };


/* ============================ MCP calls ============================ */

function readPayload(result: McpToolCallResult, tool: string): Rec {
  if (!result.ok || result.isError || result.rpcError) {
    throw new Error(result.rpcError?.message || result.text || `${tool} failed`);
  }
  let payload: unknown = result.structured;
  if (!isRecord(payload)) {
    try {
      payload = parsePrecisionSafeJSON(result.text);
    } catch {
      throw new Error(`${tool} did not return JSON`);
    }
  }
  if (!isRecord(payload)) throw new Error(`${tool} did not return an object`);
  // Some tools wrap the business payload under `data`.
  if (isRecord(payload.data) && !("nodes" in payload) && !("datas" in payload) && !("objects" in payload)) {
    return payload.data;
  }
  return payload;
}

function withContext(args: Rec, scope?: BknCallScope | null): Rec {
  const context = scope?.nextContext();
  return context ? { ...args, bkn_context: context } : args;
}

export type ExploreRequest = {
  sourceOtId: string;
  condition: KnCondition;
  direction: ExpandDirection;
  pathLength: number;
  /** Start-instance cap; explore_subgraph pages the start set, not the paths. Defaults to 1. */
  limit?: number;
};

/** Tunables of search_instance exposed in the semantic tab; empty lists and defaults are omitted from the call. */
export type SearchOptions = {
  objectTypes?: string[];
  excludeObjectTypes?: string[];
  conceptGroups?: string[];
  maxInstancesPerType?: number;
  maxObjectTypes?: number;
  rerank?: boolean;
};

export const DEFAULT_SEARCH_OPTIONS: Required<SearchOptions> = {
  objectTypes: [],
  excludeObjectTypes: [],
  conceptGroups: [],
  maxInstancesPerType: 20,
  maxObjectTypes: 10,
  rerank: false,
};

/**
 * Fusion knobs of the semantic instance recall. search_instance does not accept them; they
 * live in kn_search's retrieval_config.semantic_instance_retrieval, so any non-default value
 * routes the search through REST /kn/kn_search instead of the MCP tool.
 */
export type RrfOptions = {
  enableRrfFusion: boolean;
  enableKnn: boolean;
  rrfK: number;
  knnWeight: number;
  initialCandidateCount: number;
  minDirectRelevance: number;
  rerankMode: "off" | "shadow" | "on";
};

export const DEFAULT_RRF_OPTIONS: RrfOptions = {
  enableRrfFusion: true,
  enableKnn: true,
  rrfK: 60,
  knnWeight: 0.5,
  initialCandidateCount: 50,
  minDirectRelevance: 0.3,
  rerankMode: "off",
};

/** True when the fusion knobs differ from the backend defaults and kn_search must be used. */
export function needsKnSearch(rrf: RrfOptions | undefined): boolean {
  if (!rrf) return false;
  return (Object.keys(DEFAULT_RRF_OPTIONS) as (keyof RrfOptions)[]).some((key) => rrf[key] !== DEFAULT_RRF_OPTIONS[key]);
}

/** Defaults under the caller's options; a key given as undefined keeps its default instead of erasing it. */
export function mergeSearchOptions(options: SearchOptions = {}): Required<SearchOptions> {
  const merged: Required<SearchOptions> = { ...DEFAULT_SEARCH_OPTIONS };
  for (const [key, value] of Object.entries(options) as [keyof SearchOptions, unknown][]) {
    if (value !== undefined) (merged as Record<string, unknown>)[key] = value;
  }
  return merged;
}

/** Body of REST /kn/kn_search carrying the same scope as search_instance plus the fusion knobs. */
export function buildKnSearchBody(knId: string, query: string, options: SearchOptions, rrf: RrfOptions): Rec {
  const merged = mergeSearchOptions(options);
  const conceptRetrieval: Rec = { top_k: Math.max(merged.maxObjectTypes, merged.objectTypes.length) };
  if (merged.objectTypes.length > 0) conceptRetrieval.object_types = merged.objectTypes;
  if (merged.excludeObjectTypes.length > 0) conceptRetrieval.exclude_object_types = merged.excludeObjectTypes;
  if (merged.conceptGroups.length > 0) conceptRetrieval.concept_groups = merged.conceptGroups;
  const semantic: Rec = {
    per_type_instance_limit: merged.maxInstancesPerType,
    enable_rrf_fusion: rrf.enableRrfFusion,
    enable_knn_instance_retrieval: rrf.enableKnn,
    rrf_k: rrf.rrfK,
    knn_weight: rrf.knnWeight,
    initial_candidate_count: rrf.initialCandidateCount,
    min_direct_relevance: rrf.minDirectRelevance,
    instance_rerank_mode: rrf.rerankMode,
  };
  return {
    query,
    kn_id: knId,
    // REST kn_search returns schema only unless told otherwise; search_instance implies this.
    only_schema: false,
    retrieval_config: { concept_retrieval: conceptRetrieval, semantic_instance_retrieval: semantic },
  };
}

/** Runs kn_search over REST with the managed context and returns its payload (nodes + object_types). */
export async function knSearchInstances(
  env: ContextLoaderEnv,
  auth: McpAuth | undefined,
  query: string,
  options: SearchOptions,
  rrf: RrfOptions,
  scope?: BknCallScope | null,
): Promise<Rec> {
  const base = env.base.replace(/\/+$/, "");
  const body = withContext(buildKnSearchBody(env.knId, query, options, rrf), scope);
  const response = await restPost(env, auth, `${base}${REST_PREFIX}/kn/kn_search`, body);
  const text = await response.text();
  if (!response.ok) throw new Error(text || `kn_search failed (${response.status})`);
  const payload = parsePrecisionSafeJSON(text);
  if (!isRecord(payload)) throw new Error("kn_search did not return an object");
  return payload;
}

export type SubgraphPathNode = { id: string; condition?: KnCondition; limit?: number };
export type SubgraphPath = {
  object_types: SubgraphPathNode[];
  relation_types: { relation_type_id: string; source_object_type_id: string; target_object_type_id: string }[];
  limit?: number;
};

export type GraphExplorerClient = {
  loadObjectTypes(ids: string[], scope?: BknCallScope | null): Promise<ObjectTypeMeta[]>;
  /** query_instance_subgraph over explicit relation-type paths; returns the raw payload with `entries`. */
  queryInstanceSubgraph(paths: SubgraphPath[], scope?: BknCallScope | null): Promise<Rec>;
  searchInstances(query: string, scope?: BknCallScope | null, options?: SearchOptions): Promise<Rec>;
  queryInstances(otId: string, condition: KnCondition | null, limit: number, scope?: BknCallScope | null, offset?: number): Promise<Rec>;
  exploreSubgraph(request: ExploreRequest, scope?: BknCallScope | null): Promise<Rec>;
  /** run_cypher: the network's own Cypher surface, compiled server-side into one read-only query. */
  runCypher(query: string, scope?: BknCallScope | null): Promise<CypherResult>;
};

export function createGraphExplorerClient(session: McpSession, knId: string): GraphExplorerClient {
  return {
    async loadObjectTypes(ids, scope) {
      if (ids.length === 0) return [];
      const result = await session.callTool(
        "get_object_types",
        withContext({ kn_id: knId, ids, response_format: "json" }, scope),
      );
      const payload = readPayload(result, "get_object_types");
      const list = Array.isArray(payload.object_types) ? payload.object_types : [];
      return list.map(objectTypeMetaFrom).filter((meta): meta is ObjectTypeMeta => meta !== null);
    },
    async queryInstanceSubgraph(paths, scope) {
      const result = await session.callTool(
        "query_instance_subgraph",
        withContext({ kn_id: knId, relation_type_paths: paths, response_format: "json" }, scope),
      );
      return readPayload(result, "query_instance_subgraph");
    },
    async searchInstances(query, scope, options = {}) {
      const merged = mergeSearchOptions(options);
      const args: Rec = { kn_id: knId, query, max_instances_per_type: merged.maxInstancesPerType, response_format: "json" };
      if (merged.objectTypes.length > 0) args.object_types = merged.objectTypes;
      if (merged.excludeObjectTypes.length > 0) args.exclude_object_types = merged.excludeObjectTypes;
      if (merged.conceptGroups.length > 0) args.concept_groups = merged.conceptGroups;
      // The cap is strict: pinned object types must never be cut off by it.
      const maxObjectTypes = Math.max(merged.maxObjectTypes, merged.objectTypes.length);
      if (maxObjectTypes !== DEFAULT_SEARCH_OPTIONS.maxObjectTypes) args.max_object_types = maxObjectTypes;
      if (merged.rerank) args.rerank = true;
      const result = await session.callTool("search_instance", withContext(args, scope));
      return readPayload(result, "search_instance");
    },
    async queryInstances(otId, condition, limit, scope, offset = 0) {
      const args: Rec = { kn_id: knId, ot_id: otId, limit, response_format: "json" };
      if (condition) args.condition = condition;
      if (offset > 0) args.offset = offset;
      const result = await session.callTool("query_object_instance", withContext(args, scope));
      return readPayload(result, "query_object_instance");
    },
    async runCypher(query, scope) {
      const result = await session.callTool("run_cypher", withContext({ kn_id: knId, query, response_format: "json" }, scope));
      const payload = readPayload(result, "run_cypher");
      const columns = Array.isArray(payload.columns)
        ? payload.columns.filter(isRecord).map((column) => ({ name: stringifyValue(column.name), type: typeof column.type === "string" ? column.type : undefined }))
        : [];
      return { columns, entries: Array.isArray(payload.entries) ? payload.entries.filter(isRecord) : [] };
    },
    async exploreSubgraph(request, scope) {
      const result = await session.callTool(
        "explore_subgraph",
        withContext(
          {
            kn_id: knId,
            source_object_type_id: request.sourceOtId,
            direction: request.direction,
            path_length: request.pathLength,
            condition: request.condition,
            limit: request.limit ?? 1,
            response_format: "json",
          },
          scope,
        ),
      );
      return readPayload(result, "explore_subgraph");
    },
  };
}
