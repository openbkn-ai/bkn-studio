/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { FunctionParameterDef } from "@/modules/execution-factory/types/function-input";

/**
 * 函数工具的入参/出参声明在 GET 详情里不回 function_content，只能从 api_spec 的
 * JSON Schema 反解。不解的话编辑表单是空的，一保存就把已声明的参数覆盖没了。
 */

/** JSON Schema 的 array 元素没有名字，往返时用后端同款占位名补上。 */
export const ARRAY_ITEM_NAME = "item";

export type JsonSchema = {
  description?: string;
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  type?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asSchema(value: unknown): JsonSchema | null {
  return asRecord(value);
}

function jsonContentSchema(content: unknown): JsonSchema | null {
  const record = asRecord(content);
  const json = record ? asRecord(record["application/json"]) : null;
  return json ? asSchema(json.schema) : null;
}

function schemaToParameter(
  name: string,
  schema: JsonSchema,
  required: boolean,
): FunctionParameterDef {
  const type = typeof schema.type === "string" && schema.type ? schema.type : "string";
  const parameter: FunctionParameterDef = {
    name,
    type,
    description: schema.description,
    required,
  };

  if (type === "object") {
    const children = schemaToParameters(schema);
    if (children.length > 0) {
      parameter.sub_parameters = children;
    }
    return parameter;
  }

  if (type === "array") {
    const items = asSchema(schema.items);
    if (items) {
      parameter.sub_parameters = [schemaToParameter(ARRAY_ITEM_NAME, items, true)];
    }
  }

  return parameter;
}

function schemaToParameters(schema: JsonSchema | null): FunctionParameterDef[] {
  const properties = schema ? asRecord(schema.properties) : null;
  if (!properties) {
    return [];
  }

  const required = new Set(Array.isArray(schema?.required) ? schema.required : []);

  return Object.entries(properties).flatMap(([name, rawChild]) => {
    const child = asSchema(rawChild);
    return child ? [schemaToParameter(name, child, required.has(name))] : [];
  });
}

function parseApiSpec(apiSpec: unknown): Record<string, unknown> | null {
  if (typeof apiSpec === "string") {
    try {
      return asRecord(JSON.parse(apiSpec));
    } catch {
      return null;
    }
  }

  return asRecord(apiSpec);
}

/**
 * 出参挂在 200 响应的 `result` 下（同级还有 stdout / stderr / metrics 这些运行时字段，
 * 它们是沙箱回包的一部分，不是用户声明的出参）。
 */
function successResultSchema(spec: Record<string, unknown>): JsonSchema | null {
  const responses = spec.responses;
  if (!Array.isArray(responses)) {
    return null;
  }

  const success = responses
    .map(asRecord)
    .find((item) => item !== null && String(item.status_code) === "200");

  const envelope = success ? jsonContentSchema(success.content) : null;
  const properties = envelope ? asRecord(envelope.properties) : null;

  return properties ? asSchema(properties.result) : null;
}

export function parseFunctionParametersFromApiSpec(apiSpec: unknown): {
  inputs?: FunctionParameterDef[];
  outputs?: FunctionParameterDef[];
} {
  const spec = parseApiSpec(apiSpec);
  if (!spec) {
    return {};
  }

  const requestBody = asRecord(spec.request_body);
  const inputs = schemaToParameters(requestBody ? jsonContentSchema(requestBody.content) : null);
  const outputs = schemaToParameters(successResultSchema(spec));

  return {
    inputs: inputs.length > 0 ? inputs : undefined,
    outputs: outputs.length > 0 ? outputs : undefined,
  };
}

/**
 * 参数 → JSON Schema，喂给 Monaco 做测试入参的补全与校验。
 * 与上面的反解正好互逆：object 展开 properties，array 展开 items。
 */
function parameterToSchema(parameter: FunctionParameterDef): JsonSchema {
  const type = parameter.type ?? "string";
  const schema: JsonSchema = { type: type === "integer" ? "integer" : type };

  if (parameter.description?.trim()) {
    schema.description = parameter.description;
  }

  if (type === "object") {
    const { properties, required } = parametersToSchemaBody(parameter.sub_parameters ?? []);
    schema.properties = properties;
    if (required.length > 0) {
      schema.required = required;
    }
    return schema;
  }

  if (type === "array") {
    const item = parameter.sub_parameters?.[0];
    schema.items = item ? parameterToSchema(item) : {};
  }

  return schema;
}

function parametersToSchemaBody(parameters: FunctionParameterDef[]) {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  parameters.forEach((parameter) => {
    const name = parameter.name?.trim();
    if (!name) {
      return;
    }

    properties[name] = parameterToSchema(parameter);
    if (parameter.required) {
      required.push(name);
    }
  });

  return { properties, required };
}

export function buildJsonSchemaFromParameters(
  parameters: FunctionParameterDef[] | undefined,
): JsonSchema | null {
  if (!parameters || parameters.length === 0) {
    return null;
  }

  const { properties, required } = parametersToSchemaBody(parameters);
  if (Object.keys(properties).length === 0) {
    return null;
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}
