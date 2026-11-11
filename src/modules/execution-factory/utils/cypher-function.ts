/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  CypherResultShape,
  FunctionParameterDef,
} from "@/modules/execution-factory/types/function-input";
import {
  blankCypherLiterals,
  scanCypherParameters,
} from "@/modules/knowledge-network/cypher/cypher-parameters";
import type { CypherResult } from "@/modules/knowledge-network/cypher/graph-values";

/**
 * The inputs a statement's `$name` parameters call for, in first-use order. A parameter already
 * declared keeps its type, description and example; a new one is a required string, or a number
 * when the statement uses it as SKIP or LIMIT; one the statement no longer uses is dropped. Every
 * input is required: bkn-backend has no optional parameter, a statement using `$name` fails
 * without one.
 */
export function syncCypherInputs(
  inputs: readonly FunctionParameterDef[],
  code: string,
): FunctionParameterDef[] {
  const byName = new Map(inputs.map((input) => [input.name ?? "", input]));
  const scan = scanCypherParameters(code);
  const rowCounts = rowCountParameters(code, scan.spans);
  return scan.names.map((name) => {
    const existing = byName.get(name);
    if (existing) return { ...existing, required: true };
    const type = rowCounts.has(name) ? "number" : "string";
    return { name, type, required: true, description: "" };
  });
}

/** The parameters a statement writes right after SKIP or LIMIT, which bkn-backend binds as row counts. */
function rowCountParameters(
  code: string,
  spans: ReturnType<typeof scanCypherParameters>["spans"],
): Set<string> {
  const text = blankCypherLiterals(code);
  return new Set(
    spans
      .filter((span) => /\b(SKIP|LIMIT)\s+$/i.test(text.slice(0, span.start)))
      .map((span) => span.name),
  );
}

/** Rows bkn-backend returns when the statement writes no LIMIT (CYPHER_DEFAULT_LIMIT). */
export const CYPHER_DEFAULT_LIMIT = 1000;
/** The largest LIMIT bkn-backend accepts (CYPHER_MAX_LIMIT). */
export const CYPHER_MAX_LIMIT = 10000;

export type CypherFunctionNotice =
  /** `$0`: the save takes named parameters only. */
  | { kind: "positional"; level: "warning" }
  | { kind: "limit-too-large"; level: "warning"; max: number }
  /** A table with no LIMIT gets the default rows, and `limited: true` when there were more. */
  | { kind: "table-default-limit"; level: "info"; rows: number }
  /** `LIMIT 1` with no ORDER BY picks whichever row comes first, which can change between runs. */
  | { kind: "value-unordered-limit"; level: "warning" };

/**
 * What to tell the author about the statement's rows before the save, for the shape it returns.
 * The final RETURN's ORDER BY and LIMIT are read; those of a WITH shape an inner step only.
 */
export function cypherFunctionNotices(
  code: string,
  shape: CypherResultShape,
): CypherFunctionNotice[] {
  const notices: CypherFunctionNotice[] = [];
  if (scanCypherParameters(code).positional) notices.push({ kind: "positional", level: "warning" });
  const text = blankCypherLiterals(code);
  const returns = [...text.matchAll(/\bRETURN\b/gi)];
  if (returns.length === 0) return notices;
  const tail = text.slice((returns[returns.length - 1].index ?? 0) + "RETURN".length);
  const limit = /\bLIMIT\s+(\d+)\b/i.exec(tail);
  const limitValue = limit ? Number(limit[1]) : null;
  const hasLimit = /\bLIMIT\b/i.test(tail);
  if (limitValue !== null && limitValue > CYPHER_MAX_LIMIT) {
    notices.push({ kind: "limit-too-large", level: "warning", max: CYPHER_MAX_LIMIT });
  }
  if (shape === "table" && !hasLimit) {
    notices.push({ kind: "table-default-limit", level: "info", rows: CYPHER_DEFAULT_LIMIT });
  }
  if (shape === "value" && limitValue === 1 && !/\bORDER\s+BY\b/i.test(tail)) {
    notices.push({ kind: "value-unordered-limit", level: "warning" });
  }
  return notices;
}

export function isSameInputList(
  a: readonly FunctionParameterDef[],
  b: readonly FunctionParameterDef[],
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

type Scalar = string | number | boolean;

export type CypherArgumentProblem =
  | { kind: "missing"; names: string[] }
  | { kind: "type"; name: string; expected: string }
  | { kind: "null-in-list"; name: string }
  | { kind: "not-object" };

function convertScalar(type: string | undefined, value: unknown): Scalar | undefined {
  switch (type) {
    case "number":
    case "integer":
      if (typeof value === "number") return value;
      if (typeof value === "string" && value.trim() && Number.isFinite(Number(value.trim()))) {
        return Number(value.trim());
      }
      return undefined;
    case "boolean":
      if (typeof value === "boolean") return value;
      if (typeof value === "string" && /^(true|false)$/i.test(value.trim())) {
        return value.trim().toLowerCase() === "true";
      }
      return undefined;
    default:
      if (typeof value === "string") return value;
      // A code sent without quotes: the same digits, as the execution factory sends it.
      if (typeof value === "number" || typeof value === "boolean") return String(value);
      return undefined;
  }
}

/**
 * The statement's parameters from a call's arguments, converted to the declared types the way
 * the execution factory converts them when the function is called, so a trial run here gets
 * what the saved function would. Undeclared arguments are left out.
 */
export function cypherArguments(
  args: unknown,
  inputs: readonly FunctionParameterDef[],
): { parameters: Record<string, unknown> } | { problem: CypherArgumentProblem } {
  if (args !== undefined && (typeof args !== "object" || args === null || Array.isArray(args))) {
    return { problem: { kind: "not-object" } };
  }
  const record = (args ?? {}) as Record<string, unknown>;
  const parameters: Record<string, unknown> = {};
  const missing: string[] = [];
  for (const input of inputs) {
    const name = input.name ?? "";
    const value = record[name];
    if (value === undefined || value === null) {
      missing.push(name);
      continue;
    }
    if (input.type === "array") {
      if (!Array.isArray(value)) {
        return { problem: { kind: "type", name, expected: "array" } };
      }
      const itemType = input.sub_parameters?.[0]?.type ?? "string";
      const items: Scalar[] = [];
      for (const element of value) {
        if (element === null || element === undefined) {
          return { problem: { kind: "null-in-list", name } };
        }
        const converted = convertScalar(itemType, element);
        if (converted === undefined) {
          return { problem: { kind: "type", name, expected: itemType } };
        }
        items.push(converted);
      }
      parameters[name] = items;
      continue;
    }
    const converted = convertScalar(input.type, value);
    if (converted === undefined) {
      return { problem: { kind: "type", name, expected: input.type ?? "string" } };
    }
    parameters[name] = converted;
  }
  if (missing.length > 0) {
    return { problem: { kind: "missing", names: missing } };
  }
  return { parameters };
}

const GRAPH_KINDS = new Set(["object", "relation", "map", "list"]);

export type CypherShapeProblem =
  | { kind: "columns"; count: number }
  | { kind: "graph"; column: string; valueKind: string }
  | { kind: "rows"; count: number; more: boolean };

function valueKind(valueTypes: Record<string, unknown> | undefined, column: string) {
  const entry = valueTypes?.[column];
  if (entry && typeof entry === "object" && "kind" in entry) {
    const kind = (entry as { kind?: unknown }).kind;
    return typeof kind === "string" ? kind : undefined;
  }
  return undefined;
}

/**
 * What the saved function returns for this result: `{value}` for the value shape, by the same
 * rules the execution factory applies, or `{columns, entries, limited}` for the table shape.
 */
export function shapeCypherResult(
  result: CypherResult,
  shape: CypherResultShape,
): { output: unknown } | { problem: CypherShapeProblem } {
  if (shape === "table") {
    return {
      output: {
        columns: result.columns,
        entries: result.entries,
        limited: result.limited === true,
      },
    };
  }
  if (result.columns.length !== 1) {
    return { problem: { kind: "columns", count: result.columns.length } };
  }
  const column = result.columns[0].name;
  const kind = valueKind(result.valueTypes, column);
  if (kind && GRAPH_KINDS.has(kind)) {
    return { problem: { kind: "graph", column, valueKind: kind } };
  }
  if (result.entries.length === 0) {
    return { output: { value: null } };
  }
  if (result.entries.length > 1) {
    return {
      problem: { kind: "rows", count: result.entries.length, more: result.limited === true },
    };
  }
  const value = result.entries[0][column];
  if (value !== null && typeof value === "object") {
    return {
      problem: { kind: "graph", column, valueKind: Array.isArray(value) ? "list" : "map" },
    };
  }
  return { output: { value: value ?? null } };
}
