/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  ObjectTypeLogicParameter,
  ObjectTypeLogicProperty,
} from "@/modules/knowledge-network/types/knowledge-network";
import {
  parseDynamicParamValue,
  setNestedDynamicParamValue,
} from "@/modules/knowledge-network/utils/action-type-dynamic-params";

export type LogicPropertyTrialInputParameter = {
  fieldName: string;
  logicPropertyDisplayName: string;
  logicPropertyName: string;
  parameter: ObjectTypeLogicParameter;
};

export function getLogicPropertyTrialInputParameters(
  logicProperties: ObjectTypeLogicProperty[],
): LogicPropertyTrialInputParameter[] {
  return logicProperties.flatMap((logicProperty) =>
    (logicProperty.parameters ?? [])
      .filter((parameter) => parameter.valueFrom === "input" && parameter.name.trim().length > 0)
      .map((parameter) => ({
        fieldName: `${logicProperty.name}:${parameter.name}`,
        logicPropertyDisplayName: logicProperty.displayName || logicProperty.name,
        logicPropertyName: logicProperty.name,
        parameter,
      })),
  );
}

export function buildLogicPropertyTrialDynamicParams(
  parameters: LogicPropertyTrialInputParameter[],
  values: Record<string, unknown>,
): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};

  for (const input of parameters) {
    const value = values[input.fieldName];
    if (value === undefined || value === null || (typeof value === "string" && !value.trim())) {
      continue;
    }

    const target = (result[input.logicPropertyName] ??= {});
    setNestedDynamicParamValue(
      target,
      input.parameter.name.trim(),
      parseDynamicParamValue(input.parameter.type, value),
    );
  }

  return result;
}
