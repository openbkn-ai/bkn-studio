/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type FunctionParameterDef = {
  name?: string;
  type?: string;
  description?: string;
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
