/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * MCP 工具的展示元数据（展示名 / 分组 / 排序）。
 *
 * 权威来源是服务端 `tools/list`：`title` 用 MCP 2025-06-18 协议字段，分组与排序走工具
 * `_meta` 的 `openbkn.ai/group`、`openbkn.ai/group_title`、`openbkn.ai/order`。
 * 本地表只做兜底，两种情况用得上：老版本服务端不下发这些字段；REST 调试台没有 tools/list。
 * 兜底 order 统一大于服务端量级，所以服务端声明过的工具永远排在兜底工具之前。
 */

import type { McpToolDef } from "@/modules/knowledge-network/services/context-loader.service";

export type McpToolDisplay = {
  groupKey: string;
  groupLabel: string;
  groupDescription: string | null;
  /** 展示名：服务端 title 优先，其次本地兜底名。 */
  name: string;
  /** 组内排序；服务端未声明 order 的工具排在本组末尾。 */
  order: number;
  /** 分组是否来自服务端——同一分组键上服务端组名优先。 */
  fromServer: boolean;
};

export type McpToolGroup<T> = {
  key: string;
  label: string;
  description: string | null;
  items: Array<{ item: T; display: McpToolDisplay }>;
};

/**
 * 分组说明文案：服务端只下发组名不下发说明，这里按分组键补一句 UI 文案。
 * 服务端分组键（lifecycle / discovery / query / action / resource）与本地兜底键共用一张表；
 * 未收录的分组键不展示说明，不编造。
 */
const GROUP_DESCRIPTIONS: Record<string, string> = {
  // Agent 对话里这组照常给模型，只是 bkn_start_interaction / bkn_finish_interaction 的
  // 执行被 buildAgentTools 接管、绑到 Studio 这一轮交互上；外部 MCP 客户端直连时自行驱动。
  lifecycle: "创建会话、开始与结束一次交互、受管上下文写入。Agent 对话里由 Studio 绑定到当前这一轮交互",
  discovery: "知识网络列表、网络结构、Schema 探索与对象/关系类详情",
  query: "对象实例、关系子图、逻辑属性、指标与 SQL 查询",
  action: "行动信息召回、执行与执行历史",
  resource: "数据资源直查、技能召回与执行",
  network: "知识网络列表、当前网络详情",
  model: "语义检索、对象类、关系类、行动类、指标定义查询",
  data: "数据资源列表、字段结构、SQL 数据查询",
  logic: "逻辑属性计算、行动工具召回与执行",
  skill: "Skill 检索和线上动态工具",
  other: "暂未归类的 MCP 能力",
};

/** 本地兜底分组，数组顺序即展示顺序。 */
const LOCAL_GROUPS: Array<{ key: string; label: string }> = [
  { key: "lifecycle", label: "会话与交互生命周期" },
  { key: "network", label: "知识网络信息" },
  { key: "model", label: "知识网络模型检索" },
  { key: "query", label: "对象实例与关系子图查询" },
  { key: "data", label: "数据资源与 SQL 查询" },
  { key: "logic", label: "逻辑属性与行动调用" },
  { key: "skill", label: "技能与动态工具" },
  { key: "other", label: "其他能力" },
];

/** 本地兜底工具表，组内数组顺序即组内展示顺序。 */
const LOCAL_TOOLS: Array<{ id: string; groupKey: string; name: string }> = [
  { id: "bkn_create_conversation", groupKey: "lifecycle", name: "创建会话" },
  { id: "bkn_resume_conversation", groupKey: "lifecycle", name: "恢复会话" },
  { id: "bkn_close_conversation", groupKey: "lifecycle", name: "关闭会话" },
  { id: "bkn_start_interaction", groupKey: "lifecycle", name: "开始一次交互" },
  { id: "bkn_finish_interaction", groupKey: "lifecycle", name: "结束一次交互" },
  { id: "bkn_complete_interaction", groupKey: "lifecycle", name: "交互完成" },
  { id: "bkn_cancel_interaction", groupKey: "lifecycle", name: "取消交互" },
  { id: "bkn_fail_interaction", groupKey: "lifecycle", name: "交互失败" },
  { id: "bkn_handoff_interaction", groupKey: "lifecycle", name: "移交交互" },
  { id: "bkn_context", groupKey: "lifecycle", name: "受管上下文写入" },
  { id: "bkn_get_operation", groupKey: "lifecycle", name: "查看操作状态" },
  { id: "bkn_retry_operation", groupKey: "lifecycle", name: "重试操作" },
  { id: "bkn_get_receipt", groupKey: "lifecycle", name: "查看调用回执" },
  { id: "list_knowledge_networks", groupKey: "network", name: "知识网络列表" },
  { id: "get_kn_detail", groupKey: "network", name: "知识网络详情" },
  { id: "search_schema", groupKey: "model", name: "语义检索" },
  { id: "get_object_types", groupKey: "model", name: "对象类定义查询" },
  { id: "get_relation_types", groupKey: "model", name: "关系类定义查询" },
  { id: "get_action_types", groupKey: "model", name: "行动类定义查询" },
  { id: "get_metric_types", groupKey: "model", name: "指标定义查询" },
  { id: "query_object_instance", groupKey: "query", name: "对象实例查询" },
  { id: "query_instance_subgraph", groupKey: "query", name: "关系子图查询" },
  { id: "list_resources", groupKey: "data", name: "数据资源列表" },
  { id: "describe_resource", groupKey: "data", name: "资源字段结构" },
  { id: "run_sql", groupKey: "data", name: "SQL 数据查询" },
  { id: "get_logic_properties_values", groupKey: "logic", name: "逻辑属性计算" },
  { id: "get_action_info", groupKey: "logic", name: "行动工具召回" },
  { id: "execute_action", groupKey: "logic", name: "执行行动" },
  { id: "get_action_execution", groupKey: "logic", name: "行动执行结果" },
  { id: "list_action_execution", groupKey: "logic", name: "行动执行记录" },
  { id: "list_action_executions", groupKey: "logic", name: "行动执行记录" },
  { id: "query_metric", groupKey: "logic", name: "指标数据查询" },
  { id: "find_skills", groupKey: "skill", name: "Skill 能力检索" },
  { id: "list_skills", groupKey: "skill", name: "技能列表" },
  { id: "get_skill_content", groupKey: "skill", name: "查看技能内容" },
  { id: "read_skill_file", groupKey: "skill", name: "读取技能文件" },
  { id: "execute_skill", groupKey: "skill", name: "执行技能" },
];

/** 兜底 order 的起点：服务端 order 是十位量级，兜底整体排在其后。 */
const LOCAL_ORDER_BASE = 100_000;
/** 组内没有具名条目的（靠名字猜出来的）排在具名条目之后。 */
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

/** 工具名猜分组：服务端没声明、本地表也没收录时的最后一层兜底。 */
function guessLocal(toolId: string): { groupKey: string; name: string } {
  const id = toolId.toLowerCase();
  // 平台侧工具一律 bkn_ 前缀，前缀判必须排在所有关键字之前，两条都不能少：
  // - `bkn_xxx` 自带子串 `kn`，漏了前缀判就会被最后那条 includes("kn") 归进「知识网络信息」；
  // - `interaction` 里含 `action`，漏了它 bkn_*_interaction 会掉进「逻辑属性与行动调用」。
  // 后端的平台工具面一直在变（#618 期间扩到十余个溯源工具，之后又裁回两个），
  // 兜底表滞后于后端正是这层兜底存在的理由，所以这里按前缀兜、不按名单兜。
  if (id.startsWith("bkn_")) return { groupKey: "lifecycle", name: "会话生命周期工具" };
  if (id.includes("interaction") || id.includes("conversation")) return { groupKey: "lifecycle", name: "会话生命周期工具" };
  if (id.includes("object") || id.includes("relation") || id.includes("schema") || id.includes("metric_type")) {
    return { groupKey: "model", name: "知识模型工具" };
  }
  if (id.includes("resource") || id.includes("sql") || id.includes("catalog")) return { groupKey: "data", name: "数据资源工具" };
  if (id.includes("skill")) return { groupKey: "skill", name: "技能与动态工具" };
  if (id.includes("action") || id.includes("logic") || id.includes("metric")) return { groupKey: "logic", name: "逻辑与行动工具" };
  if (id.includes("instance") || id.includes("subgraph") || id.includes("query")) return { groupKey: "query", name: "对象查询工具" };
  if (id.includes("kn") || id.includes("network")) return { groupKey: "network", name: "知识网络工具" };
  return { groupKey: "other", name: "MCP 能力" };
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

/** 服务端展示元数据优先，缺哪项兜哪项（老服务端一项都不发时整体退回本地表）。 */
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
 * 按展示元数据分组：组内按 order 升序，分组按组内最小 order 升序。
 * 服务端声明过的分组因此排在纯兜底分组之前，未声明 order 的工具落在组尾。
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
    // 同一分组键上服务端组名优先：兜底命中的工具不该把服务端组名改回本地旧文案。
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
