/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ActionTypeExecutionParameter } from "@/modules/knowledge-network/types/knowledge-network";
import type { ActionTypeToolInputParam } from "@/modules/knowledge-network/utils/tool-input-params";

const JSON_PARAM_TYPES = new Set(["array", "object"]);
const UNSAFE_PATH_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);

export function getActionTypeDynamicParameters(
  parameters: ActionTypeExecutionParameter[],
): ActionTypeExecutionParameter[] {
  return parameters.filter(
    (parameter) => parameter.valueFrom === "input" && parameter.name.trim().length > 0,
  );
}

export function indexActionTypeToolInputSchema(
  schema: ActionTypeToolInputParam[],
): Map<string, ActionTypeToolInputParam> {
  const result = new Map<string, ActionTypeToolInputParam>();

  const walk = (nodes: ActionTypeToolInputParam[]) => {
    for (const node of nodes) {
      result.set(node.key, node);
      if (node.children?.length) {
        walk(node.children);
      }
    }
  };

  walk(schema);
  return result;
}

export function parseActionTypeDynamicParamValue(type: string | undefined, value: unknown) {
  if (!JSON_PARAM_TYPES.has(type?.toLowerCase() ?? "") || typeof value !== "string") {
    return value;
  }

  return JSON.parse(value) as unknown;
}

function setNestedValue(target: Record<string, unknown>, path: string, value: unknown) {
  const segments = path.split(".").filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => UNSAFE_PATH_SEGMENTS.has(segment))) {
    throw new Error(`Invalid dynamic parameter path: ${path}`);
  }

  let current = target;
  for (const [index, segment] of segments.entries()) {
    if (index === segments.length - 1) {
      current[segment] = value;
      return;
    }

    const existing = current[segment];
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  }
}

export function buildActionTypeDynamicParams(
  parameters: ActionTypeExecutionParameter[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const parameter of parameters) {
    const name = parameter.name.trim();
    setNestedValue(
      result,
      name,
      parseActionTypeDynamicParamValue(parameter.type, values[name]),
    );
  }

  return result;
}
