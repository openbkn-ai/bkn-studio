/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  objectMetricListPath,
  objectMetricReturnPath,
  readObjectMetricListLocation,
} from "./object-metric-navigation";

describe("object metric navigation", () => {
  it("round-trips the selected object and list context through the URL", () => {
    const path = objectMetricListPath("network-1", {
      metricPage: 3,
      metricQuery: "订单",
      metricType: "atomic",
      objectPage: 2,
      objectQuery: "销售",
      objectTypeId: "order&type",
      sidebarCollapsed: true,
      view: "list",
    });
    const url = new URL(path, "http://metric-navigation.local");

    expect(readObjectMetricListLocation(url.searchParams)).toEqual({
      metricPage: 3,
      metricQuery: "订单",
      metricType: "atomic",
      objectPage: 2,
      objectQuery: "销售",
      objectTypeId: "order&type",
      sidebarCollapsed: true,
      view: "list",
    });
  });

  it("uses an owner-specific list for a direct detail link and keeps a valid return target", () => {
    expect(objectMetricReturnPath("network-1", null, "order")).toBe(
      "/knowledge-network/workspace/network-1/metrics?objectTypeId=order",
    );
    expect(
      objectMetricReturnPath("network-1", {
        knowledgeNetworkReturnTo:
          "/knowledge-network/workspace/network-1/metrics?objectTypeId=customer&view=list",
      }),
    ).toBe("/knowledge-network/workspace/network-1/metrics?objectTypeId=customer&view=list");
    expect(
      objectMetricReturnPath("network-1", {
        knowledgeNetworkReturnTo:
          "/knowledge-network/workspace/network-1/object-types/order/detail",
      }),
    ).toBe("/knowledge-network/workspace/network-1/object-types/order/detail");
  });

  it("rejects a return target outside this network or to another metric action", () => {
    for (const target of [
      "//example.com/steal",
      "/knowledge-network/workspace/network-2/metrics",
      "/knowledge-network/workspace/network-1/metrics/create",
    ]) {
      expect(
        objectMetricReturnPath("network-1", { knowledgeNetworkReturnTo: target }, "order"),
      ).toBe("/knowledge-network/workspace/network-1/metrics?objectTypeId=order");
    }
  });
});
