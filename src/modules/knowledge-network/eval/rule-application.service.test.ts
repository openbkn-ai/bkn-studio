/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, expect, it, vi } from "vitest";
import {
  parsePrecisionPreservingJSON,
  transformPrecisionSafeJSONRequest,
} from "@/framework/request/precision-safe-json";
import { http } from "@/framework/request/http";
import {
  previewRuleApplication,
  saveRuleApplication,
  type RuleApplicationRequest,
  type RuleApplicationSavedItem,
} from "./rule-application.service";
vi.mock("@/framework/request/http", () => ({ http: { post: vi.fn() } }));
const request: RuleApplicationRequest = {
  resources: [{ kind: "objectType", id: "material" }],
  targets: [
    {
      resource_key: "objectType:material",
      rule_id: "object-key-uniqueness",
      target_id: "material",
    },
  ],
  rule_ids: ["object-key-uniqueness"],
  page: 1,
  limit: 20,
};
const postSpy = vi.spyOn(http, "post");

beforeEach(() => postSpy.mockReset());
it("keeps preview read-only and sends the exact selected resource and rule identities", async () => {
  postSpy.mockResolvedValue({ data: { entries: [], total: 0 } });
  expect(await previewRuleApplication("kn/a", request)).toEqual({ entries: [], total: 0 });
  expect(postSpy).toHaveBeenCalledOnce();
  expect(postSpy).toHaveBeenCalledWith(
    "/bkn-backend/v1/knowledge-networks/kn%2Fa/evals/rule-applications/preview",
    request,
    expect.objectContaining({ skipErrorToast: true }),
  );
});
it("preserves preview checksums on save and surfaces stale-preview conflicts", async () => {
  const save = {
    ...request,
    samples: [
      {
        target_key: "objectType:material",
        sample_id: "sample-1",
        rule_checksum: "frozen-rule-checksum",
        resource_checksum: "frozen-resource-checksum",
        title: "Material keys",
        question: "Are material keys unique?",
        arguments: {},
        scope: { mode: "sample", limit: 100 },
      },
    ],
  };
  postSpy
    .mockResolvedValueOnce({
      data: {
        entries: [{ key: "objectType:material:sample-1", case_id: "saved", status: "created" }],
      },
    })
    .mockRejectedValueOnce(new Error("preview changed"));
  expect(await saveRuleApplication("kn/a", save)).toEqual([
    { key: "objectType:material:sample-1", case_id: "saved", status: "created" },
  ]);
  expect(postSpy).toHaveBeenLastCalledWith(
    "/bkn-backend/v1/knowledge-networks/kn%2Fa/evals/rule-applications/save",
    save,
    expect.objectContaining({ skipErrorToast: true }),
  );
  await expect(saveRuleApplication("kn/a", save)).rejects.toThrow("preview changed");
  expect(postSpy).toHaveBeenCalledTimes(2);
});

it("retains successful receipts and distinguishes unconfirmed from unsubmitted samples after a timeout", async () => {
  const samples = Array.from({ length: 12 }, (_, index) => ({
    target_key: "target",
    sample_id: String(index),
    title: `Case ${index}`,
    question: "Check keys",
    arguments: {},
    scope: { mode: "sample", limit: 100 },
  }));
  const progress = vi.fn<(entries: RuleApplicationSavedItem[]) => void>();
  postSpy
    .mockResolvedValueOnce({
      data: {
        entries: samples.slice(0, 5).map((sample) => ({
          key: `target:${sample.sample_id}`,
          status: "created",
          case_id: sample.sample_id,
        })),
      },
    })
    .mockRejectedValueOnce(new Error("timeout after possible commits"));
  await expect(saveRuleApplication("kn", { ...request, samples }, progress)).rejects.toThrow(
    "timeout",
  );
  expect(postSpy).toHaveBeenCalledTimes(2);
  const final = progress.mock.lastCall![0];
  expect(final.filter((entry: { status: string }) => entry.status === "created")).toHaveLength(5);
  expect(final.filter((entry: { status: string }) => entry.status === "unconfirmed")).toHaveLength(
    5,
  );
  expect(final.filter((entry: { status: string }) => entry.status === "pending")).toHaveLength(2);
  expect(final[0].case_id).toBe("0");
});

it("preserves numeric literals through preview response and sample save requests", async () => {
  postSpy.mockResolvedValue({ data: { entries: [], total: 0 } });
  await previewRuleApplication("kn", request);
  const config = postSpy.mock.calls[0][2]!;
  const encode = config.transformRequest as (data: unknown) => string;
  const decode = config.transformResponse as (data: unknown) => unknown;
  const raw = '{"id":9007199254740993,"amount":0.1234567890123456789}';
  expect(encode(decode(raw))).toBe(raw);
  expect(decode("upstream unavailable")).toBe("upstream unavailable");
  const args = parsePrecisionPreservingJSON(raw) as Record<string, unknown>;
  await saveRuleApplication("kn", {
    ...request,
    samples: [
      {
        target_key: "target",
        sample_id: "one",
        title: "数量",
        question: "回显",
        arguments: args,
        scope: { mode: "invocation" },
      },
    ],
  });
  const call = postSpy.mock.calls.at(-1)!;
  expect(transformPrecisionSafeJSONRequest(call[1])).toContain('"id":9007199254740993');
  expect(call[2]?.transformRequest).toBe(encode);
});
