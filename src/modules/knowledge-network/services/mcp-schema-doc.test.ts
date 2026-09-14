/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { businessRequestExample, schemaDocumentation, schemaFields, splitInputSchemaFields } from "./mcp-schema-doc";

const searchSchemaInput = {
  type: "object",
  properties: {
    kn_id: { type: "string", description: "Knowledge network ID" },
    query: { type: "string", description: "Search terms" },
    schema_brief: { type: "boolean", default: true },
    search_scope: {
      type: "object",
      properties: { concept_groups: { type: "array", items: { type: "string" } } },
    },
    bkn_context: {
      type: "object",
      description: "Managed lifecycle context",
      properties: { conversation_id: { type: "string" }, interaction_id: { type: "string" } },
      required: ["conversation_id", "interaction_id"],
    },
  },
  required: ["kn_id", "query", "bkn_context"],
};

describe("MCP schema documentation", () => {
  it("keeps business parameters ahead of the injected Trace context", () => {
    const { businessFields, traceFields } = splitInputSchemaFields(searchSchemaInput);

    expect(businessFields.map((field) => field.path)).toEqual(["kn_id", "query", "schema_brief", "search_scope", "search_scope.concept_groups"]);
    expect(traceFields.map((field) => field.path)).toEqual(["bkn_context", "bkn_context.conversation_id", "bkn_context.interaction_id"]);
    expect(businessFields.find((field) => field.path === "kn_id")).toMatchObject({ required: true, type: "string" });
    expect(traceFields.find((field) => field.path === "bkn_context")).toMatchObject({ required: true, description: "Managed lifecycle context" });
  });

  it("keeps useful output paths when array items contain documented fields", () => {
    const fields = schemaFields({
      type: "object",
      properties: {
        object_types: {
          type: "array",
          items: {
            type: "object",
            properties: { concept_id: { type: "string" }, data_source: { type: "object", additionalProperties: true } },
          },
        },
      },
    });

    expect(fields.map((field) => field.path)).toEqual(["object_types", "object_types[].concept_id", "object_types[].data_source"]);
    expect(fields.find((field) => field.path === "object_types[].data_source")?.allowsAdditionalProperties).toBe(true);
  });

  it("does not present bkn_context as a user-supplied request value", () => {
    expect(businessRequestExample('{"kn_id":"kn_demo","query":"orders","bkn_context":{"conversation_id":"c_1"}}')).toBe(
      '{\n  "kn_id": "kn_demo",\n  "query": "orders"\n}',
    );
  });

  it("does not fabricate an empty request example when the editor contains invalid JSON", () => {
    expect(businessRequestExample('{"kn_id":')).toBeNull();
    expect(businessRequestExample("[]")).toBeNull();
  });

  it("reports when deeply nested fields are omitted from the guided view", () => {
    const documentation = schemaDocumentation({
      type: "object",
      properties: {
        level_0: {
          type: "object",
          properties: {
            level_1: {
              type: "object",
              properties: {
                level_2: {
                  type: "object",
                  properties: {
                    level_3: {
                      type: "object",
                      properties: { level_4: { type: "string" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    expect(documentation.fields.map((field) => field.path)).toEqual(["level_0", "level_0.level_1", "level_0.level_1.level_2", "level_0.level_1.level_2.level_3"]);
    expect(documentation.truncated).toBe(true);
  });
});
