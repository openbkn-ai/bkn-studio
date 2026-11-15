/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
// Axios methods are intentionally passed to Vitest's mock helpers in this contract test.
/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/require-await */
import { beforeEach, expect, it, vi } from "vitest";
import type { AxiosProgressEvent } from "axios";
import { http } from "@/framework/request/http";
import {
  EvalOverviewProgressError,
  readEvalOverviewProgress,
  type EvalOverviewProgress,
} from "./eval-overview-progress";

vi.mock("@/framework/request/http", () => ({ http: { get: vi.fn() } }));
const snapshot = {
  resources: { total: 12 },
  cases: { total: 5 },
  scope: {},
  coverage: { resource_percent: 50, rule_percent: 0 },
  rule_points: {},
};
const resource = JSON.stringify({ section: "resources", overview: snapshot });
const complete = JSON.stringify({
  section: "complete",
  rule_percent: 75,
  rule_points: { applicable: 4, covered: 3 },
});
beforeEach(() => vi.resetAllMocks());

it("delivers partial sections before completion, handles split lines and avoids duplicate events", async () => {
  let finish!: (value: unknown) => void;
  const progress = vi.fn<(event: EvalOverviewProgress) => void>();
  const frames =
    [JSON.stringify({ section: "cases", total: 5 }), resource, complete].join("\n") + "\n";
  vi.mocked(http.get).mockImplementation((_url, options) => {
    const notify = (responseText: string) =>
      options?.onDownloadProgress?.({
        event: {
          target: { status: 200, responseText, getResponseHeader: () => "application/x-ndjson" },
        },
      } as unknown as AxiosProgressEvent);
    notify(frames.slice(0, 11));
    notify(frames.slice(0, frames.indexOf(complete)));
    notify(frames.slice(0, frames.indexOf(complete)));
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const result = readEvalOverviewProgress("network /a", { onProgress: progress });
  expect(progress.mock.calls.map(([event]) => event.section)).toEqual(["cases", "resources"]);
  finish({ data: frames });
  expect(await result).toMatchObject({
    coverage: { resource_percent: 50, rule_percent: 75 },
    rule_points: { applicable: 4, covered: 3 },
  });
  expect(progress).toHaveBeenCalledTimes(3);
  expect(http.get).toHaveBeenCalledWith(
    expect.stringContaining("network%20%2Fa/evals/overview"),
    expect.objectContaining({
      adapter: "xhr",
      headers: { Accept: "application/x-ndjson, application/json" },
    }),
  );
});

it("retains the delivered resource section when a later rule read fails with a safe typed error", async () => {
  const event = {
    section: "error",
    stage: "rules",
    status: 403,
    code: "EVAL_RESOURCE_AUTH",
    message: "Access changed",
  };
  vi.mocked(http.get).mockResolvedValue({ data: resource + "\n" + JSON.stringify(event) + "\n" });
  const progress = vi.fn();
  await expect(readEvalOverviewProgress("kn", { onProgress: progress })).rejects.toMatchObject({
    name: "EvalOverviewProgressError",
    event,
  });
  expect(progress).toHaveBeenCalledOnce();
  expect(new EvalOverviewProgressError(event as never)).toBeInstanceOf(Error);
});

it.each([
  resource + "\n",
  "{bad json}\n",
  complete + "\n",
  resource + "\n" + complete + "\n" + complete + "\n",
])("rejects incomplete or invalid streams", async (data) => {
  vi.mocked(http.get).mockResolvedValue({ data });
  await expect(readEvalOverviewProgress("kn", { onProgress: vi.fn() })).rejects.toBeInstanceOf(
    Error,
  );
});

it("does not parse failed authentication response bodies before the authenticated client retries", async () => {
  vi.mocked(http.get).mockImplementation(async (_url, options) => {
    options?.onDownloadProgress?.({
      event: { target: { status: 401, responseText: "Unauthorized" } },
    } as unknown as AxiosProgressEvent);
    return { data: resource + "\n" + complete };
  });
  await expect(readEvalOverviewProgress("kn", { onProgress: vi.fn() })).resolves.toMatchObject({
    coverage: { rule_percent: 75 },
  });
});

it("passes cancellation to the request client and stops delivering stale sections", async () => {
  const controller = new AbortController();
  const progress = vi.fn();
  vi.mocked(http.get).mockImplementation(async (_url, options) => {
    expect(options?.signal).toBe(controller.signal);
    controller.abort();
    options?.onDownloadProgress?.({
      event: { target: { status: 200, responseText: resource + "\n" } },
    } as unknown as AxiosProgressEvent);
    throw new Error("canceled");
  });
  await expect(
    readEvalOverviewProgress("kn", { onProgress: progress, signal: controller.signal }),
  ).rejects.toThrow("canceled");
  expect(progress).not.toHaveBeenCalled();
});

it("renders the complete JSON representation without mistaking its sections for stream frames", async () => {
  const overview = {
    ...snapshot,
    resource_details: [
      { kind: "objectType", id: "review", name: "商品评价", status: "problem", problem_cases: 6 },
    ],
    case_details: [{ id: "case-1", status: "failed" }],
  };
  const data = JSON.stringify(overview, null, 2);
  vi.mocked(http.get).mockImplementation(async (_url, options) => {
    // Ordinary JSON can arrive in many chunks. Parsing its first '{' as a frame
    // must not poison the completed, otherwise valid overview response.
    for (const responseText of [data.slice(0, 2), data.slice(0, 50), data]) {
      options?.onDownloadProgress?.({
        event: {
          target: {
            status: 200,
            responseText,
            getResponseHeader: () => "application/json; charset=utf-8",
          },
        },
      } as unknown as AxiosProgressEvent);
    }
    return { data, headers: { "content-type": "application/json; charset=utf-8" } };
  });
  const onProgress = vi.fn();
  await expect(readEvalOverviewProgress("kn", { onProgress })).resolves.toEqual(overview);
  expect(onProgress).not.toHaveBeenCalled();
  expect(http.get).toHaveBeenCalledOnce();
});

it("accepts a compact complete JSON response without any download progress events", async () => {
  vi.mocked(http.get).mockResolvedValue({
    data: JSON.stringify(snapshot),
    headers: { "content-type": "application/json" },
  });
  await expect(readEvalOverviewProgress("kn", { onProgress: vi.fn() })).resolves.toEqual(snapshot);
});

it.each([
  {},
  { code: "EVAL_RESOURCE_READ_FAILED", message: "unavailable" },
  { ...snapshot, cases: null },
])("does not turn an invalid JSON response into an empty successful overview", async (value) => {
  vi.mocked(http.get).mockResolvedValue({
    data: JSON.stringify(value),
    headers: { "content-type": "application/json" },
  });
  await expect(readEvalOverviewProgress("kn", { onProgress: vi.fn() })).rejects.toThrow(
    "Invalid Eval overview response",
  );
});
