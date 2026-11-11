/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());
vi.mock("@/framework/request/http", () => ({ http: { get: getMock } }));

async function settle<T>(result: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return result;
}

describe("catalog resource mock user operations", () => {
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

  it("projects read-only operations in list, batch detail and single detail", async () => {
    const service = await import("./resource.service");
    const page = await settle(service.listCatalogResourcePage({ limit: -1 }));
    expect(page.items.length).toBeGreaterThan(0);
    for (const resource of page.items) {
      expect(resource.operations).toEqual(["view_detail"]);
    }
    const ids = ["res-orders", "res-permission-limited-orders"];
    const records = await settle(service.getCatalogResources(ids));
    expect(records).toHaveLength(ids.length);
    expect(records.map((record) => record.operations)).toEqual([["view_detail"], ["view_detail"]]);
    expect((await settle(service.getCatalogResource(ids[0])))?.operations).toEqual(["view_detail"]);
    expect(getMock).not.toHaveBeenCalled();
  });

  it("retains administrator and restricted-fixture operations after a viewer read", async () => {
    const { getCatalogResources } = await import("./resource.service");
    const ids = ["res-orders", "res-permission-limited-orders"];
    await settle(getCatalogResources(ids));
    vi.stubEnv("VITE_MOCK_USER", "admin");
    const records = await settle(getCatalogResources(ids));
    expect(records[0].operations).toEqual(["view_detail", "query_data", "delete"]);
    expect(records[1].operations).toEqual(["view_detail"]);
  });

  it("keeps server operations unchanged in real-backend mode", async () => {
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockResolvedValue({
      data: {
        entries: [
          {
            id: "server-resource",
            name: "Server resource",
            catalog_id: "server-catalog",
            operations: ["view_detail", "query_data", "delete"],
          },
        ],
      },
    });
    const { getCatalogResource } = await import("./resource.service");
    const resource = await getCatalogResource("server-resource");
    expect(resource?.operations).toEqual(["view_detail", "query_data", "delete"]);
    expect(getMock).toHaveBeenCalled();
  });
});
