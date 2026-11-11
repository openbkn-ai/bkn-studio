/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { beforeEach, expect, it, vi } from "vitest";
import BigNumber from "bignumber.js";
import {
  beginEvalRunPlanAuthorization,
  completeEvalRunPlanAuthorization,
  getEvalOverview,
  getEvalTemplateConfig,
  saveEvalTemplateConfig,
  getM0OperationAttempt,
  getEvalRunPlanCount,
  listEvalCases,
  listEvalCallableFunctions,
  getEvalRunResultRevisionPage,
  getEvalSuite,
  getEvalSuiteCaseDetail,
  getEvalCaseDefinition,
  listRunCases,
  listEvalCaseResourceSummary,
  trialEvalCase,
  type EvalCaseDefinition,
} from "./m0-run.service";
type RequestOptions = Record<string, unknown>;
const getMock = vi.hoisted(() =>
  vi.fn<(url: string, options?: RequestOptions) => Promise<{ data: unknown }>>(),
);
const postMock = vi.hoisted(() =>
  vi.fn<(url: string, data?: unknown, options?: RequestOptions) => Promise<{ data: unknown }>>(),
);
const putMock = vi.hoisted(() =>
  vi.fn<(url: string, data?: unknown, options?: RequestOptions) => Promise<{ data: unknown }>>(),
);
vi.mock("@/framework/request/http", () => ({
  http: { get: getMock, post: postMock, put: putMock },
}));
beforeEach(() => {
  getMock.mockReset();
  postMock.mockReset();
});
it("waits for the bounded trial execution and evidence budget without changing ordinary requests", async () => {
  const definition: EvalCaseDefinition = {
    title: "真实资源调用",
    category: "fact",
    risk_level: "medium",
    input_spec: { arguments: { count: 0 } },
    execution_spec: { runner: "direct_capability" },
    assertions: [],
    expected_spec: { criteria: {} },
    expected_source: { kind: "declared_contract", evidence_refs: ["来源合同"] },
    diagnostic_spec: {},
  };
  postMock.mockResolvedValue({ data: { trial_id: "trial" } });
  await trialEvalCase("kn/1", definition);
  expect(postMock).toHaveBeenCalledWith(
    "/bkn-backend/v1/knowledge-networks/kn%2F1/evals/cases/trial",
    definition,
    expect.objectContaining({ timeout: 120000, skipErrorToast: true }),
  );
});
it("loads the Run plan count with the minimum page size and preserves a real zero", async () => {
  const signal = new AbortController().signal;
  getMock.mockResolvedValueOnce({ data: { entries: [], total: 2, total_all: 17 } });
  expect(await getEvalRunPlanCount("kn/1", signal)).toBe(17);
  expect(getMock).toHaveBeenCalledWith(
    "/bkn-backend/v1/knowledge-networks/kn%2F1/evals/run-plans",
    { params: { page: 1, limit: 1 }, signal, skipErrorToast: true },
  );
  getMock.mockResolvedValueOnce({ data: { entries: [], total: 0 } });
  expect(await getEvalRunPlanCount("kn/1")).toBe(0);
});
it.each([undefined, null, -1, "0", NaN, 1.5])(
  "rejects an invalid Run plan count instead of displaying zero: %s",
  async (total) => {
    getMock.mockResolvedValue({ data: { total } });
    await expect(getEvalRunPlanCount("kn-1")).rejects.toThrow("Invalid Eval Run plan count");
  },
);
it("reads a stable Case identity within the selected Suite membership version", async () => {
  getMock.mockResolvedValue({ data: {} });
  await getEvalSuite("kn/1", "suite/2", 3);
  await getEvalSuiteCaseDetail("kn/1", "suite/2", 3, "case/1");
  expect(getMock).toHaveBeenNthCalledWith(
    1,
    "/bkn-backend/v1/knowledge-networks/kn%2F1/evals/suites/suite%2F2/versions/3",
    { skipErrorToast: true },
  );
  expect(getMock).toHaveBeenNthCalledWith(
    2,
    "/bkn-backend/v1/knowledge-networks/kn%2F1/evals/suites/suite%2F2/versions/3/cases/case%2F1",
    expect.objectContaining({ skipErrorToast: true }),
  );
  expect(getMock.mock.calls[1][1]).toHaveProperty("transformResponse", expect.any(Function));
});
it("separates current Case reads from frozen Run reads and preserves large expected numbers", async () => {
  getMock.mockResolvedValue({ data: {} });
  await getEvalCaseDefinition("kn/1", "case/2");
  await getEvalCaseDefinition("kn/1", "case/2", { runId: "old/run", caseRunId: "old/case-run" });
  expect(getMock.mock.calls[0][0]).toBe(
    "/bkn-backend/v1/knowledge-networks/kn%2F1/evals/cases/case%2F2/detail",
  );
  expect(getMock.mock.calls[1][0]).toBe(
    "/bkn-backend/v1/knowledge-networks/kn%2F1/evals/runs/old%2Frun/cases/old%2Fcase-run/definition",
  );
  const config = getMock.mock.calls[1][1] as {
    transformResponse: (value: string) => {
      amount: {
        toString(): string;
      };
    };
  };
  expect(config.transformResponse('{"amount":9007199254740993}').amount.toString()).toBe(
    "9007199254740993",
  );
});
it("uses the previous page cursor to read older immutable result versions", async () => {
  getMock
    .mockResolvedValueOnce({
      data: {
        entries: [
          { revision: 101, checksum: "new" },
          { revision: 2, checksum: "before" },
        ],
        next_before: 2,
      },
    })
    .mockResolvedValueOnce({
      data: {
        entries: [{ revision: 1, checksum: "old" }],
      },
    });
  const first = await getEvalRunResultRevisionPage("kn-1", "run-1");
  const second = await getEvalRunResultRevisionPage("kn-1", "run-1", first.next_before);
  expect([...first.entries, ...second.entries].map((entry) => entry.revision)).toEqual([101, 2, 1]);
  expect(getMock).toHaveBeenNthCalledWith(
    2,
    expect.stringContaining("/run-1/result-revisions"),
    expect.objectContaining({ params: { before: 2 } }),
  );
});
it("rejects a non-advancing result version cursor", async () => {
  getMock.mockResolvedValueOnce({ data: { entries: [{ revision: 2 }], next_before: 2 } });
  await expect(getEvalRunResultRevisionPage("kn-1", "run-1", 2)).rejects.toThrow(
    "Invalid Eval result revision page",
  );
});
it("sends the Case outcome filter with the cursor to the run cases API", async () => {
  getMock.mockResolvedValue({ data: { entries: [], total: 22, next_cursor: null } });
  await listRunCases("kn-1", "run-1", "failure-cursor", "fail");
  expect(getMock).toHaveBeenCalledWith(
    expect.stringContaining("/run-1/cases"),
    expect.objectContaining({ params: { limit: 20, cursor: "failure-cursor", outcome: "fail" } }),
  );
});
it("coalesces concurrent overview reads and reloads on the next refresh", async () => {
  getMock.mockResolvedValue({ data: { resource_count: 93 } });
  const [first, second] = await Promise.all([getEvalOverview("kn"), getEvalOverview("kn")]);
  expect(getMock).toHaveBeenCalledTimes(1);
  expect(first).toBe(second);
  await getEvalOverview("kn");
  expect(getMock).toHaveBeenCalledTimes(2);
});
it("loads complete Case resource counts using independent type and page parameters", async () => {
  const summary = {
    entries: [{ name: "tool_add", kinds: ["mcp"], case_count: 1 }],
    total: 1,
    case_total: 63,
    page: 2,
    limit: 10,
  };
  getMock.mockResolvedValue({ data: summary });
  const signal = new AbortController().signal;
  await expect(listEvalCaseResourceSummary("kn/1", "mcp", 2, 10, signal)).resolves.toEqual(summary);
  expect(getMock).toHaveBeenCalledWith(
    "/bkn-backend/v1/knowledge-networks/kn%2F1/evals/case-resource-summary",
    {
      params: { resource_type: "mcp", page: 2, limit: 10 },
      skipErrorToast: true,
      signal,
    },
  );
});
it("requests enabled resource counts for the test-set Case picker", async () => {
  getMock.mockResolvedValue({ data: { entries: [], total: 0, case_total: 0, page: 1, limit: 10 } });
  await listEvalCaseResourceSummary("kn", undefined, 1, 10, undefined, "enabled");
  expect(getMock).toHaveBeenCalledWith(
    "/bkn-backend/v1/knowledge-networks/kn/evals/case-resource-summary",
    {
      params: { resource_type: undefined, page: 1, limit: 10, status: "enabled" },
      skipErrorToast: true,
    },
  );
});
it("sends full-run case search together with result filters and paging", async () => {
  getMock.mockResolvedValue({ data: { entries: [], total: 0, next_cursor: null } });
  const controller = new AbortController();
  await listRunCases("kn-1", "run-1", "after-20", "fail", controller.signal, "100% 主键");
  expect(getMock).toHaveBeenCalledWith(
    expect.stringContaining("/run-1/cases"),
    expect.objectContaining({
      params: { limit: 20, cursor: "after-20", outcome: "fail", q: "100% 主键" },
      signal: controller.signal,
    }),
  );
});

it("sends combined latest-result and participation filters with server pagination", async () => {
  getMock.mockResolvedValue({ data: { entries: [], total: 13, next_cursor: null } });
  await listEvalCases(
    "kn/1",
    "订单",
    "after-page",
    "enabled",
    { name: "采购订单", type: "objectType" },
    { result: "failed", participation: "participating" },
  );
  expect(getMock).toHaveBeenCalledWith(
    "/bkn-backend/v1/knowledge-networks/kn%2F1/evals/cases",
    expect.objectContaining({
      params: expect.objectContaining({
        q: "订单",
        cursor: "after-page",
        status: "enabled",
        resource_name: "采购订单",
        resource_type: "objectType",
        result: "failed",
        participation: "participating",
      }) as unknown,
    }),
  );
});

it("reads the exact Trace tool attempt through its existing read-only contract", async () => {
  getMock.mockResolvedValue({ data: { operation_id: "op/1", attempt: 2 } });
  expect(await getM0OperationAttempt("op/1", 2)).toEqual({ operation_id: "op/1", attempt: 2 });
  expect(getMock).toHaveBeenCalledWith(
    "/agent-observability/v1/operations/op%2F1/attempts/2",
    expect.objectContaining({
      skipErrorToast: true,
      transformResponse: expect.any(Function) as unknown,
    }),
  );
  const config = getMock.mock.calls[0][1] as {
    transformResponse: (data: string) => { output: { inline: { id: { toString(): string } } } };
  };
  expect(
    config
      .transformResponse('{"output":{"inline":{"id":900719925474099312345}}}')
      .output.inline.id.toString(),
  ).toBe("900719925474099312345");
});

it("passes only the callback and one-time code for independent plan authorization", async () => {
  postMock.mockResolvedValueOnce({ data: { state: "state", code_challenge: "challenge" } });
  expect(
    await beginEvalRunPlanAuthorization("kn/1", "plan/1", "http://localhost:8000/studio/callback"),
  ).toEqual({ state: "state", code_challenge: "challenge" });
  expect(postMock).toHaveBeenNthCalledWith(
    1,
    "/bkn-backend/v1/knowledge-networks/kn%2F1/evals/run-plans/plan%2F1/authorization",
    { redirect_uri: "http://localhost:8000/studio/callback" },
    { skipErrorToast: true },
  );
  postMock.mockResolvedValueOnce({ data: undefined });
  await completeEvalRunPlanAuthorization("kn/1", "plan/1", { state: "state", code: "code" });
  expect(postMock).toHaveBeenNthCalledWith(
    2,
    "/bkn-backend/v1/knowledge-networks/kn%2F1/evals/run-plans/plan%2F1/authorization/complete",
    { state: "state", code: "code" },
    { skipErrorToast: true },
  );
});

it("preserves numeric program literals across rule library load and save", async () => {
  const { parsePrecisionPreservingJSON } = await import("@/framework/request/precision-safe-json");
  const raw =
    '{"revision":1,"checksum":"before","rules":[{"id":"custom-exact","check":{"type":"program","program":{"version":1,"expect":{"mode":"all","conditions":[{"field":"amount","operator":"eq","value":9007199254740993.01}]}}}}]}';
  getMock.mockResolvedValueOnce({ data: parsePrecisionPreservingJSON(raw) });
  const config = await getEvalTemplateConfig("kn");
  const options = getMock.mock.calls.at(-1)![1]!;
  const decode = options.transformResponse as (data: string) => {
    rules: { check: { program: { expect: { conditions: { value: unknown }[] } } } }[];
  };
  expect(decode(raw).rules[0].check.program.expect.conditions[0].value).toEqual(
    new BigNumber("9007199254740993.01"),
  );
  putMock.mockResolvedValueOnce({ data: config });
  await saveEvalTemplateConfig("kn", config, config.rules);
  const [, body, saveOptions] = putMock.mock.calls.at(-1)!;
  const encode = saveOptions!.transformRequest as (data: unknown) => string;
  expect(encode(body)).toContain('"value":9007199254740993.01');
  expect(encode(body)).not.toContain('"value":"9007199254740993.01"');
});

it("loads Function identities from the current user resource catalogue", async () => {
  const entries = [{ resource_id: "mount", name: "Function", operation: "tool" }];
  getMock.mockResolvedValue({ data: { entries } });
  await expect(listEvalCallableFunctions("kn/1")).resolves.toEqual(entries);
  expect(getMock).toHaveBeenCalledWith(
    "/bkn-backend/v1/knowledge-networks/kn%2F1/evals/runs/multi/functions",
    { skipErrorToast: true },
  );
});
