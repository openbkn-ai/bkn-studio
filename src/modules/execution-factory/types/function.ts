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
   * pip dependencies installed for debug runs. The sandbox base image has no third-party libraries,
   * so functions importing them fail with ModuleNotFoundError without this field, while published
   * Agent runs install stored dependencies and succeed, creating inconsistent behavior.
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
 * The sandbox produces stdout, stderr, and metrics, but the backend currently exposes only part
 * of the response. Model the complete shape and keep absent fields undefined so the UI says not returned rather than inventing zero.
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

/** Result from `POST /function/infer-schema`; when supported=false, reason explains why inference failed. */
export type InferredFunctionSchema = {
  description?: string;
  inputs?: FunctionParameterDef[];
  name?: string;
  outputs?: FunctionParameterDef[];
  reason?: string;
  supported: boolean;
};
