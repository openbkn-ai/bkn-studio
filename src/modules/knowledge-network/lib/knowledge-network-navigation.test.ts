/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  clearKnowledgeNetworkGraphSelectionFromPath,
  knowledgeNetworkReturnPath,
  readKnowledgeNetworkGraphSelection,
  writeKnowledgeNetworkGraphSelection,
} from "./knowledge-network-navigation";

describe("knowledge network navigation", () => {
  it("round-trips graph selection while preserving the surrounding page state", () => {
    const params = new URLSearchParams("objectTypeId=order&page=2&q=sales");
    writeKnowledgeNetworkGraphSelection(params, {
      id: "action-1",
      kind: "action",
    });

    expect(readKnowledgeNetworkGraphSelection(params)).toEqual({
      id: "action-1",
      kind: "action",
    });
    expect(params.get("objectTypeId")).toBe("order");
    expect(params.get("page")).toBe("2");
    expect(params.get("q")).toBe("sales");
  });

  it("accepts only return paths inside the current knowledge-network workspace", () => {
    const fallback = "/knowledge-network/workspace/network-1/action-types";
    expect(
      knowledgeNetworkReturnPath(
        "network-1",
        {
          knowledgeNetworkReturnTo:
            "/knowledge-network/workspace/network-1/action-types?objectTypeId=order",
        },
        fallback,
      ),
    ).toBe("/knowledge-network/workspace/network-1/action-types?objectTypeId=order");
    expect(
      knowledgeNetworkReturnPath(
        "network-1",
        { knowledgeNetworkReturnTo: "/knowledge-network/workspace/network-2/action-types" },
        fallback,
      ),
    ).toBe(fallback);
    expect(
      knowledgeNetworkReturnPath(
        "network-1",
        { knowledgeNetworkReturnTo: "//example.com/knowledge-network/workspace/network-1" },
        fallback,
      ),
    ).toBe(fallback);
  });

  it("removes only the selected graph resource after that resource is deleted", () => {
    expect(
      clearKnowledgeNetworkGraphSelectionFromPath(
        "/knowledge-network/workspace/network-1/action-types?objectTypeId=order&graphResourceKind=action&graphResourceId=action-1&page=2",
      ),
    ).toBe("/knowledge-network/workspace/network-1/action-types?objectTypeId=order&page=2");
  });
});
