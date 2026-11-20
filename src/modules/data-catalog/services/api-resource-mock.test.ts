/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { objectValue } from "@/shared/api-definition/model";
import {
  parsePrecisionPreservingJSON,
  transformPrecisionSafeJSONRequest,
} from "@/framework/request/precision-safe-json";
import { validateApiResourceInput } from "../lib/api-resource";

const { get, post, put } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock("@/framework/request/http", () => ({ http: { get, post, put } }));

const listId = "res-api-orders-list";
const detailId = "res-api-order-detail";
async function services() {
  return { ...(await import("./api-resource.service")), ...(await import("./resource.service")) };
}

describe("API Resource demo mocks", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("VITE_USE_MOCK", "true");
    vi.stubEnv("VITE_MOCK_EDITION", "professional");
    vi.stubEnv("VITE_MOCK_USER", "admin");
  });
  afterEach(() => {
    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("seeds two compatible resources visible in api_demo and loads full valid definitions without network requests", async () => {
    const api = await services();
    const page = await api.listCatalogResourcePage({ catalogId: "cat-api-demo", category: "api" });
    expect(page.total).toBe(2);
    expect(page.items.map((item) => item.name).sort()).toEqual(["order_detail", "orders_list"]);
    for (const item of page.items) {
      const resource = await api.getApiResource(item.id);
      expect(item.sourceIdentifier).toBe(item.id);
      expect(resource.source_identifier).toBe(resource.id);
      expect(resource.catalog_id).toBe("cat-api-demo");
      expect(resource.operations).toContain("query_data");
      expect(resource.operations).toContain("modify");
      expect(validateApiResourceInput(resource)).toBeUndefined();
      expect(resource.schema_definition.length).toBeGreaterThan(0);
    }
    expect(await api.getApiResourceConnector("http")).toEqual({
      category: "api",
      available: true,
      enabled: true,
    });
  });

  it("returns one mapped page with exact IDs, optional totals and legal empty results", async () => {
    const api = await services();
    const first = await api.queryApiResource(listId, {});
    expect(first.entries).toHaveLength(2);
    expect(first.entries[0]).toMatchObject({
      id: "9007199254740993",
      order_number: "SO-2026-001",
      total_amount: "1280.50",
    });
    expect(first).not.toHaveProperty("total_count");
    expect(first.paging).toEqual({ next_cursor: null, expires_at_sec: null });
    const last = await api.queryApiResource(listId, {
      paging: { mode: "single", offset: 2, limit: 1 },
      need_total: true,
    });
    expect(last.entries[0].order_number).toBe("SO-2026-003");
    expect(last.total_count).toBe(3);
    expect(last.paging).toEqual({ next_cursor: null, expires_at_sec: null });
    expect(
      (await api.queryApiResource(listId, { paging: { mode: "single", offset: 3, limit: 1 } }))
        .entries,
    ).toEqual([]);
  });

  it("rejects nonzero paging on an unpaged resource and accepts explicit zeros", async () => {
    const api = await services();
    for (const paging of [{ limit: 1 }, { offset: 1 }]) {
      await expect(
        api.queryApiResource(detailId, { paging: { mode: "single", ...paging } }),
      ).rejects.toMatchObject({ response: { status: 400 } });
    }
    expect(
      (await api.queryApiResource(detailId, { paging: { mode: "single", offset: 0, limit: 0 } }))
        .entries,
    ).toEqual((await api.queryApiResource(detailId, {})).entries);
  });

  it.each(["offset", "page"])(
    "uses the default limit for zero and omitted limits in %s mode",
    async (mode) => {
      const api = await services();
      if (mode === "page") {
        const previous = await api.getApiResource(listId);
        await api.saveApiResource(
          {
            ...previous,
            api_definition: {
              ...previous.api_definition,
              paging_rule: { mode, default_limit: 2, max_limit: 100, page_base: 1 },
            },
          },
          previous,
        );
      }
      const query = (limit?: number) =>
        api.queryApiResource(listId, {
          paging: { mode: "single", offset: 2, ...(limit === undefined ? {} : { limit }) },
        });
      const implicit = await query();
      expect(implicit.entries).toHaveLength(1);
      expect(await query(0)).toEqual(implicit);
    },
  );

  it("shows a read-only POST detail with variables and nested Body, and does not alias returned row data", async () => {
    const api = await services();
    const detail = await api.getApiResource(detailId);
    expect(detail.api_definition.request).toMatchObject({
      method: "POST",
      path: "orders/detail",
      body: {
        properties: { order_no: { value: "{{ order_number }}" }, context: { type: "object" } },
      },
    });
    const result = await api.queryApiResource(detailId, {});
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].items).toEqual([
      { sku: "SKU-DEMO-001", quantity: 2, unit_price: "640.25" },
    ]);
    expect(result).not.toHaveProperty("total_count");
    expect(result.paging).toEqual({ next_cursor: null, expires_at_sec: null });
    (result.entries[0].items as Record<string, unknown>[])[0].sku = "changed";
    expect((await api.queryApiResource(detailId, {})).entries[0].items).toEqual([
      { sku: "SKU-DEMO-001", quantity: 2, unit_price: "640.25" },
    ]);
  });

  it("only returns requested totals when the saved API supports them for all successful statuses", async () => {
    const api = await services();
    await expect(api.queryApiResource(detailId, { need_total: true })).rejects.toMatchObject({
      response: { status: 400 },
    });

    const saved = await api.getApiResource(listId);
    const response = objectValue(saved.api_definition.response);
    const statuses = objectValue(response.statuses);
    await api.saveApiResource(
      {
        ...saved,
        api_definition: {
          ...saved.api_definition,
          response: {
            ...response,
            statuses: {
              ...statuses,
              "206": { ...objectValue(statuses["200"]), result_total: undefined },
            },
          },
          success_rule: {
            ...objectValue(saved.api_definition.success_rule),
            http_status: [200, 206],
          },
        },
      },
      saved,
    );
    await expect(api.queryApiResource(listId, { need_total: true })).rejects.toMatchObject({
      response: { status: 400 },
    });
    expect((await api.queryApiResource(listId, {})).entries).toHaveLength(2);
  });

  it("keeps metadata, saved versions and directory summaries consistent and rejects stale edits", async () => {
    const api = await services();
    const previous = await api.getApiResource(listId);
    const input = { ...previous, name: "renamed_orders", source_identifier: "manual-source" };
    await api.saveApiResource(input, previous);
    const current = await api.getApiResource(listId);
    expect(current.name).toBe("renamed_orders");
    expect(current.source_identifier).toBe(previous.source_identifier);
    expect(current.update_time).toBeGreaterThan(previous.update_time);
    const page = await api.listCatalogResourcePage({
      catalogId: "cat-api-demo",
      keyword: "renamed_orders",
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0].expectedUpdateTime).toBe(current.update_time);
    await expect(api.saveApiResource(previous, previous)).rejects.toMatchObject({
      response: { status: 409 },
    });
    expect((await api.getApiResource(listId)).name).toBe("renamed_orders");
  });

  it("creates a demo copy and applies saved field mappings while preserving exact schema metadata", async () => {
    const api = await services();
    const source = await api.getApiResource(listId);
    const input = {
      ...source,
      name: "orders_copy",
      schema_definition: source.schema_definition.map((field) =>
        field.name === "total_amount"
          ? {
              ...field,
              name: "amount",
              attributes: {
                ...field.attributes,
                exact_hint: parsePrecisionPreservingJSON("1234567890.123456789"),
              },
            }
          : field,
      ),
    };
    const id = await api.saveApiResource(input);
    expect(id).not.toBe(listId);
    const saved = await api.getApiResource(id);
    expect(saved.source_identifier).toBe(id);
    expect(saved.operations).toContain("modify");
    expect(transformPrecisionSafeJSONRequest(saved)).toContain('"exact_hint":1234567890.123456789');
    expect((await api.queryApiResource(id, {})).entries[0].amount).toBe("1280.50");
    expect((await api.listCatalogResourcePage({ catalogId: "cat-api-demo" })).total).toBe(3);
    saved.name = "not persisted";
    expect((await api.getApiResource(id)).name).toBe("orders_copy");
  });

  it("round-trips structured ordinary Resource variables without losing numeric precision", async () => {
    const api = await services();
    const previous = await api.getApiResource(listId);
    const precise = parsePrecisionPreservingJSON("9007199254740993.00001");
    await api.saveApiResource(
      {
        ...previous,
        api_definition: {
          ...previous.api_definition,
          variables: {
            ...objectValue(previous.api_definition.variables),
            payload: { value: { items: [null, false, precise], templateText: "{{ ignored }}" } },
          },
        },
      },
      previous,
    );
    const latest = await api.getApiResource(listId);
    expect(transformPrecisionSafeJSONRequest(latest.api_definition.variables)).toContain(
      '"payload":{"value":{"items":[null,false,9007199254740993.00001],"templateText":"{{ ignored }}"}}',
    );
  });

  it("preserves protected credentials when saving only metadata or output fields", async () => {
    const api = await services();
    const previous = await api.getApiResource(detailId);
    await api.saveApiResource(
      {
        ...previous,
        api_definition: {
          ...previous.api_definition,
          variables: {
            ...objectValue(previous.api_definition.variables),
            secret: { value: "demo-only-private-value", sensitive: true },
          },
        },
      },
      previous,
    );
    const redacted = await api.getApiResource(detailId);
    expect(objectValue(redacted.api_definition.variables).secret).toEqual({ sensitive: true });
    expect(transformPrecisionSafeJSONRequest(redacted)).not.toContain("demo-only-private-value");
    await api.saveApiResource({ ...redacted, description: "metadata edit" }, redacted);
    const latest = await api.getApiResource(detailId);
    expect(objectValue(latest.api_definition.variables).secret).toEqual({ sensitive: true });
    const { mockApiDefinitions } = await import("./mock-db");
    expect(objectValue(mockApiDefinitions.get(detailId)!.api_definition.variables).secret).toEqual({
      value: "demo-only-private-value",
      sensitive: true,
    });
    const schema = latest.schema_definition.map((field) => ({
      ...field,
      display_name: "Updated field",
    }));
    await api.saveApiResource({ ...latest, schema_definition: schema }, latest);
    expect((await api.getApiResource(detailId)).schema_definition).toMatchObject(schema);
    expect(objectValue(mockApiDefinitions.get(detailId)!.api_definition.variables).secret).toEqual({
      value: "demo-only-private-value",
      sensitive: true,
    });
  });

  it("allows display changes without query permission and validates mappings while disabled", async () => {
    const api = await services();
    const { mockResources } = await import("./mock-db");
    await api.setCatalogResourceEnabled(detailId, false);
    mockResources.find((entry) => entry.id === detailId)!.operations = ["view_detail", "modify"];
    const restricted = await api.getApiResource(detailId);
    const schema = restricted.schema_definition.map((field) => ({
      ...field,
      display_name: "Label",
    }));
    await api.saveApiResource({ ...restricted, schema_definition: schema }, restricted);
    const resource = await api.getApiResource(detailId);
    const mapped = resource.schema_definition.map((field, index) =>
      index === 0 ? { ...field, name: "new_id" } : field,
    );
    await expect(
      api.saveApiResource({ ...resource, schema_definition: mapped }, resource),
    ).rejects.toMatchObject({ response: { status: 403 } });
    mockResources.find((entry) => entry.id === detailId)!.operations = [
      "view_detail",
      "modify",
      "query_data",
    ];
    const granted = await api.getApiResource(detailId);
    await api.saveApiResource({ ...granted, schema_definition: mapped }, granted);
    expect(await api.getApiResource(detailId)).toMatchObject({
      enabled: false,
      schema_definition: mapped,
    });
  });

  it("shares enable/disable and deletion state with ordinary Resource actions", async () => {
    const api = await services();
    await api.setCatalogResourceEnabled(listId, false);
    expect((await api.getApiResource(listId)).enabled).toBe(false);
    await expect(api.queryApiResource(listId, {})).rejects.toMatchObject({
      response: { status: 403 },
    });
    await api.setCatalogResourceEnabled(listId, true);
    expect((await api.queryApiResource(listId, {})).entries).toHaveLength(2);
    await api.deleteCatalogResource(listId);
    const { mockApiDefinitions } = await import("./mock-db");
    expect(mockApiDefinitions.has(listId)).toBe(false);
    expect((await api.listCatalogResourcePage({ catalogId: "cat-api-demo" })).total).toBe(1);
    await expect(api.getApiResource(listId)).rejects.toMatchObject({ response: { status: 404 } });
  });

  it("uses effective resource grants for existing resources independently of catalog management", async () => {
    const api = await services();
    const { updateMockCatalog } = await import("@/shared/catalog/catalog-mock");
    const { mockResources } = await import("./mock-db");
    updateMockCatalog("cat-api-demo", { operations: ["view_detail"] });
    const summary = mockResources.find((resource) => resource.id === listId)!;
    summary.operations = ["view_detail", "modify", "query_data"];

    const resource = await api.getApiResource(listId);
    await expect(api.saveApiResource({ ...resource, name: "orders_copy" })).rejects.toMatchObject({
      response: { status: 403 },
    });
    await api.saveApiResource({ ...resource, description: "Edited metadata" }, resource);
    expect((await api.getApiResource(listId)).description).toBe("Edited metadata");
    expect((await api.queryApiResource(listId, {})).entries).toHaveLength(2);
    await api.setCatalogResourceEnabled(listId, false);
    await expect(api.deleteCatalogResource(listId)).rejects.toMatchObject({
      response: { status: 403 },
    });

    const current = mockResources.find((resource) => resource.id === listId)!;
    current.operations = ["view_detail", "delete"];
    const deletable = await api.getApiResource(listId);
    expect(deletable.enabled).toBe(false);
    await expect(api.saveApiResource(deletable, deletable)).rejects.toMatchObject({
      response: { status: 403 },
    });
    await expect(api.setCatalogResourceEnabled(listId, true)).rejects.toMatchObject({
      response: { status: 403 },
    });
    await api.deleteCatalogResource(listId);
    await expect(api.getApiResource(listId)).rejects.toMatchObject({ response: { status: 404 } });
  });

  it("respects mock edition, viewer permissions, disabled Catalogs and cancellation", async () => {
    const api = await services();
    const resource = await api.getApiResource(listId);
    vi.stubEnv("VITE_MOCK_EDITION", "community");
    expect((await api.getApiResourceConnector("http")).available).toBe(false);
    await expect(api.queryApiResource(listId, {})).rejects.toMatchObject({
      response: { status: 403 },
    });
    vi.stubEnv("VITE_MOCK_EDITION", "professional");
    vi.stubEnv("VITE_MOCK_USER", "viewer");
    expect((await api.getApiResource(listId)).operations).toEqual(["view_detail"]);
    await expect(api.queryApiResource(listId, {})).rejects.toMatchObject({
      response: { status: 403 },
    });
    await expect(api.saveApiResource(resource, resource)).rejects.toMatchObject({
      response: { status: 403 },
    });
    vi.stubEnv("VITE_MOCK_USER", "admin");
    const { updateMockCatalog } = await import("@/shared/catalog/catalog-mock");
    updateMockCatalog("cat-api-demo", { enabled: false, status: "disabled" });
    await expect(api.queryApiResource(listId, {})).rejects.toMatchObject({
      response: { status: 403 },
    });
    const controller = new AbortController();
    controller.abort();
    await expect(api.getApiResource(listId, controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
    await expect(api.queryApiResource(listId, {}, controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("rejects unsupported filters, paths and paging instead of returning a false success or calling upstream", async () => {
    const api = await services();
    await expect(
      api.queryApiResource(listId, { filter_condition: { operation: "and", sub_conditions: [] } }),
    ).rejects.toMatchObject({ response: { status: 400 } });
    await expect(
      api.queryApiResource(listId, { paging: { mode: "single", limit: 101 } }),
    ).rejects.toMatchObject({ response: { status: 400 } });
    await expect(
      api.queryApiResource(listId, { paging: { mode: "single", offset: -1 } }),
    ).rejects.toMatchObject({ response: { status: 400 } });
    const resource = await api.getApiResource(listId);
    await api.saveApiResource(
      {
        ...resource,
        api_definition: {
          ...resource.api_definition,
          request: { method: "GET", path: "unsupported" },
        },
      },
      resource,
    );
    await expect(api.queryApiResource(listId, {})).rejects.toMatchObject({
      response: { status: 400 },
    });
  });
});
