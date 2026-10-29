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
  execution:
    "Run Python or a shell command in the sandbox, calling the tools above from inside the script",
  other: "Unclassified MCP capabilities",
};

/** Local fallback groups; array order is display order. */
const LOCAL_GROUPS: Array<{ key: string; label: string }> = [
  { key: "lifecycle", label: "Session and interaction lifecycle" },
  { key: "network", label: "Knowledge network info" },
  { key: "model", label: "Knowledge model discovery" },
  { key: "query", label: "Object and subgraph queries" },
  { key: "data", label: "Data resources and SQL" },
  { key: "logic", label: "Logic and actions" },
  { key: "skill", label: "Skills and dynamic tools" },
  { key: "execution", label: "Code execution" },
  { key: "other", label: "Other capabilities" },
];

/** Local fallback tools; array order is in-group display order. */
const LOCAL_TOOLS: Array<{ id: string; groupKey: string; name: string }> = [
  { id: "bkn_create_conversation", groupKey: "lifecycle", name: "Create conversation" },
  { id: "bkn_resume_conversation", groupKey: "lifecycle", name: "Resume conversation" },
  { id: "bkn_close_conversation", groupKey: "lifecycle", name: "Close conversation" },
  { id: "bkn_start_interaction", groupKey: "lifecycle", name: "Start interaction" },
  { id: "bkn_finish_interaction", groupKey: "lifecycle", name: "Finish interaction" },
  { id: "bkn_complete_interaction", groupKey: "lifecycle", name: "Complete interaction" },
  { id: "bkn_cancel_interaction", groupKey: "lifecycle", name: "Cancel interaction" },
  { id: "bkn_fail_interaction", groupKey: "lifecycle", name: "Mark interaction failed" },
  { id: "bkn_handoff_interaction", groupKey: "lifecycle", name: "Handoff interaction" },
  { id: "bkn_context", groupKey: "lifecycle", name: "Write managed context" },
  { id: "bkn_get_operation", groupKey: "lifecycle", name: "View operation status" },
  { id: "bkn_retry_operation", groupKey: "lifecycle", name: "Retry operation" },
  { id: "bkn_get_receipt", groupKey: "lifecycle", name: "View call receipt" },
  { id: "list_knowledge_networks", groupKey: "network", name: "Knowledge network list" },
  { id: "get_kn_detail", groupKey: "network", name: "Knowledge network details" },
  { id: "search_schema", groupKey: "model", name: "Semantic search" },
  { id: "get_object_types", groupKey: "model", name: "Object type definitions" },
  { id: "get_relation_types", groupKey: "model", name: "Relation type definitions" },
  { id: "get_action_types", groupKey: "model", name: "Action type definitions" },
  { id: "get_metric_types", groupKey: "model", name: "Metric definitions" },
  { id: "query_object_instance", groupKey: "query", name: "Object instance query" },
  { id: "query_instance_subgraph", groupKey: "query", name: "Relation subgraph query" },
  { id: "list_resources", groupKey: "data", name: "Data resource list" },
  { id: "describe_resource", groupKey: "data", name: "Resource field schema" },
  { id: "run_sql", groupKey: "data", name: "SQL data query" },
  { id: "get_logic_properties_values", groupKey: "logic", name: "Logical property calculation" },
  { id: "get_action_info", groupKey: "logic", name: "Action tool recall" },
  { id: "execute_action", groupKey: "logic", name: "Execute action" },
  { id: "get_action_execution", groupKey: "logic", name: "Action execution result" },
  { id: "list_action_execution", groupKey: "logic", name: "Action execution history" },
  { id: "list_action_executions", groupKey: "logic", name: "Action execution history" },
  { id: "query_metric", groupKey: "logic", name: "Metric data query" },
  { id: "search_capabilities", groupKey: "logic", name: "Capability search" },
  { id: "execute_tool", groupKey: "logic", name: "Execute tool" },
  { id: "list_skills", groupKey: "skill", name: "Skill list" },
  { id: "get_skill_content", groupKey: "skill", name: "View skill content" },
  { id: "read_skill_file", groupKey: "skill", name: "Read skill file" },
  { id: "execute_skill", groupKey: "skill", name: "Execute skill" },
  { id: "run_code", groupKey: "execution", name: "Run code" },
  { id: "run_shell", groupKey: "execution", name: "Run command" },
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
    LOCAL_TOOL_INDEX.set(tool.id, {
      groupKey: tool.groupKey,
      name: tool.name,
      order: localOrder(tool.groupKey, slot),
    });
  }
}

/** Guesses a group when neither server metadata nor the local catalog knows the tool. */
function guessLocal(toolId: string): { groupKey: string; name: string } {
  const id = toolId.toLowerCase();
  // Platform tools use the bkn_ prefix. Check it before keyword matching because
  // bkn_* contains "kn" and interaction contains "action".
  if (id.startsWith("bkn_")) return { groupKey: "lifecycle", name: "Session lifecycle tool" };
  if (id.includes("interaction") || id.includes("conversation"))
    return { groupKey: "lifecycle", name: "Session lifecycle tool" };
  if (
    id.includes("object") ||
    id.includes("relation") ||
    id.includes("schema") ||
    id.includes("metric_type")
  ) {
    return { groupKey: "model", name: "Knowledge model tool" };
  }
  if (id.includes("resource") || id.includes("sql") || id.includes("catalog"))
    return { groupKey: "data", name: "Data resource tool" };
  if (id.includes("skill")) return { groupKey: "skill", name: "Skills and dynamic tools" };
  if (id.includes("action") || id.includes("logic") || id.includes("metric"))
    return { groupKey: "logic", name: "Logic and action tool" };
  if (id.includes("instance") || id.includes("subgraph") || id.includes("query"))
    return { groupKey: "query", name: "Object query tool" };
  if (id.includes("kn") || id.includes("network"))
    return { groupKey: "network", name: "Knowledge network tool" };
  return { groupKey: "other", name: "MCP capability" };
}

function localDisplayOf(toolId: string): {
  groupKey: string;
  groupLabel: string;
  name: string;
  order: number;
} {
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
    groupLabel: serverGroup ? (tool?.groupTitle ?? serverGroup) : local.groupLabel,
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
export function buildMcpToolGroups<T>(
  items: T[],
  displayOf: (item: T) => McpToolDisplay,
): Array<McpToolGroup<T>> {
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
  return groups.sort(
    (left, right) => (left.items[0]?.display.order ?? 0) - (right.items[0]?.display.order ?? 0),
  );
}
