/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  assertDebugHeadersAllowed,
  maskDebugRequestSecrets,
} from "@/modules/execution-factory/utils/debug-headers";

describe("debug header guards", () => {
  it("rejects transport headers owned by the forwarder", () => {
    expect(() => assertDebugHeadersAllowed({ "Content-Length": 12, Host: "example.com" })).toThrow(
      "Header: not allowed here (set by the forwarder): Content-Length, Host",
    );
  });

  it("accepts business and custom headers", () => {
    expect(() =>
      assertDebugHeadersAllowed({ Authorization: "Bearer x", "x-tenant-id": "t-1" }),
    ).not.toThrow();
  });

  it("masks credential header values before they reach the run log", () => {
    expect(
      maskDebugRequestSecrets({
        body: { enabled: true },
        header: {
          Authorization: "Bearer secret-token",
          "X-Api-Key": "abcdef",
          "x-tenant-id": "t-1",
        },
      }),
    ).toEqual({
      body: { enabled: true },
      header: {
        Authorization: "***",
        "X-Api-Key": "***",
        "x-tenant-id": "t-1",
      },
    });
  });

  it("leaves empty credential values and header-less requests untouched", () => {
    expect(maskDebugRequestSecrets({ header: { authorization: "" } })).toEqual({
      header: { authorization: "" },
    });
    expect(maskDebugRequestSecrets({ query: { limit: 20 } })).toEqual({ query: { limit: 20 } });
  });
});
