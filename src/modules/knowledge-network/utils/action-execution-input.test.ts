/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { describe, expect, it } from "vitest";
import { transformPrecisionSafeJSONRequest } from "@/framework/request/precision-safe-json";
import { parseActionExecutionInput, type ActionExecutionSchema } from "./action-execution-input";

describe("action execution inputs", () => {
  const schema: ActionExecutionSchema = {
    type: "object",
    properties: {
      relation_target: {
        type: "object",
        properties: {
          source_identity: { type: "object", properties: { id: { type: "integer" } } },
          target_identity: { type: "object", properties: { code: { type: "string" } } },
        },
      },
      dynamic_params: {
        type: "object",
        properties: {
          body: {
            type: "object",
            properties: { notify: { type: "boolean" }, values: { type: "array" } },
          },
        },
      },
    },
  };
  it("preserves exact numeric identities, false, and nested dynamic values", () => {
    const input = parseActionExecutionInput(schema, {
      relation_target: {
        source_identity: { id: "9223372036854775807" },
        target_identity: { code: "0001" },
      },
      dynamic_params: { body: { notify: false, values: "[1, 2]", ignored: "not configured" } },
      ignored: "not in schema",
    });
    expect(transformPrecisionSafeJSONRequest(input)).toBe(
      '{"relation_target":{"source_identity":{"id":9223372036854775807},"target_identity":{"code":"0001"}},"dynamic_params":{"body":{"notify":false,"values":[1,2]}}}',
    );
  });
  it("supports explicit multiple identities and rejects invalid numeric/JSON inputs", () => {
    const list: ActionExecutionSchema = {
      type: "array",
      items: { type: "object", properties: { id: { type: "string" } } },
    };
    expect(parseActionExecutionInput(list, [{ id: "A" }, { id: "B" }])).toEqual([
      { id: "A" },
      { id: "B" },
    ]);
    expect(() => parseActionExecutionInput({ type: "integer" }, "1.5")).toThrow();
    expect(() => parseActionExecutionInput({ type: "number" }, "true")).toThrow();
    expect(() => parseActionExecutionInput({ type: "array" }, "{}")).toThrow();
    expect(parseActionExecutionInput({ type: "integer" }, "0")).toBe(0);
  });
});
