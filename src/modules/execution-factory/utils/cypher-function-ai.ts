/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  CypherResultShape,
  FunctionParameterDef,
  FunctionParameterScalar,
} from "@/modules/execution-factory/types/function-input";
import { extractCypherQuery } from "@/modules/knowledge-network/cypher/cypher-ai";
import { scanCypherParameters } from "@/modules/knowledge-network/cypher/cypher-parameters";

/**
 * The wording of a request for a Cypher function, in the reader's language. The BKN Agent's
 * `cypher_generation` writes queries with fixed values for the data query page; these lines ask
 * it for the function's contract instead, and say they come first.
 */
export type CypherFunctionAiTexts = {
  /** Opens the request; `{{description}}` is what the user wrote. */
  request: string;
  contract: string;
  parameters: string;
  trial: string;
  shapeValue: string;
  shapeTable: string;
  answer: string;
  /** Heads the list of parameters the function already declares. */
  existing: string;
};

const fill = (text: string, values: Record<string, string>) =>
  text.replace(/\{\{(\w+)\}\}/g, (_, name: string) => values[name] ?? "");

export function cypherFunctionMessage(params: {
  description: string;
  shape: CypherResultShape;
  inputs: readonly FunctionParameterDef[];
  texts: CypherFunctionAiTexts;
}): string {
  const { texts } = params;
  const lines = [
    fill(texts.request, { description: params.description.trim() }),
    texts.contract,
    `- ${texts.parameters}`,
    `- ${texts.trial}`,
    `- ${params.shape === "value" ? texts.shapeValue : texts.shapeTable}`,
    `- ${texts.answer}`,
  ];
  const declared = params.inputs.filter((input) => input.name);
  if (declared.length > 0) {
    lines.push(texts.existing);
    for (const input of declared) {
      const description = input.description?.trim();
      lines.push(
        `- $${input.name} (${input.type ?? "string"})${description ? `: ${description}` : ""}`,
      );
    }
  }
  return lines.join("\n");
}

export type CypherFunctionSuggestion = {
  query: string;
  /** What the Agent said about each parameter, keyed by name; only names the query uses. */
  parameters: Record<string, Pick<FunctionParameterDef, "type" | "description" | "example">>;
};

const isScalar = (value: unknown): value is FunctionParameterScalar =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean";

/** A value a parameter can be tried with: a string, number or boolean, or a list of one of them. */
function isExample(value: unknown): value is FunctionParameterScalar | FunctionParameterScalar[] {
  return isScalar(value) || (Array.isArray(value) && value.length > 0 && value.every(isScalar));
}

const PARAMETER_TYPES = new Set(["string", "number", "integer", "boolean", "array"]);
const JSON_FENCE = /```[ \t]*json[ \t]*\n?([\s\S]*?)```/gi;

function readParameterList(text: string): unknown[] {
  try {
    const value: unknown = JSON.parse(text);
    if (Array.isArray(value)) return value;
    if (
      value &&
      typeof value === "object" &&
      Array.isArray((value as { parameters?: unknown }).parameters)
    ) {
      return (value as { parameters: unknown[] }).parameters;
    }
  } catch {
    // Not the list asked for; the query is still usable without it.
  }
  return [];
}

/**
 * Reads the Agent's answer: the query from its cypher block, and the parameters' descriptions
 * and examples from the json block it was asked to add. The json block is taken out first so it
 * is never mistaken for the query. A parameter the query does not use is dropped.
 */
export function parseCypherFunctionAnswer(answer: string): CypherFunctionSuggestion {
  const blocks = [...answer.matchAll(JSON_FENCE)].map((match) => match[1]);
  const query = extractCypherQuery(answer.replace(JSON_FENCE, ""));
  const used = new Set(scanCypherParameters(query).names);
  const parameters: CypherFunctionSuggestion["parameters"] = {};
  for (const block of blocks) {
    for (const item of readParameterList(block)) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name.replace(/^\$/, "") : "";
      if (!used.has(name)) continue;
      const type =
        typeof record.type === "string" && PARAMETER_TYPES.has(record.type)
          ? record.type
          : undefined;
      const description = typeof record.description === "string" ? record.description.trim() : "";
      parameters[name] = {
        ...(type ? { type } : {}),
        ...(description ? { description } : {}),
        ...(isExample(record.example) ? { example: record.example } : {}),
      };
    }
  }
  return { query, parameters };
}

/** A list's item type, read from its example: a list of numbers takes numbers. */
function itemType(example: unknown): string {
  const first: unknown = Array.isArray(example) ? example[0] : undefined;
  if (typeof first === "number") return "number";
  if (typeof first === "boolean") return "boolean";
  return "string";
}

/**
 * The inputs once the suggested query is applied: the statement decides which parameters there
 * are; what the author already wrote about one is kept, and the Agent's word fills only what is
 * still blank.
 */
export function applySuggestedParameters(
  inputs: readonly FunctionParameterDef[],
  suggestion: CypherFunctionSuggestion["parameters"],
): FunctionParameterDef[] {
  return inputs.map((input) => {
    const suggested = suggestion[input.name ?? ""];
    if (!suggested) return input;
    const blankDescription = !input.description?.trim();
    // A new parameter starts as a string; the Agent's type replaces only that default.
    const untyped = blankDescription && (input.type ?? "string") === "string";
    const type = untyped && suggested.type ? suggested.type : input.type;
    return {
      ...input,
      ...(type !== input.type ? { type } : {}),
      ...(type === "array" && !input.sub_parameters?.length
        ? { sub_parameters: [{ name: "items", type: itemType(suggested.example) }] }
        : {}),
      ...(blankDescription && suggested.description ? { description: suggested.description } : {}),
      ...(input.example === undefined && suggested.example !== undefined
        ? { example: suggested.example }
        : {}),
    };
  });
}
