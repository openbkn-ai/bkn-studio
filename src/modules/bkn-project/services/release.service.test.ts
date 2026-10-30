/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AxiosError, type AxiosResponse } from "axios";
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

  it("stops paging when the cursor does not move on", async () => {
    const { listReleases } = await importService();
    const page = (version: string) => ({
      data: {
        entries: [
          {
            create_time: 1,
            network_id: `n_${version}`,
            notes: "",
            project_id: "p",
            publisher: null,
            state: "live",
            version,
          },
        ],
        next_cursor: "same",
      },
    });
    mockGet.mockResolvedValueOnce(page("1.0.1")).mockResolvedValueOnce(page("1.0.0"));

    expect((await listReleases("lin")).map((entry) => entry.version)).toEqual(["1.0.1", "1.0.0"]);
    expect(mockGet).toHaveBeenCalledTimes(2);
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

  it("reads a release's regression, null lists as empty, and none before the first run", async () => {
    const { getRegression, runRegression } = await importService();
    mockGet.mockResolvedValueOnce({
      data: {
        attempt: 1,
        error: "",
        finish_time: 9,
        network_id: "n_v1_0_2",
        project_id: "p/1",
        questions: [
          {
            id: "q1",
            needs: [],
            tests: [{ expect: "exists", id: "t1", text: "C-1?" }],
            text: "Q1",
          },
          { id: "q7", needs: [], text: "Q7" },
        ],
        results: [
          {
            answer: "A",
            outcome: "passed",
            question_id: "q1",
            reason: "R",
            test_id: "t1",
            tool_uses: [{ input: {}, name: "query", status: "succeeded" }],
            used_needs: [],
            verdict: "answered",
          },
          { error_code: "unreachable", outcome: "error", question_id: "q7", tool_uses: null },
        ],
        runner: { id: "u1", type: "user" },
        start_time: 1,
        status: "not_passed",
        version: "1.0.2",
      },
    });

    expect(await getRegression("p/1", "n_v1_0_2")).toEqual({
      attempt: 1,
      error: "",
      finishTime: 9,
      networkId: "n_v1_0_2",
      questions: [
        { id: "q1", tests: [{ expect: "exists", id: "t1", text: "C-1?" }], text: "Q1" },
        { id: "q7", tests: [], text: "Q7" },
      ],
      results: [
        {
          answer: "A",
          errorCode: "",
          missing: [],
          outcome: "passed",
          questionId: "q1",
          reason: "R",
          testId: "t1",
          toolStatuses: ["succeeded"],
        },
        {
          answer: "",
          errorCode: "unreachable",
          missing: [],
          outcome: "error",
          questionId: "q7",
          reason: "",
          testId: "",
          toolStatuses: [],
        },
      ],
      runnerId: "u1",
      startTime: 1,
      status: "not_passed",
      version: "1.0.2",
    });
    expect(mockGet).toHaveBeenCalledWith(`${prefix}/releases/n_v1_0_2/regression`, {
      skipErrorToast: true,
    });

    mockGet.mockRejectedValueOnce(
      new AxiosError("x", "ERR_BAD_REQUEST", undefined, undefined, {
        data: { error_code: "BknProject.Release.RegressionNotFound" },
        status: 404,
      } as AxiosResponse),
    );
    expect(await getRegression("p/1", "n_v1_0_2")).toBeNull();

    mockPost.mockResolvedValue({
      data: { network_id: "n_v1_0_2", questions: [], results: null, status: "running" },
    });
    expect((await runRegression("p/1", "n_v1_0_2")).status).toBe("running");
    expect(mockPost).toHaveBeenCalledWith(`${prefix}/releases/n_v1_0_2/regression:run`, undefined, {
      skipErrorToast: true,
    });
  });

  it("reads the rollback plan, null lists as empty, and rolls back with its signature", async () => {
    const { getRollbackPlan, rollBack } = await importService();
    mockGet.mockResolvedValueOnce({
      data: {
        consumers: ["agents"],
        from: { base: false, network_id: "n_v1_0_1", version: "1.0.1" },
        questions: {
          affected: null,
          answerable_new: null,
          total: 1,
          unanswerable: [
            { id: "q1", missing: [{ id: "bom", kind: "object_type", name: "BOM" }], text: "Q1" },
          ],
          unjudged: 0,
        },
        refusals: null,
        schedules: [{ name: "Nightly" }],
        signature: "sig",
        to: { base: true, network_id: "n" },
      },
    });
    expect(await getRollbackPlan("p/1")).toEqual({
      consumers: ["agents"],
      from: { base: false, networkId: "n_v1_0_1", version: "1.0.1" },
      questions: {
        affected: [],
        answerableNew: [],
        total: 1,
        unanswerable: [
          {
            id: "q1",
            missing: [{ id: "bom", kind: "object_type", name: "BOM" }],
            text: "Q1",
            unconnected: [],
          },
        ],
        unjudged: 0,
      },
      refusals: [],
      schedules: [{ id: "0", name: "Nightly" }],
      signature: "sig",
      to: { base: true, networkId: "n", version: "" },
    });
    expect(mockGet).toHaveBeenCalledWith(`${prefix}/rollback-plan`, { skipErrorToast: true });

    mockGet.mockResolvedValueOnce({
      data: {
        consumers: null,
        from: { base: true, network_id: "n" },
        refusals: [{ code: "Rollback.NoPrevious" }],
        schedules: null,
        signature: "s2",
      },
    });
    const none = await getRollbackPlan("p/1");
    expect(none.to).toBeNull();
    expect(none.refusals).toEqual(["Rollback.NoPrevious"]);

    mockPost.mockResolvedValueOnce({ data: {} });
    await rollBack("p/1", "sig");
    expect(mockPost).toHaveBeenCalledWith(
      `${prefix}/rollbacks`,
      { signature: "sig" },
      { skipErrorToast: true },
    );
  });
});
