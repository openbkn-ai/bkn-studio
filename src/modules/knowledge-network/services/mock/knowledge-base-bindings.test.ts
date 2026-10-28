/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { attachMockCapabilities, listMockCapabilities } from "./state";

describe("mock knowledge-base bindings", () => {
  it("lists a mounted knowledge base and one that is gone, apart from tools", () => {
    const { entries } = listMockCapabilities("kn-domain-supply", { type: "knowledge_base" });
    expect(entries.map((item) => [item.name, item.status])).toEqual([
      ["Supplier contracts", ""],
      ["", "missing"],
    ]);
    expect(listMockCapabilities("kn-domain-supply", { type: "skill" }).entries).toEqual([]);
  });

  it("names a mounted knowledge base as the backend would, and mounts it once", () => {
    const [created] = attachMockCapabilities("kn-domain-risk", [
      { capabilityId: "12", capabilityType: "knowledge_base" },
    ]);
    expect(created).toMatchObject({
      boxId: "",
      capabilityType: "knowledge_base",
      name: "Delivery incidents",
    });
    expect(
      attachMockCapabilities("kn-domain-risk", [
        { capabilityId: "12", capabilityType: "knowledge_base" },
      ]),
    ).toEqual([]);
  });
});
