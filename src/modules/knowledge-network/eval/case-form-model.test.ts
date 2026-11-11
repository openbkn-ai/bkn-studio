/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n from "i18next";
import { evalLocales } from "./locales";

import { beforeEach, expect, it } from "vitest";
import {
  augmentCaseOutputSchema,
  compileCriteria,
  readCriteria,
  validateCaseArguments,
  resourceCheckPurpose,
} from "./case-form-model";
import { transformPrecisionSafeJSONRequest } from "@/framework/request/precision-safe-json";
import type { EvalCaseDefinition } from "./m0-run.service";

beforeEach(async () => {
  await i18n.init({
    lng: "zh-CN",
    resources: evalLocales,
    showSupportNotice: false,
    interpolation: { escapeValue: false },
  });
});

it("keeps output and expectation paths separate and preserves false and precise numeric values", () => {
  const compiled = compileCriteria([
    { id: "zero", type: "equals", path: "$.count", value: "9007199254740993", valueType: "number" },
    { id: "false", type: "equals", path: "$.enabled", value: "false", valueType: "boolean" },
  ]);
  expect(compiled.assertions[0]).toMatchObject({
    path: "$.count",
    expected_path: "$.criteria.value_0",
  });
  expect(transformPrecisionSafeJSONRequest(compiled.expected_spec)).toContain(
    '"value_0":9007199254740993',
  );
  expect(compiled.expected_spec.criteria.value_1).toBe(false);
  const read = readCriteria({ ...compiled } as unknown as EvalCaseDefinition)!;
  expect(read[0].value).toBe("9007199254740993");
  expect(compileCriteria(read).assertions).toEqual(compiled.assertions);
});
it("saves incomplete reference drafts without inventing an expected answer", () => {
  const criterion = {
    id: "pending",
    type: "equals",
    path: "$",
    value: "",
    valueType: "number" as const,
  };
  expect(() => compileCriteria([criterion])).toThrow();
  const draft = compileCriteria([criterion], true);
  expect(draft.expected_spec).toEqual({ criteria: {} });
  expect(draft.assertions[0]).toHaveProperty("expected_path");
});
it("does not ask existence and observation criteria for a gold answer", () => {
  const compiled = compileCriteria([
    { id: "exists", type: "exists", path: "$.count", value: "", valueType: "string" },
    { id: "observe", type: "observation_only", path: "$", value: "", valueType: "string" },
  ]);
  expect(compiled.expected_spec).toEqual({ criteria: {} });
  expect(compiled.assertions.every((a) => !a.expected_path)).toBe(true);
});
it("validates required typed inputs without treating zero or false as missing", () => {
  const schema = {
    type: "object",
    properties: { count: { type: "integer" }, enabled: { type: "boolean" } },
    required: ["count", "enabled"],
  };
  expect(validateCaseArguments('{"count":0,"enabled":false}', schema)).toEqual({
    count: 0,
    enabled: false,
  });
  expect(() => validateCaseArguments('{"count":0}', schema)).toThrow("enabled");
  expect(() => validateCaseArguments('{"count":"0","enabled":false}', schema)).toThrow("类型");
  expect(() => validateCaseArguments('{"count":0.5,"enabled":false}', schema)).toThrow("整数");
});

it("validates grouped HTTP and nested MCP arguments with exact numeric bounds", () => {
  const schema = {
    type: "object",
    properties: {
      path: {
        type: "object",
        properties: { id: { type: "integer" } },
        required: ["id"],
        additionalProperties: false,
      },
      query: {
        type: "object",
        properties: { count: { type: "integer", minimum: 1, maximum: 50 } },
        additionalProperties: false,
      },
    },
    required: ["path"],
    additionalProperties: false,
  };
  expect(() =>
    validateCaseArguments('{"path":{"id":9007199254740993},"query":{"count":2}}', schema),
  ).not.toThrow();
  for (const value of [
    "{}",
    '{"path":{"id":"1"}}',
    '{"path":{"id":1},"query":{"count":51}}',
    '{"path":{"id":1},"query":{"extra":true}}',
  ])
    expect(() => validateCaseArguments(value, schema)).toThrow();
});

it("rejects missing array items and the wrong nested item type", () => {
  const schema = {
    type: "object",
    properties: {
      items: {
        type: "array",
        minItems: 1,
        maxItems: 2,
        items: {
          type: "object",
          properties: { enabled: { type: "boolean" } },
          required: ["enabled"],
        },
      },
    },
    required: ["items"],
  };
  expect(() => validateCaseArguments('{"items":[{"enabled":false}]}', schema)).not.toThrow();
  for (const raw of ['{"items":[]}', '{"items":[{}]}', '{"items":[{"enabled":"false"}]}'])
    expect(() => validateCaseArguments(raw, schema)).toThrow();
});
it("preserves legacy definitions the editor cannot safely express", () => {
  expect(
    readCriteria({
      assertions: [{ id: "legacy", type: "custom-judge" }],
    } as unknown as EvalCaseDefinition),
  ).toBeUndefined();
  expect(
    readCriteria({
      assertions: [{ id: "optional", type: "equals", required: false }],
    } as unknown as EvalCaseDefinition),
  ).toBeUndefined();
});

it("does not label custom business schemas as availability just because they mention available", () => {
  const c = {
    id: "c",
    type: "json_schema",
    path: "$",
    valueType: "json" as const,
    value: JSON.stringify({
      type: "object",
      required: ["available"],
      properties: { available: { const: true }, result: { type: "object", required: ["profit"] } },
    }),
  };
  expect(resourceCheckPurpose([c])).toBe("business");
  c.value = JSON.stringify({
    properties: { available: { const: true } },
    required: ["available"],
    type: "object",
  });
  expect(resourceCheckPurpose([c])).toBe("availability");
  expect(
    resourceCheckPurpose([{ ...c, type: "observation_only", path: "$.result", value: "" }]),
  ).toBe("observe");
  expect(resourceCheckPurpose([])).toBe("business");
});

it("identifies which criterion needs a correct value", () => {
  expect(() =>
    compileCriteria([
      { id: "one", type: "exists", path: "$.id", value: "", valueType: "string" },
      { id: "two", type: "equals", path: "$.count", value: "", valueType: "number" },
    ]),
  ).toThrow("第 2 条判定标准：请填写预期值或通过条件");
});

it("uses trial output only to discover fields, without copying values into the schema", () => {
  const schema = augmentCaseOutputSchema(
    { type: "object", properties: { optional: { type: "string" } } },
    { result: { count: 0, enabled: false, text: "private actual value" } },
  );
  expect(schema).toMatchObject({
    properties: {
      optional: { type: "string" },
      result: {
        properties: {
          count: { type: "number" },
          enabled: { type: "boolean" },
          text: { type: "string" },
        },
      },
    },
  });
  expect(JSON.stringify(schema)).not.toContain("private actual value");
  expect(JSON.stringify(schema)).not.toContain('"default"');
});

it("discovers bounded array item fields and accepts explicit result positions without copying answers", () => {
  const schema = augmentCaseOutputSchema(undefined, {
    result: { entries: [{ value: 12, secret: "independent-answer" }] },
  });
  expect(schema).toMatchObject({
    properties: {
      result: {
        properties: {
          entries: {
            "x-eval-items": [
              { properties: { value: { type: "number" }, secret: { type: "string" } } },
            ],
          },
        },
      },
    },
  });
  expect(JSON.stringify(schema)).not.toContain("independent-answer");
  expect(
    compileCriteria([
      {
        id: "count",
        type: "equals",
        path: "$.result.entries[0].value",
        value: "12",
        valueType: "number",
      },
    ]).assertions[0].path,
  ).toBe("$.result.entries[0].value");
  for (const path of ["$.entries[*]", "$.missing[01]", "$.missing[-1]", "$.missing[10000]"])
    expect(() =>
      compileCriteria([{ id: "invalid", type: "exists", path, value: "", valueType: "string" }]),
    ).toThrow();
});
