/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { FunctionParameterDef } from "@/modules/execution-factory/types/function-input";

export type FunctionExecuteInput = {
  code: string;
  /**
   * 调试运行要装的 pip 依赖。沙箱基础镜像不预装任何三方库，不带这个字段的话，
   * 凡是 import 了三方包的函数在调试里必 ModuleNotFoundError——而保存发布后
   * Agent 那条路径是从库里读依赖装的，能跑通，两边行为会对不上。
   */
  dependencies?: Array<{ name?: string; version?: string }>;
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
