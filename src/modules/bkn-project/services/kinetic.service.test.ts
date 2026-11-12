/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AxiosError, type AxiosResponse } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockDelete, mockGet, mockPatch, mockPost, mockPut } = vi.hoisted(() => ({
  mockDelete: vi.fn(),
  mockGet: vi.fn(),
  mockPatch: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
}));

vi.mock("@/framework/request/http", () => ({
  http: { delete: mockDelete, get: mockGet, patch: mockPatch, post: mockPost, put: mockPut },
}));

// useMock is read when the module loads, so each case stubs the env and imports afresh.
async function importServices(useMock = "false") {
  vi.stubEnv("VITE_USE_MOCK", useMock);
  vi.resetModules();
  return {
    kinetic: await import("@/modules/bkn-project/services/kinetic.service"),
    requirements: await import("@/modules/bkn-project/services/requirements.service"),
  };
}

const prefix = "/bkn-project/v1/projects/p%2F1/requirements";
const spec = { spec: {}, status: "ready", update_time: 9, version: 1 };

describe("kinetic.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads the needs with what implements them in the live network", async () => {
    const { kinetic } = await importServices();
    mockGet.mockResolvedValueOnce({
      data: {
        needs: [
          {
            accepted: true,
            id: "n1",
            implementation: {
              available: true,
              name: "Late rate",
              owner_object_type_id: "orders",
              owner_object_type_name: "Orders",
              status: "published",
              version: "3",
            },
            kind: "metric",
            link: { at: 5, by: { id: "u1" }, id: "m1", type: "object_metric" },
            live_object_type_ids: ["orders"],
            name: "Late rate",
            unconnected: [{ from: "orders", to: "products" }],
            object_type_ids: ["orders"],
          },
          { id: "n2", kind: "skill", link: null, name: "Triage" },
        ],
        network_id: "net",
        released: true,
        update_time: 9,
      },
    });

    const read = await kinetic.getLogicNeeds("p/1");

    expect(mockGet).toHaveBeenCalledWith(`${prefix}/logic-needs`, { skipErrorToast: true });
    expect(read).toMatchObject({ networkId: "net", reason: "", released: true, updateTime: 9 });
    expect(read.needs[0]).toMatchObject({
      implementation: {
        available: true,
        description: "",
        name: "Late rate",
        ownerObjectTypeId: "orders",
        ownerObjectTypeName: "Orders",
        reason: "",
        status: "published",
        version: "3",
      },
      link: { at: 5, boxId: "", byId: "u1", id: "m1", type: "object_metric" },
      liveObjectTypeIds: ["orders"],
      objectTypeIds: ["orders"],
      unconnected: [{ from: "orders", to: "products" }],
    });
    expect(read.needs[1]).toMatchObject({
      accepted: false,
      implementation: null,
      link: null,
      liveObjectTypeIds: [],
      objectTypeIds: [],
      unconnected: [],
    });
  });

  it("reads what the network already has, its missing fields as empty", async () => {
    const { kinetic } = await importServices();
    mockGet.mockResolvedValueOnce({
      data: {
        network_items: [
          {
            box_id: "box",
            description: "d",
            id: "f1",
            name: "Window check",
            need_ids: ["n1"],
            owner_object_type_id: "orders",
            owner_object_type_name: "Orders",
            type: "function",
          },
          { id: "s1", name: "Triage", need_ids: null, type: "skill" },
        ],
        network_items_reason: "forbidden",
        update_time: 0,
      },
    });

    const read = await kinetic.getLogicNeeds("p/1");

    expect(read.networkItemsReason).toBe("forbidden");
    expect(read.networkItems).toEqual([
      {
        boxId: "box",
        description: "d",
        id: "f1",
        name: "Window check",
        needIds: ["n1"],
        ownerObjectTypeId: "orders",
        ownerObjectTypeName: "Orders",
        type: "function",
      },
      {
        boxId: "",
        description: "",
        id: "s1",
        name: "Triage",
        needIds: [],
        ownerObjectTypeId: "",
        ownerObjectTypeName: "",
        type: "skill",
      },
    ]);
  });

  it("reads the network live when it runs a version, and an older reply by its release", async () => {
    const { kinetic } = await importServices();
    mockGet.mockResolvedValueOnce({ data: { live: true, released: false, update_time: 0 } });
    expect(await kinetic.getLogicNeeds("p/1")).toMatchObject({ live: true, released: false });
    mockGet.mockResolvedValueOnce({ data: { released: true, update_time: 0 } });
    expect(await kinetic.getLogicNeeds("p/1")).toMatchObject({ live: true, released: true });
  });

  it("reads no needs and no release when there is none, also from an older 404", async () => {
    const { kinetic } = await importServices();
    mockGet.mockResolvedValueOnce({ data: { needs: [], update_time: 0 } });
    expect(await kinetic.getLogicNeeds("p/1")).toEqual({
      live: false,
      needs: [],
      networkId: "",
      networkItems: [],
      networkItemsReason: "",
      reason: "",
      released: false,
      updateTime: 0,
    });

    mockGet.mockRejectedValueOnce(
      new AxiosError("x", "ERR_BAD_REQUEST", undefined, undefined, {
        data: { error_code: "BknProject.Requirement.NotFound" },
        status: 404,
      } as AxiosResponse),
    );
    expect(await kinetic.getLogicNeeds("p/1")).toEqual({
      live: false,
      needs: [],
      networkId: "",
      networkItems: [],
      networkItemsReason: "",
      reason: "",
      released: false,
      updateTime: 0,
    });

    mockGet.mockRejectedValueOnce(
      new AxiosError("x", "ERR_BAD_RESPONSE", undefined, undefined, {
        data: {},
        status: 500,
      } as AxiosResponse),
    );
    await expect(kinetic.getLogicNeeds("p/1")).rejects.toThrow();
  });

  it("reads a need's candidates with why they are offered", async () => {
    const { kinetic } = await importServices();
    mockGet.mockResolvedValueOnce({
      data: {
        candidates: [
          { box_id: "mcp1", id: "tool", name: "Tool", reasons: ["similar_name"], type: "mcp_tool" },
        ],
        network_id: "net",
      },
    });

    const read = await kinetic.getLogicNeedCandidates("p/1", "n/1");

    expect(mockGet).toHaveBeenCalledWith(`${prefix}/logic-needs/n%2F1/candidates`, {
      skipErrorToast: true,
    });
    expect(read).toEqual({
      candidates: [
        {
          boxId: "mcp1",
          description: "",
          id: "tool",
          name: "Tool",
          ownerObjectTypeId: "",
          reasons: ["similar_name"],
          type: "mcp_tool",
        },
      ],
      networkId: "net",
      reason: "",
    });
  });

  it("links and unlinks on the specification read", async () => {
    const { kinetic } = await importServices();
    mockPut.mockResolvedValueOnce({ data: spec });
    mockDelete.mockResolvedValueOnce({ data: spec });

    await kinetic.linkLogicNeed("p/1", "n1", { boxId: "box", id: "f1", type: "function" }, 9);
    await kinetic.unlinkLogicNeed("p/1", "n1", 9);

    expect(mockPut).toHaveBeenCalledWith(
      `${prefix}/logic-needs/n1/link`,
      { box_id: "box", id: "f1", type: "function", update_time: 9 },
      { skipErrorToast: true },
    );
    expect(mockDelete).toHaveBeenCalledWith(`${prefix}/logic-needs/n1/link`, {
      params: { update_time: 9 },
      skipErrorToast: true,
    });
  });

  it("analyses kinetic needs, starting over only when asked", async () => {
    const { requirements } = await importServices();
    mockPost.mockResolvedValue({ data: spec });

    await requirements.analyzeKinetic("p/1");
    await requirements.analyzeKinetic("p/1", true);

    expect(mockPost).toHaveBeenNthCalledWith(1, `${prefix}:analyze-kinetic`, undefined, {
      skipErrorToast: true,
    });
    expect(mockPost).toHaveBeenNthCalledWith(
      2,
      `${prefix}:analyze-kinetic`,
      { discard_decisions: true },
      { skipErrorToast: true },
    );
  });

  it("sends a need's and a question's kinetic fields as the item routes name them", async () => {
    const { requirements } = await importServices();
    mockPost.mockResolvedValue({ data: spec });
    mockPatch.mockResolvedValue({ data: spec });

    await requirements.addItem(
      "p/1",
      "logic_needs",
      {
        definition: "Late over all",
        logicKind: "metric",
        name: "Late rate",
        objectTypeIds: ["orders"],
        suggestedMetricType: "atomic",
      },
      9,
    );
    await requirements.editItem("p/1", "questions", "q1", { logicNeedIds: ["n1"] }, 9);

    expect(mockPost).toHaveBeenCalledWith(
      `${prefix}/items/logic_needs`,
      {
        definition: "Late over all",
        logic_kind: "metric",
        name: "Late rate",
        object_type_ids: ["orders"],
        suggested_metric_type: "atomic",
        update_time: 9,
      },
      { skipErrorToast: true },
    );
    expect(mockPatch).toHaveBeenCalledWith(
      `${prefix}/items/questions/q1`,
      { logic_need_ids: ["n1"], update_time: 9 },
      { skipErrorToast: true },
    );
  });

  it("links in the mock as bkn-project does: accepted, and implemented once read", async () => {
    const { kinetic } = await importServices("true");
    const before = await kinetic.getLogicNeeds("p1");
    const skill = before.needs.find((need) => need.kind === "skill")!;
    expect(skill.accepted).toBe(false);
    const [candidate] = (await kinetic.getLogicNeedCandidates("p1", skill.id)).candidates;

    await kinetic.linkLogicNeed("p1", skill.id, candidate, before.updateTime);
    const after = await kinetic.getLogicNeeds("p1");

    expect(after.needs.find((need) => need.id === skill.id)).toMatchObject({
      accepted: true,
      implementation: { available: true, name: candidate.name },
      link: { id: candidate.id, type: "skill" },
    });
    // The bill of materials is not live yet, the action type points at one that is gone.
    expect(after.needs.find((need) => need.id === "n4")?.liveObjectTypeIds).toEqual([]);
    expect(after.needs.find((need) => need.id === "n3")?.implementation?.reason).toBe("missing");
    // A link on the specification as read before is refused, as any stale edit is.
    await expect(
      kinetic.linkLogicNeed("p1", skill.id, candidate, before.updateTime),
    ).rejects.toThrow();
  });
});
