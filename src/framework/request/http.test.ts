/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AxiosAdapter } from "axios";

import { http, setRequestErrorHandler } from "@/framework/request/http";
import { transformPrecisionSafeJSONRequest } from "@/framework/request/precision-safe-json";
import { createRuntimeConfig, setRuntimeConfig } from "@/framework/runtime/config";

const adapter = vi.fn<AxiosAdapter>((config) =>
  Promise.resolve({
    config,
    data: {},
    headers: {},
    status: 200,
    statusText: "OK",
  }),
);

describe("http request headers", () => {
  beforeEach(() => {
    adapter.mockClear();
  });

  afterEach(() => {
    setRequestErrorHandler(null);
    setRuntimeConfig(createRuntimeConfig());
  });

  it.each(["from 必须是 RFC3339 时间戳", "from must be an RFC3339 timestamp"])(
    "passes the Trace reason to the global error handler: %s",
    async (reason) => {
      const notify = vi.fn();
      setRequestErrorHandler(notify);
      const rejected: AxiosAdapter = (config) =>
        Promise.reject(
          Object.assign(new Error("HTTP 400"), {
            isAxiosError: true,
            config,
            response: {
              status: 400,
              data: {
                error_code: "INVALID_ARGUMENT",
                code: "INVALID_ARGUMENT",
                message: reason,
                trace_id: "trace-list",
              },
            },
          }),
        );
      await expect(
        http.get("/agent-observability/v1/traces", { adapter: rejected }),
      ).rejects.toThrow("HTTP 400");
      expect(notify).toHaveBeenCalledWith(reason);
    },
  );

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

  it("retries a precision-safe JSON request with the original body after token refresh", async () => {
    const refreshAccessToken = vi.fn().mockResolvedValue("refreshed-token");
    setRuntimeConfig(
      createRuntimeConfig({
        auth: {
          tokenManager: {
            getAccessToken: () => "expired-token",
            refreshAccessToken,
          },
        },
      }),
    );
    const sentBodies: string[] = [];
    const retryAdapter: AxiosAdapter = (config) => {
      sentBodies.push(config.data as string);
      if (sentBodies.length === 1) {
        return Promise.reject(
          Object.assign(new Error("Request failed with status code 401"), {
            config,
            isAxiosError: true,
            response: { status: 401 },
          }),
        );
      }
      return Promise.resolve({ config, data: {}, headers: {}, status: 200, statusText: "OK" });
    };

    await http.post(
      "/vega-backend/v1/resources/view-1/data",
      { need_total: true },
      {
        adapter: retryAdapter,
        headers: { "Content-Type": "application/json" },
        transformRequest: transformPrecisionSafeJSONRequest,
      },
    );

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(sentBodies).toEqual(['{"need_total":true}', '{"need_total":true}']);
  });

  it("does not notify globally when an expected request error opts out", async () => {
    const notify = vi.fn();
    setRequestErrorHandler(notify);
    const missingRoute = vi.fn<AxiosAdapter>((config) =>
      Promise.reject(
        Object.assign(new Error("Request failed with status code 404"), {
          config,
          isAxiosError: true,
          response: { status: 404 },
        }),
      ),
    );

    await expect(
      http.get("/enterprise-only", { adapter: missingRoute, skipErrorToast: true }),
    ).rejects.toThrow("Request failed with status code 404");

    expect(notify).not.toHaveBeenCalled();
    expect(missingRoute.mock.calls[0]?.[0].skipErrorToast).toBe(true);
  });

  it.each(["missing", "revoked", "rejected-after-refresh"])(
    "ends the session once when credentials are %s",
    async (failure) => {
      const onAuthFailure = vi.fn();
      const refreshAccessToken = vi.fn(() =>
        failure === "revoked"
          ? Promise.reject(new Error("invalid_grant"))
          : Promise.resolve(failure === "missing" ? null : "refreshed-token"),
      );
      setRuntimeConfig(
        createRuntimeConfig({
          auth: {
            tokenManager: {
              getAccessToken: () => "old-token",
              refreshAccessToken,
              onAuthFailure,
            },
          },
        }),
      );
      const rejected = vi.fn<AxiosAdapter>((config) =>
        Promise.reject(
          Object.assign(new Error("HTTP 401"), {
            isAxiosError: true,
            config,
            response: { status: 401 },
          }),
        ),
      );

      await expect(http.get("/safe/v1/me", { adapter: rejected })).rejects.toThrow("HTTP 401");

      expect(refreshAccessToken).toHaveBeenCalledTimes(1);
      expect(onAuthFailure).toHaveBeenCalledTimes(1);
      expect(rejected).toHaveBeenCalledTimes(failure === "rejected-after-refresh" ? 2 : 1);
    },
  );

  it("keeps the session on an ordinary permission denial", async () => {
    const onAuthFailure = vi.fn();
    const refreshAccessToken = vi.fn();
    setRuntimeConfig(
      createRuntimeConfig({
        auth: {
          tokenManager: { getAccessToken: () => "token", refreshAccessToken, onAuthFailure },
        },
      }),
    );
    const denied: AxiosAdapter = (config) =>
      Promise.reject(
        Object.assign(new Error("HTTP 403"), {
          isAxiosError: true,
          config,
          response: { status: 403 },
        }),
      );

    await expect(http.get("/restricted", { adapter: denied })).rejects.toThrow("HTTP 403");

    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(onAuthFailure).not.toHaveBeenCalled();
  });

  it("reports the backend description when a download fails with a blob body", async () => {
    const notify = vi.fn();
    setRequestErrorHandler(notify);
    const errorBody = JSON.stringify({ description: "capability names are unavailable" });
    const failedDownload: AxiosAdapter = (config) =>
      Promise.reject(
        Object.assign(new Error("Request failed with status code 503"), {
          config,
          isAxiosError: true,
          response: {
            // jsdom's Blob has no text(), so the body a browser would read back is
            // attached here rather than left to a method the test environment lacks.
            data: Object.assign(new Blob([errorBody], { type: "application/json" }), {
              text: () => Promise.resolve(errorBody),
            }),
            status: 503,
          },
        }),
      );

    await expect(
      http.get("/bkn-backend/v1/bkns/kn-1", {
        adapter: failedDownload,
        responseType: "blob",
      }),
    ).rejects.toThrow("Request failed with status code 503");

    expect(notify).toHaveBeenCalledWith("capability names are unavailable");
  });

  it("notifies globally when a request error does not opt out", async () => {
    const notify = vi.fn();
    setRequestErrorHandler(notify);
    const missingRoute: AxiosAdapter = (config) =>
      Promise.reject(
        Object.assign(new Error("Request failed with status code 404"), {
          config,
          isAxiosError: true,
          response: { status: 404 },
        }),
      );

    await expect(http.get("/enterprise-only", { adapter: missingRoute })).rejects.toThrow(
      "Request failed with status code 404",
    );

    expect(notify).toHaveBeenCalledTimes(1);
  });
});
