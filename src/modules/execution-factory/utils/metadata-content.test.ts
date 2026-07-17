/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  analyzeOpenApiDocumentText,
  buildOpenApiDocumentFromMetadata,
  normalizeGeneratedCapabilityDescription,
  normalizeGeneratedToolboxDescription,
  normalizeOpenApiDocumentText,
  parseOpenApiDocumentText,
  parseOpenApiDataPayload,
  resolveOpenApiServiceUrl,
  rewriteOpenApiOperationSummaries,
  rewriteOpenApiServerUrl,
  validateOpenApiDocumentText,
} from "@/modules/execution-factory/utils/metadata-content";

const validSpec = JSON.stringify(
  {
    openapi: "3.0.3",
    info: { title: "get_weather", version: "1.0.0" },
    servers: [{ url: "https://example.com" }],
    paths: {
      "/weather": {
        get: {
          summary: "查询天气",
          responses: { "200": { description: "OK" } },
        },
      },
    },
  },
  null,
  2,
);

const validYamlSpec = `openapi: "3.0.3"
info:
  title: get_weather
  version: "1.0.0"
servers:
  - url: https://example.com
paths:
  /weather:
    get:
      summary: 查询天气
      responses:
        "200":
          description: OK
`;

describe("metadata-content OpenAPI helpers", () => {
  it("reconstructs a full OpenAPI document from backend metadata", () => {
    const document = buildOpenApiDocumentFromMetadata({
      description: "test",
      method: "POST",
      path: "/api/v1/add",
      server_url: "http://ef-oss-mock:8080",
      summary: "加法",
      api_spec: {
        parameters: [],
        request_body: {
          content: {
            "application/json": {
              schema: {
                properties: {
                  a: { type: "number" },
                  b: { type: "number" },
                },
                required: ["a", "b"],
                type: "object",
              },
            },
          },
          required: false,
        },
        responses: [
          {
            status_code: "200",
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
        ],
      },
    });

    expect(document).toBeTruthy();

    const parsed = JSON.parse(document!) as {
      openapi?: string;
      info?: { title?: string };
      paths?: Record<string, Record<string, unknown>>;
    };

    expect(parsed.openapi).toBe("3.0.3");
    expect(parsed.info?.title).toBe("加法");
    expect(parsed.paths?.["/api/v1/add"]?.post).toBeTruthy();
  });

  it("rejects api_spec fragments without OpenAPI top-level fields", () => {
    const validation = validateOpenApiDocumentText(
      JSON.stringify(
        {
          parameters: [],
          responses: [{ status_code: "200", description: "OK" }],
        },
        null,
        2,
      ),
    );

    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.reason).toContain("openapi");
    }
  });

  it("keeps register payloads as raw JSON strings", () => {
    const spec = JSON.stringify({ openapi: "3.0.3" }, null, 2);
    const payload = parseOpenApiDataPayload(spec, "register");

    expect(typeof payload).toBe("string");
    expect(payload).toBe(spec);
  });

  it("analyzes a valid single-endpoint OpenAPI document", () => {
    const analysis = analyzeOpenApiDocumentText(validSpec);

    expect(analysis.ok).toBe(true);
    if (analysis.ok) {
      expect(analysis.operationCount).toBe(1);
      expect(analysis.serverUrl).toBe("https://example.com");
      expect(analysis.operations[0]).toMatchObject({
        method: "GET",
        path: "/weather",
        summary: "查询天气",
      });
    }
  });

  it("parses, analyzes and normalizes a YAML OpenAPI document", () => {
    const parsed = parseOpenApiDocumentText(validYamlSpec);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.format).toBe("yaml");
      expect(parsed.document.openapi).toBe("3.0.3");
    }

    const analysis = analyzeOpenApiDocumentText(validYamlSpec);
    expect(analysis.ok).toBe(true);
    if (analysis.ok) {
      expect(analysis.operationCount).toBe(1);
      expect(analysis.serverUrl).toBe("https://example.com");
    }

    const normalized = normalizeOpenApiDocumentText(validYamlSpec);
    expect(() => JSON.parse(normalized)).not.toThrow();
    expect(JSON.parse(normalized)).toMatchObject({
      openapi: "3.0.3",
      info: { title: "get_weather", version: "1.0.0" },
    });
  });

  it("reports malformed YAML with a JSON/YAML parsing error", () => {
    const parsed = parseOpenApiDocumentText("openapi: [");

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.reason).toContain("JSON 或 YAML");
    }
  });

  it("resolves a root-relative server URL against an OpenAPI document URL", () => {
    const spec = JSON.stringify({
      openapi: "3.0.4",
      info: { title: "Swagger Petstore", version: "1.0.0" },
      servers: [{ url: "/api/v3" }],
      paths: {
        "/pet": {
          put: {
            summary: "Update a pet",
            responses: { "200": { description: "OK" } },
          },
        },
      },
    });

    const resolved = resolveOpenApiServiceUrl(spec, {
      kind: "url",
      url: "https://petstore3.swagger.io/api/v3/openapi.json",
    });

    expect(resolved).toEqual({
      ok: true,
      source: "resolved-relative",
      url: "https://petstore3.swagger.io/api/v3",
    });
  });

  it("requires a manual service URL for relative servers from pasted OpenAPI documents", () => {
    const spec = JSON.stringify({
      openapi: "3.0.4",
      info: { title: "Swagger Petstore", version: "1.0.0" },
      servers: [{ url: "/api/v3" }],
      paths: {
        "/pet": {
          put: {
            summary: "Update a pet",
            responses: { "200": { description: "OK" } },
          },
        },
      },
    });

    const resolved = resolveOpenApiServiceUrl(spec, { kind: "paste" });

    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.relativeUrl).toBe("/api/v3");
      expect(resolved.reason).toContain("/api/v3");
    }
  });

  it("rewrites the first OpenAPI server URL before submit", () => {
    const spec = JSON.stringify({
      openapi: "3.0.4",
      info: { title: "Swagger Petstore", version: "1.0.0" },
      servers: [{ url: "/api/v3" }],
      paths: {
        "/pet": {
          put: {
            summary: "Update a pet",
            responses: { "200": { description: "OK" } },
          },
        },
      },
    });

    const rewritten = rewriteOpenApiServerUrl(spec, "https://petstore3.swagger.io/api/v3");
    const parsed = JSON.parse(rewritten) as { servers?: Array<{ url?: string }> };

    expect(parsed.servers?.[0]?.url).toBe("https://petstore3.swagger.io/api/v3");
  });

  it("rewrites OpenAPI operation summaries into backend-safe tool names", () => {
    const spec = JSON.stringify({
      openapi: "3.0.4",
      info: { title: "Swagger Petstore", version: "1.0.0" },
      servers: [{ url: "https://petstore3.swagger.io/api/v3" }],
      paths: {
        "/user/createWithList": {
          post: {
            summary: "Creates list of users with given input array.",
            responses: { "200": { description: "OK" } },
          },
        },
      },
    });

    const rewritten = rewriteOpenApiOperationSummaries(spec);
    const parsed = JSON.parse(rewritten) as {
      paths?: Record<string, Record<string, { summary?: string }>>;
    };

    expect(parsed.paths?.["/user/createWithList"]?.post?.summary).toBe(
      "Creates_list_of_users_with_given_input_array",
    );
  });

  it("limits generated capability descriptions to 2048 characters", () => {
    expect(normalizeGeneratedCapabilityDescription("x".repeat(2050))?.length).toBe(2048);
    expect(normalizeGeneratedCapabilityDescription("  short description  ")).toBe(
      "short description",
    );
  });

  it("limits generated toolbox descriptions to the backend toolbox limit", () => {
    expect(normalizeGeneratedToolboxDescription("x".repeat(501))?.length).toBe(500);
    expect(normalizeGeneratedToolboxDescription("  toolbox description  ")).toBe(
      "toolbox description",
    );
  });

  it("rejects documents with empty info.title", () => {
    const validation = validateOpenApiDocumentText(
      JSON.stringify(
        {
          openapi: "3.0.3",
          info: { title: "  ", version: "1.0.0" },
          servers: [{ url: "https://example.com" }],
          paths: {
            "/weather": {
              get: {
                summary: "查询天气",
                responses: { "200": { description: "OK" } },
              },
            },
          },
        },
        null,
        2,
      ),
    );

    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.reason).toContain("info.title");
    }
  });

  it("rejects documents with unresolved component refs", () => {
    const validation = validateOpenApiDocumentText(
      JSON.stringify(
        {
          openapi: "3.0.3",
          info: { title: "demo", version: "1.0.0" },
          servers: [{ url: "https://example.com" }],
          paths: {
            "/weather": {
              get: {
                summary: "查询天气",
                responses: {
                  "429": { $ref: "#/components/responses/RateLimited" },
                },
              },
            },
          },
        },
        null,
        2,
      ),
    );

    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.reason).toContain("components/responses/RateLimited");
    }
  });

  it("accepts operations with description at the backend limit", () => {
    const validation = validateOpenApiDocumentText(
      JSON.stringify(
        {
          openapi: "3.0.3",
          info: { title: "demo", version: "1.0.0" },
          servers: [{ url: "https://example.com" }],
          paths: {
            "/weather": {
              get: {
                summary: "weather",
                description: "x".repeat(2048),
                responses: { "200": { description: "OK" } },
              },
            },
          },
        },
        null,
        2,
      ),
    );

    expect(validation.ok).toBe(true);
  });

  it("rejects operations with description longer than backend limit", () => {
    const validation = validateOpenApiDocumentText(
      JSON.stringify(
        {
          openapi: "3.0.3",
          info: { title: "demo", version: "1.0.0" },
          servers: [{ url: "https://example.com" }],
          paths: {
            "/weather": {
              get: {
                summary: "查询天气",
                description: "x".repeat(2049),
                responses: { "200": { description: "OK" } },
              },
            },
          },
        },
        null,
        2,
      ),
    );

    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.reason).toContain("description");
      expect(validation.reason).toContain("2048");
    }
  });

  it("rejects operations without summary", () => {
    const validation = validateOpenApiDocumentText(
      JSON.stringify(
        {
          openapi: "3.0.3",
          info: { title: "demo", version: "1.0.0" },
          servers: [{ url: "https://example.com" }],
          paths: {
            "/weather": {
              get: {
                responses: { "200": { description: "OK" } },
              },
            },
          },
        },
        null,
        2,
      ),
    );

    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.reason).toContain("summary");
    }
  });

  it("parses edit payloads into OpenAPI objects", () => {
    const spec = JSON.stringify(
      {
        openapi: "3.0.3",
        info: { title: "加法", version: "1.0.0" },
        servers: [{ url: "http://localhost:8080" }],
        paths: {
          "/api/v1/add": {
            post: {
              summary: "加法",
              responses: { "200": { description: "OK" } },
            },
          },
        },
      },
      null,
      2,
    );

    const payload = parseOpenApiDataPayload(spec, "edit");

    expect(typeof payload).toBe("object");
    expect(payload).toMatchObject({ openapi: "3.0.3" });
  });
});
