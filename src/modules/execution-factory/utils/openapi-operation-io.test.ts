/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { extractOpenApiOperationsIo } from "@/modules/execution-factory/utils/openapi-operation-io";

const specWithIo = JSON.stringify({
  openapi: "3.0.3",
  info: { title: "weather", version: "1.0.0" },
  servers: [{ url: "https://example.com" }],
  paths: {
    "/weather": {
      get: {
        summary: "查询天气",
        parameters: [
          {
            name: "city",
            in: "query",
            required: false,
            description: "城市名称",
            schema: { type: "string", example: "北京" },
          },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                example: { temp: 25 },
              },
            },
          },
        },
      },
    },
  },
});

describe("extractOpenApiOperationsIo", () => {
  it("extracts parameters and response examples from OpenAPI document", () => {
    const operations = extractOpenApiOperationsIo(specWithIo);

    expect(operations).toHaveLength(1);
    expect(operations[0]?.method).toBe("GET");
    expect(operations[0]?.path).toBe("/weather");
    expect(operations[0]?.io.parameters).toEqual([
      {
        name: "city",
        in: "query",
        required: false,
        description: "城市名称",
        type: "string",
      },
    ]);
    expect(operations[0]?.io.responses?.["200"]?.example).toEqual({ temp: 25 });
  });

  it("returns empty list for invalid spec", () => {
    expect(extractOpenApiOperationsIo("not-json")).toEqual([]);
  });
});
