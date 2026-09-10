/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { generateText, jsonSchema, stepCountIs, tool, type LanguageModel, type ToolSet } from "ai";

import type { KnDetail } from "@/modules/knowledge-network/services/context-loader.service";
import { stringifyValue, type ExpandDirection, type GEdge, type GNode, type KnCondition } from "@/modules/knowledge-network/services/graph-explorer.service";

export type ExplorePromptTexts = {
  intro: string;
  rulesHeader: string;
  rules: string[];
  propertiesLabel: string;
  objectTypesHeader: string;
  relationTypesHeader: string;
};

/** System prompt: the role and rules from the locale, then the network's object and relation types. */
export function buildExplorePrompt(detail: Pick<KnDetail, "object_types" | "relation_types">, texts: ExplorePromptTexts): string {
  const objectLines = detail.object_types.map((item) => {
    const props = (item.data_properties ?? [])
      .slice(0, 12)
      .map((property) => `${property.name}${property.type ? `:${property.type}` : ""}`)
      .join(", ");
    const comment = item.comment ? ` - ${item.comment.slice(0, 80)}` : "";
    return `- ${item.id} (${item.name?.trim() || item.id})${comment}${props ? `\n  ${texts.propertiesLabel}: ${props}` : ""}`;
  });
  const relationLines = detail.relation_types.map((item) => `- ${item.id} (${item.name?.trim() || item.id}): ${item.sourceId} -> ${item.targetId}`);
  return [
    texts.intro,
    "",
    texts.rulesHeader,
    ...texts.rules.map((rule, index) => `${index + 1}. ${rule}`),
    "",
    texts.objectTypesHeader,
    ...objectLines,
    "",
    texts.relationTypesHeader,
    ...relationLines,
  ].join("\n");
}

/* ------------------------------ what the model sees ------------------------------ */

export const ITEM_CAP = 20;
const PROP_CAP = 6;
const VALUE_CAP = 60;

export type ItemSummary = { id: string; type: string; label: string; props?: Record<string, string> };

/** A compact view of nodes for the model: id, type, label and, when asked, a few properties. */
export function summarizeNodes(nodes: GNode[], cap = ITEM_CAP, withProps = true): { count: number; items: ItemSummary[] } {
  const items = nodes.slice(0, cap).map((node) => {
    const item: ItemSummary = { id: node.id, type: node.otId, label: node.display };
    if (withProps) {
      const props: Record<string, string> = {};
      for (const [key, value] of Object.entries(node.props)) {
        if (key.startsWith("_") || value === null || value === undefined || value === "") continue;
        props[key] = stringifyValue(value).slice(0, VALUE_CAP);
        if (Object.keys(props).length >= PROP_CAP) break;
      }
      item.props = props;
    }
    return item;
  });
  return { count: nodes.length, items };
}

export function summarizeEdges(edges: GEdge[], cap = ITEM_CAP): { count: number; items: string[] } {
  return { count: edges.length, items: edges.slice(0, cap).map((edge) => `${edge.source} -[${edge.relTypeId}]-> ${edge.target}`) };
}

/* ------------------------------ tools ------------------------------ */

export type FilterInput = { field: string; operation: string; value?: unknown };

/** AND of the leaf filters the model asked for; null when there are none. */
export function conditionFrom(filters: FilterInput[] | undefined): KnCondition | null {
  const leaves: KnCondition[] = (filters ?? [])
    .filter((filter) => filter.field && filter.operation)
    .map((filter) => ({ field: filter.field, operation: filter.operation, value: filter.value }));
  if (leaves.length === 0) return null;
  return leaves.length === 1 ? leaves[0] : { operation: "and", sub_conditions: leaves };
}

const DIRECTIONS: Record<string, ExpandDirection> = { out: "forward", in: "backward", both: "bidirectional" };

export type Drawn = { nodes: GNode[]; edges: GEdge[]; added: { nodes: number; edges: number } };

/** What the page lends the agent; every call runs inside the page's managed turn. */
export type ExploreDeps = {
  search: (query: string, objectTypes: string[] | undefined, limit: number) => Promise<GNode[]>;
  query: (objectType: string, filters: FilterInput[], limit: number) => Promise<GNode[]>;
  show: (ids: string[]) => Promise<Drawn>;
  expand: (ids: string[], direction: ExpandDirection) => Promise<Drawn>;
  cypher: (match: string) => Promise<Drawn & { rows: number }>;
  canvas: () => { nodes: GNode[]; edges: GEdge[] };
};

export type ExploreStep = { tool: string; input: unknown; summary: string; ok: boolean; ms: number };

export type StepTexts = {
  found: (count: number) => string;
  drawn: (nodes: number, edges: number) => string;
  rows: (rows: number, nodes: number, edges: number) => string;
  failed: (message: string) => string;
};

type SearchInput = { query: string; object_types?: string[]; limit?: number };
type QueryInput = { object_type: string; filters?: FilterInput[]; limit?: number };
type IdsInput = { ids: string[] };
type ExpandInput = { ids: string[]; direction?: "out" | "in" | "both" };
type CypherInput = { match: string };

const idsSchema = { type: "array", items: { type: "string" }, minItems: 1, description: "Instance ids, each `<object type id>-<primary key value>`." } as const;

/**
 * The tool set the model explores with. A failing call reports the failure as its result so
 * the model can try something else instead of the whole run aborting.
 */
export function createExploreTools(deps: ExploreDeps, report: (step: ExploreStep) => void, texts: StepTexts): ToolSet {
  const run = async <T,>(name: string, input: unknown, call: () => Promise<T>, summarize: (value: T) => string): Promise<T | { error: string }> => {
    const started = performance.now();
    try {
      const value = await call();
      report({ tool: name, input, summary: summarize(value), ok: true, ms: Math.round(performance.now() - started) });
      return value;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      report({ tool: name, input, summary: texts.failed(message), ok: false, ms: Math.round(performance.now() - started) });
      return { error: message };
    }
  };
  const drawnSummary = (value: { added: { nodes: number; edges: number } }) => texts.drawn(value.added.nodes, value.added.edges);
  const drawnResult = (value: Drawn) => ({ ...summarizeNodes(value.nodes, ITEM_CAP, false), edges: summarizeEdges(value.edges), added: value.added });

  return {
    search_instances: tool({
      description:
        "Semantic search for instances by natural-language text. Returns candidates (id, type, label, a few properties); nothing is drawn. Use show_instances to put chosen ids on the canvas.",
      inputSchema: jsonSchema<SearchInput>({
        type: "object",
        properties: {
          query: { type: "string", description: "What to look for, in natural language." },
          object_types: { type: "array", items: { type: "string" }, description: "Restrict to these object type ids." },
          limit: { type: "integer", minimum: 1, maximum: 50, description: "Candidates per object type, default 20." },
        },
        required: ["query"],
        additionalProperties: false,
      }),
      execute: (input) => run("search_instances", input, async () => summarizeNodes(await deps.search(input.query, input.object_types, input.limit ?? 20)), (value) => texts.found(value.count)),
    }),
    query_instances: tool({
      description:
        "Exact filtering over one object type's properties (operations: ==, !=, >, >=, <, <=, in, like). Returns candidates; nothing is drawn. Names are usually long full names, so prefer search_instances for a short name.",
      inputSchema: jsonSchema<QueryInput>({
        type: "object",
        properties: {
          object_type: { type: "string", description: "Object type id." },
          filters: {
            type: "array",
            items: {
              type: "object",
              properties: { field: { type: "string" }, operation: { type: "string", enum: ["==", "!=", ">", ">=", "<", "<=", "in", "like"] }, value: {} },
              required: ["field", "operation"],
            },
            description: "Filters joined with AND; empty lists the first instances.",
          },
          limit: { type: "integer", minimum: 1, maximum: 100, description: "Default 20." },
        },
        required: ["object_type"],
        additionalProperties: false,
      }),
      execute: (input) => run("query_instances", input, async () => summarizeNodes(await deps.query(input.object_type, input.filters ?? [], input.limit ?? 20)), (value) => texts.found(value.count)),
    }),
    show_instances: tool({
      description: "Draw instances on the canvas by id, together with the relations among them. Returns what was drawn.",
      inputSchema: jsonSchema<IdsInput>({ type: "object", properties: { ids: idsSchema }, required: ["ids"], additionalProperties: false }),
      execute: (input) => run("show_instances", input, async () => drawnResult(await deps.show(input.ids)), drawnSummary),
    }),
    expand_neighbours: tool({
      description:
        "Draw the one-hop neighbours of the given instances. direction out follows the relation type's declared source -> target, in goes against it, both takes both (default). Returns the neighbours and edges found.",
      inputSchema: jsonSchema<ExpandInput>({
        type: "object",
        properties: { ids: idsSchema, direction: { type: "string", enum: ["out", "in", "both"] } },
        required: ["ids"],
        additionalProperties: false,
      }),
      execute: (input) => run("expand_neighbours", input, async () => drawnResult(await deps.expand(input.ids, DIRECTIONS[input.direction ?? "both"] ?? "bidirectional")), drawnSummary),
    }),
    run_cypher: tool({
      description:
        "Run an openCypher fragment and draw the result. Only `MATCH ... [WHERE ...]`: one MATCH with one continuous path, node labels are object type ids, every relation is directed and names exactly one relation type id, no variable length, no RETURN (the page adds it). Star shapes must be written as one chain, e.g. (a)<-[:r1]-(b)-[:r2]->(c).",
      inputSchema: jsonSchema<CypherInput>({ type: "object", properties: { match: { type: "string" } }, required: ["match"], additionalProperties: false }),
      execute: (input) =>
        run(
          "run_cypher",
          input,
          async () => {
            const value = await deps.cypher(input.match);
            return { ...drawnResult(value), rows: value.rows };
          },
          (value) => texts.rows(value.rows, value.added.nodes, value.added.edges),
        ),
    }),
    canvas_state: tool({
      description: "What is on the canvas right now: nodes (id, type, label) and edges.",
      inputSchema: jsonSchema<Record<string, never>>({ type: "object", properties: {}, additionalProperties: false }),
      execute: () =>
        run(
          "canvas_state",
          {},
          () => {
            const current = deps.canvas();
            return Promise.resolve({ nodes: summarizeNodes(current.nodes, 50, false), edges: summarizeEdges(current.edges, 50) });
          },
          (value) => texts.drawn(value.nodes.count, value.edges.count),
        ),
    }),
  };
}

export type ExploreRun = { text: string; steps: number };

/** One agent run: the model calls tools until it answers or the step budget is spent. */
export async function runExploreAgent(options: {
  model: LanguageModel;
  system: string;
  question: string;
  tools: ToolSet;
  maxSteps: number;
  signal?: AbortSignal;
}): Promise<ExploreRun> {
  const result = await generateText({
    model: options.model,
    system: options.system,
    prompt: options.question.trim(),
    tools: options.tools,
    stopWhen: stepCountIs(options.maxSteps),
    temperature: 0,
    abortSignal: options.signal,
  });
  return { text: result.text.trim(), steps: result.steps.length };
}
