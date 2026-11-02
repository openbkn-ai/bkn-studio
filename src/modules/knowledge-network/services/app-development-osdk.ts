/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Usage of the typed package `bkn-osdk generate` writes for a network.
 *
 * The names follow the generator's own rules (bkn-sdk `python/bkn_osdk/codegen/emit.py`), so the
 * example uses the class and attribute names the developer will actually import. When an id has
 * no Python name the generator refuses it, and so does this: the name comes back null.
 */

import {
  instanceIdentity,
  scalarFields,
  toolInput,
  type SampleRow,
  type ToolCall,
} from "@/modules/knowledge-network/services/app-development-examples";
import {
  literal,
  pythonConfigure,
  pythonQuery,
} from "@/modules/knowledge-network/services/app-development-render";

const SEPARATORS = ["-", ".", " "];

const PYTHON_KEYWORDS = new Set([
  "False",
  "None",
  "True",
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "try",
  "while",
  "with",
  "yield",
]);

/** Query methods on every generated class; an attribute with one of these names is suffixed. */
const RESERVED_ATTRIBUTES = new Set([
  "count",
  "get",
  "iterate",
  "objects",
  "order_by",
  "page",
  "raw",
  "select",
  "take",
  "where",
  "with_context",
]);

function isIdentifier(name: string) {
  return /^[\p{L}_][\p{L}\p{N}_]*$/u.test(name);
}

function underscored(id: string) {
  return SEPARATORS.reduce((name, separator) => name.replaceAll(separator, "_"), id);
}

/** `monitoring_task` -> `MonitoringTask`. */
export function osdkClassName(id: string): string | null {
  const name = underscored(id)
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  if (!name) return null;
  const safe = PYTHON_KEYWORDS.has(name) ? `${name}_` : name;
  return isIdentifier(safe) ? safe : null;
}

export function osdkPropertyName(id: string): string | null {
  let name = underscored(id);
  if (PYTHON_KEYWORDS.has(name) || RESERVED_ATTRIBUTES.has(name)) name = `${name}_`;
  return isIdentifier(name) && !name.startsWith("__") ? name : null;
}

/** A relation hangs off its source class, `rel_` prefix dropped. */
export function osdkRelationAttribute(id: string, taken: Set<string>): string | null {
  let name = underscored(id);
  if (name.startsWith("rel_") && name.length > 4) name = name.slice(4);
  const unusable = (value: string) =>
    !isIdentifier(value) || PYTHON_KEYWORDS.has(value) || RESERVED_ATTRIBUTES.has(value);
  if (unusable(name)) name = underscored(id);
  if (taken.has(name) || PYTHON_KEYWORDS.has(name) || RESERVED_ATTRIBUTES.has(name)) {
    name = `${name}_`;
  }
  return isIdentifier(name) && !taken.has(name) ? name : null;
}

/**
 * A short name to import a class as: `supply_ontology_hand_product` in network
 * `supply_ontology_hand` reads as `Product`. Null when the id does not start with the network id.
 */
export function osdkAlias(knId: string, objectTypeId: string): string | null {
  for (const separator of ["_", "-", "."]) {
    const prefix = `${knId}${separator}`;
    if (objectTypeId.startsWith(prefix) && objectTypeId.length > prefix.length) {
      return osdkClassName(objectTypeId.slice(prefix.length));
    }
  }
  return null;
}

export type OsdkExampleKey = "query" | "relations" | "search" | "cypher";

export type OsdkExample = { key: OsdkExampleKey; code: string };

export type OsdkRelation = {
  id: string;
  name: string;
  targetId: string;
  targetName: string;
  /** Property ids of the target, which a relation attribute on it must not collide with. */
  targetProperties: string[];
  /** A relation that starts at the target, for a walk of two hops. */
  next?: { id: string; name: string; targetName: string };
};

export type OsdkComments = {
  get: string;
  where: string;
  combine: string;
  page: string;
  iterate: string;
  count: string;
  hop: string;
  multiHop: string;
  searchTypes: string;
  searchInstances: string;
};

export type OsdkExamplesInput = {
  /** Platform origin, set in each example together with the token. */
  origin: string;
  knId: string;
  objectTypeId: string;
  /** Property ids of the object type, from the network's schema. */
  properties: string[];
  row: SampleRow | null;
  relation?: OsdkRelation;
  /** Natural-language question for the search example. */
  question: string;
  cypher: ToolCall | null;
  comments: OsdkComments;
};

const WIDTH = 80;

/**
 * Imports grouped as Python does (standard library, the SDK, the generated package), then the
 * platform and token set explicitly so no example looks as if it forgot them.
 */
function prelude(origin: string, sdk: string[], generated: string[]) {
  return [
    "import os",
    "",
    "import bkn_osdk",
    ...sdk,
    "",
    ...generated,
    "",
    pythonConfigure(origin),
  ];
}

type Imported = { id: string; cls: string; alias: string | null };

/** Aliases are dropped when two of them would clash, so the import always resolves. */
function imports(knId: string, objectTypeIds: string[]): Map<string, string> | null {
  const classes: Imported[] = [];
  for (const id of new Set(objectTypeIds)) {
    const cls = osdkClassName(id);
    if (!cls) return null;
    classes.push({ id, cls, alias: osdkAlias(knId, id) });
  }
  const used = classes.map(({ cls, alias }) => alias ?? cls);
  const aliased = new Set(used).size === used.length;
  return new Map(
    classes.map(({ id, cls, alias }) => [id, aliased && alias ? alias : cls] as const),
  );
}

function importLines(names: Map<string, string>) {
  const parts = [...names].map(([id, name]) => {
    const cls = osdkClassName(id) ?? name;
    return cls === name ? cls : `${cls} as ${name}`;
  });
  const inline = `from bkn.object_types import ${parts.join(", ")}`;
  if (inline.length <= WIDTH) return [inline];
  return ["from bkn.object_types import (", ...parts.map((part) => `    ${part},`), ")"];
}

function py(value: unknown) {
  return literal(value, "py", "", 0);
}

/** `head(inner)tail` on one line when it fits, else `inner` on its own indented line. */
function wrapped(head: string, inner: string, tail: string) {
  const inline = `${head}(${inner})${tail}`;
  return inline.length <= WIDTH ? [inline] : [`${head}(`, `    ${inner}`, `)${tail}`];
}

function getCall(cls: string, identity: Record<string, unknown>) {
  const keys = Object.keys(identity);
  if (keys.length === 1) return `${cls}.get(${py(identity[keys[0]])})`;
  const named = keys.map((field) => `${osdkPropertyName(field) ?? field}=${py(identity[field])}`);
  return `${cls}.get(${named.join(", ")})`;
}

function propertyNames(ids: string[]) {
  return new Set(ids.map(osdkPropertyName).filter((name): name is string => Boolean(name)));
}

function queryExample(input: OsdkExamplesInput, cls: string, header: string[]) {
  const { comments, row } = input;
  const identity = instanceIdentity(row) ?? {};
  const keys = Object.keys(identity);
  const keyNames = keys.map(osdkPropertyName);
  const fields = scalarFields(row).filter(([field]) => osdkPropertyName(field));
  const lines = [...header, ""];

  if (keys.length > 0 && keyNames.every(Boolean)) {
    lines.push(`# ${comments.get}`, `item = ${getCall(cls, identity)}`);
    const shown = fields.find(([field]) => !keys.includes(field)) ?? fields.at(0);
    if (shown) lines.push(`print(item.${osdkPropertyName(shown[0])})`);
    lines.push("");
  }

  const filter = fields.at(0);
  if (filter) {
    const condition = `${cls}.${osdkPropertyName(filter[0])} == ${py(filter[1])}`;
    lines.push(`# ${comments.where}`, ...wrapped(`items = ${cls}.where`, condition, ".take(10)"));
    lines.push("", `# ${comments.combine}`);
    lines.push(...wrapped(`others = ${cls}.where`, `~(${condition})`, ".count()"), "");
  }

  const sortKey = keyNames.at(0) ?? (filter ? osdkPropertyName(filter[0]) : null);
  if (sortKey) {
    const second = fields
      .map(([field]) => osdkPropertyName(field))
      .find((name) => name && name !== sortKey);
    const selected = [sortKey, second].filter(Boolean).map((name) => `${cls}.${name}`);
    lines.push(
      `# ${comments.page}`,
      "page = (",
      `    ${cls}.order_by(${cls}.${sortKey}.desc())`,
      `    .select(${selected.join(", ")})`,
      "    .page(limit=20, need_total=True)",
      ")",
      "print(page.total, len(page.rows))",
      "",
      `# ${comments.iterate}`,
      `for row in ${cls}.iterate(page_size=500):`,
      `    print(row.${sortKey})`,
      "",
    );
  }

  lines.push(`# ${comments.count}`, `total = ${cls}.count()`);
  return lines.join("\n");
}

function relationsExample(input: OsdkExamplesInput, relation: OsdkRelation) {
  const identity = instanceIdentity(input.row);
  if (!identity || !Object.keys(identity).every((field) => osdkPropertyName(field))) return null;
  const first = osdkRelationAttribute(relation.id, propertyNames(input.properties));
  if (!first) return null;
  const next = relation.next
    ? osdkRelationAttribute(relation.next.id, propertyNames(relation.targetProperties))
    : null;
  const names = imports(input.knId, [input.objectTypeId, ...(next ? [relation.targetId] : [])]);
  const cls = names?.get(input.objectTypeId);
  if (!names || !cls) return null;

  const { comments } = input;
  const lines = [
    ...prelude(input.origin, [], importLines(names)),
    "",
    `item = ${getCall(cls, identity)}`,
    "",
    `# ${comments.hop}`,
    `related = item.${first}.take(10)`,
  ];
  const target = names.get(relation.targetId);
  if (next && target && relation.next) {
    const walk = `reached = ${cls}.${first}.then(${target}.${next}).of(item, step_limit=10)`;
    lines.push(
      "",
      `# ${comments.multiHop}`,
      ...(walk.length <= WIDTH
        ? [walk]
        : [
            `reached = ${cls}.${first}.then(`,
            `    ${target}.${next}`,
            ").of(item, step_limit=10)",
          ]),
    );
  }
  return lines.join("\n");
}

function searchExample({ origin, question, comments }: OsdkExamplesInput) {
  const text = py(question);
  return [
    ...prelude(origin, [], ["import bkn"]),
    "",
    `# ${comments.searchTypes}`,
    `hits = bkn.search(${text}, max_concepts=5)`,
    'for entry in hits.get("object_types", []):',
    '    print(entry["concept_id"], entry["concept_name"])',
    "",
    `# ${comments.searchInstances}`,
    `found = bkn.search_instances(${text}, max_instances_per_type=3)`,
    'for node in found.get("nodes", []):',
    '    print(node["object_type_id"], node["properties"].get("_display"))',
  ].join("\n");
}

function cypherExample(origin: string, call: ToolCall) {
  const input = toolInput(call);
  if (typeof input.query !== "string") return null;
  const constant = pythonQuery(input.query) ?? `QUERY = ${py(input.query)}`;
  const parameters = input.parameters && typeof input.parameters === "object";
  return [
    ...prelude(origin, ["from bkn_osdk import kn"], ["import bkn"]),
    "",
    constant,
    ...(parameters ? [`parameters = ${literal(input.parameters, "py", "", 13)}`] : []),
    "",
    `result = kn.run_cypher(bkn.KN_ID, QUERY${parameters ? ", parameters=parameters" : ""})`,
    'for entry in result["entries"]:',
    "    print(entry)",
  ].join("\n");
}

/**
 * Examples for the package `bkn-osdk generate` writes, in the order a developer meets them.
 * Empty when the object type has no Python class name, as the generator would refuse it.
 */
export function renderOsdkExamples(input: OsdkExamplesInput): OsdkExample[] {
  const names = imports(input.knId, [input.objectTypeId]);
  const cls = names?.get(input.objectTypeId);
  if (!names || !cls) return [];
  const examples: OsdkExample[] = [
    {
      key: "query",
      code: queryExample(input, cls, prelude(input.origin, [], importLines(names))),
    },
  ];
  const relations = input.relation ? relationsExample(input, input.relation) : null;
  if (relations) examples.push({ key: "relations", code: relations });
  examples.push({ key: "search", code: searchExample(input) });
  const cypher = input.cypher ? cypherExample(input.origin, input.cypher) : null;
  if (cypher) examples.push({ key: "cypher", code: cypher });
  return examples;
}
