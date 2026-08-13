/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it, vi } from "vitest";

import { presentLogAction, presentLogActor, presentLogTarget, presentTargetType } from "@/modules/bkn-trace/components/log-presentation";
import { bknTraceEnUS } from "@/modules/bkn-trace/locales/en-US";
import { bknTraceZhCN } from "@/modules/bkn-trace/locales/zh-CN";
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

const textValue = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value) : "";

const createLocaleTranslator = (locale: unknown) => (key: string, options?: Record<string, unknown>) => {
  const translated = key.split(".").reduce<unknown>((value, segment) => {
    if (!value || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[segment];
  }, locale);
  const template = textValue(translated) || textValue(options?.defaultValue) || key;
  return template.replace(/{{(\w+)}}/g, (_match, name: string) => textValue(options?.[name]));
};

const translateZhCN = createLocaleTranslator(bknTraceZhCN);
const translateEnUS = createLocaleTranslator(bknTraceEnUS);

describe("log presentation", () => {
  it("presents a system user creation as a readable business action", () => {
    const record = {
      action: "create",
      businessModule: "system_management",
      eventName: "user.created",
      target: { id: "user-a", name: "日志测试", type: "user" },
    } as LogRecord;

    expect(presentLogAction(record, translateZhCN)).toBe("新建用户");
  });

  it("presents a user access event as a readable login action", () => {
    const record = {
      action: "login",
      logCategory: "access.user",
      businessModule: "system_management",
      target: { id: "user-a", name: "Alice", type: "user" },
    } as LogRecord;

    expect(presentLogAction(record, translateZhCN)).toBe("用户登录");
  });

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
    ["add_members", "concept_group", "supply", "供应链概念", "向概念分组添加成员", "概念分组"],
    ["remove_members", "concept_group", "supply", "供应链概念", "从概念分组移除成员", "概念分组"],
    ["update", "action_schedule", "schedule-a", "每日补货检查", "更新行动计划", "行动计划"],
  ])("presents a readable Phase 4B %s %s fact", (action, targetType, id, name, expectedAction, expectedType) => {
    const record = {
      action,
      businessModule: "domain_knowledge_network",
      eventName: "resource_config.changed",
      target: { id, name, type: targetType },
    } as LogRecord;

    expect(presentLogAction(record, translateZhCN)).toBe(expectedAction);
    expect(presentTargetType(record, translateZhCN)).toBe(expectedType);
    expect(presentLogTarget(record, translateZhCN)).toEqual({ primary: name, secondary: id });
  });

  it("uses the real English locale for concept-group membership actions", () => {
    const record = {
      action: "remove_members",
      businessModule: "domain_knowledge_network",
      eventName: "resource_config.changed",
      target: { id: "supply", name: "Supply concepts", type: "concept_group" },
    } as LogRecord;

    expect(presentLogAction(record, translateEnUS)).toBe("Remove members from concept group");
  });

  it.each([
    ["grant", "更新对象授权 对象类"],
    ["publish", "publish 对象类"],
  ])("falls back safely for an unregistered domain action %s", (action, expected) => {
    const record = {
      action,
      businessModule: "domain_knowledge_network",
      eventName: "resource_config.changed",
      target: { id: "material", name: "物料", type: "object_type" },
    } as LogRecord;

    expect(presentLogAction(record, translateZhCN)).toBe(expected);
  });
});
