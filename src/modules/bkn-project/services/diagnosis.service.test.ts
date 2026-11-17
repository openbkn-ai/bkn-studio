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
async function importService() {
  vi.stubEnv("VITE_USE_MOCK", "false");
  vi.resetModules();
  return import("@/modules/bkn-project/services/diagnosis.service");
}

const prefix = "/bkn-project/v1/projects/p%2F1/ontology/diagnosis";

const refusal = (code: string, status: number) =>
  new AxiosError(code, "ERR_BAD_REQUEST", undefined, undefined, {
    data: { description: code, error_code: code },
    status,
  } as AxiosResponse);

describe("diagnosis.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads the diagnosis, its suggestions ranked and their apply payloads by kind", async () => {
    const service = await importService();
    mockGet.mockResolvedValueOnce({
      data: {
        components: [["a", "b"], ["c"]],
        computed_at: 5,
        draft_update_time: 9,
        metrics: {
          connectivity: { components: 2, largest: 2, objects: 3 },
          pending_concepts: 1,
          reachability: { reachable: 1, total: 2 },
          references: { covered: 0, total: 1 },
        },
        run_id: "r1",
        stale: true,
        state: "ready",
        suggestions: [
          {
            apply: {
              actions: [{ kind: "modify", name: "End", parameters: ["outcome"] }],
              name: "Task",
              properties: [
                { display_name: "Outcome", name: "outcome", role: "outcome", type: "string" },
              ],
              tracked_object_type_id: "a",
            },
            group: "object",
            id: "w",
            kind: "writeback_object",
            rank: 2,
            title: "Task",
          },
          {
            apply: {
              mapping: [{ source_property: "x", target_property: "y" }],
              name: "Rel",
              source: "c",
              target: "a",
            },
            evidence: {
              condition: { field: "kind", value: "plan" },
              hits: 3,
              quotes: [{ document_id: "d", text: "q" }],
              rows: 4,
              source_field: "x",
              target_field: "y",
            },
            group: "connect",
            id: "r",
            impact: { connects: ["c"], questions: ["q-1"] },
            kind: "create_relation",
            rank: 1,
            reason: "Because.",
            status: "open",
            title: "C to A",
          },
          { apply: null, group: "data", id: "d", kind: "data_quality", rank: 3, title: "Gaps" },
        ],
      },
    });

    const read = await service.getDiagnosis("p/1");

    expect(mockGet).toHaveBeenCalledWith(prefix, { skipErrorToast: true });
    expect(read).toMatchObject({
      components: [["a", "b"], ["c"]],
      draftUpdateTime: 9,
      metrics: { pendingConcepts: 1 },
      stale: true,
      state: "ready",
    });
    expect(read!.suggestions.map((item) => item.id)).toEqual(["r", "w", "d"]);
    expect(read!.suggestions[0]).toMatchObject({
      apply: {
        kind: "create_relation",
        mapping: [{ sourceProperty: "x", targetProperty: "y" }],
        source: "c",
        target: "a",
      },
      evidence: {
        condition: { field: "kind", value: "plan" },
        quotes: [{ documentId: "d", text: "q" }],
        sourceField: "x",
        targetField: "y",
      },
      impact: { connects: ["c"], questions: ["q-1"] },
    });
    expect(read!.suggestions[1].apply).toMatchObject({
      actions: [{ kind: "modify", name: "End", parameters: ["outcome"] }],
      kind: "writeback_object",
      properties: [{ displayName: "Outcome", name: "outcome", role: "outcome" }],
      trackedObjectTypeId: "a",
    });
    expect(read!.suggestions[2]).toMatchObject({ apply: null, status: "open" });
  });

  it("reads no diagnosis before the first run", async () => {
    const service = await importService();
    mockGet.mockRejectedValueOnce(refusal("BknProject.Diagnosis.NotFound", 404));
    await expect(service.getDiagnosis("p/1")).resolves.toBeNull();
  });

  it("runs, applies against the draft as read, and dismisses with a reason", async () => {
    const service = await importService();
    mockPost.mockResolvedValueOnce({ data: { run_id: "r2", state: "running" } });
    await expect(service.runDiagnosis("p/1")).resolves.toEqual({ runId: "r2" });
    expect(mockPost).toHaveBeenLastCalledWith(`${prefix}:run`, {}, { skipErrorToast: true });

    mockPost.mockResolvedValueOnce({
      data: {
        draft_update_time: 11,
        suggestion: {
          group: "connect",
          id: "s/1",
          kind: "adopt_relation",
          rank: 1,
          title: "T",
          status: "applied",
          apply: { relation_type_id: "rt" },
        },
      },
    });
    const applied = await service.applySuggestion("p/1", "s/1", 10);
    expect(mockPost).toHaveBeenLastCalledWith(
      `${prefix}/suggestions/s%2F1:apply`,
      { draft_update_time: 10 },
      { skipErrorToast: true },
    );
    expect(applied).toMatchObject({
      draftUpdateTime: 11,
      suggestion: { apply: { kind: "adopt_relation", relationTypeId: "rt" }, status: "applied" },
    });

    mockPost.mockResolvedValueOnce({ data: {} });
    await service.dismissSuggestion("p/1", "s1", "  not needed ");
    expect(mockPost).toHaveBeenLastCalledWith(
      `${prefix}/suggestions/s1:dismiss`,
      { reason: "not needed" },
      { skipErrorToast: true },
    );
    mockPost.mockResolvedValueOnce({ data: {} });
    await service.dismissSuggestion("p/1", "s1");
    expect(mockPost).toHaveBeenLastCalledWith(
      `${prefix}/suggestions/s1:dismiss`,
      {},
      {
        skipErrorToast: true,
      },
    );
  });

  it("names a refusal without bkn-project's prefix", async () => {
    const service = await importService();
    expect(service.diagnosisErrorCode(refusal("BknProject.Diagnosis.Running", 409))).toBe(
      "Diagnosis.Running",
    );
    expect(service.diagnosisErrorCode(refusal("BknProject.Draft.Stale", 409))).toBe("Draft.Stale");
    expect(service.diagnosisErrorCode(refusal("BknProject.Project.NotFound", 404))).toBeUndefined();
  });
});
