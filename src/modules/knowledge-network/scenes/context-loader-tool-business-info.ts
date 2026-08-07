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
  nameKey: string;
  name: string;
};

const TOOL_BUSINESS_NAMES: Record<string, ToolBusinessInfo> = {
  search_schema: toolInfo("model", "search_schema", "Semantic Search"),
  get_object_types: toolInfo("model", "get_object_types", "Object Type Definitions"),
  get_relation_types: toolInfo("model", "get_relation_types", "Relation Type Definitions"),
  get_action_types: toolInfo("model", "get_action_types", "Action Type Definitions"),
  get_metric_types: toolInfo("model", "get_metric_types", "Metric Definitions"),
  query_object_instance: toolInfo("query", "query_object_instance", "Object Instance Query"),
  query_instance_subgraph: toolInfo("query", "query_instance_subgraph", "Relation Subgraph Query"),
  list_resources: toolInfo("data", "list_resources", "Data Resource List"),
  describe_resource: toolInfo("data", "describe_resource", "Resource Field Schema"),
  run_sql: toolInfo("data", "run_sql", "SQL Data Query"),
  get_logic_properties_values: toolInfo("logic", "get_logic_properties_values", "Logical Attribute Calculation"),
  get_action_info: toolInfo("logic", "get_action_info", "Action Tool Recall"),
  execute_action: toolInfo("logic", "execute_action", "Execute Action"),
  get_action_execution: toolInfo("logic", "get_action_execution", "Action Execution Result"),
  list_action_execution: toolInfo("logic", "list_action_execution", "Action Execution History"),
  list_action_executions: toolInfo("logic", "list_action_executions", "Action Execution History"),
  query_metric: toolInfo("logic", "query_metric", "Metric Data Query"),
  find_skills: toolInfo("skill", "find_skills", "Skill Capability Search"),
  list_skills: toolInfo("skill", "list_skills", "Skill List"),
  get_skill_content: toolInfo("skill", "get_skill_content", "View Skill Content"),
  read_skill_file: toolInfo("skill", "read_skill_file", "Read Skill File"),
  list_knowledge_networks: toolInfo("network", "list_knowledge_networks", "Knowledge Network List"),
  get_kn_detail: toolInfo("network", "get_kn_detail", "Knowledge Network Details"),
  bkn_create_conversation: toolInfo("lifecycle", "bkn_create_conversation", "Create Conversation"),
  bkn_resume_conversation: toolInfo("lifecycle", "bkn_resume_conversation", "Resume Conversation"),
  bkn_close_conversation: toolInfo("lifecycle", "bkn_close_conversation", "Close Conversation"),
  bkn_start_interaction: toolInfo("lifecycle", "bkn_start_interaction", "Start Interaction"),
  bkn_finish_interaction: toolInfo("lifecycle", "bkn_finish_interaction", "Finish Interaction"),
  bkn_complete_interaction: toolInfo("lifecycle", "bkn_complete_interaction", "Complete Interaction"),
  bkn_fail_interaction: toolInfo("lifecycle", "bkn_fail_interaction", "Mark Interaction Failed"),
  bkn_cancel_interaction: toolInfo("lifecycle", "bkn_cancel_interaction", "Cancel Interaction"),
  bkn_handoff_interaction: toolInfo("lifecycle", "bkn_handoff_interaction", "Handoff Interaction"),
  bkn_get_operation: toolInfo("lifecycle", "bkn_get_operation", "View Operation Status"),
  bkn_retry_operation: toolInfo("lifecycle", "bkn_retry_operation", "Retry Operation"),
  bkn_get_receipt: toolInfo("lifecycle", "bkn_get_receipt", "View Call Receipt"),
};

function toolInfo(groupKey: ToolBusinessGroupKey, key: string, name: string): ToolBusinessInfo {
  return { groupKey, nameKey: `knowledgeNetwork.contextLoaderPanel.toolNames.${key}`, name };
}

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
    return toolInfo("lifecycle", "fallbackLifecycle", "Interaction Lifecycle Tool");
  }
  if (id.includes("object") || id.includes("relation") || id.includes("schema") || id.includes("metric_type")) {
    return toolInfo("model", "fallbackModel", "Knowledge Model Tool");
  }
  if (id.includes("resource") || id.includes("sql") || id.includes("catalog")) {
    return toolInfo("data", "fallbackData", "Data Resource Tool");
  }
  if (id.includes("skill")) return toolInfo("skill", "fallbackSkill", "Skills and Dynamic Tools");
  if (id.includes("action") || id.includes("logic") || id.includes("metric")) {
    return toolInfo("logic", "fallbackLogic", "Logic and Action Tool");
  }
  if (id.includes("instance") || id.includes("subgraph") || id.includes("query")) {
    return toolInfo("query", "fallbackQuery", "Object Query Tool");
  }
  if (id.includes("kn") || id.includes("network")) return toolInfo("network", "fallbackNetwork", "Knowledge Network Tool");
  return toolInfo("other", "fallbackOther", "MCP Capability");
}
