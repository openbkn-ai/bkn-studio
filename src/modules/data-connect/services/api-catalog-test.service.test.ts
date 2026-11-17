/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiCatalogTestResource } from "./api-catalog-test.service";

const getMock = vi.hoisted(() => vi.fn());
vi.mock("@/framework/request/http", () => ({ http: { get: getMock } }));

const backendResource = {
  id: "resource-1",
  name: "Orders",
  catalog_id: "catalog-1",
  category: "api",
  api_effect_type: "read",
  enabled: true,
  status: "active",
  operations: ["view_detail", "query_data"],
};

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_USE_MOCK", "false");
  getMock.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("API Catalog Resource test candidates", () => {
  it("requests scoped server pagination/search without unsupported effect or permission filters", async () => {
    const { listApiCatalogTestResources } = await import("./api-catalog-test.service");
    const controller = new AbortController();
    getMock.mockResolvedValue({ data: { entries: [backendResource], total_count: 41 } });
    const result = await listApiCatalogTestResources("catalog-1", {
      keyword: "  Order  ",
      page: 3,
      pageSize: 10,
      signal: controller.signal,
    });
    expect(getMock).toHaveBeenCalledWith("/vega-backend/v1/resources", {
      skipErrorToast: true,
      params: {
        catalog_id: "catalog-1",
        category: "api",
        name: "Order",
        offset: 20,
        limit: 10,
        sort: "name",
        direction: "asc",
      },
      signal: controller.signal,
    });
    expect(result).toEqual({
      items: [
        {
          id: "resource-1",
          name: "Orders",
          catalogId: "catalog-1",
          category: "api",
          effectType: "read",
          enabled: true,
          status: "active",
          operations: ["view_detail", "query_data"],
        },
      ],
      total: 41,
    });
  });

  it("preserves non-callable categories, effects and statuses instead of fabricating eligible candidates", async () => {
    const { listApiCatalogTestResources, canTestApiCatalogResource } =
      await import("./api-catalog-test.service");
    getMock.mockResolvedValue({
      data: {
        entries: [
          { ...backendResource, category: "table" },
          { ...backendResource, api_effect_type: "write" },
          { ...backendResource, status: "stale" },
          { ...backendResource, enabled: false },
          { ...backendResource, operations: [] },
        ],
        total_count: 5,
      },
    });
    const result = await listApiCatalogTestResources("catalog-1");
    expect(result.items.map((item) => [item.category, item.effectType, item.status])).toEqual([
      ["table", "read", "active"],
      ["api", "write", "active"],
      ["api", "read", "stale"],
      ["api", "read", "active"],
      ["api", "read", "active"],
    ]);
    expect(result.items.every((item) => !canTestApiCatalogResource(item, "catalog-1"))).toBe(true);
  });

  it("fails closed when the backend permission collection is malformed", async () => {
    const { listApiCatalogTestResources, canTestApiCatalogResource } =
      await import("./api-catalog-test.service");
    getMock.mockResolvedValue({
      data: {
        entries: [
          { ...backendResource, operations: "query_data" },
          { ...backendResource, operations: ["query_data", 1] },
        ],
        total_count: 2,
      },
    });
    const result = await listApiCatalogTestResources("catalog-1");
    expect(result.items.map((resource) => resource.operations)).toEqual([[], []]);
    expect(
      result.items.every((resource) => !canTestApiCatalogResource(resource, "catalog-1")),
    ).toBe(true);
  });

  it("uses defaults and omits an empty search name", async () => {
    const { listApiCatalogTestResources } = await import("./api-catalog-test.service");
    getMock.mockResolvedValue({ data: { entries: [], total_count: 0 } });
    await listApiCatalogTestResources("catalog-1", { keyword: "   " });
    expect(getMock).toHaveBeenCalledWith("/vega-backend/v1/resources", {
      params: {
        catalog_id: "catalog-1",
        category: "api",
        name: undefined,
        offset: 0,
        limit: 20,
        sort: "name",
        direction: "asc",
      },
      signal: undefined,
      skipErrorToast: true,
    });
  });

  it("refreshes details from entries[0] with the original paging rule and permission boundary", async () => {
    const { getApiCatalogTestResource } = await import("./api-catalog-test.service");
    const paging = {
      mode: "offset",
      request: { limit: { value: 0 } },
      response: { total: "total" },
    };
    const controller = new AbortController();
    getMock.mockResolvedValue({
      data: { entries: [{ ...backendResource, api_definition: { paging_rule: paging } }] },
    });
    const result = await getApiCatalogTestResource("resource/with space", {
      signal: controller.signal,
    });
    expect(getMock).toHaveBeenCalledWith("/vega-backend/v1/resources/resource%2Fwith%20space", {
      signal: controller.signal,
      skipErrorToast: true,
    });
    expect(result?.pagingRule).toBe(paging);
    expect(result?.operations).toEqual(["view_detail", "query_data"]);
  });

  it("returns null for an empty detail response and fails closed for missing summary fields", async () => {
    const { getApiCatalogTestResource, canTestApiCatalogResource } =
      await import("./api-catalog-test.service");
    getMock.mockResolvedValueOnce({ data: { entries: [] } });
    expect(await getApiCatalogTestResource("missing")).toBeNull();
    getMock.mockResolvedValueOnce({ data: { entries: [{ id: "legacy", name: "Legacy" }] } });
    const resource = await getApiCatalogTestResource("legacy");
    expect(resource).toMatchObject({
      catalogId: "",
      category: "",
      effectType: "",
      enabled: false,
      status: "",
      operations: [],
    });
    expect(canTestApiCatalogResource(resource!, "catalog-1")).toBe(false);
  });

  it("requires every eligibility boundary without inferring read effect from the method", async () => {
    const { canTestApiCatalogResource } = await import("./api-catalog-test.service");
    const resource: ApiCatalogTestResource = {
      id: "r",
      name: "Read-only POST",
      catalogId: "c",
      category: "api",
      effectType: "read",
      enabled: true,
      status: "active",
      operations: ["query_data"],
    };
    expect(canTestApiCatalogResource(resource, "c")).toBe(true);
    for (const patch of [
      { catalogId: "other" },
      { category: "API" },
      { effectType: "" },
      { effectType: "write" },
      { enabled: false },
      { status: "stale" },
      { status: "enabled" },
      { operations: ["resource_manage"] },
    ]) {
      expect(canTestApiCatalogResource({ ...resource, ...patch }, "c")).toBe(false);
    }
  });

  it("accepts the existing wildcard operation without relaxing other Resource boundaries", async () => {
    const { canTestApiCatalogResource } = await import("./api-catalog-test.service");
    const resource: ApiCatalogTestResource = {
      id: "r",
      name: "Orders",
      catalogId: "c",
      category: "api",
      effectType: "read",
      enabled: true,
      status: "active",
      operations: ["*"],
    };
    expect(canTestApiCatalogResource(resource, "c")).toBe(true);
    for (const patch of [
      { catalogId: "other" },
      { category: "table" },
      { effectType: "write" },
      { enabled: false },
      { status: "stale" },
      { operations: [] },
    ]) {
      expect(canTestApiCatalogResource({ ...resource, ...patch }, "c")).toBe(false);
    }
  });

  it("does not request a candidate page or detail after cancellation", async () => {
    const { listApiCatalogTestResources, getApiCatalogTestResource } =
      await import("./api-catalog-test.service");
    const controller = new AbortController();
    const reason = new DOMException("Cancelled", "AbortError");
    controller.abort(reason);
    await expect(listApiCatalogTestResources("c", { signal: controller.signal })).rejects.toBe(
      reason,
    );
    await expect(getApiCatalogTestResource("r", { signal: controller.signal })).rejects.toBe(
      reason,
    );
    expect(getMock).not.toHaveBeenCalled();
  });

  it("preserves request failures and rejects cancellation that arrives before mapping the response", async () => {
    const { listApiCatalogTestResources, getApiCatalogTestResource } =
      await import("./api-catalog-test.service");
    const forbidden = new Error("Forbidden");
    getMock.mockRejectedValueOnce(forbidden);
    await expect(listApiCatalogTestResources("c")).rejects.toBe(forbidden);
    const controller = new AbortController();
    const reason = new DOMException("Cancelled", "AbortError");
    getMock.mockImplementationOnce(() => {
      controller.abort(reason);
      return Promise.resolve({ data: { entries: [backendResource] } });
    });
    await expect(getApiCatalogTestResource("r", { signal: controller.signal })).rejects.toBe(
      reason,
    );
  });

  it("keeps mock mode free of fabricated business candidates and HTTP calls", async () => {
    vi.stubEnv("VITE_USE_MOCK", "true");
    const { listApiCatalogTestResources, getApiCatalogTestResource } =
      await import("./api-catalog-test.service");
    expect(await listApiCatalogTestResources("c")).toEqual({ items: [], total: 0 });
    expect(await getApiCatalogTestResource("r")).toBeNull();
    expect(getMock).not.toHaveBeenCalled();
  });
});
