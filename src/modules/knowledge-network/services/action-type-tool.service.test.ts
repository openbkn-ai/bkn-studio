/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const executionFactoryMocks = vi.hoisted(() => ({
  getMcpMarket: vi.fn(),
  getToolDetail: vi.fn(),
  getToolbox: vi.fn(),
  getToolboxMarket: vi.fn(),
  listMcpMarket: vi.fn(),
  listMcpTools: vi.fn(),
  listToolboxMarket: vi.fn(),
  listTools: vi.fn(),
}));

vi.mock("@/modules/execution-factory/services/mcp.service", () => ({
  getMcpMarket: executionFactoryMocks.getMcpMarket,
  listMcpMarket: executionFactoryMocks.listMcpMarket,
  listMcpTools: executionFactoryMocks.listMcpTools,
}));

vi.mock("@/modules/execution-factory/services/tool.service", () => ({
  getToolDetail: executionFactoryMocks.getToolDetail,
  listTools: executionFactoryMocks.listTools,
}));

vi.mock("@/modules/execution-factory/services/toolbox.service", () => ({
  getToolbox: executionFactoryMocks.getToolbox,
  getToolboxMarket: executionFactoryMocks.getToolboxMarket,
  listToolboxMarket: executionFactoryMocks.listToolboxMarket,
}));

async function resolveWithMockCatalog(
  source: Parameters<
    typeof import("./action-type-tool.service").resolveActionTypeActionSourceDisplay
  >[0],
) {
  const { resolveActionTypeActionSourceDisplay } = await import(
    "./action-type-tool.service"
  );
  const promise = resolveActionTypeActionSourceDisplay(source);
  await vi.advanceTimersByTimeAsync(200);
  return promise;
}

describe("resolveActionTypeActionSourceDisplay", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "true");
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("resolves toolbox and tool names when only persisted IDs are available", async () => {
    const result = await resolveWithMockCatalog({
      boxId: "box-risk",
      toolId: "block_order_tool",
      type: "tool",
    });

    expect(result).toMatchObject({
      boxId: "box-risk",
      boxName: "Risk Tools",
      toolId: "block_order_tool",
      toolName: "Block Order",
      type: "tool",
    });
  });

  it("resolves MCP server name without changing the persisted tool name", async () => {
    const { MOCK_EXECUTION_FACTORY_CATALOG } = await import(
      "@/modules/knowledge-network/services/mock/action-type-tool-catalog"
    );
    const result = await resolveWithMockCatalog({
      mcpId: "mcp-filesystem",
      toolName: "read_file",
      type: "mcp",
    });

    expect(result).toMatchObject({
      mcpId: "mcp-filesystem",
      mcpName: MOCK_EXECUTION_FACTORY_CATALOG.mcpServers[0]?.mcpName,
      toolName: "read_file",
      type: "mcp",
    });
  });

  it("keeps IDs as a degraded display when the source cannot be resolved", async () => {
    const source = {
      boxId: "missing-box",
      toolId: "missing-tool",
      type: "tool" as const,
    };

    await expect(resolveWithMockCatalog(source)).resolves.toEqual(source);
  });

  it("falls back to toolbox and tool detail APIs when catalog lists miss persisted IDs", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");

    executionFactoryMocks.listToolboxMarket.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 100,
      total: 0,
    });
    executionFactoryMocks.listMcpMarket.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 100,
      total: 0,
    });
    executionFactoryMocks.listTools.mockResolvedValue({
      boxId: "box-direct",
      items: [],
      page: 1,
      pageSize: 100,
      total: 0,
    });
    executionFactoryMocks.getToolboxMarket.mockRejectedValue(new Error("not in market"));
    executionFactoryMocks.getToolbox.mockResolvedValue({
      boxId: "box-direct",
      name: "Direct Toolbox",
      status: "published",
    });
    executionFactoryMocks.getToolDetail.mockResolvedValue({
      name: "Direct Tool",
      toolId: "tool-direct",
    });

    const { resolveActionTypeActionSourceDisplay } = await import(
      "./action-type-tool.service"
    );

    await expect(
      resolveActionTypeActionSourceDisplay({
        boxId: "box-direct",
        toolId: "tool-direct",
        type: "tool",
      }),
    ).resolves.toMatchObject({
      boxId: "box-direct",
      boxName: "Direct Toolbox",
      toolId: "tool-direct",
      toolName: "Direct Tool",
      type: "tool",
    });
  });

  it("times out display resolution when action source lookup is slow", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");

    executionFactoryMocks.getToolbox.mockReturnValue(new Promise(() => {}));
    executionFactoryMocks.getToolDetail.mockReturnValue(new Promise(() => {}));

    const { resolveActionTypeActionSourceDisplayWithTimeout } = await import(
      "./action-type-tool.service"
    );

    const promise = resolveActionTypeActionSourceDisplayWithTimeout(
      {
        boxId: "box-timeout",
        toolId: "tool-timeout",
        type: "tool",
      },
      100,
    );

    const expectation = expect(promise).rejects.toThrow(
      "Action source display resolution timed out",
    );
    await vi.advanceTimersByTimeAsync(100);
    await expectation;
  });
});
