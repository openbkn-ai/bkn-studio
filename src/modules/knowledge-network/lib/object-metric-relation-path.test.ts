/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { KnowledgeNetworkRelationTypeRecord } from "@/modules/knowledge-network/types/knowledge-network";

import { availableRelationTypesFrom } from "./object-metric-relation-path";

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

  it("supports an incoming relation as the first path step", () => {
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
    } as KnowledgeNetworkRelationTypeRecord;

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
