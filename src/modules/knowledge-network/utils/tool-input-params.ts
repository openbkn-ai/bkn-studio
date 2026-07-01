/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type ActionTypeToolInputParam = {
  children?: ActionTypeToolInputParam[];
  description?: string;
  key: string;
  name: string;
  required?: boolean;
  source?: string;
  type: string;
};

const DEFAULT_PARAM_TYPE = "unknown";

function capitalizeSource(value?: string) {
  if (!value) {
    return "Body";
  }

  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function resolveRef(obj: unknown, apiSpec: Record<string, unknown>): Record<string, unknown> {
  if (!obj || typeof obj !== "object" || !("$ref" in obj)) {
    return (obj as Record<string, unknown>) ?? {};
  }

  const ref = (obj as { $ref?: string }).$ref;
  if (!ref) {
    return {};
  }

  const refPath = ref.split("/").slice(1);
  let current: unknown = apiSpec;

  for (const key of refPath) {
    if (!current || typeof current !== "object" || !(key in current)) {
      return {};
    }
    current = (current as Record<string, unknown>)[key];
  }

  return resolveRef(current, apiSpec);
}

function processNestedProperties(
  properties: Record<string, unknown> | undefined,
  required: string[] | undefined,
  source: string,
  apiSpec: Record<string, unknown>,
  parentKey = "",
): ActionTypeToolInputParam[] | undefined {
  if (!properties) {
    return undefined;
  }

  return Object.keys(properties)
    .sort((left, right) => left.localeCompare(right))
    .map((name) => {
      const property = properties[name];
      const resolvedProperty = resolveRef(property, apiSpec);
      const key = parentKey ? `${parentKey}.${name}` : name;

      return {
        name,
        key,
        type: typeof resolvedProperty.type === "string" ? resolvedProperty.type : DEFAULT_PARAM_TYPE,
        description:
          typeof resolvedProperty.description === "string" ? resolvedProperty.description : "",
        required: Array.isArray(required) ? required.includes(name) : false,
        source,
        children: processNestedProperties(
          resolvedProperty.properties as Record<string, unknown> | undefined,
          (resolvedProperty.required as string[] | undefined) ?? [],
          source,
          apiSpec,
          key,
        ),
      };
    });
}

export function getInputParamsFromToolOpenAPISpec(apiSpec: unknown): ActionTypeToolInputParam[] {
  if (!apiSpec || typeof apiSpec !== "object") {
    return [];
  }

  const spec = apiSpec as Record<string, unknown>;
  const inputParams: ActionTypeToolInputParam[] = [];

  const parameters = spec.parameters;
  if (Array.isArray(parameters)) {
    for (const param of parameters) {
      if (!param || typeof param !== "object") {
        continue;
      }

      const resolvedParam = resolveRef(param, spec);
      const name = typeof resolvedParam.name === "string" ? resolvedParam.name : "";
      if (!name) {
        continue;
      }

      const schema =
        resolvedParam.schema && typeof resolvedParam.schema === "object"
          ? (resolvedParam.schema as Record<string, unknown>)
          : undefined;

      inputParams.push({
        name,
        key: name,
        type: typeof schema?.type === "string" ? schema.type : DEFAULT_PARAM_TYPE,
        description:
          typeof resolvedParam.description === "string" ? resolvedParam.description : "",
        required: Boolean(resolvedParam.required),
        source: capitalizeSource(
          typeof resolvedParam.in === "string" ? resolvedParam.in : undefined,
        ),
        children: processNestedProperties(
          (resolvedParam.properties as Record<string, unknown> | undefined) ??
            (schema?.properties as Record<string, unknown> | undefined),
          (resolvedParam.required as string[] | undefined) ?? [],
          capitalizeSource(typeof resolvedParam.in === "string" ? resolvedParam.in : undefined),
          spec,
          name,
        ),
      });
    }
  }

  const requestBody = spec.request_body as
    | {
        content?: Record<string, { schema?: unknown }>;
      }
    | undefined;
  const bodySchema = requestBody?.content?.["application/json"]?.schema;
  if (bodySchema) {
    const resolvedSchema = resolveRef(bodySchema, spec);
    const bodyInputs = processNestedProperties(
      resolvedSchema.properties as Record<string, unknown> | undefined,
      (resolvedSchema.required as string[] | undefined) ?? [],
      "Body",
      spec,
    );
    if (bodyInputs?.length) {
      inputParams.push(...bodyInputs);
    }
  }

  return inputParams;
}

export function getAllExpandableParamKeys(params: ActionTypeToolInputParam[]): string[] {
  const keys: string[] = [];

  for (const item of params) {
    if (item.children?.length) {
      keys.push(item.key);
      keys.push(...getAllExpandableParamKeys(item.children));
    }
  }

  return keys;
}
