/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { generateText } from "ai";

import { createChatModel, type AgentTokenProvider } from "@/modules/knowledge-network/services/agent-chat.service";
import type { ContextLoaderEnv, KnDetail } from "@/modules/knowledge-network/services/context-loader.service";

/**
 * Prompt for turning a natural-language question into the MATCH / WHERE fragment the
 * explorer accepts. The schema goes in as ids with display names so the model can use
 * either; the output contract mirrors parseCypherPattern's expectations.
 */
export function buildCypherPrompt(detail: Pick<KnDetail, "object_types" | "relation_types">, question: string): { system: string; user: string } {
  const objectLines = detail.object_types.map((item) => {
    const props = (item.data_properties ?? [])
      .slice(0, 12)
      .map((property) => `${property.name}${property.type ? `:${property.type}` : ""}`)
      .join(", ");
    return `- ${item.id}（${item.name?.trim() || item.id}）${item.comment ? ` — ${item.comment.slice(0, 80)}` : ""}${props ? `\n  属性: ${props}` : ""}`;
  });
  const relationLines = detail.relation_types.map(
    (item) => `- ${item.id}（${item.name?.trim() || item.id}）: (${item.sourceId})-[:${item.id}]->(${item.targetId})`,
  );
  const system = [
    "你是知识网络图查询助手。把用户的自然语言问题改写成一段 openCypher 的 MATCH 模式，只输出模式本身。",
    "",
    "硬性规则：",
    "1. 只写 MATCH … 与可选的 WHERE …；绝对不要写 RETURN、ORDER BY、SKIP、LIMIT，也不要解释。",
    "2. 每个节点必须带变量和标签：(k:knowledge)。标签只能用下面列出的对象类 id。",
    "3. 关系必须带方向且只写一个关系类 id：-[:rel_id]-> 或 <-[:rel_id]-。方向以关系类定义的 source -> target 为准。",
    "4. 不支持变长关系（*1..3）、可选匹配、聚合、函数。WHERE 只能是 变量.属性 与字面量的 = <> < > <= >= 比较，用 AND 连接。",
    "4b. 节点里不要写属性映射（禁止 (p:product {name: 'x'})），过滤一律放到 WHERE：(p:product) … WHERE p.name = 'x'。",
    "5. 属性名只能用下面列出的属性名。",
    "6. = 是精确匹配，库里的名称往往是完整长名（如「问界M7 2024款1.5T智驾四驱Pro版6座」）。用户只给简称时不要对名称字段写 = 过滤：优先用编码/id 类属性，或者不加过滤、只给出关系模式，让用户在画布上再筛。",
    "7. 只用一行或几行纯文本输出，不要 Markdown 代码块。",
    "",
    "对象类：",
    ...objectLines,
    "",
    "关系类（方向为 source -> target）：",
    ...relationLines,
  ].join("\n");
  return { system, user: question.trim() };
}

/** Pulls the MATCH fragment out of a model reply: fences, prose and a stray RETURN tail are removed. */
export function extractCypherFragment(text: string): string {
  let body = text.trim();
  const fence = /```(?:cypher|sql)?\s*([\s\S]*?)```/i.exec(body);
  if (fence) body = fence[1].trim();
  const start = body.search(/\bMATCH\b/i);
  if (start > 0) body = body.slice(start);
  body = body.replace(/\b(RETURN|ORDER\s+BY|SKIP|LIMIT)\b[\s\S]*$/i, "").trim();
  return inlineMapsToWhere(body.replace(/;+\s*$/, "").trim());
}

/**
 * Rewrites `(v:Label {a: 'x', b: 2})` into `(v:Label)` plus `v.a = 'x' AND v.b = 2` in the WHERE
 * clause. Models reach for the inline form even when told not to, and the backend subset only
 * accepts WHERE comparisons.
 */
export function inlineMapsToWhere(fragment: string): string {
  const conditions: string[] = [];
  const stripped = fragment.replace(/\(\s*([A-Za-z_]\w*)\s*:\s*([^\s{)]+)\s*\{([^}]*)\}\s*\)/g, (_match, variable: string, label: string, body: string) => {
    for (const pair of splitTopLevel(body)) {
      const colon = pair.indexOf(":");
      if (colon < 0) continue;
      const key = pair.slice(0, colon).trim().replace(/^[`'"]|[`'"]$/g, "");
      const value = pair.slice(colon + 1).trim();
      if (key && value) conditions.push(`${variable}.${key} = ${value}`);
    }
    return `(${variable}:${label})`;
  });
  if (conditions.length === 0) return stripped;
  const where = /\bWHERE\b/i.exec(stripped);
  if (where) {
    const head = stripped.slice(0, where.index + where[0].length);
    const tail = stripped.slice(where.index + where[0].length).trim();
    return `${head} ${conditions.join(" AND ")}${tail ? ` AND ${tail}` : ""}`;
  }
  return `${stripped}\nWHERE ${conditions.join(" AND ")}`;
}

/** Splits `a: 'x, y', b: 2` on commas that are outside quotes. */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: string | null = null;
  for (const char of text) {
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }
    if (char === ",") {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

export async function generateCypherFragment(
  env: ContextLoaderEnv,
  tokenProvider: AgentTokenProvider,
  modelName: string,
  detail: Pick<KnDetail, "object_types" | "relation_types">,
  question: string,
  signal?: AbortSignal,
): Promise<string> {
  const prompt = buildCypherPrompt(detail, question);
  const result = await generateText({
    model: createChatModel(env, modelName, tokenProvider),
    system: prompt.system,
    prompt: prompt.user,
    temperature: 0,
    abortSignal: signal,
  });
  return extractCypherFragment(result.text);
}
