/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import i18n from "@/app/locales/i18n";
import {
  operationLabel,
  operationsForType,
  resourceTypeLabel,
} from "@/modules/system-admin/utils/resource-catalog";

describe("resource-catalog", () => {
  it("resolves resource and operation labels from the active locale", async () => {
    await i18n.changeLanguage("en-US");

    expect(resourceTypeLabel("knowledge_network")).toBe("Knowledge network");
    expect(operationLabel("knowledge_network", "query_data")).toBe("Query data");
    expect(operationsForType("catalog").map((item) => item.label)).toContain("View details");
  });

  /**
   * The vocabulary drives what an administrator can hand out. A verb missing here cannot be granted
   * at all, which is how `catalog:resource_manage` stayed ungrantable after the backend moved table
   * management onto the owning catalog (openbkn-ai/bkn-foundry#986). These lists match the
   * operations bkn-safe stores on each type.
   */
  it("offers every catalog operation the backend accepts, table management included", () => {
    const operations = operationsForType("catalog").map((item) => item.key);

    expect(operations).toEqual(
      expect.arrayContaining([
        "view_detail",
        "create",
        "modify",
        "delete",
        "authorize",
        "task_manage",
        "resource_manage",
        "query_data",
      ]),
    );
  });

  it("offers a table only the two verbs it still declares", () => {
    expect(operationsForType("resource").map((item) => item.key)).toEqual([
      "view_detail",
      "query_data",
    ]);
  });

  it("offers task management only for action types among knowledge-network children", () => {
    for (const type of ["concept_group", "object_type", "relation_type", "metric", "risk_type"]) {
      expect(operationsForType(type).map((item) => item.key)).not.toContain("task_manage");
    }

    expect(operationsForType("action_type").map((item) => item.key)).toContain("task_manage");
  });

  it("offers data querying for every knowledge-network child type", () => {
    for (const type of [
      "concept_group",
      "object_type",
      "relation_type",
      "action_type",
      "metric",
      "risk_type",
    ]) {
      expect(operationsForType(type).map((item) => item.key)).toContain("query_data");
    }
  });

  it("falls back to raw keys for unknown resource and operation keys", () => {
    expect(resourceTypeLabel("unknown_resource")).toBe("unknown_resource");
    expect(operationLabel("unknown_resource", "unknown_op")).toBe("unknown_op");
  });
});
