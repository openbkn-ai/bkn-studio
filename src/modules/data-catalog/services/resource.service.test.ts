/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const postMock = vi.hoisted(() => vi.fn());
const getMock = vi.hoisted(() => vi.fn());
const putMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock, post: postMock, put: putMock },
}));

describe("resource.service · previewCatalogResource", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses Vega paging and the GET method override", async () => {
    postMock.mockResolvedValue({
      data: { query_source: "local_index", entries: [{ id: "r-1" }], total_count: 42 },
    });
    const { previewCatalogResource } =
      await import("@/modules/data-catalog/services/resource.service");
    const { transformPrecisionSafeJSONResponse } =
      await import("@/framework/request/precision-safe-json");

    const result = await previewCatalogResource("r-1", { limit: 10, offset: 20 });

    expect(postMock).toHaveBeenCalledWith(
      "/vega-backend/v1/resources/r-1/data",
      {
        need_total: true,
        paging: { limit: 10, mode: "single", offset: 20 },
      },
      {
        headers: { "X-HTTP-Method-Override": "GET" },
        skipErrorToast: true,
        transformResponse: transformPrecisionSafeJSONResponse,
      },
    );
    expect(result).toEqual({ querySource: "local_index", rows: [{ id: "r-1" }], total: 42 });
  });

  it("preserves an unsafe int64 preview total", async () => {
    postMock.mockImplementation(
      (_url: string, _body: unknown, config: { transformResponse?: (data: unknown) => unknown }) =>
        Promise.resolve({
          data: config.transformResponse?.(
            '{"query_source":"source","entries":[],"total_count":9007199254740993}',
          ),
        }),
    );
    const { previewCatalogResource } =
      await import("@/modules/data-catalog/services/resource.service");

    const result = await previewCatalogResource("r-1", { limit: 10, offset: 0 });

    expect(result.total).toBe("9007199254740993");
  });

  it("requests Binary content only when the caller forces the original source", async () => {
    postMock.mockResolvedValue({ data: { query_source: "source", entries: [], total_count: 0 } });
    const { previewCatalogResource } =
      await import("@/modules/data-catalog/services/resource.service");

    await previewCatalogResource("r-1", {
      binaryMode: "content",
      ignoreLocalIndex: true,
      limit: 10,
      offset: 0,
    });

    expect(postMock.mock.calls[0]?.[1]).toMatchObject({
      binary_mode: "content",
      ignore_local_index: true,
    });
  });

  it("varies mock Binary content between source rows", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "true");
    const { previewCatalogResource } =
      await import("@/modules/data-catalog/services/resource.service");

    const result = await previewCatalogResource("res-customers", {
      binaryMode: "content",
      ignoreLocalIndex: true,
      limit: 2,
      offset: 1,
    });
    const first = result.rows[0]?.attachment_blob as { byte_length: number; data: string };
    const second = result.rows[1]?.attachment_blob as { byte_length: number; data: string };

    expect(first.byte_length).toBeGreaterThanOrEqual(10);
    expect(first.byte_length).toBeLessThanOrEqual(60);
    expect(second.byte_length).toBeGreaterThanOrEqual(10);
    expect(second.byte_length).toBeLessThanOrEqual(60);
    expect(first.byte_length).not.toBe(second.byte_length);
    expect(first.data).not.toBe(second.data);
  });

  it("returns unavailable Other values from a local-index mock preview", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "true");
    const { previewCatalogResource } =
      await import("@/modules/data-catalog/services/resource.service");

    const result = await previewCatalogResource("res-customers", { limit: 1, offset: 0 });

    expect(result.querySource).toBe("local_index");
    expect(result.rows[0]?.legacy_profile).toEqual({ mode: "unavailable" });
  });

  it("returns representative Other values from an original-source mock preview", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "true");
    const { previewCatalogResource } =
      await import("@/modules/data-catalog/services/resource.service");

    const result = await previewCatalogResource("res-index-config-demo", {
      ignoreLocalIndex: true,
      limit: 2,
      offset: 0,
    });

    expect(result.querySource).toBe("source");
    expect(result.rows[0]?.location).toEqual({
      data: { x: 116.4, y: 39.9 },
      mode: "content",
    });
    expect(result.rows[1]?.location).toEqual({
      data: { x: 116.41000000000001, y: 39.91 },
      mode: "content",
    });
    expect(result.rows[0]?.service_area).toEqual({
      data: "POLYGON((116.0 39.0,116.1 39.0,116.1 39.1,116.0 39.1,116.0 39.0))",
      mode: "content",
    });
  });

  it("returns Binary metadata when a source mock resource has no local index name", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "true");
    const { mockResources } = await import("@/modules/data-catalog/services/mock-db");
    const customer = mockResources.find((resource) => resource.id === "res-customers")!;
    const localIndexName = customer.localIndexName;
    customer.localIndexName = undefined;

    try {
      const { previewCatalogResource } =
        await import("@/modules/data-catalog/services/resource.service");
      const result = await previewCatalogResource("res-customers", {
        binaryMode: "metadata",
        limit: 2,
        offset: 1,
      });

      expect(result.querySource).toBe("source");
      const binaryValue = result.rows[0]?.attachment_blob as {
        byte_length?: unknown;
        mode?: unknown;
      };
      expect(binaryValue).toMatchObject({
        mode: "metadata",
      });
      expect(binaryValue.byte_length).toEqual(expect.any(Number));
    } finally {
      customer.localIndexName = localIndexName;
    }
  });
});

describe("resource.service · listCatalogResourcePage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
    putMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("omits detail-only schema and scale fields in mock list responses", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "true");
    const { listCatalogResourcePage } =
      await import("@/modules/data-catalog/services/resource.service");

    const result = await listCatalogResourcePage({ limit: 1 });

    expect(result.items[0]).toMatchObject({
      columnCount: null,
      indexConfig: undefined,
      rowCount: null,
      schema: [],
      sourceMetadata: undefined,
    });
  });

  it("sends schema to the server so totals and pages are filtered consistently", async () => {
    getMock.mockResolvedValue({
      data: {
        entries: [
          {
            catalog_id: "cat-1",
            category: "table",
            id: "res-1",
            last_discover_status: "error",
            index_name: "bkn_res-1",
            local_status: "available",
            name: "orders",
            operations: ["view_detail", "query_data"],
            schema: "external_data",
            status: "stale",
            status_message: "discover metadata failed",
            update_time: 123,
          },
        ],
        total_count: 21,
      },
    });
    const { listCatalogResourcePage } =
      await import("@/modules/data-catalog/services/resource.service");

    const result = await listCatalogResourcePage({
      catalogId: "cat-1",
      direction: "desc",
      limit: 10,
      offset: 10,
      schema: "external_data",
      sort: "name",
    });

    expect(getMock).toHaveBeenCalledWith("/vega-backend/v1/resources", {
      params: {
        catalog_id: "cat-1",
        category: undefined,
        direction: "desc",
        limit: 10,
        name: undefined,
        offset: 10,
        schema: "external_data",
        sort: "name",
      },
    });
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          columnCount: null,
          id: "res-1",
          expectedUpdateTime: 123,
          lastDiscoverStatus: "error",
          localIndexName: "bkn_res-1",
          localIndexStatus: "available",
          operations: ["view_detail", "query_data"],
          rowCount: null,
          schemaName: "external_data",
          status: "stale",
          statusMessage: "discover metadata failed",
          enabled: true,
        }),
      ],
      total: 21,
    });
    expect(result.items[0]?.updateTime).not.toBe("");
  });

  it("preserves missing operations for fail-closed authorization checks", async () => {
    getMock.mockResolvedValue({
      data: {
        entries: [{ catalog_id: "cat-1", id: "res-1", name: "orders", update_time: 123 }],
        total_count: 1,
      },
    });
    const { listCatalogResourcePage } =
      await import("@/modules/data-catalog/services/resource.service");

    const result = await listCatalogResourcePage({ catalogId: "cat-1", limit: 10, offset: 0 });

    expect(result.items[0]?.operations).toBeUndefined();
  });
});

describe("resource.service · discovery and enabled actions", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
    postMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses dedicated endpoints for resource metadata refresh and enablement", async () => {
    postMock
      .mockResolvedValueOnce({ data: { id: "task-1" } })
      .mockResolvedValue({ data: undefined });
    getMock.mockResolvedValue({
      data: {
        entries: [{ catalog_id: "cat-1", enabled: false, id: "res-1", name: "orders" }],
      },
    });
    const { discoverCatalogResource, setCatalogResourceEnabled } =
      await import("@/modules/data-catalog/services/resource.service");

    await expect(discoverCatalogResource("res-1")).resolves.toEqual({ id: "task-1" });
    await setCatalogResourceEnabled("res-1", false);

    expect(postMock).toHaveBeenNthCalledWith(1, "/vega-backend/v1/resources/res-1/discover");
    expect(postMock).toHaveBeenNthCalledWith(2, "/vega-backend/v1/resources/res-1/disable");
  });
});

describe("resource.service · getCatalogResources", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the same index fields for detail responses", async () => {
    getMock.mockResolvedValue({
      data: {
        entries: [
          {
            catalog_id: "cat-1",
            category: "table",
            id: "res-1",
            index_name: "bkn_res-1",
            index_config: {
              default_keyword_ignore_above: 512,
              incremental_fields: ["updated_at", "revision"],
              primary_key_fields: ["tenant_id", "order_id"],
            },
            local_status: "available",
            name: "orders",
            operations: ["view_detail", "query_data"],
            row_count: 42,
            estimated_row_count: 41,
            source_metadata: {
              foreign_keys: [{ name: "fk_orders_customer" }],
              indices: [{ name: "PRIMARY" }, { name: "idx_orders_updated_at" }],
              original_description: "Orders from the source database",
              original_name: "public.orders",
              properties: { row_count: 999 },
              primary_keys: ["tenant_id", "order_id"],
              table_type: "table",
            },
          },
        ],
      },
    });
    const { getCatalogResources } =
      await import("@/modules/data-catalog/services/resource.service");

    await expect(getCatalogResources(["res-1"])).resolves.toEqual([
      expect.objectContaining({
        indexConfig: {
          defaultKeywordIgnoreAbove: 512,
          incrementalFields: ["updated_at", "revision"],
          primaryKeyFields: ["tenant_id", "order_id"],
        },
        localIndexName: "bkn_res-1",
        localIndexStatus: "available",
        operations: ["view_detail", "query_data"],
        rowCount: 42,
        estimatedRowCount: 41,
        sourceMetadata: {
          foreignKeyCount: 1,
          indexCount: 2,
          objectType: "table",
          originalDescription: "Orders from the source database",
          originalName: "public.orders",
          primaryKeys: ["tenant_id", "order_id"],
        },
      }),
    ]);
  });

  it("preserves an unsafe int64 row count from detail responses", async () => {
    const rowCount = "9007199254740993";
    getMock.mockImplementation(
      (_: string, config: { transformResponse?: (data: unknown) => unknown }) =>
        Promise.resolve({
          data: config.transformResponse?.(
            `{"entries":[{"catalog_id":"cat-1","category":"table","id":"res-1","name":"orders","row_count":${rowCount}}]}`,
          ),
        }),
    );
    const { getCatalogResources } =
      await import("@/modules/data-catalog/services/resource.service");
    const { transformPrecisionSafeJSONResponse } =
      await import("@/framework/request/precision-safe-json");

    const [resource] = await getCatalogResources(["res-1"]);

    expect(getMock).toHaveBeenCalledWith("/vega-backend/v1/resources/res-1", {
      skipErrorToast: true,
      transformResponse: transformPrecisionSafeJSONResponse,
    });
    expect(resource?.rowCount).toBe(rowCount);
  });

  it("preserves an unsafe int64 estimated row count when the exact count is missing", async () => {
    const estimatedRowCount = "9007199254740993";
    getMock.mockImplementation(
      (_: string, config: { transformResponse?: (data: unknown) => unknown }) =>
        Promise.resolve({
          data: config.transformResponse?.(
            `{"entries":[{"catalog_id":"cat-1","category":"table","id":"res-1","name":"orders","estimated_row_count":${estimatedRowCount}}]}`,
          ),
        }),
    );
    const { getCatalogResources } =
      await import("@/modules/data-catalog/services/resource.service");

    const [resource] = await getCatalogResources(["res-1"]);

    expect(resource?.rowCount).toBeNull();
    expect(resource?.estimatedRowCount).toBe(estimatedRowCount);
  });

  it("keeps missing source index and foreign-key counts unknown", async () => {
    getMock.mockResolvedValue({
      data: {
        entries: [
          {
            catalog_id: "cat-1",
            category: "index",
            id: "res-1",
            name: "orders",
            source_metadata: { original_name: "orders-v1" },
          },
        ],
      },
    });
    const { getCatalogResources } =
      await import("@/modules/data-catalog/services/resource.service");

    const [resource] = await getCatalogResources(["res-1"]);

    expect(resource?.sourceMetadata?.foreignKeyCount).toBeUndefined();
    expect(resource?.sourceMetadata?.indexCount).toBeUndefined();
  });
});

describe("resource.service · updateCatalogResource", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
    putMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("removes self-referencing feature properties while preserving cross-field references", async () => {
    putMock.mockResolvedValue({});
    getMock.mockResolvedValue({
      data: {
        catalog_id: "cat-1",
        category: "table",
        id: "res-1",
        name: "orders",
        schema_definition: [],
      },
    });
    const { updateCatalogResource } =
      await import("@/modules/data-catalog/services/resource.service");

    await updateCatalogResource("res-1", {
      catalogId: "cat-1",
      category: "table",
      description: "",
      expectedUpdateTime: 123,
      indexConfig: {
        defaultKeywordIgnoreAbove: 512,
        incrementalFields: ["updated_at", "revision"],
        primaryKeyFields: ["tenant_id", "request_no"],
      },
      name: "orders",
      schema: [
        {
          description: "Request identifier generated by semantic understanding",
          displayName: "Request number",
          name: "request_no",
          type: "string",
          features: [
            {
              name: "fulltext",
              featureType: "fulltext",
              refProperty: "request_no",
              isNative: true,
            },
            {
              name: "linked_keyword",
              featureType: "keyword",
              refProperty: "external_keyword",
            },
          ],
        },
      ],
      sourceIdentifier: "orders",
    });

    expect(putMock).toHaveBeenCalledWith("/vega-backend/v1/resources/res-1", {
      catalog_id: "cat-1",
      category: "table",
      description: "",
      expected_update_time: 123,
      name: "orders",
      schema_definition: [
        expect.objectContaining({
          description: "Request identifier generated by semantic understanding",
          display_name: "Request number",
          features: [
            expect.not.objectContaining({ ref_property: "request_no" }),
            expect.objectContaining({ ref_property: "external_keyword" }),
          ],
        }),
      ],
      index_config: {
        default_keyword_ignore_above: 512,
        default_embedding_model: undefined,
        default_fulltext_analyzer: undefined,
        incremental_fields: ["updated_at", "revision"],
        primary_key_fields: ["tenant_id", "request_no"],
      },
      source_identifier: "orders",
    });
  });

  it("omits unsupported dataset build keys from the request", async () => {
    putMock.mockResolvedValue({});
    getMock.mockResolvedValue({
      data: {
        catalog_id: "cat-1",
        category: "dataset",
        id: "res-1",
        name: "documents",
        schema_definition: [],
      },
    });
    const { updateCatalogResource } =
      await import("@/modules/data-catalog/services/resource.service");

    await updateCatalogResource("res-1", {
      catalogId: "cat-1",
      category: "dataset",
      description: "",
      expectedUpdateTime: 123,
      indexConfig: {
        defaultKeywordIgnoreAbove: 512,
      },
      name: "documents",
      schema: [],
      sourceIdentifier: "documents",
    });

    const request = putMock.mock.calls[0]?.[1] as { index_config?: Record<string, unknown> };
    expect(request.index_config).not.toHaveProperty("primary_key_fields");
    expect(request.index_config).not.toHaveProperty("incremental_fields");
  });
});

describe("resource.service · mock update boundaries", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exposes canonical Vega operations on mock resources", async () => {
    const { getCatalogResource } = await import("@/modules/data-catalog/services/resource.service");

    const resource = await getCatalogResource("res-orders");

    expect(resource?.operations).toEqual(["view_detail", "query_data"]);
  });

  it("returns an HTTP-shaped 404 for a missing resource", async () => {
    const { updateCatalogResource } =
      await import("@/modules/data-catalog/services/resource.service");

    await expect(
      updateCatalogResource("missing-resource", {
        catalogId: "cat-001",
        category: "table",
        description: "",
        expectedUpdateTime: 1,
        name: "missing",
        schema: [],
        sourceIdentifier: "missing",
      }),
    ).rejects.toMatchObject({
      response: {
        data: { error_code: "VegaBackend.Resource.NotFound" },
        status: 404,
        statusText: "Not Found",
      },
    });
  });

  it("rejects a stale resource version without changing the resource", async () => {
    const { getCatalogResource, updateCatalogResource } =
      await import("@/modules/data-catalog/services/resource.service");
    const current = await getCatalogResource("res-orders");
    expect(current).not.toBeNull();
    if (!current) {
      return;
    }

    await expect(
      updateCatalogResource(current.id, {
        ...current,
        expectedUpdateTime: 0,
      }),
    ).rejects.toMatchObject({
      response: {
        data: { error_code: "VegaBackend.InvalidParameter.RequestBody" },
        status: 400,
      },
    });

    await expect(
      updateCatalogResource(current.id, {
        ...current,
        description: "stale update",
        expectedUpdateTime: current.expectedUpdateTime - 1,
      }),
    ).rejects.toMatchObject({ response: { status: 409 } });
    await expect(getCatalogResource(current.id)).resolves.toMatchObject({
      description: current.description,
      expectedUpdateTime: current.expectedUpdateTime,
    });
  });

  it("checks catalog and category while ignoring source identifier", async () => {
    const { getCatalogResource, updateCatalogResource } =
      await import("@/modules/data-catalog/services/resource.service");
    const current = await getCatalogResource("res-orders");
    expect(current).not.toBeNull();
    if (!current) {
      return;
    }

    await expect(
      updateCatalogResource(current.id, {
        ...current,
        catalogId: "another-catalog",
      }),
    ).rejects.toMatchObject({ response: { status: 400 } });
    await expect(
      updateCatalogResource(current.id, {
        ...current,
        category: "dataset",
      }),
    ).rejects.toMatchObject({ response: { status: 400 } });

    const updated = await updateCatalogResource(current.id, {
      ...current,
      description: "updated description",
      sourceIdentifier: "ignored.source",
    });
    expect(updated).toMatchObject({
      description: "updated description",
      sourceIdentifier: current.sourceIdentifier,
    });
  });
});
