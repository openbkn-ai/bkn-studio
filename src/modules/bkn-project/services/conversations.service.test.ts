/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockDelete, mockGet, mockPost, mockPut } = vi.hoisted(() => ({
  mockDelete: vi.fn(),
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
}));

vi.mock("@/framework/request/http", () => ({
  http: { delete: mockDelete, get: mockGet, post: mockPost, put: mockPut },
}));

// useMock is read when the module loads, so each case stubs the env and imports afresh.
async function importService() {
  vi.stubEnv("VITE_USE_MOCK", "false");
  vi.resetModules();
  return import("@/modules/bkn-project/services/conversations.service");
}

const prefix = "/bkn-project/v1/projects/p%2F1/requirements";

const backendConversation = {
  create_time: 1,
  creator: { id: "u1", name: "Ann", type: "user" },
  id: "c1",
  page: "kinetic",
  project_id: "p/1",
  title: "Merge these two",
  turns: [
    {
      answer: "Keep one.",
      by: { id: "u1", type: "user" },
      create_time: 2,
      dropped: 1,
      id: "t1",
      proposals: [
        {
          before: { logic_kind: "metric", name: "Late rate", object_type_ids: ["o1"] },
          into_before: { name: "On-time rate" },
          into_id: "n8",
          item: { definition: "Share on time" },
          kind: "logic_needs",
          op: "merge",
          reason: "Same measure",
          status: "",
          target_id: "n7",
        },
        {
          kind: "logic_needs",
          network_item: { id: "f1", kind: "function", name: "Kit check", type: "function" },
          op: "link",
          status: "adopted",
          target_id: "n6",
        },
      ],
      question: "Merge these two",
      refs: [{ id: "n7", kind: "logic_needs", name: "Late rate" }],
      status: "ready",
      update_time: 3,
    },
    { id: "t2", proposals: null, question: "And this?", refs: null, status: "pending" },
  ],
  update_time: 3,
};

describe("conversations.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads and writes the supplement note", async () => {
    const { getSupplement, saveSupplement } = await importService();
    mockGet.mockResolvedValueOnce({ data: { text: "", time: 0 } });
    await expect(getSupplement("p/1")).resolves.toEqual({ by: null, text: "", time: 0 });
    expect(mockGet).toHaveBeenCalledWith(`${prefix}/supplement`, { skipErrorToast: true });

    mockPut.mockResolvedValueOnce({
      data: { by: { id: "u1", name: "Ann", type: "user" }, text: "Focus on stock", time: 9 },
    });
    await expect(saveSupplement("p/1", "Focus on stock")).resolves.toEqual({
      by: { id: "u1", name: "Ann" },
      text: "Focus on stock",
      time: 9,
    });
    expect(mockPut).toHaveBeenCalledWith(
      `${prefix}/supplement`,
      { text: "Focus on stock" },
      { skipErrorToast: true },
    );
  });

  it("lists a page's conversations with their turns and proposals", async () => {
    const { listConversations } = await importService();
    mockGet.mockResolvedValueOnce({ data: { conversations: [backendConversation] } });

    const [conversation] = await listConversations("p/1", "kinetic");

    expect(mockGet).toHaveBeenCalledWith(`${prefix}/conversations`, {
      params: { page: "kinetic" },
      skipErrorToast: true,
    });
    expect(conversation.title).toBe("Merge these two");
    expect(conversation.turns[0]).toMatchObject({
      answer: "Keep one.",
      dropped: 1,
      refs: [{ id: "n7", kind: "logic_needs", name: "Late rate" }],
      status: "ready",
    });
    expect(conversation.turns[0].proposals[0]).toEqual({
      before: { logicKind: "metric", name: "Late rate", objectTypeIds: ["o1"] },
      intoBefore: { name: "On-time rate" },
      intoId: "n8",
      item: { definition: "Share on time" },
      kind: "logic_needs",
      networkItem: null,
      op: "merge",
      parts: [],
      reason: "Same measure",
      resultId: "",
      status: "",
      targetId: "n7",
    });
    expect(conversation.turns[0].proposals[1]).toMatchObject({
      networkItem: { kind: "function", name: "Kit check", type: "function" },
      op: "link",
      status: "adopted",
    });
    // A pending turn has nothing yet: null lists read as empty.
    expect(conversation.turns[1]).toMatchObject({ proposals: [], refs: [], status: "pending" });
  });

  it("starts a conversation and asks in one, sending refs by kind and id only", async () => {
    const { askInConversation, startConversation } = await importService();
    mockPost.mockResolvedValue({ data: backendConversation });
    const refs = [{ id: "n7", kind: "logic_needs" as const, name: "Late rate" }];

    await startConversation("p/1", "kinetic", "Merge these two", refs);
    expect(mockPost).toHaveBeenCalledWith(
      `${prefix}/conversations`,
      { page: "kinetic", question: "Merge these two", refs: [{ id: "n7", kind: "logic_needs" }] },
      { skipErrorToast: true },
    );

    await askInConversation("p/1", "c/1", "And this?", []);
    expect(mockPost).toHaveBeenLastCalledWith(
      `${prefix}/conversations/c%2F1/turns`,
      { question: "And this?", refs: [] },
      { skipErrorToast: true },
    );
  });

  it("reads one conversation and deletes a whole one", async () => {
    const { deleteConversation, getConversation } = await importService();
    mockGet.mockResolvedValueOnce({ data: backendConversation });
    await expect(getConversation("p/1", "c1")).resolves.toMatchObject({ id: "c1" });
    expect(mockGet).toHaveBeenCalledWith(`${prefix}/conversations/c1`, { skipErrorToast: true });

    mockDelete.mockResolvedValueOnce({ data: undefined });
    await deleteConversation("p/1", "c1");
    expect(mockDelete).toHaveBeenCalledWith(`${prefix}/conversations/c1`, {
      skipErrorToast: true,
    });
  });

  it("adopts and declines proposals on the specification read, and replies the one after", async () => {
    const { decideProposals } = await importService();
    mockPut.mockResolvedValueOnce({
      data: {
        conversation: backendConversation,
        requirement: { spec: {}, status: "ready", update_time: 12, version: 2 },
      },
    });

    const reply = await decideProposals("p/1", "c1", "t1", {
      adopt: [0],
      decline: [1],
      updateTime: 11,
    });

    expect(mockPut).toHaveBeenCalledWith(
      `${prefix}/conversations/c1/turns/t1/proposals`,
      { adopt: [0], decline: [1], update_time: 11 },
      { skipErrorToast: true },
    );
    expect(reply.requirements?.updateTime).toBe(12);
    expect(reply.conversation.id).toBe("c1");

    mockPut.mockResolvedValueOnce({
      data: { conversation: backendConversation, requirement: null },
    });
    await expect(
      decideProposals("p/1", "c1", "t1", { adopt: [], decline: [0], updateTime: 12 }),
    ).resolves.toMatchObject({ requirements: null });
  });
});
