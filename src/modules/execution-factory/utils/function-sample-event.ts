/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { FunctionParameterDef } from "@/modules/execution-factory/types/function-input";

/**
 * 按已声明的入参造一份 event 骨架。参数都已经填好了，还让用户对着 `{}` 手敲
 * 一遍字段名纯属重复劳动，敲错了还得靠报错才发现。
 */

function sampleValue(parameter: FunctionParameterDef): unknown {
  switch (parameter.type) {
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return false;
    case "array": {
      const item = parameter.sub_parameters?.[0];
      return item ? [sampleValue(item)] : [];
    }
    case "object":
      return sampleObject(parameter.sub_parameters ?? []);
    default:
      return "";
  }
}

function sampleObject(parameters: FunctionParameterDef[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  parameters.forEach((parameter, index) => {
    const name = parameter.name?.trim();
    // 没命名的参数在契约里也是废的，占位名只是别让它凭空消失。
    result[name || `arg${index + 1}`] = sampleValue(parameter);
  });

  return result;
}

export function buildSampleEvent(inputs: FunctionParameterDef[] | undefined): string {
  if (!inputs || inputs.length === 0) {
    return "{}";
  }

  return JSON.stringify(sampleObject(inputs), null, 2);
}
