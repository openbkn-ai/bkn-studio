/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  assertDebugHeadersAllowed,
  isSensitiveName,
  maskDebugRequestSecrets,
} from "@/modules/execution-factory/utils/debug-secrets";

describe("debug secret guards", () => {
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

  it("recognizes credential names across kebab, snake and camel spellings", () => {
    for (const name of [
      "token",
      "api_key",
      "apiKey",
      "apikey",
      "X-Api-Key",
      "access_token",
      "accessToken",
      "app_secret",
      "sk",
      "sign",
      "signature",
      "password",
      "Authorization",
    ]) {
      expect(isSensitiveName(name), name).toBe(true);
    }
  });

  it("leaves the query parameter names actually used by platform tools alone", () => {
    // Query parameter names from all 50 registered tools on the VM.
    for (const name of [
      "response_format",
      "kn_id",
      "include_logic_params",
      "ot_id",
      "poll_interval",
      "sync_timeout",
      "x-tenant-id",
      "limit",
    ]) {
      expect(isSensitiveName(name), name).toBe(false);
    }
  });

  it("masks credential header and query values before they reach the run log", () => {
    expect(
      maskDebugRequestSecrets({
        body: { enabled: true, token: "body values stay untouched" },
        header: {
          Authorization: "Bearer secret-token",
          "X-Api-Key": "abcdef",
          "x-tenant-id": "t-1",
        },
        query: { api_key: "ak-live-1", kn_id: "kn-1", token: "bak_live_2" },
      }),
    ).toEqual({
      body: { enabled: true, token: "body values stay untouched" },
      header: {
        Authorization: "***",
        "X-Api-Key": "***",
        "x-tenant-id": "t-1",
      },
      query: { api_key: "***", kn_id: "kn-1", token: "***" },
    });
  });

  it("leaves empty credential values and secret-free requests untouched", () => {
    expect(maskDebugRequestSecrets({ header: { authorization: "" } })).toEqual({
      header: { authorization: "" },
    });
    expect(maskDebugRequestSecrets({ query: { limit: 20 } })).toEqual({ query: { limit: 20 } });
    expect(maskDebugRequestSecrets({ path: { id: "1" } })).toEqual({ path: { id: "1" } });
  });
});
