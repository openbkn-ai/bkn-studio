/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * 契约字段名跟后端 ParameterDef 对齐（sub_parameters 递归自引用）。
 * 后端约束：sub_parameters 只在 object/array 上有意义，array 必须恰好 1 个子项。
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
