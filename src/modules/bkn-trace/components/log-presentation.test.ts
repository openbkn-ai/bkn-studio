/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it, vi } from "vitest";

import { presentLogAction, presentLogActor, presentLogTarget, presentTargetType } from "@/modules/bkn-trace/components/log-presentation";
import type { LogRecord } from "@/modules/bkn-trace/services/observability.service";

vi.mock("@/framework/runtime/config", () => ({
  getRuntimeConfig: () => ({
    currentUser: {
      id: "266c6a42-6131-4d62-8f39-853e7093701c",
      name: "Administrator",
    },
  }),
}));

const translate = (key: string) => key;

const phase4BTranslations: Record<string, string> = {
  "bknTrace.logs.domainAction": "{{action}}{{target}}",
  "bknTrace.logs.domainAuditActions.add_members": "添加",
  "bknTrace.logs.domainAuditActions.create": "创建",
  "bknTrace.logs.domainAuditActions.delete": "删除",
  "bknTrace.logs.domainAuditActions.import": "导入",
  "bknTrace.logs.domainAuditActions.update": "更新",
  "bknTrace.logs.targetTypes.action_schedule": "行动计划",
  "bknTrace.logs.targetTypes.action_type": "行动类型",
  "bknTrace.logs.targetTypes.concept_group": "概念分组",
  "bknTrace.logs.targetTypes.knowledge_network": "业务知识网络",
  "bknTrace.logs.targetTypes.metric": "指标",
  "bknTrace.logs.targetTypes.object_type": "对象类",
  "bknTrace.logs.targetTypes.relation_type": "关系类",
  "bknTrace.logs.targetTypes.risk_type": "风险类型",
};

const textValue = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value) : "";

const translatePhase4B = (key: string, options?: Record<string, unknown>) => {
  const template = phase4BTranslations[key] ?? (textValue(options?.defaultValue) || key);
  return template.replace(/{{(\w+)}}/g, (_match, name: string) => textValue(options?.[name]));
};

describe("log presentation", () => {
  it("uses the current authenticated username when an old event only contains its user id", () => {
    const record = {
      actor: {
        id: "266c6a42-6131-4d62-8f39-853e7093701c",
        name: "266c6a42-6131-4d62-8f39-853e7093701c",
        type: "user",
      },
      authMethod: "unknown",
    } as LogRecord;

    expect(presentLogActor(record, translate, new Map()).primary).toBe("Administrator");
  });

  it.each([
    ["create", "object_type", "material", "物料", "创建对象类", "对象类"],
    ["import", "knowledge_network", "supplychain", "供应链", "导入业务知识网络", "业务知识网络"],
    ["update", "relation_type", "contains", "包含", "更新关系类", "关系类"],
    ["delete", "action_type", "replenish", "补货", "删除行动类型", "行动类型"],
    ["create", "metric", "inventory_turnover", "库存周转率", "创建指标", "指标"],
    ["create", "risk_type", "inventory_risk", "库存风险", "创建风险类型", "风险类型"],
    ["add_members", "concept_group", "supply", "供应链概念", "添加概念分组", "概念分组"],
    ["update", "action_schedule", "schedule-a", "每日补货检查", "更新行动计划", "行动计划"],
  ])("presents a readable Phase 4B %s %s fact", (action, targetType, id, name, expectedAction, expectedType) => {
    const record = {
      action,
      businessModule: "domain_knowledge_network",
      eventName: "resource_config.changed",
      target: { id, name, type: targetType },
    } as LogRecord;

    expect(presentLogAction(record, translatePhase4B)).toBe(expectedAction);
    expect(presentTargetType(record, translatePhase4B)).toBe(expectedType);
    expect(presentLogTarget(record, translatePhase4B)).toEqual({ primary: name, secondary: id });
  });
});
