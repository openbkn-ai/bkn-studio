/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { objectMetricCreatedState, readObjectMetricContext } from "./object-metric-context";

const context = {
  title: "Order count is needed",
  description: "Used by the weekly review",
  prompt: "Count orders per customer",
  returnTo: "/projects/p-1/logic?need=n-1",
  returnLabel: "Back to the project",
  returnState: { needId: "n-1" },
};

describe("object metric navigation context", () => {
  it("reads a complete context from navigation state", () => {
    expect(readObjectMetricContext({ objectMetricContext: context, other: 1 })).toEqual(context);
  });

  it("keeps only the required fields when the optional ones are absent or blank", () => {
    expect(
      readObjectMetricContext({
        objectMetricContext: {
          title: "Need",
          description: "",
          returnTo: "/projects/p-1",
          returnLabel: "Back",
        },
      }),
    ).toEqual({
      title: "Need",
      description: undefined,
      prompt: undefined,
      returnTo: "/projects/p-1",
      returnLabel: "Back",
      returnState: undefined,
    });
  });

  it.each([
    ["no state", null],
    ["no context", { knowledgeNetworkReturnTo: "/x" }],
    ["a context that is not an object", { objectMetricContext: "x" }],
  ])("ignores %s", (_, state) => {
    expect(readObjectMetricContext(state)).toBeUndefined();
  });

  it.each(["title", "returnTo", "returnLabel"] as const)("rejects a context without %s", (key) => {
    const rest: Record<string, unknown> = { ...context };
    delete rest[key];
    expect(readObjectMetricContext({ objectMetricContext: rest })).toBeUndefined();
    expect(
      readObjectMetricContext({ objectMetricContext: { ...context, [key]: "  " } }),
    ).toBeUndefined();
  });

  it.each(["//evil.example/x", "http://evil.example/x", "projects/p-1", "/\\evil.example"])(
    "rejects the return address %s",
    (returnTo) => {
      expect(readObjectMetricContext({ objectMetricContext: { ...context, returnTo } })).toBe(
        undefined,
      );
    },
  );

  it("rejects return state that is not an object", () => {
    expect(
      readObjectMetricContext({ objectMetricContext: { ...context, returnState: ["n-1"] } }),
    ).toBeUndefined();
  });

  it("returns the caller's state with the created metric id", () => {
    expect(objectMetricCreatedState(context, "metric-9")).toEqual({
      needId: "n-1",
      objectMetricCreated: { id: "metric-9" },
    });
    expect(objectMetricCreatedState({ ...context, returnState: undefined }, "metric-9")).toEqual({
      objectMetricCreated: { id: "metric-9" },
    });
  });
});
