/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BuildTask } from "@/modules/data-catalog/types/data-catalog";
import {
  loadResourceIndexBuildTasks,
  uniqueCatalogIdsFromResourceCatalogMap,
} from "@/modules/knowledge-network/utils/load-resource-index-build-tasks";

vi.mock("@/modules/data-catalog/services/resource.service", () => ({
  getCatalogResources: vi.fn(),
}));

vi.mock("@/modules/data-catalog/services/build-task.service", () => ({
  listBuildTasks: vi.fn(),
}));

import { listBuildTasks } from "@/modules/data-catalog/services/build-task.service";
import { getCatalogResources } from "@/modules/data-catalog/services/resource.service";

const mockedGetCatalogResources = vi.mocked(getCatalogResources);
const mockedListBuildTasks = vi.mocked(listBuildTasks);

function buildTask(resourceId: string, id = `${resourceId}-task`): BuildTask {
  return {
    id,
    resourceId,
    mode: "batch",
    status: "succeeded",
    embeddingFields: [],
    buildKeyFields: [],
    embeddingModel: "",
    embeddingDegraded: false,
    modelDimensions: 0,
    fulltextFields: [],
    fulltextAnalyzer: "",
    totalCount: 1,
    syncedCount: 1,
    vectorizedCount: 1,
    indexUsable: true,
    failureDetail: "",
    createdAt: 1,
    createTime: "-",
    finishTime: null,
    lastEventAt: null,
    error: null,
  };
}

describe("uniqueCatalogIdsFromResourceCatalogMap", () => {
  it("deduplicates catalog ids and ignores missing values", () => {
    const map = new Map<string, string | undefined>([
      ["r1", "cat-a"],
      ["r2", "cat-a"],
      ["r3", "cat-b"],
      ["r4", undefined],
    ]);

    expect(uniqueCatalogIdsFromResourceCatalogMap(map)).toEqual(["cat-a", "cat-b"]);
  });
});

describe("loadResourceIndexBuildTasks", () => {
  beforeEach(() => {
    mockedGetCatalogResources.mockReset();
    mockedListBuildTasks.mockReset();
  });

  it("loads build tasks once per catalog and filters to bound resources", async () => {
    mockedGetCatalogResources.mockResolvedValue([
      { id: "r1", catalogId: "cat-a" } as never,
      { id: "r2", catalogId: "cat-a" } as never,
      { id: "r3", catalogId: "cat-b" } as never,
    ]);
    mockedListBuildTasks.mockImplementation(async ({ catalogId, resourceId }) => {
      if (catalogId === "cat-a") {
        return [buildTask("r1"), buildTask("r2"), buildTask("r9", "other-task")];
      }
      if (catalogId === "cat-b") {
        return [buildTask("r3")];
      }
      if (resourceId) {
        return [buildTask(resourceId, `${resourceId}-fallback`)];
      }
      return [];
    });

    const tasks = await loadResourceIndexBuildTasks(["r1", "r2", "r3"]);

    expect(mockedGetCatalogResources).toHaveBeenCalledWith(["r1", "r2", "r3"]);
    expect(mockedListBuildTasks).toHaveBeenCalledTimes(2);
    expect(mockedListBuildTasks).toHaveBeenCalledWith({ catalogId: "cat-a", silent: true });
    expect(mockedListBuildTasks).toHaveBeenCalledWith({ catalogId: "cat-b", silent: true });
    expect(tasks.map((task) => task.resourceId).sort()).toEqual(["r1", "r2", "r3"]);
  });

  it("falls back to resource-scoped queries when catalog resolution fails", async () => {
    mockedGetCatalogResources.mockResolvedValue([{ id: "r1", catalogId: "cat-a" } as never]);
    mockedListBuildTasks.mockImplementation(async ({ catalogId, resourceId }) => {
      if (catalogId === "cat-a") {
        return [buildTask("r1")];
      }
      if (resourceId === "r2") {
        return [buildTask("r2")];
      }
      return [];
    });

    const tasks = await loadResourceIndexBuildTasks(["r1", "r2"]);

    expect(mockedListBuildTasks).toHaveBeenCalledWith({ catalogId: "cat-a", silent: true });
    expect(mockedListBuildTasks).toHaveBeenCalledWith({ resourceId: "r2", silent: true });
    expect(tasks.map((task) => task.resourceId).sort()).toEqual(["r1", "r2"]);
  });
});
