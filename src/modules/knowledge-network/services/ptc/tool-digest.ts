/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * PTC 模式下 run_code 的工具说明：把 MCP 工具清单渲染成一份签名列表。
 *
 * 数据全部来自运行时的 tools/list——name、description、inputSchema、outputSchema、
 * 以及 _meta 里的分组与排序。因此说明与服务端实际注册的工具天然一致：工具增减、
 * 参数变更、条件注册未启用，这里都会跟着变，不存在副本漂移。
 *
 * 只渲染签名而非完整 schema：单是 query_object_instance 的 condition 一项描述就
 * 数百 token，21 个工具全量展开不可行。完整 schema 留在沙箱 stub 的 docstring 里，
 * 模型按需 help() 自取——两级披露。
 */

import type { McpToolDef } from "@/modules/knowledge-network/services/context-loader.service";

const PY_TYPES: Record<string, string> = {
  string: "str",
  array: "list",
  object: "dict",
  boolean: "bool",
  integer: "int",
  number: "float",
};

/**
 * 生命周期工具由本轮的 AgentTurnScope 接管，沙箱沿用同一个 interaction，
 * 不自行开关——否则一次任务会分裂成两条互不关联的证据链。
 */
const LIFECYCLE_TOOLS = new Set(["bkn_start_interaction", "bkn_finish_interaction"]);

/**
 * schema 默认 response_format=toon，那是为「直接喂给模型」优化的省 token 文本格式。
 * 代码模式下返回值先经脚本处理，需要可下标访问的结构，故覆盖为 json。
 */
const DEFAULT_OVERRIDES: Record<string, unknown> = { response_format: "json" };

/**
 * 少数工具存在「不看完整 docstring 必写错」的调用约定。完整规则在 docstring 里，
 * 这里只把最小可用示例提到签名清单——实测中模型不会先 help() 就动手。
 * 新增条目的依据应是实测失败，不是臆测。
 */
const HINTS: Record<string, string[]> = {
  run_sql: [
    "表名必须写成 {{.<resource_id>}} 占位符，id 取自 search_schema 的 data_source.id",
    "或 list_resources 的 resource_id；不可原样写 'resource_id' 字面量。",
    "列名用物理列名。仅单条 SELECT，无 CTE/UNION。",
    'run_sql(sql="SELECT team_name, COUNT(*) c FROM {{.<resource_id>}} GROUP BY team_name")',
  ],
};

type JsonSchemaLike = {
  properties?: Record<string, { type?: string; default?: unknown }>;
  required?: string[];
};

function asSchema(value: unknown): JsonSchemaLike {
  return value && typeof value === "object" ? (value as JsonSchemaLike) : {};
}

function pyLiteral(value: unknown): string {
  if (value === undefined || value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "string") return `'${value}'`;
  return String(value);
}

function signature(def: McpToolDef): string {
  const schema = asSchema(def.inputSchema);
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const positional: string[] = [];
  const keyword: string[] = [];
  for (const [name, spec] of Object.entries(props)) {
    const pyType = PY_TYPES[spec.type ?? ""] ?? "object";
    if (required.has(name)) {
      positional.push(`${name}: ${pyType}`);
    } else {
      const fallback = name in DEFAULT_OVERRIDES ? DEFAULT_OVERRIDES[name] : spec.default;
      keyword.push(`${name}: ${pyType} = ${pyLiteral(fallback)}`);
    }
  }
  return `${def.name}(${[...positional, ...keyword].join(", ")})`;
}

/**
 * 返回值顶层键。键名在各工具间并不统一（列表类有的叫 entries、有的叫 datas），
 * 模型无从推断——不写出来首次调用就会因 KeyError 失败，实测如此。
 */
function returnKeys(def: McpToolDef): string {
  const props = asSchema(def.outputSchema).properties ?? {};
  const names = Object.keys(props);
  return names.length ? `{${names.join(", ")}}` : "dict";
}

function metaOf(def: McpToolDef): { group: string; order: number } {
  return {
    group: def.groupTitle ?? def.group ?? "其他",
    order: def.order ?? Number.MAX_SAFE_INTEGER,
  };
}

export function renderToolDigest(mcpTools: McpToolDef[]): string {
  const candidates = mcpTools.filter((def) => def.name && !LIFECYCLE_TOOLS.has(def.name));

  // 分组按组内最小 order 排，而不是按组名字母序——服务端的 order 编码了
  // 「先发现、再查询、后执行」的使用顺序，字母序会把它打乱。
  const groupRank = new Map<string, number>();
  for (const def of candidates) {
    const { group, order } = metaOf(def);
    groupRank.set(group, Math.min(groupRank.get(group) ?? order, order));
  }
  const usable = [...candidates].sort((a, b) => {
    const left = metaOf(a);
    const right = metaOf(b);
    if (left.group !== right.group) {
      return (groupRank.get(left.group) ?? 0) - (groupRank.get(right.group) ?? 0);
    }
    return left.order - right.order;
  });

  const lines: string[] = [
    "下列 BKN 能力已在作用域内，直接调用即可，无需 import。",
    "只有 stdout 会返回给你——中间结果不进上下文，因此请在脚本内完成过滤与聚合，",
    "只 print 你真正需要的内容。调用失败抛 `ToolError`。",
    "",
    "签名末尾的 `-> {…}` 是返回值顶层键。**其中部分键可能不出现**",
    "（如 `total_count` 在带过滤的查询里就没有），一律用 `.get()` 取，不要下标。",
    "过滤字段必须是该对象类真实的数据属性名——先用 `get_object_types` 查",
    "`data_properties`，不要按语义猜。",
    "",
    "## 可用函数",
  ];

  let currentGroup: string | null = null;
  for (const def of usable) {
    const { group } = metaOf(def);
    if (group !== currentGroup) {
      if (currentGroup !== null) lines.push("```", "");
      lines.push("", `### ${group}`, "", "```python");
      currentGroup = group;
    }
    lines.push(`${signature(def)} -> ${returnKeys(def)}`);
    if (def.title) lines.push(`    # ${def.title}`);
    for (const hint of HINTS[def.name] ?? []) lines.push(`    #   ${hint}`);
  }
  lines.push("```", "");

  lines.push(
    "## 调用顺序",
    "",
    "`kn_id`、`ot_id` 不能凭空写，必须先查：",
    "",
    "```text",
    "list_knowledge_networks  → kn_id",
    "get_kn_detail(kn_id)     → object_types 概览",
    "get_object_types(...)    → 属性定义与可用算子",
    "```",
    "",
    "## 参数写不准时",
    "",
    "每个函数的完整 schema 在 docstring 里，脚本内自查，不要猜：",
    "",
    "```python",
    "help(query_object_instance)",
    "```",
    "",
    "特别是 `condition` 的 `operation`：`match` / `knn` 能否使用取决于该属性的",
    "`condition_operations`（见 `get_object_types` 返回），从 `type` 推不出来。",
    "",
    "## 错误处理",
    "",
    "调用失败抛 `ToolError`，message 为服务端原文。可在脚本内捕获并修正参数重试，",
    "不必回到对话轮次。",
  );

  return lines.join("\n");
}
