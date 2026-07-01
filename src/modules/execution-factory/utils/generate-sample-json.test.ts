/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  buildDebugPayloadSample,
  buildDefaultDebugBody,
  generateSampleFromJsonSchema,
} from "@/modules/execution-factory/utils/generate-sample-json";

describe("generate-sample-json", () => {
  it("generates object samples from JSON Schema properties", () => {
    const sample = generateSampleFromJsonSchema({
      type: "object",
      required: ["input"],
      properties: {
        input: { type: "string", example: "hello" },
        count: { type: "integer" },
      },
    });

    expect(sample).toEqual({
      input: "hello",
      count: 0,
    });
  });

  it("builds debug body from ioSpec request schema", () => {
    const body = buildDefaultDebugBody({
      ioSpec: {
        parameters: [],
        requestBodySchema: {
          type: "object",
          properties: {
            city: { type: "string", example: "北京" },
          },
        },
      },
    });

    expect(JSON.parse(body)).toEqual({ city: "北京" });
  });

  it("falls back to query parameters when request body is absent", () => {
    const sample = buildDebugPayloadSample({
      ioSpec: {
        parameters: [
          { name: "city", in: "query", type: "string" },
          { name: "extended", in: "query", type: "boolean" },
        ],
      },
    });

    expect(sample).toEqual({ city: "", extended: false });
  });

  it("builds debug body from function inputs", () => {
    const body = buildDefaultDebugBody({
      functionInput: {
        inputs: [
          { name: "x", type: "number" },
          { name: "label", type: "string" },
        ],
      },
    });

    expect(JSON.parse(body)).toEqual({ x: 0, label: "" });
  });
});
