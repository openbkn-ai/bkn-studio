/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  createTool,
  getToolDetail,
  importOpenApiTools,
  listTools,
} from "@/modules/execution-factory/services/tool.service";

describe("tool.service mock persistence", () => {
  it("keeps created HTTP tool metadata available when reopened for editing", async () => {
    const boxId = `box-${Date.now()}`;
    const openapiSpec = JSON.stringify({
      openapi: "3.0.3",
      info: { title: "HTTPBin Get", version: "1.0.0" },
      servers: [{ url: "https://httpbin.org" }],
      paths: {
        "/get": {
          get: {
            summary: "httpbin_get",
            parameters: [
              { name: "customerId", in: "query", schema: { type: "string", example: "1001" } },
              { name: "x-demo-source", in: "header", schema: { type: "string", example: "openbkn" } },
            ],
            responses: { "200": { description: "OK" } },
          },
        },
      },
    });

    const result = await createTool(boxId, {
      metadataType: "openapi",
      name: "httpbin_get",
      description: "HTTPBin GET test",
      openapiSpec,
    });
    const detail = await getToolDetail(boxId, result.successIds[0]);

    expect(detail.name).toBe("httpbin_get");
    expect(detail.description).toBe("HTTPBin GET test");
    expect(detail.openapiSpec).toBe(openapiSpec);
    expect(detail.ioSpec?.parameters.map((item) => [item.name, item.in])).toEqual([
      ["customerId", "query"],
      ["x-demo-source", "header"],
    ]);
  });

  it("splits a multi-operation OpenAPI document into separate mock tools", async () => {
    const boxId = `box-multi-${Date.now()}`;
    const openapiSpec = JSON.stringify({
      openapi: "3.0.3",
      info: { title: "Mini Petstore", version: "1.0.0" },
      servers: [{ url: "https://petstore3.swagger.io/api/v3" }],
      paths: {
        "/pet": {
          put: {
            summary: "updatePet",
            description: "Update an existing pet",
            parameters: [{ name: "traceId", in: "header", schema: { type: "string" } }],
            responses: { "200": { description: "OK" } },
          },
          post: {
            summary: "addPet",
            description: "Add a new pet",
            requestBody: {
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
            responses: { "200": { description: "OK" } },
          },
        },
        "/pet/findByStatus": {
          get: {
            summary: "findPetsByStatus",
            parameters: [{ name: "status", in: "query", schema: { type: "string" } }],
            responses: { "200": { description: "OK" } },
          },
        },
      },
    });

    const result = await importOpenApiTools(boxId, openapiSpec, "Petstore test rules");
    const tools = await listTools(boxId, { page: 1, pageSize: 100 });
    const firstDetail = await getToolDetail(boxId, result.successIds[0]);

    expect(result.successCount).toBe(3);
    expect(tools.items.map((item) => item.name)).toEqual([
      "updatePet",
      "addPet",
      "findPetsByStatus",
    ]);
    expect(firstDetail.name).toBe("updatePet");
    expect(firstDetail.path).toBe("/pet");
    expect(firstDetail.method).toBe("PUT");
    expect(firstDetail.useRule).toBe("Petstore test rules");
    expect(firstDetail.ioSpec?.parameters).toEqual([
      { name: "traceId", in: "header", required: false, type: "string" },
    ]);
  });

  it("keeps all operations when importing a Petstore-sized OpenAPI document", async () => {
    const boxId = `box-petstore-sized-${Date.now()}`;
    const paths = Object.fromEntries(
      Array.from({ length: 19 }, (_, index) => [
        `/petstore/resource-${index + 1}`,
        {
          get: {
            summary: `petstoreResource${index + 1}`,
            parameters: [
              { name: "limit", in: "query", schema: { type: "integer" } },
            ],
            responses: { "200": { description: "OK" } },
          },
        },
      ]),
    );
    const openapiSpec = JSON.stringify({
      openapi: "3.0.3",
      info: { title: "Swagger Petstore", version: "1.0.0" },
      servers: [{ url: "https://petstore3.swagger.io/api/v3" }],
      paths,
    });

    const result = await importOpenApiTools(boxId, openapiSpec);
    const tools = await listTools(boxId, { page: 1, pageSize: 100 });
    const lastDetail = await getToolDetail(boxId, result.successIds[18]);

    expect(result.successCount).toBe(19);
    expect(tools.total).toBe(19);
    expect(tools.items).toHaveLength(19);
    expect(tools.items[0]?.name).toBe("petstoreResource1");
    expect(tools.items[18]?.name).toBe("petstoreResource19");
    expect(lastDetail.path).toBe("/petstore/resource-19");
    expect(lastDetail.method).toBe("GET");
    expect(lastDetail.ioSpec?.parameters[0]?.name).toBe("limit");
  });
});
