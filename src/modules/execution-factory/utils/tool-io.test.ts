/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { buildToolDebugRequest } from "@/modules/execution-factory/utils/tool-io";

describe("buildToolDebugRequest", () => {
  it("splits flat debug input by OpenAPI parameter location", () => {
    expect(
      buildToolDebugRequest(
        {
          accept: "application/json",
          customerId: "1001",
          region: "CN",
          "x-demo-source": "openbkn-manual",
        },
        {
          parameters: [
            { in: "query", name: "customerId", type: "string" },
            { in: "query", name: "region", type: "string" },
            { in: "header", name: "accept", type: "string" },
            { in: "header", name: "x-demo-source", type: "string" },
          ],
        },
      ),
    ).toEqual({
      header: {
        accept: "application/json",
        "x-demo-source": "openbkn-manual",
      },
      query: {
        customerId: "1001",
        region: "CN",
      },
    });
  });

  it("preserves explicit query/header/body debug payloads", () => {
    expect(
      buildToolDebugRequest({
        body: { city: "Beijing" },
        header: { accept: "application/json" },
        query: { region: "CN" },
      }),
    ).toEqual({
      body: { city: "Beijing" },
      header: { accept: "application/json" },
      query: { region: "CN" },
    });
  });

  it("keeps unknown flat fields in the request body", () => {
    expect(
      buildToolDebugRequest(
        { city: "Beijing", traceId: "debug-1" },
        { parameters: [{ in: "query", name: "city", type: "string" }] },
      ),
    ).toEqual({
      body: { traceId: "debug-1" },
      query: { city: "Beijing" },
    });
  });
});
