/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import BigNumber from "bignumber.js";

export type DefinitionObject = Record<string, unknown>;

export const schemaMapKeywords: ReadonlySet<string> = new Set([
  "properties",
  "patternProperties",
  "$defs",
  "dependentSchemas",
]);
export const schemaSingleKeywords: ReadonlySet<string> = new Set([
  "items",
  "additionalProperties",
  "unevaluatedProperties",
  "unevaluatedItems",
  "contains",
  "not",
  "if",
  "then",
  "else",
]);
export const schemaArrayKeywords: ReadonlySet<string> = new Set([
  "allOf",
  "anyOf",
  "oneOf",
  "prefixItems",
]);

export function isDefinitionObject(value: unknown): value is DefinitionObject {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !BigNumber.isBigNumber(value)
  );
}

export function objectValue(value: unknown): DefinitionObject {
  return isDefinitionObject(value) ? value : {};
}

export function replaceMember(
  value: DefinitionObject,
  key: string,
  next: unknown,
): DefinitionObject {
  const entries = Object.entries(value);
  if (next === undefined) return Object.fromEntries(entries.filter(([name]) => name !== key));
  return Object.fromEntries(
    Object.hasOwn(value, key)
      ? entries.map(([name, entry]) => [name, name === key ? next : entry])
      : [...entries, [key, next]],
  );
}

export function renameMember(value: DefinitionObject, key: string, next: string): DefinitionObject {
  return Object.fromEntries(
    Object.entries(value).map(([name, entry]) => [name === key ? next : name, entry]),
  );
}

export function nextMemberName(value: DefinitionObject, prefix = "field"): string {
  let name = prefix;
  let number = 1;
  while (Object.hasOwn(value, name)) name = `${prefix}${number++}`;
  return name;
}

export function valueType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number" || BigNumber.isBigNumber(value)) return "number";
  if (isDefinitionObject(value)) return "object";
  return typeof value === "boolean" ? "boolean" : "string";
}

export function defaultValue(type: string): unknown {
  if (type === "object") return {};
  if (type === "array") return [];
  if (type === "number") return 0;
  if (type === "boolean") return false;
  if (type === "null") return null;
  return "";
}

const error = (name: string) => `dataConnect.apiEditor.errors.${name}`;
const methods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

function checkCondition(value: unknown): boolean {
  if (!isDefinitionObject(value)) return false;
  if (value.operation === "and" || value.operation === "or") {
    return (
      Array.isArray(value.sub_conditions) &&
      value.sub_conditions.length > 0 &&
      value.sub_conditions.every(checkCondition)
    );
  }
  if (typeof value.field !== "string" || !value.field || value.field.startsWith("$.")) return false;
  if (value.operation === "eq") {
    return (
      Object.hasOwn(value, "value") &&
      (value.value === null ||
        ["string", "number", "boolean"].includes(typeof value.value) ||
        BigNumber.isBigNumber(value.value))
    );
  }
  return (
    ["empty", "null", "not_exist"].includes(String(value.operation)) &&
    !Object.hasOwn(value, "value") &&
    !Object.hasOwn(value, "value_from")
  );
}

function checkSchema(value: unknown): boolean {
  if (typeof value === "boolean") return true;
  if (!isDefinitionObject(value)) return false;
  if (["$ref", "$dynamicRef", "$recursiveRef"].some((key) => Object.hasOwn(value, key)))
    return false;
  for (const name of schemaMapKeywords) {
    if (
      Object.hasOwn(value, name) &&
      (!isDefinitionObject(value[name]) || !Object.values(value[name]).every(checkSchema))
    )
      return false;
  }
  for (const name of schemaSingleKeywords) {
    if (Object.hasOwn(value, name) && !checkSchema(value[name])) return false;
  }
  for (const name of schemaArrayKeywords) {
    if (
      Object.hasOwn(value, name) &&
      (!Array.isArray(value[name]) || !value[name].every(checkSchema))
    )
      return false;
  }
  return true;
}

/** Check editor-visible structure only. Backend validation remains authoritative. */
export function validateApiLoginDefinition(value: unknown): string | undefined {
  if (!isDefinitionObject(value)) return error("login");
  const request = objectValue(value.request);
  if (
    !methods.has(String(request.method)) ||
    typeof request.path !== "string" ||
    !request.path ||
    /[?#\\]/.test(request.path) ||
    Array.from(request.path).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) ||
    /^(?:\/|[a-z][a-z\d+.-]*:)/i.test(request.path) ||
    (["GET", "HEAD"].includes(String(request.method)) && Object.hasOwn(request, "body"))
  )
    return error("request");
  if (
    request.headers !== undefined &&
    (!isDefinitionObject(request.headers) ||
      Object.entries(request.headers).some(
        ([name, entry]) =>
          !name || ["host", "cookie"].includes(name.toLowerCase()) || typeof entry !== "string",
      ) ||
      (isDefinitionObject(request.headers) &&
        new Set(Object.keys(request.headers).map((key) => key.toLowerCase())).size !==
          Object.keys(request.headers).length))
  )
    return error("headers");
  if (request.parameters !== undefined) {
    if (!Array.isArray(request.parameters)) return error("parameters");
    const names = new Set<string>();
    for (const parameter of request.parameters) {
      if (
        !isDefinitionObject(parameter) ||
        typeof parameter.name !== "string" ||
        !parameter.name ||
        names.has(parameter.name) ||
        (Object.hasOwn(parameter, "required") && typeof parameter.required !== "boolean") ||
        (Object.hasOwn(parameter, "default_value") && parameter.default_value === null)
      )
        return error("parameters");
      names.add(parameter.name);
    }
  }
  if (request.body !== undefined && !checkSchema(request.body)) return error("schema");
  if (
    !isDefinitionObject(value.response) ||
    Object.keys(value.response).some((key) => !["content_type", "statuses"].includes(key)) ||
    value.response.content_type !== "application/json" ||
    !isDefinitionObject(value.response.statuses) ||
    Object.keys(value.response.statuses).length === 0
  )
    return error("response");
  const responses = value.response.statuses;
  for (const [status, entry] of Object.entries(responses)) {
    if (!/^(?:[1-5]\d\d|[1-5]XX|default)$/.test(status) || !isDefinitionObject(entry))
      return error("response");
    if (typeof entry.description !== "string" || !entry.description.trim())
      return error("response");
    if (Object.hasOwn(entry, "content") || Object.hasOwn(entry, "content_type"))
      return error("response");
    if (!Object.hasOwn(entry, "schema") || !checkSchema(entry.schema)) return error("schema");
  }
  const success = objectValue(value.success_rule);
  if (
    !Array.isArray(success.http_status) ||
    !success.http_status.length ||
    success.http_status.some(
      (status) =>
        (typeof status !== "number" && !BigNumber.isBigNumber(status)) ||
        !/^[1-5]\d\d$/.test(String(status)),
    ) ||
    new Set(success.http_status.map(String)).size !== success.http_status.length
  )
    return error("status");
  if (
    success.http_status.some(
      (status) =>
        !Object.hasOwn(responses, String(status)) &&
        !Object.hasOwn(responses, `${String(status)[0]}XX`) &&
        !Object.hasOwn(responses, "default"),
    )
  )
    return error("response");
  if (
    Object.hasOwn(success, "body_filter_condition") &&
    !checkCondition(success.body_filter_condition)
  )
    return error("condition");
  return undefined;
}
