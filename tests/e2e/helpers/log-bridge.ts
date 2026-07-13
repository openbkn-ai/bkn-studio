/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { APIRequestContext } from "@playwright/test";

export const LOG_BRIDGE_HOST_URL =
  process.env.E2E_LOG_BRIDGE_URL ?? "http://127.0.0.1:8095";
export const LOG_BRIDGE_DOCKER_URL = "http://ef-log-bridge:8095";

export function buildLogBridgeLogsUrl(
  container = "ef-operator-integration",
  options?: { tail?: number; level?: "error" | "all" },
) {
  const tail = options?.tail ?? 50;
  const level = options?.level ?? "error";
  return `${LOG_BRIDGE_DOCKER_URL}/logs/${container}?tail=${tail}&level=${level}`;
}

export function buildLogBridgeOpenApiSpec(baseName: string) {
  const serverUrl = LOG_BRIDGE_DOCKER_URL;
  const shortName = baseName.length > 30 ? baseName.slice(0, 30) : baseName;
  return {
    openapi: "3.0.3",
    info: {
      title: shortName,
      description: "Docker container logs via ef-log-bridge",
      version: "1.0.0",
    },
    servers: [{ url: serverUrl, description: "log-bridge" }],
    paths: {
      "/logs/ef-operator-integration": {
        get: {
          summary: "container_logs",
          description: "Fetch latest operator-integration logs",
          parameters: [
            { name: "tail", in: "query", schema: { type: "integer", default: 50 } },
            { name: "level", in: "query", schema: { type: "string", default: "error" } },
          ],
          responses: {
            "200": {
              description: "Log lines",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      count: { type: "integer" },
                      lines: { type: "array", items: { type: "string" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

export async function assertLogBridgeHealthy(request?: APIRequestContext) {
  const url = `${LOG_BRIDGE_HOST_URL}/health`;
  if (request) {
    const response = await request.get(url);
    if (!response.ok()) {
      throw new Error(`log-bridge unavailable (${response.status()})`);
    }
    return;
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`log-bridge unavailable (${response.status})`);
  }
}
