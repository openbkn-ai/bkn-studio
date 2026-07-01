/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ActionTypeExecutionParameter } from "@/modules/knowledge-network/types/knowledge-network";

import type { ActionTypeToolInputParam } from "./tool-input-params";

export type ActionTypeParamTableRow = {
  children?: ActionTypeParamTableRow[];
  description?: string;
  key: string;
  name: string;
  source?: string;
  type: string;
  value?: string;
  valueFrom?: ActionTypeExecutionParameter["valueFrom"];
};

export function buildDefaultExecutionParameters(
  schema: ActionTypeToolInputParam[],
): ActionTypeExecutionParameter[] {
  const parameters: ActionTypeExecutionParameter[] = [];

  const walk = (nodes: ActionTypeToolInputParam[]) => {
    for (const node of nodes) {
      if (node.children?.length) {
        walk(node.children);
        continue;
      }

      parameters.push({
        description: node.description,
        name: node.key,
        source: node.source,
        type: node.type,
        value: "",
        valueFrom: "input",
      });
    }
  };

  walk(schema);
  return parameters;
}

export function mergeExecutionParametersWithSchema(
  schema: ActionTypeToolInputParam[],
  saved: ActionTypeExecutionParameter[],
): ActionTypeExecutionParameter[] {
  const savedByName = new Map(saved.map((item) => [item.name, item]));
  const defaults = buildDefaultExecutionParameters(schema);

  return defaults.map((item) => {
    const matched = savedByName.get(item.name);
    if (!matched) {
      return item;
    }

    return {
      ...item,
      value: matched.value ?? matched.sourcePropertyName ?? "",
      valueFrom: matched.valueFrom ?? "input",
    };
  });
}

function mergeRowWithParameter(
  node: ActionTypeToolInputParam,
  parameterByName: Map<string, ActionTypeExecutionParameter>,
): ActionTypeParamTableRow {
  const matched = parameterByName.get(node.key);

  return {
    name: node.name,
    key: node.key,
    type: node.type,
    description: node.description,
    source: node.source,
    valueFrom: matched?.valueFrom ?? "input",
    value: matched?.value ?? matched?.sourcePropertyName ?? "",
    children: node.children?.length
      ? node.children.map((child) => mergeRowWithParameter(child, parameterByName))
      : undefined,
  };
}

export function buildParamTableRows(
  schema: ActionTypeToolInputParam[],
  parameters: ActionTypeExecutionParameter[],
): ActionTypeParamTableRow[] {
  const parameterByName = new Map(parameters.map((item) => [item.name, item]));
  return schema.map((node) => mergeRowWithParameter(node, parameterByName));
}

export function extractLeafExecutionParameters(
  rows: ActionTypeParamTableRow[],
): ActionTypeExecutionParameter[] {
  const parameters: ActionTypeExecutionParameter[] = [];

  const walk = (nodes: ActionTypeParamTableRow[]) => {
    for (const node of nodes) {
      if (node.children?.length) {
        walk(node.children);
        continue;
      }

      parameters.push({
        description: node.description,
        name: node.key,
        source: node.source,
        type: node.type,
        value: node.value ?? "",
        valueFrom: node.valueFrom ?? "input",
        sourcePropertyName: node.valueFrom === "property" ? node.value ?? "" : "",
      });
    }
  };

  walk(rows);
  return parameters;
}

export function updateParamTableRow(
  rows: ActionTypeParamTableRow[],
  key: string,
  patch: Partial<ActionTypeParamTableRow>,
): ActionTypeParamTableRow[] {
  return rows.map((row) => {
    if (row.key === key) {
      return { ...row, ...patch };
    }

    if (row.children?.length) {
      return {
        ...row,
        children: updateParamTableRow(row.children, key, patch),
      };
    }

    return row;
  });
}
