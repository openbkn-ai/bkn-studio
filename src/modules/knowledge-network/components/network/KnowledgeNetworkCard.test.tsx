/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { KnowledgeNetworkRecord } from "@/modules/knowledge-network/types/knowledge-network";
import { hasKnowledgeNetworkRecordOperation } from "@/modules/knowledge-network/utils/record-operations";
import {
  formatKnowledgeNetworkUpdateTime,
  getKnowledgeNetworkCardMenuKeys,
} from "./knowledge-network-card";

function createRecord(operations?: string[]): KnowledgeNetworkRecord {
  return {
    id: "network-1",
    identifier: "network_1",
    name: "Network 1",
    description: "",
    color: "#1677ff",
    ...(operations === undefined ? {} : { operations }),
    tags: [],
    createTime: "",
    updateTime: "",
    creatorName: "",
    updaterName: "",
    statistics: {
      objectTypesTotal: 0,
      relationTypesTotal: 0,
      actionTypesTotal: 0,
      conceptGroupsTotal: 0,
      metricsTotal: 0,
    },
  };
}

describe("formatKnowledgeNetworkUpdateTime", () => {
  it("removes seconds only from a complete time value", () => {
    expect(formatKnowledgeNetworkUpdateTime("2026-08-06 14:30:45")).toBe("2026-08-06 14:30");
    expect(formatKnowledgeNetworkUpdateTime("2026-08-06 14:30")).toBe("2026-08-06 14:30");
  });

  it("preserves existing empty-state values", () => {
    expect(formatKnowledgeNetworkUpdateTime("-")).toBe("-");
    expect(formatKnowledgeNetworkUpdateTime("")).toBe("--");
    expect(formatKnowledgeNetworkUpdateTime()).toBe("--");
  });
});

describe("getKnowledgeNetworkCardMenuKeys", () => {
  it("hides edit and delete when record operations do not allow them", () => {
    expect(getKnowledgeNetworkCardMenuKeys(createRecord(["view_detail"]))).toEqual([
      "view",
      "export",
    ]);
  });

  it("shows edit and delete only when record operations allow them", () => {
    expect(
      getKnowledgeNetworkCardMenuKeys(createRecord(["view_detail", "modify", "delete"])),
    ).toEqual(["view", "edit", "export", "delete"]);
  });

  it("denies actions when operation data is missing", () => {
    expect(hasKnowledgeNetworkRecordOperation(null, "modify")).toBe(false);
    expect(hasKnowledgeNetworkRecordOperation(createRecord(), "modify")).toBe(false);
    expect(hasKnowledgeNetworkRecordOperation(createRecord(["view_detail"]), "modify")).toBe(false);
  });
});
