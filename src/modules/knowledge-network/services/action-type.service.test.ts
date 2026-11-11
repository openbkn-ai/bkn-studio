/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BackendActionTypeCreateEntry } from "./mappers/action-type.mapper";

type HttpPost = (url: string, body?: unknown, options?: unknown) => Promise<{ data: unknown }>;

const postMock = vi.hoisted(() => vi.fn<HttpPost>());
const getMock = vi.hoisted(() => vi.fn());
const putMock = vi.hoisted(() => vi.fn<HttpPost>());
const getToolboxMetadata = vi.hoisted(() => vi.fn());

function createdActionEntry(): BackendActionTypeCreateEntry {
  const body = postMock.mock.calls[0]?.[1] as
    { entries?: BackendActionTypeCreateEntry[] } | undefined;
  const entry = body?.entries?.[0];
  if (!entry) throw new Error("No action create payload was submitted");
  return entry;
}

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock, post: postMock, put: putMock },
}));

// The version on screen; each ontology-query call must carry it.
vi.mock(
  "@/modules/knowledge-network/services/shared/kn-version-context",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/modules/knowledge-network/services/shared/kn-version-context")
    >()),
    resolveKnReadParams: () => Promise.resolve({ kn_version: "draft" }),
  }),
);
vi.mock("@/modules/knowledge-network/services/action-type-tool.service", () => ({
  getActionTypeToolboxMetadataType: getToolboxMetadata,
}));

describe("action-type.service - listKnowledgeNetworkActionTypePage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
    getToolboxMetadata.mockImplementation((boxId: string) =>
      Promise.resolve(boxId === "api-box" ? "openapi" : "function"),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("pushes paging and filters to the backend", async () => {
    getMock.mockResolvedValue({
      data: {
        entries: [
          {
            action_type: "modify",
            id: "action-1",
            name: "Update order",
            object_type_id: "object-1",
          },
        ],
        total_count: 21,
      },
    });
    const { listKnowledgeNetworkActionTypePage } =
      await import("@/modules/knowledge-network/services/action-type.service");

    const result = await listKnowledgeNetworkActionTypePage("kn-1", {
      actionKind: "update",
      direction: "asc",
      limit: 10,
      namePattern: " order ",
      objectTypeId: "object-1",
      offset: 10,
      sort: "name",
    });

    expect(getMock).toHaveBeenCalledWith("/bkn-backend/v1/knowledge-networks/kn-1/action-types", {
      params: {
        action_type: "modify",
        direction: "asc",
        limit: 10,
        name_pattern: "order",
        object_type_id: "object-1",
        offset: 10,
        sort: "name",
      },
    });
    expect(result.totalCount).toBe(21);
    expect(result.entries[0]).toMatchObject({ actionKind: "update", id: "action-1" });
  });

  it("sends operation filters and trusts server paging and total", async () => {
    getMock.mockResolvedValue({
      data: {
        entries: [
          {
            id: "tool-page-2",
            name: "Notify",
            action_type: "add",
            operation_config: { type: "tool" },
          },
        ],
        total_count: 12,
      },
    });
    const service = await import("./action-type.service");
    const page = await service.listKnowledgeNetworkActionTypePage("kn-1", {
      limit: 1,
      offset: 1,
      operationKind: "tool",
    });
    expect(getMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        params: expect.objectContaining({ limit: 1, offset: 1, operation_kind: "tool" }) as unknown,
      }),
    );
    expect(page.totalCount).toBe(12);
    expect(page.entries.map((item) => item.id)).toEqual(["tool-page-2"]);
  });

  it("sends relationship operation filters before pagination", async () => {
    getMock.mockResolvedValue({
      data: {
        entries: [
          {
            id: "unlink",
            name: "Unlink",
            action_type: "delete",
            object_type_id: "orders",
            operation_config: {
              type: "relation",
              relation_type_id: "supplier",
              relation_operation: "delete",
            },
          },
        ],
        total_count: 5,
      },
    });
    const service = await import("./action-type.service");
    const page = await service.listKnowledgeNetworkActionTypePage("kn-1", {
      limit: 1,
      offset: 2,
      operationKind: "relation",
      relationOperation: "delete",
    });
    expect(getMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        params: expect.objectContaining({
          limit: 1,
          offset: 2,
          operation_kind: "relation",
          relation_operation: "delete",
        }) as unknown,
      }),
    );
    expect(page.totalCount).toBe(5);
    expect(page.entries.map((item) => item.id)).toEqual(["unlink"]);
  });

  it("filters API toolsets, function sets and MCP services before pagination", async () => {
    getMock.mockResolvedValue({
      data: {
        entries: [
          {
            id: "api-1",
            name: "First",
            action_source: { type: "tool", box_id: "api-box", tool_id: "send" },
          },
          {
            id: "other",
            name: "Other",
            action_source: { type: "tool", box_id: "other-box", tool_id: "send" },
          },
          {
            id: "api-2",
            name: "Second",
            action_source: { type: "tool", box_id: "api-box", tool_id: "send" },
          },
          {
            id: "mcp-1",
            name: "MCP",
            action_source: { type: "mcp", mcp_id: "service-1", tool_name: "send" },
          },
        ],
        total_count: 4,
      },
    });
    const { listKnowledgeNetworkActionTypePage } =
      await import("@/modules/knowledge-network/services/action-type.service");

    const toolPage = await listKnowledgeNetworkActionTypePage("kn-1", {
      executionToolCategory: "openapi",
      limit: 1,
      offset: 1,
    });
    expect(getMock).toHaveBeenCalledWith(
      "/bkn-backend/v1/knowledge-networks/kn-1/action-types",
      expect.objectContaining({
        params: expect.objectContaining({ limit: -1, offset: 0 }) as unknown,
      }),
    );
    expect(toolPage.totalCount).toBe(2);
    expect(toolPage.entries.map((entry) => entry.id)).toEqual(["api-2"]);

    const functionPage = await listKnowledgeNetworkActionTypePage("kn-1", {
      executionToolCategory: "function",
      limit: 10,
      offset: 0,
    });
    expect(functionPage.entries.map((entry) => entry.id)).toEqual(["other"]);

    const mcpPage = await listKnowledgeNetworkActionTypePage("kn-1", {
      executionToolCategory: "mcp",
      limit: 10,
      offset: 0,
    });
    expect(mcpPage.entries.map((entry) => entry.id)).toEqual(["mcp-1"]);
  });

  it("keeps object-context tool actions out of the independent graph group", async () => {
    getMock.mockResolvedValue({
      data: {
        entries: [
          {
            action_type: "add",
            id: "context-tool",
            name: "Notify customer",
            object_type_id: "customer",
            operation_config: { type: "tool" },
          },
          {
            action_type: "add",
            id: "independent-tool",
            name: "Run reconciliation",
            object_type_id: "",
            operation_config: { type: "tool" },
          },
        ],
        total_count: 2,
      },
    });
    const { listKnowledgeNetworkActionTypePage } =
      await import("@/modules/knowledge-network/services/action-type.service");

    const result = await listKnowledgeNetworkActionTypePage("kn-1", {
      independentOnly: true,
      limit: 10,
      offset: 0,
      operationKind: "tool",
    });

    expect(result.totalCount).toBe(1);
    expect(result.entries.map((entry) => entry.id)).toEqual(["independent-tool"]);
  });

  it("requests relationship operations from the server before pagination", async () => {
    getMock.mockResolvedValue({
      data: {
        entries: [
          {
            action_type: "delete",
            id: "unlink-1",
            name: "Unlink order",
            object_type_id: "orders",
            operation_config: {
              type: "relation",
              relation_type_id: "order_supplier",
              relation_operation: "delete",
            },
          },
        ],
        total_count: 1,
      },
    });
    const { listKnowledgeNetworkActionTypePage } =
      await import("@/modules/knowledge-network/services/action-type.service");

    const result = await listKnowledgeNetworkActionTypePage("kn-1", {
      limit: 1,
      offset: 0,
      operationKind: "relation",
      relationOperation: "delete",
    });

    expect(result.totalCount).toBe(1);
    expect(result.entries.map((entry) => entry.id)).toEqual(["unlink-1"]);
    const requestOptions = getMock.mock.calls[0]?.[1] as
      { params?: Record<string, unknown> } | undefined;
    expect(requestOptions?.params).toMatchObject({
      limit: 1,
      offset: 0,
      operation_kind: "relation",
      relation_operation: "delete",
    });
  });

  it("filters API toolsets, function sets and MCP services before pagination", async () => {
    getMock.mockResolvedValue({
      data: {
        entries: [
          {
            id: "api-1",
            name: "First",
            action_source: { type: "tool", box_id: "api-box", tool_id: "send" },
          },
          {
            id: "other",
            name: "Other",
            action_source: { type: "tool", box_id: "other-box", tool_id: "send" },
          },
          {
            id: "api-2",
            name: "Second",
            action_source: { type: "tool", box_id: "api-box", tool_id: "send" },
          },
          {
            id: "mcp-1",
            name: "MCP",
            action_source: { type: "mcp", mcp_id: "service-1", tool_name: "send" },
          },
        ],
        total_count: 4,
      },
    });
    const { listKnowledgeNetworkActionTypePage } =
      await import("@/modules/knowledge-network/services/action-type.service");

    const toolPage = await listKnowledgeNetworkActionTypePage("kn-1", {
      executionToolCategory: "openapi",
      limit: 1,
      offset: 1,
    });
    expect(getMock).toHaveBeenCalledWith(
      "/bkn-backend/v1/knowledge-networks/kn-1/action-types",
      expect.objectContaining({
        params: expect.objectContaining({ limit: -1, offset: 0 }) as unknown,
      }),
    );
    expect(toolPage.totalCount).toBe(2);
    expect(toolPage.entries.map((entry) => entry.id)).toEqual(["api-2"]);

    const functionPage = await listKnowledgeNetworkActionTypePage("kn-1", {
      executionToolCategory: "function",
      limit: 10,
      offset: 0,
    });
    expect(functionPage.entries.map((entry) => entry.id)).toEqual(["other"]);

    const mcpPage = await listKnowledgeNetworkActionTypePage("kn-1", {
      executionToolCategory: "mcp",
      limit: 10,
      offset: 0,
    });
    expect(mcpPage.entries.map((entry) => entry.id)).toEqual(["mcp-1"]);
  });

  it("keeps object-context tool actions out of the independent graph group", async () => {
    getMock.mockResolvedValue({
      data: {
        entries: [
          {
            action_type: "add",
            id: "context-tool",
            name: "Notify customer",
            object_type_id: "customer",
            operation_config: { type: "tool" },
          },
          {
            action_type: "add",
            id: "independent-tool",
            name: "Run reconciliation",
            object_type_id: "",
            operation_config: { type: "tool" },
          },
        ],
        total_count: 2,
      },
    });
    const { listKnowledgeNetworkActionTypePage } =
      await import("@/modules/knowledge-network/services/action-type.service");

    const result = await listKnowledgeNetworkActionTypePage("kn-1", {
      independentOnly: true,
      limit: 10,
      offset: 0,
      operationKind: "tool",
    });

    expect(result.totalCount).toBe(1);
    expect(result.entries.map((entry) => entry.id)).toEqual(["independent-tool"]);
  });
});

describe("action-type.service - new operation contract", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    postMock.mockReset();
    putMock.mockReset();
    postMock.mockResolvedValue({ data: [{ id: "a-1" }] });
    putMock.mockResolvedValue({ data: { id: "a-1" } });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("persists relationship semantics, identity bindings and condition references", async () => {
    const service = await import("./action-type.service");
    const input = {
      actionKind: "create" as const,
      color: "#1677ff",
      description: "",
      name: "Link supplier",
      objectTypeId: "orders",
      tags: [],
      operationConfig: {
        type: "relation" as const,
        relationTypeId: "order_supplier",
        relationOperation: "create" as const,
        anchorRole: "source" as const,
      },
      condition: {
        field: "amount",
        operation: ">=" as const,
        valueFrom: "input" as const,
        value: "minimum",
      },
      executionConfig: {
        sourceType: "tool" as const,
        sourceName: "Link",
        parameters: [
          { name: "order", type: "string", valueFrom: "source_identity" as const },
          { name: "supplier", type: "string", valueFrom: "target_identity" as const },
          { name: "minimum", type: "number", valueFrom: "input" as const },
        ],
      },
    };
    await service.createKnowledgeNetworkActionType("kn-1", input);
    await service.updateKnowledgeNetworkActionType("kn-1", "a-1", input);
    const created = createdActionEntry();
    expect(created.operation_config).toEqual({
      type: "relation",
      relation_type_id: "order_supplier",
      relation_operation: "create",
      anchor_role: "source",
    });
    expect(created.parameters).toEqual([
      { name: "order", type: "string", value_from: "source_identity" },
      { name: "supplier", type: "string", value_from: "target_identity" },
      { name: "minimum", type: "number", value_from: "input" },
    ]);
    expect(created.condition?.value_from).toBe("input");
    const updated = putMock.mock.calls[0][1] as BackendActionTypeCreateEntry;
    expect(updated.operation_config).toEqual(created.operation_config);
  });

  it("requires an explicit operation rather than inferring an old model", async () => {
    const service = await import("./action-type.service");
    await expect(
      service.createKnowledgeNetworkActionType("kn-1", {
        actionKind: "create",
        color: "",
        description: "",
        name: "Missing",
        objectTypeId: "",
        tags: [],
      }),
    ).rejects.toThrow("operation_config");
    expect(postMock).not.toHaveBeenCalled();
  });

  it("sends typed constants, including false and zero", async () => {
    const service = await import("./action-type.service");
    await service.createKnowledgeNetworkActionType("kn-1", {
      actionKind: "create",
      color: "",
      description: "",
      name: "Notify",
      objectTypeId: "",
      tags: [],
      operationConfig: { type: "tool" },
      executionConfig: {
        sourceType: "tool",
        sourceName: "Tool",
        parameters: [
          { name: "enabled", type: "boolean", valueFrom: "const", value: "false" },
          { name: "count", type: "integer", valueFrom: "const", value: "0" },
          { name: "text", type: "string", valueFrom: "const", value: "false" },
        ],
      },
    });
    expect(createdActionEntry().parameters?.map((item) => item.value)).toEqual([false, 0, "false"]);
    expect(createdActionEntry().operation_config).toEqual({ type: "tool" });
  });
});

describe("action-type.service - deployed operation contract", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    postMock.mockReset();
    putMock.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("persists relationship metadata, endpoint identities and referenced conditions", async () => {
    postMock.mockResolvedValue({ data: { entries: [{ id: "a-1", name: "Link supplier" }] } });
    putMock.mockResolvedValue({ data: { entries: [{ id: "a-1", name: "Link supplier" }] } });
    const service = await import("./action-type.service");
    const input = {
      actionKind: "create" as const,
      color: "#1677ff",
      description: "",
      name: "Link supplier",
      objectTypeId: "orders",
      tags: [],
      operationConfig: {
        type: "relation" as const,
        relationTypeId: "order_supplier",
        relationOperation: "create" as const,
        anchorRole: "source" as const,
        otherObjectCondition: {
          field: "status",
          operation: "==" as const,
          valueFrom: "property" as const,
          value: "required_status",
        },
      },
      condition: {
        field: "amount",
        operation: ">=" as const,
        valueFrom: "input" as const,
        value: "minimum_amount",
      },
      executionConfig: {
        sourceType: "tool" as const,
        sourceName: "Link supplier",
        parameters: [
          { name: "order_id", valueFrom: "source_identity" as const },
          { name: "supplier_id", valueFrom: "target_identity" as const },
          { name: "minimum_amount", valueFrom: "input" as const },
        ],
      },
    };

    await service.createKnowledgeNetworkActionType("kn-1", input);
    await service.updateKnowledgeNetworkActionType("kn-1", "a-1", input);

    const created = (postMock.mock.calls[0]?.[1] as { entries: Record<string, unknown>[] })
      .entries[0];
    const updated = putMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(created.operation_config).toMatchObject({
      type: "relation",
      relation_type_id: "order_supplier",
      relation_operation: "create",
      anchor_role: "source",
      other_object_condition: { value_from: "property", value: "required_status" },
    });
    expect(created.condition).toMatchObject({ value_from: "input", value: "minimum_amount" });
    expect(created.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "order_id", value_from: "source_identity" }),
        expect.objectContaining({ name: "supplier_id", value_from: "target_identity" }),
      ]),
    );
    expect(updated.operation_config).toEqual(created.operation_config);
  });

  it("rejects an older definition without an operation before updating", async () => {
    putMock.mockResolvedValue({ data: { entries: [{ id: "a-1", name: "Update" }] } });
    const service = await import("./action-type.service");
    await expect(
      service.updateKnowledgeNetworkActionType("kn-1", "a-1", {
        actionKind: "update",
        color: "#1677ff",
        description: "",
        name: "Update",
        objectTypeId: "orders",
        tags: [],
      }),
    ).rejects.toThrow("operation_config is required");
    expect(putMock).not.toHaveBeenCalled();
  });
});

describe("action-type.service - relationship configuration preview", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "true");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("retains mixed condition references through mock create, update and reload", async () => {
    const service = await import("./action-type.service");
    const condition = {
      operation: "and" as const,
      subConditions: [
        {
          field: "amount",
          operation: ">=" as const,
          valueFrom: "property" as const,
          value: "minimum",
        },
        {
          field: "amount",
          operation: ">=" as const,
          valueFrom: "input" as const,
          value: "requested",
        },
      ],
    };
    const input = {
      id: "condition-preview",
      operationConfig: { type: "object" as const },
      actionKind: "update" as const,
      color: "#1677ff",
      description: "",
      name: "Update order",
      objectTypeId: "orders",
      tags: [],
      condition,
    };
    const created = await service.createKnowledgeNetworkActionType("kn-condition-preview", input);
    expect(
      (await service.getKnowledgeNetworkActionTypeDetail("kn-condition-preview", created!.id))
        ?.condition,
    ).toEqual(condition);
    await service.updateKnowledgeNetworkActionType("kn-condition-preview", created!.id, {
      ...input,
      condition: { ...condition, operation: "or" },
    });
    expect(
      (await service.getKnowledgeNetworkActionTypeDetail("kn-condition-preview", created!.id))
        ?.condition,
    ).toEqual({ ...condition, operation: "or" });
    await service.deleteKnowledgeNetworkActionType("kn-condition-preview", created!.id);
  });

  it("retains relationship semantics in mock create, detail and list filtering", async () => {
    const service = await import("./action-type.service");
    const operationConfig = {
      type: "relation" as const,
      relationTypeId: "order_supplier",
      relationOperation: "delete" as const,
      anchorRole: "source" as const,
      otherObjectCondition: {
        objectTypeId: "suppliers",
        field: "status",
        operation: "==" as const,
        value: "active",
      },
    };
    const created = await service.createKnowledgeNetworkActionType("kn-operation-preview", {
      id: "remove-supplier",
      actionKind: "create",
      color: "#1677ff",
      description: "",
      name: "Remove supplier",
      objectTypeId: "orders",
      condition: { objectTypeId: "orders", field: "status", operation: "==", value: "open" },
      tags: [],
      operationConfig,
      executionConfig: {
        sourceType: "tool",
        sourceName: "Link supplier",
        parameters: [
          { name: "order_id", valueFrom: "source_identity" },
          { name: "supplier_id", valueFrom: "target_identity" },
        ],
      },
    });
    const detail = await service.getKnowledgeNetworkActionTypeDetail(
      "kn-operation-preview",
      created!.id,
    );
    expect(detail?.operationConfig).toEqual(operationConfig);
    expect(detail?.objectTypeId).toBe("orders");
    expect(detail?.condition).toMatchObject({ objectTypeId: "orders", value: "open" });
    expect(detail?.executionConfig.parameters.map((parameter) => parameter.valueFrom)).toEqual([
      "source_identity",
      "target_identity",
    ]);
    const page = await service.listKnowledgeNetworkActionTypePage("kn-operation-preview", {
      limit: 10,
      offset: 0,
      operationKind: "relation",
    });
    expect(page.entries.map((entry) => entry.id)).toEqual([created!.id]);
    await service.deleteKnowledgeNetworkActionType("kn-operation-preview", created!.id);
  });
});

describe("action-type.service - executeKnowledgeNetworkActionTypeNow", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    postMock.mockReset();
    postMock.mockResolvedValue({ data: { execution_id: "execution-1" } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("submits dynamic_params without the obsolete unique_identities field", async () => {
    const { executeKnowledgeNetworkActionTypeNow } =
      await import("@/modules/knowledge-network/services/action-type.service");

    await executeKnowledgeNetworkActionTypeNow("kn-1", "action-1", {
      dynamic_params: { city: "Shanghai", limit: 10 },
    });

    expect(postMock).toHaveBeenCalledWith(
      "/ontology-query/v1/knowledge-networks/kn-1/action-types/action-1/execute",
      {
        dynamic_params: {
          city: "Shanghai",
          limit: 10,
        },
      },
      expect.objectContaining({
        params: { kn_version: "draft" },
        transformRequest: expect.any(Array) as unknown,
      }),
    );
  });

  it("keeps one-click execution for action types without dynamic parameters", async () => {
    const { executeKnowledgeNetworkActionTypeNow } =
      await import("@/modules/knowledge-network/services/action-type.service");

    await executeKnowledgeNetworkActionTypeNow("kn-1", "action-1");

    expect(postMock).toHaveBeenCalledWith(
      "/ontology-query/v1/knowledge-networks/kn-1/action-types/action-1/execute",
      {},
      expect.objectContaining({
        params: { kn_version: "draft" },
        transformRequest: expect.any(Array) as unknown,
      }),
    );
  });

  it("forwards explicit directed relation targets without renaming them", async () => {
    const service = await import("./action-type.service");
    const input = {
      relation_target: {
        source_identity: { order_id: "O1" },
        target_identity: { supplier_id: "S2" },
      },
      dynamic_params: { notify: false },
    };
    await service.executeKnowledgeNetworkActionTypeNow("kn-1", "link", input);
    expect(postMock).toHaveBeenCalledWith(
      expect.stringContaining("/link/execute"),
      input,
      expect.any(Object),
    );
  });

  it("loads definition-only execution schema and rejects a missing contract", async () => {
    const service = await import("./action-type.service");
    postMock.mockResolvedValueOnce({
      data: { execution_schema: { type: "object", properties: {} } },
    });
    expect(await service.getActionTypeExecutionSchema("kn-1", "tool")).toEqual({
      type: "object",
      properties: {},
    });
    expect(postMock).toHaveBeenCalledWith(
      expect.stringContaining("/tool"),
      {},
      { headers: { "x-http-method-override": "GET" }, params: { kn_version: "draft" } },
    );
    postMock.mockResolvedValueOnce({ data: {} });
    await expect(service.getActionTypeExecutionSchema("kn-1", "old")).rejects.toThrow("schema");
  });
});

describe("action-type.service - listKnowledgeNetworkActionTypeExecutionResults", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requests one page of results filtered by status and maps it", async () => {
    getMock.mockResolvedValue({
      data: {
        entries: [
          { _display: "Order 21", duration_ms: 12, error_message: "timeout", status: "failed" },
        ],
        total_count: 3,
      },
    });
    const { listKnowledgeNetworkActionTypeExecutionResults } =
      await import("@/modules/knowledge-network/services/action-type.service");

    const page = await listKnowledgeNetworkActionTypeExecutionResults("kn-1", "exec-1", {
      limit: 20,
      offset: 20,
      status: "failed",
    });

    expect(getMock).toHaveBeenCalledWith(
      "/ontology-query/v1/knowledge-networks/kn-1/action-logs/exec-1/results",
      { params: { limit: 20, offset: 20, status: "failed" } },
    );
    expect(page).toEqual({
      entries: [
        { displayName: "Order 21", durationMs: 12, errorMessage: "timeout", status: "failed" },
      ],
      totalCount: 3,
    });
  });

  it("does not send an empty status filter", async () => {
    getMock.mockResolvedValue({ data: { entries: [], total_count: 0 } });
    const { listKnowledgeNetworkActionTypeExecutionResults } =
      await import("@/modules/knowledge-network/services/action-type.service");

    await listKnowledgeNetworkActionTypeExecutionResults("kn-1", "exec-1", {
      limit: 20,
      offset: 0,
      status: "",
    });

    expect(getMock).toHaveBeenCalledWith(expect.any(String), { params: { limit: 20, offset: 0 } });
  });

  it("resolves to null when the backend has no results endpoint, and rethrows other errors", async () => {
    const { listKnowledgeNetworkActionTypeExecutionResults } =
      await import("@/modules/knowledge-network/services/action-type.service");

    getMock.mockRejectedValueOnce({ isAxiosError: true, response: { status: 404 } });
    await expect(
      listKnowledgeNetworkActionTypeExecutionResults("kn-1", "exec-1", { limit: 20, offset: 0 }),
    ).resolves.toBeNull();

    const serverError = { isAxiosError: true, response: { status: 500 } };
    getMock.mockRejectedValueOnce(serverError);
    await expect(
      listKnowledgeNetworkActionTypeExecutionResults("kn-1", "exec-1", { limit: 20, offset: 0 }),
    ).rejects.toBe(serverError);
  });
});

describe("action-type.service - getKnowledgeNetworkActionTypeExecutionLogDetail", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps how many results the execution has beyond the embedded first page", async () => {
    getMock.mockResolvedValue({
      data: {
        id: "exec-1",
        results: [{ _display: "Order 1", status: "success" }],
        results_total: 8808,
        status: "completed",
      },
    });
    const { getKnowledgeNetworkActionTypeExecutionLogDetail } =
      await import("@/modules/knowledge-network/services/action-type.service");

    const detail = await getKnowledgeNetworkActionTypeExecutionLogDetail("kn-1", "exec-1");

    expect(detail?.results).toHaveLength(1);
    expect(detail?.resultsTotal).toBe(8808);
  });
});

describe("action-type.service - optional reads", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // The app development page reads action types as optional data: a 403 must not raise a toast.
  it("passes skipErrorToast to the list request", async () => {
    getMock.mockResolvedValue({ data: { entries: [], total_count: 0 } });
    const { listKnowledgeNetworkActionTypes } =
      await import("@/modules/knowledge-network/services/action-type.service");

    await listKnowledgeNetworkActionTypes("kn-1", { skipErrorToast: true });

    expect(getMock).toHaveBeenCalledWith(
      "/bkn-backend/v1/knowledge-networks/kn-1/action-types",
      expect.objectContaining({ skipErrorToast: true }),
    );
  });

  it("passes skipErrorToast to the detail request and its operations fallback", async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          entries: [
            { action_type: "modify", id: "action-1", name: "Update", object_type_id: "ot-1" },
          ],
        },
      })
      .mockResolvedValueOnce({ data: { entries: [{ id: "action-1", operations: ["view"] }] } });
    const { getKnowledgeNetworkActionTypeDetail } =
      await import("@/modules/knowledge-network/services/action-type.service");

    const detail = await getKnowledgeNetworkActionTypeDetail("kn-1", "action-1", {
      skipErrorToast: true,
    });

    expect(detail?.operations).toEqual(["view"]);
    expect(getMock).toHaveBeenNthCalledWith(
      1,
      "/bkn-backend/v1/knowledge-networks/kn-1/action-types/action-1",
      { skipErrorToast: true },
    );
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      "/bkn-backend/v1/knowledge-networks/kn-1/action-types",
      expect.objectContaining({ skipErrorToast: true }),
    );
  });
});
