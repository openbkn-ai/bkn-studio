/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerQuickApi } from "@/modules/execution-factory/services/quick-api.service";
import { createTool } from "@/modules/execution-factory/services/tool.service";
import {
  createToolbox,
  getToolbox,
  listToolboxes,
} from "@/modules/execution-factory/services/toolbox.service";
import { listTools } from "@/modules/execution-factory/services/tool.service";

vi.mock("@/modules/execution-factory/services/capability-bundle.service", () => ({
  registerOpenApiBundle: vi.fn(),
}));

vi.mock("@/modules/execution-factory/services/toolbox.service", () => ({
  createToolbox: vi.fn(),
  getToolbox: vi.fn(),
  listToolboxes: vi.fn(),
}));

vi.mock("@/modules/execution-factory/services/tool.service", () => ({
  createTool: vi.fn(),
  listTools: vi.fn(),
}));

const openapiSpec = JSON.stringify({
  info: { title: "Quick Add Test", version: "1.0.0" },
  openapi: "3.0.3",
  servers: [{ url: "http://127.0.0.1:8095" }],
  paths: {
    "/health": {
      get: {
        operationId: "health",
        responses: {
          "200": { description: "OK" },
        },
        summary: "Health",
      },
    },
  },
});

describe("registerQuickApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createToolbox).mockResolvedValue({
      boxId: "box-1",
      name: "Quick API Box",
      status: "unpublish",
      toolCount: 0,
    });
    vi.mocked(createTool).mockResolvedValue({
      failureCount: 0,
      failures: [],
      successCount: 1,
      successIds: ["tool-1"],
    });
    vi.mocked(getToolbox).mockResolvedValue({
      boxId: "box-1",
      name: "Quick API Box",
      status: "unpublish",
      toolCount: 1,
    });
    vi.mocked(listToolboxes).mockResolvedValue({
      items: [
        {
          boxId: "box-1",
          name: "Quick API Box",
          status: "unpublish",
          toolCount: 1,
        },
      ],
      page: 1,
      pageSize: 100,
      total: 1,
    });
    vi.mocked(listTools).mockResolvedValue({
      boxId: "box-1",
      items: [{ name: "Health", status: "disabled", toolId: "tool-1" }],
      page: 1,
      pageSize: 100,
      total: 1,
    });
  });

  it("returns only after the created toolbox and tool are readable", async () => {
    await expect(
      registerQuickApi({
        openapiSpec,
        serviceUrl: "http://127.0.0.1:8095",
        toolDescription: "Health check endpoint",
        toolName: "health_check",
        toolboxName: "Quick API Box",
      }),
    ).resolves.toEqual({ boxId: "box-1", toolIds: ["tool-1"] });

    expect(createTool).toHaveBeenCalledWith(
      "box-1",
      expect.objectContaining({
        description: "Health check endpoint",
        name: "health_check",
        openapiSpec,
      }),
    );
    expect(listToolboxes).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: "Quick API Box" }),
    );
    expect(listTools).toHaveBeenCalledWith(
      "box-1",
      expect.objectContaining({ all: true }),
    );
  });

  it("uses the selected existing toolbox without creating a new one", async () => {
    await expect(
      registerQuickApi({
        boxId: "box-1",
        openapiSpec,
        serviceUrl: "http://127.0.0.1:8095",
        toolboxMode: "existing",
      }),
    ).resolves.toEqual({ boxId: "box-1", toolIds: ["tool-1"] });

    expect(createToolbox).not.toHaveBeenCalled();
    expect(createTool).toHaveBeenCalledWith("box-1", expect.any(Object));
  });

  it("does not silently create a toolbox when existing mode has no box id", async () => {
    await expect(
      registerQuickApi({
        openapiSpec,
        serviceUrl: "http://127.0.0.1:8095",
        toolboxMode: "existing",
        toolboxName: "Should Not Be Created",
      }),
    ).rejects.toThrow("未提交工具集 ID");

    expect(createToolbox).not.toHaveBeenCalled();
    expect(createTool).not.toHaveBeenCalled();
  });

  it("does not return a navigable result when the created tool is not persisted", async () => {
    vi.mocked(listTools).mockResolvedValue({
      boxId: "box-1",
      items: [],
      page: 1,
      pageSize: 100,
      total: 0,
    });

    await expect(
      registerQuickApi({
        openapiSpec,
        serviceUrl: "http://127.0.0.1:8095",
        toolboxName: "Quick API Box",
      }),
    ).rejects.toThrow("Tool creation was not persisted");
  });

  it("returns a navigable result when detail is readable even if toolbox list lags", async () => {
    vi.mocked(listToolboxes).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 100,
      total: 0,
    });

    await expect(
      registerQuickApi({
        openapiSpec,
        serviceUrl: "http://127.0.0.1:8095",
        toolboxName: "Quick API Box",
      }),
    ).resolves.toEqual({ boxId: "box-1", toolIds: ["tool-1"] });
  });
});
