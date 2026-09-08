/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const postMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: vi.fn(), post: postMock },
}));

describe("kn-diff.service - diffKnowledgeNetworks", () => {
  beforeEach(() => {
    vi.resetModules();
    postMock.mockReset();
  });

  it("names both networks in the body and defaults their branch", async () => {
    postMock.mockResolvedValue({ data: {} });
    const { diffKnowledgeNetworks } = await import(
      "@/modules/knowledge-network/services/kn-diff.service"
    );

    await diffKnowledgeNetworks({ baseNetworkId: "kn-1", targetNetworkId: "kn-2" });

    expect(postMock).toHaveBeenCalledWith("/bkn-backend/v1/bkns/diff", {
      base: { branch: "main", kn_id: "kn-1" },
      fallback_by_name: false,
      include_unchanged: false,
      target: { branch: "main", kn_id: "kn-2" },
    });
  });

  it("carries the summary, the lineage and the field level changes", async () => {
    postMock.mockResolvedValue({
      data: {
        base: { branch: "main", kn_id: "kn-1", name: "供应链主网" },
        entries: [
          {
            action: "update",
            changes: [
              { kind: "update", new: "产品物料清单", old: "产品BOM", path: "name" },
              { kind: "create", new: "批次号", path: "data_properties[batch_no]" },
            ],
            id: "bom",
            name: { new: "产品物料清单", old: "产品BOM" },
            paired_by: "id",
            type: "object_type",
          },
        ],
        lineage: { common_ids: 30, related: true, total_ids: 32 },
        network: { action: "update", id: "kn-2", paired_by: "id", type: "network" },
        summary: { created: 1, deleted: 1, unchanged: 29, updated: 1 },
        target: { branch: "main", kn_id: "kn-2", name: "试点网" },
      },
    });
    const { diffKnowledgeNetworks } = await import(
      "@/modules/knowledge-network/services/kn-diff.service"
    );

    const result = await diffKnowledgeNetworks({ baseNetworkId: "kn-1", targetNetworkId: "kn-2" });

    expect(result.summary).toEqual({ created: 1, deleted: 1, unchanged: 29, updated: 1 });
    expect(result.lineage.commonIds).toBe(30);
    expect(result.base.name).toBe("供应链主网");
    expect(result.entries[0].changes[0]).toEqual({
      kind: "update",
      newValue: "产品物料清单",
      oldValue: "产品BOM",
      path: "name",
    });
    // The root file is carried separately so it never occupies a slot in the definition list.
    expect(result.network?.type).toBe("network");
  });

  // A definition paired by name is a guess. Both ids have to survive the mapping or the page
  // cannot show which two things it decided were the same.
  // Identical definitions are asked for so the page can list the whole model; the option has to
  // reach the request or the list silently loses them.
  it("asks for the unchanged definitions when told to", async () => {
    postMock.mockResolvedValue({ data: {} });
    const { diffKnowledgeNetworks } = await import(
      "@/modules/knowledge-network/services/kn-diff.service"
    );

    await diffKnowledgeNetworks({
      baseNetworkId: "kn-1",
      includeUnchanged: true,
      targetNetworkId: "kn-2",
    });

    expect(postMock.mock.calls[0][1]).toMatchObject({ include_unchanged: true });
  });

  it("keeps both ids when a definition was paired by name", async () => {
    postMock.mockResolvedValue({
      data: {
        entries: [
          {
            action: "update",
            base_id: "supplier",
            id: "0193-uuid",
            paired_by: "name",
            target_id: "0193-uuid",
            type: "object_type",
          },
        ],
      },
    });
    const { diffKnowledgeNetworks } = await import(
      "@/modules/knowledge-network/services/kn-diff.service"
    );

    const result = await diffKnowledgeNetworks({
      baseNetworkId: "kn-1",
      fallbackByName: true,
      targetNetworkId: "kn-2",
    });

    expect(result.entries[0].pairedBy).toBe("name");
    expect(result.entries[0].baseId).toBe("supplier");
    expect(result.entries[0].targetId).toBe("0193-uuid");
  });
});

describe("kn-diff.service - fetchObjectDataStats", () => {
  beforeEach(() => {
    vi.resetModules();
    postMock.mockReset();
  });

  it("asks for one object type per side", async () => {
    postMock.mockResolvedValue({ data: {} });
    const { fetchObjectDataStats } = await import(
      "@/modules/knowledge-network/services/kn-diff.service"
    );

    await fetchObjectDataStats({
      baseNetworkId: "kn-1",
      baseObjectTypeId: "bom",
      targetNetworkId: "kn-2",
      targetObjectTypeId: "bom",
    });

    expect(postMock).toHaveBeenCalledWith("/bkn-backend/v1/bkns/diff/object-data-stats", {
      base: { branch: "main", kn_id: "kn-1", ot_id: "bom" },
      target: { branch: "main", kn_id: "kn-2", ot_id: "bom" },
    });
  });

  // An object type with no primary key has no distinct count at all. Turning that into 0 would
  // render as "every row is a duplicate".
  it("keeps a missing distinct count absent instead of zero", async () => {
    postMock.mockResolvedValue({
      data: {
        base: { row_count: 42 },
        delta: { row_count: 0 },
        same_resource: true,
        target: { row_count: 42 },
      },
    });
    const { fetchObjectDataStats } = await import(
      "@/modules/knowledge-network/services/kn-diff.service"
    );

    const result = await fetchObjectDataStats({
      baseNetworkId: "kn-1",
      baseObjectTypeId: "bom",
      targetNetworkId: "kn-2",
      targetObjectTypeId: "bom",
    });

    expect(result.base.rowCount).toBe(42);
    expect(result.base.primaryKeyDistinct).toBeNull();
    expect(result.base.duplicateKeys).toBeNull();
    expect(result.sameResource).toBe(true);
  });
});
