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

  it("extracts operation IO from a YAML OpenAPI document", () => {
    const yamlSpec = `openapi: "3.0.3"
info:
  title: weather
  version: "1.0.0"
servers:
  - url: https://example.com
paths:
  /weather:
    get:
      summary: 查询天气
      parameters:
        - name: city
          in: query
          schema:
            type: string
      responses:
        "200":
          description: OK
`;

    const operations = extractOpenApiOperationsIo(yamlSpec);

    expect(operations).toHaveLength(1);
    expect(operations[0]?.io.parameters?.[0]).toMatchObject({
      name: "city",
      in: "query",
      type: "string",
    });
  });

  it("resolves request and response schemas referenced from components", () => {
    const spec = JSON.stringify({
      openapi: "3.0.3",
      info: { title: "BKN API", version: "1.0.0" },
      servers: [{ url: "https://example.com" }],
      paths: {
        "/knowledge-networks": {
          post: {
            summary: "创建业务知识网络",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ReqKnowledgeNetwork" },
                },
              },
            },
            responses: {
              "201": {
                description: "创建成功",
                content: {
                  "application/json": {
                    schema: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ID" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          ReqKnowledgeNetwork: {
            description: "业务知识网络创建请求体",
            type: "object",
            required: ["name"],
            properties: {
              name: { type: "string", description: "业务知识网络名称" },
            },
          },
          ID: {
            type: "object",
            required: ["id"],
            properties: {
              id: { type: "string", description: "id" },
            },
          },
        },
      },
    });

    const io = extractOpenApiOperationsIo(spec)[0]?.io;

    expect(io?.requestBodySchema).toMatchObject({
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string", description: "业务知识网络名称" },
      },
    });
    expect(io?.responses?.["201"]?.schema).toMatchObject({
      type: "array",
      items: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "id" },
        },
      },
    });
  });

  it("keeps a reference marker when a schema contains a circular reference", () => {
    const spec = JSON.stringify({
      openapi: "3.0.3",
      info: { title: "Tree API", version: "1.0.0" },
      servers: [{ url: "https://example.com" }],
      paths: {
        "/tree": {
          get: {
            summary: "Get tree",
            responses: {
              "200": {
                description: "OK",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/Node" },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          Node: {
            type: "object",
            properties: {
              child: { $ref: "#/components/schemas/Node" },
            },
          },
        },
      },
    });

    expect(extractOpenApiOperationsIo(spec)[0]?.io.responses?.["200"]?.schema).toMatchObject({
      type: "object",
      properties: {
        child: { $ref: "#/components/schemas/Node" },
      },
    });
  });

  it("merges path-level parameters and lets operation parameters override them", () => {
    const spec = JSON.stringify({
      openapi: "3.0.3",
      info: { title: "Pet API", version: "1.0.0" },
      servers: [{ url: "https://example.com" }],
      paths: {
        "/pets/{petId}": {
          parameters: [
            {
              name: "petId",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "path pet id",
            },
            {
              name: "verbose",
              in: "query",
              schema: { type: "boolean" },
              description: "path verbose",
            },
          ],
          get: {
            summary: "Get pet",
            parameters: [
              {
                name: "verbose",
                in: "query",
                schema: { type: "boolean" },
                description: "operation verbose",
                required: true,
              },
            ],
            responses: { "200": { description: "OK" } },
          },
        },
      },
    });

    expect(extractOpenApiOperationsIo(spec)[0]?.io.parameters).toEqual([
      {
        name: "petId",
        in: "path",
        required: true,
        description: "path pet id",
        type: "string",
      },
      {
        name: "verbose",
        in: "query",
        required: true,
        description: "operation verbose",
        type: "boolean",
      },
    ]);
  });

  it("prefers application/json content and reads examples maps", () => {
    const spec = JSON.stringify({
      openapi: "3.0.3",
      info: { title: "Login API", version: "1.0.0" },
      servers: [{ url: "https://example.com" }],
      paths: {
        "/login": {
          post: {
            summary: "Login",
            requestBody: {
              content: {
                "text/plain": {
                  schema: { type: "string" },
                  example: "plain-body",
                },
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { username: { type: "string" } },
                  },
                  examples: {
                    demo: {
                      value: { username: "alice" },
                    },
                  },
                },
              },
            },
            responses: {
              "200": {
                description: "OK",
                content: {
                  "text/html": {
                    schema: { type: "string" },
                    example: "<html/>",
                  },
                  "application/json": {
                    schema: { type: "object" },
                    examples: {
                      ok: { value: { token: "abc" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const io = extractOpenApiOperationsIo(spec)[0]?.io;

    expect(io?.requestBodyExample).toEqual({ username: "alice" });
    expect(io?.requestBodySchema).toMatchObject({
      type: "object",
      properties: { username: { type: "string" } },
    });
    expect(io?.responses?.["200"]?.example).toEqual({ token: "abc" });
  });
});
