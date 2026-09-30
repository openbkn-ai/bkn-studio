/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const httpState = vi.hoisted(() => ({
  calls: [] as unknown[][],
  get: () => Promise.resolve({ data: { pending_count: 0 } }),
}));

vi.mock("@/framework/request/http", () => ({
  http: {
    get: (...args: unknown[]) => {
      httpState.calls.push(args);
      return httpState.get();
    },
  },
}));

async function importSummary(useMock: "true" | "false") {
  vi.stubEnv("VITE_USE_MOCK", useMock);
  vi.resetModules();
  const { getPermissionRequestTodoSummary } = await import("./permission-requests.service");
  return getPermissionRequestTodoSummary;
}

describe("getPermissionRequestTodoSummary", () => {
  beforeEach(() => {
    httpState.calls = [];
    httpState.get = () => Promise.resolve({ data: { pending_count: 0 } });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("does not request an unproxied API in mock mode", async () => {
    const getSummary = await importSummary("true");

    await expect(getSummary()).resolves.toEqual({ pending_count: 0 });
    expect(httpState.calls).toHaveLength(0);
  });

  it("loads the real summary without a background error toast", async () => {
    httpState.get = () => Promise.resolve({ data: { pending_count: 3 } });
    const getSummary = await importSummary("false");

    await expect(getSummary()).resolves.toEqual({ pending_count: 3 });
    expect(httpState.calls).toEqual([
      ["/safe/v1/me/permission-requests/todo/summary", { skipErrorToast: true }],
    ]);
  });

  it("stops retrying when an older backend does not have the summary route", async () => {
    const getSummary = await importSummary("false");
    const error = new AxiosError("not found");
    error.response = { status: 404 } as typeof error.response;
    httpState.get = () => Promise.reject(error);

    expect(await getSummary()).toEqual({ pending_count: 0 });
    expect(await getSummary()).toEqual({ pending_count: 0 });
    expect(httpState.calls).toHaveLength(1);
  });

  it("preserves other request failures", async () => {
    const getSummary = await importSummary("false");
    httpState.get = () => Promise.reject(new Error("network unavailable"));

    let failure: unknown;
    try {
      await getSummary();
    } catch (error) {
      failure = error;
    }
    expect(failure instanceof Error && failure.message === "network unavailable").toBe(true);
  });
});
