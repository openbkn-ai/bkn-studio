/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { LogicNeedView } from "@/modules/bkn-project/types/kinetic";

import {
  implementationPath,
  linkTypeOf,
  needState,
  objectMetricsMode,
  readImplementedReturn,
} from "./needs";

const need = (extra: Partial<LogicNeedView>): LogicNeedView => ({
  accepted: true,
  citations: [],
  conceptIds: [],
  definition: "",
  edited: false,
  id: "n1",
  implementation: null,
  kind: "metric",
  link: null,
  liveObjectTypeIds: ["o"],
  unconnected: [],
  name: "Late rate",
  objectTypeIds: ["o"],
  properties: [],
  scenarioIds: [],
  source: "analysis",
  suggestedMetricType: "",
  executedBy: "",
  supplementReason: "",
  ...extra,
});

const link = { at: 1, boxId: "", byId: "u", id: "m1", type: "object_metric" };
const implementation = {
  available: true,
  description: "",
  name: "Late rate",
  ownerObjectTypeId: "o",
  ownerObjectTypeName: "O",
  reason: "",
  status: "",
  version: "",
};

describe("kinetic needs", () => {
  it("places a need by its link, its kind and its object types in the live network", () => {
    expect(needState(need({ implementation, link }))).toBe("implemented");
    expect(
      needState(
        need({ implementation: { ...implementation, available: false, reason: "missing" }, link }),
      ),
    ).toBe("broken");
    // Linked but unreadable for the caller: still implemented, the panel says why.
    expect(
      needState(
        need({
          implementation: { ...implementation, available: false, reason: "forbidden" },
          link,
        }),
      ),
    ).toBe("implemented");
    expect(needState(need({}))).toBe("pending");
    expect(needState(need({ liveObjectTypeIds: [] }))).toBe("waitingRelease");
    expect(needState(need({ kind: "skill", liveObjectTypeIds: [], objectTypeIds: [] }))).toBe(
      "pending",
    );
    expect(needState(need({ kind: "app" }))).toBe("recordOnly");
  });

  it("links a kind to what implements it, an application to nothing", () => {
    expect(linkTypeOf("metric")).toBe("object_metric");
    expect(linkTypeOf("api")).toBe("function");
    expect(linkTypeOf("app")).toBe("");
  });

  it("opens each implementation where it lives", () => {
    expect(implementationPath("net 1", link)).toBe(
      "/knowledge-network/workspace/net%201/metrics/m1/detail",
    );
    expect(implementationPath("net", { ...link, id: "a1", type: "action_type" })).toBe(
      "/knowledge-network/workspace/net/action-types/a1/detail",
    );
    expect(implementationPath("net", { ...link, id: "s1", type: "skill" })).toBe(
      "/execution-factory/skills/s1",
    );
    expect(implementationPath("net", { ...link, boxId: "mcp", id: "t", type: "mcp_tool" })).toBe(
      "/execution-factory/mcp/mcp",
    );
    expect(implementationPath("net", { ...link, boxId: "box", id: "f", type: "function" })).toBe(
      "/execution-factory/toolboxes/box/edit",
    );
    expect(implementationPath("net", { ...link, id: "f", type: "function" })).toBeNull();
  });

  it("reads a return from the metric editor or the action type form, nothing else", () => {
    expect(readImplementedReturn({ needId: "n1", objectMetricCreated: { id: "m1" } })).toEqual({
      id: "m1",
      needId: "n1",
      type: "object_metric",
    });
    expect(readImplementedReturn({ actionTypeCreated: { id: "a1" }, needId: "n3" })).toEqual({
      id: "a1",
      needId: "n3",
      type: "action_type",
    });
    expect(readImplementedReturn({ needId: "n1" })).toBeNull();
    expect(readImplementedReturn({ objectMetricCreated: { id: "m1" } })).toBeNull();
    expect(readImplementedReturn({})).toBeNull();
    expect(readImplementedReturn(null)).toBeNull();
  });

  it("gates metrics on the edition as the knowledge-base extension is gated", () => {
    const snapshot = (capabilities: string[], extensions: string[]) =>
      ({ capabilities, extensions }) as unknown as Parameters<typeof objectMetricsMode>[0];
    expect(objectMetricsMode(null)).toBe("hidden");
    expect(objectMetricsMode(snapshot([], []))).toBe("hidden");
    expect(objectMetricsMode(snapshot([], ["object_metrics"]))).toBe("locked");
    expect(objectMetricsMode(snapshot(["object_metrics"], ["object_metrics"]))).toBe("enabled");
  });
});
