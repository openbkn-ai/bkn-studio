/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isCatalogSummaryOnly } from "./catalog-operations";

const getMock = vi.hoisted(() => vi.fn());
vi.mock("@/framework/request/http", () => ({ http: { get: getMock } }));

async function settle<T>(result: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return result;
}

const query = { keyword: "", page: 1, pageSize: 50, type: "physical" as const };

describe("catalog mock user operations", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_USE_MOCK", "true");
    vi.stubEnv("VITE_MOCK_USER", "viewer");
    getMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("removes management, authorization and query operations from mock list and detail", async () => {
    const { listCatalogs, getCatalog } = await import("./catalog.service");
    const { items } = await settle(listCatalogs(query));
    expect(items.length).toBeGreaterThan(0);
    for (const catalog of items.filter((item) => item.id !== "cat-009")) {
      expect(catalog.operations).toEqual(["view_detail"]);
      expect((await settle(getCatalog(catalog.id)))?.operations).toEqual(["view_detail"]);
    }
    expect(await settle(getCatalog("missing-catalog"))).toBeNull();
    expect(getMock).not.toHaveBeenCalled();
  });

  it("preserves summary-only visibility without granting detail access", async () => {
    const { listCatalogs, getCatalog } = await import("./catalog.service");
    const { items } = await settle(listCatalogs(query));
    const summary = items.find((catalog) => catalog.id === "cat-009");
    const detail = await settle(getCatalog("cat-009"));
    expect(summary?.operations).toEqual(["view_summary"]);
    expect(detail?.operations).toEqual(["view_summary"]);
    expect(isCatalogSummaryOnly(summary)).toBe(true);
    expect(isCatalogSummaryOnly(detail)).toBe(true);
  });

  it("does not mutate administrator or restricted catalog fixtures after viewer reads", async () => {
    const { listCatalogs, getCatalog } = await import("./catalog.service");
    const { getMockCatalogs } = await import("./catalog-mock");
    const original = structuredClone(getMockCatalogs());
    await settle(listCatalogs(query));
    await settle(getCatalog("cat-001"));
    vi.stubEnv("VITE_MOCK_USER", "admin");
    const { items } = await settle(listCatalogs(query));
    for (const catalog of items) {
      const fixture = original.find((item) => item.id === catalog.id);
      expect(catalog.operations).toEqual(fixture?.operations);
      expect((await settle(getCatalog(catalog.id)))?.operations).toEqual(fixture?.operations);
    }
    expect(items.find((catalog) => catalog.id === "cat-008")?.operations).toEqual(["view_detail"]);
    expect(getMockCatalogs()).toEqual(original);
  });

  it("retains server operations in real-backend mode even with the viewer selector", async () => {
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockResolvedValue({
      data: {
        entries: [
          {
            id: "server-catalog",
            name: "Server catalog",
            type: "physical",
            connector_type: "postgresql",
            operations: [
              "view_detail",
              "modify",
              "delete",
              "authorize",
              "task_manage",
              "query_data",
              "resource_manage",
            ],
          },
        ],
        total_count: 1,
      },
    });
    const { listCatalogs, getCatalog } = await import("./catalog.service");
    const { items } = await listCatalogs(query);
    const record = await getCatalog("server-catalog");
    expect(items[0].operations).toEqual([
      "view_detail",
      "modify",
      "delete",
      "authorize",
      "task_manage",
      "query_data",
      "resource_manage",
    ]);
    expect(record?.operations).toEqual(items[0].operations);
    expect(getMock).toHaveBeenCalledTimes(2);
  });
});
