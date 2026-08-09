/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { tracePrototypeFixture } from "@/modules/bkn-trace/prototype/bkn-trace-prototype.fixture";
import {
  getChronologicalOperations,
  getKnowledgeNetworkProjection,
} from "@/modules/bkn-trace/prototype/bkn-trace-prototype.projection";

describe("BKN Trace prototype projections", () => {
  it("keeps the two real interactions and all nine operations in chronological order", () => {
    expect(tracePrototypeFixture.interactions).toHaveLength(2);

    const operations = getChronologicalOperations(tracePrototypeFixture);

    expect(operations).toHaveLength(9);
    expect(operations.map((operation) => operation.tool)).toEqual([
      "list_knowledge_networks",
      "search_schema",
      "run_sql",
      "run_sql",
      "run_sql",
      "run_sql",
      "query_object_instance",
      "run_sql",
      "run_sql",
    ]);
    expect(operations[0]?.startedAt).toBe("2026-08-08T11:01:56.684460Z");
    expect(operations.at(-1)?.startedAt).toBe("2026-08-08T11:04:40.302897Z");
  });

  it("resolves accessed resources to observed BKN objects", () => {
    const projection = getKnowledgeNetworkProjection(tracePrototypeFixture);

    expect(projection.observedObjects.map((object) => object.name)).toEqual([
      "物料",
      "库存",
      "采购订单",
      "物料请购单",
      "产品BOM",
    ]);
    expect(projection.observedObjects.map((object) => object.binding)).toEqual([
      "direct-object-query",
      "deterministic-resource-binding",
      "deterministic-resource-binding",
      "deterministic-resource-binding",
      "deterministic-resource-binding",
    ]);
  });

  it("keeps real BKN relations as context when Trace did not invoke them", () => {
    const projection = getKnowledgeNetworkProjection(tracePrototypeFixture);

    expect(projection.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "物料关联库存", state: "network-context" }),
        expect.objectContaining({ name: "采购订单关联供应商", state: "network-context" }),
        expect.objectContaining({ name: "采购订单关联物料请购单", state: "network-context" }),
        expect.objectContaining({ name: "产品关联产品BOM", state: "network-context" }),
        expect.objectContaining({ name: "产品BOM关联物料", state: "network-context" }),
      ]),
    );
    expect(projection.explorationCandidateCount).toBe(28);
  });
});
