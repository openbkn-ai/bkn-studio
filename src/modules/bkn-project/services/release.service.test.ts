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
  risks: {
    copies: 1,
    existing: null,
    only_additions: true,
    orphans: null,
    unimplemented_needs: [{ id: "n2", kind: "skill", name: "Triage" }],
  },
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
      release: {
        baseVersion: "1.0.2",
        networkId: "n_v1_0_3",
        networkName: "Supply · 1.0.3",
        runningLabel: "",
        runningVersion: 0,
      },
      risks: {
        copies: 1,
        existing: [],
        onlyAdditions: true,
        orphans: [],
        unimplementedNeeds: [{ id: "n2", kind: "skill", name: "Triage" }],
      },
      signature: "sig",
      version: "1.0.3",
    });
  });

  it("prepares with the review's signature and what is accepted, then publishes", async () => {
    const { prepareRelease, publishRelease } = await importService();
    mockPost.mockResolvedValueOnce({ data: { state: "prepared", version: "1.0.3" } });

    await prepareRelease("p/1", {
      accepts: ["index_not_ready"],
      overwriteDraftChanges: true,
      signature: "sig",
      version: "1.0.3",
    });
    expect(mockPost).toHaveBeenCalledWith(
      `${prefix}/releases/1.0.3/prepare`,
      { accepts: ["index_not_ready"], overwrite_draft_changes: true, signature: "sig" },
      { skipErrorToast: true },
    );

    mockPost.mockResolvedValueOnce({ data: { kn_version: 8, network_id: "n", purged_version: 6 } });
    expect(
      await publishRelease("p/1", {
        allowOutdatedBase: true,
        notes: "Adds orders",
        version: "1.0.3",
      }),
    ).toEqual({ knVersion: 8, purgedVersion: 6 });
    expect(mockPost).toHaveBeenLastCalledWith(
      `${prefix}/releases`,
      { allow_outdated_base: true, notes: "Adds orders", version: "1.0.3" },
      { skipErrorToast: true },
    );
  });

  it("reads the versions of the project's network, null lists as empty", async () => {
    const { getProjectVersions } = await importService();
    mockGet.mockResolvedValueOnce({
      data: {
        entries: [
          {
            base_version: 6,
            publish_time: 5,
            label: "v1.3.0",
            notes: "N",
            origin: "project",
            publisher: { id: "u1", type: "user" },
            release: "1.3.0",
            status: "running",
            version: 7,
          },
          {
            base_version: 3,
            publish_time: 4,
            label: "",
            notes: "",
            origin: "workspace",
            publisher: null,
            status: "deprecated",
            version: 4,
          },
        ],
        prepared: { publisher: { id: "u1" }, state: "prepared", update_time: 9, version: "1.4.0" },
        versioning: {
          draft: { base_version: 7, has_changes: true, outdated: false, revision: 3 },
          enabled: true,
          full_history: false,
          previous_version: 6,
          running_version: 7,
        },
      },
    });
    expect(await getProjectVersions("p/1")).toEqual({
      entries: [
        {
          baseVersion: 6,
          createTime: 5,
          label: "v1.3.0",
          notes: "N",
          origin: "project",
          publisherId: "u1",
          release: "1.3.0",
          status: "running",
          version: 7,
        },
        {
          baseVersion: 3,
          createTime: 4,
          label: "",
          notes: "",
          origin: "workspace",
          publisherId: "",
          release: "",
          status: "deprecated",
          version: 4,
        },
      ],
      prepared: { publisherId: "u1", updateTime: 9, version: "1.4.0" },
      versioning: {
        draft: { baseVersion: 7, hasChanges: true, outdated: false },
        fullHistory: false,
        previousVersion: 6,
        runningVersion: 7,
      },
    });
    expect(mockGet).toHaveBeenCalledWith(`${prefix}/versions`, { skipErrorToast: true });

    mockGet.mockResolvedValueOnce({
      data: {
        entries: null,
        versioning: { full_history: true, previous_version: 0, running_version: 0 },
      },
    });
    const empty = await getProjectVersions("p/1");
    expect(empty.entries).toEqual([]);
    expect(empty.prepared).toBeNull();
  });

  it("copies a version as the draft", async () => {
    const { copyVersion } = await importService();
    mockPost.mockResolvedValueOnce({ data: {} });
    await copyVersion("p/1", 5, false);
    expect(mockPost).toHaveBeenCalledWith(
      `${prefix}/versions/5/copy`,
      { overwrite_draft_changes: false },
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
        project_id: "p/1",
        questions: [
          {
            id: "q1",
            needs: [],
            tests: [{ expect: "exists", id: "t1", text: "C-1?" }],
            text: "Q1",
          },
          { id: "q7", needs: [], no_record: true, text: "Q7" },
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
          {
            missing_tables: [{ id: "ot_po", kind: "object_type", name: "PO" }],
            outcome: "data_source_missing",
            question_id: "q7",
          },
        ],
        runner: { id: "u1", type: "user" },
        start_time: 1,
        status: "not_passed",
        version: "1.0.2",
      },
    });

    expect(await getRegression("p/1", "1.0.2")).toEqual({
      attempt: 1,
      error: "",
      finishTime: 9,
      questions: [
        {
          id: "q1",
          noRecord: false,
          tests: [{ expect: "exists", id: "t1", text: "C-1?" }],
          text: "Q1",
        },
        { id: "q7", noRecord: true, tests: [], text: "Q7" },
      ],
      results: [
        {
          answer: "A",
          errorCode: "",
          missing: [],
          missingTables: [],
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
          missingTables: [],
          outcome: "error",
          questionId: "q7",
          reason: "",
          testId: "",
          toolStatuses: [],
        },
        {
          answer: "",
          errorCode: "",
          missing: [],
          missingTables: [{ id: "ot_po", kind: "object_type", name: "PO" }],
          outcome: "data_source_missing",
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
    expect(mockGet).toHaveBeenCalledWith(`${prefix}/releases/1.0.2/regression`, {
      skipErrorToast: true,
    });

    mockGet.mockRejectedValueOnce(
      new AxiosError("x", "ERR_BAD_REQUEST", undefined, undefined, {
        data: { error_code: "BknProject.Release.RegressionNotFound" },
        status: 404,
      } as AxiosResponse),
    );
    expect(await getRegression("p/1", "1.0.2")).toBeNull();

    mockPost.mockResolvedValue({
      data: { questions: [], results: null, status: "running" },
    });
    expect((await runRegression("p/1", "1.0.2")).status).toBe("running");
    expect(mockPost).toHaveBeenCalledWith(`${prefix}/releases/1.0.2/regression:run`, undefined, {
      skipErrorToast: true,
    });
  });

  it("reads the rollback plan, null lists as empty, and rolls back with its signature", async () => {
    const { getRollbackPlan, rollBack } = await importService();
    mockGet.mockResolvedValueOnce({
      data: {
        from: { kn_version: 7, label: "v1.3.0", version: "1.3.0" },
        full_history: true,
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
        signature: "sig",
        to: { kn_version: 4, label: "" },
      },
    });
    expect(await getRollbackPlan("p/1", 4)).toEqual({
      from: { knVersion: 7, label: "v1.3.0", version: "1.3.0" },
      fullHistory: true,
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
      signature: "sig",
      to: { knVersion: 4, label: "", version: "" },
    });
    expect(mockGet).toHaveBeenCalledWith(`${prefix}/rollback-plan`, {
      params: { to_version: 4 },
      skipErrorToast: true,
    });

    mockGet.mockResolvedValueOnce({
      data: {
        from: { kn_version: 1, label: "v1.0.0" },
        full_history: false,
        refusals: [{ code: "Rollback.NoPrevious" }],
        signature: "s2",
      },
    });
    const none = await getRollbackPlan("p/1");
    expect(none.to).toBeNull();
    expect(none.refusals).toEqual(["Rollback.NoPrevious"]);
    expect(mockGet).toHaveBeenLastCalledWith(`${prefix}/rollback-plan`, {
      params: undefined,
      skipErrorToast: true,
    });

    mockPost.mockResolvedValueOnce({ data: {} });
    await rollBack("p/1", "sig", 4);
    expect(mockPost).toHaveBeenCalledWith(
      `${prefix}/rollbacks`,
      { signature: "sig", to_version: 4 },
      { skipErrorToast: true },
    );
  });

  it("prepares, publishes and rolls back in the mock, versions following", async () => {
    const { getProjectVersions, getRollbackPlan, publishRelease, rollBack } =
      await importService("true");
    const before = await getProjectVersions("p-001");
    expect(before.versioning.runningVersion).toBe(1);
    // Publishing waits for a prepared release.
    await expect(
      publishRelease("p-001", { allowOutdatedBase: false, notes: "", version: "9.9.9" }),
    ).rejects.toBeTruthy();
    const plan = await getRollbackPlan("p-001");
    expect(plan.refusals).toEqual(["Rollback.NoPrevious"]);
    await expect(rollBack("p-001", "other", 1)).rejects.toBeTruthy();
  });
});
