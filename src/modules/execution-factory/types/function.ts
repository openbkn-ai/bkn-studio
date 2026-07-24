/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { FunctionParameterDef } from "@/modules/execution-factory/types/function-input";

export type FunctionExecuteInput = {
  code: string;
  event?: Record<string, unknown>;
  timeout?: number;
};

export type FunctionExecuteMetrics = {
  cpuTimeMs?: number;
  durationMs?: number;
  memoryPeakMb?: number;
};

/**
 * 沙箱本来就产出 stdout/stderr/metrics，后端回包目前只透出一部分（exit_code 等还在补）。
 * 这里按完整形状收，缺的字段保持 undefined，由 UI 显示「后端未返回」而不是编造 0。
 */
export type FunctionExecuteResult = {
  output?: unknown;
  error?: string;
  durationMs?: number;
  exitCode?: number;
  metrics?: FunctionExecuteMetrics;
  sessionId?: string;
  stderr?: string;
  stdout?: string;
};

export type FunctionAiGenerateType =
  | "python_function_generator"
  | "metadata_param_generator";

export type FunctionAiGenerateInput = {
  type: FunctionAiGenerateType;
  query?: string;
  code?: string;
};

export type FunctionAiGenerateResult = {
  content?: unknown;
  prompt?: string;
};

/** `POST /function/infer-schema` 的结果；supported=false 时 reason 说明为什么推不出来。 */
export type InferredFunctionSchema = {
  description?: string;
  inputs?: FunctionParameterDef[];
  name?: string;
  outputs?: FunctionParameterDef[];
  reason?: string;
  supported: boolean;
};
