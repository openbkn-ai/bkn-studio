/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  buildHttpDebugInitialValues,
  buildHttpDebugRequest,
} from "@/modules/execution-factory/utils/http-debug-request";

const ioSpec = {
  parameters: [
    { in: "header", name: "x-tenant-id", required: true, type: "string" },
    { in: "query", name: "limit", type: "integer" },
    { in: "path", name: "resourceId", required: true, type: "string" },
  ],
  requestBodySchema: {
    properties: {
      enabled: { type: "boolean" },
    },
    type: "object",
  },
};

describe("HTTP debug request helpers", () => {
  it("generates independent samples for every HTTP parameter location", () => {
    expect(buildHttpDebugInitialValues(ioSpec)).toEqual({
      requestBody: '{\n  "enabled": false\n}',
      requestHeaders: '{\n  "x-tenant-id": ""\n}',
      requestPath: '{\n  "resourceId": ""\n}',
      requestQuery: '{\n  "limit": 0\n}',
    });
  });

  it("builds a structured request and stringifies path values", () => {
    expect(
      buildHttpDebugRequest(
        {
          requestBody: '{"enabled":true}',
          requestHeaders: '{"x-tenant-id":"tenant-1"}',
          requestPath: '{"resourceId":1001}',
          requestQuery: '{"limit":20}',
        },
        ioSpec,
      ),
    ).toEqual({
      body: { enabled: true },
      header: { "x-tenant-id": "tenant-1" },
      path: { resourceId: "1001" },
      query: { limit: 20 },
    });
  });

  it("rejects missing required parameters", () => {
    expect(() =>
      buildHttpDebugRequest(
        {
          requestHeaders: "{}",
          requestPath: "{}",
        },
        ioSpec,
      ),
    ).toThrow("Header: missing required parameters: x-tenant-id");
  });

  it("rejects unresolved path template placeholders", () => {
    expect(() =>
      buildHttpDebugRequest(
        {
          requestPath: "{}",
        },
        { parameters: [] },
        "/resources/{resourceId}",
      ),
    ).toThrow("Path: unresolved placeholders: resourceId");
  });

  it("does not reinterpret body fields named header or query", () => {
    expect(
      buildHttpDebugRequest({
        requestBody: '{"header":{"business":true},"query":"business value"}',
      }),
    ).toEqual({
      body: {
        header: { business: true },
        query: "business value",
      },
    });
  });
});
