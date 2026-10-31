/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGet, mockPost, mockPut } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
}));

vi.mock("@/framework/request/http", () => ({
  http: { get: mockGet, post: mockPost, put: mockPut },
}));

// useMock is read when the module loads, so each case stubs the env and imports afresh.
async function importService() {
  vi.stubEnv("VITE_USE_MOCK", "false");
  vi.resetModules();
  return import("@/modules/bkn-project/services/project.service");
}

const backendProject = {
  archived: false,
  baseline_network_id: "orders_v1_0_0",
  branch: "project/p1",
  catalog_ids: null,
  create_time: 1,
  id: "p1",
  kn_id: "orders",
  name: "Orders",
  other_projects: 2,
  owner: { id: "u1", type: "user" },
  update_time: 2,
};

describe("project.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lists a cursor page with its filters and maps the entries", async () => {
    mockGet.mockResolvedValue({
      data: { entries: [backendProject], next_cursor: "c2", total: 3 },
    });
    const { listProjects } = await importService();

    const result = await listProjects({ archived: "all", cursor: "c1", limit: 20, name: " ord " });

    expect(mockGet).toHaveBeenCalledWith("/bkn-project/v1/projects", {
      params: { archived: "all", cursor: "c1", limit: 20, name: "ord" },
      skipErrorToast: true,
    });
    expect(result).toEqual({
      items: [
        {
          archived: false,
          baselineNetworkId: "orders_v1_0_0",
          branch: "project/p1",
          catalogIds: [],
          createTime: 1,
          id: "p1",
          knId: "orders",
          name: "Orders",
          otherProjects: 2,
          owner: { id: "u1", type: "user" },
          updateTime: 2,
        },
      ],
      nextCursor: "c2",
      total: 3,
    });
  });

  it("leaves out an empty name and cursor, and reads no entries as none", async () => {
    mockGet.mockResolvedValue({ data: { entries: null, next_cursor: null, total: 0 } });
    const { listProjects } = await importService();

    const result = await listProjects({ archived: "false", limit: 20, name: "  " });

    const [, config] = mockGet.mock.calls[0] as [string, { params: Record<string, unknown> }];
    expect(config.params).toEqual({
      archived: "false",
      cursor: undefined,
      limit: 20,
      name: undefined,
    });
    expect(result.items).toEqual([]);
  });

  it("creates a project of an existing network", async () => {
    mockPost.mockResolvedValue({ data: backendProject });
    const { createProject } = await importService();

    await createProject({ catalogIds: ["c1"], knId: "orders", name: " Orders " });

    expect(mockPost).toHaveBeenCalledWith("/bkn-project/v1/projects", {
      catalog_ids: ["c1"],
      kn_id: "orders",
      name: "Orders",
      new_kn: undefined,
    });
  });

  it("creates a project of a new network", async () => {
    mockPost.mockResolvedValue({ data: backendProject });
    const { createProject } = await importService();

    await createProject({ catalogIds: [], name: "Orders", newKnName: " Delivery " });

    expect(mockPost.mock.calls[0][1]).toEqual({
      catalog_ids: [],
      kn_id: undefined,
      name: "Orders",
      new_kn: { name: "Delivery" },
    });
  });

  it("replaces the project's catalogs and maps the project it replies", async () => {
    mockPut.mockResolvedValue({ data: { ...backendProject, catalog_ids: ["c2"] } });
    const { setProjectCatalogs } = await importService();

    const project = await setProjectCatalogs("p 1", ["c2"]);

    expect(mockPut).toHaveBeenCalledWith(
      "/bkn-project/v1/projects/p%201/catalogs",
      { catalog_ids: ["c2"] },
      { skipErrorToast: true },
    );
    expect(project.catalogIds).toEqual(["c2"]);
  });

  it("adds catalogs with the custom method, which drafts their tables in the background", async () => {
    mockPost.mockResolvedValue({ data: undefined, status: 202 });
    const { addProjectCatalogs } = await importService();

    await addProjectCatalogs("p 1", ["c2", "c3"]);

    expect(mockPost).toHaveBeenCalledWith(
      "/bkn-project/v1/projects/p%201/catalogs:add",
      { catalog_ids: ["c2", "c3"] },
      { skipErrorToast: true },
    );
  });

  it("archives and unarchives with the custom methods", async () => {
    mockPost.mockResolvedValue({ data: backendProject });
    const { setProjectArchived } = await importService();

    await setProjectArchived("p1", true);
    await setProjectArchived("p1", false);

    expect(mockPost.mock.calls.map((call) => call[0] as string)).toEqual([
      "/bkn-project/v1/projects/p1:archive",
      "/bkn-project/v1/projects/p1:unarchive",
    ]);
  });

  it("lists every visible network in one request", async () => {
    mockGet.mockResolvedValue({
      data: { entries: [{ id: "orders", name: "Orders", tags: ["x"] }] },
    });
    const { listProjectNetworks } = await importService();

    const networks = await listProjectNetworks();

    expect(mockGet).toHaveBeenCalledWith("/bkn-backend/v1/knowledge-networks", {
      params: { direction: "desc", limit: -1, sort: "update_time" },
      skipErrorToast: true,
    });
    expect(networks).toEqual([{ id: "orders", name: "Orders" }]);
  });
});
