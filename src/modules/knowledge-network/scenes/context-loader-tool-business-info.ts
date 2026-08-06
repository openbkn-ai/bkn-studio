/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ContextLoaderOp } from "@/modules/knowledge-network/services/context-loader.service";

export type ToolBusinessGroupKey = "model" | "query" | "data" | "logic" | "skill" | "network" | "lifecycle" | "other";

export type ToolBusinessInfo = {
  groupKey: ToolBusinessGroupKey;
  name: string;
};

const TOOL_BUSINESS_NAMES: Record<string, ToolBusinessInfo> = {
  search_schema: { groupKey: "model", name: "语义检索" },
  get_object_types: { groupKey: "model", name: "对象类定义查询" },
  get_relation_types: { groupKey: "model", name: "关系类定义查询" },
  get_action_types: { groupKey: "model", name: "行动类定义查询" },
  get_metric_types: { groupKey: "model", name: "指标定义查询" },
  query_object_instance: { groupKey: "query", name: "对象实例查询" },
  query_instance_subgraph: { groupKey: "query", name: "关系子图查询" },
  list_resources: { groupKey: "data", name: "数据资源列表" },
  describe_resource: { groupKey: "data", name: "资源字段结构" },
  run_sql: { groupKey: "data", name: "SQL 数据查询" },
  get_logic_properties_values: { groupKey: "logic", name: "逻辑属性计算" },
  get_action_info: { groupKey: "logic", name: "行动工具召回" },
  execute_action: { groupKey: "logic", name: "执行行动" },
  get_action_execution: { groupKey: "logic", name: "行动执行结果" },
  list_action_execution: { groupKey: "logic", name: "行动执行记录" },
  list_action_executions: { groupKey: "logic", name: "行动执行记录" },
  query_metric: { groupKey: "logic", name: "指标数据查询" },
  find_skills: { groupKey: "skill", name: "Skill 能力检索" },
  list_skills: { groupKey: "skill", name: "技能列表" },
  get_skill_content: { groupKey: "skill", name: "查看技能内容" },
  read_skill_file: { groupKey: "skill", name: "读取技能文件" },
  list_knowledge_networks: { groupKey: "network", name: "知识网络列表" },
  get_kn_detail: { groupKey: "network", name: "知识网络详情" },
  bkn_create_conversation: { groupKey: "lifecycle", name: "创建会话" },
  bkn_resume_conversation: { groupKey: "lifecycle", name: "恢复会话" },
  bkn_close_conversation: { groupKey: "lifecycle", name: "关闭会话" },
  bkn_start_interaction: { groupKey: "lifecycle", name: "开始交互" },
  bkn_finish_interaction: { groupKey: "lifecycle", name: "结束交互" },
  bkn_complete_interaction: { groupKey: "lifecycle", name: "完成交互" },
  bkn_fail_interaction: { groupKey: "lifecycle", name: "标记交互失败" },
  bkn_cancel_interaction: { groupKey: "lifecycle", name: "取消交互" },
  bkn_handoff_interaction: { groupKey: "lifecycle", name: "移交交互" },
  bkn_get_operation: { groupKey: "lifecycle", name: "查看操作状态" },
  bkn_retry_operation: { groupKey: "lifecycle", name: "重试操作" },
  bkn_get_receipt: { groupKey: "lifecycle", name: "查看调用回执" },
};

const MODEL_TOOL_ORDER = ["search_schema", "get_object_types", "get_relation_types"];
const QUERY_TOOL_ORDER = ["query_object_instance", "query_instance_subgraph"];
const LIFECYCLE_TOOL_ORDER = ["bkn_start_interaction", "bkn_finish_interaction"];

export function compareToolsInBusinessGroup(groupKey: ToolBusinessGroupKey, left: ContextLoaderOp, right: ContextLoaderOp): number {
  const toolOrder =
    groupKey === "model"
      ? MODEL_TOOL_ORDER
      : groupKey === "query"
        ? QUERY_TOOL_ORDER
        : groupKey === "lifecycle"
          ? LIFECYCLE_TOOL_ORDER
          : null;
  if (!toolOrder) return 0;
  const leftIndex = toolOrder.indexOf(left.id);
  const rightIndex = toolOrder.indexOf(right.id);
  return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
}

export function businessInfoOf(op: ContextLoaderOp): ToolBusinessInfo {
  const exact = TOOL_BUSINESS_NAMES[op.id];
  if (exact) return exact;
  const id = op.id.toLowerCase();
  if (id.startsWith("bkn_")) {
    return { groupKey: "lifecycle", name: "交互生命周期工具" };
  }
  if (id.includes("object") || id.includes("relation") || id.includes("schema") || id.includes("metric_type")) {
    return { groupKey: "model", name: "知识模型工具" };
  }
  if (id.includes("resource") || id.includes("sql") || id.includes("catalog")) {
    return { groupKey: "data", name: "数据资源工具" };
  }
  if (id.includes("skill")) return { groupKey: "skill", name: "技能与动态工具" };
  if (id.includes("action") || id.includes("logic") || id.includes("metric")) {
    return { groupKey: "logic", name: "逻辑与行动工具" };
  }
  if (id.includes("instance") || id.includes("subgraph") || id.includes("query")) {
    return { groupKey: "query", name: "对象查询工具" };
  }
  if (id.includes("kn") || id.includes("network")) return { groupKey: "network", name: "知识网络工具" };
  return { groupKey: "other", name: "MCP 能力" };
}
