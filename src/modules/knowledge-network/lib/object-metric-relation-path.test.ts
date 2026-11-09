/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { KnowledgeNetworkRelationTypeRecord } from "@/modules/knowledge-network/types/knowledge-network";

import {
  availableRelationTypesFrom,
  normalizeObjectMetricRelationStepsV1,
} from "./object-metric-relation-path";

describe("availableRelationTypesFrom", () => {
  const orderChannel = {
    id: "order_channel",
    name: "订单来自渠道",
    sourceObjectTypeId: "order",
    targetObjectTypeId: "channel",
  } as KnowledgeNetworkRelationTypeRecord;
  const channelStore = {
    id: "channel_store",
    name: "渠道归属门店",
    sourceObjectTypeId: "channel",
    targetObjectTypeId: "store",
  } as KnowledgeNetworkRelationTypeRecord;

  it("excludes an immediate reverse traversal while preserving other continuations", () => {
    expect(
      availableRelationTypesFrom(
        [orderChannel, channelStore],
        "channel",
        "order",
        "order_channel",
      ).map((item) => item.id),
    ).toEqual(["channel_store"]);
  });

  it("returns all relations connected to the starting object", () => {
    expect(
      availableRelationTypesFrom([orderChannel, channelStore], "order").map((item) => item.id),
    ).toEqual(["order_channel"]);
  });

  it("supports a backward relation as the first path step", () => {
    expect(
      availableRelationTypesFrom([orderChannel, channelStore], "store").map((item) => item.id),
    ).toEqual(["channel_store"]);
  });

  it("excludes disconnected relations from every path step", () => {
    const productCategory = {
      id: "product_category",
      name: "商品属于类目",
      sourceObjectTypeId: "product",
      targetObjectTypeId: "category",
    } as KnowledgeNetworkRelationTypeRecord;

    expect(
      availableRelationTypesFrom([orderChannel, channelStore, productCategory], "channel").map(
        (item) => item.id,
      ),
    ).toEqual(["order_channel", "channel_store"]);
  });

  it("allows a different relation back to the previous object type", () => {
    const fallbackOrderChannel = {
      ...orderChannel,
      id: "order_channel_fallback",
      name: "订单备用渠道",
    };

    expect(
      availableRelationTypesFrom(
        [orderChannel, fallbackOrderChannel, channelStore],
        "channel",
        "order",
        "order_channel",
      ).map((item) => item.id),
    ).toEqual(["order_channel_fallback", "channel_store"]);
  });
});

describe("normalizeObjectMetricRelationStepsV1", () => {
  it("keeps canonical directions and upgrades persisted legacy aliases", () => {
    expect(
      normalizeObjectMetricRelationStepsV1([
        { direction: "forward", relation_type_id: "r1", target_object_type_id: "b" },
        { direction: "incoming", relation_type_id: "r2", target_object_type_id: "c" },
        { direction: "outgoing", relation_type_id: "r3", target_object_type_id: "d" },
        { direction: "backward", relation_type_id: "r4", target_object_type_id: "e" },
      ]),
    ).toEqual([
      { direction: "forward", relation_type_id: "r1", target_object_type_id: "b" },
      { direction: "backward", relation_type_id: "r2", target_object_type_id: "c" },
      { direction: "forward", relation_type_id: "r3", target_object_type_id: "d" },
      { direction: "backward", relation_type_id: "r4", target_object_type_id: "e" },
    ]);
  });
});
