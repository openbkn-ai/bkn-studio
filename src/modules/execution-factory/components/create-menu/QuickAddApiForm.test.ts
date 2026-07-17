/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { QuickAddApiFormValues } from "./QuickAddApiForm";
import { parseCurlCommand } from "@/modules/execution-factory/utils/curl-to-openapi";
import {
  buildEffectiveQuickApiValues,
  buildQuickApiSubmissionFromValues,
  resolveQuickApiFormContract,
} from "@/modules/execution-factory/utils/quick-api-contract";

function createValues(
  overrides: Partial<QuickAddApiFormValues> = {},
): QuickAddApiFormValues {
  return {
    method: "POST",
    serverUrl: "https://edited.example.com",
    path: "/edited/{itemId}",
    summary: "Edited API",
    toolboxMode: "existing",
    ...overrides,
  };
}

describe("QuickAddApiForm editable contract", () => {
  it("builds from edited form values instead of reparsing the original cURL", () => {
    const result = buildQuickApiSubmissionFromValues(
      createValues({
        curlText: "curl https://original.example.com/original",
        parameters: [
          {
            name: "itemId",
            in: "path",
            required: false,
            type: "string",
          },
          {
            name: "x-tenant",
            in: "header",
            required: true,
            type: "string",
            example: "tenant-1",
          },
        ],
        requestBodyEnabled: true,
        requestBodyContentType: "application/json",
        requestBodyRequired: true,
        requestBodySchemaText: '{"type":"object"}',
        requestBodyExampleText: '{"name":"edited"}',
        responses: [
          {
            statusCode: "201",
            description: "Created",
            contentType: "application/json",
            schemaText: '{"type":"object"}',
            exampleText: '{"id":"1"}',
          },
        ],
      }),
    );

    expect(result?.serviceUrl).toBe("https://edited.example.com");
    const document = JSON.parse(result?.openapiSpec ?? "{}") as {
      servers: Array<{ url: string }>;
      paths: Record<
        string,
        Record<
          string,
          {
            parameters: Array<{ in: string; name: string; required: boolean }>;
            requestBody: unknown;
            responses: Record<string, unknown>;
          }
        >
      >;
    };
    const operation = document.paths["/edited/{itemId}"].post;

    expect(document.servers[0]?.url).toBe("https://edited.example.com");
    expect(operation.parameters[0]).toEqual(
      expect.objectContaining({ in: "path", name: "itemId", required: true }),
    );
    expect(operation.requestBody).toBeDefined();
    expect(operation.responses).toHaveProperty("201");
  });

  it("rejects invalid editable JSON instead of silently saving a different contract", () => {
    expect(
      buildQuickApiSubmissionFromValues(
        createValues({
          requestBodyEnabled: true,
          requestBodySchemaText: "{invalid",
        }),
      ),
    ).toBeUndefined();
  });

  it("infers JSON Schema from a request body example", () => {
    const submission = buildQuickApiSubmissionFromValues(
      createValues({
        requestBodyEnabled: true,
        requestBodyContentType: "application/json",
        requestBodyExampleText: '{"query":"search schema","limit":10}',
      }),
    );
    const document = JSON.parse(submission?.openapiSpec ?? "{}") as {
      paths: {
        "/edited/{itemId}": {
          post: {
            requestBody: {
              content: {
                "application/json": {
                  example: Record<string, unknown>;
                  schema: { properties: Record<string, { type: string }>; type: string };
                };
              };
            };
          };
        };
      };
    };
    const body = document.paths["/edited/{itemId}"].post.requestBody.content["application/json"];

    expect(body.example).toEqual({ query: "search schema", limit: 10 });
    expect(body.schema.type).toBe("object");
    expect(body.schema.properties.query.type).toBe("string");
    expect(body.schema.properties.limit.type).toBe("integer");
  });

  it("recovers when ordinary request data is pasted into the Schema field", () => {
    const submission = buildQuickApiSubmissionFromValues(
      createValues({
        requestBodyEnabled: true,
        requestBodyContentType: "application/json",
        requestBodySchemaText: '{"query":"search schema","enable_rerank":true}',
      }),
    );
    const document = JSON.parse(submission?.openapiSpec ?? "{}") as {
      paths: {
        "/edited/{itemId}": {
          post: {
            requestBody: {
              content: {
                "application/json": {
                  example: Record<string, unknown>;
                  schema: { properties: Record<string, { type: string }>; type: string };
                };
              };
            };
          };
        };
      };
    };
    const body = document.paths["/edited/{itemId}"].post.requestBody.content["application/json"];

    expect(body.example).toEqual({ query: "search schema", enable_rerank: true });
    expect(body.schema.type).toBe("object");
    expect(body.schema.properties.enable_rerank.type).toBe("boolean");
  });

  it("derives serverUrl and path from apiUrl when hidden contract fields are empty", () => {
    const resolved = resolveQuickApiFormContract(
      createValues({
        serverUrl: "",
        path: "",
        summary: "Describe Resource",
        apiUrl: "https://14.103.77.23/api/agent-retrieval/v1/kn/describe_resource",
        method: "POST",
        parameters: [
          {
            name: "Authorization",
            in: "header",
            required: false,
            type: "string",
          },
        ],
      }),
    );

    const submission = buildQuickApiSubmissionFromValues(resolved);

    expect(submission?.serviceUrl).toBe("https://14.103.77.23");
    expect(submission?.path).toBe("/api/agent-retrieval/v1/kn/describe_resource");
    expect(submission?.method).toBe("POST");
  });

  it("keeps parameters detected from cURL when form-only fields are not mounted", () => {
    const parsed = parseCurlCommand(
      'curl "https://api.example.com/items?limit=10" -H "x-tenant: tenant-1"',
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const values = buildEffectiveQuickApiValues(
      createValues({
        method: "",
        serverUrl: "",
        path: "",
        summary: "",
      }),
      "curl",
      [],
      {
        method: parsed.value.method,
        serverUrl: parsed.value.serverUrl,
        path: parsed.value.path,
        summary: parsed.value.summary,
        parameters: parsed.value.queryParams,
      },
    );
    const submission = buildQuickApiSubmissionFromValues(values);
    const document = JSON.parse(submission?.openapiSpec ?? "{}") as {
      paths: {
        "/items": {
          get: {
            parameters: Array<{ in: string; name: string }>;
          };
        };
      };
    };

    expect(document.paths["/items"].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ in: "query", name: "limit" }),
        expect.objectContaining({ in: "header", name: "x-tenant" }),
      ]),
    );
  });
});
