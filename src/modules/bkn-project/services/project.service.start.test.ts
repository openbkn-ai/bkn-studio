/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { statisticsMock, objectTypesMock, resourcesMock } = vi.hoisted(() => ({
  objectTypesMock: vi.fn(),
  resourcesMock: vi.fn(),
  statisticsMock: vi.fn(),
}));

vi.mock("@/modules/knowledge-network/services/network.service", () => ({
  getKnowledgeNetworkStatistics: statisticsMock,
}));
vi.mock("@/modules/knowledge-network/services/object-type.service", () => ({
  listKnowledgeNetworkObjectTypes: objectTypesMock,
}));
vi.mock("@/modules/data-catalog/services/resource.service", () => ({
  getCatalogResources: resourcesMock,
}));

import { getExistingNetworkStart } from "@/modules/bkn-project/services/project.service";

describe("getExistingNetworkStart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    objectTypesMock.mockResolvedValue([{ dataSource: { id: "t1", type: "resource" } }]);
    resourcesMock.mockResolvedValue([{ catalogId: "c1" }]);
  });

  it("counts concept groups, functions and Skills beside the types", async () => {
    statisticsMock.mockResolvedValue({
      actionTypesTotal: 7,
      apisTotal: 0,
      conceptGroupsTotal: 1,
      functionsTotal: 4,
      mcpToolsTotal: 0,
      metricsTotal: 0,
      objectTypesTotal: 14,
      relationTypesTotal: 21,
      skillsTotal: 2,
    });

    await expect(getExistingNetworkStart("supply")).resolves.toEqual({
      actionTypes: 7,
      catalogIds: ["c1"],
      conceptGroups: 1,
      functions: 4,
      objectTypes: 14,
      relationTypes: 21,
      skills: 2,
    });
  });

  it("leaves out the term object type and the catalog it reads", async () => {
    objectTypesMock.mockResolvedValue([
      { dataSource: { id: "t1", type: "resource" }, id: "orders" },
      { dataSource: { id: "bkn_terms_1", type: "resource" }, id: "bkn_domain_terms" },
    ]);
    statisticsMock.mockResolvedValue({ objectTypesTotal: 2 });

    const start = await getExistingNetworkStart("supply");

    expect(start.objectTypes).toBe(1);
    expect(resourcesMock).toHaveBeenCalledWith(["t1"]);
  });

  it("counts none when the statistics cannot be read", async () => {
    statisticsMock.mockResolvedValue(null);

    const start = await getExistingNetworkStart("supply");

    expect(start).toMatchObject({ conceptGroups: 0, functions: 0, objectTypes: 1, skills: 0 });
  });
});
