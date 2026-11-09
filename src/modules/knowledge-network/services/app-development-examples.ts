/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Code examples for the workspace "App development" page.
 *
 * Every example starts as one tool input taken from the network's real structure. The REST,
 * Python and TypeScript renderings all come from that one input, and the input is checked
 * against the platform's own tool definitions (MCP tools/list) rather than a contract kept here.
 */

import type { McpToolDef } from "@/modules/knowledge-network/services/context-loader.service";

export const REST_KN_PREFIX = "/api/agent-retrieval/v1/kn";

/** One call to a Context Loader tool. The tool input is `query` and `body` together. */
export type ToolCall = {
  tool: string;
  knId: string;
  /** REST query-string parameters, other than response_format. */
  query: Record<string, string>;
  /** REST body. */
  body: Record<string, unknown>;
};

export type SampleRow = Record<string, unknown>;

type Scalar = string | number | boolean;

function isScalar(value: unknown): value is Scalar {
  return (
    typeof value === "number" ||
    typeof value === "boolean" ||
    (typeof value === "string" && value.trim() !== "")
  );
}

/** Business fields of a sample row with a usable value, in row order. */
export function scalarFields(row: SampleRow | null): Array<[string, Scalar]> {
  if (!row) return [];
  return Object.entries(row).filter((entry): entry is [string, Scalar] => {
    const [key, value] = entry;
    return !key.startsWith("_") && isScalar(value);
  });
}

/** The row's primary key, one entry per key field; composite keys have several. */
export function instanceIdentity(row: SampleRow | null): Record<string, unknown> | null {
  const identity = row?._instance_identity;
  if (!identity || typeof identity !== "object" || Array.isArray(identity)) return null;
  const entries = Object.entries(identity as Record<string, unknown>);
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

export function toolInput(call: ToolCall): Record<string, unknown> {
  return { ...call.query, ...call.body };
}

/* ============================ Tool inputs ============================ */

export function queryObjectsCall(knId: string, objectTypeId: string, row: SampleRow | null) {
  const [field] = scalarFields(row);
  const body: Record<string, unknown> = {};
  if (field) body.filters = [{ field: field[0], op: "==", value: field[1] }];
  body.limit = 10;
  return {
    call: {
      tool: "query_object_instance",
      knId,
      query: { kn_id: knId, ot_id: objectTypeId },
      body,
    } satisfies ToolCall,
    filtered: Boolean(field),
  };
}

/** Cypher identifiers are always backquoted, so ids with dashes or CJK names stay valid. */
export function cypherIdentifier(name: string) {
  return `\`${name.replaceAll("`", "``")}\``;
}

function cypherParameterName(field: string, taken: Set<string>) {
  let name = field.replace(/\W/g, "_");
  if (!/^[A-Za-z_]/.test(name)) name = `p_${name}`;
  while (taken.has(name)) name = `${name}_`;
  taken.add(name);
  return name;
}

/**
 * Up to three target fields a reader recognises: the key first, then names, then the rest. Row
 * field order comes from the backend and carries no meaning.
 */
function readableFields(row: SampleRow | null): string[] {
  const fields = scalarFields(row).map(([name]) => name);
  const keys = Object.keys(instanceIdentity(row) ?? {}).filter((name) => fields.includes(name));
  const named = fields.filter((name) => /name/i.test(name));
  return [...new Set([...keys, ...named, ...fields])].slice(0, 3);
}

export type CypherRelation = { id: string; sourceId: string; targetId: string };

/**
 * Walks one real relation from a sample start instance. A single-field key binds `$id`; a
 * composite key binds one parameter per key field. Returning named properties rather than the
 * node matters: a returned node carries only its key.
 */
export function cypherCall(
  knId: string,
  relation: CypherRelation,
  sourceRow: SampleRow | null,
  targetRow: SampleRow | null,
) {
  const identity = instanceIdentity(sourceRow);
  const parameters: Record<string, unknown> = {};
  let start = "";
  if (identity) {
    const keys = Object.keys(identity);
    if (keys.length === 1) {
      start = ` {${cypherIdentifier(keys[0])}: $id}`;
      parameters.id = identity[keys[0]];
    } else {
      const taken = new Set<string>();
      start = ` {${keys
        .map((key) => {
          const name = cypherParameterName(key, taken);
          parameters[name] = identity[key];
          return `${cypherIdentifier(key)}: $${name}`;
        })
        .join(", ")}}`;
    }
  }
  const fields = readableFields(targetRow);
  const returns = fields.length
    ? fields.map((name) => `t.${cypherIdentifier(name)}`).join(", ")
    : "t";
  const statement =
    `MATCH (s:${cypherIdentifier(relation.sourceId)}${start})` +
    `-[:${cypherIdentifier(relation.id)}]->(t:${cypherIdentifier(relation.targetId)}) ` +
    `RETURN ${returns} LIMIT 10`;
  const body: Record<string, unknown> = { kn_id: knId, query: statement };
  if (Object.keys(parameters).length > 0) body.parameters = parameters;
  return {
    call: { tool: "run_cypher", knId, query: {}, body } satisfies ToolCall,
    anchored: Boolean(identity),
  };
}

export function searchCall(knId: string, text: string): ToolCall {
  return { tool: "search_instance", knId, query: {}, body: { kn_id: knId, query: text } };
}

export function metricCall(knId: string, metricId: string, version: number): ToolCall {
  return {
    tool: "query_metric",
    knId,
    query: {},
    body: { kn_id: knId, metric_id: metricId, version },
  };
}

function placeholderFor(name: string, type?: string): unknown {
  switch ((type ?? "").toLowerCase()) {
    case "integer":
    case "number":
    case "float":
    case "double":
      return 0;
    case "boolean":
    case "bool":
      return false;
    case "object":
    case "map":
      return {};
    case "array":
    case "list":
      return [];
    default:
      return `<${name}>`;
  }
}

export type ActionInputParameter = { name: string; type?: string };

/**
 * Names its target instances unless the action creates objects, which has none. An empty
 * `_instance_identities` means "every instance the action's own condition matches", which is not
 * something a copied example should do by accident.
 */
export function actionCall(
  knId: string,
  actionTypeId: string,
  inputs: ActionInputParameter[],
  targetRow: SampleRow | null,
  options: { createsObjects?: boolean } = {},
): ToolCall {
  const body: Record<string, unknown> = { kn_id: knId, at_id: actionTypeId };
  if (!options.createsObjects) {
    body._instance_identities = [instanceIdentity(targetRow) ?? { "<primary key>": "<value>" }];
  }
  if (inputs.length > 0) {
    body.dynamic_params = Object.fromEntries(
      inputs.map((input) => [input.name, placeholderFor(input.name, input.type)]),
    );
  }
  return { tool: "execute_action", knId, query: {}, body };
}

type JsonSchemaObject = {
  properties?: Record<string, { type?: string } | undefined>;
  required?: string[];
};

/** Reads the JSON body schema out of an execution-factory tool input schema. */
export function functionBodySchema(inputSchema: unknown): JsonSchemaObject | null {
  if (!inputSchema || typeof inputSchema !== "object") return null;
  const requestBody = (inputSchema as { request_body?: unknown }).request_body;
  const content = (
    requestBody as { content?: Record<string, { schema?: JsonSchemaObject }> } | undefined
  )?.content;
  const schema = content?.["application/json"]?.schema;
  return schema && typeof schema === "object" ? schema : null;
}

/** Required arguments only, as placeholders: a function definition carries no example values. */
export function functionCall(
  knId: string,
  toolboxId: string,
  toolId: string,
  inputSchema: unknown,
): ToolCall {
  const schema = functionBodySchema(inputSchema);
  const args = Object.fromEntries(
    (schema?.required ?? []).map((name) => [
      name,
      placeholderFor(name, schema?.properties?.[name]?.type),
    ]),
  );
  return {
    tool: "execute_tool",
    knId,
    query: {},
    body: { kn_id: knId, toolbox_id: toolboxId, tool_id: toolId, arguments: args },
  };
}

/* ============================ Install ============================ */

/**
 * The bkn-sdk commit the Python install pins. Bump it with each Studio release, to bkn-sdk main's
 * head at the time, after running this page's examples on that platform version.
 */
export const BKN_OSDK_COMMIT = "57d39f0f94804105db89b6151bfaf8a3ffddf888";

/** The requirement pip and uv both accept for the pinned SDK, quoted for the shell. */
export function bknOsdkRequirement(commit = BKN_OSDK_COMMIT) {
  return `"bkn-osdk @ git+https://github.com/openbkn-ai/bkn-sdk@${commit}#subdirectory=python"`;
}

/** `extras` are other packages installed alongside, such as a sample app's web framework. */
export function pythonInstallCommand(commit = BKN_OSDK_COMMIT, extras: string[] = []) {
  return ["pip install", ...extras, bknOsdkRequirement(commit)].join(" ");
}

/** How a Python project gets its environment: a venv with pip, or uv. */
export type PythonTool = "venv" | "uv";

export type PythonSetupComments = { python: string; activate: string; uv: string };

/**
 * A project directory with its own environment, and `packages` installed into it. `python3` can
 * be older than the SDK's 3.10 floor, which the venv comment says; uv picks a Python itself.
 * `uv init` needs `--app --no-package`: newer uv otherwise lays out a `src/` package with no
 * `main.py` beside which the generated package could sit.
 */
export function pythonProjectCommands(
  tool: PythonTool,
  project: string,
  packages: string[],
  comments: PythonSetupComments,
) {
  if (tool === "uv") {
    return [
      `uv init --app --no-package ${project} && cd ${project}  # ${comments.uv}`,
      `uv add ${packages.join(" ")}`,
    ].join("\n");
  }
  return [
    `mkdir ${project} && cd ${project}`,
    `python3 -m venv .venv  # ${comments.python}`,
    `source .venv/bin/activate  # ${comments.activate}`,
    `pip install ${packages.join(" ")}`,
  ].join("\n");
}

/** Just the line that adds packages, for a docstring recalling the setup. */
export function pythonAddCommand(tool: PythonTool, packages: string[]) {
  return `${tool === "uv" ? "uv add" : "pip install"} ${packages.join(" ")}`;
}

/** A command run inside the project: uv runs it in its environment, a venv is already active. */
export function pythonRun(tool: PythonTool, command: string) {
  return tool === "uv" ? `uv run ${command}` : command;
}

/** Runnable scripts for the same commit the install command pins. */
export function osdkExamplesUrl(commit = BKN_OSDK_COMMIT) {
  return `https://github.com/openbkn-ai/bkn-sdk/tree/${commit}/python/examples`;
}

/** The TypeScript SDK refuses a platform whose major.minor.patch differs from its own. */
export function sdkVersionOf(serverVersion: string | null | undefined) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?/.exec(serverVersion?.trim() ?? "");
  if (!match) return null;
  return { version: `${match[1]}.${match[2]}.${match[3]}`, prerelease: Boolean(match[4]) };
}

/**
 * A release platform takes the SDK of its exact version. A development build has no such release
 * yet, so it takes a range over that version's prereleases and the release itself: today an rc,
 * the release once it is out, and never the next version, which the SDK would refuse.
 */
export function typeScriptInstallCommand(sdk: { version: string; prerelease: boolean } | null) {
  if (!sdk) return "npm install @openbkn/bkn-sdk";
  if (!sdk.prerelease) return `npm install @openbkn/bkn-sdk@${sdk.version}`;
  const [major, minor, patch] = sdk.version.split(".").map(Number);
  const next = `${String(major)}.${String(minor)}.${String(patch + 1)}`;
  return `npm install "@openbkn/bkn-sdk@>=${sdk.version}-0 <${next}-0"`;
}

export function generateCommand(knId: string) {
  return `bkn-osdk generate ${knId} --out ./bkn`;
}

/* ============================ Checks ============================ */

export type ExampleCheck =
  | { status: "ok" }
  | { status: "unchecked" }
  | { status: "mismatch"; missing: string[]; undeclared: string[]; unknownTool: boolean };

/**
 * Holds one example against the platform's tool definition. `bkn_context` is required there but
 * never appears in an example: the SDKs open the session, and REST reads run without one.
 * Undeclared fields count as a mismatch for every tool: the platform ignores them, the Python
 * SDK rejects them.
 */
export function checkExample(call: ToolCall, tools: McpToolDef[] | null): ExampleCheck {
  if (!tools) return { status: "unchecked" };
  const tool = tools.find((item) => item.name === call.tool);
  if (!tool) return { status: "mismatch", missing: [], undeclared: [], unknownTool: true };
  const schema = (tool.inputSchema ?? {}) as JsonSchemaObject;
  const declared = new Set(Object.keys(schema.properties ?? {}));
  const input = toolInput(call);
  const missing = (schema.required ?? []).filter(
    (name) => name !== "bkn_context" && !(name in input),
  );
  const undeclared = Object.keys(input).filter((name) => !declared.has(name));
  return missing.length || undeclared.length
    ? { status: "mismatch", missing, undeclared, unknownTool: false }
    : { status: "ok" };
}
