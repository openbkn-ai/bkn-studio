/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, expect, it, vi } from "vitest";
import BigNumber from "bignumber.js";
import { getCaseTargetSchema } from "./case-form.service";
import { http } from "@/framework/request/http";
import { createEvalCase, trialEvalCase, type EvalCaseDefinition } from "./m0-run.service";
vi.mock("@/framework/request/http", () => ({
  http: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
const getSpy = vi.spyOn(http, "get");
const postSpy = vi.spyOn(http, "post");

beforeEach(() => {
  vi.clearAllMocks();
  postSpy.mockResolvedValue({ data: {} });
});
const definition = {
  title: "typed value",
  expected_spec: { criteria: { value: new BigNumber("9007199254740993") } },
} as unknown as EvalCaseDefinition;
it("sends precision-preserving creation as JSON rather than form-urlencoded data", async () => {
  await createEvalCase("kn-1", definition, true);
  const config = postSpy.mock.calls[0][2]!;
  expect(config.headers).toMatchObject({ "Content-Type": "application/json" });
  const serialize = config.transformRequest;
  if (typeof serialize !== "function") throw Error("Expected a precision-safe serializer");
  const text: unknown = (serialize as (value: unknown) => unknown)(definition);
  expect(text).toContain('"value":9007199254740993');
});
it("preserves both the trial request identity and JSON content type", async () => {
  await trialEvalCase("kn-1", definition);
  const config = postSpy.mock.calls[0][2]!;
  expect(config.headers).toMatchObject({
    "Content-Type": "application/json",
    "X-Eval-Trial-Request-ID": expect.stringMatching(/^[a-f0-9-]{36}$/) as unknown,
  });
  const decode = config.transformResponse;
  if (typeof decode !== "function") throw Error("Expected a precision-safe response decoder");
  const result: { actual: { count: BigNumber } } = (
    decode as (value: unknown) => { actual: { count: BigNumber } }
  )('{"actual":{"count":9007199254740993}}');
  expect(result.actual.count.toString()).toBe("9007199254740993");
});

const resource = {
  id: "f-1",
  name: "比率",
  kind: "function",
  box_id: "box-1",
  capability_id: "op-1",
};
it("reads the server-resolved operation contract without invoking the target", async () => {
  const target = {
    input: { required: ["count"], properties: { count: { type: "integer" } } },
    output: { type: "number" },
    available: true,
  };
  getSpy.mockResolvedValue({ data: { target } });
  expect(await getCaseTargetSchema(resource, "kn-1")).toEqual(target);
  expect(getSpy).toHaveBeenCalledWith("/bkn-backend/v1/knowledge-networks/kn-1/evals/case-form", {
    params: { resource_kind: "function", resource_id: "f-1" },
    skipErrorToast: true,
  });
  expect(postSpy).not.toHaveBeenCalled();
});
it("propagates a contract read error rather than pretending no parameters are required", async () => {
  getSpy.mockRejectedValue(new Error("source unavailable"));
  await expect(getCaseTargetSchema(resource, "kn-1")).rejects.toThrow("source unavailable");
  expect(postSpy).not.toHaveBeenCalled();
});
