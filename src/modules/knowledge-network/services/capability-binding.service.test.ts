/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteMock = vi.hoisted(() => vi.fn());
const getMock = vi.hoisted(() => vi.fn());
const postMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { delete: deleteMock, get: getMock, post: postMock },
}));

vi.mock("@/modules/knowledge-network/services/shared/runtime", async () => {
  const actual = await vi.importActual<
    typeof import("@/modules/knowledge-network/services/shared/runtime")
  >("@/modules/knowledge-network/services/shared/runtime");

  return { ...actual, useMock: false };
});

import {
  attachKnowledgeNetworkCapabilities,
  detachKnowledgeNetworkCapabilities,
  listKnowledgeNetworkCapabilities,
} from "@/modules/knowledge-network/services/capability-binding.service";

describe("capability-binding.service", () => {
  beforeEach(() => {
    deleteMock.mockReset();
    getMock.mockReset();
    postMock.mockReset();
  });

  it("reads the owning tool box from box_id, the wire name the backend uses", async () => {
    getMock.mockResolvedValue({
      data: {
        entries: [
          {
            id: "binding-1",
            capability_type: "function",
            box_id: "box-1",
            capability_id: "tool-1",
            bound_as_box: true,
            name: "计算交期",
            owner_name: "供应链工具箱",
            status: "missing",
          },
        ],
        total_count: 1,
        metadata_available: true,
      },
    });

    const result = await listKnowledgeNetworkCapabilities("kn-1", { type: "function" });

    expect(result.entries[0]).toMatchObject({
      boundAsBox: true,
      boxId: "box-1",
      boxName: "供应链工具箱",
      capabilityId: "tool-1",
      capabilityType: "function",
      name: "计算交期",
      status: "missing",
    });
    const [path, config] = getMock.mock.calls[0] as [
      string,
      { params: Record<string, unknown> },
    ];
    expect(path).toBe("/bkn-backend/v1/knowledge-networks/kn-1/capabilities");
    expect(config.params).toMatchObject({ branch: "main", type: "function" });
  });

  it("treats a response without metadata_available as metadata being present", async () => {
    getMock.mockResolvedValue({ data: { entries: [], total_count: 0 } });

    const result = await listKnowledgeNetworkCapabilities("kn-1");

    expect(result.metadataAvailable).toBe(true);
  });

  it("sends a whole-box mount as all_tools without a capability_id", async () => {
    postMock.mockResolvedValue({ data: { entries: [{ id: "binding-1" }] } });

    await attachKnowledgeNetworkCapabilities("kn-1", [
      { allTools: true, boxId: "box-1", capabilityType: "function" },
    ]);

    expect(postMock).toHaveBeenCalledWith(
      "/bkn-backend/v1/knowledge-networks/kn-1/capabilities",
      {
        capabilities: [
          {
            all_tools: true,
            box_id: "box-1",
            capability_id: undefined,
            capability_type: "function",
            comment: undefined,
          },
        ],
      },
      { params: { branch: "main" } },
    );
  });

  it("addresses an MCP tool by server and tool name", async () => {
    postMock.mockResolvedValue({ data: { entries: [{ id: "binding-2" }] } });

    await attachKnowledgeNetworkCapabilities("kn-1", [
      { boxId: "mcp-1", capabilityId: "search", capabilityType: "mcp_tool" },
    ]);

    const [, body] = postMock.mock.calls[0] as [
      string,
      { capabilities: Record<string, unknown>[] },
    ];
    expect(body.capabilities[0]).toMatchObject({
      box_id: "mcp-1",
      capability_id: "search",
      capability_type: "mcp_tool",
    });
  });

  it("releases bindings as one comma-separated batch", async () => {
    deleteMock.mockResolvedValue({ data: null });

    await detachKnowledgeNetworkCapabilities("kn-1", ["b-1", "b-2"]);

    expect(deleteMock).toHaveBeenCalledWith(
      "/bkn-backend/v1/knowledge-networks/kn-1/capabilities/b-1,b-2",
      { params: { branch: "main" } },
    );
  });

  it("skips the request when nothing is selected", async () => {
    await detachKnowledgeNetworkCapabilities("kn-1", []);

    expect(deleteMock).not.toHaveBeenCalled();
  });
});
