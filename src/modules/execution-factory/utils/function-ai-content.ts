/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { FunctionAiGenerateType } from "@/modules/execution-factory/types/function";
import type { FunctionParameterDef } from "@/modules/execution-factory/types/function-input";

export type FunctionAiApplyResult =
  | { type: "code"; code: string }
  | {
      type: "metadata";
      description?: string;
      inputs?: FunctionParameterDef[];
      name?: string;
      outputs?: FunctionParameterDef[];
      useRule?: string;
    };

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

/** The backend sometimes places structured results in a string because the model emits JSON directly; parse one layer first. */
function unwrap(content: unknown): unknown {
  if (typeof content !== "string") {
    return content;
  }

  const trimmed = content.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return content;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return content;
  }
}

function mapParameters(value: unknown): FunctionParameterDef[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items: FunctionParameterDef[] = [];

  value.forEach((item) => {
    const record = asRecord(item);
    const name = record ? asString(record.name) : undefined;

    if (!record || !name) {
      return;
    }

    const subParameters = mapParameters(record.sub_parameters);

    items.push({
      name,
      type: asString(record.type) ?? "string",
      description: asString(record.description) ?? asString(record.desc),
      // Retain backend constraint fields: writing arrays or objects without children back to the form fails sub_parameters validation.
      ...(typeof record.required === "boolean" ? { required: record.required } : {}),
      ...(subParameters ? { sub_parameters: subParameters } : {}),
    });
  });

  return items.length > 0 ? items : undefined;
}

/**
 * Converts AI-generated results into a structure that can be written directly to the form. Generated
 * code returns a string while inferred parameters return an object; both use one API and are distinguished by shape.
 */
export function parseFunctionAiContent(
  generateType: FunctionAiGenerateType,
  content: unknown,
): FunctionAiApplyResult | null {
  const unwrapped = unwrap(content);

  if (generateType === "python_function_generator") {
    const code = asString(unwrapped) ?? asString(asRecord(unwrapped)?.code);
    return code ? { type: "code", code } : null;
  }

  const record = asRecord(unwrapped);
  if (!record) {
    return null;
  }

  const result: FunctionAiApplyResult = {
    type: "metadata",
    description: asString(record.description),
    inputs: mapParameters(record.inputs),
    name: asString(record.name),
    outputs: mapParameters(record.outputs),
    useRule: asString(record.use_rule) ?? asString(record.useRule),
  };

  const hasAnything =
    result.description !== undefined ||
    result.inputs !== undefined ||
    result.name !== undefined ||
    result.outputs !== undefined ||
    result.useRule !== undefined;

  return hasAnything ? result : null;
}
