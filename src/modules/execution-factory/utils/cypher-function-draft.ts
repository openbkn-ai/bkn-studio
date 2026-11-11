/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { FunctionParameterDef } from "@/modules/execution-factory/types/function-input";
import type { CypherLiteral } from "@/modules/knowledge-network/cypher/cypher-parameters";

/**
 * A statement written on the data query page, carried in location state to a function
 * workbench, which opens it as a new unsaved Cypher function.
 */
export type CypherFunctionDraft = {
  query: string;
  /** The network's id, which a Cypher function stores as its kn_id. */
  knId: string;
  /** Inputs for the statement's `$name` parameters, with the values tried as examples. */
  inputs?: FunctionParameterDef[];
};

export type CypherFunctionDraftState = { cypherDraft?: CypherFunctionDraft };

export function readCypherFunctionDraft(state: unknown): CypherFunctionDraft | undefined {
  if (!state || typeof state !== "object") {
    return undefined;
  }
  const draft = (state as CypherFunctionDraftState).cypherDraft;
  if (!draft || typeof draft.query !== "string" || typeof draft.knId !== "string") {
    return undefined;
  }
  return {
    query: draft.query,
    knId: draft.knId,
    inputs: Array.isArray(draft.inputs) ? draft.inputs : undefined,
  };
}

/** The same state without the draft, so a reload does not open it a second time. */
export function withoutCypherFunctionDraft(state: unknown): unknown {
  if (!state || typeof state !== "object" || !("cypherDraft" in state)) {
    return state;
  }
  const rest = { ...(state as Record<string, unknown>) };
  delete rest.cypherDraft;
  return rest;
}

/**
 * The inputs for a statement's parameters, typed by the values they were tried with, which are
 * kept as examples. A parameter without a value is a string.
 */
export function cypherDraftInputs(
  names: readonly string[],
  values: Readonly<Record<string, CypherLiteral | null>>,
): FunctionParameterDef[] {
  return names.map((name) => {
    const literal = values[name];
    if (!literal) {
      return { name, type: "string", required: true, description: "" };
    }
    if (literal.type === "array") {
      return {
        name,
        type: "array",
        required: true,
        description: "",
        example: literal.value,
        sub_parameters: [{ name: "items", type: literal.itemType }],
      };
    }
    return { name, type: literal.type, required: true, description: "", example: literal.value };
  });
}
