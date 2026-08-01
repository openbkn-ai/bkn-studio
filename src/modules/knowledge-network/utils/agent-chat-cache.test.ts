/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { KnDetail } from "@/modules/knowledge-network/services/context-loader.service";
import { recommendationFingerprint } from "@/modules/knowledge-network/utils/agent-chat-cache";

const detail = (): KnDetail => ({
  id: "supply-chain",
  name: "供应链",
  comment: "供应链业务知识网络",
  concept_groups: [{ id: "group-1", name: "采购" }],
  object_types: [{ id: "order", name: "采购订单" }],
  relation_types: [{ id: "order-supplier", name: "订单关联供应商", sourceId: "order", targetId: "supplier" }],
});

describe("recommendationFingerprint", () => {
  it("changes when business-facing network content changes without changing collection sizes", () => {
    const original = detail();
    const renamed = detail();
    renamed.object_types[0] = { ...renamed.object_types[0], name: "采购单" };

    expect(recommendationFingerprint(renamed)).not.toBe(recommendationFingerprint(original));
  });

  it("changes when a relation definition changes", () => {
    const original = detail();
    const changed = detail();
    changed.relation_types[0] = { ...changed.relation_types[0], name: "订单归属供应商" };

    expect(recommendationFingerprint(changed)).not.toBe(recommendationFingerprint(original));
  });
});
