/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { exampleBodyFromSchema, synthesizeOp } from "./context-loader.service";

/** Shaped like what Context Loader actually serves: bkn_context is a required object. */
const searchInstanceSchema = {
  type: "object",
  properties: {
    kn_id: { type: "string" },
    query: { type: "string" },
    limit: { type: "integer", default: 10 },
    response_format: { type: "string", enum: ["toon", "json"] },
    bkn_context: {
      type: "object",
      properties: { conversation_id: { type: "string" }, interaction_id: { type: "string" } },
      required: ["conversation_id", "interaction_id"],
    },
  },
  required: ["kn_id", "query", "bkn_context"],
};

describe("exampleBodyFromSchema", () => {
  /**
   * The console injects the live context at send time. Emitting the key here put
   * an empty object in the body, which both misled the reader into filling it in
   * and counted as a caller override that suppressed the real injection.
   */
  it("omits bkn_context even though the schema marks it required", () => {
    const body = exampleBodyFromSchema(searchInstanceSchema);

    expect(body).not.toHaveProperty("bkn_context");
    expect(body).toEqual({ kn_id: "", query: "", response_format: "toon" });
  });

  it("keeps required fields, kn_id and response_format, and skips optional ones", () => {
    const body = exampleBodyFromSchema(searchInstanceSchema);

    expect(Object.keys(body).sort()).toEqual(["kn_id", "query", "response_format"]);
  });
});

describe("synthesizeOp", () => {
  it("builds a REST path and MCP arguments with no bkn_context in either", () => {
    const op = synthesizeOp({ name: "search_instance", inputSchema: searchInstanceSchema });

    expect(op.id).toBe("search_instance");
    expect(op.path).toContain("/kn/search_instance");
    expect(op.body).not.toHaveProperty("bkn_context");
    expect(op.mcpArgs).not.toHaveProperty("bkn_context");
  });
});
