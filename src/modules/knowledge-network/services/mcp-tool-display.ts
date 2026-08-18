/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Display metadata for MCP tools, including display name, grouping, and sorting.
 *
 * The authoritative source is server tools/list. MCP 2025-06-18 uses `title`,
 * while grouping and sorting come from `_meta` fields `openbkn.ai/group`,
 * `openbkn.ai/group_title`, and `openbkn.ai/order`.
 * The local catalog is only a fallback for old servers and the REST console.
 */

import type { McpToolDef } from "@/modules/knowledge-network/services/context-loader.service";

export type McpToolDisplay = {
  groupKey: string;
  groupLabel: string;
  groupDescription: string | null;
  /** Display name; server title first, then local fallback. */
  name: string;
  /** In-group sort order; tools without server order stay at the group tail. */
  order: number;
  /** Whether the group came from the server; server group labels win per key. */
  fromServer: boolean;
};

export type McpToolGroup<T> = {
  key: string;
  label: string;
  description: string | null;
  items: Array<{ item: T; display: McpToolDisplay }>;
};

/**
 * Group descriptions. The server sends group names but not descriptions, so
 * known group keys get concise UI descriptions here.
 */
const GROUP_DESCRIPTIONS: Record<string, string> = {
  // Agent chat still exposes this group to the model, while buildAgentTools binds
  // lifecycle execution to the current Studio interaction.
  lifecycle: "Create conversations, manage interactions, and write managed context",
  discovery: "Knowledge network lists, structure, schema discovery, and type details",
  query: "Object instances, relation subgraphs, logical properties, metrics, and SQL queries",
  action: "Action recall, execution, and execution history",
  resource: "Data resource inspection, skill recall, and execution",
  network: "Knowledge network list and current network details",
  model: "Semantic search and object, relation, action, and metric definitions",
  data: "Data resource lists, field schemas, and SQL data queries",
  logic: "Logical property calculation, action recall, and action execution",
  skill: "Skill search and online dynamic tools",
  // run_code / run_shell. The server merged them onto the business tool surface,
  // so they arrive as ordinary tools with their own group rather than a mode switch.
  execution: "Run Python or a shell command in the sandbox, calling the tools above from inside the script",
  other: "Unclassified MCP capabilities",
};

/** Local fallback groups; array order is display order. */
const LOCAL_GROUPS: Array<{ key: string; label: string }> = [
  { key: "lifecycle", label: "Session and Interaction Lifecycle" },
  { key: "network", label: "Knowledge Network Info" },
  { key: "model", label: "Knowledge Model Discovery" },
  { key: "query", label: "Object and Subgraph Queries" },
  { key: "data", label: "Data Resources and SQL" },
  { key: "logic", label: "Logic and Actions" },
  { key: "skill", label: "Skills and Dynamic Tools" },
  { key: "execution", label: "Code Execution" },
  { key: "other", label: "Other Capabilities" },
];

/** Local fallback tools; array order is in-group display order. */
const LOCAL_TOOLS: Array<{ id: string; groupKey: string; name: string }> = [
  { id: "bkn_create_conversation", groupKey: "lifecycle", name: "Create Conversation" },
  { id: "bkn_resume_conversation", groupKey: "lifecycle", name: "Resume Conversation" },
  { id: "bkn_close_conversation", groupKey: "lifecycle", name: "Close Conversation" },
  { id: "bkn_start_interaction", groupKey: "lifecycle", name: "Start Interaction" },
  { id: "bkn_finish_interaction", groupKey: "lifecycle", name: "Finish Interaction" },
  { id: "bkn_complete_interaction", groupKey: "lifecycle", name: "Complete Interaction" },
  { id: "bkn_cancel_interaction", groupKey: "lifecycle", name: "Cancel Interaction" },
  { id: "bkn_fail_interaction", groupKey: "lifecycle", name: "Mark Interaction Failed" },
  { id: "bkn_handoff_interaction", groupKey: "lifecycle", name: "Handoff Interaction" },
  { id: "bkn_context", groupKey: "lifecycle", name: "Write Managed Context" },
  { id: "bkn_get_operation", groupKey: "lifecycle", name: "View Operation Status" },
  { id: "bkn_retry_operation", groupKey: "lifecycle", name: "Retry Operation" },
  { id: "bkn_get_receipt", groupKey: "lifecycle", name: "View Call Receipt" },
  { id: "list_knowledge_networks", groupKey: "network", name: "Knowledge Network List" },
  { id: "get_kn_detail", groupKey: "network", name: "Knowledge Network Details" },
  { id: "search_schema", groupKey: "model", name: "Semantic Search" },
  { id: "get_object_types", groupKey: "model", name: "Object Type Definitions" },
  { id: "get_relation_types", groupKey: "model", name: "Relation Type Definitions" },
  { id: "get_action_types", groupKey: "model", name: "Action Type Definitions" },
  { id: "get_metric_types", groupKey: "model", name: "Metric Definitions" },
  { id: "query_object_instance", groupKey: "query", name: "Object Instance Query" },
  { id: "query_instance_subgraph", groupKey: "query", name: "Relation Subgraph Query" },
  { id: "list_resources", groupKey: "data", name: "Data Resource List" },
  { id: "describe_resource", groupKey: "data", name: "Resource Field Schema" },
  { id: "run_sql", groupKey: "data", name: "SQL Data Query" },
  { id: "get_logic_properties_values", groupKey: "logic", name: "Logical Property Calculation" },
  { id: "get_action_info", groupKey: "logic", name: "Action Tool Recall" },
  { id: "execute_action", groupKey: "logic", name: "Execute Action" },
  { id: "get_action_execution", groupKey: "logic", name: "Action Execution Result" },
  { id: "list_action_execution", groupKey: "logic", name: "Action Execution History" },
  { id: "list_action_executions", groupKey: "logic", name: "Action Execution History" },
  { id: "query_metric", groupKey: "logic", name: "Metric Data Query" },
  { id: "find_skills", groupKey: "skill", name: "Skill Capability Search" },
  { id: "list_skills", groupKey: "skill", name: "Skill List" },
  { id: "get_skill_content", groupKey: "skill", name: "View Skill Content" },
  { id: "read_skill_file", groupKey: "skill", name: "Read Skill File" },
  { id: "execute_skill", groupKey: "skill", name: "Execute Skill" },
  { id: "run_code", groupKey: "execution", name: "Run Code" },
  { id: "run_shell", groupKey: "execution", name: "Run Command" },
];

/** Fallback order base; local fallback entries sort after server-declared entries. */
const LOCAL_ORDER_BASE = 100_000;
/** Guessed entries without named local catalog rows sort after known entries. */
const LOCAL_GUESS_SLOT = 90;

const LOCAL_GROUP_INDEX = new Map(LOCAL_GROUPS.map((group, index) => [group.key, index]));
const LOCAL_GROUP_LABELS = new Map(LOCAL_GROUPS.map((group) => [group.key, group.label]));

function localOrder(groupKey: string, slot: number): number {
  const groupIndex = LOCAL_GROUP_INDEX.get(groupKey) ?? LOCAL_GROUPS.length;
  return LOCAL_ORDER_BASE + groupIndex * 1000 + slot * 10;
}

const LOCAL_TOOL_INDEX = new Map<string, { groupKey: string; name: string; order: number }>();
{
  const slots = new Map<string, number>();
  for (const tool of LOCAL_TOOLS) {
    const slot = slots.get(tool.groupKey) ?? 0;
    slots.set(tool.groupKey, slot + 1);
    LOCAL_TOOL_INDEX.set(tool.id, { groupKey: tool.groupKey, name: tool.name, order: localOrder(tool.groupKey, slot) });
  }
}

/** Guesses a group when neither server metadata nor the local catalog knows the tool. */
function guessLocal(toolId: string): { groupKey: string; name: string } {
  const id = toolId.toLowerCase();
  // Platform tools use the bkn_ prefix. Check it before keyword matching because
  // bkn_* contains "kn" and interaction contains "action".
  if (id.startsWith("bkn_")) return { groupKey: "lifecycle", name: "Session Lifecycle Tool" };
  if (id.includes("interaction") || id.includes("conversation")) return { groupKey: "lifecycle", name: "Session Lifecycle Tool" };
  if (id.includes("object") || id.includes("relation") || id.includes("schema") || id.includes("metric_type")) {
    return { groupKey: "model", name: "Knowledge Model Tool" };
  }
  if (id.includes("resource") || id.includes("sql") || id.includes("catalog")) return { groupKey: "data", name: "Data Resource Tool" };
  if (id.includes("skill")) return { groupKey: "skill", name: "Skills and Dynamic Tools" };
  if (id.includes("action") || id.includes("logic") || id.includes("metric")) return { groupKey: "logic", name: "Logic and Action Tool" };
  if (id.includes("instance") || id.includes("subgraph") || id.includes("query")) return { groupKey: "query", name: "Object Query Tool" };
  if (id.includes("kn") || id.includes("network")) return { groupKey: "network", name: "Knowledge Network Tool" };
  return { groupKey: "other", name: "MCP Capability" };
}

function localDisplayOf(toolId: string): { groupKey: string; groupLabel: string; name: string; order: number } {
  const known = LOCAL_TOOL_INDEX.get(toolId);
  const fallback = known ?? { ...guessLocal(toolId), order: 0 };
  const groupKey = fallback.groupKey;
  return {
    groupKey,
    groupLabel: LOCAL_GROUP_LABELS.get(groupKey) ?? groupKey,
    name: fallback.name,
    order: known ? known.order : localOrder(groupKey, LOCAL_GUESS_SLOT),
  };
}

/** Server display metadata wins, with local fallback for missing fields. */
export function toolDisplayOf(toolId: string, tool?: McpToolDef | null): McpToolDisplay {
  const local = localDisplayOf(toolId);
  const serverGroup = tool?.group;
  const groupKey = serverGroup ?? local.groupKey;
  return {
    groupKey,
    groupLabel: serverGroup ? tool?.groupTitle ?? serverGroup : local.groupLabel,
    groupDescription: GROUP_DESCRIPTIONS[groupKey] ?? null,
    name: tool?.title ?? local.name,
    order: tool?.order ?? local.order,
    fromServer: serverGroup !== undefined,
  };
}

/**
 * Groups by display metadata. Items sort by order inside each group; groups sort
 * by the smallest item order.
 */
export function buildMcpToolGroups<T>(items: T[], displayOf: (item: T) => McpToolDisplay): Array<McpToolGroup<T>> {
  const buckets = new Map<string, McpToolGroup<T>>();
  const serverLabeled = new Set<string>();
  for (const item of items) {
    const display = displayOf(item);
    const bucket = buckets.get(display.groupKey);
    if (!bucket) {
      buckets.set(display.groupKey, {
        key: display.groupKey,
        label: display.groupLabel,
        description: display.groupDescription,
        items: [{ item, display }],
      });
      if (display.fromServer) serverLabeled.add(display.groupKey);
      continue;
    }
    // Server group labels win over fallback labels for the same group key.
    if (display.fromServer && !serverLabeled.has(display.groupKey)) {
      bucket.label = display.groupLabel;
      serverLabeled.add(display.groupKey);
    }
    bucket.items.push({ item, display });
  }
  const groups = [...buckets.values()];
  for (const group of groups) {
    group.items.sort((left, right) => left.display.order - right.display.order);
  }
  return groups.sort((left, right) => (left.items[0]?.display.order ?? 0) - (right.items[0]?.display.order ?? 0));
}
