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

/** 后端有时把结构化结果塞在字符串里（模型直出 JSON），这里统一先尝试解析一层。 */
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
      // 保留后端约束字段：array/object 缺子项写回表单会撞 sub_parameters 校验。
      ...(typeof record.required === "boolean" ? { required: record.required } : {}),
      ...(subParameters ? { sub_parameters: subParameters } : {}),
    });
  });

  return items.length > 0 ? items : undefined;
}

/**
 * 把 AI 生成结果翻译成可以直接写回表单的结构。
 * 生成代码返回字符串，反推参数返回对象——两条路走同一个接口，只能靠形状分辨。
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
