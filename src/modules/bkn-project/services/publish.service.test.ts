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
  return import("@/modules/bkn-project/services/publish.service");
}

function httpError(status: number, code: string, details?: unknown) {
  return new AxiosError(code, "ERR_BAD_REQUEST", undefined, undefined, {
    data: { description: code, error_code: code, error_details: details },
    status,
  } as AxiosResponse);
}

const prefix = "/bkn-project/v1/projects/p%2F1";

describe("publish.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads the status, null lists as empty", async () => {
    const { getProjectStatus } = await importService();
    mockGet.mockResolvedValue({
      data: {
        blockers: null,
        computed_at: 1,
        confirmation: { commit: "c1", current: false, time: 20 },
        draft: { decisions: 2, placeholders: 0, status: "ready", update_time: 30 },
        links: {},
        next_actions: [
          {
            accepts: ["undecided_items"],
            action: "confirm_draft",
            allowed: false,
            method: "POST",
            path: "x",
            reason: "not_owner",
          },
        ],
        project_id: "p/1",
        stage: "ready_to_confirm",
        stale: ["confirmation_outdated"],
        undecided: 3,
      },
    });

    const status = await getProjectStatus("p/1");

    expect(mockGet).toHaveBeenCalledWith(`${prefix}/status`, { skipErrorToast: true });
    expect(status).toEqual({
      blockers: [],
      check: null,
      confirmation: { current: false, time: 20 },
      draft: { decisions: 2, placeholders: 0, status: "ready", updateTime: 30 },
      nextActions: [
        {
          accepts: ["undecided_items"],
          action: "confirm_draft",
          allowed: false,
          discardsDecisions: 0,
          reason: "not_owner",
        },
      ],
      stage: "ready_to_confirm",
      stale: ["confirmation_outdated"],
      undecided: 3,
    });
  });

  it("reads the pending items; none before the first draft", async () => {
    const { getProjectPending } = await importService();
    mockGet.mockResolvedValueOnce({
      data: {
        draft_update_time: 30,
        items: [
          {
            blocking: false,
            because: "few_values",
            item_id: "r1",
            kind: "relation_types",
            name: "Orders to customers",
            options: [],
            reason: "undecided",
            recommendation: null,
          },
        ],
        project_id: "p/1",
      },
    });

    expect(await getProjectPending("p/1")).toEqual({
      draftUpdateTime: 30,
      items: [
        {
          blocking: false,
          because: "few_values",
          itemId: "r1",
          kind: "relation_types",
          name: "Orders to customers",
          reason: "undecided",
        },
      ],
    });
    expect(mockGet).toHaveBeenCalledWith(`${prefix}/pending`, { skipErrorToast: true });

    mockGet.mockRejectedValueOnce(httpError(404, "BknProject.Draft.NotFound"));
    expect(await getProjectPending("p/1")).toEqual({ draftUpdateTime: 0, items: [] });
  });

  it("reads how many requirement conflicts confirming leaves, and accepts them", async () => {
    const { confirmDraft, getProjectStatus, mockDraft } = {
      ...(await importService()),
      ...(await import("@/modules/bkn-project/services/draft.service")),
    };
    mockGet.mockResolvedValue({
      data: {
        blockers: [],
        next_actions: [
          {
            accepts: ["unresolved_conflicts"],
            action: "confirm_draft",
            allowed: true,
            unresolved_conflicts: 2,
          },
        ],
        stage: "ready_to_confirm",
        stale: [],
        undecided: 0,
      },
    });
    mockPost.mockResolvedValue({ data: mockDraft("p/1") });

    const status = await getProjectStatus("p/1");
    expect(status.nextActions[0]).toMatchObject({
      accepts: ["unresolved_conflicts"],
      unresolvedConflicts: 2,
    });
    await confirmDraft("p/1", { acceptUnresolvedConflicts: true, updateTime: 30 });
    expect(mockPost).toHaveBeenCalledWith(
      `${prefix}/ontology/draft:confirm`,
      expect.objectContaining({ accept_unresolved_conflicts: true }),
      { skipErrorToast: true },
    );
  });

  it("confirms with only what the owner accepted", async () => {
    const { confirmDraft } = await importService();
    const { mockDraft } = await import("@/modules/bkn-project/services/draft.service");
    mockPost.mockResolvedValue({ data: mockDraft("p/1") });

    const draft = await confirmDraft("p/1", { acceptUndecided: true, updateTime: 30 });

    expect(mockPost).toHaveBeenCalledWith(
      `${prefix}/ontology/draft:confirm`,
      {
        accept_partial: false,
        accept_undecided: true,
        accept_unresolved_conflicts: false,
        update_time: 30,
      },
      { skipErrorToast: true },
    );
    expect(draft.status).toBe("ready");
  });

  it("reads the check, null results while counting, and none before the first", async () => {
    const { getOntologyCheck } = await importService();
    mockGet.mockResolvedValueOnce({
      data: {
        attempt: 1,
        commit: "c1",
        error: "",
        finish_time: 0,
        project_id: "p/1",
        results: null,
        runner: { id: "u1", type: "user" },
        start_time: 10,
        status: "running",
      },
    });
    expect(await getOntologyCheck("p/1")).toEqual({
      attempt: 1,
      error: "",
      finishTime: 0,
      results: null,
      startTime: 10,
      status: "running",
    });
    expect(mockGet).toHaveBeenCalledWith(`${prefix}/ontology/check`, { skipErrorToast: true });

    mockGet.mockResolvedValueOnce({
      data: {
        attempt: 2,
        error: "",
        finish_time: 20,
        results: {
          coverage: { counted: 2, total: 3 },
          excluded_mapped: null,
          keys: [
            {
              duplicates: 1,
              fields: ["id"],
              nulls: 0,
              object_type: "customers",
              rows: 9,
              state: "counted",
            },
          ],
          relations: [
            {
              joins: [
                {
                  hit_rate: 0.5,
                  nulls: 0,
                  object_type: "customers",
                  orphans: 0,
                  reason: "cross_catalog",
                  rows: 0,
                  state: "not_counted",
                },
              ],
              relation_type: "r1",
            },
          ],
        },
        start_time: 10,
        status: "issues",
      },
    });
    const check = await getOntologyCheck("p/1");
    expect(check?.results).toEqual({
      coverage: { counted: 2, total: 3 },
      excludedMapped: [],
      keys: [
        {
          duplicates: 1,
          fields: ["id"],
          nulls: 0,
          objectType: "customers",
          rows: 9,
          state: "counted",
        },
      ],
      relations: [
        {
          joins: [
            {
              hitRate: 0.5,
              nulls: 0,
              objectType: "customers",
              orphans: 0,
              reason: "cross_catalog",
              rows: 0,
              state: "not_counted",
            },
          ],
          relationType: "r1",
        },
      ],
    });

    mockGet.mockRejectedValueOnce(httpError(404, "BknProject.Check.NotFound"));
    expect(await getOntologyCheck("p/1")).toBeNull();
  });

  it("runs the check again", async () => {
    const { runOntologyCheck } = await importService();
    mockPost.mockResolvedValue({
      data: {
        attempt: 1,
        error: "",
        finish_time: 0,
        results: null,
        start_time: 5,
        status: "running",
      },
    });

    expect((await runOntologyCheck("p/1")).status).toBe("running");
    expect(mockPost).toHaveBeenCalledWith(`${prefix}/ontology/check:run`, undefined, {
      skipErrorToast: true,
    });
  });

  it("reads and rebuilds the index readiness with each table's build", async () => {
    const { buildOntologyIndex, getOntologyIndex } = await importService();
    const reply = {
      data: {
        counts: { not_configured: 1, ready: 1 },
        object_types: [
          {
            build: { outcome: "created", task_id: "t1", time: 5 },
            id: "customers",
            name: "Customers",
            state: "ready",
            table: { catalog_id: "c", name: "customers", resource_id: "r" },
          },
          {
            build: { outcome: "not_configurable", reason: "incremental_fields", time: 5 },
            id: "orders",
            missing: ["incremental_fields"],
            name: "Orders",
            state: "not_configured",
            table: { catalog_id: "c", name: "orders", resource_id: "r2" },
            task: { id: "t2", status: "running" },
          },
        ],
        tasks_visible: false,
      },
    };
    mockGet.mockResolvedValueOnce(reply);
    mockPost.mockResolvedValueOnce(reply);

    const index = await getOntologyIndex("p/1");
    expect(mockGet).toHaveBeenCalledWith(`${prefix}/ontology/index`, { skipErrorToast: true });
    expect(index).toEqual({
      counts: { not_configured: 1, ready: 1 },
      objectTypes: [
        {
          build: { outcome: "created", time: 5 },
          id: "customers",
          missing: [],
          name: "Customers",
          state: "ready",
          table: { catalogId: "c", name: "customers", resourceId: "r" },
          task: null,
        },
        {
          build: { outcome: "not_configurable", reason: "incremental_fields", time: 5 },
          id: "orders",
          missing: ["incremental_fields"],
          name: "Orders",
          state: "not_configured",
          table: { catalogId: "c", name: "orders", resourceId: "r2" },
          task: { id: "t2", status: "running" },
        },
      ],
      tasksVisible: false,
    });

    expect(await buildOntologyIndex("p/1")).toEqual(index);
    expect(mockPost).toHaveBeenCalledWith(`${prefix}/ontology/index:build`, undefined, {
      skipErrorToast: true,
    });

    mockGet.mockRejectedValueOnce(httpError(404, "BknProject.Draft.NotFound"));
    expect(await getOntologyIndex("p/1")).toBeNull();
  });

  it("asks for semantic understanding and reads its progress", async () => {
    const { getUnderstanding, understandCatalogs } = await importService();
    mockPost.mockResolvedValue({
      data: { catalogs: [{ catalog_id: "c", permitted: false, tables: 0 }] },
    });
    mockGet.mockResolvedValue({
      data: {
        catalogs: [
          {
            catalog_id: "c",
            counts: { completed: 1 },
            tables: [{ name: "orders", resource_id: "r", status: "completed" }],
            visible: true,
          },
          { catalog_id: "d", counts: {}, visible: false },
        ],
      },
    });

    expect(await understandCatalogs("p/1", { all: true, applyMode: "force" })).toEqual([
      { catalogId: "c", permitted: false, tables: 0 },
    ]);
    expect(mockPost).toHaveBeenCalledWith(
      `${prefix}/catalogs:understand`,
      { all: true, apply_mode: "force" },
      { skipErrorToast: true },
    );
    expect(await getUnderstanding("p/1")).toEqual([
      {
        catalogId: "c",
        counts: { completed: 1 },
        tables: [
          {
            applied: false,
            finishTime: null,
            name: "orders",
            resourceId: "r",
            status: "completed",
          },
        ],
        visible: true,
      },
      { catalogId: "d", counts: {}, tables: [], visible: false },
    ]);
    expect(mockGet).toHaveBeenCalledWith(`${prefix}/catalogs/understanding`, {
      skipErrorToast: true,
    });
  });

  it("reads bkn-project's code and details from a refusal", async () => {
    const { projectErrorCode, projectErrorDetails } = await importService();
    const refusal = httpError(409, "BknProject.Draft.UndecidedNotAccepted", ["relation_types/r1"]);

    expect(projectErrorCode(refusal)).toBe("Draft.UndecidedNotAccepted");
    expect(projectErrorDetails(refusal)).toEqual(["relation_types/r1"]);
    expect(projectErrorCode(httpError(500, "Public.InternalError"))).toBeUndefined();
    expect(projectErrorCode(new Error("network"))).toBeUndefined();
    expect(projectErrorDetails(new Error("network"))).toBeUndefined();
  });

  it("mocks confirming, then checks and builds what was confirmed", async () => {
    const service = await importService("true");
    const { editDraftItem, getDraft } =
      await import("@/modules/bkn-project/services/draft.service");
    vi.useFakeTimers();
    try {
      const settle = async <T>(promise: Promise<T>) => {
        // Caught at once so a refusal is not reported as unhandled while the timers run.
        const outcome = promise.then(
          (value) => ({ value }),
          (error: unknown) => ({ error }),
        );
        await vi.runAllTimersAsync();
        const result = await outcome;
        if ("error" in result) {
          throw result.error;
        }
        return result.value;
      };
      expect(await settle(service.getOntologyCheck("p-001"))).toBeNull();
      const draft = (await settle(getDraft("p-001")))!;
      expect((await settle(service.getProjectStatus("p-001"))).confirmation).toBeNull();

      // The mock draft waits on decisions, as bkn-project would refuse it.
      const refused = await settle(
        service.confirmDraft("p-001", { acceptUndecided: true, updateTime: draft.updateTime }),
      ).catch((error: unknown) => error);
      expect(service.projectErrorCode(refused)).toBe("Draft.HasPending");
      const pending = await settle(service.getProjectPending("p-001"));
      let updateTime = draft.updateTime;
      for (const item of pending.items.filter((candidate) => candidate.blocking)) {
        const next = await settle(
          editDraftItem(
            "p-001",
            item.kind as "object_types" | "relation_types",
            item.itemId,
            updateTime,
            { adopted: false },
          ),
        );
        updateTime = next.updateTime;
      }

      await settle(
        service.confirmDraft("p-001", { acceptPartial: true, acceptUndecided: true, updateTime }),
      );

      const after = await settle(service.getProjectStatus("p-001"));
      expect(after.confirmation?.current).toBe(true);
      expect(after.stage).toBe("checking");
      expect((await settle(service.getOntologyCheck("p-001")))?.status).toBe("running");
      const index = await settle(service.getOntologyIndex("p-001"));
      expect(index?.objectTypes.length).toBeGreaterThan(0);
      expect(index?.objectTypes.every((item) => item.build)).toBe(true);

      // Checking again starts a new check only: the confirmation and its builds stay as they were.
      await vi.advanceTimersByTimeAsync(10_000);
      await settle(service.runOntologyCheck("p-001"));
      const rechecked = await settle(service.getProjectStatus("p-001"));
      expect(rechecked.confirmation?.time).toBe(after.confirmation?.time);
      expect(rechecked.check?.status).toBe("running");
      const rebuilt = await settle(service.getOntologyIndex("p-001"));
      expect(rebuilt?.objectTypes.some((item) => item.state === "ready")).toBe(true);
      expect(rebuilt?.objectTypes.some((item) => item.state === "building")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("mocks understanding the draft's own tables, by their catalog", async () => {
    const service = await importService("true");
    const { getDraft } = await import("@/modules/bkn-project/services/draft.service");
    vi.useFakeTimers();
    try {
      const settle = async <T>(promise: Promise<T>) => {
        await vi.runAllTimersAsync();
        return promise;
      };
      const draft = (await settle(getDraft("p-001")))!;
      await settle(service.understandCatalogs("p-001"));
      const [catalog] = await settle(service.getUnderstanding("p-001"));

      expect(catalog.catalogId).toBe("cat-001");
      expect(catalog.tables.map((table) => table.resourceId)).toEqual(
        draft.items.objectTypes
          .filter((item) => item.table.catalogId === "cat-001")
          .map((item) => item.table.resourceId),
      );
      expect(
        catalog.tables
          .filter((table) => table.status !== "completed")
          .every((table) => table.finishTime === null),
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
