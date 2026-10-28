/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { APIRequestContext } from "@playwright/test";

export const API_BASE_URL = process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:9000/api";
export const API_PREFIX = `${API_BASE_URL}/agent-operator-integration/v1`;

export function buildUniqueName(prefix: string) {
  return `${prefix}_${Date.now()}`;
}

export function defaultApiHeaders() {
  return {
    Accept: "application/json",
  };
}

export async function assertBackendReady(request: APIRequestContext) {
  const response = await request.get(`${API_PREFIX}/tool-box/list?page=1&page_size=1`, {
    headers: defaultApiHeaders(),
  });

  if (!response.ok()) {
    throw new Error(
      `Backend unavailable (${response.status()}). Start execution-factory-dev stack before running E2E.`,
    );
  }
}

export function apiUrl(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized.startsWith("/agent-operator-integration/v1")) {
    return `${API_BASE_URL}${normalized}`;
  }
  return `${API_PREFIX}${normalized}`;
}

export async function expectOk(
  response: Awaited<ReturnType<APIRequestContext["get"]>>,
  label: string,
) {
  if (!response.ok()) {
    throw new Error(`${label} failed (${response.status()}): ${await response.text()}`);
  }
}

export function buildMinimalOpenApiSpec(specName: string) {
  return {
    openapi: "3.0.3",
    info: {
      title: specName,
      description: "Execution factory E2E OpenAPI spec",
      version: "1.0.0",
    },
    servers: [{ url: "http://127.0.0.1:9000", description: "local" }],
    paths: {
      "/execute": {
        post: {
          summary: specName,
          description: "E2E execute endpoint",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["input"],
                  properties: {
                    input: { type: "string", description: "Input text" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      },
    },
  };
}

export function buildFunctionHandlerCode() {
  return ["def handler(event):", "    x = event.get('x', 0)", "    return {'result': x + 1}"].join(
    "\n",
  );
}
