/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";
import {
  parsePrecisionPreservingJSON,
  transformPrecisionSafeJSONRequest,
} from "@/framework/request/precision-safe-json";
import { createApiLoginDefinition } from "./index";
import { objectValue, renameMember, replaceMember, validateApiLoginDefinition } from "./model";

function login() {
  const value = createApiLoginDefinition();
  objectValue(value.request).path = "auth/login";
  objectValue(objectValue(objectValue(value.response).statuses)["200"]).description =
    "Login response";
  return value;
}

describe("API login definition structure", () => {
  it("creates one JSON media type for all response statuses", () => {
    expect(createApiLoginDefinition().response).toEqual({
      content_type: "application/json",
      statuses: { "200": { description: "", schema: { type: "object", properties: {} } } },
    });
  });

  it("allows ordinary Schema business properties named after response fields", () => {
    const value = login();
    objectValue(objectValue(objectValue(value.response).statuses)["200"]).schema = {
      type: "object",
      properties: {
        content: { type: "string" },
        schema: { type: "object" },
        content_type: { const: { content: null } },
      },
    };
    expect(validateApiLoginDefinition(value)).toBeUndefined();
  });

  it.each([{}, { type: "object", properties: { code: { type: "integer" } } }, true, false])(
    "accepts a status response with Schema %j",
    (schema) => {
      const value = login();
      value.response = {
        content_type: "application/json",
        statuses: { "200": { description: "Login response", schema } },
      };
      expect(validateApiLoginDefinition(value)).toBeUndefined();
    },
  );

  it.each([
    {},
    { statuses: { "200": { description: "Success", schema: {} } } },
    { content_type: "text/plain", statuses: { "200": { description: "Success", schema: {} } } },
    { content_type: null, statuses: { "200": { description: "Success", schema: {} } } },
    { content_type: "application/json" },
    { content_type: "application/json", statuses: {} },
    { content_type: "application/json", statuses: null },
    { "200": { description: "Success", content_type: "application/json", schema: {} } },
    {
      content_type: "application/json",
      statuses: { "200": { description: "Success", schema: {} } },
      headers: {},
    },
  ])("rejects incomplete, unsupported or legacy response groups %j", (response) => {
    const value = login();
    value.response = response;
    expect(validateApiLoginDefinition(value)).toBeDefined();
  });

  it.each([
    {},
    { schema: null },
    { schema: { $ref: "#node" } },
    { schema: {}, content: null },
    { schema: {}, content_type: "application/json" },
    { schema: {}, content_type: null },
    { content: { "application/json": { schema: {} } } },
  ])("rejects incomplete, unsupported or legacy status responses %j", (entry) => {
    const value = login();
    value.response = {
      content_type: "application/json",
      statuses: { "200": { description: "Login response", ...entry } },
    };
    expect(validateApiLoginDefinition(value)).toBeDefined();
  });

  it("accepts exact, grouped and default response status contracts", () => {
    for (const status of ["200", "2XX", "default"]) {
      const value = login();
      const response = objectValue(value.response);
      response.statuses = { [status]: objectValue(response.statuses)["200"] };
      expect(validateApiLoginDefinition(value)).toBeUndefined();
    }
  });

  it("requires response coverage and unique numeric success statuses", () => {
    const value = login();
    objectValue(value.success_rule).http_status = [201];
    expect(validateApiLoginDefinition(value)).toBe("dataConnect.apiEditor.errors.response");
    objectValue(value.success_rule).http_status = [200, 200];
    expect(validateApiLoginDefinition(value)).toBe("dataConnect.apiEditor.errors.status");
    objectValue(value.success_rule).http_status = ["200"];
    expect(validateApiLoginDefinition(value)).toBe("dataConnect.apiEditor.errors.status");
  });

  it("preserves absent values separately from null, false and exact numbers", () => {
    const precise = parsePrecisionPreservingJSON("9007199254740993");
    const source = {
      value: precise,
      default_value: false,
      required: false,
      metadata: { nullable: null },
    };
    const changed = replaceMember(source, "required", undefined);
    expect(Object.hasOwn(changed, "required")).toBe(false);
    expect(changed.default_value).toBe(false);
    expect(changed.value).toBe(precise);
    const renamed = renameMember(changed, "metadata", "schema_metadata");
    expect(transformPrecisionSafeJSONRequest(renamed)).toContain('"value":9007199254740993');
    expect(objectValue(renamed.schema_metadata).nullable).toBeNull();
    expect(source.required).toBe(false);
  });

  it("accepts final Query presence semantics without inventing values", () => {
    const value = login();
    objectValue(value.request).parameters = [
      { name: "optional" },
      { name: "flag", default_value: false },
      { name: "zero", value: 0 },
    ];
    expect(validateApiLoginDefinition(value)).toBeUndefined();
    objectValue(value.request).parameters = [{ name: "invalid", default_value: null }];
    expect(validateApiLoginDefinition(value)).toBe("dataConnect.apiEditor.errors.parameters");
  });

  it("rejects Schema references but treats const data as ordinary business content", () => {
    const value = login();
    objectValue(value.request).body = { type: "object", const: { $ref: "ordinary-business-data" } };
    expect(validateApiLoginDefinition(value)).toBeUndefined();
    objectValue(value.request).body = {
      type: "object",
      properties: { nested: { $dynamicRef: "#node" } },
    };
    expect(validateApiLoginDefinition(value)).toBe("dataConnect.apiEditor.errors.schema");
  });

  it("preserves explicit eq null and forbids unary comparison values", () => {
    const value = login();
    objectValue(value.success_rule).body_filter_condition = {
      field: "result",
      operation: "eq",
      value: null,
    };
    expect(validateApiLoginDefinition(value)).toBeUndefined();
    objectValue(value.success_rule).body_filter_condition = {
      field: "result",
      operation: "null",
      value: null,
    };
    expect(validateApiLoginDefinition(value)).toBe("dataConnect.apiEditor.errors.condition");
    objectValue(value.success_rule).body_filter_condition = {
      operation: "and",
      sub_conditions: [],
    };
    expect(validateApiLoginDefinition(value)).toBe("dataConnect.apiEditor.errors.condition");
  });

  it("rejects absolute/query paths, GET bodies and protected or duplicate Headers", () => {
    for (const path of [
      "/login",
      "https://upstream.example.com/login",
      "login?token=value",
      "login#fragment",
      "login\\next",
    ]) {
      const value = login();
      objectValue(value.request).path = path;
      expect(validateApiLoginDefinition(value)).toBe("dataConnect.apiEditor.errors.request");
    }
    const value = login();
    objectValue(value.request).method = "GET";
    objectValue(value.request).body = {};
    expect(validateApiLoginDefinition(value)).toBe("dataConnect.apiEditor.errors.request");
    delete objectValue(value.request).body;
    for (const headers of [
      { Cookie: "literal" },
      { Host: "destination" },
      { Accept: "a", accept: "b" },
    ]) {
      objectValue(value.request).headers = headers;
      expect(validateApiLoginDefinition(value)).toBe("dataConnect.apiEditor.errors.headers");
    }
  });
  it("keeps existing property order when replacing a value", () => {
    expect(Object.keys(replaceMember({ first: 1, second: false }, "first", 2))).toEqual([
      "first",
      "second",
    ]);
  });
});
