/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { FunctionParameterDef } from "@/modules/execution-factory/types/function-input";

/**
 * Builds an event skeleton from declared inputs. Making users type field names into `{}` after
 * parameters are already known is redundant and exposes typos only through later errors.
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
    // Unnamed parameters are unusable in the contract; the placeholder only prevents them disappearing entirely.
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
