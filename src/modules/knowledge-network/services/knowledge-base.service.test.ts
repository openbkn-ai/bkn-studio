/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({ http: { get: getMock } }));
vi.mock("@/modules/knowledge-network/services/shared/runtime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/knowledge-network/services/shared/runtime")>()),
  useMock: false,
}));

import { listQueryableKnowledgeBases, mapQueryableKnowledgeBases } from "./knowledge-base.service";

describe("listQueryableKnowledgeBases", () => {
  beforeEach(() => getMock.mockReset());

  it("keeps only knowledge bases the caller can query, by name", async () => {
    getMock.mockResolvedValue({
      data: {
        code: 0,
        data: [
          {
            description: null,
            document_count: 3,
            id: 7,
            name: "Contracts",
            operations: ["query_data"],
          },
          { id: 8, name: "Minutes", operations: ["view_detail"] },
          { id: 9, name: "No operations reported" },
        ],
      },
    });

    await expect(listQueryableKnowledgeBases(" Contr ")).resolves.toEqual([
      { description: "", documentCount: 3, id: "7", name: "Contracts" },
    ]);
    expect(getMock).toHaveBeenCalledWith("/kb/v1/knowledge_base/datasets", {
      params: { name: "Contr" },
      skipErrorToast: true,
    });
  });

  it("sends no name filter for an empty search", async () => {
    getMock.mockResolvedValue({ data: { code: 0, data: [] } });
    await listQueryableKnowledgeBases("  ");
    expect(getMock).toHaveBeenCalledWith("/kb/v1/knowledge_base/datasets", {
      params: { name: undefined },
      skipErrorToast: true,
    });
  });

  it("fails on a body kb-api did not mark as a success", async () => {
    getMock.mockResolvedValue({ data: { code: 500, msg: "busy" } });
    await expect(listQueryableKnowledgeBases()).rejects.toThrow("busy");
  });
});

describe("mapQueryableKnowledgeBases", () => {
  it("leaves out a knowledge base that can be seen but not queried", () => {
    expect(
      mapQueryableKnowledgeBases([{ id: 1, name: "Seen", operations: ["view_detail"] }]),
    ).toEqual([]);
  });

  it("keeps a document count kb-api did not report as unknown, not as zero", () => {
    expect(
      mapQueryableKnowledgeBases([{ id: 1, name: "Uncounted", operations: ["query_data"] }]),
    ).toEqual([{ description: "", documentCount: undefined, id: "1", name: "Uncounted" }]);
  });
});
