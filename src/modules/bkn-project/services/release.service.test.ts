/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGet, mockPost } = vi.hoisted(() => ({ mockGet: vi.fn(), mockPost: vi.fn() }));

vi.mock("@/framework/request/http", () => ({ http: { get: mockGet, post: mockPost } }));

// useMock is read when the module loads, so each case stubs the env and imports afresh.
async function importService(useMock = "false") {
  vi.stubEnv("VITE_USE_MOCK", useMock);
  vi.resetModules();
  return import("@/modules/bkn-project/services/release.service");
}

const prefix = "/bkn-project/v1/projects/p%2F1";

/** A review as bkn-project replies it, null lists included. */
const backendReview = {
  accepts: ["index_not_ready"],
  blocked: false,
  capabilities: [{ copy: true, id: "f1", kind: "function", name: "Late orders", reasons: null }],
  changes: {
    added: [{ id: "orders", kind: "object_type", name: "Orders" }],
    changed: null,
    other: 2,
    removed: [],
  },
  checks: [
    { code: "confirmed", passed: true },
    {
      accept: "index_not_ready",
      code: "index",
      details: { not_configured: 1, ready: 3 },
      passed: false,
      reason: "index_not_ready",
    },
  ],
  project_id: "p/1",
  questions: {
    affected: null,
    answerable_new: [{ id: "q1", needs: [], text: "Which orders are late?" }],
    spec_version: 1,
    total: 2,
    unanswerable: [
      {
        id: "q2",
        missing: [{ id: "bom", kind: "object_type", name: "BOM" }],
        needs: [],
        text: "Which products use P-100?",
        unconnected: [
          {
            from: { id: "orders", kind: "object_type", name: "Orders" },
            to: { id: "parts", kind: "object_type", name: "Parts" },
          },
        ],
      },
    ],
    unjudged: 0,
  },
  refusals: null,
  release: {
    base_version: "1.0.2",
    branch_commit: "b",
    live_network_id: "n_v1_0_2",
    main_commit: "m",
    network_id: "n_v1_0_3",
    network_name: "Supply · 1.0.3",
    tag: "v1.0.3",
  },
  risks: { copies: 1, existing: null, only_additions: true, orphans: null },
  signature: "sig",
  version: "1.0.3",
};

describe("release.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads a release review, null lists as empty", async () => {
    const { getReleaseReview } = await importService();
    mockGet.mockResolvedValue({ data: backendReview });

    const review = await getReleaseReview("p/1", "1.0.3");

    expect(mockGet).toHaveBeenCalledWith(`${prefix}/release-review`, {
      params: { version: "1.0.3" },
      skipErrorToast: true,
    });
    expect(review).toEqual({
      accepts: ["index_not_ready"],
      blocked: false,
      capabilities: [{ copy: true, id: "f1", kind: "function", name: "Late orders", reasons: [] }],
      changes: {
        added: [{ id: "orders", kind: "object_type", name: "Orders" }],
        changed: [],
        other: 2,
        removed: [],
      },
      checks: [
        { code: "confirmed", passed: true },
        {
          accept: "index_not_ready",
          code: "index",
          details: { not_configured: 1, ready: 3 },
          passed: false,
          reason: "index_not_ready",
        },
      ],
      questions: {
        affected: [],
        answerableNew: [{ id: "q1", missing: [], text: "Which orders are late?", unconnected: [] }],
        total: 2,
        unanswerable: [
          {
            id: "q2",
            missing: [{ id: "bom", kind: "object_type", name: "BOM" }],
            text: "Which products use P-100?",
            unconnected: [
              {
                from: { id: "orders", kind: "object_type", name: "Orders" },
                to: { id: "parts", kind: "object_type", name: "Parts" },
              },
            ],
          },
        ],
        unjudged: 0,
      },
      refusals: [],
      release: { baseVersion: "1.0.2", networkId: "n_v1_0_3", networkName: "Supply · 1.0.3" },
      risks: { copies: 1, existing: [], onlyAdditions: true, orphans: [] },
      signature: "sig",
      version: "1.0.3",
    });
  });

  it("publishes with the review's signature and what is accepted", async () => {
    const { publishRelease } = await importService();
    mockPost.mockResolvedValue({ data: { network_id: "n_v1_0_3", tag: "v1.0.3" } });

    expect(
      await publishRelease("p/1", {
        accepts: ["index_not_ready"],
        notes: "Adds orders",
        signature: "sig",
        version: "1.0.3",
      }),
    ).toEqual({ networkId: "n_v1_0_3" });
    expect(mockPost).toHaveBeenCalledWith(
      `${prefix}/releases`,
      { accepts: ["index_not_ready"], notes: "Adds orders", signature: "sig", version: "1.0.3" },
      { skipErrorToast: true },
    );
  });

  it("reads every release of a lineage, page after page", async () => {
    const { listReleases } = await importService();
    const release = (version: string) => ({
      create_time: 1,
      network_id: `n_${version}`,
      notes: "",
      project_id: "p/1",
      publisher: { id: "u1", type: "user" },
      state: "archived",
      version,
    });
    mockGet
      .mockResolvedValueOnce({ data: { entries: [release("1.0.1")], next_cursor: "c2" } })
      .mockResolvedValueOnce({ data: { entries: [release("1.0.0")], next_cursor: null } });

    const releases = await listReleases("lin");

    expect(releases.map((entry) => entry.version)).toEqual(["1.0.1", "1.0.0"]);
    expect(releases[0]).toEqual({
      createTime: 1,
      networkId: "n_1.0.1",
      notes: "",
      projectId: "p/1",
      publisherId: "u1",
      state: "archived",
      version: "1.0.1",
    });
    expect(mockGet).toHaveBeenLastCalledWith("/bkn-project/v1/lineages/lin/releases", {
      params: { cursor: "c2", limit: 100 },
      skipErrorToast: true,
    });
  });

  it("reads what switching would move, then switches", async () => {
    const { getSwitchPlan, switchConsumers } = await importService();
    mockGet.mockResolvedValue({
      data: {
        from_network_id: "n_v1_0_1",
        lineage_id: "lin",
        schedules: [{ id: "s1", name: "Nightly" }],
        to_network_id: "n_v1_0_2",
      },
    });
    mockPost.mockResolvedValue({ data: {} });

    expect(await getSwitchPlan("p/1", "n_v1_0_2")).toEqual({
      fromNetworkId: "n_v1_0_1",
      schedules: [{ id: "s1", name: "Nightly" }],
      toNetworkId: "n_v1_0_2",
    });
    expect(mockGet).toHaveBeenCalledWith(`${prefix}/switch-plan`, {
      params: { to_network_id: "n_v1_0_2" },
      skipErrorToast: true,
    });
    await switchConsumers("p/1", "n_v1_0_2");
    expect(mockPost).toHaveBeenCalledWith(
      `${prefix}/switches`,
      { to_network_id: "n_v1_0_2" },
      { skipErrorToast: true },
    );
  });
});
