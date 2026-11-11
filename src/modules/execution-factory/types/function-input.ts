/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Contract field names align with backend ParameterDef, where sub_parameters is recursively self-referential.
 * Backend constraint: sub_parameters applies only to objects and arrays, and arrays require exactly one child.
 */
export type FunctionParameterScalar = string | number | boolean;
export type FunctionParameterExample = FunctionParameterScalar | FunctionParameterScalar[] | null;

export type FunctionParameterDef = {
  name?: string;
  type?: string;
  description?: string;
  required?: boolean;
  /** A sample value. A Cypher function made from a data query keeps the value it was run with. */
  example?: FunctionParameterExample;
  sub_parameters?: FunctionParameterDef[];
};

/**
 * `python` runs code in the sandbox. `cypher` is a read-only Cypher statement run in a
 * knowledge network: its `$name` parameters are the inputs, and it has no outputs or
 * dependencies of its own.
 */
export type FunctionScriptType = "python" | "cypher";

/** What a Cypher function returns: `{value}` from one column and at most one row, or the rows. */
export type CypherResultShape = "value" | "table";

export type FunctionInputPayload = {
  name?: string;
  description?: string;
  code?: string;
  script_type?: FunctionScriptType;
  /** Cypher functions only: the knowledge network the statement queries. */
  kn_id?: string;
  /** Cypher functions only. */
  result_shape?: CypherResultShape;
  inputs?: FunctionParameterDef[];
  outputs?: FunctionParameterDef[];
  dependencies?: Array<{ name?: string; version?: string }>;
};
