/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n from "i18next";
import "./locales";

import BigNumber from "bignumber.js";
import {
  parsePrecisionPreservingJSON,
  transformPrecisionSafeJSONRequest,
} from "@/framework/request/precision-safe-json";
import type { EvalCaseDefinition } from "./m0-run.service";
import type { CaseSchema } from "./case-form.service";

const caseText = (key: string, values?: Record<string, unknown>): string =>
  i18n.t(`knowledgeNetwork.eval.foundation.caseModel.${key}`, {
    ...values,
    interpolation: { escapeValue: false },
  });

export type CaseCriterion = {
  id: string;
  type: string;
  path: string;
  value: string;
  valueType: "string" | "number" | "boolean" | "json";
  expectedPath?: string;
  valueProvided?: boolean;
};
export const outputTypes = [
  "equals",
  "exists",
  "json_schema",
  "numeric_range",
  "approx",
  "contains",
  "regex",
  "observation_only",
];
export const newCriterion = (): CaseCriterion => ({
  id: crypto.randomUUID(),
  type: "equals",
  path: "$",
  value: "",
  valueType: "string",
});
export function resourceCheckPurpose(
  criteria: CaseCriterion[],
): "availability" | "business" | "observe" {
  if (criteria.length && criteria.every((c) => c.type === "observation_only")) return "observe";
  if (criteria.length === 1 && criteria[0].type === "json_schema" && criteria[0].path === "$") {
    try {
      const schema: unknown = JSON.parse(criteria[0].value);
      const expected = {
        type: "object",
        required: ["available"],
        properties: { available: { const: true } },
      };
      const canonical = (v: unknown): unknown =>
        v && typeof v === "object" && !Array.isArray(v)
          ? Object.fromEntries(
              Object.entries(v)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, x]) => [k, canonical(x)]),
            )
          : Array.isArray(v)
            ? v.map(canonical)
            : v;
      if (JSON.stringify(canonical(schema)) === JSON.stringify(canonical(expected)))
        return "availability";
    } catch {
      /* Preserve custom or incomplete schemas as business criteria. */
    }
  }
  return "business";
}
export function readCriteria(definition: EvalCaseDefinition): CaseCriterion[] | undefined {
  if (
    definition.assertions.filter((a) => outputTypes.includes(String(a.type))).length > 20 ||
    definition.assertions.some(
      (a) =>
        a.required === false ||
        (outputTypes.includes(String(a.type)) &&
          (a.source !== "normalized_output" || (a.type === "equals" && a.on_missing !== "fail"))) ||
        (!outputTypes.includes(String(a.type)) &&
          !["resource_used", "evidence_complete"].includes(String(a.type))),
    )
  )
    return undefined;
  const get = (path: string): unknown =>
    path === "$"
      ? definition.expected_spec
      : path
          .slice(2)
          .split(".")
          .reduce<unknown>(
            (v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined),
            definition.expected_spec,
          );
  return definition.assertions
    .filter((a) => outputTypes.includes(String(a.type)))
    .map((a) => {
      const type = String(a.type),
        path = typeof a.path === "string" ? a.path : "$";
      const expected =
        type === "json_schema"
          ? a.schema
          : get(typeof a.expected_path === "string" ? a.expected_path : path);
      const valueType =
        expected === undefined &&
        ["string", "number", "boolean", "json"].includes(String(a.value_type))
          ? (a.value_type as CaseCriterion["valueType"])
          : type === "json_schema" || ["numeric_range", "approx"].includes(type)
            ? "json"
            : typeof expected === "number" || BigNumber.isBigNumber(expected)
              ? "number"
              : typeof expected === "boolean"
                ? "boolean"
                : expected === null || (expected && typeof expected === "object")
                  ? "json"
                  : "string";
      return {
        id: String(a.id),
        type,
        path,
        valueType,
        value:
          expected === undefined
            ? ""
            : valueType === "string"
              ? typeof expected === "string"
                ? expected
                : transformPrecisionSafeJSONRequest(expected)
              : transformPrecisionSafeJSONRequest(expected),
        expectedPath: a.expected_path as string | undefined,
        valueProvided: expected !== undefined,
      };
    });
}
// Matches the execution engine's bounded field/index subset, without expressions.
export function isCaseResultPath(path: string) {
  return (
    path.length <= 256 &&
    /^\$(?:\.[^.[\]*]+|\[(?:0|[1-9][0-9]{0,3})\])*$/.test(path) &&
    (path.match(/\.[^.[\]*]+|\[[0-9]+\]/g)?.length ?? 0) <= 32
  );
}
export function compileCriteria(criteria: CaseCriterion[], allowIncomplete = false) {
  if (criteria.length === 0 || criteria.length > 20) throw Error(caseText("criteriaCount"));
  const expected: Record<string, unknown> = {};
  const assertions = criteria.map((c, index) => {
    try {
      if (!c.path || !isCaseResultPath(c.path)) throw Error(caseText("resultField"));
      const a: Record<string, unknown> = {
        id: c.id,
        type: c.type,
        source: "normalized_output",
        path: c.path,
        value_type: c.valueType,
        required: true,
        on_missing: "fail",
      };
      if (["exists", "observation_only"].includes(c.type)) return a;
      if (c.value === "" && !(c.type === "equals" && c.valueType === "string" && c.valueProvided)) {
        if (allowIncomplete) {
          a.expected_path = `$.criteria.value_${index}`;
          return a;
        }
        throw Error(caseText("expectedRequired"));
      }
      let value: unknown = c.value;
      if (c.valueType !== "string" || ["json_schema", "numeric_range", "approx"].includes(c.type))
        value = parsePrecisionPreservingJSON(c.value);
      if (
        (c.valueType === "number" && typeof value !== "number" && !BigNumber.isBigNumber(value)) ||
        (c.valueType === "boolean" && typeof value !== "boolean")
      )
        throw Error(caseText("expectedType"));
      if (["numeric_range", "approx"].includes(c.type)) {
        if (!value || typeof value !== "object" || Array.isArray(value))
          throw Error(caseText("numericCondition"));
        const config = value as Record<string, unknown>;
        const number = (v: unknown) => typeof v === "number" || BigNumber.isBigNumber(v);
        if (c.type === "numeric_range") {
          if (!number(config.min) && !number(config.max)) throw Error(caseText("rangeBoundary"));
          if (
            (config.min !== undefined && !number(config.min)) ||
            (config.max !== undefined && !number(config.max))
          )
            throw Error(caseText("numericBoundary"));
          if (
            number(config.min) &&
            number(config.max) &&
            new BigNumber(String(config.min)).gt(String(config.max))
          )
            throw Error(caseText("rangeReversed"));
        } else {
          if (!number(config.value)) throw Error(caseText("referenceNumber"));
          if (!number(config.absolute_tolerance) && !number(config.relative_tolerance))
            throw Error(caseText("toleranceRequired"));
          for (const key of ["absolute_tolerance", "relative_tolerance"]) {
            const v = config[key];
            if (v !== undefined && (!number(v) || new BigNumber(String(v)).isNegative()))
              throw Error(caseText("nonnegativeTolerance"));
          }
        }
      }
      if (c.type === "json_schema") {
        if (c.path !== "$") throw Error(caseText("wholeResultSchema"));
        a.schema = value;
      } else {
        const key = `value_${index}`;
        expected[key] = value;
        a.expected_path = `$.criteria.${key}`;
      }
      return a;
    } catch (error) {
      throw new Error(
        caseText("criterionError", {
          index: index + 1,
          message: error instanceof Error ? error.message : caseText("checkConfiguration"),
        }),
      );
    }
  });
  return { assertions, expected_spec: { criteria: expected } };
}
export function simpleInputFields(
  schema?: CaseSchema,
): Array<{ name: string; schema: CaseSchema; required: boolean }> | undefined {
  if (
    !schema ||
    schema.type !== "object" ||
    !schema.properties ||
    schema.$ref ||
    schema.oneOf ||
    schema.anyOf ||
    schema.allOf
  )
    return undefined;
  const properties = schema.properties as Record<string, unknown>;
  const fields = Object.entries(properties).map(([name, value]) => ({
    name,
    schema: value as CaseSchema,
    required: Array.isArray(schema.required) && schema.required.includes(name),
  }));
  return fields.every(
    (f) =>
      f.schema &&
      ["string", "number", "integer", "boolean", "object", "array"].includes(
        String(f.schema.type),
      ) &&
      !f.schema.$ref &&
      !f.schema.oneOf &&
      !f.schema.anyOf &&
      !f.schema.allOf,
  )
    ? fields
    : undefined;
}

export function validateCaseArguments(value: string, schema?: CaseSchema, requireRequired = true) {
  const data: unknown = parsePrecisionPreservingJSON(value);
  if (!data || typeof data !== "object" || Array.isArray(data) || BigNumber.isBigNumber(data))
    throw Error(caseText("jsonObject"));
  validateArgumentSchema(data, schema, requireRequired);
  return data as Record<string, unknown>;
}

function validateArgumentSchema(
  value: unknown,
  schema?: CaseSchema,
  required = true,
  path = caseText("argumentPath"),
  depth = 0,
): void {
  if (!schema) return;
  if (
    Object.hasOwn(schema, "const") &&
    transformPrecisionSafeJSONRequest(schema.const) !== transformPrecisionSafeJSONRequest(value)
  )
    throw Error(caseText("constant", { path }));
  if (depth > 24) throw Error(caseText("nestingDepth"));
  const fail = (key: string, values?: Record<string, unknown>): never => {
    throw Error(caseText(key, { path, ...values }));
  };
  const isObject =
    !!value && typeof value === "object" && !Array.isArray(value) && !BigNumber.isBigNumber(value);
  if (schema.type === "object") {
    if (!isObject) fail("object");
    const object = value as Record<string, unknown>,
      props = (schema.properties ?? {}) as Record<string, CaseSchema>;
    if (required && Array.isArray(schema.required))
      for (const key of schema.required)
        if (typeof key === "string" && object[key] === undefined)
          throw Error(caseText("requiredField", { path, field: key }));
    for (const [key, item] of Object.entries(object)) {
      if (schema.additionalProperties === false && !Object.hasOwn(props, key))
        fail("unknownField", { field: key });
      validateArgumentSchema(
        item,
        props[key] ??
          (typeof schema.additionalProperties === "object"
            ? (schema.additionalProperties as CaseSchema)
            : undefined),
        required,
        `${path}.${key}`,
        depth + 1,
      );
    }
  }
  if (schema.type === "array") {
    if (!Array.isArray(value)) fail("array");
    const items = value as unknown[];
    if (typeof schema.minItems === "number" && items.length < schema.minItems)
      fail("minItems", { count: schema.minItems });
    if (typeof schema.maxItems === "number" && items.length > schema.maxItems)
      fail("maxItems", { count: schema.maxItems });
    items.forEach((item, index) =>
      validateArgumentSchema(
        item,
        schema.items as CaseSchema | undefined,
        required,
        `${path}[${index}]`,
        depth + 1,
      ),
    );
  }
  if (schema.type === "string") {
    if (typeof value !== "string") fail("text");
    const length = typeof value === "string" ? Array.from(value).length : 0;
    if (typeof schema.minLength === "number" && length < schema.minLength)
      fail("minLength", { count: schema.minLength });
    if (typeof schema.maxLength === "number" && length > schema.maxLength)
      fail("maxLength", { count: schema.maxLength });
  }
  if (schema.type === "boolean" && typeof value !== "boolean") fail("boolean");
  if (["integer", "number"].includes(String(schema.type))) {
    if (typeof value !== "number" && !BigNumber.isBigNumber(value)) fail("number");
    const n = new BigNumber(value as number);
    if (!n.isFinite()) fail("finite");
    if (schema.type === "integer" && !n.isInteger()) fail("integer");
    for (const [key, comparison] of [
      ["minimum", "lt"],
      ["maximum", "gt"],
      ["exclusiveMinimum", "lte"],
      ["exclusiveMaximum", "gte"],
    ] as const) {
      const bound = schema[key];
      if (typeof bound === "number" && n[comparison](bound))
        fail("bound", { bound: key, value: bound });
    }
  }
  if (
    Array.isArray(schema.enum) &&
    !schema.enum.some(
      (v) => transformPrecisionSafeJSONRequest(v) === transformPrecisionSafeJSONRequest(value),
    )
  )
    fail("enum");
}

// Trial data contributes field names/types only, never expected values or examples.
// A declared field remains available even when absent from this particular output.
export function augmentCaseOutputSchema(
  declared: CaseSchema | undefined,
  actual: unknown,
  depth = 0,
): CaseSchema {
  const base = { ...declared };
  if (depth > 6 || actual === null || actual === undefined) return base;
  const inferredType = BigNumber.isBigNumber(actual)
    ? "number"
    : Array.isArray(actual)
      ? "array"
      : typeof actual;
  if (!base.type && ["string", "number", "boolean", "object", "array"].includes(inferredType))
    base.type = inferredType;
  if (inferredType === "object" && !BigNumber.isBigNumber(actual)) {
    const properties = { ...((base.properties ?? {}) as Record<string, CaseSchema>) };
    for (const [key, value] of Object.entries(actual as Record<string, unknown>).slice(0, 64)) {
      if (/[.[\]*]/.test(key) || ["__proto__", "constructor", "prototype"].includes(key)) continue;
      properties[key] = augmentCaseOutputSchema(properties[key], value, depth + 1);
    }
    base.properties = properties;
  }
  if (Array.isArray(actual)) {
    // Bounded observed positions, not inferred expected values or array ordering.
    base["x-eval-items"] = actual
      .slice(0, 10)
      .map((value) =>
        augmentCaseOutputSchema(base.items as CaseSchema | undefined, value, depth + 1),
      );
  }
  return base;
}
