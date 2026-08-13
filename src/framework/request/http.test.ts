/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AxiosAdapter } from "axios";

import { http } from "@/framework/request/http";
import { createRuntimeConfig, setRuntimeConfig } from "@/framework/runtime/config";

const adapter = vi.fn<AxiosAdapter>((config) => Promise.resolve({
  config,
  data: {},
  headers: {},
  status: 200,
  statusText: "OK",
}));

describe("http request headers", () => {
  beforeEach(() => {
    adapter.mockClear();
  });

  afterEach(() => {
    setRuntimeConfig(createRuntimeConfig());
  });

  it("sends the selected locale through the standard language header", async () => {
    setRuntimeConfig(createRuntimeConfig({ locale: "en-US" }));

    await http.get("/health", { adapter });

    const headers = adapter.mock.calls[0]?.[0].headers;
    expect(headers?.get("Accept-Language")).toBe("en-US");
    expect(headers?.get("X-Language")).toBeUndefined();
  });

  it("overwrites a caller-supplied language after the UI locale changes", async () => {
    setRuntimeConfig(createRuntimeConfig({ locale: "en-US" }));
    await http.get("/first", {
      adapter,
      headers: { "Accept-Language": "zh-CN, en-US;q=0.8" },
    });

    setRuntimeConfig(createRuntimeConfig({ locale: "zh-CN" }));
    await http.get("/second", {
      adapter,
      headers: { "Accept-Language": "en-US" },
    });

    expect(adapter.mock.calls[0]?.[0].headers?.get("Accept-Language")).toBe("en-US");
    expect(adapter.mock.calls[1]?.[0].headers?.get("Accept-Language")).toBe("zh-CN");
  });
});
