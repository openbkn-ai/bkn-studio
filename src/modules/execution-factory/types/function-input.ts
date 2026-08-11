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
export type FunctionParameterDef = {
  name?: string;
  type?: string;
  description?: string;
  required?: boolean;
  sub_parameters?: FunctionParameterDef[];
};

export type FunctionInputPayload = {
  name?: string;
  description?: string;
  code?: string;
  script_type?: "python";
  inputs?: FunctionParameterDef[];
  outputs?: FunctionParameterDef[];
  dependencies?: Array<{ name?: string; version?: string }>;
};
