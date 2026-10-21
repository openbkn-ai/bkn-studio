/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Reading run_cypher results: the node, relationship and derived-edge values a query returns,
 * and the parts of a query the page needs before running it (returned node variables and their
 * labels). Shared by the OpenCypher query page and the enterprise graph explorer.
 */

export type CypherColumn = { name: string; type?: string };

export type CypherExecution = {
  match_rows?: number;
  match_complete?: boolean;
  /** LIMIT cut the rows; there may be more. */
  conclusions_limited?: boolean;
};

export type CypherResult = {
  columns: CypherColumn[];
  entries: Record<string, unknown>[];
  /** What each column holds, set when the query returns nodes, relationships, lists or maps. */
  valueTypes?: Record<string, unknown>;
  execution?: CypherExecution;
};

type Rec = Record<string, unknown>;

export type ObjectValue = {
  kind: "object";
  object_type_id: string;
  key: Rec;
  properties?: Rec;
};

export type RelationValue = {
  kind: "relation";
  relation_type_id: string;
  source: ObjectValue;
  target: ObjectValue;
};

function isRec(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isObjectValue(value: unknown): value is ObjectValue {
  return (
    isRec(value) &&
    value.kind === "object" &&
    typeof value.object_type_id === "string" &&
    isRec(value.key)
  );
}

export function isRelationValue(value: unknown): value is RelationValue {
  return (
    isRec(value) &&
    value.kind === "relation" &&
    typeof value.relation_type_id === "string" &&
    isObjectValue(value.source) &&
    isObjectValue(value.target)
  );
}

/* ============================ Query text ============================ */

/**
 * Blanks out string literals and comments so that a keyword inside `WHERE x.note = 'RETURN'` is
 * not read as a clause. Backtick-quoted names are blanked too unless `keepNames` is set, for
 * callers that read labels out of the text.
 */
export function cypherCode(text: string, options: { keepNames?: boolean } = {}): string {
  let out = "";
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (char === "`" && options.keepNames) {
      const end = text.indexOf("`", index + 1);
      const stop = end < 0 ? text.length : end + 1;
      out += text.slice(index, stop);
      index = stop;
    } else if (char === "'" || char === '"' || char === "`") {
      index += 1;
      while (index < text.length && text[index] !== char) {
        if (text[index] === "\\" && char !== "`") index += 1;
        index += 1;
      }
      index += 1;
      out += " ";
    } else if (char === "/" && text[index + 1] === "/") {
      while (index < text.length && text[index] !== "\n") index += 1;
    } else if (char === "/" && text[index + 1] === "*") {
      const end = text.indexOf("*/", index + 2);
      index = end < 0 ? text.length : end + 2;
      out += " ";
    } else {
      out += char;
      index += 1;
    }
  }
  return out;
}

const IDENT = String.raw`(?:[A-Za-z_]\w*|\x60[^\x60]+\x60)`;
/** A node pattern with a label: `(g:goals)` or `(p:\`my-type\` {…})`. */
const LABELED_NODE_RE = new RegExp(String.raw`\(\s*(${IDENT})\s*:\s*(${IDENT})`, "g");

function unquote(name: string): string {
  return name.startsWith("`") && name.endsWith("`") ? name.slice(1, -1) : name;
}

/** Splits on commas outside brackets and parentheses. */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "(" || char === "[" || char === "{") depth += 1;
    else if (char === ")" || char === "]" || char === "}") depth -= 1;
    else if (char === "," && depth === 0) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

/**
 * The variables the last RETURN hands back whole — `RETURN a, r` and `a AS source` — or inside
 * `collect(x)`. Property reads such as `a.name` are not variables.
 */
export function returnedVariables(query: string): string[] {
  const code = cypherCode(query, { keepNames: true });
  const matches = [...code.matchAll(/\bRETURN\b/gi)];
  const last = matches[matches.length - 1];
  if (last?.index === undefined) return [];
  let tail = code.slice(last.index + last[0].length);
  const end = tail.search(/\b(ORDER\s+BY|SKIP|LIMIT|UNION)\b/i);
  if (end >= 0) tail = tail.slice(0, end);
  tail = tail.replace(/^\s*DISTINCT\b/i, "");
  const variables = new Set<string>();
  const bare = new RegExp(String.raw`^(${IDENT})(?:\s+AS\s+${IDENT})?$`, "i");
  const collected = new RegExp(
    String.raw`^collect\s*\(\s*(?:DISTINCT\s+)?(${IDENT})\s*\)(?:\s+AS\s+${IDENT})?$`,
    "i",
  );
  for (const item of splitTopLevel(tail)) {
    const found = bare.exec(item) ?? collected.exec(item);
    if (found) variables.add(unquote(found[1]));
  }
  return [...variables];
}

/** Node variables with the label the query gives them, e.g. `(g:goals)` → g → goals. */
export function labeledNodeVariables(query: string): Record<string, string> {
  const code = cypherCode(query, { keepNames: true });
  const labels: Record<string, string> = {};
  for (const match of code.matchAll(LABELED_NODE_RE)) {
    const variable = unquote(match[1]);
    if (!(variable in labels)) labels[variable] = unquote(match[2]);
  }
  return labels;
}

/** Relationship types the query names, e.g. `[r:rel_goals_team]` or `[:\`a-b\`]`. */
export function relationTypesInQuery(query: string): string[] {
  const code = cypherCode(query, { keepNames: true });
  const pattern = new RegExp(String.raw`\[\s*(?:${IDENT})?\s*:\s*(${IDENT})`, "g");
  return [...new Set([...code.matchAll(pattern)].map((match) => unquote(match[1])))];
}

/** Returned node variables whose label is known: what object_properties can be asked for. */
export function returnedNodeLabels(query: string): Record<string, string> {
  const labels = labeledNodeVariables(query);
  const result: Record<string, string> = {};
  for (const variable of returnedVariables(query)) {
    if (labels[variable]) result[variable] = labels[variable];
  }
  return result;
}

/* ============================ Values ============================ */

const INTEGER_TYPE = /^(integer|int\d*|long|short|byte|bigint|smallint|tinyint)$/i;
const DECIMAL_TYPE = /^(decimal|numeric|number|float\d*|double|real)$/i;

/**
 * A key value arrives as exact text with its declared type. Numbers become numbers while they
 * stay exact; past 2^53 the text is kept, since a rounded number would name another instance.
 */
export function graphKeyValue(entry: unknown): unknown {
  if (!isRec(entry)) return entry;
  const { type, value } = entry;
  if (typeof value !== "string" || typeof type !== "string") return value;
  const number = Number(value);
  if (value.trim() === "" || !Number.isFinite(number)) return value;
  if (INTEGER_TYPE.test(type)) return Number.isSafeInteger(number) ? number : value;
  if (DECIMAL_TYPE.test(type)) return Math.abs(number) <= Number.MAX_SAFE_INTEGER ? number : value;
  return value;
}

/** A node's key as plain values, in the order the result lists them. */
export function objectKey(value: ObjectValue): Rec {
  const key: Rec = {};
  for (const [name, entry] of Object.entries(value.key)) key[name] = graphKeyValue(entry);
  return key;
}

export function textOf(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint")
    return String(value);
  return JSON.stringify(value);
}

/** Calls `visit` for every node and relationship in a value, looking inside lists and maps. */
function walkGraphValues(value: unknown, visit: (item: ObjectValue | RelationValue) => void): void {
  if (isObjectValue(value) || isRelationValue(value)) {
    visit(value);
    return;
  }
  if (Array.isArray(value)) for (const item of value) walkGraphValues(item, visit);
  else if (isRec(value)) for (const item of Object.values(value)) walkGraphValues(item, visit);
}

/** Whether a value_types entry describes a node or relationship anywhere inside it. */
function typeHoldsGraph(type: unknown): boolean {
  if (!isRec(type)) return false;
  if (type.kind === "object" || type.kind === "relation") return true;
  if (typeHoldsGraph(type.element)) return true;
  return isRec(type.fields) && Object.values(type.fields).some(typeHoldsGraph);
}

/**
 * Whether a result can be drawn: some value is a node or relationship, or value_types says a
 * column holds one (an empty answer to a graph query is still a graph).
 */
export function resultHoldsGraph(result: Pick<CypherResult, "entries" | "valueTypes">): boolean {
  if (Object.values(result.valueTypes ?? {}).some(typeHoldsGraph)) return true;
  let found = false;
  for (const row of result.entries) {
    walkGraphValues(row, () => {
      found = true;
    });
    if (found) return true;
  }
  return false;
}

/** The object types a result's nodes belong to. */
export function graphValueObjectTypes(entries: readonly Rec[]): string[] {
  const ids = new Set<string>();
  for (const row of entries)
    walkGraphValues(row, (item) => {
      if (item.kind === "object") ids.add(item.object_type_id);
      else {
        ids.add(item.source.object_type_id);
        ids.add(item.target.object_type_id);
      }
    });
  return [...ids];
}

/** A row that is a conclusion derived from a path: `source` / `relationType` / `target`. */
export function derivedEdgeOf(
  row: Rec,
): { source: ObjectValue; target: ObjectValue; name: string } | null {
  const { source, target, relationType } = row;
  if (!isObjectValue(source) || !isObjectValue(target)) return null;
  if (typeof relationType !== "string" || !relationType.trim()) return null;
  return { source, target, name: relationType.trim() };
}

/* ============================ Graph ============================ */

/** What the page knows about the network's types, for names and labels. */
export type CypherSchemaNames = {
  objectTypes: Record<string, string>;
  relationTypes: Record<string, string>;
  /** Per object type, the property shown as a node's name. */
  displayKeys?: Record<string, string>;
};

export type CypherGraphNode = {
  id: string;
  objectTypeId: string;
  objectTypeName: string;
  /** The display property's value, else the key values. */
  label: string;
  key: Rec;
  properties: Rec;
  /** Scalar columns returned beside the node, such as a count; see buildCypherGraph. */
  computed?: Rec;
};

export type CypherGraphEdge = {
  id: string;
  source: string;
  target: string;
  name: string;
  /** A conclusion derived from a path rather than a modeled relationship. */
  derived: boolean;
  /** How much evidence a derived edge stands for. */
  count?: number;
  /** A modeled relationship's type id. */
  relationTypeId?: string;
  /** Why the backend matched the two ends, e.g. the joined property values. */
  basis?: unknown;
};

export type CypherGraph = {
  nodes: CypherGraphNode[];
  edges: CypherGraphEdge[];
  /** Nodes in the result before the limit. */
  totalNodes: number;
};

export const GRAPH_NODE_LIMIT = 300;

function nodeId(value: ObjectValue): string {
  const key = objectKey(value);
  const parts = Object.keys(key)
    .sort()
    .map((name) => `${name}=${textOf(key[name])}`);
  return `${value.object_type_id}:${parts.join("&")}`;
}

/** A node's name: its display property when the result carries it, else its key values. */
export function objectLabel(value: ObjectValue, displayKey?: string): string {
  const display = displayKey ? value.properties?.[displayKey] : undefined;
  if (display !== undefined && display !== null && textOf(display) !== "") return textOf(display);
  return Object.values(objectKey(value)).map(textOf).join(" / ");
}

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

/** Hangs a row's scalar columns on the row's nodes, as buildCypherGraph describes. */
function attachComputed(row: Rec, nodes: Map<string, CypherGraphNode>): void {
  const owners = Object.entries(row).filter((entry): entry is [string, ObjectValue] =>
    isObjectValue(entry[1]),
  );
  if (owners.length === 0) return;
  for (const [column, value] of Object.entries(row)) {
    if (!isScalar(value)) continue;
    const owner =
      owners.length === 1
        ? { value: owners[0][1], name: column }
        : owners
            .filter(([variable]) => column.length > variable.length + 1)
            .filter(([variable]) => column.startsWith(`${variable}_`))
            .map(([variable, item]) => ({
              value: item,
              name: column.slice(variable.length + 1),
            }))[0];
    const node = owner ? nodes.get(nodeId(owner.value)) : undefined;
    if (owner && node) node.computed = { ...node.computed, [owner.name]: value };
  }
}

/**
 * Turns a result into nodes and edges. Every node value becomes a node and every relationship
 * value an edge. A `source` / `relationType` / `target` row becomes one derived edge between the
 * two nodes, counted by the evidence it carries (nodes or values collected beside it, else a
 * returned number). Scalar columns of other rows are the nodes' computed values: with one node in
 * the row they all go to it; with several, a column named `<variable>_<name>` goes to that
 * variable's node as `<name>`, and the rest stay in the table. A computed value named as the
 * type's display key becomes the label. Past `limit` nodes, the rest and their edges are left out.
 */
export function buildCypherGraph(
  result: Pick<CypherResult, "entries">,
  names: CypherSchemaNames,
  limit = GRAPH_NODE_LIMIT,
): CypherGraph {
  const nodes = new Map<string, CypherGraphNode>();
  const edges = new Map<string, CypherGraphEdge>();

  const addNode = (value: ObjectValue): string => {
    const id = nodeId(value);
    const existing = nodes.get(id);
    if (existing) {
      // The same object may come back once with properties and once without.
      if (value.properties) {
        existing.properties = { ...existing.properties, ...value.properties };
        existing.label = objectLabel(
          { ...value, properties: existing.properties },
          names.displayKeys?.[value.object_type_id],
        );
      }
      return id;
    }
    const otId = value.object_type_id;
    nodes.set(id, {
      id,
      objectTypeId: otId,
      objectTypeName: names.objectTypes[otId] ?? otId,
      label: objectLabel(value, names.displayKeys?.[otId]),
      key: objectKey(value),
      properties: { ...(value.properties ?? {}) },
    });
    return id;
  };
  const addRelation = (value: RelationValue): void => {
    const source = addNode(value.source);
    const target = addNode(value.target);
    const id = `${source}|${value.relation_type_id}|${target}`;
    if (!edges.has(id))
      edges.set(id, {
        id,
        source,
        target,
        name: names.relationTypes[value.relation_type_id] ?? value.relation_type_id,
        derived: false,
        relationTypeId: value.relation_type_id,
        ...((value as RelationValue & Rec).basis !== undefined
          ? { basis: (value as RelationValue & Rec).basis }
          : {}),
      });
  };

  for (const row of result.entries) {
    const conclusion = derivedEdgeOf(row);
    if (!conclusion) {
      walkGraphValues(row, (item) => {
        if (item.kind === "object") addNode(item);
        else addRelation(item);
      });
      attachComputed(row, nodes);
      continue;
    }
    const source = addNode(conclusion.source);
    const target = addNode(conclusion.target);
    const evidence = new Set<string>();
    let listed = 0;
    let counted = 0;
    for (const [column, value] of Object.entries(row)) {
      if (column === "source" || column === "target" || column === "relationType") continue;
      if (counted === 0 && typeof value === "number" && Number.isFinite(value)) counted = value;
      if (Array.isArray(value)) listed += value.length;
      walkGraphValues(value, (item) => {
        if (item.kind === "object") evidence.add(nodeId(item));
      });
    }
    const amount = evidence.size > 0 ? evidence.size : listed > 0 ? listed : counted;
    const id = `derived|${source}|${conclusion.name}|${target}`;
    const existing = edges.get(id);
    edges.set(id, {
      id,
      source,
      target,
      name: conclusion.name,
      derived: true,
      ...(amount > 0 || existing?.count ? { count: (existing?.count ?? 0) + amount } : {}),
    });
  }

  for (const node of nodes.values()) {
    const key = names.displayKeys?.[node.objectTypeId];
    const value = key ? node.computed?.[key] : undefined;
    if (key && value !== undefined && node.properties[key] === undefined)
      node.label = textOf(value);
  }

  const all = [...nodes.values()];
  const kept = all.slice(0, Math.max(0, limit));
  const keptIds = new Set(kept.map((node) => node.id));
  return {
    nodes: kept,
    edges: [...edges.values()].filter(
      (edge) => keptIds.has(edge.source) && keptIds.has(edge.target),
    ),
    totalNodes: all.length,
  };
}

/* ============================ Table cells ============================ */

export type CypherCell =
  | { kind: "object"; text: string; value: ObjectValue }
  | { kind: "relation"; text: string; value: RelationValue }
  | { kind: "json"; text: string; value: unknown }
  | { kind: "scalar"; text: string };

/** How one value reads in the table. */
export function describeCell(value: unknown, names: CypherSchemaNames): CypherCell {
  if (isObjectValue(value)) {
    const typeName = names.objectTypes[value.object_type_id] ?? value.object_type_id;
    return {
      kind: "object",
      text: `${typeName} · ${objectLabel(value, names.displayKeys?.[value.object_type_id])}`,
      value,
    };
  }
  if (isRelationValue(value)) {
    const relation = names.relationTypes[value.relation_type_id] ?? value.relation_type_id;
    const end = (item: ObjectValue) => objectLabel(item, names.displayKeys?.[item.object_type_id]);
    return {
      kind: "relation",
      text: `${end(value.source)} —${relation}→ ${end(value.target)}`,
      value,
    };
  }
  if (Array.isArray(value) || isRec(value)) {
    const size = Array.isArray(value) ? value.length : Object.keys(value).length;
    return { kind: "json", text: Array.isArray(value) ? `[${size}]` : `{${size}}`, value };
  }
  return { kind: "scalar", text: textOf(value) };
}

/** Cell text for CSV: nodes and relationships as they read, lists and maps as JSON. */
export function cellCsvText(value: unknown, names: CypherSchemaNames): string {
  const cell = describeCell(value, names);
  return cell.kind === "json" ? JSON.stringify(cell.value) : cell.text;
}

/** The result as CSV, one column per result column. */
export function resultToCsv(result: CypherResult, names: CypherSchemaNames): string {
  const columns =
    result.columns.length > 0
      ? result.columns.map((column) => column.name)
      : Object.keys(result.entries[0] ?? {});
  const quote = (text: string) => (/[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);
  const lines = [columns.map(quote).join(",")];
  for (const row of result.entries)
    lines.push(columns.map((column) => quote(cellCsvText(row[column], names))).join(","));
  return lines.join("\n");
}
