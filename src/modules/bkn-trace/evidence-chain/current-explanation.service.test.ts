/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, expect, it, vi } from "vitest";
const runtime = vi.hoisted(() => ({ apiBaseUrl: "/api", currentUser: { id: "owner" } }));
vi.mock("@/framework/runtime/config", () => ({ getRuntimeConfig: () => runtime }));
const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
vi.mock("@/framework/request/http", () => ({ http: { get, post } }));
import { generateCurrentExplanation, readCurrentExplanation } from "./current-explanation.service";
beforeEach(() => {
  sessionStorage.clear();
  runtime.currentUser.id = "owner";
  get.mockReset();
  post.mockReset();
});
it("reads without generating and submits no version parameters", async () => {
  const value = { data: { schema_version: "1", interaction_id: "i", status: "not_generated" } };
  get.mockResolvedValue(value);
  post.mockResolvedValue(value);
  await readCurrentExplanation("i");
  expect(post).not.toHaveBeenCalled();
  await generateCurrentExplanation("i", "en-US");
  expect(post).toHaveBeenCalledWith(
    "/agent-observability/v1/business-provenance/interactions/i/explanations",
    { locale: "en-US" },
    { headers: { Prefer: "respond-async" }, skipErrorToast: true, timeout: 30_000 },
  );
});
it("rejects another interaction and unsupported response versions", async () => {
  for (const data of [
    { schema_version: "2", interaction_id: "i", status: "not_generated" },
    { schema_version: "1", interaction_id: "other", status: "not_generated" },
  ]) {
    get.mockResolvedValue({ data });
    await expect(readCurrentExplanation("i")).rejects.toThrow();
  }
});
it("accepts independent support and attribution states from the internal projection", async () => {
  get.mockResolvedValue({
    data: {
      schema_version: "1",
      interaction_id: "i",
      status: "ready",
      generated_at: "2026-09-13T00:00:00Z",
      view: {
        interactionId: "i",
        status: "completed",
        evidenceStatus: "complete",
        claims: [
          {
            id: "c",
            label: "Count",
            status: "located",
            supportStatus: "partial",
            attributionStatus: "reconstructed",
            nodeIds: ["u"],
          },
        ],
        execution: {
          nodes: [{ id: "op", label: "Query", kind: "query", status: "recorded_result" }],
          edges: [],
        },
        evidence: {
          nodes: [{ id: "u", label: "Semantic query", kind: "query", status: "partial" }],
          edges: [],
        },
      },
    },
  });
  await expect(readCurrentExplanation("i")).resolves.toMatchObject({
    status: "ready",
    view: {
      evidenceStatus: "complete",
      claims: [{ supportStatus: "partial", attributionStatus: "reconstructed" }],
    },
  });
});

it("rejects unknown semantic state values", async () => {
  get.mockResolvedValue({
    data: {
      schema_version: "1",
      interaction_id: "i",
      status: "ready",
      generated_at: "2026-09-13T00:00:00Z",
      view: {
        interactionId: "i",
        status: "completed",
        claims: [
          {
            id: "c",
            label: "Count",
            status: "located",
            supportStatus: "certain",
            attributionStatus: "reconstructed",
            nodeIds: [],
          },
        ],
        execution: { nodes: [], edges: [] },
        evidence: { nodes: [], edges: [] },
      },
    },
  });
  await expect(readCurrentExplanation("i")).rejects.toThrow("invalid conclusion");
});

it("rejects malformed question requirement coverage", async () => {
  get.mockResolvedValue({
    data: {
      schema_version: "1",
      interaction_id: "i",
      status: "ready",
      generated_at: "2026-09-13T00:00:00Z",
      view: {
        interactionId: "i",
        status: "completed",
        requirements: [{ id: "r", label: "库存是多少", status: "certain", claimIds: ["c"] }],
        claims: [
          {
            id: "c",
            label: "当前库存为 2 个",
            status: "located",
            supportStatus: "supported",
            attributionStatus: "reconstructed",
            nodeIds: ["u"],
            requirementIds: ["r"],
          },
        ],
        execution: { nodes: [], edges: [] },
        evidence: { nodes: [{ id: "u", label: "库存查询", kind: "query" }], edges: [] },
      },
    },
  });
  await expect(readCurrentExplanation("i")).rejects.toThrow("invalid question requirement");
});

it("accepts the 0.1.6 question-pair, function, graph, and deterministic time-rail contract", async () => {
  get.mockResolvedValue({
    data: {
      schema_version: "1",
      interaction_id: "i",
      status: "ready",
      generated_at: "2026-09-17T00:00:00Z",
      view: {
        interactionId: "i",
        status: "completed",
        generationStatus: "ready",
        claims: [
          {
            id: "c",
            label: "库存 9",
            status: "located",
            supportStatus: "supported",
            attributionStatus: "explicit",
            nodeIds: ["e"],
          },
        ],
        execution: { nodes: [], edges: [] },
        evidence: { nodes: [{ id: "e", label: "库存", kind: "result" }], edges: [] },
        questionPairs: [
          {
            id: "pair:r",
            question: "库存是多少",
            answer: "9",
            summary: "库存",
            status: "supported",
            claimIds: ["c"],
          },
        ],
        selectedPairGraphs: {
          "pair:r": {
            claims: [],
            evidenceNodes: [],
            schemaNodes: [],
            businessFunctions: [
              {
                id: "f",
                displayName: "汇总库存",
                capabilityKind: "sql_query",
                businessPurpose: "汇总",
                businessInputs: [],
                logicSummary: "求和",
                businessOutputs: [],
                operationIds: ["op"],
                supportsClaimIds: ["c"],
                schemaRefs: [],
                technicalExecution: { interfaceNames: ["run_sql"], completeness: "complete" },
                validationStatus: "verified",
              },
            ],
            executionSteps: [
              {
                id: "step:op:1",
                operationId: "op",
                attempt: 1,
                businessRole: "汇总",
                interfaceName: "run_sql",
                status: "completed",
                timeRailItemId: "time:op:1",
              },
            ],
            edges: [
              {
                edgeId: "edge",
                kind: "supports",
                fromId: "f",
                toId: "c",
                operationIds: ["op"],
                validationStatus: "verified",
              },
            ],
          },
        },
        timeRail: [
          {
            id: "time:op:1",
            order: 1,
            operation_id: "op",
            attempt: 1,
            interface_name: "run_sql",
            protocol: "mcp",
            status: "completed",
            started_at: "2026-09-17T00:00:00Z",
            input: { mode: "inline", media_type: "application/json", byte_length: 2, inline: {} },
          },
        ],
      },
    },
  });
  await expect(readCurrentExplanation("i")).resolves.toMatchObject({
    status: "ready",
    view: {
      generationStatus: "ready",
      questionPairs: [{ id: "pair:r" }],
      timeRail: [{ interface_name: "run_sql" }],
    },
  });
});

it("retains the saved generation language and treats legacy views as Chinese", async () => {
  const data = {
    schema_version: "1",
    interaction_id: "i",
    status: "ready",
    generated_at: "2026-10-21T00:00:00Z",
    view: {
      interactionId: "i",
      status: "completed",
      claims: [],
      execution: { nodes: [], edges: [] },
      evidence: { nodes: [], edges: [] },
    },
  };
  get.mockResolvedValue({ data });
  expect((await readCurrentExplanation("i")).locale).toBe("zh-CN");
  get.mockResolvedValue({ data: { ...data, locale: "en-US" } });
  expect((await readCurrentExplanation("i")).locale).toBe("en-US");
  get.mockResolvedValue({ data: { ...data, locale: "fr-FR" } });
  await expect(readCurrentExplanation("i")).rejects.toThrow("unsupported explanation locale");
});

afterEach(() => vi.useRealTimers());
function readyTaskResult() {
  return {
    schema_version: "1",
    interaction_id: "i",
    status: "ready",
    locale: "en-US",
    generated_at: "2026-11-12T00:00:00Z",
    view: {
      interactionId: "i",
      status: "completed",
      claims: [],
      execution: { nodes: [], edges: [] },
      evidence: { nodes: [], edges: [] },
    },
  };
}
const generatingTask = {
  schema_version: "1",
  interaction_id: "i",
  status: "generating",
  job_id: "task-1",
};
it("polls an accepted task without another POST and preserves selected language", async () => {
  vi.useFakeTimers();
  post.mockResolvedValue({ data: generatingTask });
  get
    .mockResolvedValueOnce({ data: generatingTask })
    .mockResolvedValueOnce({ data: readyTaskResult() });
  const result = generateCurrentExplanation("i", "en-US");
  await vi.advanceTimersByTimeAsync(3000);
  await expect(result).resolves.toMatchObject({ status: "ready", locale: "en-US" });
  expect(post).toHaveBeenCalledTimes(1);
  expect(get).toHaveBeenCalledWith(expect.any(String), {
    params: { job_id: "task-1" },
    headers: { "Accept-Language": "en-US" },
    skipErrorToast: true,
    timeout: 30_000,
  });
});
it("resumes a persisted task after a polling connection is lost", async () => {
  vi.useFakeTimers();
  post.mockResolvedValue({ data: generatingTask });
  get.mockRejectedValueOnce(new Error("connection lost"));
  const result = generateCurrentExplanation("i", "en-US");
  const rejected = expect(result).rejects.toThrow("connection lost");
  await vi.advanceTimersByTimeAsync(1500);
  await rejected;
  get.mockResolvedValue({ data: readyTaskResult() });
  await expect(readCurrentExplanation("i")).resolves.toMatchObject({ status: "ready" });
  expect(post).toHaveBeenCalledTimes(1);
});
it("resends the same generation intent when the initial response was lost", async () => {
  vi.useFakeTimers();
  post
    .mockRejectedValueOnce(new Error("response lost"))
    .mockResolvedValueOnce({ data: generatingTask });
  await expect(generateCurrentExplanation("i", "en-US")).rejects.toThrow("response lost");
  get.mockResolvedValue({ data: readyTaskResult() });
  const resumed = readCurrentExplanation("i");
  await vi.advanceTimersByTimeAsync(1500);
  await expect(resumed).resolves.toMatchObject({ status: "ready" });
  expect(post).toHaveBeenCalledTimes(2);
  expect(post.mock.calls[0]).toEqual(post.mock.calls[1]);
});
it("does not restore another account's generation intent", async () => {
  post.mockRejectedValue(new Error("response lost"));
  await expect(generateCurrentExplanation("i", "en-US")).rejects.toThrow();
  runtime.currentUser.id = "other";
  get.mockResolvedValue({
    data: { schema_version: "1", interaction_id: "i", status: "not_generated" },
  });
  await expect(readCurrentExplanation("i")).resolves.toMatchObject({ status: "not_generated" });
  expect(post).toHaveBeenCalledTimes(1);
});
it("classifies terminal failure and explicitly retries its task once", async () => {
  post.mockResolvedValueOnce({
    data: { ...generatingTask, status: "failed", error_code: "agent_timeout" },
  });
  await expect(generateCurrentExplanation("i", "en-US")).rejects.toMatchObject({
    generationCode: "agent_timeout",
  });
  post.mockResolvedValue({ data: readyTaskResult() });
  await expect(generateCurrentExplanation("i", "en-US")).resolves.toMatchObject({
    status: "ready",
  });
  expect(post.mock.calls[1]?.[1]).toEqual({ locale: "en-US", retry_job_id: "task-1" });
});
it("rejects a task belonging to another interaction instead of polling it", async () => {
  post.mockResolvedValue({ data: { ...generatingTask, interaction_id: "other" } });
  await expect(generateCurrentExplanation("i", "en-US")).rejects.toThrow(
    "invalid explanation task scope",
  );
  expect(get).not.toHaveBeenCalled();
});

for (const code of ["agent_timeout", "generation_cancelled"]) {
  it(`reads the saved view after a persisted ${code} and retains explicit retry identity`, async () => {
    post.mockResolvedValueOnce({ data: { ...generatingTask, status: "failed", error_code: code } });
    await expect(generateCurrentExplanation("i", "en-US")).rejects.toMatchObject({
      generationCode: code,
    });
    get.mockResolvedValue({ data: readyTaskResult() });
    await expect(readCurrentExplanation("i")).resolves.toMatchObject({
      status: "ready",
      generationFailure: code,
    });
    expect(get).toHaveBeenCalledWith(expect.any(String), { skipErrorToast: true });
    post.mockResolvedValue({ data: readyTaskResult() });
    await generateCurrentExplanation("i", "en-US");
    expect(post.mock.calls[1]?.[1]).toEqual({ locale: "en-US", retry_job_id: "task-1" });
  });
}

it("falls back to the saved view when a resumed task becomes failed", async () => {
  vi.useFakeTimers();
  post.mockResolvedValue({ data: generatingTask });
  get.mockRejectedValueOnce(new Error("offline"));
  const started = generateCurrentExplanation("i", "en-US");
  const rejected = expect(started).rejects.toThrow("offline");
  await vi.advanceTimersByTimeAsync(1500);
  await rejected;
  get
    .mockResolvedValueOnce({
      data: { ...generatingTask, status: "failed", error_code: "agent_timeout" },
    })
    .mockResolvedValueOnce({ data: readyTaskResult() });
  await expect(readCurrentExplanation("i")).resolves.toMatchObject({
    status: "ready",
    generationFailure: "agent_timeout",
  });
  expect(post).toHaveBeenCalledTimes(1);
});

for (const status of [400, 413, 422, 429, 503]) {
  it(`does not automatically repeat a POST rejected with HTTP ${status}`, async () => {
    post.mockRejectedValue(
      Object.assign(new Error("rejected"), { isAxiosError: true, response: { status } }),
    );
    await expect(generateCurrentExplanation("i", "en-US")).rejects.toThrow("rejected");
    get.mockResolvedValue({
      data: { schema_version: "1", interaction_id: "i", status: "not_generated" },
    });
    await expect(readCurrentExplanation("i")).resolves.toMatchObject({ status: "not_generated" });
    expect(post).toHaveBeenCalledTimes(1);
  });
}

it("aborts polling without cancelling or forgetting the native task", async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  post.mockResolvedValue({ data: generatingTask });
  const pending = generateCurrentExplanation("i", "en-US", controller.signal);
  const aborted = expect(pending).rejects.toMatchObject({ name: "AbortError" });
  await vi.advanceTimersByTimeAsync(0);
  controller.abort();
  await aborted;
  await vi.advanceTimersByTimeAsync(5000);
  expect(get).not.toHaveBeenCalled();
  expect(post.mock.calls[0]?.[2]).toMatchObject({ signal: controller.signal });
  get.mockResolvedValue({ data: readyTaskResult() });
  await expect(readCurrentExplanation("i")).resolves.toMatchObject({ status: "ready" });
  expect(post).toHaveBeenCalledTimes(1);
});
