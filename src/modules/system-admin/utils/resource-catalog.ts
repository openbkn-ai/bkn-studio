/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * 对象授权的「资源类型 → 操作」词表。
 *
 * 数据来源：对 bkn-safe(VM 10.211.55.4) 9 个内置角色的 permissions 聚合实测，
 * 即后端权威词表。授权模型 = {resource:{type,id}, operations}（id="*" 整类，
 * 具体 id = 单实例）。新类型/操作以后端为准；未知 type 走自由输入兜底。
 */
export type OperationDef = {
  key: string;
  label: string;
};

export type ResourceTypeDef = {
  label: string;
  operations: string[];
  type: string;
};

export const WILDCARD = "*";

/** 操作 key → 中文标签（跨资源类型复用）。 */
const OPERATION_LABELS: Record<string, string> = {
  "*": "全部操作",
  view_detail: "查看详情",
  view: "查看",
  list: "列表",
  display: "展示",
  create: "新建",
  modify: "修改",
  delete: "删除",
  authorize: "授权",
  task_manage: "任务管理",
  data_query: "数据查询",
  execute: "执行",
  manual_exec: "手动执行",
  run_statistics: "运行统计",
  run_with_app: "随应用运行",
  public_access: "公开访问",
  publish: "发布",
  unpublish: "取消发布",
  use: "使用",
  create_system_agent: "创建系统智能体",
  mgnt_built_in_agent: "管理内置智能体",
  see_trajectory_analysis: "轨迹分析",
  unpublish_other_user_agent: "下架他人智能体",
  unpublish_other_user_agent_tpl: "下架他人智能体模板",
  publish_to_be_api_agent: "发布为 API 智能体",
  publish_to_be_data_flow_agent: "发布为数据流智能体",
  publish_to_be_skill_agent: "发布为技能智能体",
  publish_to_be_web_sdk_agent: "发布为 Web SDK 智能体",
};

// 各资源类型支持的操作集（实测自后端内置角色权限）。
const CRUD_AUTHZ = ["view_detail", "create", "modify", "delete", "authorize", "task_manage"];
const PUBLISHABLE = [
  "view",
  "create",
  "modify",
  "delete",
  "execute",
  "authorize",
  "public_access",
  "publish",
  "unpublish",
];

export const RESOURCE_TYPES: ResourceTypeDef[] = [
  { type: "catalog", label: "数据连接 / Catalog", operations: CRUD_AUTHZ },
  { type: "resource", label: "数据资源", operations: CRUD_AUTHZ },
  { type: "connector_type", label: "连接器类型", operations: CRUD_AUTHZ },
  {
    type: "knowledge_network",
    label: "知识网络",
    operations: ["view_detail", "create", "modify", "delete", "data_query", "authorize", "task_manage"],
  },
  {
    type: "stream_data_pipeline",
    label: "流式数据管道",
    operations: ["view_detail", "create", "modify", "delete", "authorize"],
  },
  {
    type: "data_flow",
    label: "数据流",
    operations: ["list", "view", "create", "modify", "delete", "manual_exec", "run_statistics", "run_with_app", "display"],
  },
  { type: "small_model", label: "小模型", operations: ["display", "create", "modify", "delete", "execute"] },
  { type: "large_model", label: "大模型", operations: ["display", "create", "modify", "delete", "execute"] },
  { type: "operator", label: "算子", operations: PUBLISHABLE },
  { type: "tool_box", label: "工具箱", operations: PUBLISHABLE },
  { type: "skill", label: "技能", operations: PUBLISHABLE },
  { type: "mcp", label: "MCP", operations: PUBLISHABLE },
  {
    type: "agent",
    label: "智能体",
    operations: [
      "use",
      "publish",
      "unpublish",
      "unpublish_other_user_agent",
      "create_system_agent",
      "mgnt_built_in_agent",
      "see_trajectory_analysis",
      "publish_to_be_api_agent",
      "publish_to_be_data_flow_agent",
      "publish_to_be_skill_agent",
      "publish_to_be_web_sdk_agent",
    ],
  },
  {
    type: "agent_tpl",
    label: "智能体模板",
    operations: ["publish", "unpublish", "unpublish_other_user_agent_tpl"],
  },
];

const byType = new Map(RESOURCE_TYPES.map((item) => [item.type, item]));

export function resourceTypeLabel(type: string): string {
  return byType.get(type)?.label ?? type;
}

export function operationLabel(_type: string, op: string): string {
  return OPERATION_LABELS[op] ?? op;
}

export function operationsForType(type: string): OperationDef[] {
  return (byType.get(type)?.operations ?? []).map((op) => ({
    key: op,
    label: OPERATION_LABELS[op] ?? op,
  }));
}
