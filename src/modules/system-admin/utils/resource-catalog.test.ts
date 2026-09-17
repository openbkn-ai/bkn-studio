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
  ROLE_GRANT_RESOURCE_TYPES,
  resourceTypeLabel,
  resourceTypeDescription,
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

  it("limits role grants to supported type-wide resource types", () => {
    const roleGrantTypes = ROLE_GRANT_RESOURCE_TYPES.map((item) => item.type);

    for (const type of [
      "agent",
      "agent_tpl",
      "connector_type",
      "risk_type",
    ]) {
      expect(roleGrantTypes).not.toContain(type);
    }
    expect(roleGrantTypes).toEqual(
      expect.arrayContaining([
        "concept_group",
        "object_type",
        "relation_type",
        "action_type",
        "metric",
        "function",
      ]),
    );
  });

  it("uses the corrected names for catalog and resource", async () => {
    await i18n.changeLanguage("zh-CN");

    expect(resourceTypeLabel("catalog")).toBe("数据目录");
    expect(resourceTypeLabel("resource")).toBe("数据资源");
  });

  it("uses the execution-factory names for executable resource types", async () => {
    await i18n.changeLanguage("zh-CN");

    expect(resourceTypeLabel("operator")).toBe("算子");
    expect(resourceTypeLabel("tool_box")).toBe("API 工具集");
    expect(resourceTypeLabel("function")).toBe("函数集");
    expect(resourceTypeLabel("mcp")).toBe("MCP 服务");
    expect(resourceTypeLabel("skill")).toBe("SKILL 包");
  });

  it("explains the separate operator and toolset grants in both locales", async () => {
    // AI generation and temporary code execution are authorized on `function`, not `operator`.
    await i18n.changeLanguage("zh-CN");
    expect(resourceTypeDescription("operator")).toContain("函数集权限");
    expect(resourceTypeDescription("tool_box")).toContain("修改");
    expect(resourceTypeDescription("function")).toContain("修改");
    expect(resourceTypeDescription("function")).toContain("AI 生成");
    expect(resourceTypeDescription("function")).toContain("临时代码执行");
    await i18n.changeLanguage("en-US");
    expect(resourceTypeLabel("operator")).toBe("Operator");
    expect(resourceTypeLabel("tool_box")).toBe("API toolset");
    expect(resourceTypeLabel("function")).toBe("Function set");
    expect(resourceTypeDescription("operator")).toContain("Function set grants");
    expect(resourceTypeDescription("tool_box")).toContain("Modify");
    expect(resourceTypeDescription("function")).toContain("AI function generation");
    expect(resourceTypeDescription("function")).toContain("temporary code execution");
    expect(resourceTypeDescription("skill")).toBe("");
  });

  it("keeps task management out of knowledge-network grants", () => {
    for (const type of ["concept_group", "object_type", "relation_type", "action_type", "metric", "risk_type"]) {
      const operations = operationsForType(type).map((item) => item.key);
      expect(operations).not.toContain("authorize");
      expect(operations).not.toContain("task_manage");
    }

    expect(operationsForType("knowledge_network").map((item) => item.key)).toEqual([
      "view_detail",
      "create",
      "modify",
      "delete",
      "query_data",
      "authorize",
      "execute",
    ]);
    expect(operationsForType("action_type").map((item) => item.key)).toContain("execute");
  });

  it("offers data querying only for knowledge-network child types that declare it", () => {
    for (const type of [
      "object_type",
      "relation_type",
      "metric",
    ]) {
      expect(operationsForType(type).map((item) => item.key)).toContain("query_data");
    }
    expect(operationsForType("concept_group").map((item) => item.key)).not.toContain("query_data");
    expect(operationsForType("risk_type").map((item) => item.key)).not.toContain("query_data");
  });

  it("keeps action-type grants aligned with the backend vocabulary", () => {
    expect(operationsForType("action_type").map((item) => item.key)).toEqual([
      "view_detail",
      "modify",
      "delete",
      "execute",
    ]);
  });

  it("offers action execution on a knowledge network", () => {
    expect(operationsForType("knowledge_network").map((item) => item.key)).toContain("execute");
  });

  it("keeps function permissions aligned with the registry fixture", () => {
    expect(operationsForType("function").map((item) => item.key)).toEqual(
      expect.arrayContaining(["view", "modify", "execute"]),
    );
    expect(operationsForType("function").find((item) => item.key === "modify")?.requires)
      .toEqual(["view"]);
  });

  it("uses only catalog-declared authoring prerequisites", () => {
    expect(operationsForType("action_type").find((item) => item.key === "execute")?.requires)
      .toEqual([]);
    expect(operationsForType("catalog").find((item) => item.key === "resource_manage")?.requires)
      .toEqual(["view_detail"]);
    for (const operation of ["modify", "delete", "authorize"]) {
      expect(operationsForType("knowledge_network").find((item) => item.key === operation)?.requires)
        .toEqual(["view_detail"]);
    }
    expect(operationsForType("resource").find((item) => item.key === "query_data")?.requires)
      .toEqual([]);
  });

  it("localizes every knowledge-network child resource type in Chinese", async () => {
    await i18n.changeLanguage("zh-CN");

    expect(resourceTypeLabel("concept_group")).toBe("概念分组");
    expect(resourceTypeLabel("object_type")).toBe("对象类");
    expect(resourceTypeLabel("relation_type")).toBe("关系类");
    expect(resourceTypeLabel("action_type")).toBe("行动类");
    expect(resourceTypeLabel("metric")).toBe("指标");
    expect(resourceTypeLabel("risk_type")).toBe("风险类");
  });

  it("falls back to raw keys for unknown resource and operation keys", () => {
    expect(resourceTypeLabel("unknown_resource")).toBe("unknown_resource");
    expect(operationLabel("unknown_resource", "unknown_op")).toBe("unknown_op");
  });
});
