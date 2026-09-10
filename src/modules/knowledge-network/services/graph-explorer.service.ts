/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
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

/* ============================ Cypher (bkn-backend) ============================ */

export type CypherResult = { columns: { name: string; type?: string }[]; entries: Record<string, unknown>[] };

/**
 * Runs a read-only Cypher query through bkn-backend. This is a plain REST call: the
 * endpoint is not part of the managed lifecycle surface, so no bkn_context is needed.
 * A failure is rethrown with the backend's JSON envelope as the message so friendlyError
 * can surface its description and detail.
 */
export async function runCypherQuery(knId: string, query: string): Promise<CypherResult> {
  try {
    const response = await http.post<unknown>(`/bkn-backend/v1/knowledge-networks/${encodeURIComponent(knId)}/cypher-queries`, { query }, { skipErrorToast: true });
    const data: unknown = response.data;
    if (!isRecord(data)) throw new Error("cypher-queries did not return an object");
    const columns = Array.isArray(data.columns) ? data.columns.filter(isRecord).map((c) => ({ name: stringifyValue(c.name), type: typeof c.type === "string" ? c.type : undefined })) : [];
    const entries = Array.isArray(data.entries) ? data.entries.filter(isRecord) : [];
    return { columns, entries };
  } catch (error) {
    const body = (error as { response?: { data?: unknown } })?.response?.data;
    if (isRecord(body)) throw new Error(JSON.stringify(body));
    throw error instanceof Error ? error : new Error(String(error));
  }
}

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

/** Body of REST /kn/kn_search carrying the same scope as search_instance plus the fusion knobs. */
export function buildKnSearchBody(knId: string, query: string, options: SearchOptions, rrf: RrfOptions): Rec {
  const merged = { ...DEFAULT_SEARCH_OPTIONS, ...options };
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

export type GraphExplorerClient = {
  loadObjectTypes(ids: string[], scope?: BknCallScope | null): Promise<ObjectTypeMeta[]>;
  searchInstances(query: string, scope?: BknCallScope | null, options?: SearchOptions): Promise<Rec>;
  queryInstances(otId: string, condition: KnCondition | null, limit: number, scope?: BknCallScope | null, offset?: number): Promise<Rec>;
  exploreSubgraph(request: ExploreRequest, scope?: BknCallScope | null): Promise<Rec>;
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
    async searchInstances(query, scope, options = {}) {
      const merged = { ...DEFAULT_SEARCH_OPTIONS, ...options };
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
            limit: 1,
            response_format: "json",
          },
          scope,
        ),
      );
      return readPayload(result, "explore_subgraph");
    },
  };
}
