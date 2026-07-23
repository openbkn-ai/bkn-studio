/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { KnowledgeNetworkObjectTypeRecord } from "@/modules/knowledge-network/types/knowledge-network";
import { mergeBoundObjectTypeOption } from "@/modules/knowledge-network/utils/metric-object-type-options";

function objectType(id: string, name = id): KnowledgeNetworkObjectTypeRecord {
  return {
    color: "#2f54eb",
    conceptGroupIds: [],
    conceptGroupNames: [],
    description: "",
    hasIndex: false,
    id,
    name,
    tags: [],
    updateTime: "",
    updaterName: "",
  };
}

describe("metric-object-type-options", () => {
  it("keeps the current options when the bound object type is already loaded", () => {
    const options = [objectType("ot-1")];

    expect(mergeBoundObjectTypeOption(options, "ot-1")).toBe(options);
  });

  it("adds the fetched bound object type when it is outside the loaded page", () => {
    const result = mergeBoundObjectTypeOption(
      [objectType("ot-1")],
      "ot-101",
      objectType("ot-101", "Object 101"),
    );

    expect(result.map((item) => item.id)).toEqual(["ot-1", "ot-101"]);
    expect(result[1]?.name).toBe("Object 101");
  });

  it("falls back to the bound id so edit forms do not clear scopeRef", () => {
    const result = mergeBoundObjectTypeOption([objectType("ot-1")], "ot-101");

    expect(result[1]).toMatchObject({ id: "ot-101", name: "ot-101" });
  });
});
