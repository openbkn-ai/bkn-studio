/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { parseOpenApiEndpointDetail } from "@/modules/execution-factory/utils/openapi-detail";

describe("openapi-detail", () => {
  it("extracts endpoint and IO spec from a full OpenAPI document", () => {
    const detail = parseOpenApiEndpointDetail(
      JSON.stringify(
        {
          openapi: "3.0.3",
          info: { title: "加法", version: "1.0.0" },
          servers: [{ url: "http://ef-oss-mock:8080" }],
          paths: {
            "/api/v1/add": {
              post: {
                summary: "加法",
                requestBody: {
                  content: {
                    "application/json": {
                      schema: {
                        properties: {
                          a: { type: "number" },
                          b: { type: "number" },
                        },
                        type: "object",
                      },
                    },
                  },
                },
                responses: {
                  "200": {
                    description: "OK",
                    content: {
                      "application/json": {
                        schema: {
                          properties: { sum: { type: "number" } },
                          type: "object",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        null,
        2,
      ),
    );

    expect(detail?.serverUrl).toBe("http://ef-oss-mock:8080");
    expect(detail?.path).toBe("/api/v1/add");
    expect(detail?.method).toBe("POST");
    expect(detail?.ioSpec?.responses?.["200"]?.description).toBe("OK");
  });
});
