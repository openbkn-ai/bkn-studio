/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AxiosAdapter } from "axios";

import { http, setRequestErrorHandler } from "@/framework/request/http";
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
    setRequestErrorHandler(null);
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

  it("does not notify globally when an expected request error opts out", async () => {
    const notify = vi.fn();
    setRequestErrorHandler(notify);
    const missingRoute: AxiosAdapter = (config) => Promise.reject(Object.assign(
      new Error("Request failed with status code 404"),
      { config, isAxiosError: true, response: { status: 404 } },
    ));

    await expect(http.get("/enterprise-only", { adapter: missingRoute, skipErrorToast: true }))
      .rejects.toThrow("Request failed with status code 404");

    expect(notify).not.toHaveBeenCalled();
  });

  it("reports the backend description when a download fails with a blob body", async () => {
    const notify = vi.fn();
    setRequestErrorHandler(notify);
    const errorBody = JSON.stringify({ description: "capability names are unavailable" });
    const failedDownload: AxiosAdapter = (config) => Promise.reject(Object.assign(
      new Error("Request failed with status code 503"),
      {
        config,
        isAxiosError: true,
        response: {
          // jsdom's Blob has no text(), so the body a browser would read back is
          // attached here rather than left to a method the test environment lacks.
          data: Object.assign(
            new Blob([errorBody], { type: "application/json" }),
            { text: () => Promise.resolve(errorBody) },
          ),
          status: 503,
        },
      },
    ));

    await expect(http.get("/bkn-backend/v1/bkns/kn-1", {
      adapter: failedDownload,
      responseType: "blob",
    })).rejects.toThrow("Request failed with status code 503");

    expect(notify).toHaveBeenCalledWith("capability names are unavailable");
  });

  it("notifies globally when a request error does not opt out", async () => {
    const notify = vi.fn();
    setRequestErrorHandler(notify);
    const missingRoute: AxiosAdapter = (config) => Promise.reject(Object.assign(
      new Error("Request failed with status code 404"),
      { config, isAxiosError: true, response: { status: 404 } },
    ));

    await expect(http.get("/enterprise-only", { adapter: missingRoute }))
      .rejects.toThrow("Request failed with status code 404");

    expect(notify).toHaveBeenCalledTimes(1);
  });
});
